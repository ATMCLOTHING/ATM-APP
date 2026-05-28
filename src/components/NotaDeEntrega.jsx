import { useState, useEffect, useRef } from 'react'
import { LOGO, WZNEW, WZSAVE, WZDELETE, WZPRINT, WZCLOSE, WZTOP, WZBACK, WZNEXT, WZEND, WZLOCATE, WZUNDO } from '../lib/assets'
import ModalAbonos        from './ModalAbonos'
import ModalBuscarNota from './ModalBuscarNota'
import ModalDetalle       from './ModalDetalle'
import PrintNota          from './PrintNota'
import ModalBuscarCliente from './ModalBuscarCliente'
import ModalEditarCliente from './ModalEditarCliente'

const fmt = n => Number(n||0).toLocaleString('es-CO',{minimumFractionDigits:2,maximumFractionDigits:2})
const hoy = () => { const d=new Date(); return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0') }
const VACIA = {codartic:'',descartic:'',talla:'',cantidad:0,valunit:0,porciva:0,valiva:0,porcdescue:0,valdescue:0,valtotal:0}
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
  const [listaVend, setListaVend] = useState([])
  const [lineas,    setLineas]    = useState(FILAS())
  const [artSugg,   setArtSugg]   = useState([])
  const [artIdx,    setArtIdx]    = useState(null)
  const [abonos,    setAbonos]    = useState(0)
  const [allIds,    setAllIds]    = useState([])
  const [navPos,    setNavPos]    = useState(null)
  const [busy,      setBusy]      = useState(false)
  const [msg,       setMsg]       = useState(null)
  const [modal,     setModal]     = useState(null)
  const [guardada,  setGuardada]  = useState(false)
  const [anulada,   setAnulada]   = useState(false)
  const [modoNueva, setModoNueva] = useState(false) // true = usuario presionó Nueva, aún sin guardar

  const cedulaRef = useRef()

  // ── cargar vendedores al montar ──
  useEffect(() => {
    supabase.from('vendedores').select('id,cedula,nombre').order('nombre')
      .then(({data}) => { if(data) setListaVend(data) })
  }, [])

  // ── init: mostrar última nota ──
  useEffect(() => { init() }, [])

  async function init() {
    setBusy(true)
    const {data} = await supabase.from('encnotaen')
      .select('numnotaent').order('numnotaent',{ascending:false})
    const ids = (data||[]).map(r=>r.numnotaent).reverse()
    setAllIds(ids)
    if (ids.length > 0) {
      await cargarDoc(ids[ids.length-1], ids)
    } else {
      await prepararNueva()
    }
    setBusy(false)
  }

  // ── consecutivo ──
  async function siguienteConsecutivo() {
    const {data,error} = await supabase.rpc('siguiente_nota')
    if (!error && data) return String(data)
    const {data:d2} = await supabase.from('encnotaen')
      .select('numnotaent').order('numnotaent',{ascending:false}).limit(1)
    return String(d2?.length ? Number(d2[0].numnotaent)+1 : 1)
  }

  // ── preparar formulario en blanco ──
  async function prepararNueva() {
    const nro = await siguienteConsecutivo()
    setNroDoc(nro)
    setFecha(hoy()); setFechaPago(hoy())
    setPlazo('CONTADO'); setMedio('Efectivo')
    setPDesc(0); setPIva(0); setTipoVta('Mayor')
    setCedula(''); setCliTxt(''); setCliente(null)
    setCedVend(''); setVendedor(null)
    setLineas(FILAS()); setAbonos(0)
    setMsg(null); setNavPos(null)
    setGuardada(false); setAnulada(false); setModoNueva(true)
    setTimeout(()=>cedulaRef.current?.focus(), 100)
  }

  // ── botón nueva nota ──
  async function nuevaNota() {
    if (modoNueva && (cliente || cliTxt || lineas.some(l=>l.codartic))) {
      if (!window.confirm('¿Descartar los cambios sin guardar?')) return
    }
    await prepararNueva()
  }

  // ── revertir nueva nota: vuelve a la última guardada ──
  async function revertirNueva() {
    if (!modoNueva) return
    const ids = allIds
    if (ids.length > 0) {
      await cargarDoc(ids[ids.length-1])
    } else {
      setMsg({tipo:'warn',texto:'No hay notas guardadas a las cuales volver.'})
    }
  }

  // ── cliente ──
  async function onCedulaEnter() {
    const ced = cedula.trim()
    if (!ced) { setModal('buscarCliente'); return }
    setBusy(true)
    const {data} = await supabase.from('clientes').select('*').eq('cedula',ced).limit(1)
    setBusy(false)
    if (data && data.length > 0) {
      aplicarCliente(data[0])
    } else {
      setMsg({tipo:'warn',texto:`Cédula "${ced}" no encontrada. Usa 🔍 para buscar.`})
      setCliTxt(''); setCliente(null)
    }
  }

  function aplicarCliente(c) {
    setCliente(c)
    setCedula(c.cedula||String(c.id))
    setCliTxt(c.nombre)
    setMsg(null)
  }

  function onClienteEditado(c) {
    setCliente(c); setCliTxt(c.nombre); setModal(null)
    setMsg({tipo:'ok',texto:'Cliente actualizado.'})
  }

  // ── vendedor ──
  function elegirVendedor(cedSel) {
    const v = listaVend.find(x=>x.cedula===cedSel)||null
    setCedVend(cedSel); setVendedor(v)
  }

  // ── artículos ──
  function precioSegunTipo(art) {
    if (tipoVta==='Detal')    return art.preciovend||0
    if (tipoVta==='Vendedor') return art.preciovenv||0
    return art.preciovent||0
  }

  async function buscarArt(txt, idx) {
    setLineas(prev=>{const n=[...prev];n[idx]={...n[idx],codartic:txt};return n})
    if (txt.length<1){setArtSugg([]);setArtIdx(null);return}
    const {data} = await supabase.from('articomp')
      .select('codartic,descartic,talla,marca,genero,preciovent,preciovend,preciovenv,porciva')
      .ilike('codartic',`%${txt}%`).limit(10)
    if (!data||!data.length){setArtSugg([]);setArtIdx(null);return}
    // si hay una sola coincidencia exacta, cargar directo sin mostrar lista
    const exacto = data.find(a=>a.codartic.toString()===txt.toString())
    if (exacto && data.filter(a=>a.codartic.toString()===txt.toString()).length===1) {
      elegirArt(exacto, idx)
    } else {
      setArtSugg(data); setArtIdx(idx)
    }
  }

  async function buscarDesc(txt, idx) {
    setLineas(prev=>{const n=[...prev];n[idx]={...n[idx],descartic:txt};return n})
    if (txt.length<2){setArtSugg([]);setArtIdx(null);return}
    const {data} = await supabase.from('articomp')
      .select('codartic,descartic,talla,marca,genero,preciovent,preciovend,preciovenv,porciva')
      .ilike('descartic',`%${txt}%`).limit(10)
    setArtSugg(data||[]); setArtIdx(idx)
  }

  function elegirArt(art, idx) {
    // si el artículo ya existe en otra línea, sumar cantidad
    setLineas(prev => {
      const sig = [...prev]
      const existeIdx = sig.findIndex((l,i) => i!==idx && l.codartic===art.codartic && l.talla===art.talla)
      if (existeIdx >= 0) {
        // sumar en la línea existente
        const nueva = recalc({...sig[existeIdx], cantidad: Number(sig[existeIdx].cantidad||0)+1})
        sig[existeIdx] = nueva
        // limpiar la línea actual
        sig[idx] = {...VACIA}
        return sig
      }
      // no existe — poner en la línea actual con cantidad 1
      const precio = precioSegunTipo(art)
      sig[idx] = recalc({...sig[idx], codartic:art.codartic, descartic:art.descartic, talla:art.talla||'', valunit:precio, porciva:art.porciva||0, cantidad:1})
      if (idx===sig.length-1) sig.push({...VACIA})
      return sig
    })
    setArtSugg([]); setArtIdx(null)
  }

  // ── cálculo de línea ──
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

  // ── totales ──
  const detValidas = lineas.filter(l=>l.codartic&&Number(l.cantidad)>0)
  const subtotal   = detValidas.reduce((s,l)=>s+(Number(l.cantidad)||0)*(Number(l.valunit)||0),0)
  const totDcto    = detValidas.reduce((s,l)=>s+(l.valdescue||0),0)
  const totIva     = detValidas.reduce((s,l)=>s+(l.valiva||0),0)
  const total      = detValidas.reduce((s,l)=>s+(l.valtotal||0),0)
  const saldo      = total-abonos
  const prendas    = detValidas.reduce((s,l)=>s+(Number(l.cantidad)||0),0)

  // ── cargar nota ──
  async function cargarDoc(id, idsParam) {
    setBusy(true); setMsg(null)
    const {data:enc} = await supabase.from('encnotaen').select('*').eq('numnotaent',id).limit(1)
    if (!enc||!enc.length){setBusy(false);return}
    const e = enc[0]
    const ids = idsParam||allIds
    setNavPos(ids.indexOf(id))
    setNroDoc(e.numnotaent)
    setFecha(e.fechanotae?.slice(0,10)||hoy())
    setFechaPago(e.fechavence?.slice(0,10)||hoy())
    setPlazo(e.formapago||'CONTADO'); setMedio(e.mediopago||'Efectivo')
    setPDesc(e.porcdescue||0); setPIva(e.porciva||0)
    setCedula(e.cedrifclie||'')
    // vendedor
    const cedV = e.cedvended||''
    setCedVend(cedV)
    setVendedor(listaVend.find(v=>v.cedula===cedV)||null)
    // cliente
    const {data:cli} = await supabase.from('clientes').select('*').eq('id',e.codclient).limit(1)
    setCliente(cli&&cli.length?cli[0]:null)
    setCliTxt(cli&&cli.length?cli[0].nombre:e.nombreclie||'')
    // líneas
    const {data:det} = await supabase.from('detnotaen').select('*').eq('numnotaent',id)
    const extras = Math.max(0,FILAS_BASE-(det?.length||0))
    setLineas(det?.length?[...det,...Array.from({length:extras},()=>({...VACIA}))]:FILAS())
    // abonos — solo de ESTA nota
    const {data:ab} = await supabase.from('detabonos').select('valabono').eq('numnotaent',id)
    setAbonos((ab||[]).reduce((s,r)=>s+(r.valabono||0),0))
    setGuardada(true); setAnulada(e.anulada==='S'); setModoNueva(false)
    setBusy(false)
  }

  async function recargarIds() {
    const {data}=await supabase.from('encnotaen').select('numnotaent').order('numnotaent',{ascending:true})
    const ids=(data||[]).map(r=>r.numnotaent); setAllIds(ids); return ids
  }

  // ── navegación ──
  function navPrimero()   { if(allIds.length){setNavPos(0);cargarDoc(allIds[0])} }
  function navAnterior()  { if(navPos!==null&&navPos>0){cargarDoc(allIds[navPos-1])} }
  function navSiguiente() { if(navPos!==null&&navPos<allIds.length-1){cargarDoc(allIds[navPos+1])} }
  function navUltimo()    { if(allIds.length){cargarDoc(allIds[allIds.length-1])} }

  // ── guardar ──
  async function guardar() {
    if (!cliente&&!cliTxt.trim()){setMsg({tipo:'err',texto:'Ingresa un cliente antes de guardar.'}); return}
    if (!detValidas.length){setMsg({tipo:'err',texto:'Agrega al menos un artículo con cantidad.'}); return}
    setBusy(true)
    try {
      const enc = {
        numnotaent:nroDoc, fechanotae:fecha, fechavence:fechaPago,
        formapago:plazo, mediopago:medio,
        codclient:cliente?.id||99,
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
      setGuardada(true); setModoNueva(false)
      setMsg({tipo:'ok',texto:`✅ Nota ${nroDoc} guardada correctamente.`})
      const ids=await recargarIds()
      setNavPos(ids.indexOf(nroDoc))
    } catch(e){
      setMsg({tipo:'err',texto:`❌ Error: ${e.message}`})
    }
    setBusy(false)
  }

  // ── anular ──
  async function anularNota() {
    if (!guardada){setMsg({tipo:'warn',texto:'Esta nota no está guardada aún.'}); return}
    if (anulada){setMsg({tipo:'warn',texto:'Esta nota ya está anulada.'}); return}
    const motivo=window.prompt(`Motivo de anulación (opcional):`)
    if (motivo===null) return
    setBusy(true)
    const {error}=await supabase.from('encnotaen').update({
      anulada:'S',fechaanula:hoy(),motivoanula:motivo||'Anulada'
    }).eq('numnotaent',nroDoc)
    if(error){setMsg({tipo:'err',texto:`❌ ${error.message}`})}
    else {setAnulada(true); setMsg({tipo:'ok',texto:`Nota ${nroDoc} anulada.`})}
    setBusy(false)
  }

  const dataNota={nroDoc,fecha,fechaPago,plazo,medio,cliente,cliTxt,cedula,vendedor,cedVend,lineas:detValidas,subtotal,totDcto,totIva,total,saldo,prendas,abonos}

  // ── abrir modal de abonos: guarda automáticamente si no está guardada ──
  async function abrirAbonos() {
    if (!cliente && !cliTxt.trim()) { setMsg({tipo:'warn',texto:'Ingresa un cliente antes de registrar abonos.'}); return }
    if (!detValidas.length) { setMsg({tipo:'warn',texto:'Agrega artículos antes de registrar abonos.'}); return }
    if (!guardada) {
      // guardar directo en BD sin depender del estado React
      try {
        const enc = {
          numnotaent:nroDoc, fechanotae:fecha, fechavence:fechaPago,
          formapago:plazo, mediopago:medio,
          codclient:cliente?.id||99,
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
        const {error:e1} = await supabase.from('encnotaen').upsert(enc,{onConflict:'numnotaent'})
        if (e1) throw e1
        await supabase.from('detnotaen').delete().eq('numnotaent',nroDoc)
        const {error:e2} = await supabase.from('detnotaen').insert(
          detValidas.map(l=>({
            numnotaent:nroDoc, codartic:l.codartic, descartic:l.descartic,
            talla:l.talla, cantidad:Number(l.cantidad), valunit:Number(l.valunit),
            subtotal:Number(l.cantidad)*Number(l.valunit),
            porciva:l.porciva, valiva:l.valiva,
            porcdescue:l.porcdescue, valdescue:l.valdescue, valtotal:l.valtotal,
          }))
        )
        if (e2) throw e2
        setGuardada(true); setModoNueva(false)
        await recargarIds()
      } catch(e) {
        setMsg({tipo:'err',texto:`❌ Error al guardar: ${e.message}`}); return
      }
    }
    setModal('abonos')
  }

  return (
    <div style={P.pagina}>
      {modal==='abonos'        && <ModalAbonos        supabase={supabase} nroDoc={nroDoc} totalNota={total} totalAbonos={abonos} onClose={async()=>{setModal(null);await cargarDoc(nroDoc)}}/>}
      {modal==='buscarNota'    && <ModalBuscarNota    supabase={supabase} onSelect={id=>{setModal(null);cargarDoc(id)}} onClose={()=>setModal(null)}/>}
      {modal==='detalle'       && <ModalDetalle       nroDoc={nroDoc} lineas={detValidas} onClose={()=>setModal(null)}/>}
      {modal==='print'         && <PrintNota          datos={dataNota} onClose={()=>setModal(null)}/>}
      {modal==='buscarCliente' && <ModalBuscarCliente supabase={supabase} onSelect={c=>{aplicarCliente(c);setModal(null)}} onClose={()=>setModal(null)}/>}
      {modal==='editarCliente' && <ModalEditarCliente supabase={supabase} cliente={cliente} onGuardar={onClienteEditado} onClose={()=>setModal(null)}/>}

      <div style={P.ventana}>
        {/* TÍTULO */}
        <div style={P.titulo}>
          <img src={LOGO} alt="ATM" style={{height:38,filter:'brightness(0) invert(1)',marginRight:14}}/>
          <span style={P.titTxt}>NOTA DE ENTREGA</span>
          <div style={P.titNro}>
            N° <strong style={{fontSize:22}}>{nroDoc}</strong>
            {modoNueva && <span style={P.badgeNueva}>NUEVA</span>}
            {anulada   && <span style={P.badgeAnul}>ANULADA</span>}
          </div>
        </div>

        {/* MENSAJE */}
        {msg && (
          <div style={{...P.alerta,
            background:msg.tipo==='ok'?'#e8f5e9':msg.tipo==='warn'?'#fff8e1':'#ffebee',
            color:msg.tipo==='ok'?'#2e7d32':msg.tipo==='warn'?'#e65100':'#c62828',
            border:`1px solid ${msg.tipo==='ok'?'#a5d6a7':msg.tipo==='warn'?'#ffe082':'#ef9a9a'}`}}>
            {msg.texto}<button onClick={()=>setMsg(null)} style={P.alertaX}>✕</button>
          </div>
        )}

        {/* ENCABEZADO — grid 2 columnas para aprovechar espacio */}
        <div style={P.bloque}>
          {/* FILA 1: cédula, búsqueda, nombre, edición, empresa, celular, dirección, ciudad, departamento */}
          <div style={P.fila}>
            <Fld label="Cédula / NIT" w={140}>
              <div style={{display:'flex',gap:4}}>
                <input ref={cedulaRef} style={{...P.inp,flex:1,fontWeight:700,fontSize:14}}
                  value={cedula} onChange={e=>setCedula(e.target.value)}
                  onKeyDown={e=>e.key==='Enter'&&onCedulaEnter()}
                  placeholder="Cédula o NIT…" disabled={anulada}/>
                <button onClick={()=>setModal('buscarCliente')}
                  style={{...P.inp,width:32,padding:0,cursor:'pointer',textAlign:'center',flexShrink:0,fontSize:15,background:'#eef2ff'}}>
                  🔍
                </button>
              </div>
            </Fld>
            <Fld label="Nombre / Razón Social" w={280}>
              <div style={{display:'flex',gap:4}}>
                <input style={{...P.inp,flex:1,fontSize:13}} value={cliTxt}
                  onChange={e=>setCliTxt(e.target.value)}
                  placeholder="Nombre…" disabled={anulada}/>
                {cliente && <button onClick={()=>setModal('editarCliente')}
                  style={{...P.inp,width:32,padding:0,cursor:'pointer',textAlign:'center',flexShrink:0,fontSize:15,background:'#fff3cd'}}>✎</button>}
              </div>
            </Fld>
            <Fld label="Empresa" w={180}>
              <input style={{...P.inp,...P.ro}} value={cliente?.nom_empresa||''} readOnly/>
            </Fld>
            <Fld label="Celular" w={120}>
              <input style={{...P.inp,...P.ro}} value={cliente?.celular||''} readOnly/>
            </Fld>
            <Fld label="Dirección" w={200}>
              <input style={{...P.inp,...P.ro}} value={cliente?.direccion||''} readOnly/>
            </Fld>
            <Fld label="Ciudad" w={130}>
              <input style={{...P.inp,...P.ro}} value={cliente?.ciudad||''} readOnly/>
            </Fld>
            <Fld label="Departamento" w={140}>
              <input style={{...P.inp,...P.ro}} value={cliente?.departamento||''} readOnly/>
            </Fld>
          </div>

          {/* FILA 2: fecha, plazo, fecha pago, % descto, % iva, precio, vendedor */}
          <div style={P.fila}>
            <Fld label="Fecha" w={140}>
              <input type="date" style={P.inp} value={fecha} onChange={e=>setFecha(e.target.value)} disabled={anulada}/>
            </Fld>
            <Fld label="Plazo de Pago" w={150}>
              <select style={P.inp} value={plazo} onChange={e=>setPlazo(e.target.value)} disabled={anulada}>
                {PLAZOS.map(p=><option key={p}>{p}</option>)}
              </select>
            </Fld>
            <Fld label="Fecha de Pago" w={140}>
              <input type="date" style={P.inp} value={fechaPago} onChange={e=>setFechaPago(e.target.value)} disabled={anulada}/>
            </Fld>
            <Fld label="% Dcto." w={80}>
              <input type="number" style={P.inp} value={pDesc} min={0} max={100} onChange={e=>setPDesc(Number(e.target.value))} disabled={anulada}/>
            </Fld>
            <Fld label="% IVA" w={70}>
              <input type="number" style={P.inp} value={pIva} min={0} max={100} onChange={e=>setPIva(Number(e.target.value))} disabled={anulada}/>
            </Fld>
            <div style={{display:'flex',alignItems:'flex-end',gap:8}}>
              <span style={{fontSize:12,fontWeight:800,color:'#1a3a6b',marginBottom:6}}>PRECIO:</span>
              {['Mayor','Detal','Vendedor'].map(t=>(
                <label key={t} style={{...P.radio,marginBottom:4}}>
                  <input type="radio" name="tipo" checked={tipoVta===t} onChange={()=>setTipoVta(t)} disabled={anulada}/>{' '}{t}
                </label>
              ))}
            </div>
            <Fld label="Vendedor" w={240}>
              <select style={{...P.inp,cursor:'pointer'}}
                value={cedVend} onChange={e=>elegirVendedor(e.target.value)} disabled={anulada}>
                <option value="">-- Selecciona vendedor --</option>
                {listaVend.map(v=>(
                  <option key={v.id} value={v.cedula}>{v.cedula} - {v.nombre}</option>
                ))}
              </select>
            </Fld>
          </div>
        </div>

        {/* TABLA ARTÍCULOS */}
        <div style={{margin:'0 12px 8px'}}>
          <div style={P.tablaWrap}>
            <table style={P.tabla}>
              <thead>
                <tr style={P.thead}>
                  {['#','Cód. Artículo','Descripción','Marca','Género','Talla','Cantidad','$ Unidad','%Dcto','$Dcto','$ Total',''].map(h=>(
                    <th key={h} style={P.th}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {lineas.map((l,i)=>(
                  <tr key={i} style={{background:i%2===0?'#fff':'#f8faff'}}>
                    <td style={{...P.td,textAlign:'center',color:'#aaa',width:26,fontSize:11}}>{l.codartic?i+1:''}</td>
                    <td style={P.td}>
                      <div style={{position:'relative'}}>
                        <input style={{...P.ci,width:88}} value={l.codartic}
                          onChange={e=>buscarArt(e.target.value,i)}
                          onKeyDown={e=>{if(e.key==='Enter'){setArtSugg([]);setArtIdx(null);e.target.closest('tr')?.querySelectorAll('input')[3]?.focus()}}}
                          placeholder="Código" disabled={anulada}/>
                        {artIdx===i&&artSugg.length>0&&(
                          <ul style={{...P.drop,width:460,zIndex:99}}>
                            {artSugg.map((a,ai)=>(
                              <li key={ai} style={P.dropItem} onClick={()=>elegirArt(a,i)}>
                                <strong>{a.codartic}</strong> · {a.descartic}
                                <span style={{color:'#999',fontSize:11}}> T:{a.talla} | ${fmt(precioSegunTipo(a))}</span>
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>
                    </td>
                    <td style={{...P.td,minWidth:160}}>
                      <input style={{...P.ci,width:'100%'}} value={l.descartic}
                        onChange={e=>buscarDesc(e.target.value,i)}
                        placeholder="Descripción" disabled={anulada}/>
                    </td>
                    <td style={{...P.td,paddingLeft:4,fontSize:11,color:'#555'}}>{l.marca||''}</td>
                    <td style={{...P.td,paddingLeft:4,fontSize:11,color:'#555'}}>{l.genero||''}</td>
                    <td style={P.td}><input style={{...P.ci,width:46,textAlign:'center'}} value={l.talla} onChange={e=>upd(i,{talla:e.target.value})} disabled={anulada}/></td>
                    <td style={P.td}><input type="number" style={{...P.ci,width:60,textAlign:'right',fontSize:13,fontWeight:600}} value={l.cantidad} min={1} onChange={e=>upd(i,{cantidad:e.target.value})} disabled={anulada}/></td>
                    <td style={P.td}><input type="number" style={{...P.ci,width:96,textAlign:'right'}} value={l.valunit} min={0} onChange={e=>upd(i,{valunit:Number(e.target.value)})} disabled={anulada}/></td>
                    <td style={P.td}><input type="number" style={{...P.ci,width:46,textAlign:'right'}} value={l.porcdescue} min={0} max={100} onChange={e=>upd(i,{porcdescue:Number(e.target.value)})} disabled={anulada}/></td>
                    <td style={{...P.td,textAlign:'right',paddingRight:6,color:'#c0392b',fontSize:12}}>{l.valdescue?fmt(l.valdescue):''}</td>
                    <td style={{...P.td,textAlign:'right',paddingRight:6,fontWeight:700,color:'#1a3a6b',fontSize:13}}>{l.valtotal?fmt(l.valtotal):''}</td>
                    <td style={{...P.td,textAlign:'center',width:26}}>
                      {l.codartic&&!anulada&&<button onClick={()=>quitarLinea(i)} style={P.btnX}>✕</button>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* FOOTER */}
        <div style={P.footer}>

          {/* BOTONES */}
          <div style={P.footCol}>
            <div style={P.btnFila}>
              <IBtn src={WZTOP}    onClick={navPrimero}              title="Primera nota"/>
              <IBtn src={WZBACK}   onClick={navAnterior}             title="Anterior"/>
              <IBtn src={WZNEXT}   onClick={navSiguiente}            title="Siguiente"/>
              <IBtn src={WZEND}    onClick={navUltimo}               title="Última nota"/>
              <IBtn src={WZLOCATE} onClick={()=>setModal('buscarNota')} title="Buscar nota"/>
            </div>
            <div style={P.btnFila}>
              <IBtn src={WZNEW}    onClick={nuevaNota}    title="Nueva nota"  disabled={modoNueva&&!(cliente||cliTxt||lineas.some(l=>l.codartic))}/>
              <IBtn src={WZSAVE}   onClick={guardar}      title="Guardar"     disabled={busy||anulada}/>
              <IBtn src={WZUNDO}   onClick={revertirNueva} title="Revertir"   disabled={!modoNueva}/>
              <IBtn src={WZDELETE} onClick={anularNota}   title="Anular"      disabled={anulada||modoNueva}/>
              <IBtn src={WZPRINT}  onClick={()=>setModal('print')} title="Imprimir"/>
              <IBtn src={WZCLOSE}  onClick={onClose}      title="Volver al menú"/>
            </div>
          </div>

          {/* TOTALES — igual al original */}
          <div style={{...P.footCol,flex:1}}>
            <div style={P.prendas}>
              <span style={{fontWeight:800,color:'#856404',fontSize:13}}>CANTIDAD DE PRENDAS</span>
              <input readOnly value={fmt(prendas)} style={{width:80,textAlign:'right',fontWeight:900,fontSize:15,color:'#856404',border:'1px solid #ffc107',borderRadius:3,padding:'1px 5px',background:'#fff'}}/>
            </div>
            <div style={P.totGrid}>
              <span style={P.tL}>$SUB TOTAL</span>
              <span style={P.tL}>$ DESCUENTO</span>
              <span style={P.tL}>$ IVA</span>
              <span style={P.tV}>{fmt(subtotal)}</span>
              <span style={{...P.tV,color:'#333'}}>{fmt(totDcto)}</span>
              <span style={P.tV}>{fmt(totIva)}</span>
              <span style={{...P.tL,fontWeight:900,color:'#1a3a6b'}}>$ TOTAL</span>
              <span style={P.tL}>$ ABONO</span>
              <span style={{...P.tL,color:'#c62828',fontWeight:700}}>$ SALDO</span>
              <span style={{...P.tV,fontWeight:900,color:'#1a3a6b',fontSize:14}}>{fmt(total)}</span>
              <span style={{...P.tV,color:'#333'}}>{fmt(abonos)}</span>
              <span style={{...P.tV,color:saldo>0?'#c62828':'#2e7d32',fontWeight:700,fontSize:14}}>{fmt(saldo)}</span>
            </div>
          </div>

          {/* MEDIO PAGO + ACCIONES */}
          <div style={P.footCol}>
            <div style={P.medios}>
              {MEDIOS.map(m=>(
                <label key={m} style={P.radio}>
                  <input type="radio" name="medio" checked={medio===m} onChange={()=>setMedio(m)} disabled={anulada}/>{' '}{m}
                </label>
              ))}
            </div>
            <div style={P.acciones}>
              <BtnAcc onClick={abrirAbonos} icon="💵">Abonos</BtnAcc>
              <BtnAcc onClick={()=>setModal('detalle')} icon="🔍">Detalle</BtnAcc>
              <BtnAcc onClick={()=>setModal('buscarNota')} icon="📊">Resumen</BtnAcc>
              <BtnAcc onClick={()=>setModal('print')}   icon="🖨">Imprimir</BtnAcc>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── sub-componentes ──
function Fld({label,w,children}){
  return(
    <div style={{display:'flex',flexDirection:'column',width:w,flexShrink:0}}>
      <span style={{fontSize:10,fontWeight:700,color:'#5577aa',marginBottom:2,textTransform:'uppercase',letterSpacing:0.5}}>{label}</span>
      {children}
    </div>
  )
}
function TotFila({label,val,color,grande}){
  return(
    <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'2px 0',borderBottom:'1px solid #eef0f5'}}>
      <span style={{fontSize:11,fontWeight:700,color:'#5577aa',textTransform:'uppercase'}}>{label}</span>
      <span style={{fontSize:grande?16:13,fontWeight:grande?900:600,color:color||'#333',fontVariantNumeric:'tabular-nums'}}>{val}</span>
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
  pagina:    {minHeight:'100vh',background:'#dde3ee',padding:12},
  ventana:   {background:'#f4f6fb',borderRadius:12,border:'1px solid #c8d5ea',boxShadow:'0 4px 24px rgba(0,0,0,0.12)',maxWidth:1300,margin:'0 auto',overflow:'hidden'},
  titulo:    {background:'linear-gradient(90deg,#1a3a6b,#2c5fa8)',color:'#fff',padding:'10px 18px',display:'flex',alignItems:'center'},
  titTxt:    {fontWeight:900,fontSize:17,letterSpacing:2,flex:1,textAlign:'center'},
  titNro:    {background:'rgba(255,255,255,0.2)',borderRadius:6,padding:'5px 16px',fontSize:14,whiteSpace:'nowrap',display:'flex',alignItems:'center',gap:8},
  badgeNueva:{fontSize:10,background:'rgba(255,255,255,0.25)',borderRadius:4,padding:'2px 7px'},
  badgeAnul: {fontSize:10,background:'#e74c3c',borderRadius:4,padding:'2px 7px'},
  alerta:    {margin:'6px 12px',padding:'8px 14px',borderRadius:6,fontSize:13,display:'flex',justifyContent:'space-between',alignItems:'center'},
  alertaX:   {background:'none',border:'none',cursor:'pointer',fontWeight:900,fontSize:16},
  bloque:    {margin:'8px 12px',background:'#fff',borderRadius:8,border:'1px solid #e0e7f0',padding:'12px 14px',display:'flex',flexDirection:'column',gap:8},
  fila:      {display:'flex',flexWrap:'wrap',gap:8,alignItems:'flex-end'},
  inp:       {height:30,border:'1px solid #c8d5ea',borderRadius:5,padding:'0 8px',fontSize:13,background:'#fff',outline:'none',width:'100%',color:'#1a3a6b'},
  ro:        {background:'#f8faff',color:'#555'},
  radio:     {display:'flex',alignItems:'center',gap:4,fontSize:13,cursor:'pointer',fontWeight:600,color:'#1a3a6b',marginRight:10},
  drop:      {position:'absolute',top:'100%',left:0,background:'#fff',border:'1px solid #c8d5ea',borderRadius:6,listStyle:'none',margin:0,padding:0,zIndex:50,boxShadow:'0 8px 24px rgba(0,0,0,0.15)',maxHeight:260,overflowY:'auto',minWidth:280},
  dropItem:  {padding:'8px 14px',cursor:'pointer',borderBottom:'1px solid #f0f0f0',fontSize:13},
  tablaWrap: {overflowX:'auto',borderRadius:6,border:'1px solid #e0e7f0',maxHeight:300,overflowY:'auto'},
  tabla:     {width:'100%',borderCollapse:'collapse',fontSize:12},
  thead:     {background:'#1a3a6b',position:'sticky',top:0,zIndex:2},
  th:        {padding:'7px 8px',textAlign:'center',fontWeight:700,color:'#fff',borderRight:'1px solid #2c5fa8',whiteSpace:'nowrap',fontSize:12},
  td:        {padding:'3px 4px',borderRight:'1px solid #e8eef5',borderBottom:'1px solid #e8eef5',verticalAlign:'middle'},
  ci:        {border:'none',background:'transparent',fontSize:12,padding:'3px 4px',outline:'none',color:'#1a3a6b',height:26},
  btnX:      {background:'none',border:'none',color:'#c0392b',cursor:'pointer',fontSize:13,fontWeight:700},
  footer:    {display:'flex',gap:12,flexWrap:'wrap',padding:'10px 14px',background:'#eef2ff',borderTop:'2px solid #c8d5ea',alignItems:'flex-start'},
  footCol:   {display:'flex',flexDirection:'column',gap:6},
  btnFila:   {display:'flex',gap:4},
  prendas:   {display:'flex',justifyContent:'space-between',alignItems:'center',background:'#fff3cd',border:'1px solid #ffc107',borderRadius:6,padding:'5px 14px',marginBottom:6},
  totGrid:   {background:'#fff',border:'1px solid #c8d5ea',borderRadius:6,padding:'8px 14px',display:'flex',flexDirection:'column',gap:2},
  medios:    {display:'flex',flexDirection:'column',gap:6,background:'#fff',border:'1px solid #c8d5ea',borderRadius:6,padding:'10px 14px'},
  acciones:  {display:'grid',gridTemplateColumns:'1fr 1fr',gap:5},
  tL:        {fontSize:11,color:'#1a3a6b',fontWeight:600,textAlign:'center'},
  tV:        {fontSize:12,textAlign:'right',fontVariantNumeric:'tabular-nums',fontWeight:600,color:'#333'},
  totGrid:   {display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:'2px 8px',background:'#fff',border:'1px solid #c8d5ea',borderRadius:6,padding:'6px 10px'},
}
