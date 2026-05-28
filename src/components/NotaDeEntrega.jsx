import { useState, useEffect, useRef } from 'react'
import { LOGO, WZNEW, WZSAVE, WZDELETE, WZPRINT, WZCLOSE, WZTOP, WZBACK, WZNEXT, WZEND, WZLOCATE } from '../lib/assets'
import ModalAbonos        from './ModalAbonos'
import ModalResumen       from './ModalResumen'
import ModalDetalle       from './ModalDetalle'
import PrintNota          from './PrintNota'
import ModalBuscarCliente from './ModalBuscarCliente'
import ModalEditarCliente from './ModalEditarCliente'

const fmt = n => Number(n||0).toLocaleString('es-CO',{minimumFractionDigits:2,maximumFractionDigits:2})
const hoy = () => new Date().toISOString().slice(0,10)
const VACIA = {codartic:'',descartic:'',talla:'',cantidad:'',valunit:0,porciva:0,valiva:0,porcdescue:0,valdescue:0,valtotal:0}
const FILAS_BASE = 12
const FILAS = () => Array.from({length:FILAS_BASE},()=>({...VACIA}))
const PLAZOS = ['CONTADO','15 DÍAS','30 DÍAS','60 DÍAS','90 DÍAS']
const MEDIOS = ['Efectivo','Transferencia','Mixto','Crédito']

