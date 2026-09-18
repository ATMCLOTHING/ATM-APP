-- ═══════════════════════════════════════════════════════════════════════════
-- EVITAR SALDO NEGATIVO EN NOTAS DE ENTREGA
-- ═══════════════════════════════════════════════════════════════════════════
-- Contexto: una nota ya guardada y con abono registrado puede terminar con saldo
-- negativo si después se le editan las líneas (ej. devoluciones tecleadas a mano con
-- cantidad negativa en la grilla, en vez de usar el botón de devolución por línea) y el
-- nuevo total queda por debajo de lo que ya se había abonado. guardar_nota_completa()
-- guardaba ese saldo negativo tal cual venía del navegador — ver nota 46210.
--
-- guardar_nota_completa() ahora SIEMPRE recalcula el saldo internamente como
-- valtotal - valabono (ignora el campo "saldo" que mande el navegador) y:
--   - si no queda negativo, guarda normal (igual que antes).
--   - si queda negativo y no viene p_confirmar_ajuste_saldo=true, NO guarda nada:
--     lanza el error 'SALDO_NEGATIVO|monto|valtotal|valabono' para que el navegador le
--     pregunte a la usuaria si se ajusta a $0.
--   - si queda negativo y sí viene p_confirmar_ajuste_saldo=true, guarda con saldo=0 y
--     genera un vale a favor del cliente por el excedente (para no perder ese dinero:
--     ya fue realmente abonado), igual que ya se hacía para las devoluciones por línea
--     en procesar_devolucion_nota().
-- ═══════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.guardar_nota_completa(
  p_numnotaent bigint,
  p_encabezado jsonb,
  p_detalle    jsonb,
  p_usuario    text,
  p_confirmar_ajuste_saldo boolean DEFAULT false
) RETURNS jsonb
LANGUAGE plpgsql
AS $$
DECLARE
  v_cant_ant    jsonb;
  r             record;
  v_exist       numeric;
  v_desc        text;
  v_tipo_mov    text;
  v_concepto    text;
  v_avisos      jsonb := '[]'::jsonb;
  v_valtotal_in numeric;
  v_valabono_in numeric;
  v_saldo_crudo numeric;
  v_saldo_final numeric;
  v_vale_monto  numeric := 0;
  v_vale_codigo text;
  v_vale_id     bigint;
