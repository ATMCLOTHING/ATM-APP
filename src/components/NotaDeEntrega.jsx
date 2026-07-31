import { useState, useEffect, useRef, useMemo, useCallback } from 'react'
import { LOGO, WZNEW, WZSAVE, WZDELETE, WZPRINT, WZCLOSE, WZTOP, WZBACK, WZNEXT, WZEND, WZLOCATE, WZUNDO, WZUBICACION } from '../lib/assets'
import ModalAbonos        from './ModalAbonos'
import ModalBuscarNota    from './ModalBuscarNota'
import ModalDetalle       from './ModalDetalle'
import PrintNota, { generarGuiaEnvio } from './PrintNota'
import { fmtFecha } from '../lib/fecha'
import { logError } from '../lib/logError'
import ModalBuscarCliente from './ModalBuscarCliente'
import ModalEditarCliente from './ModalEditarCliente'
import ModalNuevoCliente  from './ModalNuevoCliente'
import ModalPin           from './ModalPin'
import ModalDevolucion    from './ModalDevolucion'
import ModalVale          from './ModalVale'
import ModalNuevaMarca    from './ModalNuevaMarca'

const fmt = n => Number(n||0).toLocaleString('es-CO',{minimumFractionDigits:2,maximumFractionDigits:2})
// Redondeo de valores monetarios con decimal: >=0.5 hacia arriba, <0.5 hacia abajo (evita descuadres al aplicar % de descuento)
const redondear = n => Math.round(Number(n)||0)
// El descuento se redondea a la moneda física más pequeña que circula en Colombia ($50):
// un % con decimales (ej. 3,03%) puede dar valores como $19.998 que no existen en efectivo
const redondearDcto = n => Math.round((Number(n)||0)/50)*50
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

