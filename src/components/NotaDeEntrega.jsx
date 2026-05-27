// src/components/NotaDeEntrega.jsx
// ══════════════════════════════════════════════════════════════════════
// NOTA DE ENTREGA — Formulario completo
// Incluye: búsqueda cliente/artículo, líneas de detalle, totales,
//          abonos, resumen, detalle, impresión, navegación.
// ══════════════════════════════════════════════════════════════════════

import { useState, useEffect, useRef, useCallback } from 'react'
import ModalAbonos    from './ModalAbonos'
import ModalResumen   from './ModalResumen'
import ModalDetalle   from './ModalDetalle'
import PrintNota      from './PrintNota'

/* ─── helpers ─── */
const fmt = (n) =>
  Number(n || 0).toLocaleString('es-CO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

const hoy = () => new Date().toISOString().slice(0, 10)

const LINEA_VACIA = {
  codartic: '', descartic: '', talla: '', cantidad: 1,
  valunit: 0, porciva: 0, valiva: 0,
  porcdescue: 0, valdescue: 0, valtotal: 0,
}

const PLAZOS   = ['CONTADO', '15 DÍAS', '30 DÍAS', '60 DÍAS', '90 DÍAS']
const TIPO_VTA = ['Mayor', 'Detal', 'Vendedor']
const MEDIOS   = ['Efectivo', 'Transferencia', 'Mixto', 'Crédito']

/* ══════════════════════════════════════════════════════════════════════
   COMPONENTE PRINCIPAL
   ══════════════════════════════════════════════════════════════════════ */
export default function NotaDeEntrega({ supabase, onClose }) {

  /* ── cabecera ── */
  const [nroDoc,     setNroDoc]     = useState('')
  const [fecha,      setFecha]      = useState(hoy())
  const [fechaPago,  setFechaPago]  = useState(hoy())
  const [plazoPago,  setPlazoPago]  = useState('CONTADO')
  const [porcDescto, setPorcDescto] = useState(0)
  const [porcIva,    setPorcIva]    = useState(0)
  const [tipoVenta,  setTipoVenta]  = useState('Mayor')
  const [medioPago,  setMedioPago]  = useState('Efectivo')

  /* ── cliente ── */
  const [codCliente,        setCodCliente]        = useState('99')
  const [clienteInput,      setClienteInput]      = useState('')
  const [cliente,           setCliente]           = useState(null)
  const [clienteSugg,       setClienteSugg]       = useState([])
  const [buscandoCliente,   setBuscandoCliente]   = useState(false)

  /* ── vendedor ── */
  const [cedVendedor, setCedVendedor] = useState('')
  const [vendedor,    setVendedor]    = useState(null)

  /* ── líneas ── */
  const [lineas,     setLineas]     = useState([{ ...LINEA_VACIA }])
  const [artSugg,    setArtSugg]    = useState([])
  const [artSugIdx,  setArtSugIdx]  = useState(null)

  /* ── abonos (para saldo) ── */
  const [totalAbonos, setTotalAbonos] = useState(0)

  /* ── navegación ── */
  const [allIds,   setAllIds]   = useState([])
  const [navPos,   setNavPos]   = useState(null)   // índice en allIds

  /* ── UI ── */
  const [cargando,  setCargando]  = useState(false)
  const [mensaje,   setMensaje]   = useState(null)  // {tipo:'ok'|'err', texto}
  const [modal,     setModal]     = useState(null)  // 'abonos'|'resumen'|'detalle'|'print'

  const printRef = useRef()

  /* ════════ INICIALIZAR ════════ */
  useEffect(() => {
    cargarIdsNavegacion().then(() => {
      cargarClientePorCod('99')
    })
  }, [])

  async function cargarIdsNavegacion() {
    const { data } = await supabase
      .from('encnotaen')
      .select('numnotaent')
      .order('numnotaent', { ascending: true })
    const ids = (data || []).map(r => r.numnotaent)
    setAllIds(ids)
    // número siguiente para doc nuevo
    const ultimo = ids.length ? Number(ids[ids.length - 1]) : 0
    setNroDoc(String(ultimo + 1))
    setNavPos(null) // doc nuevo, no existe aún
  }

  /* ════════ CLIENTE ════════ */
  async function cargarClientePorCod(cod) {
    if (!cod) return
    const { data } = await supabase
      .from('clientes')
      .select('*')
      .eq('codclient', cod)
      .maybeSingle()
    if (data) {
      setCliente(data)
      setClienteInput(data.nombreclie || '')
      setCodCliente(data.codclient)
    }
  }

  async function buscarCliente(texto) {
    setClienteInput(texto)
    if (texto.length < 2) { setClienteSugg([]); return }
    setBuscandoCliente(true)
    const esNumero = /^\d+$/.test(texto)
    let query = supabase.from('clientes').select('*')
    if (esNumero) {
      query = query.or(`codclient.eq.${texto},cedrifclie.ilike.%${texto}%`)
    } else {
      query = query.ilike('nombreclie', `%${texto}%`)
    }
    const { data } = await query.limit(8)
    setClienteSugg(data || [])
    setBuscandoCliente(false)
  }

  function elegirCliente(c) {
    setCliente(c)
    setCodCliente(c.codclient)
    setClienteInput(c.nombreclie)
    setClienteSugg([])
  }

  /* ════════ VENDEDOR ════════ */
  async function cargarVendedor(ced) {
    if (!ced) return
    const { data } = await supabase
      .from('vendedor')
      .select('*')
      .eq('cedvended', ced)
      .maybeSingle()
    setVendedor(data || null)
  }

  /* ════════ ARTÍCULOS ════════ */
  async function buscarArticulo(texto, idx) {
    updateLinea(idx, { codartic: texto, descartic: texto.length > 3 ? undefined : '' })
    if (texto.length < 2) { setArtSugg([]); setArtSugIdx(null); return }
    const { data } = await supabase
      .from('articomp')
      .select('codartic,descartic,marca,talla,preciovent,preciovend,porciva,existencia')
      .or(`codartic.ilike.%${texto}%,descartic.ilike.%${texto}%`)
      .limit(10)
    setArtSugg(data || [])
    setArtSugIdx(idx)
  }

  async function buscarDescripcion(texto, idx) {
    updateLinea(idx, { descartic: texto })
    if (texto.length < 2) { setArtSugg([]); setArtSugIdx(null); return }
    const { data } = await supabase
      .from('articomp')
      .select('codartic,descartic,marca,talla,preciovent,preciovend,porciva,existencia')
      .ilike('descartic', `%${texto}%`)
      .limit(10)
    setArtSugg(data || [])
    setArtSugIdx(idx)
  }

  function elegirArticulo(art, idx) {
    const precio =
      tipoVenta === 'Vendedor' ? (art.preciovend || art.preciovent) :
      tipoVenta === 'Detal'    ? art.preciovent :
                                 art.preciovent
    updateLinea(idx, {
      codartic: art.codartic,
      descartic: art.descartic,
      talla:     art.talla || '',
      valunit:   precio || 0,
      porciva:   art.porciva || 0,
    })
    setArtSugg([])
    setArtSugIdx(null)
  }

  /* ════════ LÍNEAS ════════ */
  function updateLinea(idx, cambios) {
    setLineas(prev => {
      const sig = [...prev]
      const lin = { ...sig[idx], ...cambios }
      // recalcular
      const sub  = (lin.cantidad || 0) * (lin.valunit || 0)
      const dcto = sub * ((lin.porcdescue || 0) / 100)
      const base = sub - dcto
      const iva  = base * ((lin.porciva || 0) / 100)
      lin.valdescue = dcto
      lin.valiva    = iva
      lin.valtotal  = base + iva
      sig[idx] = lin
      // agregar fila vacía al final si la última fue editada
      if (idx === sig.length - 1 && (cambios.codartic || cambios.descartic || cambios.cantidad > 0)) {
        sig.push({ ...LINEA_VACIA })
      }
      return sig
    })
  }

  function quitarLinea(idx) {
    setLineas(prev => prev.length > 1 ? prev.filter((_, i) => i !== idx) : prev)
  }

  /* ════════ TOTALES ════════ */
  const subtotal     = lineas.reduce((s, l) => s + (l.cantidad || 0) * (l.valunit || 0), 0)
  const totalDescto  = lineas.reduce((s, l) => s + (l.valdescue || 0), 0)
  const totalIva     = lineas.reduce((s, l) => s + (l.valiva    || 0), 0)
  const total        = lineas.reduce((s, l) => s + (l.valtotal  || 0), 0)
  const saldo        = total - totalAbonos
  const cantPrendas  = lineas.reduce((s, l) => s + (Number(l.cantidad) || 0), 0)

  /* ════════ NAVEGACIÓN ════════ */
  async function cargarDoc(id) {
    setCargando(true)
    setMensaje(null)
    const { data: enc } = await supabase
      .from('encnotaen').select('*').eq('numnotaent', id).maybeSingle()
    if (!enc) { setCargando(false); return }

    setNroDoc(enc.numnotaent)
    setFecha(enc.fechanotae     ? enc.fechanotae.slice(0,10)  : hoy())
    setFechaPago(enc.fechavence ? enc.fechavence.slice(0,10)  : hoy())
    setPlazoPago(enc.formapago  || 'CONTADO')
    setMedioPago(enc.mediopago  || 'Efectivo')
    setPorcDescto(enc.porcdescue || 0)
    setPorcIva(enc.porciva || 0)
    setCodCliente(enc.codclient || '99')
    setCedVendedor(enc.cedvended || '')
    if (enc.cedvended) cargarVendedor(enc.cedvended)

    // cliente
    const { data: cli } = await supabase
      .from('clientes').select('*').eq('codclient', enc.codclient).maybeSingle()
    setCliente(cli || null)
    setClienteInput(cli?.nombreclie || enc.nombreclie || '')

    // líneas
    const { data: det } = await supabase
      .from('detnotaen').select('*').eq('numnotaent', id)
    setLineas(det?.length ? [...det, { ...LINEA_VACIA }] : [{ ...LINEA_VACIA }])

    // abonos
    const { data: ab } = await supabase
      .from('detabonos').select('valabono').eq('numnotaent', id)
    const sumAb = (ab || []).reduce((s, r) => s + (r.valabono || 0), 0)
    setTotalAbonos(sumAb)

    setCargando(false)
  }

  function navPrimero() {
    if (!allIds.length) return
    setNavPos(0); cargarDoc(allIds[0])
  }
  function navAnterior() {
    const pos = navPos ?? allIds.length
    if (pos > 0) { setNavPos(pos - 1); cargarDoc(allIds[pos - 1]) }
  }
  function navSiguiente() {
    if (navPos !== null && navPos < allIds.length - 1) {
      setNavPos(navPos + 1); cargarDoc(allIds[navPos + 1])
    }
  }
  function navUltimo() {
    if (!allIds.length) return
    const last = allIds.length - 1
    setNavPos(last); cargarDoc(allIds[last])
  }

  /* ════════ NUEVO DOC ════════ */
  async function nuevoDoc() {
    await cargarIdsNavegacion()
    setFecha(hoy()); setFechaPago(hoy())
    setPlazoPago('CONTADO'); setMedioPago('Efectivo')
    setPorcDescto(0); setPorcIva(0); setTipoVenta('Mayor')
    setCodCliente('99'); setClienteInput('CLIENTE GENERAL')
    setCliente({ nombreclie: 'CLIENTE GENERAL', ciudad: 'MEDELLÍN' })
    setCedVendedor(''); setVendedor(null)
    setLineas([{ ...LINEA_VACIA }])
    setTotalAbonos(0)
    setMensaje(null)
    setNavPos(null)
  }

  /* ════════ GUARDAR ════════ */
  async function guardar() {
    const detValidas = lineas.filter(l => l.codartic && (l.cantidad || 0) > 0)
    if (!detValidas.length) {
      setMensaje({ tipo: 'err', texto: 'Debes agregar al menos un artículo con cantidad.' })
      return
    }
    setCargando(true)
    try {
      const cabecera = {
        numnotaent: nroDoc,
        fechanotae: fecha,
        fechavence: fechaPago,
        formapago:  plazoPago,
        mediopago:  medioPago,
        codclient:  codCliente,
        nombreclie: cliente?.nombreclie || clienteInput,
        cedrifclie: cliente?.cedrifclie || '',
        direcicion: cliente?.direcicion || '',
        celular:    cliente?.celular    || '',
        ciudad:     cliente?.ciudad     || '',
        departamen: cliente?.departamen || '',
        nomempresa: cliente?.nomempresa || '',
        porcdescue: porcDescto,
        porciva:    porcIva,
        subtotal,
        valdescue:  totalDescto,
        valiva:     totalIva,
        valtotal:   total,
        valabono:   totalAbonos,
        saldo,
        cedvended:  cedVendedor,
        cantotal:   cantPrendas,
        anulada:    'N',
      }

      const { error: errEnc } = await supabase
        .from('encnotaen')
        .upsert(cabecera, { onConflict: 'numnotaent' })
      if (errEnc) throw errEnc

      await supabase.from('detnotaen').delete().eq('numnotaent', nroDoc)
      const filas = detValidas.map(l => ({
        numnotaent: nroDoc,
        codartic:   l.codartic,
        descartic:  l.descartic,
        talla:      l.talla,
        cantidad:   l.cantidad,
        valunit:    l.valunit,
        subtotal:   (l.cantidad || 0) * (l.valunit || 0),
        porciva:    l.porciva,
        valiva:     l.valiva,
        porcdescue: l.porcdescue,
        valdescue:  l.valdescue,
        valtotal:   l.valtotal,
      }))
      const { error: errDet } = await supabase.from('detnotaen').insert(filas)
      if (errDet) throw errDet

      setMensaje({ tipo: 'ok', texto: `✅ Nota ${nroDoc} guardada correctamente.` })
      await cargarIdsNavegacion()
      const pos = allIds.indexOf(nroDoc)
      if (pos >= 0) setNavPos(pos)
    } catch (e) {
      setMensaje({ tipo: 'err', texto: `❌ Error: ${e.message}` })
    }
    setCargando(false)
  }

  /* ════════ ANULAR ════════ */
  async function anular() {
    if (!window.confirm(`¿Segura que quieres anular la nota ${nroDoc}? Esto NO se puede deshacer.`)) return
    setCargando(true)
    await supabase.from('detnotaen').delete().eq('numnotaent', nroDoc)
    await supabase.from('detabonos').delete().eq('numnotaent', nroDoc)
    await supabase.from('encnotaen').delete().eq('numnotaent', nroDoc)
    setMensaje({ tipo: 'ok', texto: `Nota ${nroDoc} anulada.` })
    setCargando(false)
    nuevoDoc()
  }

  /* ════════ IMPRIMIR ════════ */
  function imprimir() { setModal('print') }

  /* ════════ DATOS PARA MODALES ════════ */
  const dataNota = {
    nroDoc, fecha, fechaPago, plazoPago, medioPago,
    cliente, clienteInput, codCliente,
    vendedor, cedVendedor,
    lineas, subtotal, totalDescto, totalIva, total, saldo, cantPrendas,
    totalAbonos,
  }

  /* ════════ RENDER ════════ */
  return (
    <div style={S.pagina}>
      {/* Modales */}
      {modal === 'abonos'  && <ModalAbonos  supabase={supabase} nroDoc={nroDoc} totalNota={total} totalAbonos={totalAbonos} onClose={() => { setModal(null); cargarDoc(nroDoc) }} />}
      {modal === 'resumen' && <ModalResumen supabase={supabase} onClose={() => setModal(null)} />}
      {modal === 'detalle' && <ModalDetalle supabase={supabase} nroDoc={nroDoc} lineas={lineas} onClose={() => setModal(null)} />}
      {modal === 'print'   && <PrintNota   datos={dataNota} onClose={() => setModal(null)} />}

      <div style={S.ventana}>
        {/* ── BARRA TÍTULO ── */}
        <div style={S.barraT}>
          <button onClick={onClose} style={S.btnVolver} title="Volver al menú">←</button>
          <span style={S.barraIcon}>📋</span>
          <span style={S.barraTxt}>NOTA DE ENTREGA</span>
          {cargando && <span style={S.spinner}>⏳</span>}
        </div>

        {/* ── MENSAJE ── */}
        {mensaje && (
          <div style={{ ...S.alerta, background: mensaje.tipo === 'ok' ? '#d4edda' : '#f8d7da', color: mensaje.tipo === 'ok' ? '#155724' : '#721c24', borderColor: mensaje.tipo === 'ok' ? '#c3e6cb' : '#f5c6cb' }}>
            {mensaje.texto}
            <button onClick={() => setMensaje(null)} style={S.alertaX}>✕</button>
          </div>
        )}

        {/* ══ FILA 1: NRO DOC / CLIENTE / NOMBRE / EMPRESA ══ */}
        <div style={S.fila}>
          <Campo label="NRO. DOC" ancho={90}>
            <input style={{ ...S.inp, color: '#c0392b', fontWeight: 700 }} value={nroDoc} readOnly />
          </Campo>
          <Campo label="CLIENTE" ancho={110}>
            <input style={S.inp} value={codCliente}
              onChange={e => setCodCliente(e.target.value)}
              onBlur={() => cargarClientePorCod(codCliente)} />
          </Campo>
          <Campo label="NOMBRE / RAZÓN SOCIAL" ancho={320} rel>
            <input style={S.inp} value={clienteInput}
              onChange={e => buscarCliente(e.target.value)}
              placeholder="Escribe nombre o cédula…" />
            {clienteSugg.length > 0 && (
              <ul style={S.despleg}>
                {clienteSugg.map(c => (
                  <li key={c.codclient} style={S.despItem} onClick={() => elegirCliente(c)}>
                    <strong>{c.codclient}</strong> — {c.nombreclie}
                    {c.cedrifclie ? <span style={{ color: '#888', fontSize: 10 }}> · {c.cedrifclie}</span> : null}
                  </li>
                ))}
              </ul>
            )}
          </Campo>
          <Campo label="EMPRESA" ancho={180}>
            <input style={{ ...S.inp, background: '#f0f4ff' }} value={cliente?.nomempresa || ''} readOnly />
          </Campo>
        </div>

        {/* ══ FILA 2: DIRECCIÓN / CELULAR / CIUDAD / DEPTO ══ */}
        <div style={S.fila}>
          <Campo label="DIRECCIÓN" ancho={220}>
            <input style={{ ...S.inp, background: '#f0f4ff' }} value={cliente?.direcicion || ''} readOnly />
          </Campo>
          <Campo label="CELULAR" ancho={130}>
            <input style={{ ...S.inp, background: '#f0f4ff' }} value={cliente?.celular || ''} readOnly />
          </Campo>
          <Campo label="CIUDAD" ancho={150}>
            <input style={{ ...S.inp, background: '#f0f4ff' }} value={cliente?.ciudad || ''} readOnly />
          </Campo>
          <Campo label="DEPTO." ancho={130}>
            <input style={{ ...S.inp, background: '#f0f4ff' }} value={cliente?.departamen || ''} readOnly />
          </Campo>
        </div>

        {/* ══ FILA 3: FECHAS / DESCTO / IVA ══ */}
        <div style={S.fila}>
          <Campo label="FECHA" ancho={140}>
            <input type="date" style={S.inp} value={fecha} onChange={e => setFecha(e.target.value)} />
          </Campo>
          <Campo label="PLAZO PAGO" ancho={150}>
            <select style={S.inp} value={plazoPago} onChange={e => setPlazoPago(e.target.value)}>
              {PLAZOS.map(p => <option key={p}>{p}</option>)}
            </select>
          </Campo>
          <Campo label="FECHA PAGO" ancho={140}>
            <input type="date" style={S.inp} value={fechaPago} onChange={e => setFechaPago(e.target.value)} />
          </Campo>
          <Campo label="% DESCTO." ancho={90}>
            <input type="number" style={S.inp} value={porcDescto} min={0} max={100}
              onChange={e => setPorcDescto(Number(e.target.value))} />
          </Campo>
          <Campo label="% IVA" ancho={80}>
            <input type="number" style={S.inp} value={porcIva} min={0} max={100}
              onChange={e => setPorcIva(Number(e.target.value))} />
          </Campo>
        </div>

        {/* ══ FILA 4: TIPO VENTA / VENDEDOR ══ */}
        <div style={{ ...S.fila, alignItems: 'center', paddingBottom: 4 }}>
          {TIPO_VTA.map(t => (
            <label key={t} style={S.radio}>
              <input type="radio" name="tipoVenta" checked={tipoVenta === t} onChange={() => setTipoVenta(t)} />
              {' '}{t}
            </label>
          ))}
          <span style={{ ...S.etq, marginLeft: 16 }}>CED. VENDEDOR</span>
          <input style={{ ...S.inp, width: 130, marginLeft: 4 }} value={cedVendedor}
            onChange={e => setCedVendedor(e.target.value)}
            onBlur={() => cargarVendedor(cedVendedor)} />
          <span style={{ ...S.etq, marginLeft: 10 }}>NOMBRE</span>
          <input style={{ ...S.inp, width: 170, marginLeft: 4, background: '#f0f4ff' }}
            value={vendedor?.nomvended || ''} readOnly />
          <span style={{ ...S.etq, marginLeft: 10 }}>#CEL.</span>
          <input style={{ ...S.inp, width: 120, marginLeft: 4, background: '#f0f4ff' }}
            value={vendedor?.celular || ''} readOnly />
        </div>

        {/* ══ TABLA DE LÍNEAS ══ */}
        <div style={S.tablaWrap}>
          <table style={S.tabla}>
            <thead>
              <tr style={S.thead}>
                {['COD. ARTIC','DESCRIPCIÓN','TALLA','CANTIDAD','$ UNIDAD','% IVA','$ IVA','% DCTO.','$ DCTO.','$ TOTAL',''].map(h => (
                  <th key={h} style={S.th}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {lineas.map((l, i) => (
                <tr key={i} style={i % 2 === 0 ? S.trPar : S.trImpar}>
                  {/* COD */}
                  <td style={S.td}>
                    <div style={{ position: 'relative' }}>
                      <input style={{ ...S.celdaInp, width: 80 }} value={l.codartic}
                        onChange={e => buscarArticulo(e.target.value, i)} />
                      {artSugIdx === i && artSugg.length > 0 && (
                        <ul style={{ ...S.despleg, width: 380, zIndex: 99 }}>
                          {artSugg.map((a, ai) => (
                            <li key={ai} style={S.despItem} onClick={() => elegirArticulo(a, i)}>
                              <strong>{a.codartic}</strong> · {a.descartic}
                              <span style={{ color: '#888', fontSize: 10 }}> T:{a.talla} ${fmt(a.preciovent)}</span>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  </td>
                  {/* DESC */}
                  <td style={{ ...S.td, minWidth: 160 }}>
                    <div style={{ position: 'relative' }}>
                      <input style={{ ...S.celdaInp, width: '100%' }} value={l.descartic}
                        onChange={e => buscarDescripcion(e.target.value, i)} />
                    </div>
                  </td>
                  {/* TALLA */}
                  <td style={S.td}>
                    <input style={{ ...S.celdaInp, width: 48, textAlign: 'center' }}
                      value={l.talla} onChange={e => updateLinea(i, { talla: e.target.value })} />
                  </td>
                  {/* CANTIDAD */}
                  <td style={S.td}>
                    <input type="number" style={{ ...S.celdaInp, width: 56, textAlign: 'right' }}
                      value={l.cantidad} min={0}
                      onChange={e => updateLinea(i, { cantidad: Number(e.target.value) })} />
                  </td>
                  {/* VALOR UNIT */}
                  <td style={S.td}>
                    <input type="number" style={{ ...S.celdaInp, width: 88, textAlign: 'right' }}
                      value={l.valunit} min={0}
                      onChange={e => updateLinea(i, { valunit: Number(e.target.value) })} />
                  </td>
                  {/* % IVA */}
                  <td style={S.td}>
                    <input type="number" style={{ ...S.celdaInp, width: 46, textAlign: 'right' }}
                      value={l.porciva} min={0}
                      onChange={e => updateLinea(i, { porciva: Number(e.target.value) })} />
                  </td>
                  {/* $ IVA */}
                  <td style={{ ...S.td, textAlign: 'right', paddingRight: 6, color: '#555', fontSize: 11 }}>
                    {fmt(l.valiva)}
                  </td>
                  {/* % DCTO */}
                  <td style={S.td}>
                    <input type="number" style={{ ...S.celdaInp, width: 46, textAlign: 'right' }}
                      value={l.porcdescue} min={0} max={100}
                      onChange={e => updateLinea(i, { porcdescue: Number(e.target.value) })} />
                  </td>
                  {/* $ DCTO */}
                  <td style={{ ...S.td, textAlign: 'right', paddingRight: 6, color: '#555', fontSize: 11 }}>
                    {fmt(l.valdescue)}
                  </td>
                  {/* $ TOTAL */}
                  <td style={{ ...S.td, textAlign: 'right', paddingRight: 6, fontWeight: 700, fontSize: 11 }}>
                    {fmt(l.valtotal)}
                  </td>
                  {/* BORRAR */}
                  <td style={{ ...S.td, textAlign: 'center' }}>
                    {i < lineas.length - 1 && (
                      <button onClick={() => quitarLinea(i)} style={S.btnBorrarLinea} title="Quitar">✕</button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* ══ FOOTER ══ */}
        <div style={S.footer}>

          {/* IZQUIERDA: navegación + acciones CRUD */}
          <div style={S.footIzq}>
            <div style={S.navFila}>
              <BtnNav onClick={navPrimero}  title="Primero">⏮</BtnNav>
              <BtnNav onClick={navAnterior} title="Anterior">◀</BtnNav>
              <BtnNav onClick={navSiguiente}title="Siguiente">▶</BtnNav>
              <BtnNav onClick={navUltimo}   title="Último">⏭</BtnNav>
              <BtnNav onClick={imprimir}    title="Imprimir">🖨</BtnNav>
            </div>
            <div style={S.navFila}>
              <BtnNav onClick={nuevoDoc} title="Nueva nota" color="#27ae60">+</BtnNav>
              <BtnNav onClick={guardar}  title="Guardar"    color="#2980b9" disabled={cargando}>
                {cargando ? '⏳' : '💾'}
              </BtnNav>
              <BtnNav onClick={anular}   title="Anular"     color="#e74c3c">🗑</BtnNav>
            </div>
          </div>

          {/* CENTRO: prendas + totales */}
          <div style={S.footCentro}>
            <div style={S.filaPrendas}>
              <span style={S.lblPrendas}>CANTIDAD DE PRENDAS</span>
              <span style={S.valPrendas}>{cantPrendas}</span>
            </div>
            <div style={S.gridTotales}>
              <span style={S.lblTot}>$SUB TOTAL</span>
              <span style={S.lblTot}>$ DESCUENTO</span>
              <span style={S.lblTot}>$ IVA</span>
              <span style={S.valTot}>{fmt(subtotal)}</span>
              <span style={S.valTot}>{fmt(totalDescto)}</span>
              <span style={S.valTot}>{fmt(totalIva)}</span>
              <span style={{ ...S.lblTot, fontWeight: 800, color: '#1a3a6b' }}>$ TOTAL</span>
              <span style={S.lblTot}>$ ABONO</span>
              <span style={S.lblTot}>$ SALDO</span>
              <span style={{ ...S.valTot, fontWeight: 800, color: '#1a3a6b', fontSize: 13 }}>{fmt(total)}</span>
              <span style={S.valTot}>{fmt(totalAbonos)}</span>
              <span style={{ ...S.valTot, color: saldo > 0 ? '#c0392b' : '#27ae60', fontWeight: 700 }}>{fmt(saldo)}</span>
            </div>
          </div>

          {/* DERECHA: medio pago + botones de acción */}
          <div style={S.footDer}>
            <div style={S.colMedio}>
              {MEDIOS.map(m => (
                <label key={m} style={S.radio}>
                  <input type="radio" name="medio" checked={medioPago === m} onChange={() => setMedioPago(m)} />
                  {' '}{m}
                </label>
              ))}
            </div>
            <div style={S.colAccion}>
              <BtnAccion onClick={() => setModal('abonos')}  icon="💵">ABONOS</BtnAccion>
              <BtnAccion onClick={() => setModal('resumen')} icon="📊">RESUMEN</BtnAccion>
              <BtnAccion onClick={anular}                    icon="↩️" danger>REVERTIR ABONOS</BtnAccion>
              <BtnAccion onClick={() => setModal('detalle')} icon="🔍">DETALLE</BtnAccion>
              <BtnAccion onClick={nuevoDoc}                  icon="👤">NUEVA NOTA</BtnAccion>
              <BtnAccion onClick={() => { setFecha(hoy()); setFechaPago(hoy()) }} icon="📅">FECHA HOY</BtnAccion>
            </div>
          </div>

        </div>{/* fin footer */}
      </div>{/* fin ventana */}
    </div>
  )
}

/* ─── Subcomponentes locales ─── */
function Campo({ label, ancho, children, rel }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', width: ancho, marginRight: 6, position: rel ? 'relative' : undefined }}>
      <span style={S.etq}>{label}</span>
      {children}
    </div>
  )
}

function BtnNav({ onClick, title, children, color, disabled }) {
  return (
    <button onClick={onClick} title={title} disabled={disabled} style={{
      ...S.btnNav,
      background: color || '#dde3ee',
      color: color ? '#fff' : '#1a3a6b',
      opacity: disabled ? 0.5 : 1,
    }}>
      {children}
    </button>
  )
}

function BtnAccion({ onClick, icon, children, danger }) {
  return (
    <button onClick={onClick} style={{
      ...S.btnAccion,
      background: danger ? '#e74c3c' : '#eef2ff',
      color: danger ? '#fff' : '#1a3a6b',
      border: `1px solid ${danger ? '#c0392b' : '#b0bdd8'}`,
    }}>
      {icon && <span style={{ marginRight: 4 }}>{icon}</span>}
      {children}
    </button>
  )
}

/* ─── estilos ─── */
const S = {
  pagina:   { minHeight: '100vh', padding: 12, background: '#d6dce8' },
  ventana:  { background: '#eef1f7', border: '2px solid #8fa4c8', borderRadius: 6, padding: 10, boxShadow: '0 4px 20px rgba(0,0,0,0.2)', maxWidth: 1100, margin: '0 auto' },
  barraT:   { background: 'linear-gradient(90deg,#1a3a6b,#2c5fa8)', color: '#fff', padding: '5px 12px', borderRadius: 4, marginBottom: 8, display: 'flex', alignItems: 'center', gap: 8 },
  btnVolver:{ background: 'rgba(255,255,255,0.2)', border: 'none', color: '#fff', borderRadius: 4, padding: '2px 8px', cursor: 'pointer', fontWeight: 700, fontSize: 14 },
  barraIcon:{ fontSize: 15 },
  barraTxt: { fontWeight: 800, fontSize: 13, letterSpacing: 1 },
  spinner:  { marginLeft: 'auto', fontSize: 14 },
  alerta:   { padding: '6px 12px', borderRadius: 4, marginBottom: 6, fontSize: 12, border: '1px solid', display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
  alertaX:  { background: 'none', border: 'none', cursor: 'pointer', fontWeight: 700, fontSize: 14 },
  fila:     { display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 5, alignItems: 'flex-end' },
  etq:      { fontSize: 10, fontWeight: 700, color: '#1a3a6b', marginBottom: 2, textTransform: 'uppercase', letterSpacing: 0.5 },
  inp:      { height: 23, border: '1px solid #aab8d4', borderRadius: 2, padding: '0 5px', fontSize: 12, background: '#fff', outline: 'none', width: '100%' },
  radio:    { display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, cursor: 'pointer', marginRight: 8 },
  despleg:  { position: 'absolute', top: '100%', left: 0, background: '#fff', border: '1px solid #aab8d4', borderRadius: 4, listStyle: 'none', margin: 0, padding: 0, zIndex: 50, boxShadow: '0 6px 16px rgba(0,0,0,0.15)', maxHeight: 220, overflowY: 'auto', minWidth: 260 },
  despItem: { padding: '5px 10px', cursor: 'pointer', borderBottom: '1px solid #eee', fontSize: 12, transition: 'background 0.1s' },
  tablaWrap:{ overflowX: 'auto', border: '1px solid #aab8d4', borderRadius: 3, marginBottom: 8, maxHeight: 260, overflowY: 'auto' },
  tabla:    { width: '100%', borderCollapse: 'collapse', fontSize: 11 },
  thead:    { background: '#dde3ee', position: 'sticky', top: 0, zIndex: 2 },
  th:       { padding: '4px 6px', textAlign: 'center', fontWeight: 700, color: '#1a3a6b', borderRight: '1px solid #aab8d4', whiteSpace: 'nowrap', fontSize: 11 },
  td:       { padding: '2px 3px', borderRight: '1px solid #d0d8ea', borderBottom: '1px solid #d0d8ea', verticalAlign: 'middle' },
  trPar:    { background: '#fff' },
  trImpar:  { background: '#f5f7fc' },
  celdaInp: { border: '1px solid transparent', background: 'transparent', fontSize: 11, padding: '1px 3px', outline: 'none' },
  btnBorrarLinea: { background: 'none', border: 'none', color: '#c0392b', cursor: 'pointer', fontSize: 12, padding: '0 4px' },
  footer:   { display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'flex-start' },
  footIzq:  { display: 'flex', flexDirection: 'column', gap: 4 },
  navFila:  { display: 'flex', gap: 3 },
  btnNav:   { width: 38, height: 38, border: '1px solid #8fa4c8', borderRadius: 4, cursor: 'pointer', fontWeight: 700, fontSize: 14, display: 'flex', alignItems: 'center', justifyContent: 'center' },
  footCentro: { flex: 1, minWidth: 280 },
  filaPrendas: { display: 'flex', justifyContent: 'space-between', background: '#fff3cd', border: '1px solid #ffc107', borderRadius: 3, padding: '3px 10px', marginBottom: 5, fontWeight: 700, color: '#856404', fontSize: 12 },
  lblPrendas: {},
  valPrendas: { fontSize: 18, fontWeight: 900 },
  gridTotales: { display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '2px 8px', background: '#fff', border: '1px solid #aab8d4', borderRadius: 3, padding: '5px 10px' },
  lblTot: { fontSize: 11, color: '#1a3a6b', fontWeight: 600, textAlign: 'center' },
  valTot: { fontSize: 12, textAlign: 'right', fontVariantNumeric: 'tabular-nums' },
  footDer:  { display: 'flex', gap: 8, alignItems: 'flex-start' },
  colMedio: { display: 'flex', flexDirection: 'column', gap: 4, background: '#fff', border: '1px solid #aab8d4', borderRadius: 3, padding: '6px 10px' },
  colAccion: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 3 },
  btnAccion: { padding: '5px 9px', borderRadius: 3, cursor: 'pointer', fontSize: 11, fontWeight: 600, display: 'flex', alignItems: 'center', whiteSpace: 'nowrap' },
}
