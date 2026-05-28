import { useState, useEffect, useRef } from 'react'
import { LOGO, WZNEW, WZSAVE, WZDELETE, WZPRINT, WZCLOSE, WZTOP, WZBACK, WZNEXT, WZEND, WZLOCATE } from '../lib/assets'
import ModalAbonos  from './ModalAbonos'
import ModalResumen from './ModalResumen'
import ModalDetalle from './ModalDetalle'
import PrintNota    from './PrintNota'

const fmt = n => Number(n||0).toLocaleString('es-CO',{minimumFractionDigits:2,maximumFractionDigits:2})
const hoy = () => new Date().toISOString().slice(0,10)
const VACIA = {codartic:'',descartic:'',talla:'',cantidad:'',valunit:0,porciva:0,valiva:0,porcdescue:0,valdescue:0,valtotal:0}
const FILAS_BASE = 12
const FILAS = () => Array.from({length:FILAS_BASE},()=>({...VACIA}))
const PLAZOS = ['CONTADO','15 DÍAS','30 DÍAS','60 DÍAS','90 DÍAS']
const MEDIOS = ['Efectivo','Transferencia','Mixto','Crédito']

export default function NotaDeEntrega({ supabase, onClose }) {
  // ── cabecera ──
  const [nroDoc,    setNroDoc]    = useState('')
  const [fecha,     setFecha]     = useState(hoy())
  const [fechaPago, setFechaPago] = useState(hoy())
  const [plazo,     setPlazo]     = useState('CONTADO')
  const [pDesc,     setPDesc]     = useState(0)
  const [pIva,      setPIva]      = useState(0)
  const [tipoVta,   setTipoVta]   = useState('Mayor')
  const [medio,     setMedio]     = useState('Efectivo')
  // ── cliente ──
  const [cedula,    setCedula]    = useState('')
  const [cliTxt,    setCliTxt]    = useState('')
  const [cliente,   setCliente]   = useState(null)
  const [cliSugg,   setCliSugg]   = useState([])
  const [cedulaRO,  setCedulaRO]  = useState(false) // cédula readonly cuando cliente existe
  // ── vendedor ──
  const [cedVend,   setCedVend]   = useState('')
  const [vendedor,  setVendedor]  = useState(null)
  // ── líneas ──
  const [lineas,    setLineas]    = useState(FILAS())
  const [artSugg,   setArtSugg]   = useState([])
  const [artIdx,    setArtIdx]    = useState(null)
  // ── financiero ──
  const [abonos,    setAbonos]    = useState(0)
  // ── navegación ──
  const [allIds,    setAllIds]    = useState([])
  const [navPos,    setNavPos]    = useState(null)
  // ── UI ──
  const [busy,      setBusy]      = useState(false)
  const [msg,       setMsg]       = useState(null)
  const [modal,     setModal]     = useState(null)
  const [esNueva,   setEsNueva]   = useState(true) // true = doc nuevo sin guardar aún

  const cedulaRef = useRef()

  useEffect(() => { init() }, [])

  // ════════ INICIALIZAR ════════
  async function init() {
    const {data} = await supabase.from('encnotaen')
      .select('numnotaent').order('numnotaent',{ascending:true})
    const ids = (data||[]).map(r=>r.numnotaent)
    setAllIds(ids)
    await asignarNuevoConsecutivo()
  }

  // ════════ CONSECUTIVO SEGURO ════════
  // Llama a la función de Supabase que usa nextval() — seguro con múltiples usuarios
  async function asignarNuevoConsecutivo() {
    const {data, error} = await supabase.rpc('siguiente_nota')
    if (!error && data) {
      setNroDoc(String(data))
      return String(data)
    }
    // fallback si la función aún no existe: usa max + 1
    const {data:d2} = await supabase.from('encnotaen')
      .select('numnotaent').order('numnotaent',{ascending:false}).limit(1)
    const siguiente = d2?.length ? Number(d2[0].numnotaent)+1 : 1
    setNroDoc(String(siguiente))
    return String(siguiente)
  }

  // ════════ CLIENTE ════════
  async function buscarPorCedula(ced) {
    if (!ced || ced.length < 3) return
    const {data} = await supabase.from('clientes').select('*')
      .or(`cedrifclie.eq.${ced},codclient.eq.${ced}`)
      .maybeSingle()
    if (data) {
      aplicarCliente(data)
    } else {
      setMsg({tipo:'warn',texto:`Cédula ${ced} no encontrada. Puedes escribir el nombre manualmente.`})
      setCliTxt('')
      setCliente(null)
      setCedulaRO(false)
    }
  }

  function aplicarCliente(c) {
    setCliente(c)
    setCedula(c.cedrifclie||c.codclient)
    setCliTxt(c.nombreclie)
    setCliSugg([])
    setCedulaRO(true) // cédula ya no se puede cambiar
    setMsg(null)
  }

  async function buscarPorNombre(txt) {
    setCliTxt(txt)
    if (txt.length < 2) { setCliSugg([]); return }
    const {data} = await supabase.from('clientes')
      .select('codclient,nombreclie,cedrifclie,celular,ciudad,departamen,direcicion,nomempresa')
      .ilike('nombreclie',`%${txt}%`).limit(8)
    setCliSugg(data||[])
  }

  function limpiarCliente() {
    setCedula(''); setCliTxt(''); setCliente(null)
    setCliSugg([]); setCedulaRO(false)
    setTimeout(()=>cedulaRef.current?.focus(), 50)
  }

  // ════════ VENDEDOR ════════
  async function cargarVendedor(ced) {
    if (!ced) return
    const {data} = await supabase.from('vendedor').select('*').eq('cedvended',ced).maybeSingle()
    setVendedor(data||null)
  }

  // ════════ ARTÍCULOS ════════
  function precioSegunTipo(art) {
    if (tipoVta === 'Detal')    return art.preciovend  || 0
    if (tipoVta === 'Vendedor') return art.preciovenv  || 0
    return art.preciovent || 0  // Mayor (default)
  }

  async function buscarArt(txt, idx) {
    setLineas(prev => { const n=[...prev]; n[idx]={...n[idx],codartic:txt}; return n })
    if (txt.length < 2) { setArtSugg([]); setArtIdx(null); return }
    const {data} = await supabase.from('articomp')
      .select('codartic,descartic,talla,preciovent,preciovend,preciovenv,porciva,existencia')
      .or(`codartic.ilike.%${txt}%,descartic.ilike.%${txt}%`).limit(10)
    setArtSugg(data||[]); setArtIdx(idx)
  }

  async function buscarDesc(txt, idx) {
    setLineas(prev => { const n=[...prev]; n[idx]={...n[idx],descartic:txt}; return n })
    if (txt.length < 2) { setArtSugg([]); setArtIdx(null); return }
    const {data} = await supabase.from('articomp')
      .select('codartic,descartic,talla,preciovent,preciovend,preciovenv,porciva,existencia')
      .ilike('descartic',`%${txt}%`).limit(10)
    setArtSugg(data||[]); setArtIdx(idx)
  }

  function elegirArt(art, idx) {
    upd(idx,{
      codartic:  art.codartic,
      descartic: art.descartic,
      talla:     art.talla||'',
      valunit:   precioSegunTipo(art),
      porciva:   art.porciva||0,
    })
    setArtSugg([]); setArtIdx(null)
  }

  // cuando cambia tipoVta, actualizar precios de líneas que ya tienen artículo
  useEffect(() => {
    // solo actualiza si hay líneas con artículo
    setLineas(prev => prev.map(l => {
      if (!l.codartic || !l._preciovent) return l
      const nuevo = tipoVta==='Detal' ? l._preciovend : tipoVta==='Vendedor' ? l._preciovenv : l._preciovent
      return recalc({...l, valunit: nuevo||l.valunit})
    }))
  }, [tipoVta])

  // ════════ LÍNEAS ════════
  function recalc(lin) {
    const cant  = Number(lin.cantidad)||0
    const sub   = cant * (Number(lin.valunit)||0)
    const dcto  = sub * ((Number(lin.porcdescue)||0)/100)
    const base  = sub - dcto
    const iva   = base * ((Number(lin.porciva)||0)/100)
    return {...lin, valdescue:dcto, valiva:iva, valtotal:base+iva}
  }

  function upd(idx, cambios) {
    setLineas(prev => {
      const sig = [...prev]
      const lin = recalc({...sig[idx], ...cambios})
      sig[idx] = lin
      // agregar fila nueva si se llenó la última
      if (idx === sig.length-1 && (cambios.codartic||cambios.descartic)) {
        sig.push({...VACIA})
      }
      return sig
    })
  }

  function quitarLinea(idx) {
    setLineas(prev => {
      const nuevo = prev.filter((_,i)=>i!==idx)
      // garantizar mínimo FILAS_BASE filas
      while (nuevo.length < FILAS_BASE) nuevo.push({...VACIA})
      return nuevo
    })
  }

  // ════════ TOTALES ════════
  const detValidas = lineas.filter(l=>l.codartic&&Number(l.cantidad)>0)
  const subtotal   = lineas.reduce((s,l)=>s+(Number(l.cantidad)||0)*(Number(l.valunit)||0),0)
  const totDcto    = lineas.reduce((s,l)=>s+(l.valdescue||0),0)
  const totIva     = lineas.reduce((s,l)=>s+(l.valiva||0),0)
  const total      = lineas.reduce((s,l)=>s+(l.valtotal||0),0)
  const saldo      = total - abonos
  const prendas    = lineas.reduce((s,l)=>s+(Number(l.cantidad)||0),0)

  // ════════ NAVEGACIÓN ════════
  async function cargarDoc(id) {
    setBusy(true); setMsg(null)
    const {data:enc} = await supabase.from('encnotaen').select('*').eq('numnotaent',id).maybeSingle()
    if (!enc) { setBusy(false); return }

    setNroDoc(enc.numnotaent); setEsNueva(false)
    setFecha(enc.fechanotae?.slice(0,10)||hoy())
    setFechaPago(enc.fechavence?.slice(0,10)||hoy())
    setPlazo(enc.formapago||'CONTADO'); setMedio(enc.mediopago||'Efectivo')
    setPDesc(enc.porcdescue||0); setPIva(enc.porciva||0)
    setCedula(enc.cedrifclie||enc.codclient||'')
    setCedVend(enc.cedvended||'')
    if (enc.cedvended) cargarVendedor(enc.cedvended)

    const {data:cli} = await supabase.from('clientes').select('*').eq('codclient',enc.codclient).maybeSingle()
    setCliente(cli||null)
    setCliTxt(cli?.nombreclie||enc.nombreclie||'')
    setCedulaRO(true)

    const {data:det} = await supabase.from('detnotaen').select('*').eq('numnotaent',id)
    const extras = Math.max(0, FILAS_BASE-(det?.length||0))
    setLineas(det?.length ? [...det,...Array.from({length:extras},()=>({...VACIA}))] : FILAS())

    const {data:ab} = await supabase.from('detabonos').select('valabono').eq('numnotaent',id)
    setAbonos((ab||[]).reduce((s,r)=>s+(r.valabono||0),0))
    setBusy(false)
  }

  async function recargarIds() {
    const {data} = await supabase.from('encnotaen')
      .select('numnotaent').order('numnotaent',{ascending:true})
    const ids=(data||[]).map(r=>r.numnotaent); setAllIds(ids); return ids
  }

  function navPrimero()    { if(allIds.length){setNavPos(0);cargarDoc(allIds[0])} }
  function navAnterior()   { const p=navPos??allIds.length; if(p>0){setNavPos(p-1);cargarDoc(allIds[p-1])} }
  function navSiguiente()  { if(navPos!==null&&navPos<allIds.length-1){setNavPos(navPos+1);cargarDoc(allIds[navPos+1])} }
  function navUltimo()     { if(allIds.length){const l=allIds.length-1;setNavPos(l);cargarDoc(allIds[l])} }

  // ════════ NUEVA NOTA ════════
  async function nuevaNota() {
    await asignarNuevoConsecutivo()
    setFecha(hoy()); setFechaPago(hoy())
    setPlazo('CONTADO'); setMedio('Efectivo')
    setPDesc(0); setPIva(0); setTipoVta('Mayor')
    setCedula(''); setCliTxt(''); setCliente(null); setCedulaRO(false)
    setCedVend(''); setVendedor(null)
    setLineas(FILAS()); setAbonos(0)
    setMsg(null); setNavPos(null); setEsNueva(true)
    setTimeout(()=>cedulaRef.current?.focus(), 100)
  }

  // ════════ GUARDAR ════════
  async function guardar() {
    if (!cliente && !cliTxt) {
      setMsg({tipo:'err',texto:'Debes ingresar un cliente antes de guardar.'}); return
    }
    if (!detValidas.length) {
      setMsg({tipo:'err',texto:'Agrega al menos un artículo con cantidad.'}); return
    }
    setBusy(true)
    try {
      const enc = {
        numnotaent: nroDoc,
        fechanotae: fecha,
        fechavence: fechaPago,
        formapago:  plazo,
        mediopago:  medio,
        codclient:  cliente?.codclient || '99',
        nombreclie: cliente?.nombreclie || cliTxt,
        cedrifclie: cedula || cliente?.cedrifclie || '',
        direcicion: cliente?.direcicion || '',
        celular:    cliente?.celular    || '',
        ciudad:     cliente?.ciudad     || '',
        departamen: cliente?.departamen || '',
        nomempresa: cliente?.nomempresa || '',
        porcdescue: pDesc,
        porciva:    pIva,
        subtotal,
        valdescue:  totDcto,
        valiva:     totIva,
        valtotal:   total,
        valabono:   abonos,
        saldo,
        cedvended:  cedVend,
        cantotal:   prendas,
        anulada:    'N',
      }
      const {error:e1} = await supabase.from('encnotaen').upsert(enc,{onConflict:'numnotaent'})
      if (e1) throw e1

      await supabase.from('detnotaen').delete().eq('numnotaent',nroDoc)
      const filas = detValidas.map(l=>({
        numnotaent: nroDoc,
        codartic:   l.codartic,
        descartic:  l.descartic,
        talla:      l.talla,
        cantidad:   Number(l.cantidad),
        valunit:    Number(l.valunit),
        subtotal:   Number(l.cantidad)*Number(l.valunit),
        porciva:    l.porciva,
        valiva:     l.valiva,
        porcdescue: l.porcdescue,
        valdescue:  l.valdescue,
        valtotal:   l.valtotal,
      }))
      const {error:e2} = await supabase.from('detnotaen').insert(filas)
      if (e2) throw e2

      setMsg({tipo:'ok',texto:`✅ Nota ${nroDoc} guardada correctamente.`})
      setEsNueva(false)
      const ids = await recargarIds()
      setNavPos(ids.indexOf(nroDoc))
    } catch(e) {
      setMsg({tipo:'err',texto:`❌ Error: ${e.message}`})
    }
    setBusy(false)
  }

  // ════════ ANULAR (marca como anulada, NO borra) ════════
  async function anular() {
    if (esNueva) {
      setMsg({tipo:'warn',texto:'Esta nota aún no está guardada, no hay nada que anular.'}); return
    }
    const motivo = window.prompt(`¿Motivo de anulación de la nota ${nroDoc}? (Opcional)`)
    if (motivo === null) return // canceló
    setBusy(true)
    const {error} = await supabase.from('encnotaen').update({
      anulada:     'S',
      fechaanula:  hoy(),
      motivoanula: motivo || 'Anulada por el usuario',
    }).eq('numnotaent', nroDoc)

    if (error) {
      setMsg({tipo:'err',texto:`❌ Error al anular: ${error.message}`})
    } else {
      setMsg({tipo:'ok',texto:`Nota ${nroDoc} marcada como ANULADA. El consecutivo queda en el historial.`})
      await recargarIds()
      await nuevaNota()
    }
    setBusy(false)
  }

  const dataNota = {nroDoc,fecha,fechaPago,plazo,medio,cliente,cliTxt,cedula,vendedor,cedVend,lineas:detValidas,subtotal,totDcto,totIva,total,saldo,prendas,abonos}

  // ════════ RENDER ════════
  return (
    <div style={P.pagina}>
      {modal==='abonos'  && <ModalAbonos  supabase={supabase} nroDoc={nroDoc} totalNota={total} totalAbonos={abonos} onClose={()=>{setModal(null);cargarDoc(nroDoc)}}/>}
      {modal==='resumen' && <ModalResumen supabase={supabase} onClose={()=>setModal(null)}/>}
      {modal==='detalle' && <ModalDetalle nroDoc={nroDoc} lineas={detValidas} onClose={()=>setModal(null)}/>}
      {modal==='print'   && <PrintNota   datos={dataNota} onClose={()=>setModal(null)}/>}

      <div style={P.ventana}>

        {/* ── TÍTULO ── */}
        <div style={P.titulo}>
          <img src={LOGO} alt="ATM" style={{height:36,filter:'brightness(0) invert(1)',marginRight:12}}/>
          <span style={P.titTxt}>NOTA DE ENTREGA</span>
          <div style={P.titNro}>
            N° <strong style={{fontSize:18}}>{nroDoc}</strong>
            {esNueva && <span style={{fontSize:10,marginLeft:6,opacity:0.7}}>NUEVA</span>}
          </div>
        </div>

        {/* ── MENSAJE ── */}
        {msg && (
          <div style={{
            ...P.alerta,
            background: msg.tipo==='ok'?'#e8f5e9': msg.tipo==='warn'?'#fff8e1':'#ffebee',
            color:      msg.tipo==='ok'?'#2e7d32': msg.tipo==='warn'?'#f57f17':'#c62828',
            border:     `1px solid ${msg.tipo==='ok'?'#a5d6a7':msg.tipo==='warn'?'#ffe082':'#ef9a9a'}`,
          }}>
            {msg.texto}
            <button onClick={()=>setMsg(null)} style={P.alertaX}>✕</button>
          </div>
        )}

        {/* ── DATOS ── */}
        <div style={P.bloque}>

          {/* FILA 1: cédula, nombre, empresa */}
          <div style={P.fila}>
            <Fld label="Cédula / NIT" w={120}>
              <div style={{display:'flex',gap:4}}>
                <input
                  ref={cedulaRef}
                  style={{...P.inp, background: cedulaRO?'#f0f4ff':'#fff', flex:1}}
                  value={cedula}
                  readOnly={cedulaRO}
                  onChange={e=>setCedula(e.target.value)}
                  onBlur={e=>buscarPorCedula(e.target.value)}
                  onKeyDown={e=>e.key==='Enter'&&buscarPorCedula(cedula)}
                  placeholder="Cédula o NIT…"
                />
                {cedulaRO && (
                  <button onClick={limpiarCliente} title="Cambiar cliente"
                    style={{...P.inp,width:28,padding:0,textAlign:'center',cursor:'pointer',flexShrink:0,background:'#fff3cd'}}>
                    ✎
                  </button>
                )}
              </div>
            </Fld>
            <Fld label="Nombre / Razón Social" w={320} rel>
              <input style={{...P.inp,background:cedulaRO?'#fff':'#fff'}} value={cliTxt}
                onChange={e=>buscarPorNombre(e.target.value)}
                placeholder="O busca por nombre aquí…"/>
              {cliSugg.length>0 && (
                <ul style={P.drop}>
                  {cliSugg.map(c=>(
                    <li key={c.codclient} style={P.dropItem} onClick={()=>aplicarCliente(c)}>
                      <strong>{c.cedrifclie||c.codclient}</strong> — {c.nombreclie}
                    </li>
                  ))}
                </ul>
              )}
            </Fld>
            <Fld label="Empresa" w={200}>
              <input style={{...P.inp,...P.ro}} value={cliente?.nomempresa||''} readOnly/>
            </Fld>
          </div>

          {/* FILA 2: dirección, celular, ciudad, depto */}
          <div style={P.fila}>
            <Fld label="Dirección" w={230}><input style={{...P.inp,...P.ro}} value={cliente?.direcicion||''} readOnly/></Fld>
            <Fld label="Celular"   w={130}><input style={{...P.inp,...P.ro}} value={cliente?.celular||''} readOnly/></Fld>
            <Fld label="Ciudad"    w={150}><input style={{...P.inp,...P.ro}} value={cliente?.ciudad||''} readOnly/></Fld>
            <Fld label="Depto."    w={120}><input style={{...P.inp,...P.ro}} value={cliente?.departamen||''} readOnly/></Fld>
          </div>

          {/* FILA 3: fechas, descuento, iva */}
          <div style={P.fila}>
            <Fld label="Fecha" w={140}>
              <input type="date" style={P.inp} value={fecha} onChange={e=>setFecha(e.target.value)}/>
            </Fld>
            <Fld label="Plazo de Pago" w={150}>
              <select style={P.inp} value={plazo} onChange={e=>setPlazo(e.target.value)}>
                {PLAZOS.map(p=><option key={p}>{p}</option>)}
              </select>
            </Fld>
            <Fld label="Fecha de Pago" w={140}>
              <input type="date" style={P.inp} value={fechaPago} onChange={e=>setFechaPago(e.target.value)}/>
            </Fld>
            <Fld label="% Descuento" w={100}>
              <input type="number" style={P.inp} value={pDesc} min={0} max={100} onChange={e=>setPDesc(Number(e.target.value))}/>
            </Fld>
            <Fld label="% IVA" w={80}>
              <input type="number" style={P.inp} value={pIva} min={0} max={100} onChange={e=>setPIva(Number(e.target.value))}/>
            </Fld>
          </div>

          {/* FILA 4: tipo venta + vendedor */}
          <div style={{...P.fila,alignItems:'center'}}>
            <span style={{fontSize:11,fontWeight:700,color:'#5577aa',marginRight:4}}>PRECIO:</span>
            {['Mayor','Detal','Vendedor'].map(t=>(
              <label key={t} style={P.radio}>
                <input type="radio" name="tipo" checked={tipoVta===t} onChange={()=>setTipoVta(t)}/>{' '}{t}
              </label>
            ))}
            <Fld label="Cédula Vendedor" w={130}>
              <input style={P.inp} value={cedVend} onChange={e=>setCedVend(e.target.value)} onBlur={()=>cargarVendedor(cedVend)}/>
            </Fld>
            <Fld label="Nombre Vendedor" w={190}>
              <input style={{...P.inp,...P.ro}} value={vendedor?.nomvended||''} readOnly/>
            </Fld>
            <Fld label="Celular Vendedor" w={130}>
              <input style={{...P.inp,...P.ro}} value={vendedor?.celular||''} readOnly/>
            </Fld>
          </div>
        </div>

        {/* ── TABLA ARTÍCULOS ── */}
        <div style={{margin:'0 12px 8px'}}>
          <div style={P.tablaWrap}>
            <table style={P.tabla}>
              <thead>
                <tr style={P.thead}>
                  {['#','Cód. Artículo','Descripción','Talla','Cantidad','$ Unidad','%IVA','$IVA','%Dcto','$Dcto','$ Total',''].map(h=>(
                    <th key={h} style={P.th}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {lineas.map((l,i)=>(
                  <tr key={i} style={{background:i%2===0?'#fff':'#f8faff'}}>
                    <td style={{...P.td,textAlign:'center',color:'#aaa',fontSize:10,width:24}}>
                      {l.codartic ? i+1 : ''}
                    </td>
                    <td style={P.td}>
                      <div style={{position:'relative'}}>
                        <input style={{...P.ci,width:80}} value={l.codartic}
                          onChange={e=>buscarArt(e.target.value,i)} placeholder="Código"/>
                        {artIdx===i && artSugg.length>0 && (
                          <ul style={{...P.drop,width:440,zIndex:99}}>
                            {artSugg.map((a,ai)=>(
                              <li key={ai} style={P.dropItem} onClick={()=>elegirArt(a,i)}>
                                <strong>{a.codartic}</strong> · {a.descartic}
                                <span style={{color:'#888',fontSize:10}}>
                                  {' '}T:{a.talla} — M:${fmt(a.preciovent)} D:${fmt(a.preciovend)} V:${fmt(a.preciovenv)}
                                </span>
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>
                    </td>
                    <td style={{...P.td,minWidth:160}}>
                      <input style={{...P.ci,width:'100%'}} value={l.descartic}
                        onChange={e=>buscarDesc(e.target.value,i)} placeholder="Descripción"/>
                    </td>
                    <td style={P.td}>
                      <input style={{...P.ci,width:46,textAlign:'center'}} value={l.talla}
                        onChange={e=>upd(i,{talla:e.target.value})}/>
                    </td>
                    <td style={P.td}>
                      <input type="number" style={{...P.ci,width:60,textAlign:'right'}} value={l.cantidad} min={0}
                        onChange={e=>upd(i,{cantidad:e.target.value})}/>
                    </td>
                    <td style={P.td}>
                      <input type="number" style={{...P.ci,width:90,textAlign:'right'}} value={l.valunit} min={0}
                        onChange={e=>upd(i,{valunit:Number(e.target.value)})}/>
                    </td>
                    <td style={P.td}>
                      <input type="number" style={{...P.ci,width:46,textAlign:'right'}} value={l.porciva} min={0}
                        onChange={e=>upd(i,{porciva:Number(e.target.value)})}/>
                    </td>
                    <td style={{...P.td,textAlign:'right',color:'#555',paddingRight:6}}>
                      {l.valiva?fmt(l.valiva):''}
                    </td>
                    <td style={P.td}>
                      <input type="number" style={{...P.ci,width:46,textAlign:'right'}} value={l.porcdescue} min={0} max={100}
                        onChange={e=>upd(i,{porcdescue:Number(e.target.value)})}/>
                    </td>
                    <td style={{...P.td,textAlign:'right',color:'#c0392b',paddingRight:6}}>
                      {l.valdescue?fmt(l.valdescue):''}
                    </td>
                    <td style={{...P.td,textAlign:'right',fontWeight:700,color:'#1a3a6b',paddingRight:6}}>
                      {l.valtotal?fmt(l.valtotal):''}
                    </td>
                    <td style={{...P.td,textAlign:'center'}}>
                      {l.codartic && (
                        <button onClick={()=>quitarLinea(i)} style={P.btnX} title="Quitar artículo">✕</button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* ── FOOTER ── */}
        <div style={P.footer}>

          {/* BOTONES */}
          <div style={P.footCol}>
            <div style={P.btnFila}>
              <IBtn src={WZTOP}    onClick={navPrimero}             title="Primera nota"/>
              <IBtn src={WZBACK}   onClick={navAnterior}            title="Nota anterior"/>
              <IBtn src={WZNEXT}   onClick={navSiguiente}           title="Nota siguiente"/>
              <IBtn src={WZEND}    onClick={navUltimo}              title="Última nota"/>
              <IBtn src={WZLOCATE} onClick={()=>setModal('resumen')}title="Resumen de ventas"/>
            </div>
            <div style={P.btnFila}>
              <IBtn src={WZNEW}    onClick={nuevaNota}              title="Nueva nota"/>
              <IBtn src={WZSAVE}   onClick={guardar}                title="Guardar nota" disabled={busy}/>
              <IBtn src={WZDELETE} onClick={anular}                 title="Anular nota"/>
              <IBtn src={WZPRINT}  onClick={()=>setModal('print')}  title="Imprimir"/>
              <IBtn src={WZCLOSE}  onClick={onClose}                title="Volver al menú"/>
            </div>
          </div>

          {/* TOTALES */}
          <div style={{...P.footCol,flex:1}}>
            <div style={P.prendas}>
              <span style={{fontWeight:700,color:'#856404'}}>CANTIDAD DE PRENDAS</span>
              <span style={{fontSize:24,fontWeight:900,color:'#856404'}}>{prendas}</span>
            </div>
            <div style={P.totGrid}>
              <span style={P.tL}>$ SUBTOTAL</span>
              <span style={P.tL}>$ DESCUENTO</span>
              <span style={P.tL}>$ IVA</span>
              <span style={P.tV}>{fmt(subtotal)}</span>
              <span style={{...P.tV,color:'#c62828'}}>{fmt(totDcto)}</span>
              <span style={P.tV}>{fmt(totIva)}</span>
              <span style={{...P.tL,fontWeight:900,color:'#1a3a6b'}}>$ TOTAL</span>
              <span style={P.tL}>$ ABONO</span>
              <span style={{...P.tL,color:'#c62828'}}>$ SALDO</span>
              <span style={{...P.tV,fontWeight:900,color:'#1a3a6b',fontSize:15}}>{fmt(total)}</span>
              <span style={{...P.tV,color:'#2e7d32'}}>{fmt(abonos)}</span>
              <span style={{...P.tV,color:saldo>0?'#c62828':'#2e7d32',fontWeight:700}}>{fmt(saldo)}</span>
            </div>
          </div>

          {/* MEDIO PAGO + ACCIONES */}
          <div style={P.footCol}>
            <div style={P.medios}>
              {MEDIOS.map(m=>(
                <label key={m} style={P.radio}>
                  <input type="radio" name="medio" checked={medio===m} onChange={()=>setMedio(m)}/>{' '}{m}
                </label>
              ))}
            </div>
            <div style={P.acciones}>
              <BtnAcc onClick={()=>setModal('abonos')}  icon="💵">Abonos</BtnAcc>
              <BtnAcc onClick={()=>setModal('detalle')} icon="🔍">Detalle</BtnAcc>
              <BtnAcc onClick={()=>setModal('resumen')} icon="📊">Resumen</BtnAcc>
              <BtnAcc onClick={()=>setModal('print')}   icon="🖨">Imprimir</BtnAcc>
            </div>
          </div>

        </div>
      </div>
    </div>
  )
}

// ── sub-componentes ──
function Fld({label,w,children,rel}){
  return(
    <div style={{display:'flex',flexDirection:'column',width:w,flexShrink:0,position:rel?'relative':undefined}}>
      <span style={{fontSize:10,fontWeight:700,color:'#5577aa',marginBottom:2,textTransform:'uppercase',letterSpacing:0.5}}>{label}</span>
      {children}
    </div>
  )
}
function IBtn({src,onClick,title,disabled}){
  return(
    <button onClick={onClick} title={title} disabled={disabled}
      style={{background:'#eef2ff',border:'1px solid #c8d5ea',borderRadius:6,padding:3,cursor:disabled?'not-allowed':'pointer',opacity:disabled?0.4:1,display:'flex',alignItems:'center',justifyContent:'center',width:40,height:36}}>
      <img src={src} alt={title} style={{width:28,height:28,objectFit:'contain'}}/>
    </button>
  )
}
function BtnAcc({onClick,icon,children}){
  return(
    <button onClick={onClick}
      style={{background:'#eef2ff',border:'1px solid #c8d5ea',borderRadius:8,padding:'6px 10px',cursor:'pointer',fontSize:11,fontWeight:700,color:'#1a3a6b',display:'flex',alignItems:'center',gap:4}}>
      <span>{icon}</span>{children}
    </button>
  )
}

// ── estilos ──
const P={
  pagina:   {minHeight:'100vh',background:'#dde3ee',padding:12},
  ventana:  {background:'#f4f6fb',borderRadius:12,border:'1px solid #c8d5ea',boxShadow:'0 4px 24px rgba(0,0,0,0.12)',maxWidth:1150,margin:'0 auto',overflow:'hidden'},
  titulo:   {background:'linear-gradient(90deg,#1a3a6b,#2c5fa8)',color:'#fff',padding:'8px 16px',display:'flex',alignItems:'center'},
  titTxt:   {fontWeight:900,fontSize:15,letterSpacing:2,flex:1,textAlign:'center'},
  titNro:   {background:'rgba(255,255,255,0.2)',borderRadius:6,padding:'4px 14px',fontSize:13,whiteSpace:'nowrap'},
  alerta:   {margin:'8px 12px',padding:'8px 14px',borderRadius:6,fontSize:12,display:'flex',justifyContent:'space-between',alignItems:'center'},
  alertaX:  {background:'none',border:'none',cursor:'pointer',fontWeight:900,fontSize:14},
  bloque:   {margin:'8px 12px',background:'#fff',borderRadius:8,border:'1px solid #e0e7f0',padding:'12px 14px',display:'flex',flexDirection:'column',gap:8},
  fila:     {display:'flex',flexWrap:'wrap',gap:8,alignItems:'flex-end'},
  inp:      {height:26,border:'1px solid #c8d5ea',borderRadius:5,padding:'0 7px',fontSize:12,background:'#fff',outline:'none',width:'100%',color:'#1a3a6b'},
  ro:       {background:'#f8faff',color:'#666'},
  radio:    {display:'flex',alignItems:'center',gap:4,fontSize:12,cursor:'pointer',fontWeight:600,color:'#1a3a6b',marginRight:8},
  drop:     {position:'absolute',top:'100%',left:0,background:'#fff',border:'1px solid #c8d5ea',borderRadius:6,listStyle:'none',margin:0,padding:0,zIndex:50,boxShadow:'0 8px 24px rgba(0,0,0,0.15)',maxHeight:240,overflowY:'auto',minWidth:260},
  dropItem: {padding:'7px 12px',cursor:'pointer',borderBottom:'1px solid #f0f0f0',fontSize:12},
  tablaWrap:{overflowX:'auto',borderRadius:6,border:'1px solid #e0e7f0',maxHeight:300,overflowY:'auto'},
  tabla:    {width:'100%',borderCollapse:'collapse',fontSize:11},
  thead:    {background:'#1a3a6b',position:'sticky',top:0,zIndex:2},
  th:       {padding:'6px 8px',textAlign:'center',fontWeight:700,color:'#fff',borderRight:'1px solid #2c5fa8',whiteSpace:'nowrap',fontSize:11},
  td:       {padding:'2px 3px',borderRight:'1px solid #e8eef5',borderBottom:'1px solid #e8eef5',verticalAlign:'middle'},
  ci:       {border:'none',background:'transparent',fontSize:11,padding:'2px 4px',outline:'none',color:'#1a3a6b'},
  btnX:     {background:'none',border:'none',color:'#c0392b',cursor:'pointer',fontSize:12,fontWeight:700},
  footer:   {display:'flex',gap:12,flexWrap:'wrap',padding:'10px 12px',background:'#eef2ff',borderTop:'2px solid #c8d5ea',alignItems:'flex-start'},
  footCol:  {display:'flex',flexDirection:'column',gap:6},
  btnFila:  {display:'flex',gap:4},
  prendas:  {display:'flex',justifyContent:'space-between',alignItems:'center',background:'#fff3cd',border:'1px solid #ffc107',borderRadius:6,padding:'4px 12px',marginBottom:4},
  totGrid:  {display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:'2px 12px',background:'#fff',border:'1px solid #c8d5ea',borderRadius:6,padding:'6px 12px'},
  tL:       {fontSize:10,color:'#5577aa',fontWeight:700,textAlign:'center',textTransform:'uppercase'},
  tV:       {fontSize:12,textAlign:'right',fontVariantNumeric:'tabular-nums',fontWeight:600,color:'#333'},
  medios:   {display:'flex',flexDirection:'column',gap:5,background:'#fff',border:'1px solid #c8d5ea',borderRadius:6,padding:'8px 12px'},
  acciones: {display:'grid',gridTemplateColumns:'1fr 1fr',gap:4},
}