export default function NotaDeEntrega({ supabase, usuario, onClose, onAyuda }) {
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
  const [devolverIdx, setDevolverIdx] = useState(null)
  const [resultDevolucion, setResultDevolucion] = useState(null)
  const [artNoEncontrado, setArtNoEncontrado] = useState(null) // {cod, idx} para modal de crear artículo
  const [modalAnular, setModalAnular] = useState(false) // modal de motivo de anulación
  const [pinAnular,   setPinAnular]   = useState(false) // modal de PIN admin, previo a ejecutar la anulación
  const [motivoAnular,setMotivoAnular]= useState(null)   // motivo elegido, en espera de la autorización por PIN

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
    // todas las notas comparten un único consecutivo: se muestra la última nota general
    const {count} = await supabase.from('encnotaen').select('numnotaent',{count:'exact',head:true})
    setTotalNotas(count||0)
    if ((count||0) > 0) {
      const {data} = await supabase.from('encnotaen')
        .select('numnotaent').order('numnotaent',{ascending:false}).limit(1)
      if (data?.length) await cargarDoc(data[0].numnotaent)
    } else {
      await prepararNueva()
    }
    setBusy(false)
  }

  async function siguienteConsecutivo() {
    const {data,error} = await supabase.rpc('siguiente_nota', {p_tipo: 'vendedor'})
    if (!error && data) return String(data)
    // fallback de emergencia
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
    setMsg(null)
    setGuardada(false); setAnulada(false); setModoNueva(true)
    setTimeout(()=>cedulaRef.current?.focus(), 100)
  }

  async function nuevaNota() {
    if (modoNueva && (cliente || cliTxt || lineas.some(l=>l.codartic))) {
      if (!window.confirm('¿Descartar los cambios sin guardar?')) return
    }
    await prepararNueva()
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

  // Busca en articomp por codartic exacto
  async function buscarArticomp(val) {
    const {data} = await supabase.from('articomp')
      .select('codartic,descartic,talla,marca,genero,preciovent,preciovend,preciovenv,porciva')
      .eq('codartic', val).limit(10)
    return data
  }

  // Procesa un código ingresado (pistola o manual con Enter).
  // La pistola agrega la talla (2 dígitos) al final de la referencia; lo digitado a mano
  // trae solo la referencia. Como la referencia no tiene longitud fija, primero se busca
  // el código tal cual, y solo si eso falla se reintenta recortando los últimos 2 dígitos.
  async function procesarCodigo(txt, idx) {
    if (!txt.trim()) return
    const cod = extraerCodigo(txt)

    // 1) Intento directo, tal cual fue ingresado
    let data = await buscarArticomp(cod)
    let codUsado = cod

    // 2) Si no hay match, puede ser pistola con talla incluida: recortar los últimos 2 dígitos y reintentar
    if (!data || !data.length) {
      const recorte = txt.trim().slice(0, -2)
      if (recorte) {
        const codRecortado = extraerCodigo(recorte)
        const dataRecorte = await buscarArticomp(codRecortado)
        if (dataRecorte && dataRecorte.length) { data = dataRecorte; codUsado = codRecortado }
      }
    }

    if (!data || !data.length) {
      // No encontrado con ninguno de los dos intentos → ofrecer crear el artículo
      setLineas(prev => { const n=[...prev]; n[idx]={...n[idx],codartic:txt}; return n })
      setArtNoEncontrado({cod, idx})
      return
    }

    if (data.length === 1) {
      // Exacto único → agregar/sumar y bajar al siguiente código (modo pistola)
      elegirArtPistola(data[0], idx)
    } else {
      // Varias tallas → mostrar dropdown para elegir
      setLineas(prev => { const n=[...prev]; n[idx]={...n[idx],codartic:codUsado}; return n })
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
    const dcto = redondearDcto(sub*((Number(lin.porcdescue)||0)/100))
    const base = sub-dcto
    const iva  = redondear(base*((Number(lin.porciva)||0)/100))
    return {...lin,valdescue:dcto,valiva:iva,valtotal:base+iva}
  }

  const upd = useCallback((idx, cambios) => {
    setLineas(prev=>{
      const sig=[...prev]
      sig[idx]=recalc({...sig[idx],...cambios})
      if (idx===sig.length-1&&(cambios.codartic||cambios.descartic)) sig.push({...VACIA})
      return sig
    })
  }, [])

  const quitarLinea = useCallback((idx) => {
    setLineas(prev=>{
      const nuevo=prev.filter((_,i)=>i!==idx)
      while(nuevo.length<FILAS_BASE) nuevo.push({...VACIA})
      return nuevo
    })
  }, [])

  const detValidas = useMemo(()=>
    lineas.filter(l=>l.codartic&&Number(l.cantidad)!==0),
  [lineas])

  const { subtotal, totDcto, totIva, total, saldo, prendas } = useMemo(()=>{
    const subtotal     = detValidas.reduce((s,l)=>s+(Number(l.cantidad)||0)*(Number(l.valunit)||0),0)
    const totDctoLinea = detValidas.reduce((s,l)=>s+(l.valdescue||0),0)
    const dctoGlobal   = redondearDcto(subtotal * ((Number(pDesc)||0)/100))
    const totDcto      = totDctoLinea + dctoGlobal
    const baseIva      = subtotal - totDcto
    const totIva       = redondear(baseIva * ((Number(pIva)||0)/100))
    const total        = baseIva + totIva
    const saldo        = total - abonos
    const prendas      = detValidas.reduce((s,l)=>s+(Number(l.cantidad)||0),0)
    return { subtotal, totDcto, totIva, total, saldo, prendas }
  }, [detValidas, pDesc, pIva, abonos])

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
    const esClienteGeneral = !e.codclient || ['99','9','999'].includes(String(e.codclient))
    let cli = null
    if (!esClienteGeneral) {
      const {data} = await supabase.from('clientes').select('*').eq('id', e.codclient).limit(1)
      cli = data
    }
    setCliente(cli&&cli.length?cli[0]:null)
    setCliTxt(cli&&cli.length?cli[0].nombre:(e.nombreclie||''))
    const {data:det} = await supabase.from('detnotaen').select('*').eq('numnotaent',id)
    const extras = Math.max(0,FILAS_BASE-(det?.length||0))
    setLineas(det?.length?[...det,...Array.from({length:extras},()=>({...VACIA}))]:FILAS())
    // Se confía en el valabono guardado en el encabezado (es la misma fuente que usa
    // el buscador y los informes). Antes esto se recalculaba sumando detabonos, pero
    // notas antiguas/migradas pueden no tener el detalle completo, lo que hacía ver
    // como "sin pagar" una nota que en realidad sí estaba pagada.
    const abonoHeader = Number(e.valabono)||0
    setAbonos(abonoHeader)
    const {data:ab} = await supabase.from('detabonos').select('valabono').eq('numnotaent',id)
    const sumaDetalle = (ab||[]).reduce((s,r)=>s+(r.valabono||0),0)
    if (Math.abs(sumaDetalle - abonoHeader) > 1) {
      setMsg({tipo:'warn', texto:`⚠️ El detalle de abonos de esta nota ($${fmt(sumaDetalle)}) no coincide con el total guardado ($${fmt(abonoHeader)}). Se está mostrando el total guardado; conviene revisar esta nota en la base de datos.`})
    }
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
      // Al editar una nota ya guardada, leer de la BD el abono real y cualquier
      // descuento aplicado después (ej. desde Cartera/Abonos) para no pisarlos
      let abonoReal = abonos
      let extraDescue = 0
      if (!modoNueva && guardada) {
        const {data:encActual} = await supabase.from('encnotaen')
          .select('valabono,valdescue').eq('numnotaent',nroDoc).single()
        if (encActual) {
          abonoReal = Number(encActual.valabono)||0
          extraDescue = Math.max(0, (Number(encActual.valdescue)||0) - totDcto)
        }
      }
      const totalReal = total - extraDescue
      const saldoReal = Math.max(0, totalReal - abonoReal)

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
        subtotal, valdescue:totDcto+extraDescue, valiva:totIva, valtotal:totalReal,
        valabono:abonoReal, saldo:saldoReal, cedvended:cedVend,
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
          numnotaent:nroDoc, codartic:l.codartic, descartic:l.descartic, marca:l.marca||'',
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
          .select('existencia,descartic').eq('codartic',cod).eq('talla',tall).limit(1)
        if (art&&art.length&&(art[0].existencia||0)<0)
          avisos.push(`${cod} T:${tall} (existencia: ${art[0].existencia})`)
        // Registrar en kardex
        const tipo_mov = diff > 0 ? 'ENTRADA' : 'SALIDA'
        const concepto = diff > 0 ? `Ajuste en nota ${nroDoc}` : `Venta nota ${nroDoc}`
        await registrarKardex(cod, art?.[0]?.descartic||cod, tall, tipo_mov, concepto, diff, nroDoc)
      }
      setGuardada(true); setModoNueva(false)

      // Punto 7: Si el saldo real quedó negativo (devolvió más de lo que compró),
      // generar un vale por el excedente
      if (saldoReal < -0.01) {
        const montoVale = Math.abs(saldoReal)
        const {data:codData} = await supabase.rpc('siguiente_codigo_vale')
        const codigoVale = codData || `V-${Date.now()}`
        const {data:valeIns} = await supabase.from('vales').insert({
          codigo: codigoVale,
          cliente_id: cliente?.id || null,
          cliente_ced: cedula || cliente?.cedula || '',
          cliente_nombre: cliente?.nombre || cliTxt || 'Cliente general',
          valor_original: montoVale, saldo: montoVale,
          numnotaent_origen: nroDoc,
          motivo: `Devolución con saldo a favor en nota ${nroDoc}`,
          estado: 'ACTIVO',
          usuario: usuario?.usuario || 'sistema',
        }).select().single()
        if (valeIns) {
          await supabase.from('vale_movimientos').insert({
            vale_id: valeIns.id, tipo:'EMISION', valor:montoVale, numnotaent:nroDoc,
            usuario: usuario?.usuario || 'sistema',
          })
          // Dejar la nota con saldo en 0 (el vale cubre el excedente)
          await supabase.from('encnotaen').update({saldo:0}).eq('numnotaent',nroDoc)
          setResultDevolucion({
            nota: nroDoc, descripcion: 'Devolución con saldo a favor',
            codartic:'', talla:'', cantidad:'', valorDevolucion: montoVale,
            saldoAntes: 0, saldoNuevo: 0,
            cliente: cliente?.nombre||cliTxt||'Cliente general',
            fecha: hoy(), vale: {codigo:codigoVale, valor:montoVale},
          })
        }
      }

      const msgBase = `✅ Nota ${nroDoc} guardada.`
      setMsg({tipo:avisos.length?'warn':'ok', texto:avisos.length?`${msgBase} ⚠️ Inventario negativo en: ${avisos.join(', ')}`:msgBase})
      await recargarIds()
    } catch(e){
      setMsg({tipo:'err',texto:`❌ Error: ${e.message}`})
      logError(supabase, {modulo:'nota', accion:'guardar', mensaje:e.message, numnotaent:nroDoc, usuario:usuario?.usuario||usuario?.nombre})
    }
    setBusy(false)
  }

  async function anularNota() {
    if (!guardada){setMsg({tipo:'warn',texto:'Esta nota no está guardada aún.'}); return}
    if (anulada){setMsg({tipo:'warn',texto:'Esta nota ya está anulada.'}); return}
    if (usuario?.rol !== 'admin'){setMsg({tipo:'err',texto:'❌ Solo un administrador puede anular una nota de entrega.'}); return}
    setModalAnular(true)
  }

  async function ejecutarAnulacion(motivo) {
    setModalAnular(false)
    setBusy(true)
    const {error}=await supabase.from('encnotaen').update({
      anulada:'S',fechaanula:hoy(),motivoanula:motivo||'Anulada'
    }).eq('numnotaent',nroDoc)
    if(error){
      setMsg({tipo:'err',texto:`❌ ${error.message}`})
      logError(supabase, {modulo:'nota', accion:'anular', mensaje:error.message, numnotaent:nroDoc, usuario:usuario?.usuario||usuario?.nombre})
    }
    else {
      const {data:det} = await supabase.from('detnotaen').select('codartic,talla,cantidad,descartic').eq('numnotaent',nroDoc)
      for (const l of (det||[])) {
        await supabase.rpc('ajustar_inventario', {p_codartic:l.codartic, p_talla:l.talla, p_cantidad:-Number(l.cantidad)})
        await registrarKardex(l.codartic, l.descartic, l.talla, 'DEVOLUCION', `Anulación nota ${nroDoc}: ${motivo}`, l.cantidad, nroDoc)
      }
      setAnulada(true)
      setMsg({tipo:'ok',texto:`Nota ${nroDoc} anulada. Inventario restaurado.`})
    }
    setBusy(false)
  }

  // ── CREAR ARTÍCULO DESDE LA NOTA ─────────────────────────────────────
  async function crearArticuloDesdeNota(datos) {
    // datos = {codartic, descartic, cantidad, valunit, marca}
    setBusy(true)
    try {
      const idx = artNoEncontrado.idx
      // Crear en articulo
      const {error:eArt} = await supabase.from('articulo').upsert({
        codartic: datos.codartic, descartic: datos.descartic,
        tipo:'', tipotalla:'U', genero:'', marca:datos.marca||'',
        preciovent: datos.valunit, preciovend: datos.valunit, preciovenv: datos.valunit,
        preciocomp: 0, existencia: datos.cantidad, existminim: 0, estado:'A',
        usuario: usuario?.usuario || 'sistema',
      }, {onConflict:'codartic'})
      if (eArt) throw eArt
      // Crear en articomp (tabla que usa la búsqueda al vender: sin esta fila el
      // artículo queda invisible para la venta aunque exista en "articulo")
      const {data:existeComp} = await supabase.from('articomp')
        .select('codartic').eq('codartic', datos.codartic).limit(1)
      if (!existeComp || !existeComp.length) {
        const {error:eComp} = await supabase.from('articomp').insert({
          codartic: datos.codartic, descartic: datos.descartic,
          talla:'U', tipotalla:'U', tipo:'', marca:datos.marca||'', genero:'',
          preciovent: datos.valunit, preciovend: datos.valunit, preciovenv: datos.valunit,
          preciocomp: 0, existencia: datos.cantidad, existminim: 0, porciva: 0,
        })
        if (eComp) throw eComp
      }
      // No se registra Kardex aquí: eso queda para cuando la nota se guarde de
      // verdad (guardar(), más abajo, ya compara cantidades y registra el
      // movimiento). Hacerlo en este punto (al solo agregar la línea al borrador)
      // dejaba movimientos de inventario "fantasma" apuntando a notas que el
      // usuario podía terminar sin guardar — pasó con las notas 50951/50952/50953.
      // Poner en la línea de la nota
      setLineas(prev => {
        const sig = [...prev]
        sig[idx] = recalc({...sig[idx],
          codartic: datos.codartic, descartic: datos.descartic,
          talla:'U', marca:datos.marca||'', genero:'',
          valunit: datos.valunit, cantidad: datos.cantidad, porciva:0
        })
        if (idx===sig.length-1) sig.push({...VACIA})
        return sig
      })
      setArtNoEncontrado(null)
      setMsg({tipo:'ok', texto:`✅ Artículo ${datos.codartic} creado y agregado a la nota.`})
    } catch(e) {
      setMsg({tipo:'err', texto:`❌ Error al crear artículo: ${e.message}`})
      logError(supabase, {modulo:'nota', accion:'crearArticuloDesdeNota', mensaje:e.message, numnotaent:nroDoc, usuario:usuario?.usuario||usuario?.nombre, detalle:{codartic:datos.codartic}})
    }
    setBusy(false)
  }


  async function registrarKardex(codartic, descartic, talla, tipo_mov, concepto, cantidad, numnotaent) {
    try {
      // Leer existencia actual después del movimiento
      const {data:art} = await supabase.from('articomp')
        .select('existencia').eq('codartic',codartic).eq('talla',talla||'U').limit(1)
      const existDespues = art&&art.length ? Number(art[0].existencia) : null
      await supabase.from('artikardex').insert({
        codartic, descartic: descartic||codartic, talla: talla||'U',
        tipo_mov, concepto, cantidad: Math.abs(cantidad),
        existencia_despues: existDespues,
        numnotaent: numnotaent || null,
        usuario: usuario?.usuario || usuario?.nombre || 'sistema',
      })
    } catch(e) { console.error('Error registrando kardex:', e) }
  }

  const dataNota={nroDoc,fecha,fechaPago,plazo,medio,cliente,cliTxt,cedula,vendedor,cedVend,lineas:detValidas,subtotal,totDcto,totIva,total,saldo,prendas,abonos}

  // ── GUÍA DE ENVÍO: etiqueta con los datos del destinatario, para pegar en el paquete ──
  function imprimirGuia() {
    if (!cliente && !cliTxt.trim()) { setMsg({tipo:'warn',texto:'Ingresa un cliente antes de generar la guía de envío.'}); return }
    generarGuiaEnvio(dataNota)
  }

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

      // 1) Restaurar inventario y registrar en kardex
      await supabase.rpc('ajustar_inventario', {p_codartic:l.codartic, p_talla:l.talla, p_cantidad:-cant})
      await registrarKardex(l.codartic, l.descartic, l.talla, 'DEVOLUCION', `Devolución nota ${nroDoc}`, cant, nroDoc)

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

      let valeInfo = null
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
        if (eVale) throw eVale
        await supabase.from('vale_movimientos').insert({
          vale_id: valeIns.id, tipo:'EMISION', valor:valeMonto, numnotaent:nroDoc,
          usuario: usuario?.usuario || usuario?.nombre || 'sistema',
        })
        valeInfo = {codigo, valor:valeMonto}
      }

      setMsg(null)
      await cargarDoc(nroDoc)
      // Siempre se muestra el modal de resultado, tenga o no vale, con opción de imprimir comprobante
      setResultDevolucion({
        nota: nroDoc,
        descripcion: l.descartic,
        codartic: l.codartic,
        talla: l.talla,
        cantidad: cant,
        valorDevolucion,
        saldoAntes: saldoActual,
        saldoNuevo: nuevoSaldo,
        cliente: cliente?.nombre || cliTxt || 'Cliente general',
        fecha: hoy(),
        vale: valeInfo,
      })
    } catch(e) {
      setMsg({tipo:'err', texto:`❌ Error al procesar la devolución: ${e.message}`})
      logError(supabase, {modulo:'nota', accion:'procesarDevolucion', mensaje:e.message, numnotaent:nroDoc, usuario:usuario?.usuario||usuario?.nombre, detalle:{codartic:l?.codartic}})
    }
    setBusy(false)
  }

  // ── APLICAR VALE COMO PARTE DE PAGO ───────────────────────────────────
  async function abrirVale() {
    if (busy) return
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
          numnotaent:nroDoc, codartic:l.codartic, descartic:l.descartic, marca:l.marca||'',
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
      logError(supabase, {modulo:'nota', accion:'guardarSilencioso', mensaje:e.message, numnotaent:nroDoc, usuario:usuario?.usuario||usuario?.nombre})
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
      logError(supabase, {modulo:'nota', accion:'aplicarVale', mensaje:e.message, numnotaent:nroDoc, usuario:usuario?.usuario||usuario?.nombre, detalle:{vale:vale.codigo}})
    }
    setBusy(false)
  }


  async function pagarTodo() {
    if (busy) return
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
            numnotaent:nroDoc, codartic:l.codartic, descartic:l.descartic, marca:l.marca||'',
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
      logError(supabase, {modulo:'nota', accion:'pagarTodo', mensaje:e.message, numnotaent:nroDoc, usuario:usuario?.usuario||usuario?.nombre})
    }
    setBusy(false)
  }

  async function abrirAbonos() {
    if (busy) return
    if (!cliente && !cliTxt.trim()) { setMsg({tipo:'warn',texto:'Ingresa un cliente antes de registrar abonos.'}); return }
    if (!detValidas.length) { setMsg({tipo:'warn',texto:'Agrega artículos antes de registrar abonos.'}); return }
    // Siempre se vuelve a guardar (aunque "guardada" ya esté en true) para asegurar que
    // la nota exista en la base antes de abrir el modal: si el estado local queda
    // desincronizado del servidor, el insert en detabonos falla por la llave foránea
    // detabonos_numnotaent_fkey al no encontrar la nota.
    const ok = await guardarSilencioso()
    if (!ok) return
    setModal('abonos')
  }

  return (
    <div style={P.pagina}>
      {modal==='abonos'        && <ModalAbonos        supabase={supabase} usuario={usuario} nroDoc={nroDoc} totalNota={total} totalAbonos={abonos} onClose={async()=>{setModal(null);await cargarDoc(nroDoc)}}/>}
      {modal==='buscarNota'    && <ModalBuscarNota    supabase={supabase} onSelect={id=>{setModal(null);cargarDoc(id)}} onClose={()=>setModal(null)}/>}
      {modal==='detalle'       && <ModalDetalle       nroDoc={nroDoc} lineas={detValidas} onClose={()=>setModal(null)}/>}
      {modal==='print'         && <PrintNota          datos={dataNota} onClose={()=>setModal(null)}/>}
      {modal==='buscarCliente' && <ModalBuscarCliente supabase={supabase} onSelect={c=>{aplicarCliente(c);setModal(null)}} onClose={()=>setModal(null)}/>}
      {modal==='editarCliente' && <ModalEditarCliente supabase={supabase} cliente={cliente} onGuardar={onClienteEditado} onClose={()=>setModal(null)}/>}
      {modal==='nuevoCliente'  && <ModalNuevoCliente  supabase={supabase} cedulaInicial={cedulaNueva} onGuardado={onClienteCreado} onClose={()=>setModal(null)}/>}
      {modal==='vale'          && <ModalVale          supabase={supabase} saldoNota={saldo} onAplicar={aplicarVale} onClose={()=>setModal(null)}/>}
      {devolverIdx!==null      && <ModalDevolucion    linea={lineas[devolverIdx]} onConfirmar={procesarDevolucion} onClose={()=>setDevolverIdx(null)}/>}

      {/* Modal artículo no encontrado — Punto 1 */}
      {artNoEncontrado && <ModalArticuloRapido
        supabase={supabase}
        cod={artNoEncontrado.cod}
        onConfirmar={crearArticuloDesdeNota}
        onCancelar={()=>{ setArtNoEncontrado(null); setMsg({tipo:'err',texto:`❌ Código "${artNoEncontrado.cod}" no encontrado.`}) }}
      />}

      {/* Modal motivo de anulación — Punto 2 */}
      {modalAnular && <ModalMotivoAnulacion
        onConfirmar={motivo=>{ setModalAnular(false); setMotivoAnular(motivo); setPinAnular(true) }}
        onCancelar={()=>setModalAnular(false)}
        clienteGeneral={!cliente || String(cliente?.id||'99')==='99'}
        clienteNombre={cliente?.nombre||cliTxt||''}
      />}
      {/* PIN de administrador requerido para confirmar la anulación */}
      {pinAnular && <ModalPin
        supabase={supabase}
        titulo="Autorizar Anulación"
        descripcion={`Se anulará la nota ${nroDoc} y se restaurará el inventario. Esta acción requiere el PIN de administrador.`}
        onConfirm={()=>{ setPinAnular(false); ejecutarAnulacion(motivoAnular); setMotivoAnular(null) }}
        onClose={()=>{ setPinAnular(false); setMotivoAnular(null) }}
      />}
      {resultDevolucion        && (
        <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.5)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:600}}>
          <div style={{background:'#fff',borderRadius:10,padding:24,width:400,textAlign:'center',boxShadow:'0 8px 32px rgba(0,0,0,0.3)'}}>
            <div style={{fontSize:39,marginBottom:6}}>↩</div>
            <div style={{fontWeight:800,fontSize:15,color:'#1a3a6b',marginBottom:4}}>DEVOLUCIÓN REGISTRADA</div>
            <div style={{fontSize:13,color:'#666',marginBottom:14,textAlign:'left',background:'#f4f6fb',border:'1px solid #c8d5ea',borderRadius:6,padding:'10px 12px'}}>
              <div><strong>{resultDevolucion.cantidad}</strong> × {resultDevolucion.descripcion} {resultDevolucion.talla?`(T:${resultDevolucion.talla})`:''}</div>
              <div>Valor devuelto: <strong>${fmt(resultDevolucion.valorDevolucion)}</strong></div>
              <div>Nuevo saldo de la nota: <strong style={{color:resultDevolucion.saldoNuevo>0?'#c62828':'#2e7d32'}}>${fmt(resultDevolucion.saldoNuevo)}</strong></div>
            </div>

            {resultDevolucion.vale ? (
              <div style={{background:'#fff8e1',border:'2px dashed #ffc107',borderRadius:8,padding:'14px 10px',marginBottom:14}}>
                <div style={{fontSize:12,fontWeight:700,color:'#856404',marginBottom:4}}><span style={{fontSize:16}}>🎫</span> SE GENERÓ UN VALE</div>
                <div style={{fontSize:22,fontWeight:900,color:'#856404',letterSpacing:1}}>{resultDevolucion.vale.codigo}</div>
                <div style={{fontSize:15,fontWeight:700,color:'#1a3a6b',marginTop:4}}>${fmt(resultDevolucion.vale.valor)}</div>
              </div>
            ) : (
              <div style={{background:'#e8f5e9',border:'1px solid #a5d6a7',borderRadius:8,padding:'10px 12px',marginBottom:14,fontSize:12,color:'#2e7d32'}}>
                Esta devolución se descontó directamente del saldo pendiente de la nota. No requiere vale.
              </div>
            )}

            <div style={{display:'flex',gap:8,justifyContent:'center'}}>
              <button onClick={()=>{
                  const r = resultDevolucion
                  const w=window.open('','_blank','width=320,height=600')
                  w.document.write(`
                    <html><head><meta charset="UTF-8"><title>Devolución ${r.nota}</title>
                    <style>
                      * { margin:0; padding:0; box-sizing:border-box; }
                      body { font-family:'Courier New', monospace; font-size:11px; width:280px; padding:8px; }
                      .centro { text-align:center; }
                      .bold { font-weight:bold; }
                      .grande { font-size:14px; }
                      .sep { border-top:1px dashed #000; margin:5px 0; }
                      .fila { display:flex; justify-content:space-between; }
                      .vale-codigo { font-size:20px; font-weight:bold; letter-spacing:2px; text-align:center; margin:4px 0; }
                      .vale-valor { font-size:15px; font-weight:bold; text-align:center; }
                      @page { size: 80mm auto; margin: 0; }
                      @media print { body { width:72mm; margin:0 auto; } }
                    </style></head><body>
                    <div class="centro bold grande">A TU MEDIDA</div>
                    <div class="centro">COMPROBANTE DE DEVOLUCIÓN</div>
                    <div class="sep"></div>
                    <div class="fila"><span>Nota origen:</span><span>${r.nota}</span></div>
                    <div class="fila"><span>Fecha:</span><span>${fmtFecha(r.fecha)}</span></div>
                    <div class="fila"><span>Cliente:</span><span>${(r.cliente||'').substring(0,20)}</span></div>
                    <div class="sep"></div>
                    <div class="fila bold"><span>Artículo</span><span>Cód. ${r.codartic}</span></div>
                    <div>${r.descripcion}${r.talla?' - T:'+r.talla:''}</div>
                    <div class="fila"><span>Cantidad devuelta:</span><span>${r.cantidad}</span></div>
                    <div class="fila bold"><span>Valor devuelto:</span><span>$${fmt(r.valorDevolucion)}</span></div>
                    <div class="sep"></div>
                    <div class="fila bold"><span>NUEVO SALDO NOTA</span><span>$${fmt(r.saldoNuevo)}</span></div>
                    ${r.vale ? `
                      <div class="sep"></div>
                      <div class="centro bold">🎫 VALE GENERADO</div>
                      <div class="vale-codigo">${r.vale.codigo}</div>
                      <div class="vale-valor">$${fmt(r.vale.valor)}</div>
                      <div class="centro" style="font-size:9px;margin-top:4px;">Válido como parte de pago en<br/>cualquier Nota de Entrega futura.</div>
                    ` : `
                      <div class="sep"></div>
                      <div class="fila"><span>Vale generado:</span><span>Ninguno</span></div>
                      <div class="centro" style="font-size:9px;">El valor se descontó directamente del saldo de la nota.</div>
                    `}
                    <div class="sep"></div>
                    <div class="centro" style="font-size:9px;">Conserve este comprobante</div>
                    <div style="height:6mm;"></div>
                    </body></html>`)
                  w.document.close(); w.focus(); setTimeout(()=>{w.print();w.close()},300)
                }} style={{background:'#1a3a6b',color:'#fff',border:'none',borderRadius:6,padding:'8px 16px',cursor:'pointer',fontWeight:700,fontSize:13}}>
                <span style={{fontSize:17}}>🖨</span> Imprimir comprobante
              </button>
              <button onClick={()=>setResultDevolucion(null)} style={{background:'#888',color:'#fff',border:'none',borderRadius:6,padding:'8px 16px',cursor:'pointer',fontWeight:700,fontSize:13}}>
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}
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
            {modoNueva    && !guardada && <span style={{...P.badgeNueva,background:'#2e7d32'}}><span style={{fontSize:13}}>➕</span> ADICIÓN</span>}
            {guardada     && !desbloqueada && !anulada && <span style={{...P.badgeNueva,background:'#1a3a6b'}}><span style={{fontSize:13}}>✅</span> GUARDADA</span>}
            {desbloqueada && <span style={{...P.badgeNueva,background:'#ffc107',color:'#333'}}><span style={{fontSize:13}}>🔓</span> EDICIÓN</span>}
            {anulada      && <span style={P.badgeAnul}>ANULADA</span>}
          </div>
          {onAyuda && <button onClick={onAyuda} title="Ayuda" style={P.btnAyuda}>❓</button>}
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
                  style={{...P.inp,width:32,padding:0,cursor:'pointer',textAlign:'center',flexShrink:0,fontSize:20,background:'#eef2ff'}}>
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
                  style={{...P.inp,width:32,padding:0,cursor:'pointer',textAlign:'center',flexShrink:0,fontSize:20,background:'#fff3cd'}}>✎</button>}
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
              <VendedorInput
                listaVend={listaVend} cedVend={cedVend}
                onChange={elegirVendedor} disabled={anulada && !desbloqueada}
              />
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
                  <FilaGrilla key={i} l={l} i={i}
                    anulada={anulada} guardada={guardada} modoNueva={modoNueva} desbloqueada={desbloqueada}
                    artIdx={artIdx} artSugg={artSugg}
                    upd={upd} quitarLinea={quitarLinea}
                    onChangeCodigo={onChangeCodigo} onEnterCodigo={onEnterCodigo}
                    buscarDesc={buscarDesc} elegirArt={elegirArt}
                    abrirDevolucion={abrirDevolucion}
                    precioSegunTipo={precioSegunTipo}
                    inputRef={el => inputRefs.current[i] = el}
                  />
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
              <IBtn src={WZNEW} onClick={nuevaNota} title="Nueva nota" disabled={modoNueva&&!(cliente||cliTxt||lineas.some(l=>l.codartic))}/>
              <IBtn src={WZSAVE}   onClick={guardar}       title="Guardar"     disabled={busy||(anulada&&!desbloqueada)}/>
              <IBtn src={WZUNDO}   onClick={revertirNueva} title="Revertir"    disabled={!modoNueva}/>
              {guardada && !anulada && !modoNueva && !desbloqueada && (
                <button onClick={()=>setModal('desbloquear')}
                  title="Desbloquear nota para edición"
                  style={{background:'#fff3cd',border:'1px solid #ffc107',borderRadius:6,padding:'0 13px',cursor:'pointer',fontSize:22,fontWeight:700,color:'#856404',height:52}}>
                  🔓
                </button>
              )}
              {desbloqueada && (
                <button onClick={()=>{setDesbloqueada(false);cargarDoc(nroDoc)}}
                  title="Bloquear nota (descartar cambios)"
                  style={{background:'#ffebee',border:'1px solid #ef9a9a',borderRadius:6,padding:'0 13px',cursor:'pointer',fontSize:22,fontWeight:700,color:'#c62828',height:52}}>
                  🔒
                </button>
              )}
              <IBtn src={WZDELETE} onClick={anularNota}    title={usuario?.rol==='admin' ? "Anular" : "Solo un administrador puede anular"} disabled={anulada||modoNueva||usuario?.rol!=='admin'}/>
            </div>
            <div style={P.btnFila}>
              <IBtn src={WZPRINT}      onClick={()=>setModal('print')} title="Imprimir"/>
              <IBtn src={WZUBICACION}  onClick={imprimirGuia}          title="Generar guía de envío"/>
              <IBtn src={WZCLOSE}      onClick={onClose}               title="Volver al menú"/>
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
              <BtnAcc onClick={abrirAbonos} icon="💵" disabled={busy}>Abonos</BtnAcc>
              <BtnAcc onClick={pagarTodo}   icon="💰" disabled={busy}>Pagar Todo</BtnAcc>
              <BtnAcc onClick={abrirVale}   icon="🎫" disabled={busy}>Aplicar Vale</BtnAcc>
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
      style={{background:'#eef2ff',border:'1px solid #c8d5ea',borderRadius:6,padding:6,cursor:disabled?'not-allowed':'pointer',opacity:disabled?0.35:1,display:'flex',alignItems:'center',justifyContent:'center',width:74,height:68}}>
      <img src={src} alt={title} style={{width:51,height:51,objectFit:'contain'}}/>
    </button>
  )
}
function BtnAcc({onClick,icon,children,disabled}){
  return(
    <button onClick={onClick} disabled={disabled}
      style={{background:disabled?'#f0f0f0':'#eef2ff',border:'1px solid #c8d5ea',borderRadius:8,padding:'7px 11px',cursor:disabled?'not-allowed':'pointer',opacity:disabled?0.5:1,fontSize:12,fontWeight:700,color:'#1a3a6b',display:'flex',alignItems:'center',gap:5}}>
      <span style={{fontSize:16}}>{icon}</span>{children}
    </button>
  )
}