export default function NotaDeEntrega({ supabase, onClose }) {
  const [nroDoc,    setNroDoc]    = useState('')
  const [fecha,     setFecha]     = useState(hoy())
  const [fechaPago, setFechaPago] = useState(hoy())
  const [plazo,     setPlazo]     = useState('CONTADO')
  const [pDesc,     setPDesc]     = useState(0)
  const [pIva,      setPIva]      = useState(0)
  const [tipoVta,   setTipoVta]   = useState('Mayor')
  const [medio,     setMedio]     = useState('Efectivo')
  const [cedula,    setCedula]    = useState('')
  const [cliTxt,    setCliTxt]    = useState('')
  const [cliente,   setCliente]   = useState(null)
  const [cedVend,   setCedVend]   = useState('')
  const [vendedor,  setVendedor]  = useState(null)
  const [lineas,    setLineas]    = useState(FILAS())
  const [artSugg,   setArtSugg]   = useState([])
  const [artIdx,    setArtIdx]    = useState(null)
  const [abonos,    setAbonos]    = useState(0)
  const [allIds,    setAllIds]    = useState([])
  const [navPos,    setNavPos]    = useState(null)
  const [busy,      setBusy]      = useState(false)
  const [msg,       setMsg]       = useState(null)
  const [modal,     setModal]     = useState(null)
  // estado de la nota actual
  const [guardada,  setGuardada]  = useState(false) // fue guardada en BD?
  const [anulada,   setAnulada]   = useState(false)

  const cedulaRef = useRef()
  const nroDocRef = useRef('')  // ref para saber el nro actual sin stale closure

  useEffect(() => { init() }, [])

  // ════════ INIT: cargar la última nota ════════
  async function init() {
    setBusy(true)
    const {data} = await supabase.from('encnotaen')
      .select('numnotaent')
      .order('numnotaent', {ascending:false})
    const ids = (data||[]).map(r=>r.numnotaent).reverse()
    setAllIds(ids)
    if (ids.length > 0) {
      // mostrar la última nota guardada
      await cargarDoc(ids[ids.length-1], ids)
    } else {
      // no hay notas — preparar nueva
      await prepararNueva()
    }
    setBusy(false)
  }

  // ════════ CONSECUTIVO SEGURO ════════
  async function siguienteConsecutivo() {
    const {data, error} = await supabase.rpc('siguiente_nota')
    if (!error && data) return String(data)
    // fallback
    const {data:d2} = await supabase.from('encnotaen')
      .select('numnotaent').order('numnotaent',{ascending:false}).limit(1)
    return String(d2?.length ? Number(d2[0].numnotaent)+1 : 1)
  }

  // ════════ PREPARAR NOTA NUEVA (sin guardar aún) ════════
  async function prepararNueva() {
    const nro = await siguienteConsecutivo()
    setNroDoc(nro); nroDocRef.current = nro
    setFecha(hoy()); setFechaPago(hoy())
    setPlazo('CONTADO'); setMedio('Efectivo')
    setPDesc(0); setPIva(0); setTipoVta('Mayor')
    setCedula(''); setCliTxt(''); setCliente(null)
    setCedVend(''); setVendedor(null)
    setLineas(FILAS()); setAbonos(0)
    setMsg(null); setNavPos(null)
    setGuardada(false); setAnulada(false)
    setTimeout(()=>cedulaRef.current?.focus(), 100)
  }

  // ════════ BOTÓN NUEVA NOTA ════════
  async function nuevaNota() {
    // si hay una nota en pantalla sin guardar con datos, preguntar
    if (!guardada && (cliente || cliTxt || lineas.some(l=>l.codartic))) {
      const ok = window.confirm('¿Descartar los cambios sin guardar de la nota actual?')
      if (!ok) return
    }
    await prepararNueva()
  }

  // ════════ CLIENTE — campo cédula ════════
  async function onCedulaEnter() {
    const ced = cedula.trim()
    if (!ced) {
      // vacío → abrir ventana de búsqueda
      setModal('buscarCliente')
      return
    }
    // tiene valor → buscar en BD
    setBusy(true)
    const {data} = await supabase.from('clientes').select('*')
      .or(`cedula.eq.${ced},cedula.ilike.%${ced}%`)
      .maybeSingle()
    setBusy(false)
    if (data) {
      aplicarCliente(data)
    } else {
      setMsg({tipo:'warn', texto:`Cédula "${ced}" no encontrada. Puedes escribir el nombre o buscar con el botón 🔍`})
      setCliTxt(''); setCliente(null)
    }
  }

  function aplicarCliente(c) {
    setCliente(c)
    setCedula(c.cedrifclie || c.id)
    setCliTxt(c.nombre)
    setMsg(null)
  }

  function onClienteEditado(cActualizado) {
    setCliente(cActualizado)
    setCliTxt(cActualizado.nombre)
    setModal(null)
    setMsg({tipo:'ok', texto:'Datos del cliente actualizados correctamente.'})
  }

  // ════════ VENDEDOR ════════
  async function cargarVendedor(ced) {
    if (!ced) return
    const {data} = await supabase.from('vendedor').select('*').eq('cedvended',ced).maybeSingle()
    setVendedor(data||null)
  }

  // ════════ ARTÍCULOS ════════
  function precioSegunTipo(art) {
    if (tipoVta==='Detal')    return art.preciovend || 0
    if (tipoVta==='Vendedor') return art.preciovenv || 0
    return art.preciovent || 0
  }

  async function buscarArt(txt, idx) {
    setLineas(prev=>{const n=[...prev];n[idx]={...n[idx],codartic:txt};return n})
    if (txt.length<2){setArtSugg([]);setArtIdx(null);return}
    const {data} = await supabase.from('articomp')
      .select('codartic,descartic,talla,preciovent,preciovend,preciovenv,porciva,existencia')
      .or(`codartic.ilike.%${txt}%,descartic.ilike.%${txt}%`).limit(10)
    setArtSugg(data||[]); setArtIdx(idx)
  }

  async function buscarDesc(txt, idx) {
    setLineas(prev=>{const n=[...prev];n[idx]={...n[idx],descartic:txt};return n})
    if (txt.length<2){setArtSugg([]);setArtIdx(null);return}
    const {data} = await supabase.from('articomp')
      .select('codartic,descartic,talla,preciovent,preciovend,preciovenv,porciva,existencia')
      .ilike('descartic',`%${txt}%`).limit(10)
    setArtSugg(data||[]); setArtIdx(idx)
  }

  function elegirArt(art, idx) {
    upd(idx,{codartic:art.codartic,descartic:art.descartic,talla:art.talla||'',valunit:precioSegunTipo(art),porciva:art.porciva||0})
    setArtSugg([]); setArtIdx(null)
  }

  // ════════ LÍNEAS ════════
  function recalc(lin) {
    const cant = Number(lin.cantidad)||0
    const sub  = cant*(Number(lin.valunit)||0)
    const dcto = sub*((Number(lin.porcdescue)||0)/100)
    const base = sub-dcto
    const iva  = base*((Number(lin.porciva)||0)/100)
    return {...lin,valdescue:dcto,valiva:iva,valtotal:base+iva}
  }

  function upd(idx, cambios) {
    setLineas(prev=>{
      const sig=[...prev]
      sig[idx]=recalc({...sig[idx],...cambios})
      if (idx===sig.length-1&&(cambios.codartic||cambios.descartic)) sig.push({...VACIA})
      return sig
    })
  }

  function quitarLinea(idx) {
    setLineas(prev=>{
      const nuevo=prev.filter((_,i)=>i!==idx)
      while(nuevo.length<FILAS_BASE) nuevo.push({...VACIA})
      return nuevo
    })
  }

  // ════════ TOTALES ════════
  const detValidas = lineas.filter(l=>l.codartic&&Number(l.cantidad)>0)
  const subtotal   = lineas.reduce((s,l)=>s+(Number(l.cantidad)||0)*(Number(l.valunit)||0),0)
  const totDcto    = lineas.reduce((s,l)=>s+(l.valdescue||0),0)
  const totIva     = lineas.reduce((s,l)=>s+(l.valiva||0),0)
  const total      = lineas.reduce((s,l)=>s+(l.valtotal||0),0)
  const saldo      = total-abonos
  const prendas    = lineas.reduce((s,l)=>s+(Number(l.cantidad)||0),0)

  // ════════ CARGAR NOTA ════════
  async function cargarDoc(id, idsParam) {
    setBusy(true); setMsg(null)
    const {data:enc} = await supabase.from('encnotaen').select('*').eq('numnotaent',id).maybeSingle()
    if (!enc){setBusy(false);return}
    const ids = idsParam||allIds
    const pos = ids.indexOf(id)

    setNroDoc(enc.numnotaent); nroDocRef.current=enc.numnotaent
    setNavPos(pos)
    setFecha(enc.fechanotae?.slice(0,10)||hoy())
    setFechaPago(enc.fechavence?.slice(0,10)||hoy())
    setPlazo(enc.formapago||'CONTADO'); setMedio(enc.mediopago||'Efectivo')
    setPDesc(enc.porcdescue||0); setPIva(enc.porciva||0)
    setCedula(enc.cedrifclie||''); setCedVend(enc.cedvended||'')
    if (enc.cedvended) cargarVendedor(enc.cedvended)

    const {data:cli} = await supabase.from('clientes').select('*').eq('id',enc.id).maybeSingle()
    setCliente(cli||null); setCliTxt(cli?.nombre||enc.nombre||'')

    const {data:det} = await supabase.from('detnotaen').select('*').eq('numnotaent',id)
    const extras=Math.max(0,FILAS_BASE-(det?.length||0))
    setLineas(det?.length?[...det,...Array.from({length:extras},()=>({...VACIA}))]:FILAS())

    const {data:ab} = await supabase.from('detabonos').select('valabono').eq('numnotaent',id)
    setAbonos((ab||[]).reduce((s,r)=>s+(r.valabono||0),0))

    setGuardada(true)
    setAnulada(enc.anulada==='S')
    setBusy(false)
  }

  async function recargarIds() {
    const {data}=await supabase.from('encnotaen').select('numnotaent').order('numnotaent',{ascending:true})
    const ids=(data||[]).map(r=>r.numnotaent); setAllIds(ids); return ids
  }

  function navPrimero()   {if(allIds.length){setNavPos(0);cargarDoc(allIds[0])}}
  function navAnterior()  {if(navPos>0){setNavPos(navPos-1);cargarDoc(allIds[navPos-1])}}
  function navSiguiente() {if(navPos!==null&&navPos<allIds.length-1){setNavPos(navPos+1);cargarDoc(allIds[navPos+1])}}
  function navUltimo()    {if(allIds.length){const l=allIds.length-1;setNavPos(l);cargarDoc(allIds[l])}}

  // ════════ GUARDAR ════════
  async function guardar() {
    if (!cliente && !cliTxt.trim()) {
      setMsg({tipo:'err',texto:'Ingresa un cliente antes de guardar.'}); return
    }
    if (!detValidas.length) {
      setMsg({tipo:'err',texto:'Agrega al menos un artículo con cantidad.'}); return
    }
    setBusy(true)
    try {
      const enc = {
        numnotaent:nroDoc, fechanotae:fecha, fechavence:fechaPago,
        formapago:plazo, mediopago:medio,
        codclient:cliente?.id||'99',
        nombreclie:cliente?.nombre||cliTxt,
        cedrifclie:cedula||cliente?.cedula||'',
        direcicion:cliente?.direccion||'',
        celular:cliente?.celular||'',
        ciudad:cliente?.ciudad||'',
        departamen:cliente?.departamento||'',
        nomempresa:cliente?.nom_empresa||'',
        porcdescue:pDesc, porciva:pIva,
        subtotal, valdescue:totDcto, valiva:totIva, valtotal:total,
        valabono:abonos, saldo, cedvended:cedVend,
        cantotal:prendas, anulada:'N',
      }
      const {error:e1}=await supabase.from('encnotaen').upsert(enc,{onConflict:'numnotaent'})
      if(e1)throw e1
      await supabase.from('detnotaen').delete().eq('numnotaent',nroDoc)
      const {error:e2}=await supabase.from('detnotaen').insert(
        detValidas.map(l=>({
          numnotaent:nroDoc, codartic:l.codartic, descartic:l.descartic,
          talla:l.talla, cantidad:Number(l.cantidad), valunit:Number(l.valunit),
          subtotal:Number(l.cantidad)*Number(l.valunit),
          porciva:l.porciva, valiva:l.valiva,
          porcdescue:l.porcdescue, valdescue:l.valdescue, valtotal:l.valtotal,
        }))
      )
      if(e2)throw e2
      setGuardada(true)
      setMsg({tipo:'ok',texto:`✅ Nota ${nroDoc} guardada correctamente.`})
      const ids=await recargarIds()
      setNavPos(ids.indexOf(nroDoc))
    } catch(e){
      setMsg({tipo:'err',texto:`❌ Error: ${e.message}`})
    }
    setBusy(false)
  }

  // ════════ ANULAR (marca, no borra) ════════
  async function anularNota() {
    if (!guardada) {
      setMsg({tipo:'warn',texto:'Esta nota aún no está guardada, no hay nada que anular.'}); return
    }
    if (anulada) {
      setMsg({tipo:'warn',texto:'Esta nota ya está anulada.'}); return
    }
    const motivo=window.prompt(`Motivo de anulación de la nota ${nroDoc} (opcional):`)
    if (motivo===null) return
    setBusy(true)
    const {error}=await supabase.from('encnotaen').update({
      anulada:'S', fechaanula:hoy(),
      motivoanula:motivo||'Anulada por el usuario',
    }).eq('numnotaent',nroDoc)
    if(error){
      setMsg({tipo:'err',texto:`❌ ${error.message}`})
    } else {
      setMsg({tipo:'ok',texto:`Nota ${nroDoc} anulada. El consecutivo queda en el historial.`})
      setAnulada(true)
      await recargarIds()
    }
    setBusy(false)
  }

  const dataNota={nroDoc,fecha,fechaPago,plazo,medio,cliente,cliTxt,cedula,vendedor,cedVend,lineas:detValidas,subtotal,totDcto,totIva,total,saldo,prendas,abonos}

  // ════════ RENDER ════════
  return (
    <div style={P.pagina}>
      {modal==='abonos'        && <ModalAbonos        supabase={supabase} nroDoc={nroDoc} totalNota={total} totalAbonos={abonos} onClose={()=>{setModal(null);cargarDoc(nroDoc)}}/>}
      {modal==='resumen'       && <ModalResumen       supabase={supabase} onClose={()=>setModal(null)}/>}
      {modal==='detalle'       && <ModalDetalle       nroDoc={nroDoc} lineas={detValidas} onClose={()=>setModal(null)}/>}
      {modal==='print'         && <PrintNota          datos={dataNota} onClose={()=>setModal(null)}/>}
      {modal==='buscarCliente' && <ModalBuscarCliente supabase={supabase} onSelect={c=>{aplicarCliente(c);setModal(null)}} onClose={()=>setModal(null)}/>}
      {modal==='editarCliente' && <ModalEditarCliente supabase={supabase} cliente={cliente} onGuardar={onClienteEditado} onClose={()=>setModal(null)}/>}

      <div style={P.ventana}>

        {/* TÍTULO */}
        <div style={P.titulo}>
          <img src={LOGO} alt="ATM" style={{height:40,filter:'brightness(0) invert(1)',marginRight:14}}/>
          <span style={P.titTxt}>NOTA DE ENTREGA</span>
          <div style={P.titNro}>
            N° <strong style={{fontSize:20}}>{nroDoc}</strong>
            {!guardada && <span style={{fontSize:11,marginLeft:8,background:'rgba(255,255,255,0.2)',borderRadius:4,padding:'1px 6px'}}>NUEVA</span>}
            {anulada   && <span style={{fontSize:11,marginLeft:8,background:'#e74c3c',borderRadius:4,padding:'1px 6px'}}>ANULADA</span>}
          </div>
        </div>

        {/* MENSAJE */}
        {msg && (
          <div style={{...P.alerta,
            background:msg.tipo==='ok'?'#e8f5e9':msg.tipo==='warn'?'#fff8e1':'#ffebee',
            color:msg.tipo==='ok'?'#2e7d32':msg.tipo==='warn'?'#e65100':'#c62828',
            border:`1px solid ${msg.tipo==='ok'?'#a5d6a7':msg.tipo==='warn'?'#ffe082':'#ef9a9a'}`}}>
            {msg.texto}
            <button onClick={()=>setMsg(null)} style={P.alertaX}>✕</button>
          </div>
        )}

        {/* DATOS */}
        <div style={P.bloque}>

          {/* FILA 1 — cédula, nombre, empresa */}
          <div style={P.fila}>
            <Fld label="Cédula / NIT" w={140}>
              <div style={{display:'flex',gap:4}}>
                <input
                  ref={cedulaRef}
                  style={{...P.inp,flex:1,fontWeight:700,fontSize:14}}
                  value={cedula}
                  onChange={e=>setCedula(e.target.value)}
                  onKeyDown={e=>e.key==='Enter'&&onCedulaEnter()}
                  placeholder="Cédula o NIT…"
                  disabled={anulada}
                />
                <button onClick={()=>setModal('buscarCliente')} title="Buscar cliente"
                  style={{...P.inp,width:34,padding:0,cursor:'pointer',textAlign:'center',flexShrink:0,fontSize:16,background:'#eef2ff'}}>
                  🔍
                </button>
              </div>
            </Fld>

            <Fld label="Nombre / Razón Social" w={360}>
              <div style={{display:'flex',gap:4}}>
                <input style={{...P.inp,flex:1,fontSize:14}} value={cliTxt}
                  onChange={e=>setCliTxt(e.target.value)}
                  placeholder="Nombre del cliente…"
                  disabled={anulada}/>
                {cliente && (
                  <button onClick={()=>setModal('editarCliente')} title="Editar datos del cliente"
                    style={{...P.inp,width:34,padding:0,cursor:'pointer',textAlign:'center',flexShrink:0,fontSize:16,background:'#fff3cd'}}>
                    ✎
                  </button>
                )}
              </div>
            </Fld>

            <Fld label="Empresa" w={220}>
              <input style={{...P.inp,...P.ro,fontSize:13}} value={cliente?.nom_empresa||''} readOnly/>
            </Fld>
          </div>

          {/* FILA 2 — dirección, celular, ciudad, depto */}
          <div style={P.fila}>
            <Fld label="Dirección" w={250}><input style={{...P.inp,...P.ro}} value={cliente?.direccion||''} readOnly/></Fld>
            <Fld label="Celular"   w={140}><input style={{...P.inp,...P.ro}} value={cliente?.celular||''} readOnly/></Fld>
            <Fld label="Ciudad"    w={160}><input style={{...P.inp,...P.ro}} value={cliente?.ciudad||''} readOnly/></Fld>
            <Fld label="Depto."    w={130}><input style={{...P.inp,...P.ro}} value={cliente?.departamento||''} readOnly/></Fld>
          </div>

          {/* FILA 3 — fechas */}
          <div style={P.fila}>
            <Fld label="Fecha" w={150}>
              <input type="date" style={P.inp} value={fecha} onChange={e=>setFecha(e.target.value)} disabled={anulada}/>
            </Fld>
            <Fld label="Plazo de Pago" w={160}>
              <select style={P.inp} value={plazo} onChange={e=>setPlazo(e.target.value)} disabled={anulada}>
                {PLAZOS.map(p=><option key={p}>{p}</option>)}
              </select>
            </Fld>
            <Fld label="Fecha de Pago" w={150}>
              <input type="date" style={P.inp} value={fechaPago} onChange={e=>setFechaPago(e.target.value)} disabled={anulada}/>
            </Fld>
            <Fld label="% Descuento" w={110}>
              <input type="number" style={P.inp} value={pDesc} min={0} max={100} onChange={e=>setPDesc(Number(e.target.value))} disabled={anulada}/>
            </Fld>
            <Fld label="% IVA" w={90}>
              <input type="number" style={P.inp} value={pIva} min={0} max={100} onChange={e=>setPIva(Number(e.target.value))} disabled={anulada}/>
            </Fld>
          </div>

          {/* FILA 4 — tipo venta + vendedor */}
          <div style={{...P.fila,alignItems:'center'}}>
            <span style={{fontSize:12,fontWeight:800,color:'#1a3a6b',marginRight:4}}>PRECIO:</span>
            {['Mayor','Detal','Vendedor'].map(t=>(
              <label key={t} style={P.radio}>
                <input type="radio" name="tipo" checked={tipoVta===t} onChange={()=>setTipoVta(t)} disabled={anulada}/>{' '}{t}
              </label>
            ))}
            <Fld label="Cédula Vendedor" w={140}>
              <input style={P.inp} value={cedVend} onChange={e=>setCedVend(e.target.value)} onBlur={()=>cargarVendedor(cedVend)} disabled={anulada}/>
            </Fld>
            <Fld label="Nombre Vendedor" w={200}>
              <input style={{...P.inp,...P.ro}} value={vendedor?.nomvended||''} readOnly/>
            </Fld>
            <Fld label="Celular" w={140}>
              <input style={{...P.inp,...P.ro}} value={vendedor?.celular||''} readOnly/>
            </Fld>
          </div>
        </div>

        {/* TABLA */}
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
                    <td style={{...P.td,textAlign:'center',color:'#aaa',width:28,fontSize:11}}>
                      {l.codartic?i+1:''}
                    </td>
                    <td style={P.td}>
                      <div style={{position:'relative'}}>
                        <input style={{...P.ci,width:88}} value={l.codartic}
                          onChange={e=>buscarArt(e.target.value,i)} placeholder="Código"
                          disabled={anulada}/>
                        {artIdx===i&&artSugg.length>0&&(
                          <ul style={{...P.drop,width:460,zIndex:99}}>
                            {artSugg.map((a,ai)=>(
                              <li key={ai} style={P.dropItem} onClick={()=>elegirArt(a,i)}>
                                <strong>{a.codartic}</strong> · {a.descartic}
                                <span style={{color:'#999',fontSize:11}}>
                                  {' '}T:{a.talla} | M:${fmt(a.preciovent)} D:${fmt(a.preciovend)} V:${fmt(a.preciovenv)}
                                </span>
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>
                    </td>
                    <td style={{...P.td,minWidth:170}}>
                      <input style={{...P.ci,width:'100%'}} value={l.descartic}
                        onChange={e=>buscarDesc(e.target.value,i)} placeholder="Descripción"
                        disabled={anulada}/>
                    </td>
                    <td style={P.td}><input style={{...P.ci,width:48,textAlign:'center'}} value={l.talla} onChange={e=>upd(i,{talla:e.target.value})} disabled={anulada}/></td>
                    <td style={P.td}><input type="number" style={{...P.ci,width:64,textAlign:'right',fontSize:13,fontWeight:600}} value={l.cantidad} min={0} onChange={e=>upd(i,{cantidad:e.target.value})} disabled={anulada}/></td>
                    <td style={P.td}><input type="number" style={{...P.ci,width:96,textAlign:'right',fontSize:13}} value={l.valunit} min={0} onChange={e=>upd(i,{valunit:Number(e.target.value)})} disabled={anulada}/></td>
                    <td style={P.td}><input type="number" style={{...P.ci,width:48,textAlign:'right'}} value={l.porciva} min={0} onChange={e=>upd(i,{porciva:Number(e.target.value)})} disabled={anulada}/></td>
                    <td style={{...P.td,textAlign:'right',paddingRight:8,color:'#555',fontSize:12}}>{l.valiva?fmt(l.valiva):''}</td>
                    <td style={P.td}><input type="number" style={{...P.ci,width:48,textAlign:'right'}} value={l.porcdescue} min={0} max={100} onChange={e=>upd(i,{porcdescue:Number(e.target.value)})} disabled={anulada}/></td>
                    <td style={{...P.td,textAlign:'right',paddingRight:8,color:'#c0392b',fontSize:12}}>{l.valdescue?fmt(l.valdescue):''}</td>
                    <td style={{...P.td,textAlign:'right',paddingRight:8,fontWeight:700,color:'#1a3a6b',fontSize:13}}>{l.valtotal?fmt(l.valtotal):''}</td>
                    <td style={{...P.td,textAlign:'center',width:28}}>
                      {l.codartic&&!anulada&&(
                        <button onClick={()=>quitarLinea(i)} style={P.btnX} title="Quitar">✕</button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* FOOTER */}
        <div style={P.footer}>

          <div style={P.footCol}>
            <div style={P.btnFila}>
              <IBtn src={WZTOP}    onClick={navPrimero}             title="Primera nota"/>
              <IBtn src={WZBACK}   onClick={navAnterior}            title="Anterior"/>
              <IBtn src={WZNEXT}   onClick={navSiguiente}           title="Siguiente"/>
              <IBtn src={WZEND}    onClick={navUltimo}              title="Última nota"/>
              <IBtn src={WZLOCATE} onClick={()=>setModal('resumen')}title="Resumen de ventas"/>
            </div>
            <div style={P.btnFila}>
              <IBtn src={WZNEW}    onClick={nuevaNota}              title="Nueva nota"/>
              <IBtn src={WZSAVE}   onClick={guardar}                title="Guardar" disabled={busy||anulada}/>
              <IBtn src={WZDELETE} onClick={anularNota}             title="Anular nota" disabled={anulada}/>
              <IBtn src={WZPRINT}  onClick={()=>setModal('print')}  title="Imprimir"/>
              <IBtn src={WZCLOSE}  onClick={onClose}                title="Volver al menú"/>
            </div>
          </div>

          <div style={{...P.footCol,flex:1}}>
            <div style={P.prendas}>
              <span style={{fontWeight:700,color:'#856404',fontSize:14}}>CANTIDAD DE PRENDAS</span>
              <span style={{fontSize:28,fontWeight:900,color:'#856404'}}>{prendas}</span>
            </div>
            <div style={P.totGrid}>
              <span style={P.tL}>$ SUBTOTAL</span><span style={P.tL}>$ DESCUENTO</span><span style={P.tL}>$ IVA</span>
              <span style={P.tV}>{fmt(subtotal)}</span><span style={{...P.tV,color:'#c62828'}}>{fmt(totDcto)}</span><span style={P.tV}>{fmt(totIva)}</span>
              <span style={{...P.tL,fontWeight:900,color:'#1a3a6b'}}>$ TOTAL</span><span style={P.tL}>$ ABONO</span><span style={{...P.tL,color:'#c62828'}}>$ SALDO</span>
              <span style={{...P.tV,fontWeight:900,color:'#1a3a6b',fontSize:16}}>{fmt(total)}</span>
              <span style={{...P.tV,color:'#2e7d32',fontSize:14}}>{fmt(abonos)}</span>
              <span style={{...P.tV,color:saldo>0?'#c62828':'#2e7d32',fontWeight:700,fontSize:14}}>{fmt(saldo)}</span>
            </div>
          </div>

          <div style={P.footCol}>
            <div style={P.medios}>
              {MEDIOS.map(m=>(
                <label key={m} style={P.radio}>
                  <input type="radio" name="medio" checked={medio===m} onChange={()=>setMedio(m)} disabled={anulada}/>{' '}{m}
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

function Fld({label,w,children}){
  return(
    <div style={{display:'flex',flexDirection:'column',width:w,flexShrink:0}}>
      <span style={{fontSize:11,fontWeight:700,color:'#5577aa',marginBottom:3,textTransform:'uppercase',letterSpacing:0.5}}>{label}</span>
      {children}
    </div>
  )
}
function IBtn({src,onClick,title,disabled}){
  return(
    <button onClick={onClick} title={title} disabled={disabled}
      style={{background:'#eef2ff',border:'1px solid #c8d5ea',borderRadius:6,padding:4,cursor:disabled?'not-allowed':'pointer',opacity:disabled?0.35:1,display:'flex',alignItems:'center',justifyContent:'center',width:44,height:40}}>
      <img src={src} alt={title} style={{width:30,height:30,objectFit:'contain'}}/>
    </button>
  )
}
function BtnAcc({onClick,icon,children}){
  return(
    <button onClick={onClick}
      style={{background:'#eef2ff',border:'1px solid #c8d5ea',borderRadius:8,padding:'7px 11px',cursor:'pointer',fontSize:12,fontWeight:700,color:'#1a3a6b',display:'flex',alignItems:'center',gap:5}}>
      <span>{icon}</span>{children}
    </button>
  )
}

const P={
  pagina:   {minHeight:'100vh',background:'#dde3ee',padding:12},
  ventana:  {background:'#f4f6fb',borderRadius:12,border:'1px solid #c8d5ea',boxShadow:'0 4px 24px rgba(0,0,0,0.12)',maxWidth:1200,margin:'0 auto',overflow:'hidden'},
  titulo:   {background:'linear-gradient(90deg,#1a3a6b,#2c5fa8)',color:'#fff',padding:'10px 18px',display:'flex',alignItems:'center'},
  titTxt:   {fontWeight:900,fontSize:17,letterSpacing:2,flex:1,textAlign:'center'},
  titNro:   {background:'rgba(255,255,255,0.2)',borderRadius:6,padding:'5px 16px',fontSize:14,whiteSpace:'nowrap'},
  alerta:   {margin:'8px 12px',padding:'10px 16px',borderRadius:6,fontSize:13,display:'flex',justifyContent:'space-between',alignItems:'center'},
  alertaX:  {background:'none',border:'none',cursor:'pointer',fontWeight:900,fontSize:16},
  bloque:   {margin:'8px 12px',background:'#fff',borderRadius:8,border:'1px solid #e0e7f0',padding:'14px 16px',display:'flex',flexDirection:'column',gap:10},
  fila:     {display:'flex',flexWrap:'wrap',gap:10,alignItems:'flex-end'},
  inp:      {height:30,border:'1px solid #c8d5ea',borderRadius:5,padding:'0 8px',fontSize:13,background:'#fff',outline:'none',width:'100%',color:'#1a3a6b'},
  ro:       {background:'#f8faff',color:'#555'},
  radio:    {display:'flex',alignItems:'center',gap:4,fontSize:13,cursor:'pointer',fontWeight:600,color:'#1a3a6b',marginRight:10},
  drop:     {position:'absolute',top:'100%',left:0,background:'#fff',border:'1px solid #c8d5ea',borderRadius:6,listStyle:'none',margin:0,padding:0,zIndex:50,boxShadow:'0 8px 24px rgba(0,0,0,0.15)',maxHeight:260,overflowY:'auto',minWidth:280},
  dropItem: {padding:'8px 14px',cursor:'pointer',borderBottom:'1px solid #f0f0f0',fontSize:13},
  tablaWrap:{overflowX:'auto',borderRadius:6,border:'1px solid #e0e7f0',maxHeight:320,overflowY:'auto'},
  tabla:    {width:'100%',borderCollapse:'collapse',fontSize:12},
  thead:    {background:'#1a3a6b',position:'sticky',top:0,zIndex:2},
  th:       {padding:'7px 8px',textAlign:'center',fontWeight:700,color:'#fff',borderRight:'1px solid #2c5fa8',whiteSpace:'nowrap',fontSize:12},
  td:       {padding:'3px 4px',borderRight:'1px solid #e8eef5',borderBottom:'1px solid #e8eef5',verticalAlign:'middle'},
  ci:       {border:'none',background:'transparent',fontSize:12,padding:'3px 4px',outline:'none',color:'#1a3a6b',height:26},
  btnX:     {background:'none',border:'none',color:'#c0392b',cursor:'pointer',fontSize:13,fontWeight:700},
  footer:   {display:'flex',gap:14,flexWrap:'wrap',padding:'12px 14px',background:'#eef2ff',borderTop:'2px solid #c8d5ea',alignItems:'flex-start'},
  footCol:  {display:'flex',flexDirection:'column',gap:7},
  btnFila:  {display:'flex',gap:5},
  prendas:  {display:'flex',justifyContent:'space-between',alignItems:'center',background:'#fff3cd',border:'1px solid #ffc107',borderRadius:6,padding:'5px 14px',marginBottom:5},
  totGrid:  {display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:'3px 14px',background:'#fff',border:'1px solid #c8d5ea',borderRadius:6,padding:'8px 14px'},
  tL:       {fontSize:11,color:'#5577aa',fontWeight:700,textAlign:'center',textTransform:'uppercase'},
  tV:       {fontSize:13,textAlign:'right',fontVariantNumeric:'tabular-nums',fontWeight:600,color:'#333'},
  medios:   {display:'flex',flexDirection:'column',gap:6,background:'#fff',border:'1px solid #c8d5ea',borderRadius:6,padding:'10px 14px'},
  acciones: {display:'grid',gridTemplateColumns:'1fr 1fr',gap:5},
}
