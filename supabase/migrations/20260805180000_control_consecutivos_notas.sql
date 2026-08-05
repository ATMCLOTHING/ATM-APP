-- ═══════════════════════════════════════════════════════════════════════════
-- CONTROL DE CONSECUTIVOS DE NOTAS DE ENTREGA
-- ═══════════════════════════════════════════════════════════════════════════
-- Contexto: varias notas se perdieron a medias (encabezado sin detalle, kardex
-- huérfano sin nota, o abono registrado sin que el saldo de la nota se
-- actualizara) porque el guardado se hacía desde el navegador en varias
-- llamadas HTTP separadas (upsert encabezado, borrar/insertar detalle, ajustar
-- inventario, insertar kardex, insertar abono, actualizar encabezado...). Si
-- el navegador se cerraba, la red fallaba o el usuario perdía la conexión a
-- mitad de esa secuencia, algunas tablas quedaban escritas y otras no: eso es
-- lo que dejó las notas 50435/50951/50952/50953/51077/51078 huérfanas o
-- perdidas (ver memoria del proyecto).
--
-- Esta migración cierra el problema por dos vías:
--
-- 1) ATOMICIDAD: todo el guardado de una nota (encabezado + detalle + ajuste
--    de inventario + kardex) y todo el registro de dinero (abono + saldo de
--    la nota, vale + abono + saldo, reversión de abono + saldo) se mueve a
--    funciones de PostgreSQL (una sola llamada RPC = una sola transacción).
--    Si algo falla a mitad de camino, Postgres revierte TODO automáticamente:
--    ya no puede quedar una nota con encabezado y sin detalle, ni un abono
--    sin que el saldo se actualice, ni inventario descontado sin su kardex.
--
-- 2) RESTRICCIÓN ESTRUCTURAL: se agrega una llave foránea real de
--    artikardex.numnotaent → encnotaen.numnotaent. Hasta hoy esa relación no
--    estaba forzada por la base de datos (detabonos, detnotaen y
--    vale_movimientos sí la tenían) — era la única puerta por la que un
--    movimiento de kardex podía quedar apuntando a una nota inexistente. Con
--    la llave foránea, eso ahora es imposible de crear sin importar qué bug
--    tenga el código en el futuro.
-- ═══════════════════════════════════════════════════════════════════════════

-- ───────────────────────────────────────────────────────────────────────────
-- 1) Llave foránea que faltaba: kardex nunca puede apuntar a una nota que no existe
-- ───────────────────────────────────────────────────────────────────────────
ALTER TABLE public.artikardex
  ADD CONSTRAINT artikardex_numnotaent_fkey
  FOREIGN KEY (numnotaent) REFERENCES public.encnotaen(numnotaent);

-- ───────────────────────────────────────────────────────────────────────────
-- 2) guardar_nota_completa: encabezado + detalle + inventario + kardex, atómico
-- ───────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.guardar_nota_completa(
  p_numnotaent bigint,
  p_encabezado jsonb,
  p_detalle    jsonb,
  p_usuario    text
) RETURNS jsonb
LANGUAGE plpgsql
AS $$
DECLARE
  v_cant_ant jsonb;
  r          record;
  v_exist    numeric;
  v_desc     text;
  v_tipo_mov text;
  v_concepto text;
  v_avisos   jsonb := '[]'::jsonb;
BEGIN
  IF p_numnotaent IS NULL THEN
    RAISE EXCEPTION 'numnotaent es obligatorio';
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
    (p_encabezado->>'valtotal')::numeric,
    (p_encabezado->>'valabono')::numeric,
    (p_encabezado->>'saldo')::numeric,
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

  RETURN jsonb_build_object('ok', true, 'avisos', v_avisos);
END;
$$;

-- ───────────────────────────────────────────────────────────────────────────
-- 3) registrar_abono_nota: inserta el abono (si aplica) y siempre recalcula
--    el encabezado a partir de la suma real de detabonos (se autocorrige
--    cualquier desfase en vez de arrastrarlo). Atómico.
-- ───────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.registrar_abono_nota(
  p_numnotaent  bigint,
  p_valor       numeric,
  p_mediopago   text,
  p_observacion text,
  p_fecha       date DEFAULT CURRENT_DATE,
  p_descuento   numeric DEFAULT 0,
  p_usuario     text DEFAULT 'sistema'
) RETURNS jsonb
LANGUAGE plpgsql
AS $$
DECLARE
  v_nota             record;
  v_nuevo_abono      numeric;
  v_nuevo_valdescue  numeric;
  v_nuevo_valtotal   numeric;
  v_nuevo_saldo      numeric;
  v_nuevo_porcdescue numeric;