// ── Selector de vendedor con búsqueda por nombre o cédula ──────────────
function VendedorInput({ listaVend, cedVend, onChange, disabled }) {
  const [txt,      setTxt]      = useState('')
  const [abierto,  setAbierto]  = useState(false)
  const [filtrado, setFiltrado] = useState([])
  const wrapRef = useRef(null)

  // texto a mostrar cuando hay uno seleccionado
  const seleccionado = listaVend.find(v => v.cedula === cedVend)
  const etiqueta     = seleccionado ? `${seleccionado.cedula} - ${seleccionado.nombre}` : ''

  // cerrar si se hace clic fuera
  useEffect(() => {
    function handleClick(e) { if (wrapRef.current && !wrapRef.current.contains(e.target)) setAbierto(false) }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  function abrir() {
    if (disabled) return
    setTxt(''); setFiltrado(listaVend); setAbierto(true)
  }

  function onInput(v) {
    setTxt(v)
    const q = v.toLowerCase()
    setFiltrado(listaVend.filter(x =>
      x.nombre.toLowerCase().includes(q) || (x.cedula||'').includes(q)
    ))
  }

  function elegir(v) {
    onChange(v.cedula); setAbierto(false); setTxt('')
  }

  function limpiar(e) {
    e.stopPropagation(); onChange(''); setAbierto(false); setTxt('')
  }

  return (
    <div ref={wrapRef} style={{position:'relative'}}>
      <div style={{display:'flex',gap:3}}>
        <div onClick={abrir} style={{...P.inp, flex:1, cursor:disabled?'not-allowed':'pointer',
          background:disabled?'#f0f4ff':'#fff', display:'flex', alignItems:'center',
          color: cedVend ? '#1a3a6b' : '#999', userSelect:'none', overflow:'hidden',
          whiteSpace:'nowrap', textOverflow:'ellipsis', paddingRight:4}}>
          {cedVend ? etiqueta : '-- Selecciona vendedor --'}
        </div>
        {cedVend && !disabled && (
          <button onClick={limpiar} title="Quitar vendedor"
            style={{...P.inp, width:24, padding:0, cursor:'pointer', textAlign:'center',
              background:'#fdecea', color:'#c62828', fontWeight:900, fontSize:17, flexShrink:0}}>
            ✕
          </button>
        )}
      </div>

      {abierto && (
        <div style={{position:'absolute',top:'100%',left:0,right:0,zIndex:200,
          background:'#fff',border:'1px solid #c8d5ea',borderRadius:5,
          boxShadow:'0 6px 20px rgba(0,0,0,0.15)',maxHeight:260,display:'flex',flexDirection:'column'}}>
          <input autoFocus value={txt} onChange={e=>onInput(e.target.value)}
            placeholder="Escribe nombre o cédula…"
            style={{border:'none',borderBottom:'1px solid #e0e7f0',padding:'6px 10px',
              fontSize:12,outline:'none',flexShrink:0}}/>
          <div style={{overflowY:'auto',flex:1}}>
            {filtrado.length === 0
              ? <div style={{padding:'10px',textAlign:'center',color:'#aaa',fontSize:12}}>Sin resultados</div>
              : filtrado.map(v=>(
                <div key={v.id} onClick={()=>elegir(v)}
                  style={{padding:'7px 10px',cursor:'pointer',fontSize:12,
                    borderBottom:'1px solid #f0f0f0',
                    background: v.cedula===cedVend ? '#e3f2fd' : 'transparent'}}>
                  <strong style={{color:'#1a3a6b'}}>{v.cedula}</strong> — {v.nombre}
                </div>
              ))
            }
          </div>
        </div>
      )}
    </div>
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
  btnAyuda:  {background:'rgba(255,255,255,0.2)',border:'1px solid rgba(255,255,255,0.4)',color:'#fff',borderRadius:'50%',width:36,height:36,cursor:'pointer',fontSize:18,flexShrink:0},
  alerta:    {margin:'6px 12px',padding:'8px 14px',borderRadius:6,fontSize:13,display:'flex',justifyContent:'space-between',alignItems:'center'},
  alertaX:   {background:'none',border:'none',cursor:'pointer',fontWeight:900,fontSize:21},
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
  btnX:      {background:'none',border:'none',color:'#c0392b',cursor:'pointer',fontSize:17,fontWeight:700},
  btnDev:    {background:'#fff3cd',border:'1px solid #ffc107',borderRadius:4,color:'#856404',cursor:'pointer',fontSize:16,fontWeight:700,padding:'1px 5px'},
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

// ── Fila memoizada de la grilla — solo se re-renderiza si cambian sus props ──
import { memo } from 'react'
const FilaGrilla = memo(function FilaGrilla({
  l, i, anulada, guardada, modoNueva, desbloqueada,
  artIdx, artSugg, upd, quitarLinea,
  onChangeCodigo, onEnterCodigo, buscarDesc, elegirArt,
  abrirDevolucion, precioSegunTipo, inputRef
}) {
  return (
    <tr style={{background:i%2===0?'#fff':'#f8faff'}}>
      <td style={{...P.td,textAlign:'center',color:'#aaa',width:26,fontSize:11}}>{l.codartic?i+1:''}</td>
      <td style={P.td}>
        <div style={{position:'relative'}}>
          <input ref={inputRef} style={{...P.ci,width:88}} value={l.codartic}
            onChange={e=>onChangeCodigo(e.target.value,i)}
            onKeyDown={e=>{if(e.key==='Enter'){e.preventDefault();onEnterCodigo(l.codartic,i)}}}
            placeholder="Código" disabled={anulada&&!desbloqueada}/>
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
          placeholder="Descripción" disabled={anulada&&!desbloqueada}/>
      </td>
      <td style={{...P.td,paddingLeft:4,fontSize:11,color:'#555'}}>{l.marca||''}</td>
      <td style={{...P.td,paddingLeft:4,fontSize:11,color:'#555'}}>{l.genero||''}</td>
      <td style={P.td}><input style={{...P.ci,width:46,textAlign:'center'}} value={l.talla} onChange={e=>upd(i,{talla:e.target.value})} disabled={anulada&&!desbloqueada}/></td>
      <td style={P.td}><input type="number" style={{...P.ci,width:60,textAlign:'right',fontSize:13,fontWeight:600}} value={l.cantidad} onChange={e=>upd(i,{cantidad:e.target.value})} disabled={anulada&&!desbloqueada} title="Usa cantidad negativa para registrar una devolución sin localizar la nota original"/></td>
      <td style={P.td}><input type="number" style={{...P.ci,width:96,textAlign:'right'}} value={l.valunit} min={0} onChange={e=>upd(i,{valunit:Number(e.target.value)})} disabled={anulada&&!desbloqueada}/></td>
      <td style={P.td}><input type="number" style={{...P.ci,width:46,textAlign:'right'}} value={l.porcdescue} min={0} max={100} onChange={e=>upd(i,{porcdescue:Number(e.target.value)})} disabled={anulada&&!desbloqueada}/></td>
      <td style={{...P.td,textAlign:'right',paddingRight:6,color:'#c0392b',fontSize:12}}>{l.valdescue?fmt(l.valdescue):''}</td>
      <td style={{...P.td,textAlign:'right',paddingRight:6,fontWeight:700,color:'#1a3a6b',fontSize:13}}>{l.valtotal?fmt(l.valtotal):''}</td>
      <td style={{...P.td,textAlign:'center',width:46}}>
        {l.codartic&&!anulada&&(!guardada||modoNueva||desbloqueada)&&<button onClick={()=>quitarLinea(i)} style={P.btnX} title="Quitar línea">✕</button>}
        {l.codartic&&!anulada&&l.id&&guardada&&!modoNueva&&!desbloqueada&&Number(l.cantidad)>0&&
          <button onClick={()=>abrirDevolucion(i)} style={P.btnDev} title="Devolver esta prenda">↩</button>}
      </td>
    </tr>
  )
})

// ── Modal artículo rápido (Punto 1) ─────────────────────────────────────
function ModalArticuloRapido({ supabase, cod, onConfirmar, onCancelar }) {
  const [form, setForm] = useState({ codartic:cod, descartic:'', cantidad:1, valunit:'', marca:'' })
  const [marcas, setMarcas] = useState([])
  const [modalMarca, setModalMarca] = useState(false)
  const set = (k,v) => setForm(p=>({...p,[k]:v}))

  useEffect(()=>{
    supabase.from('marcas').select('id,descmarca').order('descmarca')
      .then(({data})=>setMarcas(data||[]))
  },[supabase])

  function onMarcaGuardada(marca){
    setMarcas(prev=>[...prev,marca].sort((a,b)=>a.descmarca.localeCompare(b.descmarca)))
    set('marca',marca.descmarca)
    setModalMarca(false)
  }

  return (
    <div style={MS.fondo}>
      <div style={MS.modal}>
        <div style={MS.tit}><span style={{fontSize:20}}>⚠️</span> Artículo no encontrado</div>
        <p style={{fontSize:13,color:'#555',margin:'0 0 12px'}}>
          El código <strong>{cod}</strong> no está registrado. ¿Deseas crearlo y agregarlo a la nota?
        </p>
        <label style={MS.lbl}>Código
          <input style={MS.inp} value={form.codartic}
            onChange={e=>set('codartic',e.target.value)} placeholder="Código del artículo"/>
        </label>
        <label style={MS.lbl}>Descripción *
          <input autoFocus style={MS.inp} value={form.descartic}
            onChange={e=>set('descartic',e.target.value)} placeholder="Nombre del artículo"/>
        </label>
        <label style={MS.lbl}>Marca
          <div style={{display:'flex',gap:4}}>
            <select style={{...MS.inp,flex:1}} value={form.marca} onChange={e=>set('marca',e.target.value)}>
              <option value="">--</option>
              {marcas.map(m=><option key={m.id} value={m.descmarca}>{m.descmarca}</option>)}
            </select>
            <button type="button" onClick={()=>setModalMarca(true)} title="Nueva marca"
              style={{...MS.inp,width:28,padding:0,cursor:'pointer',textAlign:'center',flexShrink:0,background:'#e8f5e9',fontWeight:900,fontSize:14}}>+</button>
          </div>
        </label>
        <div style={{display:'flex',gap:10}}>
          <label style={{...MS.lbl,flex:1}}>Cantidad
            <input type="number" min={1} style={MS.inp} value={form.cantidad}
              onChange={e=>set('cantidad',e.target.value)}/>
          </label>
          <label style={{...MS.lbl,flex:1}}>Precio de venta *
            <input type="number" min={0} style={MS.inp} value={form.valunit}
              onChange={e=>set('valunit',e.target.value)} placeholder="0"/>
          </label>
        </div>
        <div style={{display:'flex',gap:8,justifyContent:'flex-end',marginTop:16}}>
          <button onClick={onCancelar} style={MS.btnCan}>Cancelar</button>
          <button onClick={()=>{
            if (!form.descartic.trim()) return
            if (!form.valunit || Number(form.valunit)<=0) return
            onConfirmar({...form, cantidad:Number(form.cantidad)||1, valunit:Number(form.valunit)})
          }} style={MS.btnOk}><span style={{fontSize:17}}>✅</span> Crear y agregar</button>
        </div>
      </div>
      {modalMarca && <ModalNuevaMarca supabase={supabase} onGuardar={onMarcaGuardada} onClose={()=>setModalMarca(false)}/>}
    </div>
  )
}

// ── Modal motivo de anulación (Punto 2) ──────────────────────────────────
const MOTIVOS_ANULACION = [
  'Error en factura — Datos del cliente',
  'Error en factura — Productos',
  'Pedido cancelado',
  'Factura duplicada',
  'Otra',
]
function ModalMotivoAnulacion({ onConfirmar, onCancelar }) {
  const [motivo, setMotivo] = useState(MOTIVOS_ANULACION[0])
  const [otro,   setOtro]   = useState('')
  const motivoFinal = motivo === 'Otra' ? (otro.trim()||'Otra') : motivo
  return (
    <div style={MS.fondo}>
      <div style={MS.modal}>
        <div style={MS.tit}><span style={{fontSize:20}}>🗑</span> Motivo de Anulación</div>
        <label style={MS.lbl}>Selecciona el motivo
          <select style={MS.inp} value={motivo} onChange={e=>setMotivo(e.target.value)}>
            {MOTIVOS_ANULACION.map(m=><option key={m} value={m}>{m}</option>)}
          </select>
        </label>
        {motivo==='Otra' && (
          <label style={MS.lbl}>Describe el motivo
            <input autoFocus style={MS.inp} value={otro}
              onChange={e=>setOtro(e.target.value)} placeholder="Escribe el motivo de anulación…"/>
          </label>
        )}
        <div style={{display:'flex',gap:8,justifyContent:'flex-end',marginTop:16}}>
          <button onClick={onCancelar} style={MS.btnCan}>Cancelar</button>
          <button onClick={()=>onConfirmar(motivoFinal)} style={{...MS.btnOk,background:'#c62828'}}>
            <span style={{fontSize:17}}>🗑</span> Confirmar anulación
          </button>
        </div>
      </div>
    </div>
  )
}

const MS = {
  fondo: {position:'fixed',inset:0,background:'rgba(0,0,0,0.55)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:500},
  modal: {background:'#fff',borderRadius:10,padding:22,width:400,boxShadow:'0 8px 32px rgba(0,0,0,0.3)',display:'flex',flexDirection:'column',gap:11},
  tit:   {fontSize:15,fontWeight:900,color:'#1a3a6b'},
  lbl:   {display:'flex',flexDirection:'column',gap:4,fontSize:11,fontWeight:700,color:'#1a3a6b'},
  inp:   {height:32,border:'1px solid #c8d5ea',borderRadius:4,padding:'0 10px',fontSize:13,outline:'none',marginTop:2},
  btnCan:{background:'#888',color:'#fff',border:'none',borderRadius:6,padding:'8px 18px',cursor:'pointer',fontWeight:700},
  btnOk: {background:'#1a3a6b',color:'#fff',border:'none',borderRadius:6,padding:'8px 18px',cursor:'pointer',fontWeight:700},
}