BEGIN
  IF p_numnotaent IS NULL THEN
    RAISE EXCEPTION 'numnotaent es obligatorio';
  END IF;

  v_valtotal_in := COALESCE((p_encabezado->>'valtotal')::numeric, 0);
  v_valabono_in := COALESCE((p_encabezado->>'valabono')::numeric, 0);
  v_saldo_crudo := v_valtotal_in - v_valabono_in;

  IF v_saldo_crudo < -0.01 THEN
    IF NOT p_confirmar_ajuste_saldo THEN
      RAISE EXCEPTION 'SALDO_NEGATIVO|%|%|%', round(abs(v_saldo_crudo),2), round(v_valtotal_in,2), round(v_valabono_in,2);
    END IF;
    v_vale_monto  := abs(v_saldo_crudo);
    v_saldo_final := 0;
  ELSE
    v_saldo_final := v_saldo_crudo;
  END IF;

  -- Cantidades ANTES del guardado (para el diff de inventario/kardex), tomadas
  -- antes de tocar detnotaen.
  SELECT COALESCE(jsonb_agg(jsonb_build_object('codartic',codartic,'talla',talla,'cantidad',cantidad)), '[]'::jsonb)
    INTO v_cant_ant
    FROM (
      SELECT codartic, talla, SUM(cantidad) AS cantidad
      FROM public.detnotaen WHERE numnotaent = p_numnotaent
      GROUP BY codartic, talla
    ) s;

  -- Encabezado (upsert)
  INSERT INTO public.encnotaen (
    numnotaent, fechanotae, fechavence, formapago, mediopago, codclient,
    nombreclie, cedrifclie, direcicion, celular, ciudad, departamen, nomempresa,
    porcdescue, porciva, subtotal, valdescue, valiva, valtotal, valabono, saldo,
    cedvended, cantotal, anulada, usuario
  ) VALUES (
    p_numnotaent,
    (p_encabezado->>'fechanotae')::date,
    (p_encabezado->>'fechavence')::date,
    p_encabezado->>'formapago',
    p_encabezado->>'mediopago',
    p_encabezado->>'codclient',
    p_encabezado->>'nombreclie',
    p_encabezado->>'cedrifclie',
    p_encabezado->>'direcicion',
    p_encabezado->>'celular',
    p_encabezado->>'ciudad',
    p_encabezado->>'departamen',
    p_encabezado->>'nomempresa',
    (p_encabezado->>'porcdescue')::numeric,
    (p_encabezado->>'porciva')::numeric,
    (p_encabezado->>'subtotal')::numeric,
    (p_encabezado->>'valdescue')::numeric,
    (p_encabezado->>'valiva')::numeric,
    v_valtotal_in,
    v_valabono_in,
    v_saldo_final,
    p_encabezado->>'cedvended',
    (p_encabezado->>'cantotal')::numeric,
    'N',
    p_usuario
  )
  ON CONFLICT (numnotaent) DO UPDATE SET
    fechanotae=excluded.fechanotae, fechavence=excluded.fechavence,
    formapago=excluded.formapago, mediopago=excluded.mediopago,
    codclient=excluded.codclient, nombreclie=excluded.nombreclie,
    cedrifclie=excluded.cedrifclie, direcicion=excluded.direcicion,
    celular=excluded.celular, ciudad=excluded.ciudad, departamen=excluded.departamen,
    nomempresa=excluded.nomempresa, porcdescue=excluded.porcdescue, porciva=excluded.porciva,
    subtotal=excluded.subtotal, valdescue=excluded.valdescue, valiva=excluded.valiva,
    valtotal=excluded.valtotal, valabono=excluded.valabono, saldo=excluded.saldo,
    cedvended=excluded.cedvended, cantotal=excluded.cantotal, anulada=excluded.anulada,
    usuario=excluded.usuario;

  -- Detalle (reemplazo completo)
  DELETE FROM public.detnotaen WHERE numnotaent = p_numnotaent;
  INSERT INTO public.detnotaen (
    numnotaent, codartic, descartic, marca, talla, cantidad, valunit,
    subtotal, porciva, valiva, porcdescue, valdescue, valtotal
  )
  SELECT
    p_numnotaent, x.codartic, x.descartic, COALESCE(x.marca,''), x.talla,
    x.cantidad, x.valunit, x.cantidad * x.valunit,
    x.porciva, x.valiva, x.porcdescue, x.valdescue, x.valtotal
  FROM jsonb_to_recordset(p_detalle) AS x(
    codartic text, descartic text, marca text, talla text,
    cantidad numeric, valunit numeric, porciva numeric, valiva numeric,
    porcdescue numeric, valdescue numeric, valtotal numeric
  );

  -- Diff de cantidades (antes vs. después) → ajustar inventario + kardex
  FOR r IN
    SELECT COALESCE(ant.codartic, nue.codartic) AS codartic,
           COALESCE(ant.talla, nue.talla)       AS talla,
           COALESCE(nue.cantidad,0) - COALESCE(ant.cantidad,0) AS diff
    FROM jsonb_to_recordset(v_cant_ant) AS ant(codartic text, talla text, cantidad numeric)
    FULL OUTER JOIN (
      SELECT codartic, talla, SUM(cantidad) AS cantidad
      FROM public.detnotaen WHERE numnotaent = p_numnotaent
      GROUP BY codartic, talla
    ) nue ON nue.codartic = ant.codartic AND nue.talla = ant.talla
  LOOP
    IF r.diff = 0 THEN CONTINUE; END IF;

    PERFORM public.ajustar_inventario(r.codartic, r.talla, r.diff);

    SELECT existencia, descartic INTO v_exist, v_desc
      FROM public.articomp WHERE codartic = r.codartic AND talla = r.talla LIMIT 1;

    IF v_exist IS NOT NULL AND v_exist < 0 THEN
      v_avisos := v_avisos || jsonb_build_object('codartic', r.codartic, 'talla', r.talla, 'existencia', v_exist);
    END IF;

    v_tipo_mov := CASE WHEN r.diff > 0 THEN 'ENTRADA' ELSE 'SALIDA' END;
    v_concepto := CASE WHEN r.diff > 0 THEN 'Ajuste en nota ' || p_numnotaent ELSE 'Venta nota ' || p_numnotaent END;

    INSERT INTO public.artikardex (
      codartic, descartic, talla, tipo_mov, concepto, cantidad, existencia_despues, numnotaent, usuario
    ) VALUES (
      r.codartic, COALESCE(v_desc, r.codartic), r.talla, v_tipo_mov, v_concepto,
      ABS(r.diff), v_exist, p_numnotaent, p_usuario
    );
  END LOOP;

  -- Saldo negativo confirmado por la usuaria: se ajusta a $0 y se genera un vale por el
  -- excedente a favor del cliente (ese dinero ya fue abonado de verdad, no se pierde).
  IF v_vale_monto > 0.01 THEN
    v_vale_codigo := public.siguiente_codigo_vale();
    INSERT INTO public.vales (
      codigo, cliente_id, cliente_ced, cliente_nombre, valor_original, saldo,
      numnotaent_origen, motivo, estado, usuario
    ) VALUES (
      v_vale_codigo, NULLIF(p_encabezado->>'codclient','')::bigint, p_encabezado->>'cedrifclie', p_encabezado->>'nombreclie',
      v_vale_monto, v_vale_monto, p_numnotaent,
      'Ajuste a $0 por saldo negativo en nota ' || p_numnotaent, 'ACTIVO', p_usuario
    ) RETURNING id INTO v_vale_id;
    INSERT INTO public.vale_movimientos (vale_id, tipo, valor, numnotaent, usuario)
    VALUES (v_vale_id, 'EMISION', v_vale_monto, p_numnotaent, p_usuario);
  END IF;

  RETURN jsonb_build_object(
    'ok', true, 'avisos', v_avisos,
    'vale', CASE WHEN v_vale_monto > 0.01
      THEN jsonb_build_object('codigo', v_vale_codigo, 'valor', v_vale_monto)
      ELSE NULL END
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.guardar_nota_completa(bigint, jsonb, jsonb, text, boolean) TO anon, authenticated, service_role;