BEGIN
  SELECT * INTO v_nota FROM public.encnotaen WHERE numnotaent = p_numnotaent FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'La nota % no existe.', p_numnotaent;
  END IF;
  IF v_nota.anulada = 'S' THEN
    RAISE EXCEPTION 'La nota % está anulada.', p_numnotaent;
  END IF;

  IF COALESCE(p_valor,0) > 0 THEN
    INSERT INTO public.detabonos (numnotaent, fechaabono, valabono, mediopago, observacio)
    VALUES (p_numnotaent, COALESCE(p_fecha, CURRENT_DATE), p_valor, p_mediopago, p_observacion);
  END IF;

  SELECT COALESCE(SUM(valabono),0) INTO v_nuevo_abono
    FROM public.detabonos WHERE numnotaent = p_numnotaent;

  v_nuevo_valdescue  := COALESCE(v_nota.valdescue,0) + COALESCE(p_descuento,0);
  v_nuevo_valtotal   := COALESCE(v_nota.valtotal,0)  - COALESCE(p_descuento,0);
  v_nuevo_saldo      := GREATEST(v_nuevo_valtotal - v_nuevo_abono, 0);
  v_nuevo_porcdescue := CASE WHEN (v_nuevo_valtotal + v_nuevo_valdescue) > 0
    THEN ROUND((v_nuevo_valdescue / (v_nuevo_valtotal + v_nuevo_valdescue) * 100)::numeric, 2)
    ELSE 0 END;

  UPDATE public.encnotaen SET
    valabono = v_nuevo_abono, saldo = v_nuevo_saldo,
    valtotal = v_nuevo_valtotal, valdescue = v_nuevo_valdescue,
    porcdescue = v_nuevo_porcdescue, fecultabon = COALESCE(p_fecha, CURRENT_DATE)
  WHERE numnotaent = p_numnotaent;

  RETURN jsonb_build_object(
    'valabono', v_nuevo_abono, 'saldo', v_nuevo_saldo,
    'valtotal', v_nuevo_valtotal, 'valdescue', v_nuevo_valdescue, 'porcdescue', v_nuevo_porcdescue
  );
END;
$$;

-- ───────────────────────────────────────────────────────────────────────────
-- 4) revertir_abono_nota: revierte (total o parcial) un abono y siempre
--    recalcula el saldo desde la suma real de detabonos. Atómico.
-- ───────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.revertir_abono_nota(
  p_abono_id        bigint,
  p_valor_revertir  numeric DEFAULT NULL, -- NULL = revertir el abono completo
  p_usuario         text DEFAULT 'sistema'
) RETURNS jsonb
LANGUAGE plpgsql
AS $$
DECLARE
  v_ab          record;
  v_nota        record;
  v_valor       numeric;
  v_nueva_suma  numeric;
  v_nuevo_saldo numeric;
BEGIN
  SELECT * INTO v_ab FROM public.detabonos WHERE id = p_abono_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'El abono % no existe.', p_abono_id;
  END IF;

  SELECT * INTO v_nota FROM public.encnotaen WHERE numnotaent = v_ab.numnotaent FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'La nota % no existe.', v_ab.numnotaent;
  END IF;

  v_valor := COALESCE(p_valor_revertir, v_ab.valabono);
  IF v_valor <= 0 OR v_valor > v_ab.valabono + 0.01 THEN
    RAISE EXCEPTION 'Valor a revertir inválido (% sobre un abono de %).', v_valor, v_ab.valabono;
  END IF;

  IF v_valor >= v_ab.valabono - 0.01 THEN
    DELETE FROM public.detabonos WHERE id = p_abono_id;
  ELSE
    UPDATE public.detabonos SET valabono = v_ab.valabono - v_valor WHERE id = p_abono_id;
  END IF;

  SELECT COALESCE(SUM(valabono),0) INTO v_nueva_suma
    FROM public.detabonos WHERE numnotaent = v_ab.numnotaent;
  v_nuevo_saldo := GREATEST(COALESCE(v_nota.valtotal,0) - v_nueva_suma, 0);

  UPDATE public.encnotaen SET valabono = v_nueva_suma, saldo = v_nuevo_saldo
  WHERE numnotaent = v_ab.numnotaent;

  RETURN jsonb_build_object('numnotaent', v_ab.numnotaent, 'valabono', v_nueva_suma, 'saldo', v_nuevo_saldo);
END;
$$;

-- ───────────────────────────────────────────────────────────────────────────
-- 5) aplicar_vale_nota: consume un vale como parte de pago de una nota
--    (vale + vale_movimientos + detabonos + encabezado), atómico.
-- ───────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.aplicar_vale_nota(
  p_vale_id     bigint,
  p_numnotaent  bigint,
  p_valor       numeric,
  p_usuario     text DEFAULT 'sistema'
) RETURNS jsonb
LANGUAGE plpgsql
AS $$
DECLARE
  v_vale             record;
  v_nota             record;
  v_nuevo_saldo_vale numeric;
  v_nuevo_abono      numeric;
  v_nuevo_saldo      numeric;
