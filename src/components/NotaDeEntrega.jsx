import { useState, useEffect, useRef } from 'react'
import { LOGO, WZNEW, WZSAVE, WZDELETE, WZPRINT, WZCLOSE, WZTOP, WZBACK, WZNEXT, WZEND, WZLOCATE } from '../lib/assets'
import ModalAbonos        from './ModalAbonos'
import ModalResumen       from './ModalResumen'
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
  const [modoNueva, setModoNueva] = useState(false)

  const cedulaRef = useRef()
  const navPosRef = useRef(null)
  const allIdsRef = useRef([])

  useEffect(() => {
    supabase.from('vendedores').select('id,cedula,nombre').order('nombre')
      .then(({data}) => { if(data) setListaVend(data) })
  }, [])

  useEffect(() => { init() }, [])

  async function init() {
    setBusy(true)
    const {data} = await supabase.from('encnotaen')
      .select('numnotaent').order('numnotaent',{ascending:true})
    const ids = (data||[]).map(r=>r.numnotaent)
    setAllIds(ids); allIdsRef.current = ids
    if (ids.length > 0) {
      const pos = ids.length-1
      navPosRef.current = pos
      setNavPos(pos)
      await cargarDoc(ids[pos], ids)
    } else {
      await prepararNueva()
    }
    setBusy(false)
  }

  async function siguienteConsecutivo() {
    const {data,error} = await supabase.rpc('siguiente_nota')
    if (!error && data) return String(data)
    const {data:d2} = await supabase.from('encnotaen')
      .select('numnotaent').order('numnotaent',{ascending:false}).limit(1)
    return String(d2?.length ? Number(d2[0].numnotaent)+1 : 1)
  }

  async function prepararNueva() {
    const nro = await siguienteConsecutivo()
    setNroDoc(nro)
    setFecha(hoy()); setFechaPago(hoy())
    setPlazo('CONTADO'); setMedio('Efectivo')
    setPDesc(0); setPIva(0); setTipoVta('Mayor')
    setCedula(''); setCliTxt(''); setCliente(null)
    setCedVend(''); setVendedor(null)
    setLineas(FILAS()); setAbonos(0)
    setMsg(null); setNavPos(null); navPosRef.current=null
    setGuardada(false); setAnulada(false); setModoNueva(true)
    setTimeout(()=>cedulaRef.current?.focus(), 100)
  }

  async function nuevaNota() {
    if (modoNueva && (cliente||cliTxt||lineas.some(l=>l.codartic))) {
      if (!window.confirm('¿Descartar cambios sin guardar?')) return
    }
    await prepararNueva()
  }

  // ── CLIENTE ──
  async function onCedulaEnter() {
    const ced = cedula.trim()
    if (!ced) { setModal('buscarCliente'); return }
    setBusy(true)
    const {data} = await supabase.from('clientes').select('*').eq('cedula',ced).limit(1)
    setBusy(false)
    if (data&&data.length>0) { aplicarCliente(data[0]) }
    else {
      setMsg({tipo:'warn',texto:`Cédula "${ced}" no encontrada. Usa 🔍 para buscar.`})
      setCliTxt(''); setCliente(null)
    }
  }

  function aplicarCliente(c) {
    setCliente(c); setCedula(c.cedula||String(c.id)); setCliTxt(c.nombre); setMsg(null)
  }

  function onClienteEditado(c) {
    setCliente(c); setCliTxt(c.nombre); setModal(null)
    setMsg({tipo:'ok',texto:'Cliente actualizado.'})
  }

  // ── VENDEDOR ──
  function elegirVendedor(cedSel) {
    const v = listaVend.find(x=>x.cedula===cedSel)||null
    setCedVend(cedSel); setVendedor(v)
  }

  // ── ARTÍCULOS ──
  function precioSegunTipo(art) {
    if (tipoVta==='Detal')    return art.preciovend||0
    if (tipoVta==='Vendedor') return art.preciovenv||0
    return art.preciovent||0
  }

  async function buscarArt(txt, idx) {
    setLineas(prev=>{const n=[...prev];n[idx]={...n[idx],codartic:txt};return n})
    if (txt.length<2){setArtSugg([]);setArtIdx(null);return}
    const {data} = await supabase.from('articomp')
      .select('codartic,descartic,talla,preciovent,preciovend,preciovenv,porciva')
      .ilike('codartic',`%${txt}%`).limit(10)
    setArtSugg(data||[]); setArtIdx(idx)
  }

  async function onCodigoEnter(txt, idx) {
    if (!txt||txt.length<1) return
    const {data} = await supabase.from('articomp')
      .select('codartic,descartic,talla,preciovent,preciovend,preciovenv,porciva')
      .eq('codartic',txt).limit(5)
    if (data&&data.length===1) { elegirArt(data[0],idx) }
    else if (data&&data.length>1) { setArtSugg(data); setArtIdx(idx) }
    else { setMsg({tipo:'warn',texto:`Artículo "${txt}" no encontrado.`}) }
  }

  async function buscarDesc(txt, idx) {
    setLineas(prev=>{const n=[...prev];n[idx]={...n[idx],descartic:txt};return n})
    if (txt.length<2){setArtSugg([]);setArtIdx(null);return}
    const {data} = await supabase.from('articomp')
      .select('codartic,descartic,talla,preciovent,preciovend,preciovenv,porciva')
      .ilike('descartic',`%${txt}%`).limit(10)
    setArtSugg(data||[]); setArtIdx(idx)
  }

  function elegirArt(art, idx) {
    setLineas(prev => {
      const sig = [...prev]
      const existeIdx = sig.findIndex((l,i)=>i!==idx&&l.codartic===art.codartic&&l.talla===art.talla)
      if (existeIdx>=0) {
        sig[existeIdx]=recalc({...sig[existeIdx],cantidad:Number(sig[existeIdx].cantidad||0)+1})
        sig[idx]={...VACIA}
      } else {
        sig[idx]=recalc({...sig[idx],codartic:art.codartic,descartic:art.descartic,
          talla:art.talla||'',valunit:precioSegunTipo(art),porciva:art.porciva||0,cantidad:1})
        if (idx===sig.length-1) sig.push({...VACIA})
      }
      return sig
    })
    setArtSugg([]); setArtIdx(null)
  }

  function recalc(lin) {
    const cant=Number(lin.cantidad)||0
    const sub=cant*(Number(lin.valunit)||0)
    const dcto=sub*((Number(lin.porcdescue)||0)/100)
    const base=sub-dcto
    const iva=base*((Number(lin.porciva)||0)/100)
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

  // ── TOTALES ──
  const detValidas = lineas.filter(l=>l.codartic&&Number(l.cantidad)>0)
  const subtotal   = detValidas.reduce((s,l)=>s+(Number(l.cantidad)||0)*(Number(l.valunit)||0),0)
  const totDcto    = detValidas.reduce((s,l)=>s+(l.valdescue||0),0)
  const totIva     = detValidas.reduce((s,l)=>s+(l.valiva||0),0)
  const total      = detValidas.reduce((s,l)=>s+(l.valtotal||0),0)
  const saldo      = total-abonos
  const prendas    = detValidas.reduce((s,l)=>s+(Number(l.cantidad)||0),0)

  // ── CARGAR NOTA ──
  async function cargarDoc(id, idsParam) {
    setBusy(true); setMsg(null)
    const {data:enc} = await supabase.from('encnotaen').select('*').eq('numnotaent',id).limit(1)
    if (!enc||!enc.length){setBusy(false);return}
    const e=enc[0]
    const ids=idsParam||allIdsRef.current
    const pos=ids.indexOf(id)
    setNavPos(pos); navPosRef.current=pos
    setNroDoc(e.numnotaent)
    setFecha(e.fechanotae?.slice(0,10)||hoy())
    setFechaPago(e.fechavence?.slice(0,10)||hoy())
    setPlazo(e.formapago||'CONTADO'); setMedio(e.mediopago||'Efectivo')
    setPDesc(e.porcdescue||0); setPIva(e.porciva||0)
    setCedula(e.cedrifclie||''); setCedVend(e.cedvended||'')
    setVendedor(listaVend.find(v=>v.cedula===e.cedvended)||null)
    const {data:cli} = await supabase.from('clientes').select('*').eq('id',e.codclient).limit(1)
    setCliente(cli&&cli.length?cli[0]:null)
    setCliTxt(cli&&cli.length?cli[0].nombre:e.nombreclie||'')
    const {data:det} = await supabase.from('detnotaen').select('*').eq('numnotaent',id)
    const extras=Math.max(0,FILAS_BASE-(det?.length||0))
    setLineas(det?.length?[...det,...Array.from({length:extras},()=>({...VACIA}))]:FILAS())
    const {data:ab} = await supabase.from('detabonos').select('valabono').eq('numnotaent',id)
    setAbonos((ab||[]).reduce((s,r)=>s+(r.valabono||0),0))
    setGuardada(true); setAnulada(e.anulada==='S'); setModoNueva(false)
    setBusy(false)
  }

  async function recargarIds() {
    const {data}=await supabase.from('encnotaen').select('numnotaent').order('numnotaent',{ascending:true})
    const ids=(data||[]).map(r=>r.numnotaent)
    setAllIds(ids); allIdsRef.current=ids; return ids
  }

  // ── NAVEGACIÓN con refs para evitar stale closures ──
  function navPrimero() {
    const ids=allIdsRef.current
    if(!ids.length) return
    navPosRef.current=0; setNavPos(0); cargarDoc(ids[0])
  }
  function navAnterior() {
    const ids=allIdsRef.current; const pos=navPosRef.current
    if(pos===null||pos<=0) return
    const np=pos-1; navPosRef.current=np; setNavPos(np); cargarDoc(ids[np])
  }
  function navSiguiente() {
    const ids=allIdsRef.current; const pos=navPosRef.current
    if(pos===null||pos>=ids.length-1) return
    const np=pos+1; navPosRef.current=np; setNavPos(np); cargarDoc(ids[np])
  }
  function navUltimo() {
    const ids=allIdsRef.current
    if(!ids.length) return
    const np=ids.length-1; navPosRef.current=np; setNavPos(np); cargarDoc(ids[np])
  }

  // ── GUARDAR ──
  async function guardar() {
    if (!cliente&&!cliTxt.trim()){setMsg({tipo:'err',texto:'Ingresa un cliente antes de guardar.'}); return}
    if (!detValidas.length){setMsg({tipo:'err',texto:'Agrega al menos un artículo con cantidad.'}); return}
    setBusy(true)
    try {
      const enc={
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
          numnotaent:nroDoc,codartic:l.codartic,descartic:l.descartic,
          talla:l.talla,cantidad:Number(l.cantidad),valunit:Number(l.valunit),
          subtotal:Number(l.cantidad)*Number(l.valunit),
          porciva:l.porciva,valiva:l.valiva,
          porcdescue:l.porcdescue,valdescue:l.valdescue,valtotal:l.valtotal,
        }))
      )
      if(e2)throw e2
      setGuardada(true); setModoNueva(false)
      setMsg({tipo:'ok',texto:`✅ Nota ${nroDoc} guardada.`})
      const ids=await recargarIds()
      const pos=ids.indexOf(nroDoc)
      setNavPos(pos); navPosRef.current=pos
    } catch(e){setMsg({tipo:'err',texto:`❌ ${e.message}`})}
    setBusy(false)
  }

  // ── ANULAR ──
  async function anularNota() {
    if (!guardada){setMsg({tipo:'warn',texto:'Guarda la nota primero.'}); return}
    if (anulada){setMsg({tipo:'warn',texto:'Esta nota ya está anulada.'}); return}
    const motivo=window.prompt('Motivo de anulación (opcional):')
    if (motivo===null) return
    setBusy(true)
    const {error}=await supabase.from('encnotaen').update({
      anulada:'S',fechaanula:hoy(),motivoanula:motivo||'Anulada'
    }).eq('numnotaent',nroDoc)
    if(error){setMsg({tipo:'err',texto:`❌ ${error.message}`})}
    else{setAnulada(true);setMsg({tipo:'ok',texto:`Nota ${nroDoc} anulada.`})}
    setBusy(false)
  }

  const dataNota={nroDoc,fecha,fechaPago,plazo,medio,cliente,cliTxt,cedula,vendedor,cedVend,lineas:detValidas,subtotal,totDcto,totIva,total,saldo,prendas,abonos}

  // ── RENDER ──
  return (
    <div style={P.pagina}>
      {modal==='abonos'        && <ModalAbonos        supabase={supabase} nroDoc={nroDoc} totalNota={total} totalAbonos={abonos} guardada={guardada} onClose={()=>{setModal(null);if(guardada)cargarDoc(nroDoc)}}/>}
      {modal==='resumen'       && <ModalResumen       supabase={supabase} onSelect={id=>{setModal(null);cargarDoc(id)}} onClose={()=>setModal(null)}/>}
      {modal==='detalle'       && <ModalDetalle       nroDoc={nroDoc} lineas={detValidas} onClose={()=>setModal(null)}/>}
      {modal==='print'         && <PrintNota          datos={dataNota} onClose={()=>setModal(null)}/>}
      {modal==='buscarCliente' && <ModalBuscarCliente supabase={supabase} onSelect={c=>{aplicarCliente(c);setModal(null)}} onClose={()=>setModal(null)}/>}
      {modal==='editarCliente' && <ModalEditarCliente supabase={supabase} cliente={cliente} onGuardar={onClienteEditado} onClose={()=>setModal(null)}/>}

      <div style={P.ventana}>
        {/* ── TÍTULO ── */}
        <div style={P.titulo}>
          <img src={LOGO} alt="ATM" style={{height:36,filter:'brightness(0) invert(1)',marginRight:12}}/>
          <span style={P.titTxt}>NOTA DE ENTREGA</span>
          <div style={P.titNro}>
            N° <strong style={{fontSize:20}}>{nroDoc}</strong>
            {modoNueva && <span style={P.badgeN}>NUEVA</span>}
            {anulada   && <span style={P.badgeA}>ANULADA</span>}
          </div>
        </div>

        {/* ── MENSAJE ── */}
        {msg && (
          <div style={{...P.alerta,
            background:msg.tipo==='ok'?'#e8f5e9':msg.tipo==='warn'?'#fff8e1':'#ffebee',
            color:msg.tipo==='ok'?'#2e7d32':msg.tipo==='warn'?'#e65100':'#c62828',
            border:`1px solid ${msg.tipo==='ok'?'#a5d6a7':msg.tipo==='warn'?'#ffe082':'#ef9a9a'}`}}>
            {msg.texto}<button onClick={()=>setMsg(null)} style={P.alertaX}>✕</button>
          </div>
        )}

        {/* ── ENCABEZADO ── */}
        <div style={P.enc}>
          {/* FILA 1: NRO DOC | CLIENTE | NOMBRE | EMPRESA */}
          <div style={P.fila}>
            <Campo label="NRO. DOC" w={100}>
              <input style={{...P.inp,color:'#c0392b',fontWeight:900,fontSize:15}} value={nroDoc} readOnly/>
            </Campo>
            <Campo label="CLIENTE" w={120}>
              <div style={{display:'flex',gap:3}}>
                <input style={{...P.inp,flex:1,fontWeight:700}} value={cedula}
                  ref={cedulaRef}
                  onChange={e=>setCedula(e.target.value)}
                  onKeyDown={e=>e.key==='Enter'&&onCedulaEnter()}
                  placeholder="Cédula…" disabled={anulada}/>
                <button onClick={()=>setModal('buscarCliente')}
                  style={{...P.inp,width:28,padding:0,cursor:'pointer',textAlign:'center',flexShrink:0,background:'#eef2ff'}}>🔍</button>
              </div>
            </Campo>
            <Campo label="NOMBRE / RAZÓN SOCIAL" w={320}>
              <div style={{display:'flex',gap:3}}>
                <input style={{...P.inp,flex:1}} value={cliTxt}
                  onChange={e=>setCliTxt(e.target.value)} disabled={anulada}/>
                {cliente&&<button onClick={()=>setModal('editarCliente')}
                  style={{...P.inp,width:28,padding:0,cursor:'pointer',textAlign:'center',flexShrink:0,background:'#fff3cd'}}>✎</button>}
              </div>
            </Campo>
            <Campo label="EMPRESA" w={200}>
              <input style={{...P.inp,...P.ro}} value={cliente?.nom_empresa||''} readOnly/>
            </Campo>
          </div>

          {/* FILA 2: DIRECCIÓN | CELULAR | CIUDAD | DEPTO */}
          <div style={P.fila}>
            <Campo label="DIRECCIÓN" w={260}>
              <input style={{...P.inp,...P.ro}} value={cliente?.direccion||''} readOnly/>
            </Campo>
            <Campo label="CELULAR" w={130}>
              <input style={{...P.inp,...P.ro}} value={cliente?.celular||''} readOnly/>
            </Campo>
            <Campo label="CIUDAD" w={150}>
              <input style={{...P.inp,...P.ro}} value={cliente?.ciudad||''} readOnly/>
            </Campo>
            <Campo label="DEPTO." w={130}>
              <input style={{...P.inp,...P.ro}} value={cliente?.departamento||''} readOnly/>
            </Campo>
          </div>

          {/* FILA 3: FECHA | PLAZO | FECHA PAGO | % DESCTO | % IVA */}
          <div style={P.fila}>
            <Campo label="FECHA" w={140}>
              <input type="date" style={P.inp} value={fecha} onChange={e=>setFecha(e.target.value)} disabled={anulada}/>
            </Campo>
            <Campo label="PLAZO PAGO" w={150}>
              <select style={P.inp} value={plazo} onChange={e=>setPlazo(e.target.value)} disabled={anulada}>
                {PLAZOS.map(p=><option key={p}>{p}</option>)}
              </select>
            </Campo>
            <Campo label="FECHA PAGO" w={140}>
              <input type="date" style={P.inp} value={fechaPago} onChange={e=>setFechaPago(e.target.value)} disabled={anulada}/>
            </Campo>
            <Campo label="% DESCTO." w={100}>
              <input type="number" style={P.inp} value={pDesc} min={0} max={100} onChange={e=>setPDesc(Number(e.target.value))} disabled={anulada}/>
            </Campo>
            <Campo label="% IVA." w={90}>
              <input type="number" style={P.inp} value={pIva} min={0} max={100} onChange={e=>setPIva(Number(e.target.value))} disabled={anulada}/>
            </Campo>
          </div>

          {/* FILA 4: TIPO VENTA | VENDEDOR | NOMBRE VENDEDOR */}
          <div style={{...P.fila,alignItems:'center'}}>
            {['Mayor','Detal','Vendedor'].map(t=>(
              <label key={t} style={P.radio}>
                <input type="radio" name="tipo" checked={tipoVta===t} onChange={()=>setTipoVta(t)} disabled={anulada}/>{' '}{t}
              </label>
            ))}
            <Campo label="CED. VENDEDOR" w={120}>
              <select style={{...P.inp,cursor:'pointer'}} value={cedVend}
                onChange={e=>elegirVendedor(e.target.value)} disabled={anulada}>
                <option value="">--</option>
                {listaVend.map(v=><option key={v.id} value={v.cedula}>{v.cedula}</option>)}
              </select>
            </Campo>
            <Campo label="NOMBRE" w={200}>
              <input style={{...P.inp,...P.ro}} value={vendedor?.nombre||''} readOnly/>
            </Campo>
          </div>
        </div>

        {/* ── TABLA ARTÍCULOS ── */}
        <div style={{margin:'0 10px 6px'}}>
          <div style={P.tablaWrap}>
            <table style={P.tabla}>
              <thead>
                <tr style={P.thead}>
                  {['#','COD. ARTIC','DESCRIPCIÓN','TALLA','CANTIDAD','$ UNIDAD','% IVA','$ IVA','% DCTO.','$ DCTO.','$ TOTAL',''].map(h=>(
                    <th key={h} style={P.th}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {lineas.map((l,i)=>(
                  <tr key={i} style={{background:i%2===0?'#fff':'#f5f7fc'}}>
                    <td style={{...P.td,textAlign:'center',color:'#bbb',width:24,fontSize:11}}>{l.codartic?i+1:''}</td>
                    <td style={P.td}>
                      <div style={{position:'relative'}}>
                        <input style={{...P.ci,width:84}} value={l.codartic}
                          onChange={e=>buscarArt(e.target.value,i)}
                          onKeyDown={e=>e.key==='Enter'&&onCodigoEnter(l.codartic,i)}
                          disabled={anulada}/>
                        {artIdx===i&&artSugg.length>0&&(
                          <ul style={{...P.drop,width:440,zIndex:99}}>
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
                        onChange={e=>buscarDesc(e.target.value,i)} disabled={anulada}/>
                    </td>
                    <td style={P.td}><input style={{...P.ci,width:44,textAlign:'center'}} value={l.talla} onChange={e=>upd(i,{talla:e.target.value})} disabled={anulada}/></td>
                    <td style={P.td}><input type="number" style={{...P.ci,width:58,textAlign:'right',fontWeight:700}} value={l.cantidad} min={0} onChange={e=>upd(i,{cantidad:e.target.value})} disabled={anulada}/></td>
                    <td style={P.td}><input type="number" style={{...P.ci,width:90,textAlign:'right'}} value={l.valunit} min={0} onChange={e=>upd(i,{valunit:Number(e.target.value)})} disabled={anulada}/></td>
                    <td style={P.td}><input type="number" style={{...P.ci,width:44,textAlign:'right'}} value={l.porciva} min={0} onChange={e=>upd(i,{porciva:Number(e.target.value)})} disabled={anulada}/></td>
                    <td style={{...P.td,textAlign:'right',paddingRight:5,color:'#555',fontSize:11}}>{l.valiva?fmt(l.valiva):''}</td>
                    <td style={P.td}><input type="number" style={{...P.ci,width:44,textAlign:'right'}} value={l.porcdescue} min={0} max={100} onChange={e=>upd(i,{porcdescue:Number(e.target.value)})} disabled={anulada}/></td>
                    <td style={{...P.td,textAlign:'right',paddingRight:5,color:'#c0392b',fontSize:11}}>{l.valdescue?fmt(l.valdescue):''}</td>
                    <td style={{...P.td,textAlign:'right',paddingRight:5,fontWeight:700,color:'#1a3a6b',fontSize:12}}>{l.valtotal?fmt(l.valtotal):''}</td>
                    <td style={{...P.td,textAlign:'center',width:24}}>
                      {l.codartic&&!anulada&&<button onClick={()=>quitarLinea(i)} style={P.btnX}>✕</button>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* ── FOOTER — igual al original ── */}
        <div style={P.footer}>
          {/* BOTONES NAVEGACIÓN */}
          <div style={P.footCol}>
            <div style={P.btnFila}>
              <IBtn src={WZTOP}    onClick={navPrimero}   title="Primero"/>
              <IBtn src={WZBACK}   onClick={navAnterior}  title="Anterior"/>
              <IBtn src={WZNEXT}   onClick={navSiguiente} title="Siguiente"/>
              <IBtn src={WZEND}    onClick={navUltimo}    title="Último"/>
              <IBtn src={WZLOCATE} onClick={()=>setModal('resumen')} title="Buscar nota"/>
            </div>
            <div style={P.btnFila}>
              <IBtn src={WZNEW}    onClick={nuevaNota}            title="Nueva nota"  disabled={modoNueva&&!cliente&&!cliTxt&&!lineas.some(l=>l.codartic)}/>
              <IBtn src={WZSAVE}   onClick={guardar}              title="Guardar"     disabled={busy||anulada}/>
              <IBtn src={WZDELETE} onClick={anularNota}           title="Anular"      disabled={anulada||modoNueva}/>
              <IBtn src={WZPRINT}  onClick={()=>setModal('print')}title="Imprimir"/>
              <IBtn src={WZCLOSE}  onClick={onClose}              title="Cerrar"/>
            </div>
          </div>

          {/* TOTALES — igual al original */}
          <div style={P.footCentro}>
            <div style={P.prendas}>
              <span style={{fontWeight:700,color:'#856404',fontSize:13}}>CANTIDAD DE PRENDAS</span>
              <input style={{width:80,textAlign:'right',fontWeight:900,fontSize:16,color:'#856404',border:'1px solid #ffc107',borderRadius:4,padding:'2px 6px',background:'#fff'}} value={prendas} readOnly/>
            </div>
            <div style={P.totalesGrid}>
              <span style={P.tLabel}>$SUB TOTAL</span>
              <span style={P.tLabel}>$ DESCUENTO</span>
              <span style={P.tLabel}>$ IVA</span>
              <span style={P.tVal}>{fmt(subtotal)}</span>
              <span style={{...P.tVal,color:'#c62828'}}>{fmt(totDcto)}</span>
              <span style={P.tVal}>{fmt(totIva)}</span>
              <span style={{...P.tLabel,fontWeight:900,color:'#1a3a6b'}}>$ TOTAL</span>
              <span style={P.tLabel}>$ ABONO</span>
              <span style={{...P.tLabel,color:'#c62828'}}>$ SALDO</span>
              <span style={{...P.tVal,fontWeight:900,color:'#1a3a6b',fontSize:15}}>{fmt(total)}</span>
              <span style={{...P.tVal,color:'#2e7d32'}}>{fmt(abonos)}</span>
              <span style={{...P.tVal,color:saldo>0?'#c62828':'#2e7d32',fontWeight:700,fontSize:14}}>{fmt(saldo)}</span>
            </div>
          </div>

          {/* MEDIO PAGO */}
          <div style={P.footDer}>
            <div style={P.medios}>
              {MEDIOS.map(m=>(
                <label key={m} style={P.radio}>
                  <input type="radio" name="medio" checked={medio===m} onChange={()=>setMedio(m)} disabled={anulada}/>{' '}{m}
                </label>
              ))}
            </div>
            <div style={P.acciones}>
              <BtnAcc onClick={()=>{ if(!guardada){setMsg({tipo:'warn',texto:'Guarda la nota antes de registrar abonos.'}); return} setModal('abonos') }} icon="💵">ABONOS</BtnAcc>
              <BtnAcc onClick={()=>setModal('resumen')} icon="📊">RESUMEN</BtnAcc>
              <BtnAcc onClick={anularNota} icon="↩️" danger>REVERTIR ABONOS</BtnAcc>
              <BtnAcc onClick={()=>setModal('detalle')} icon="🔍">DETALLE</BtnAcc>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function Campo({label,w,children}){
  return(
    <div style={{display:'flex',flexDirection:'column',width:w,flexShrink:0}}>
      <span style={{fontSize:10,fontWeight:800,color:'#1a3a6b',marginBottom:2,textTransform:'uppercase',letterSpacing:0.5}}>{label}</span>
      {children}
    </div>
  )
}
function IBtn({src,onClick,title,disabled}){
  return(
    <button onClick={onClick} title={title} disabled={disabled}
      style={{background:disabled?'#e8ecf5':'#eef2ff',border:'1px solid #c8d5ea',borderRadius:5,padding:3,
        cursor:disabled?'not-allowed':'pointer',opacity:disabled?0.4:1,
        display:'flex',alignItems:'center',justifyContent:'center',width:42,height:38,
        boxShadow:disabled?'none':'0 1px 3px rgba(0,0,0,0.1)'}}>
      <img src={src} alt={title} style={{width:28,height:28,objectFit:'contain',opacity:disabled?0.3:1}}/>
    </button>
  )
}
function BtnAcc({onClick,icon,children,danger}){
  return(
    <button onClick={onClick}
      style={{background:danger?'#e74c3c':'#eef2ff',border:`1px solid ${danger?'#c0392b':'#c8d5ea'}`,
        borderRadius:6,padding:'5px 8px',cursor:'pointer',fontSize:11,fontWeight:700,
        color:danger?'#fff':'#1a3a6b',display:'flex',alignItems:'center',gap:4,whiteSpace:'nowrap'}}>
      <span>{icon}</span>{children}
    </button>
  )
}

const P={
  pagina:     {minHeight:'100vh',background:'#d6dce8',padding:10},
  ventana:    {background:'#eef1f7',borderRadius:8,border:'2px solid #8fa4c8',boxShadow:'0 4px 20px rgba(0,0,0,0.2)',maxWidth:1200,margin:'0 auto',overflow:'hidden'},
  titulo:     {background:'linear-gradient(90deg,#1a3a6b,#2c5fa8)',color:'#fff',padding:'8px 14px',display:'flex',alignItems:'center'},
  titTxt:     {fontWeight:900,fontSize:15,letterSpacing:2,flex:1,textAlign:'center'},
  titNro:     {background:'rgba(255,255,255,0.2)',borderRadius:5,padding:'4px 12px',fontSize:13,display:'flex',alignItems:'center',gap:6},
  badgeN:     {fontSize:10,background:'rgba(255,255,255,0.3)',borderRadius:3,padding:'1px 5px'},
  badgeA:     {fontSize:10,background:'#e74c3c',borderRadius:3,padding:'1px 5px'},
  alerta:     {margin:'5px 10px',padding:'7px 12px',borderRadius:5,fontSize:12,display:'flex',justifyContent:'space-between',alignItems:'center'},
  alertaX:    {background:'none',border:'none',cursor:'pointer',fontWeight:900,fontSize:14},
  enc:        {margin:'6px 10px',background:'#fff',borderRadius:6,border:'1px solid #c8d5ea',padding:'10px 12px',display:'flex',flexDirection:'column',gap:7},
  fila:       {display:'flex',flexWrap:'wrap',gap:8,alignItems:'flex-end'},
  inp:        {height:26,border:'1px solid #aab8d4',borderRadius:3,padding:'0 6px',fontSize:12,background:'#fff',outline:'none',width:'100%',color:'#1a3a6b'},
  ro:         {background:'#f0f4ff',color:'#555'},
  radio:      {display:'flex',alignItems:'center',gap:3,fontSize:12,cursor:'pointer',fontWeight:600,color:'#1a3a6b',marginRight:10},
  drop:       {position:'absolute',top:'100%',left:0,background:'#fff',border:'1px solid #aab8d4',borderRadius:4,listStyle:'none',margin:0,padding:0,zIndex:50,boxShadow:'0 6px 20px rgba(0,0,0,0.15)',maxHeight:240,overflowY:'auto',minWidth:260},
  dropItem:   {padding:'6px 12px',cursor:'pointer',borderBottom:'1px solid #f0f0f0',fontSize:12},
  tablaWrap:  {overflowX:'auto',borderRadius:4,border:'1px solid #c8d5ea',maxHeight:290,overflowY:'auto'},
  tabla:      {width:'100%',borderCollapse:'collapse',fontSize:11},
  thead:      {background:'#dde3ee',position:'sticky',top:0,zIndex:2},
  th:         {padding:'5px 6px',textAlign:'center',fontWeight:700,color:'#1a3a6b',borderRight:'1px solid #c8d5ea',whiteSpace:'nowrap',fontSize:11},
  td:         {padding:'2px 3px',borderRight:'1px solid #dde3ee',borderBottom:'1px solid #dde3ee',verticalAlign:'middle'},
  ci:         {border:'none',background:'transparent',fontSize:11,padding:'2px 3px',outline:'none',color:'#1a3a6b',height:24},
  btnX:       {background:'none',border:'none',color:'#c0392b',cursor:'pointer',fontSize:11,fontWeight:700},
  footer:     {display:'flex',gap:10,flexWrap:'wrap',padding:'8px 10px',background:'#dde3ee',borderTop:'2px solid #8fa4c8',alignItems:'flex-start'},
  footCol:    {display:'flex',flexDirection:'column',gap:5},
  btnFila:    {display:'flex',gap:3},
  footCentro: {flex:1,display:'flex',flexDirection:'column',gap:4},
  prendas:    {display:'flex',justifyContent:'space-between',alignItems:'center',background:'#fff3cd',border:'1px solid #ffc107',borderRadius:4,padding:'3px 10px'},
  totalesGrid:{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:'1px 6px',background:'#fff',border:'1px solid #aab8d4',borderRadius:4,padding:'5px 10px'},
  tLabel:     {fontSize:11,color:'#1a3a6b',fontWeight:600,textAlign:'center'},
  tVal:       {fontSize:12,textAlign:'right',fontVariantNumeric:'tabular-nums',fontWeight:600,color:'#333'},
  footDer:    {display:'flex',flexDirection:'column',gap:5},
  medios:     {display:'flex',flexDirection:'column',gap:4,background:'#fff',border:'1px solid #aab8d4',borderRadius:4,padding:'6px 10px'},
  acciones:   {display:'grid',gridTemplateColumns:'1fr 1fr',gap:3},
}
