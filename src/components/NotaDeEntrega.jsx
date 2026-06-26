import { useState, useEffect, useRef } from 'react'
import { LOGO, WZNEW, WZSAVE, WZDELETE, WZPRINT, WZCLOSE, WZTOP, WZBACK, WZNEXT, WZEND, WZLOCATE, WZUNDO } from '../lib/assets'
import ModalAbonos        from './ModalAbonos'
import ModalBuscarNota    from './ModalBuscarNota'
import ModalDetalle       from './ModalDetalle'
import PrintNota          from './PrintNota'
import ModalBuscarCliente from './ModalBuscarCliente'
import ModalEditarCliente from './ModalEditarCliente'
import ModalNuevoCliente  from './ModalNuevoCliente'
import ModalPin           from './ModalPin'
import ModalDevolucion    from './ModalDevolucion'
import ModalVale          from './ModalVale'

const fmt = n => Number(n||0).toLocaleString('es-CO',{minimumFractionDigits:2,maximumFractionDigits:2})
const hoy = () => { const d=new Date(); return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0') }
const VACIA = {codartic:'',descartic:'',talla:'',cantidad:0,valunit:0,porciva:0,valiva:0,porcdescue:0,valdescue:0,valtotal:0}
const FILAS_BASE = 12
const FILAS = () => Array.from({length:FILAS_BASE},()=>({...VACIA}))
const PLAZOS = ['CONTADO','15 DÍAS','30 DÍAS','60 DÍAS','90 DÍAS']
const MEDIOS = ['Efectivo','Transferencia','Mixto','Crédito']
const diasDePlazo = p => { const m=p.match(/(\d+)/); return m?Number(m[1]):0 }
const fechaDePago = plazo => {
  const d = new Date(); d.setDate(d.getDate() + diasDePlazo(plazo))
  return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0')
}

export default function NotaDeEntrega({ supabase, usuario, onClose }) {
  const [nroDoc,    setNroDoc]    = useState('')
  const [fecha,     setFecha]     = useState(hoy())
  const [fechaPago, setFechaPago] = useState(hoy())
  const [plazo,     setPlazo]     = useState('CONTADO')
  const [pDesc,     setPDesc]     = useState(0)
  const [pIva,      setPIva]      = useState(0)
  const [tipoVta,   setTipoVta]   = useState('Mayor')
  const [medio,     setMedio]     = useState('Efectivo')
  const [serieSel,   setSerieSel]  = useState('caja')
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
  const [totalNotas, setTotalNotas] = useState(0)
  const [busy,      setBusy]      = useState(false)
  const [msg,       setMsg]       = useState(null)
  const [modal,     setModal]     = useState(null)
  const [guardada,     setGuardada]     = useState(false)
  const [anulada,      setAnulada]      = useState(false)
  const [modoNueva,    setModoNueva]    = useState(false)
  const [desbloqueada, setDesbloqueada] = useState(false) // nota guardada editando con PIN
  // cédula que no se encontró — para pasarla al modal de nuevo cliente
  const [cedulaNueva, setCedulaNueva] = useState('')
  const [devolverIdx, setDevolverIdx] = useState(null) // índice de línea seleccionada para devolver

  const cedulaRef  = useRef()
  const inputRefs  = useRef({})   // refs a cada input de código por fila
  const debounceRef = useRef(null) // timer para búsqueda manual

  useEffect(() => {
    supabase.from('vendedores').select('id,cedula,nombre').order('nombre')
      .then(({data}) => { if(data) setListaVend(data) })
  }, [])

  useEffect(() => { init() }, [])

  async function init() {
    setBusy(true)
    const rol = usuario?.rol || ''
    // cajera ve solo notas de caja (>=1.000.000), vendedor solo las suyas (<1.000.000)
    let qCount = supabase.from('encnotaen').select('numnotaent',{count:'exact',head:true})
    if (rol==='cajera')   qCount = qCount.gte('numnotaent',1000000)
    if (rol==='vendedor') qCount = qCount.lt('numnotaent',1000000)
    const {count} = await qCount
    setTotalNotas(count||0)
    if ((count||0) > 0) {
      // SIEMPRE cargar la ÚLTIMA nota (descending)
      let qLast = supabase.from('encnotaen').select('numnotaent').order('numnotaent',{ascending:false}).limit(1)
      if (rol==='cajera')   qLast = qLast.gte('numnotaent',1000000)
      if (rol==='vendedor') qLast = qLast.lt('numnotaent',1000000)
      const {data} = await qLast
      if (data?.length) await cargarDoc(data[0].numnotaent)
    } else {
      await prepararNueva(serieParaUsuario(serieSel))
    }
    setBusy(false)
  }

  function serieParaUsuario(override) {
    const rol = usuario?.rol || ''
    if (rol === 'vendedor') return 'vendedor'
    if (rol === 'cajera')   return 'caja'
    return override || 'caja' // admin usa lo que eligió
  }

  async function siguienteConsecutivo(serie) {
    const {data,error} = await supabase.rpc('siguiente_nota', {p_tipo: serie})
    if (!error && data) return String(data)
    // fallback de emergencia
    const {data:d2} = await supabase.from('encnotaen')
      .select('numnotaent').order('numnotaent',{ascending:false}).limit(1)
    return String(d2?.length ? Number(d2[0].numnotaent)+1 : 1)
  }

  async function prepararNueva(serieElegida) {
    const serie = serieParaUsuario(serieElegida)
    const nro = await siguienteConsecutivo(serie)
    setNroDoc(nro)
    setFecha(hoy()); setFechaPago(hoy())
    setPlazo('CONTADO'); setMedio('Efectivo')
    setPDesc(0); setPIva(0); setTipoVta('Mayor')
    setCedula(''); setCliTxt(''); setCliente(null)
    setCedVend(''); setVendedor(null)
    setLineas(FILAS()); setAbonos(0)
    setMsg(null)
    setGuardada(false); setAnulada(false); setModoNueva(true)
    setTimeout(()=>cedulaRef.current?.focus(), 100)
  }

  async function nuevaNota(serieElegida) {
    if (modoNueva && (cliente || cliTxt || lineas.some(l=>l.codartic))) {
      if (!window.confirm('¿Descartar los cambios sin guardar?')) return
    }
    await prepararNueva(serieElegida)
  }

  async function revertirNueva() {
    if (!modoNueva) return
    const {data} = await supabase.from('encnotaen')
      .select('numnotaent').order('numnotaent',{ascending:false}).limit(1)
    if (data?.length) await cargarDoc(data[0].numnotaent)
    else setMsg({tipo:'warn',texto:'No hay notas guardadas a las cuales volver.'})
  }

  // ── CLIENTE: si no existe, abre modal para crear ──
  async function onCedulaEnter() {
    const ced = cedula.trim()
    if (!ced) { setModal('buscarCliente'); return }
    setBusy(true)
    const {data} = await supabase.from('clientes').select('*').eq('cedula', ced).limit(1)
    setBusy(false)
    if (data && data.length > 0) {
      aplicarCliente(data[0])
    } else {
      // cédula no encontrada → abrir modal para crear cliente nuevo
      setCedulaNueva(ced)
      setModal('nuevoCliente')
    }
  }

  function aplicarCliente(c) {
    setCliente(c)
    setCedula(c.cedula || String(c.id))
    setCliTxt(c.nombre)
    setMsg(null)
  }

  // se llama cuando ModalNuevoCliente guarda exitosamente
  function onClienteCreado(c) {
    aplicarCliente(c)
    setModal(null)
    setMsg({tipo:'ok', texto:`✅ Cliente "${c.nombre}" creado y aplicado a la nota.`})
  }

  function onClienteEditado(c) {
    setCliente(c); setCliTxt(c.nombre); setModal(null)
    setMsg({tipo:'ok',texto:'Cliente actualizado.'})
  }

  function elegirVendedor(cedSel) {
    const v = listaVend.find(x=>x.cedula===cedSel)||null
    setCedVend(cedSel); setVendedor(v)
  }

  function precioSegunTipo(art) {
    if (tipoVta==='Detal')    return art.preciovend||0
    if (tipoVta==='Vendedor') return art.preciovenv||0
    return art.preciovent||0
  }

  // Extrae el código del artículo del código de barras (quita ceros a la izquierda)
  const extraerCodigo = str => {
    const num = parseInt(str, 10)
    return isNaN(num) ? str.trim() : String(num)
  }

  // Foco en el input de código de la fila idx
  function focoEnCodigo(idx) {
    setTimeout(() => {
      const ref = inputRefs.current[idx]
      if (ref) { ref.focus(); ref.select() }
    }, 50)
  }

  // Foco en el input de cantidad de la fila idx
  function focoEnCantidad(idx) {
    setTimeout(() => {
      const row = inputRefs.current[idx]?.closest('tr')
      if (row) {
        const inputs = row.querySelectorAll('input')
        inputs[3]?.focus() // índice 3 = cantidad (cod, desc, talla, cant...)
        inputs[3]?.select()
      }
    }, 50)
  }

  // Procesa un código ingresado (pistola o manual con Enter)
  async function procesarCodigo(txt, idx) {
    if (!txt.trim()) return
    const cod = extraerCodigo(txt)
    // Buscar exacto en articomp
    const {data} = await supabase.from('articomp')
      .select('codartic,descartic,talla,marca,genero,preciovent,preciovend,preciovenv,porciva')
      .eq('codartic', cod).limit(10)

    if (!data || !data.length) {
      // No encontrado → mostrar error en la línea y limpiar
      setLineas(prev => { const n=[...prev]; n[idx]={...n[idx],codartic:txt}; return n })
      setMsg({tipo:'err', texto:`❌ Código "${cod}" no encontrado.`})
      focoEnCodigo(idx)
      return
    }

    if (data.length === 1) {
      // Exacto único → agregar/sumar y bajar al siguiente código (modo pistola)
      elegirArtPistola(data[0], idx)
    } else {
      // Varias tallas → mostrar dropdown para elegir
      setLineas(prev => { const n=[...prev]; n[idx]={...n[idx],codartic:cod}; return n })
      setArtSugg(data); setArtIdx(idx)
    }
  }

  // onChange del campo código: actualiza texto, NO busca todavía
  function onChangeCodigo(txt, idx) {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    setArtSugg([]); setArtIdx(null)
    setLineas(prev => { const n=[...prev]; n[idx]={...n[idx],codartic:txt}; return n })
  }

  // Enter en campo código → procesar inmediatamente (pistola o manual)
  async function onEnterCodigo(txt, idx) {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    setArtSugg([]); setArtIdx(null)
    await procesarCodigo(txt, idx)
  }

  // Elegir artículo con pistola: suma si ya existe, agrega si no, baja al siguiente código
  function elegirArtPistola(art, idx) {
    let targetIdx = idx
    setLineas(prev => {
      const sig = [...prev]
      const cod = art.codartic
      const existeIdx = sig.findIndex((l,i) => l.codartic===cod && l.talla===art.talla)
      if (existeIdx >= 0) {
        // Ya existe → sumar cantidad
        sig[existeIdx] = recalc({...sig[existeIdx], cantidad: Number(sig[existeIdx].cantidad||0)+1})
        sig[idx] = {...VACIA} // limpiar la fila donde se escribió si era diferente
        targetIdx = existeIdx >= idx ? idx : existeIdx
      } else {
        // Nueva línea
        const precio = precioSegunTipo(art)
        sig[idx] = recalc({...sig[idx], codartic:art.codartic, descartic:art.descartic,
          talla:art.talla||'', marca:art.marca||'', genero:art.genero||'',
          valunit:precio, porciva:art.porciva||0, cantidad:1})
        if (idx===sig.length-1) sig.push({...VACIA})
        targetIdx = idx + 1
      }
      return sig
    })
    setArtSugg([]); setArtIdx(null)
    // Bajar al siguiente campo código
    setTimeout(() => focoEnCodigo(targetIdx), 80)
  }

  // Elegir artículo desde dropdown (manual) → foco en cantidad
  function elegirArt(art, idx) {
    setLineas(prev => {
      const sig = [...prev]
      const existeIdx = sig.findIndex((l,i) => i!==idx && l.codartic===art.codartic && l.talla===art.talla)
      if (existeIdx >= 0) {
        sig[existeIdx] = recalc({...sig[existeIdx], cantidad: Number(sig[existeIdx].cantidad||0)+1})
        sig[idx] = {...VACIA}
      } else {
        const precio = precioSegunTipo(art)
        sig[idx] = recalc({...sig[idx], codartic:art.codartic, descartic:art.descartic,
          talla:art.talla||'', marca:art.marca||'', genero:art.genero||'',
          valunit:precio, porciva:art.porciva||0, cantidad:1})
        if (idx===sig.length-1) sig.push({...VACIA})
      }
      return sig
    })
    setArtSugg([]); setArtIdx(null)
    focoEnCantidad(idx) // manual → va a cantidad para editar
  }

  async function buscarDesc(txt, idx) {
    setLineas(prev=>{const n=[...prev];n[idx]={...n[idx],descartic:txt};return n})
    if (txt.length<2){setArtSugg([]);setArtIdx(null);return}
    const {data} = await supabase.from('articomp')
      .select('codartic,descartic,talla,marca,genero,preciovent,preciovend,preciovenv,porciva')
      .ilike('descartic',`%${txt}%`).limit(10)
    setArtSugg(data||[]); setArtIdx(idx)
  }

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

  const detValidas   = lineas.filter(l=>l.codartic&&Number(l.cantidad)>0)
  const subtotal     = detValidas.reduce((s,l)=>s+(Number(l.cantidad)||0)*(Number(l.valunit)||0),0)
  const totDctoLinea = detValidas.reduce((s,l)=>s+(l.valdescue||0),0)
  const dctoGlobal   = subtotal * ((Number(pDesc)||0)/100)
  const totDcto      = totDctoLinea + dctoGlobal
  const baseIva      = subtotal - totDcto
  const totIva       = baseIva * ((Number(pIva)||0)/100)
  const total        = baseIva + totIva
  const saldo        = total - abonos
  const prendas      = detValidas.reduce((s,l)=>s+(Number(l.cantidad)||0),0)

  async function cargarDoc(id) {
    setBusy(true); setMsg(null)
    const {data:enc} = await supabase.from('encnotaen').select('*').eq('numnotaent',id).limit(1)
    if (!enc||!enc.length){setBusy(false);return}
    const e = enc[0]
    setNroDoc(e.numnotaent)
    setFecha(e.fechanotae?.slice(0,10)||hoy())
    setFechaPago(e.fechavence?.slice(0,10)||hoy())
    setPlazo(e.formapago||'CONTADO'); setMedio(e.mediopago||'Efectivo')
    setPDesc(e.porcdescue||0); setPIva(e.porciva||0)
    setCedula(e.cedrifclie||'')
    const cedV = e.cedvended||''
    setCedVend(cedV)
    setVendedor(listaVend.find(v=>v.cedula===cedV)||null)
    const {data:cli} = e.codclient && e.codclient !== '99' && e.codclient !== '9' && e.codclient !== '999'
      ? (await supabase.from('clientes').select('*').eq('id', e.codclient).limit(1)).data
      : null
    setCliente(cli&&cli.length?cli[0]:null)
    setCliTxt(cli&&cli.length?cli[0].nombre:(e.nombreclie||''))
    const {data:det} = await supabase.from('detnotaen').select('*').eq('numnotaent',id)
    const extras = Math.max(0,FILAS_BASE-(det?.length||0))
    setLineas(det?.length?[...det,...Array.from({length:extras},()=>({...VACIA}))]:FILAS())
    const {data:ab} = await supabase.from('detabonos').select('valabono').eq('numnotaent',id)
    setAbonos((ab||[]).reduce((s,r)=>s+(r.valabono||0),0))
    setGuardada(true); setAnulada(e.anulada==='S'); setModoNueva(false); setDesbloqueada(false)
    setBusy(false)
  }

  async function recargarIds() {
    const {count} = await supabase.from('encnotaen')
      .select('numnotaent',{count:'exact',head:true})
    setTotalNotas(count||0)
  }

  async function navPrimero() {
    const {data} = await supabase.from('encnotaen')
      .select('numnotaent').order('numnotaent',{ascending:true}).limit(1)
    if (data?.length) cargarDoc(data[0].numnotaent)
  }
  async function navAnterior() {
    if (!nroDoc) return
    const {data} = await supabase.from('encnotaen')
      .select('numnotaent').lt('numnotaent', nroDoc)
      .order('numnotaent',{ascending:false}).limit(1)
    if (data?.length) cargarDoc(data[0].numnotaent)
    else setMsg({tipo:'warn',texto:'Esta es la primera nota.'})
  }
  async function navSiguiente() {
    if (!nroDoc) return
    const {data} = await supabase.from('encnotaen')
      .select('numnotaent').gt('numnotaent', nroDoc)
      .order('numnotaent',{ascending:true}).limit(1)
    if (data?.length) cargarDoc(data[0].numnotaent)
    else setMsg({tipo:'warn',texto:'Esta es la última nota.'})
  }
  async function navUltimo() {
    const {data} = await supabase.from('encnotaen')
      .select('numnotaent').order('numnotaent',{ascending:false}).limit(1)
    if (data?.length) cargarDoc(data[0].numnotaent)
  }

  async function guardar() {
    if (!cliente&&!cliTxt.trim()){setMsg({tipo:'err',texto:'Ingresa un cliente antes de guardar.'}); return}
    if (!cedVend){setMsg({tipo:'err',texto:'⚠️ Debes seleccionar un vendedor antes de guardar.'}); return}
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
        usuario: usuario?.usuario || usuario?.nombre || 'sistema',
      }
      const {error:e1}=await supabase.from('encnotaen').upsert(enc,{onConflict:'numnotaent'})
      if(e1)throw e1
      const {data:detAnt} = await supabase.from('detnotaen').select('codartic,talla,cantidad').eq('numnotaent',nroDoc)
      const cantAnt = {}
      ;(detAnt||[]).forEach(l=>{ const k=`${l.codartic}|${l.talla}`; cantAnt[k]=(cantAnt[k]||0)+Number(l.cantidad) })
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
      const cantNueva = {}
      detValidas.forEach(l=>{ const k=`${l.codartic}|${l.talla}`; cantNueva[k]=(cantNueva[k]||0)+Number(l.cantidad) })
      const todasKeys = new Set([...Object.keys(cantAnt),...Object.keys(cantNueva)])
      const avisos = []
      for (const k of todasKeys) {
        const [cod,tall] = k.split('|')
        const diff = (cantNueva[k]||0) - (cantAnt[k]||0)
        if (diff===0) continue
        await supabase.rpc('ajustar_inventario', {p_codartic:cod, p_talla:tall, p_cantidad:diff})
        const {data:art} = await supabase.from('articomp')
          .select('existencia').eq('codartic',cod).eq('talla',tall).limit(1)
        if (art&&art.length&&(art[0].existencia||0)<0)
          avisos.push(`${cod} T:${tall} (existencia: ${art[0].existencia})`)
      }
      setGuardada(true); setModoNueva(false)
      const msgBase = `✅ Nota ${nroDoc} guardada.`
      setMsg({tipo:avisos.length?'warn':'ok', texto:avisos.length?`${msgBase} ⚠️ Inventario negativo en: ${avisos.join(', ')}`:msgBase})
      await recargarIds()
    } catch(e){
      setMsg({tipo:'err',texto:`❌ Error: ${e.message}`})
    }
    setBusy(false)
  }

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
    else {
      const {data:det} = await supabase.from('detnotaen').select('codartic,talla,cantidad').eq('numnotaent',nroDoc)
      for (const l of (det||[])) {
        await supabase.rpc('ajustar_inventario', {p_codartic:l.codartic, p_talla:l.talla, p_cantidad:-Number(l.cantidad)})
      }
      setAnulada(true)
      setMsg({tipo:'ok',texto:`Nota ${nroDoc} anulada. Inventario restaurado.`})
    }
    setBusy(false)
  }

  const dataNota={nroDoc,fecha,fechaPago,plazo,medio,cliente,cliTxt,cedula,vendedor,cedVend,lineas:detValidas,subtotal,totDcto,totIva,total,saldo,prendas,abonos}

  // ── DEVOLUCIÓN DE MERCANCÍA (Caso A: sobre nota ya guardada) ──────────
  function abrirDevolucion(idx) {
    const l = lineas[idx]
    if (!l?.codartic || !Number(l.cantidad)) return
    if (!guardada || modoNueva) { setMsg({tipo:'warn',texto:'Guarda la nota antes de registrar una devolución.'}); return }
    if (anulada) { setMsg({tipo:'warn',texto:'Esta nota está anulada.'}); return }
    setDevolverIdx(idx)
  }

  async function procesarDevolucion(cantidadDevuelta) {
    const idx = devolverIdx
    const l = lineas[idx]
    setDevolverIdx(null)
    setBusy(true)
    try {
      const cant = Number(cantidadDevuelta)
      const precioUnitEfectivo = Number(l.valtotal||0) / Number(l.cantidad||1)
      const valorDevolucion = precioUnitEfectivo * cant

      // 1) Restaurar inventario
      await supabase.rpc('ajustar_inventario', {p_codartic:l.codartic, p_talla:l.talla, p_cantidad:-cant})

      // 2) Ajustar (o eliminar) la línea en detnotaen
      const cantRestante = Number(l.cantidad) - cant
      if (l.id) {
        if (cantRestante <= 0) {
          await supabase.from('detnotaen').delete().eq('id', l.id)
        } else {
          const factor = cantRestante / Number(l.cantidad)
          await supabase.from('detnotaen').update({
            cantidad: cantRestante,
            subtotal: Number(l.subtotal||l.cantidad*l.valunit) * factor,
            valdescue: Number(l.valdescue||0) * factor,
            valiva: Number(l.valiva||0) * factor,
            valtotal: Number(l.valtotal||0) * factor,
          }).eq('id', l.id)
        }
      }

      // 3) Recalcular totales de la nota a partir de las líneas restantes
      const {data:detRestante} = await supabase.from('detnotaen').select('*').eq('numnotaent', nroDoc)
      const nuevoSubtotal = (detRestante||[]).reduce((s,d)=>s+Number(d.cantidad||0)*Number(d.valunit||0),0)
      const nuevoDcto     = (detRestante||[]).reduce((s,d)=>s+Number(d.valdescue||0),0)
      const nuevoIva      = (detRestante||[]).reduce((s,d)=>s+Number(d.valiva||0),0)
      const nuevoTotal    = (detRestante||[]).reduce((s,d)=>s+Number(d.valtotal||0),0)
      const nuevaCant     = (detRestante||[]).reduce((s,d)=>s+Number(d.cantidad||0),0)

      // 4) Determinar si corresponde generar vale
      const saldoActual = saldo // total - abonos, antes de esta devolución
      let valeMonto = 0
      let nuevoSaldo
      if (saldoActual <= 0.01) {
        // Nota ya estaba totalmente pagada → toda la devolución se convierte en vale
        valeMonto = valorDevolucion
        nuevoSaldo = Math.max(0, nuevoTotal - abonos)
      } else if (valorDevolucion <= saldoActual) {
        // Reduce lo que falta por pagar, sin generar vale
        nuevoSaldo = saldoActual - valorDevolucion
      } else {
        // Cubre todo el saldo pendiente y el excedente se convierte en vale
        valeMonto = valorDevolucion - saldoActual
        nuevoSaldo = 0
      }

      await supabase.from('encnotaen').update({
        subtotal:nuevoSubtotal, valdescue:nuevoDcto, valiva:nuevoIva,
        valtotal:nuevoTotal, saldo:nuevoSaldo, cantotal:nuevaCant,
      }).eq('numnotaent', nroDoc)

      let textoVale = ''
      if (valeMonto > 0.01) {
        const {data:codData} = await supabase.rpc('siguiente_codigo_vale')
        const codigo = codData || `V-${Date.now()}`
        const {data:valeIns, error:eVale} = await supabase.from('vales').insert({
          codigo,
          cliente_id: cliente?.id || null,
          cliente_ced: cedula || cliente?.cedula || '',
          cliente_nombre: cliente?.nombre || cliTxt || 'Cliente general',
          valor_original: valeMonto,
          saldo: valeMonto,
          numnotaent_origen: nroDoc,
          motivo: `Devolución de ${l.descartic} (${cant} und.)`,
          estado: 'ACTIVO',
          usuario: usuario?.usuario || usuario?.nombre || 'sistema',
        }).select().single()
        if (!eVale && valeIns) {
          await supabase.from('vale_movimientos').insert({
            vale_id: valeIns.id, tipo:'EMISION', valor:valeMonto, numnotaent:nroDoc,
            usuario: usuario?.usuario || usuario?.nombre || 'sistema',
          })
          textoVale = ` 🎫 Se generó el vale ${codigo} por $${fmt(valeMonto)}, utilizable como parte de pago en otra nota.`
        }
      }

      setMsg({tipo:'ok', texto:`✅ Devolución de ${cant} ${l.descartic} registrada. Inventario restaurado.${textoVale}`})
      await cargarDoc(nroDoc)
    } catch(e) {
      setMsg({tipo:'err', texto:`❌ Error al procesar la devolución: ${e.message}`})
    }
    setBusy(false)
  }

  // ── APLICAR VALE COMO PARTE DE PAGO ───────────────────────────────────
  async function abrirVale() {
    if (!cliente && !cliTxt.trim()) { setMsg({tipo:'warn',texto:'Ingresa un cliente antes de aplicar un vale.'}); return }
    if (!detValidas.length) { setMsg({tipo:'warn',texto:'Agrega artículos antes de aplicar un vale.'}); return }
    if (saldo <= 0) { setMsg({tipo:'warn',texto:'Esta nota no tiene saldo pendiente.'}); return }
    if (!guardada) {
      const ok = await guardarSilencioso()
      if (!ok) return
    }
    setModal('vale')
  }

  // guarda encabezado+detalle sin mostrar mensaje (reutilizado por Abonos/Vale/PagarTodo)
  async function guardarSilencioso() {
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
        usuario: usuario?.usuario || usuario?.nombre || 'sistema',
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
      return true
    } catch(e) {
      setMsg({tipo:'err',texto:`❌ Error al guardar: ${e.message}`})
      return false
    }
  }

  async function aplicarVale(vale, valorAplicado) {
    setBusy(true)
    try {
      const nuevoSaldoVale = Number(vale.saldo) - valorAplicado
      await supabase.from('vales').update({
        saldo: nuevoSaldoVale, estado: nuevoSaldoVale<=0.01?'AGOTADO':'ACTIVO',
      }).eq('id', vale.id)
      await supabase.from('vale_movimientos').insert({
        vale_id: vale.id, tipo:'CONSUMO', valor:valorAplicado, numnotaent:nroDoc,
        usuario: usuario?.usuario || usuario?.nombre || 'sistema',
      })
      await supabase.from('detabonos').insert({
        numnotaent:nroDoc, fechaabono:hoy(), valabono:valorAplicado, mediopago:'Vale',
        observacio:`Vale ${vale.codigo}`,
      })
      await supabase.from('encnotaen').update({
        valabono: abonos+valorAplicado, saldo: Math.max(0, total-(abonos+valorAplicado)),
      }).eq('numnotaent', nroDoc)
      setModal(null)
      setMsg({tipo:'ok', texto:`✅ Vale ${vale.codigo} aplicado por $${fmt(valorAplicado)}.`})
      await cargarDoc(nroDoc)
    } catch(e) {
      setMsg({tipo:'err', texto:`❌ Error al aplicar el vale: ${e.message}`})
    }
    setBusy(false)
  }


  async function pagarTodo() {
    if (!cliente && !cliTxt.trim()) { setMsg({tipo:'warn',texto:'Ingresa un cliente antes de pagar.'}); return }
    if (!detValidas.length) { setMsg({tipo:'warn',texto:'Agrega artículos antes de pagar.'}); return }
    if (saldo <= 0) { setMsg({tipo:'warn',texto:'Esta nota no tiene saldo pendiente.'}); return }
    if (!window.confirm(`¿Registrar pago total de $${fmt(saldo)}?`)) return
    setBusy(true)
    try {
      if (!guardada) {
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
          usuario: usuario?.usuario || usuario?.nombre || 'sistema',
        }
        const {error:eg} = await supabase.from('encnotaen').upsert(enc,{onConflict:'numnotaent'})
        if (eg) throw eg
        await supabase.from('detnotaen').delete().eq('numnotaent',nroDoc)
        const {error:eg2} = await supabase.from('detnotaen').insert(
          detValidas.map(l=>({
            numnotaent:nroDoc, codartic:l.codartic, descartic:l.descartic,
            talla:l.talla, cantidad:Number(l.cantidad), valunit:Number(l.valunit),
            subtotal:Number(l.cantidad)*Number(l.valunit),
            porciva:l.porciva, valiva:l.valiva,
            porcdescue:l.porcdescue, valdescue:l.valdescue, valtotal:l.valtotal,
          }))
        )
        if (eg2) throw eg2
        setGuardada(true); setModoNueva(false)
      }
      const {error:ea} = await supabase.from('detabonos').insert({
        numnotaent:nroDoc, fechaabono:hoy(), valabono:saldo, mediopago:medio, observacio:'Pago total',
      })
      if (ea) throw ea
      await supabase.from('encnotaen').update({valabono:abonos+saldo, saldo:0}).eq('numnotaent',nroDoc)
      setMsg({tipo:'ok',texto:`✅ Pago total de $${fmt(saldo)} registrado.`})
      await cargarDoc(nroDoc)
    } catch(e) {
      setMsg({tipo:'err',texto:`❌ Error: ${e.message}`})
    }
    setBusy(false)
  }

  async function abrirAbonos() {
    if (!cliente && !cliTxt.trim()) { setMsg({tipo:'warn',texto:'Ingresa un cliente antes de registrar abonos.'}); return }
    if (!detValidas.length) { setMsg({tipo:'warn',texto:'Agrega artículos antes de registrar abonos.'}); return }
    if (!guardada) {
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
          usuario: usuario?.usuario || usuario?.nombre || 'sistema',
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
      {modal==='nuevoCliente'  && <ModalNuevoCliente  supabase={supabase} cedulaInicial={cedulaNueva} onGuardado={onClienteCreado} onClose={()=>setModal(null)}/>}
      {modal==='vale'          && <ModalVale          supabase={supabase} saldoNota={saldo} onAplicar={aplicarVale} onClose={()=>setModal(null)}/>}
      {devolverIdx!==null      && <ModalDevolucion    linea={lineas[devolverIdx]} onConfirmar={procesarDevolucion} onClose={()=>setDevolverIdx(null)}/>}
      {modal==='desbloquear'   && (
        <ModalPin
          supabase={supabase}
          titulo="Desbloquear Nota"
          descripcion={`La nota ${nroDoc} está guardada. Con el PIN puedes modificar sus artículos y datos.`}
          onConfirm={()=>{ setDesbloqueada(true); setModal(null); setMsg({tipo:'warn',texto:`🔓 Nota ${nroDoc} desbloqueada. Recuerda guardar los cambios.`}) }}
          onClose={()=>setModal(null)}
        />
      )}

      <div style={P.ventana}>
        <div style={P.titulo}>
          <div style={{display:'flex',flexDirection:'column',alignItems:'flex-start',marginRight:14,lineHeight:1}}>
            <span style={{fontFamily:'Arial Black, Arial, sans-serif',fontWeight:900,fontSize:22,color:'#fff',letterSpacing:3}}>ATM</span>
            <span style={{fontFamily:'Arial, sans-serif',fontWeight:400,fontSize:9,color:'rgba(255,255,255,0.8)',letterSpacing:2,textTransform:'uppercase'}}>A TU MEDIDA</span>
          </div>
          <span style={P.titTxt}>NOTA DE ENTREGA</span>
          <div style={P.titNro}>
            N° <strong style={{fontSize:22}}>{nroDoc}</strong>
            {modoNueva    && <span style={P.badgeNueva}>NUEVA</span>}
            {anulada      && <span style={P.badgeAnul}>ANULADA</span>}
            {desbloqueada && <span style={{...P.badgeNueva,background:'#ffc107',color:'#333'}}>🔓 EDITANDO</span>}
          </div>
        </div>

        {msg && (
          <div style={{...P.alerta,
            background:msg.tipo==='ok'?'#e8f5e9':msg.tipo==='warn'?'#fff8e1':'#ffebee',
            color:msg.tipo==='ok'?'#2e7d32':msg.tipo==='warn'?'#e65100':'#c62828',
            border:`1px solid ${msg.tipo==='ok'?'#a5d6a7':msg.tipo==='warn'?'#ffe082':'#ef9a9a'}`}}>
            {msg.texto}<button onClick={()=>setMsg(null)} style={P.alertaX}>✕</button>
          </div>
        )}

        <div style={P.bloque}>
          <div style={P.fila}>
            <Fld label="Cédula / NIT" w={140}>
              <div style={{display:'flex',gap:4}}>
                <input ref={cedulaRef} style={{...P.inp,flex:1,fontWeight:700,fontSize:14}}
                  value={cedula} onChange={e=>setCedula(e.target.value)}
                  onKeyDown={e=>e.key==='Enter'&&onCedulaEnter()}
                  placeholder="Cédula o NIT…" disabled={anulada && !desbloqueada}/>
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
                  placeholder="Nombre…" disabled={anulada && !desbloqueada}/>
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

          <div style={P.fila}>
            <Fld label="Fecha" w={140}>
              <input type="date" style={P.inp} value={fecha} onChange={e=>setFecha(e.target.value)} disabled={anulada && !desbloqueada}/>
            </Fld>
            <Fld label="Plazo de Pago" w={150}>
              <select style={P.inp} value={plazo} onChange={e=>{const p=e.target.value;setPlazo(p);setFechaPago(fechaDePago(p))}} disabled={anulada && !desbloqueada}>
                {PLAZOS.map(p=><option key={p}>{p}</option>)}
              </select>
            </Fld>
            <Fld label="Fecha de Pago" w={140}>
              <input type="date" style={P.inp} value={fechaPago} onChange={e=>setFechaPago(e.target.value)} disabled={anulada && !desbloqueada}/>
            </Fld>
            <Fld label="% Dcto." w={80}>
              <input type="number" style={P.inp} value={pDesc} min={0} max={100} onChange={e=>setPDesc(Number(e.target.value))} disabled={anulada && !desbloqueada}/>
            </Fld>
            <Fld label="% IVA" w={70}>
              <input type="number" style={P.inp} value={pIva} min={0} max={100} onChange={e=>setPIva(Number(e.target.value))} disabled={anulada && !desbloqueada}/>
            </Fld>
            <div style={{display:'flex',alignItems:'flex-end',gap:8}}>
              <span style={{fontSize:12,fontWeight:800,color:'#1a3a6b',marginBottom:6}}>PRECIO:</span>
              {['Mayor','Detal','Vendedor'].map(t=>(
                <label key={t} style={{...P.radio,marginBottom:4}}>
                  <input type="radio" name="tipo" checked={tipoVta===t} onChange={()=>setTipoVta(t)} disabled={anulada && !desbloqueada}/>{' '}{t}
                </label>
              ))}
            </div>
            <Fld label="Vendedor" w={240}>
              <select style={{...P.inp,cursor:'pointer'}}
                value={cedVend} onChange={e=>elegirVendedor(e.target.value)} disabled={anulada && !desbloqueada}>
                <option value="">-- Selecciona vendedor --</option>
                {listaVend.map(v=>(
                  <option key={v.id} value={v.cedula}>{v.cedula} - {v.nombre}</option>
                ))}
              </select>
            </Fld>
          </div>
        </div>

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
                        <input
                          ref={el => inputRefs.current[i] = el}
                          style={{...P.ci,width:88}}
                          value={l.codartic}
                          onChange={e => onChangeCodigo(e.target.value, i)}
                          onKeyDown={e => { if(e.key==='Enter'){ e.preventDefault(); onEnterCodigo(l.codartic, i) } }}
                          placeholder="Código" disabled={anulada && !desbloqueada}/>
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
                        placeholder="Descripción" disabled={anulada && !desbloqueada}/>
                    </td>
                    <td style={{...P.td,paddingLeft:4,fontSize:11,color:'#555'}}>{l.marca||''}</td>
                    <td style={{...P.td,paddingLeft:4,fontSize:11,color:'#555'}}>{l.genero||''}</td>
                    <td style={P.td}><input style={{...P.ci,width:46,textAlign:'center'}} value={l.talla} onChange={e=>upd(i,{talla:e.target.value})} disabled={anulada && !desbloqueada}/></td>
                    <td style={P.td}><input type="number" style={{...P.ci,width:60,textAlign:'right',fontSize:13,fontWeight:600}} value={l.cantidad} onChange={e=>upd(i,{cantidad:e.target.value})} disabled={anulada && !desbloqueada} title="Usa cantidad negativa para registrar una devolución sin localizar la nota original"/></td>
                    <td style={P.td}><input type="number" style={{...P.ci,width:96,textAlign:'right'}} value={l.valunit} min={0} onChange={e=>upd(i,{valunit:Number(e.target.value)})} disabled={anulada && !desbloqueada}/></td>
                    <td style={P.td}><input type="number" style={{...P.ci,width:46,textAlign:'right'}} value={l.porcdescue} min={0} max={100} onChange={e=>upd(i,{porcdescue:Number(e.target.value)})} disabled={anulada && !desbloqueada}/></td>
                    <td style={{...P.td,textAlign:'right',paddingRight:6,color:'#c0392b',fontSize:12}}>{l.valdescue?fmt(l.valdescue):''}</td>
                    <td style={{...P.td,textAlign:'right',paddingRight:6,fontWeight:700,color:'#1a3a6b',fontSize:13}}>{l.valtotal?fmt(l.valtotal):''}</td>
                    <td style={{...P.td,textAlign:'center',width:46}}>
                      {l.codartic&&!anulada&&(!guardada||modoNueva||desbloqueada)&&<button onClick={()=>quitarLinea(i)} style={P.btnX} title="Quitar línea">✕</button>}
                      {l.codartic&&!anulada&&l.id&&guardada&&!modoNueva&&!desbloqueada&&Number(l.cantidad)>0&&
                        <button onClick={()=>abrirDevolucion(i)} style={P.btnDev} title="Devolver esta prenda">↩</button>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div style={P.footer}>
          <div style={P.footCol}>
            <div style={P.btnFila}>
              <IBtn src={WZTOP}    onClick={navPrimero}                title="Primera nota"/>
              <IBtn src={WZBACK}   onClick={navAnterior}               title="Anterior"/>
              <IBtn src={WZNEXT}   onClick={navSiguiente}              title="Siguiente"/>
              <IBtn src={WZEND}    onClick={navUltimo}                 title="Última nota"/>
              <IBtn src={WZLOCATE} onClick={()=>setModal('buscarNota')} title="Buscar nota"/>
            </div>
            <div style={P.btnFila}>
              <IBtn src={WZNEW} onClick={()=>nuevaNota(serieParaUsuario(serieSel))} title="Nueva nota" disabled={modoNueva&&!(cliente||cliTxt||lineas.some(l=>l.codartic))}/>
              {usuario?.rol==='admin' && !modoNueva && (
                <select value={serieSel} onChange={e=>setSerieSel(e.target.value)}
                  style={{height:40,border:'1px solid #c8d5ea',borderRadius:6,padding:'0 6px',fontSize:11,fontWeight:700,color:'#1a3a6b',background:'#eef2ff',cursor:'pointer'}}>
                  <option value="caja">Caja (&ge;1.000.000)</option>
                  <option value="vendedor">Vendedor (&lt;1.000.000)</option>
                </select>
              )}
              <IBtn src={WZSAVE}   onClick={guardar}       title="Guardar"     disabled={busy||(anulada&&!desbloqueada)}/>
              <IBtn src={WZUNDO}   onClick={revertirNueva} title="Revertir"    disabled={!modoNueva}/>
              {guardada && !anulada && !modoNueva && !desbloqueada && (
                <button onClick={()=>setModal('desbloquear')}
                  title="Desbloquear nota para edición"
                  style={{background:'#fff3cd',border:'1px solid #ffc107',borderRadius:6,padding:'0 10px',cursor:'pointer',fontSize:13,fontWeight:700,color:'#856404',height:40}}>
                  🔓
                </button>
              )}
              {desbloqueada && (
                <button onClick={()=>{setDesbloqueada(false);cargarDoc(nroDoc)}}
                  title="Bloquear nota (descartar cambios)"
                  style={{background:'#ffebee',border:'1px solid #ef9a9a',borderRadius:6,padding:'0 10px',cursor:'pointer',fontSize:13,fontWeight:700,color:'#c62828',height:40}}>
                  🔒
                </button>
              )}
              <IBtn src={WZDELETE} onClick={anularNota}    title="Anular"      disabled={anulada||modoNueva}/>
              <IBtn src={WZPRINT}  onClick={()=>setModal('print')} title="Imprimir"/>
              <IBtn src={WZCLOSE}  onClick={onClose}       title="Volver al menú"/>
            </div>
          </div>

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

          <div style={P.footCol}>
            <div style={P.medios}>
              {MEDIOS.map(m=>(
                <label key={m} style={P.radio}>
                  <input type="radio" name="medio" checked={medio===m} onChange={()=>setMedio(m)} disabled={anulada && !desbloqueada}/>{' '}{m}
                </label>
              ))}
            </div>
            <div style={P.acciones}>
              <BtnAcc onClick={abrirAbonos} icon="💵">Abonos</BtnAcc>
              <BtnAcc onClick={pagarTodo}   icon="💰">Pagar Todo</BtnAcc>
              <BtnAcc onClick={abrirVale}   icon="🎫">Aplicar Vale</BtnAcc>
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
      <span style={{fontSize:10,fontWeight:700,color:'#5577aa',marginBottom:2,textTransform:'uppercase',letterSpacing:0.5}}>{label}</span>
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
  btnDev:    {background:'#fff3cd',border:'1px solid #ffc107',borderRadius:4,color:'#856404',cursor:'pointer',fontSize:12,fontWeight:700,padding:'1px 5px'},
  footer:    {display:'flex',gap:12,flexWrap:'wrap',padding:'10px 14px',background:'#eef2ff',borderTop:'2px solid #c8d5ea',alignItems:'flex-start'},
  footCol:   {display:'flex',flexDirection:'column',gap:6},
  btnFila:   {display:'flex',gap:4},
  prendas:   {display:'flex',justifyContent:'space-between',alignItems:'center',background:'#fff3cd',border:'1px solid #ffc107',borderRadius:6,padding:'5px 14px',marginBottom:6},
  medios:    {display:'flex',flexDirection:'column',gap:6,background:'#fff',border:'1px solid #c8d5ea',borderRadius:6,padding:'10px 14px'},
  acciones:  {display:'grid',gridTemplateColumns:'1fr 1fr',gap:5},
  tL:        {fontSize:11,color:'#1a3a6b',fontWeight:600,textAlign:'center'},
  tV:        {fontSize:12,textAlign:'right',fontVariantNumeric:'tabular-nums',fontWeight:600,color:'#333'},
  totGrid:   {display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:'2px 8px',background:'#fff',border:'1px solid #c8d5ea',borderRadius:6,padding:'6px 10px'},
}