BEGIN
  SELECT * INTO v_vale FROM public.vales WHERE id = p_vale_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'El vale no existe.';
  END IF;
  IF v_vale.estado <> 'ACTIVO' THEN
    RAISE EXCEPTION 'El vale % no está activo.', v_vale.codigo;
  END IF;
  IF p_valor > v_vale.saldo + 0.01 THEN
    RAISE EXCEPTION 'El valor aplicado ($%) supera el saldo del vale ($%).', p_valor, v_vale.saldo;
  END IF;

  SELECT * INTO v_nota FROM public.encnotaen WHERE numnotaent = p_numnotaent FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'La nota % no existe.', p_numnotaent;
  END IF;
  IF v_nota.anulada = 'S' THEN
    RAISE EXCEPTION 'La nota % está anulada.', p_numnotaent;
  END IF;

  v_nuevo_saldo_vale := v_vale.saldo - p_valor;
  UPDATE public.vales SET
    saldo = v_nuevo_saldo_vale,
    estado = CASE WHEN v_nuevo_saldo_vale <= 0.01 THEN 'AGOTADO' ELSE 'ACTIVO' END
  WHERE id = p_vale_id;

  INSERT INTO public.vale_movimientos (vale_id, tipo, valor, numnotaent, usuario)
  VALUES (p_vale_id, 'CONSUMO', p_valor, p_numnotaent, p_usuario);

  INSERT INTO public.detabonos (numnotaent, fechaabono, valabono, mediopago, observacio)
  VALUES (p_numnotaent, CURRENT_DATE, p_valor, 'Vale', 'Vale ' || v_vale.codigo);

  SELECT COALESCE(SUM(valabono),0) INTO v_nuevo_abono
    FROM public.detabonos WHERE numnotaent = p_numnotaent;
  v_nuevo_saldo := GREATEST(COALESCE(v_nota.valtotal,0) - v_nuevo_abono, 0);

  UPDATE public.encnotaen SET
    valabono = v_nuevo_abono, saldo = v_nuevo_saldo, fecultabon = CURRENT_DATE
  WHERE numnotaent = p_numnotaent;

  RETURN jsonb_build_object('valabono', v_nuevo_abono, 'saldo', v_nuevo_saldo, 'vale_saldo', v_nuevo_saldo_vale);
END;
$$;

-- ───────────────────────────────────────────────────────────────────────────
-- 6) anular_nota_completa: marca la nota como anulada y restaura TODO el
--    inventario de sus líneas (con su kardex), atómico. Antes se hacía con
--    un update y un loop de llamadas separadas por cada línea: si el
--    navegador se cerraba a mitad del loop, algunas tallas quedaban
--    restauradas y otras no.
-- ───────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.anular_nota_completa(
  p_numnotaent bigint,
  p_motivo     text,
  p_usuario    text DEFAULT 'sistema'
) RETURNS jsonb
LANGUAGE plpgsql
AS $$
DECLARE
  v_nota  record;
  r       record;
  v_exist numeric;
BEGIN
  SELECT * INTO v_nota FROM public.encnotaen WHERE numnotaent = p_numnotaent FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'La nota % no existe.', p_numnotaent;
  END IF;
  IF v_nota.anulada = 'S' THEN
    RAISE EXCEPTION 'La nota % ya está anulada.', p_numnotaent;
  END IF;

  UPDATE public.encnotaen SET
    anulada = 'S', fechaanula = CURRENT_DATE, motivoanula = COALESCE(p_motivo, 'Anulada')
  WHERE numnotaent = p_numnotaent;

  FOR r IN SELECT codartic, talla, cantidad, descartic FROM public.detnotaen WHERE numnotaent = p_numnotaent
  LOOP
    PERFORM public.ajustar_inventario(r.codartic, r.talla, -r.cantidad);
    SELECT existencia INTO v_exist FROM public.articomp WHERE codartic = r.codartic AND talla = r.talla LIMIT 1;
    INSERT INTO public.artikardex (
      codartic, descartic, talla, tipo_mov, concepto, cantidad, existencia_despues, numnotaent, usuario
    ) VALUES (
      r.codartic, r.descartic, r.talla, 'DEVOLUCION', 'Anulación nota ' || p_numnotaent || ': ' || COALESCE(p_motivo,''),
      r.cantidad, v_exist, p_numnotaent, p_usuario
    );
  END LOOP;

  RETURN jsonb_build_object('ok', true);
END;
$$;

-- ───────────────────────────────────────────────────────────────────────────
-- Permisos: la app usa la clave anónima (sin Supabase Auth), igual que el
-- resto de RPC del proyecto.
-- ───────────────────────────────────────────────────────────────────────────
GRANT EXECUTE ON FUNCTION public.guardar_nota_completa(bigint, jsonb, jsonb, text)              TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.registrar_abono_nota(bigint, numeric, text, text, date, numeric, text) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.revertir_abono_nota(bigint, numeric, text)                      TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.aplicar_vale_nota(bigint, bigint, numeric, text)                 TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.anular_nota_completa(bigint, text, text)                         TO anon, authenticated, service_role;
