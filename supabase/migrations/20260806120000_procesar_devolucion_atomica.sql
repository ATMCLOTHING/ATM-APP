-- Cierra el último punto pendiente del control de consecutivos (ver migración
-- 20260805180000_control_consecutivos_notas.sql): la devolución de una línea de
-- mercancía sobre una nota ya guardada seguía haciéndose en varios pasos sueltos
-- (restaurar inventario + kardex, ajustar/borrar la línea, recalcular totales de la
-- nota, y a veces crear un vale) — si el navegador se cerraba a mitad de camino podía
-- quedar, por ejemplo, el inventario restaurado sin que la nota reflejara el cambio,
-- o un vale creado sin que el saldo de la nota bajara. Mismo patrón que las demás:
-- todo en una sola función de Postgres, una sola transacción.

CREATE OR REPLACE FUNCTION public.procesar_devolucion_nota(
  p_detnotaen_id       bigint,
  p_cantidad_devuelta  numeric,
  p_usuario            text DEFAULT 'sistema'
) RETURNS jsonb
LANGUAGE plpgsql
AS $$
DECLARE
  v_lin               record;
  v_nota              record;
  v_precio_unit       numeric;
  v_valor_devolucion  numeric;
  v_cant_restante     numeric;
  v_factor            numeric;
  v_nuevo_subtotal    numeric;
  v_nuevo_dcto        numeric;
  v_nuevo_iva         numeric;
  v_nuevo_total       numeric;
  v_nueva_cant        numeric;
  v_saldo_actual      numeric;
  v_vale_monto        numeric := 0;
  v_nuevo_saldo       numeric;
  v_exist             numeric;
  v_vale_codigo       text;
  v_vale_id           bigint;
BEGIN
  SELECT * INTO v_lin FROM public.detnotaen WHERE id = p_detnotaen_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'La línea % no existe.', p_detnotaen_id;
  END IF;

  SELECT * INTO v_nota FROM public.encnotaen WHERE numnotaent = v_lin.numnotaent FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'La nota % no existe.', v_lin.numnotaent;
  END IF;
  IF v_nota.anulada = 'S' THEN
    RAISE EXCEPTION 'La nota % está anulada.', v_lin.numnotaent;
  END IF;
  IF p_cantidad_devuelta <= 0 OR p_cantidad_devuelta > v_lin.cantidad THEN
    RAISE EXCEPTION 'Cantidad a devolver inválida (% sobre una línea de %).', p_cantidad_devuelta, v_lin.cantidad;
  END IF;

  v_precio_unit      := COALESCE(v_lin.valtotal,0) / NULLIF(v_lin.cantidad,0);
  v_valor_devolucion := v_precio_unit * p_cantidad_devuelta;

  -- 1) Restaurar inventario + kardex
  PERFORM public.ajustar_inventario(v_lin.codartic, v_lin.talla, -p_cantidad_devuelta);
  SELECT existencia INTO v_exist FROM public.articomp WHERE codartic=v_lin.codartic AND talla=v_lin.talla LIMIT 1;
  INSERT INTO public.artikardex (codartic, descartic, talla, tipo_mov, concepto, cantidad, existencia_despues, numnotaent, usuario)
  VALUES (v_lin.codartic, v_lin.descartic, v_lin.talla, 'DEVOLUCION', 'Devolución nota ' || v_lin.numnotaent,
          p_cantidad_devuelta, v_exist, v_lin.numnotaent, p_usuario);

  -- 2) Ajustar o eliminar la línea
  v_cant_restante := v_lin.cantidad - p_cantidad_devuelta;
  IF v_cant_restante <= 0 THEN
    DELETE FROM public.detnotaen WHERE id = p_detnotaen_id;
  ELSE
    v_factor := v_cant_restante / v_lin.cantidad;
    UPDATE public.detnotaen SET
      cantidad = v_cant_restante,
      subtotal = COALESCE(v_lin.subtotal, v_lin.cantidad*v_lin.valunit) * v_factor,
      valdescue = COALESCE(v_lin.valdescue,0) * v_factor,
      valiva    = COALESCE(v_lin.valiva,0) * v_factor,
      valtotal  = COALESCE(v_lin.valtotal,0) * v_factor
    WHERE id = p_detnotaen_id;
  END IF;

  -- 3) Recalcular totales de la nota a partir de las líneas restantes
  SELECT COALESCE(SUM(cantidad*valunit),0), COALESCE(SUM(valdescue),0), COALESCE(SUM(valiva),0),
         COALESCE(SUM(valtotal),0), COALESCE(SUM(cantidad),0)
    INTO v_nuevo_subtotal, v_nuevo_dcto, v_nuevo_iva, v_nuevo_total, v_nueva_cant
    FROM public.detnotaen WHERE numnotaent = v_lin.numnotaent;

  -- 4) Determinar si corresponde generar vale (mismo criterio que antes)
  v_saldo_actual := COALESCE(v_nota.saldo,0);
  IF v_saldo_actual <= 0.01 THEN
    v_vale_monto := v_valor_devolucion;
    v_nuevo_saldo := GREATEST(v_nuevo_total - COALESCE(v_nota.valabono,0), 0);
  ELSIF v_valor_devolucion <= v_saldo_actual THEN
    v_nuevo_saldo := v_saldo_actual - v_valor_devolucion;
  ELSE
    v_vale_monto := v_valor_devolucion - v_saldo_actual;
    v_nuevo_saldo := 0;
  END IF;

  UPDATE public.encnotaen SET
    subtotal = v_nuevo_subtotal, valdescue = v_nuevo_dcto, valiva = v_nuevo_iva,
    valtotal = v_nuevo_total, saldo = v_nuevo_saldo, cantotal = v_nueva_cant
  WHERE numnotaent = v_lin.numnotaent;

  IF v_vale_monto > 0.01 THEN
    v_vale_codigo := public.siguiente_codigo_vale();
    INSERT INTO public.vales (
      codigo, cliente_id, cliente_ced, cliente_nombre, valor_original, saldo,
      numnotaent_origen, motivo, estado, usuario
    ) VALUES (
      v_vale_codigo, NULLIF(v_nota.codclient,'')::bigint, v_nota.cedrifclie, v_nota.nombreclie,
      v_vale_monto, v_vale_monto, v_lin.numnotaent,
      'Devolución de ' || v_lin.descartic || ' (' || p_cantidad_devuelta || ' und.)',
      'ACTIVO', p_usuario
    ) RETURNING id INTO v_vale_id;
    INSERT INTO public.vale_movimientos (vale_id, tipo, valor, numnotaent, usuario)
    VALUES (v_vale_id, 'EMISION', v_vale_monto, v_lin.numnotaent, p_usuario);
  END IF;

  RETURN jsonb_build_object(
    'numnotaent', v_lin.numnotaent, 'codartic', v_lin.codartic, 'descartic', v_lin.descartic,
    'talla', v_lin.talla, 'cantidad', p_cantidad_devuelta, 'valorDevolucion', v_valor_devolucion,
    'saldoAntes', v_saldo_actual, 'saldoNuevo', v_nuevo_saldo,
    'vale', CASE WHEN v_vale_monto > 0.01 THEN jsonb_build_object('codigo', v_vale_codigo, 'valor', v_vale_monto) ELSE NULL END
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.procesar_devolucion_nota(bigint, numeric, text) TO anon, authenticated, service_role;
