// src/components/Cartera.jsx
// v3 — corrige bug anulada null, agrega abonos distribuidos entre notas

import { useState, useEffect, useRef } from 'react'
import ModalAbonos from './ModalAbonos'

const SUPA_URL = import.meta.env.VITE_SUPABASE_URL
const SUPA_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY

const fmt  = n => Number(n||0).toLocaleString('es-CO',{minimumFractionDigits:0,maximumFractionDigits:0})
const fmtM = n => '$' + fmt(n)
const hoy  = () => { const d=new Date(); return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0') }
// Formato DD/MM/AAAA (igual al sistema Fox viejo) — la fecha llega de Supabase en formato AAAA-MM-DD
const fmtFecha = f => { if (!f) return ''; const [y,m,d] = f.slice(0,10).split('-'); return `${d}/${m}/${y}` }
const normaliza   = s => (s||'').toString().normalize('NFD').replace(/\p{Diacritic}/gu,'').toLowerCase()
const diasDesde   = f => f ? Math.floor((new Date()-new Date(f))/(1000*60*60*24)) : 0
const colorMora   = d => d >= 90 ? '#c62828' : d >= 60 ? '#e65100' : d >= 30 ? '#f9a825' : '#2e7d32'
const bgMora      = d => d >= 90 ? '#fdecea' : d >= 60 ? '#fff3e0' : d >= 30 ? '#fffde7' : '#e8f5e9'

const TABS = [
  {id:'resumen', icon:'📋', label:'Resumen por Cliente'},
  {id:'detalle', icon:'🔍', label:'Detalle por Nota'},
]

export default function Cartera({ supabase, usuario, onClose }) {
  const [vendedores,  setVendedores]  = useState([])
  const [filtVend,    setFiltVend]    = useState('')
  const [filtCliente, setFiltCliente] = useState('')
  const [filtEstado,  setFiltEstado]  = useState('pendiente')
  const [filtMora,    setFiltMora]    = useState('todas')
  const [notas,       setNotas]       = useState([])
  const [resumen,     setResumen]     = useState([])
  const [totales,     setTotales]     = useState({valor:0,abonado:0,saldo:0})
  const [cargando,    setCargando]    = useState(false)
  const [generado,    setGenerado]    = useState(false)
  const [tab,         setTab]         = useState('resumen')

  // ── búsqueda dentro de los resultados ya generados (no dispara consulta nueva) ──
  const [busquedaPost,     setBusquedaPost]     = useState('')
  const [busquedaAplicada, setBusquedaAplicada] = useState('')

  // ── abonos ──
  const [clienteSelDrill, setClienteSelDrill] = useState(null)  // cliente seleccionado para ver sus notas
  const [sugerencias,    setSugerencias]    = useState([])          // autocomplete clientes
  const [showSuger,      setShowSuger]      = useState(false)
  const [notasSel,    setNotasSel]    = useState({})   // {numnotaent: true}
  const [valorAbono,  setValorAbono]  = useState('')
  const [medioAbono,  setMedioAbono]  = useState('E')
  const [tipoDescTotal, setTipoDescTotal] = useState('pct') // 'pct' | 'monto', descuento sobre lo que no cubre el abono
  const [valorDescTotal, setValorDescTotal] = useState('')
  const [distribucio, setDistribucio] = useState([])   // [{numnotaent, aplicar, descuento, saldo}]
  const [modoAbono,   setModoAbono]   = useState(false)
  const [guardandoA,  setGuardandoA]  = useState(false)
  const [msgAbono,    setMsgAbono]    = useState(null)
  const [notaAbonosSel, setNotaAbonosSel] = useState(null) // nota para ver su detalle de abonos

  const printRef = useRef()

  useEffect(() => {
    supabase.from('vendedores').select('cedula,nombre').order('nombre')
      .then(({data}) => setVendedores(data||[]))
    // vendedor ve solo sus notas
    // vendedor ve sus notas — la cédula se resuelve en generar()
  }, [])

  // ── GENERAR ──────────────────────────────────────────────────────────────
  async function generar() {
    setCargando(true); setGenerado(false); setModoAbono(false)
    setNotasSel({}); setDistribucio([]); setMsgAbono(null)
    setBusquedaPost(''); setBusquedaAplicada(''); setClienteSelDrill(null)

    // FIX: usar neq('anulada','S') en lugar de eq('anulada','N')
    // así captura null y cualquier valor distinto de 'S'
    let q = supabase.from('encnotaen')
      .select('numnotaent,fechanotae,fechavence,cedrifclie,nombreclie,cedvended,valtotal,valdescue,porcdescue,valabono,saldo,formapago,mediopago,anulada')
      .or('anulada.is.null,anulada.neq.S')
      .order('numnotaent', {ascending:true})

    // filtro vendedor
    const cedVend = filtVend
    if (cedVend) q = q.eq('cedvended', cedVend)

    // filtro estado
    if (filtEstado === 'pendiente') q = q.gt('saldo', 0)
    else if (filtEstado === 'pagada') q = q.lte('saldo', 0)

    // filtro cliente
    if (filtCliente.trim()) q = q.ilike('nombreclie', `%${filtCliente.trim()}%`)

    const {data, error} = await q.limit(5000)
    if (error) { console.error('Cartera error:', error); setTotales({valor:0,abonado:0,saldo:0}); setNotas([]); setResumen([]); setGenerado(true); setCargando(false); return }

    // el nombre guardado nota por nota (nombreclie) puede variar entre notas de un mismo cliente
    // (ej. cambios de razón social con el tiempo) — se usa el nombre completo y actual de la
    // tabla maestra `clientes` (no se toca en las recargas de Fox) para que coincida con el sistema viejo.
    // Excepción: cédulas genéricas ("99","999","5122603","9999980","32293713") comparten un registro
    // "CLIENTE GENERAL" en `clientes` para muchos compradores distintos — ahí el nombre real y
    // específico es el de la nota, no el de la tabla maestra.
    const {data: clientesData} = await supabase.from('clientes').select('cedula,nombre').limit(5000)
    const nombreClienteMap = {}
    ;(clientesData||[]).forEach(c => {
      if ((c.nombre||'').trim().toUpperCase() !== 'CLIENTE GENERAL') nombreClienteMap[c.cedula] = c.nombre
    })

    let resultado = (data||[]).map(n => ({
      ...n,
      nombreclie:  nombreClienteMap[n.cedrifclie] || n.nombreclie,
      diasNota:    diasDesde(n.fechanotae),
      diasVencido: n.fechavence ? Math.max(0, diasDesde(n.fechavence)) : 0,
    }))

    // filtro mora
    if (filtMora === 'mora30') resultado = resultado.filter(n => n.diasVencido >= 30)
    else if (filtMora === 'mora60') resultado = resultado.filter(n => n.diasVencido >= 60)
    else if (filtMora === 'mora90') resultado = resultado.filter(n => n.diasVencido >= 90)

    // orden: Vendedor + Cliente + Número de orden ascendente
    const vendMap = {}
    vendedores.forEach(v => { vendMap[v.cedula] = v.nombre })
    resultado.sort((a,b) => {
      const va = vendMap[a.cedvended] || a.cedvended || ''
      const vb = vendMap[b.cedvended] || b.cedvended || ''
      const cmpVend = va.localeCompare(vb)
      if (cmpVend !== 0) return cmpVend
      const cmpCli = (a.nombreclie||'').localeCompare(b.nombreclie||'')
      if (cmpCli !== 0) return cmpCli
      return a.numnotaent - b.numnotaent
    })

    setNotas(resultado)

    // resumen agrupado por cliente
    const mapa = {}
    resultado.forEach(n => {
      const k = n.cedrifclie || n.nombreclie || 'SIN CLIENTE'
      if (!mapa[k]) mapa[k] = {cedula:n.cedrifclie||'', nombre:n.nombreclie||'SIN NOMBRE', notas:0, valor:0, abonado:0, saldo:0, maxMora:0}
      mapa[k].notas++
      mapa[k].valor   += n.valtotal||0
      mapa[k].abonado += n.valabono||0
      mapa[k].saldo   += n.saldo||0
      mapa[k].maxMora  = Math.max(mapa[k].maxMora, n.diasVencido||0)
    })
    const res = Object.values(mapa).sort((a,b) => b.saldo - a.saldo)
    setResumen(res)

    const tot = resultado.reduce((acc,n) => ({
      valor:   acc.valor   + (n.valtotal||0),
      abonado: acc.abonado + (n.valabono||0),
      saldo:   acc.saldo   + (n.saldo||0),
    }), {valor:0,abonado:0,saldo:0})
    setTotales(tot)

    setGenerado(true); setCargando(false)
  }

  // ── SELECCIÓN DE NOTAS PARA ABONAR ───────────────────────────────────────
  function toggleNota(num) {
    setNotasSel(prev => {
      const nuevo = {...prev}
      if (nuevo[num]) delete nuevo[num]
      else nuevo[num] = true
      return nuevo
    })
    setDistribucio([])
    setMsgAbono(null)
  }

  function seleccionarTodas() {
    const sel = {}
    notas.filter(n => (n.saldo||0) > 0).forEach(n => { sel[n.numnotaent] = true })
    setNotasSel(sel)
    setDistribucio([])
  }

  function limpiarSeleccion() {
    setNotasSel({})
    setDistribucio([])
    setMsgAbono(null)
  }

  // ── AUTOCOMPLETE CLIENTE ─────────────────────────────────────────────────
  async function buscarClientes(texto) {
    setFiltCliente(texto)
    setClienteSelDrill(null)
    if (!texto || texto.length < 2) { setSugerencias([]); setShowSuger(false); return }
    const {data} = await supabase.from('encnotaen')
      .select('cedrifclie,nombreclie')
      .ilike('nombreclie', `%${texto}%`)
      .or('anulada.is.null,anulada.neq.S')
      .gt('saldo', 0)
      .limit(10)
    const unicos = {}
    ;(data||[]).forEach(n => { if(n.cedrifclie) unicos[n.cedrifclie] = n.nombreclie })
    setSugerencias(Object.entries(unicos).map(([ced,nom])=>({cedula:ced,nombre:nom})))
    setShowSuger(true)
  }

  function seleccionarSugerencia(s) {
    setFiltCliente(s.nombre)
    setSugerencias([])
    setShowSuger(false)
  }

  // ── DRILL-DOWN CLIENTE ────────────────────────────────────────────────────
  function verDetalleCliente(cliente) {
    setClienteSelDrill(cliente)
    setTab('detalle')
  }

  const notasFiltradas = (clienteSelDrill
    ? notas.filter(n => n.cedrifclie === clienteSelDrill.cedula)
    : notas
  ).filter(n => !busquedaAplicada || normaliza(n.nombreclie).includes(normaliza(busquedaAplicada)))

  const resumenFiltrado = !busquedaAplicada ? resumen : resumen.filter(c =>
    normaliza(c.nombre).includes(normaliza(busquedaAplicada)) || (c.cedula||'').includes(busquedaAplicada.trim())
  )
  const totalesResumenFiltrado = resumenFiltrado.reduce((acc,c) => ({
    notas:   acc.notas   + c.notas,
    valor:   acc.valor   + c.valor,
    abonado: acc.abonado + c.abonado,
    saldo:   acc.saldo   + c.saldo,
  }), {notas:0,valor:0,abonado:0,saldo:0})

  // ── IMPRIMIR CARTERA COMPLETA POR VENDEDOR ────────────────────────────────
  function imprimirCarteraCompleta() {
    const vendNombre = vendedores.find(v=>String(v.cedula)===String(filtVend))?.nombre || 'Todos los vendedores'
    const w = window.open('','_blank','width=1000,height=800')
    // Agrupar notas por cliente
    const porCliente = {}
    notas.forEach(n => {
      const k = n.cedrifclie || n.nombreclie || '?'
      if (!porCliente[k]) porCliente[k] = { cedula:n.cedrifclie||'', nombre:n.nombreclie||'', notas:[] }
      porCliente[k].notas.push(n)
    })
    const clientes = Object.values(porCliente).sort((a,b) => a.nombre.localeCompare(b.nombre))

    w.document.write(`<html><head><title>Cartera Vigente</title>
    <style>
      body{font-family:Arial,sans-serif;font-size:11px;margin:20px;}
      h2{color:#1a3a6b;text-align:center;margin:4px 0;}
      .sub{text-align:center;color:#555;margin-bottom:12px;font-size:11px;}
      .vendedor{font-size:13px;font-weight:900;color:#1a3a6b;text-align:center;margin-bottom:16px;border-bottom:2px solid #1a3a6b;padding-bottom:4px;}
      .cliente-header{background:#1a3a6b;color:#fff;padding:4px 8px;margin-top:14px;font-weight:700;font-size:11px;display:flex;justify-content:space-between;}
      table{width:100%;border-collapse:collapse;margin-bottom:2px;}
      th{background:#e8eaf6;color:#1a3a6b;padding:4px 8px;text-align:right;font-size:10px;font-weight:700;}
      th:first-child{text-align:left;}
      td{padding:4px 8px;border-bottom:1px solid #eee;text-align:right;font-size:11px;}
      td:first-child{text-align:left;}
      tr:nth-child(even){background:#f9f9f9;}
      .tot-cli{font-weight:900;background:#e8eaf6!important;font-size:11px;}
      .tot-gen{font-weight:900;background:#1a3a6b!important;color:#fff;font-size:12px;}
      .tot-gen td{color:#fff!important;}
      .mora-r{color:#c62828;font-weight:700;}
      .mora-o{color:#e65100;font-weight:700;}
      .mora-y{color:#f9a825;font-weight:700;}
      .mora-g{color:#2e7d32;}
      .nro-nota{cursor:pointer;text-decoration:underline;color:#1a3a6b!important;}
      #abonoOverlay{display:none;position:fixed;inset:0;background:rgba(0,0,0,0.5);align-items:center;justify-content:center;z-index:999;}
      #abonoModal{background:#fff;border-radius:8px;padding:18px;width:480px;max-height:80vh;overflow-y:auto;box-shadow:0 8px 32px rgba(0,0,0,0.3);text-align:left;}
      #abonoModal h3{margin:0 0 10px;color:#1a3a6b;font-size:14px;display:flex;justify-content:space-between;align-items:center;}
      #abonoModal .resumen{display:flex;justify-content:space-around;background:#f0f4ff;border-radius:6px;padding:8px 0;margin-bottom:10px;border:1px solid #c8d5ea;font-size:11px;}
      #abonoModal .resumen b{display:block;font-size:14px;}
      #abonoModal table{margin:0;}
      #abonoModal .cerrar{background:#e74c3c;color:#fff;border:none;border-radius:4px;padding:2px 8px;cursor:pointer;font-weight:700;font-size:14px;}
      @media print{body{margin:10px;}button{display:none!important;}#abonoOverlay{display:none!important;}}
    </style></head><body>
    <h2>CARTERA VIGENTE</h2>
    <div class="vendedor">VENDEDOR: ${vendNombre.toUpperCase()}</div>
    <div class="sub">Fecha: ${fmtFecha(hoy())} &nbsp;|&nbsp; ${clientes.length} clientes &nbsp;|&nbsp; ${notas.length} notas</div>
    <button onclick="window.print()" style="margin-bottom:14px;padding:6px 18px;background:#1a3a6b;color:#fff;border:none;border-radius:4px;cursor:pointer;font-size:12px;">🖨 Imprimir</button>`)

    clientes.forEach(cli => {
      const totVal = cli.notas.reduce((s,n)=>s+(n.valtotal||0),0)
      const totDct = cli.notas.reduce((s,n)=>s+(n.valdescue||0),0)
      const totAbo = cli.notas.reduce((s,n)=>s+(n.valabono||0),0)
      const totSal = cli.notas.reduce((s,n)=>s+(n.saldo||0),0)
      w.document.write(`
        <div class="cliente-header">
          <span>CLIENTE: ${cli.cedula} &nbsp;&nbsp; ${cli.nombre.toUpperCase()}</span>
          <span>SALDO: $${fmt(totSal)}</span>
        </div>
        <table>
          <thead><tr>
            <th style="text-align:left"># DOCTO.</th>
            <th style="text-align:left">FECHA</th>
            <th style="text-align:left">VENCIM</th>
            <th>MORA</th>
            <th>VALOR $</th>
            <th>$DCTO.</th>
            <th>$ABONO</th>
            <th>$SALDO</th>
          </tr></thead>
          <tbody>`)
      cli.notas.forEach(n => {
        const mora = n.diasVencido||0
        const clMora = mora>=90?'mora-r':mora>=60?'mora-o':mora>=30?'mora-y':'mora-g'
        w.document.write(`<tr>
          <td class="nro-nota" style="text-align:left;font-weight:700" onclick="verAbonos(${n.numnotaent})" title="Ver detalle de abonos">${n.numnotaent}</td>
          <td style="text-align:left">${fmtFecha(n.fechanotae)}</td>
          <td style="text-align:left">${fmtFecha(n.fechavence)}</td>
          <td class="${clMora}">${mora}</td>
          <td>$${fmt(n.valtotal)}</td>
          <td>${n.valdescue ? '$'+fmt(n.valdescue) : '0'}</td>
          <td>$${fmt(n.valabono)}</td>
          <td style="font-weight:700;color:#c62828">$${fmt(n.saldo)}</td>
        </tr>`)
      })
      w.document.write(`
          <tr class="tot-cli">
            <td colspan="4" style="text-align:right">$TOTAL CLIENTE</td>
            <td>$${fmt(totVal)}</td>
            <td>${totDct ? '$'+fmt(totDct) : '$0'}</td>
            <td>$${fmt(totAbo)}</td>
            <td style="color:#c62828">$${fmt(totSal)}</td>
          </tr>
          </tbody></table>`)
    })

    // Total general
    const totDescGeneral = notas.reduce((s,n)=>s+(n.valdescue||0),0)
    w.document.write(`
      <table style="margin-top:16px;">
        <tbody>
          <tr class="tot-gen">
            <td colspan="4" style="text-align:right;padding:6px 8px;">TOTAL GENERAL — ${clientes.length} clientes / ${notas.length} notas</td>
            <td style="padding:6px 8px;">$${fmt(totales.valor)}</td>
            <td style="padding:6px 8px;">$${fmt(totDescGeneral)}</td>
            <td style="padding:6px 8px;">$${fmt(totales.abonado)}</td>
            <td style="padding:6px 8px;">$${fmt(totales.saldo)}</td>
          </tr>
        </tbody>
      </table>

      <div id="abonoOverlay" onclick="if(event.target===this)cerrarAbonos()">
        <div id="abonoModal"></div>
      </div>
      <script>
        var NOTAS_INFO = ${JSON.stringify(
          Object.fromEntries(notas.map(n => [n.numnotaent, {
            nombreclie: n.nombreclie, valtotal: n.valtotal, valabono: n.valabono, saldo: n.saldo,
          }]))
        ).replace(/</g,'\\u003c')};
        var SUPA_URL = ${JSON.stringify(SUPA_URL)};
        var SUPA_KEY = ${JSON.stringify(SUPA_KEY)};
        function fmtN(n){ return Math.round(Number(n)||0).toLocaleString('es-CO'); }
        function cerrarAbonos(){ document.getElementById('abonoOverlay').style.display='none'; }
        function verAbonos(num){
          var info = NOTAS_INFO[num] || {};
          var modal = document.getElementById('abonoModal');
          modal.innerHTML = '<h3>💵 Abonos — Nota '+num+' ('+(info.nombreclie||'')+')<button class="cerrar" onclick="cerrarAbonos()">✕</button></h3>'
            + '<div class="resumen">'
            + '<div>TOTAL<b>$'+fmtN(info.valtotal)+'</b></div>'
            + '<div>ABONADO<b style="color:#2e7d32">$'+fmtN(info.valabono)+'</b></div>'
            + '<div>SALDO<b style="color:'+((info.saldo||0)>0?'#c0392b':'#2e7d32')+'">$'+fmtN(info.saldo)+'</b></div>'
            + '</div>'
            + '<div id="abonoLista">Cargando…</div>';
          document.getElementById('abonoOverlay').style.display='flex';
          fetch(SUPA_URL+'/rest/v1/detabonos?numnotaent=eq.'+num+'&select=fechaabono,valabono,mediopago,observacio&order=fechaabono.asc', {
            headers: { apikey: SUPA_KEY, Authorization: 'Bearer '+SUPA_KEY }
          }).then(function(r){ return r.json(); }).then(function(rows){
            var el = document.getElementById('abonoLista');
            if (!rows || !rows.length) { el.innerHTML = '<p style="color:#888;text-align:center">Sin abonos registrados.</p>'; return; }
            var html = '<table><thead><tr style="background:#dde3ee"><th style="text-align:left">Fecha</th><th style="text-align:right">Valor</th><th style="text-align:left">Medio</th><th style="text-align:left">Obs.</th></tr></thead><tbody>';
            rows.forEach(function(a){
              html += '<tr><td style="text-align:left">'+(a.fechaabono||'')+'</td><td style="text-align:right;color:#2e7d32;font-weight:700">$'+fmtN(a.valabono)+'</td><td style="text-align:left">'+(a.mediopago||'')+'</td><td style="text-align:left">'+(a.observacio||'')+'</td></tr>';
            });
            html += '</tbody></table>';
            el.innerHTML = html;
          }).catch(function(){
            document.getElementById('abonoLista').innerHTML = '<p style="color:#c62828;text-align:center">Error al cargar los abonos.</p>';
          });
        }
      </script>
    </body></html>`)
    w.document.close()
  }

  // ── DISTRIBUIR ABONO ──────────────────────────────────────────────────────
  // Aplica el valor disponible a las notas seleccionadas en orden cronológico;
  // el descuento (si hay) se reparte proporcionalmente sobre lo que queda sin cubrir con el abono.
  function distribuir() {
    setMsgAbono(null)
    const val = Number(valorAbono) || 0
    const descIngresado = Number(valorDescTotal) || 0
    if (val <= 0 && descIngresado <= 0) { setMsgAbono({ok:false, txt:'Ingresa un valor de abono y/o de descuento.'}); return }
    const seleccionadas = notas
      .filter(n => notasSel[n.numnotaent] && (n.saldo||0) > 0)
      .sort((a,b) => new Date(a.fechanotae) - new Date(b.fechanotae)) // cronológico

    if (!seleccionadas.length) { setMsgAbono({ok:false, txt:'Selecciona al menos una nota con saldo.'}); return }

    let disponible = val
    let dist = seleccionadas.map(n => {
      const saldo = n.saldo||0
      const aplicar = Math.min(disponible, saldo)
      disponible = Math.max(0, disponible - aplicar)
      return { numnotaent:n.numnotaent, nombreclie:n.nombreclie, valtotal:n.valtotal, valdescue:n.valdescue||0, saldo, aplicar, descuento:0 }
    })

    if (disponible > 0) {
      setMsgAbono({ok:false, txt:`⚠️ El abono ($${fmt(val)}) supera el saldo de las notas seleccionadas ($${fmt(val - disponible)}). Ajusta el valor.`})
    }

    // repartir descuento proporcionalmente sobre lo que NO cubre el abono
    if (descIngresado > 0) {
      const totalRestante = dist.reduce((s,d) => s + (d.saldo - d.aplicar), 0)
      const descGlobal = Math.min(
        tipoDescTotal === 'pct' ? totalRestante * descIngresado / 100 : descIngresado,
        totalRestante
      )
      dist = dist.map(d => {
        const restante = d.saldo - d.aplicar
        const descuento = totalRestante > 0 ? Math.round(descGlobal * (restante / totalRestante)) : 0
        return { ...d, descuento }
      })
    }

    setDistribucio(dist)
  }

  // ── GUARDAR ABONOS ────────────────────────────────────────────────────────
  async function guardarAbonos() {
    if (!distribucio.length) { setMsgAbono({ok:false, txt:'Primero distribuye el abono.'}); return }
    setGuardandoA(true); setMsgAbono(null)
    try {
      for (const d of distribucio) {
        if (d.aplicar <= 0 && d.descuento <= 0) continue
        if (d.aplicar > 0) {
          const {error:ea} = await supabase.from('detabonos').insert({
            numnotaent: String(d.numnotaent),
            fechaabono: hoy(),
            valabono:   d.aplicar,
            mediopago:  medioAbono,
            observacio: 'Abono cartera',
          })
          if (ea) throw ea
        }
        // actualizar saldo/total en encnotaen
        const notaActual = notas.find(n => n.numnotaent === d.numnotaent)
        const nuevoAbono   = (notaActual?.valabono||0) + d.aplicar
        const nuevoValTotal = (notaActual?.valtotal||0) - d.descuento
        const nuevoValDescue = (notaActual?.valdescue||0) + d.descuento
        const nuevoSaldo   = Math.max(0, nuevoValTotal - nuevoAbono)
        const nuevoPorcDescue = (nuevoValTotal + nuevoValDescue) > 0
          ? Number((nuevoValDescue / (nuevoValTotal + nuevoValDescue) * 100).toFixed(2))
          : 0
        const {error:eu} = await supabase.from('encnotaen').update({
          valabono:  nuevoAbono,
          valtotal:  nuevoValTotal,
          valdescue: nuevoValDescue,
          porcdescue: nuevoPorcDescue,
          saldo:     nuevoSaldo,
          fecultabon: hoy(),
        }).eq('numnotaent', String(d.numnotaent))
        if (eu) throw eu
      }
      const totalAplicado = distribucio.reduce((s,d) => s + d.aplicar, 0)
      const totalDescontado = distribucio.reduce((s,d) => s + (d.descuento||0), 0)
      const partes = []
      if (totalAplicado > 0) partes.push(`abono de $${fmt(totalAplicado)}`)
      if (totalDescontado > 0) partes.push(`descuento de $${fmt(totalDescontado)}`)
      setMsgAbono({ok:true, txt:`✅ Se aplicó ${partes.join(' y ')} a ${distribucio.filter(d=>d.aplicar>0||d.descuento>0).length} nota(s).`})
      setValorDescTotal('')
      setModoAbono(false)
      setNotasSel({})
      setDistribucio([])
      setValorAbono('')
      await generar() // recargar
    } catch(e) {
      setMsgAbono({ok:false, txt:'Error al guardar: ' + (e.message||e)})
    }
    setGuardandoA(false)
  }

  // ── IMPRIMIR ──────────────────────────────────────────────────────────────
  function imprimir(tipo) {
    const vendNombre = vendedores.find(v=>v.cedula===filtVend)?.nombre || 'Todos'
    const titulo = tipo === 'resumen'
      ? `CARTERA VIGENTE — RESUMEN\nVendedor: ${vendNombre}`
      : `CARTERA VIGENTE — DETALLE\nVendedor: ${vendNombre}`

    const filas = tipo === 'resumen'
      ? resumen.map(c => `${c.cedula}\t${c.nombre}\t${c.notas}\t${fmtM(c.valor)}\t${fmtM(c.abonado)}\t${fmtM(c.saldo)}\t${c.maxMora} días`).join('\n')
      : notas.map(n => `${n.numnotaent}\t${fmtFecha(n.fechanotae)}\t${n.nombreclie}\t${fmtM(n.valtotal)}\t${fmtM(n.valabono)}\t${fmtM(n.saldo)}\t${n.diasVencido} días`).join('\n')

    const w = window.open('','_blank','width=900,height=700')
    w.document.write(`<html><head><title>${titulo}</title>
    <style>body{font-family:Arial,sans-serif;font-size:12px;margin:20px}
    h2{color:#1a3a6b}table{width:100%;border-collapse:collapse}
    th{background:#1a3a6b;color:#fff;padding:6px 8px;text-align:left}
    td{padding:5px 8px;border-bottom:1px solid #eee}
    tr:nth-child(even){background:#f5f7ff}
    .tot{font-weight:bold;background:#e8eaf6!important}
    @media print{button{display:none}}</style></head><body>
    <h2>${titulo.replace('\n','<br>')}</h2>
    <p>Generado: ${new Date().toLocaleString('es-CO')} | Estado: ${filtEstado} | Mora: ${filtMora}</p>
    <button onclick="window.print()" style="margin-bottom:12px;padding:6px 18px;background:#1a3a6b;color:#fff;border:none;borderRadius:4px;cursor:pointer">🖨 Imprimir</button>`)

    if (tipo === 'resumen') {
      w.document.write(`<table><thead><tr><th>Cédula</th><th>Cliente</th><th>Notas</th><th>$ Valor</th><th>$ Abonado</th><th>$ Saldo</th><th>Días mora</th></tr></thead><tbody>`)
      resumen.forEach(c => {
        w.document.write(`<tr><td>${c.cedula}</td><td>${c.nombre}</td><td style="text-align:right">${c.notas}</td><td style="text-align:right">${fmtM(c.valor)}</td><td style="text-align:right">${fmtM(c.abonado)}</td><td style="text-align:right;color:#c62828;font-weight:bold">${fmtM(c.saldo)}</td><td style="text-align:right">${c.maxMora}</td></tr>`)
      })
      w.document.write(`<tr class="tot"><td colspan="2">TOTALES — ${resumen.length} clientes</td><td style="text-align:right">${notas.length}</td><td style="text-align:right">${fmtM(totales.valor)}</td><td style="text-align:right">${fmtM(totales.abonado)}</td><td style="text-align:right;color:#c62828">${fmtM(totales.saldo)}</td><td></td></tr>`)
    } else {
      w.document.write(`<table><thead><tr><th>Nota</th><th>Fecha</th><th>Vence</th><th>Cliente</th><th>$ Valor</th><th>$ Abonado</th><th>$ Saldo</th><th>Días nota</th><th>Días vencido</th></tr></thead><tbody>`)
      notas.forEach(n => {
        w.document.write(`<tr><td>${n.numnotaent}</td><td>${fmtFecha(n.fechanotae)}</td><td>${fmtFecha(n.fechavence)}</td><td>${n.nombreclie}</td><td style="text-align:right">${fmtM(n.valtotal)}</td><td style="text-align:right">${fmtM(n.valabono)}</td><td style="text-align:right;color:#c62828;font-weight:bold">${fmtM(n.saldo)}</td><td style="text-align:right">${n.diasNota}</td><td style="text-align:right;color:${colorMora(n.diasVencido)}">${n.diasVencido}</td></tr>`)
      })
      w.document.write(`<tr class="tot"><td colspan="4">TOTALES — ${notas.length} notas</td><td style="text-align:right">${fmtM(totales.valor)}</td><td style="text-align:right">${fmtM(totales.abonado)}</td><td style="text-align:right;color:#c62828">${fmtM(totales.saldo)}</td><td colspan="2"></td></tr>`)
    }
    w.document.write(`</tbody></table></body></html>`)
    w.document.close()
  }

  const notasSelArr = notas.filter(n => notasSel[n.numnotaent])
  const saldoSel    = notasSelArr.reduce((s,n) => s+(n.saldo||0), 0)

  return (
    <div style={S.wrap}>
      {/* HEADER */}
      <div style={S.header}>
        <div style={S.headerTxt}>
          <span style={S.headerTit}>CARTERA</span>
        </div>
        <button onClick={onClose} style={S.btnMenu}>← Menú</button>
      </div>

      {/* FILTROS */}
      <div style={S.filtros}>
        <Fld label="Vendedor" w={220}>
          <select style={S.inp} value={filtVend} onChange={e=>setFiltVend(e.target.value)}
            disabled={usuario?.rol==='vendedor'}>
            <option value="">— Todos —</option>
            {vendedores.map(v=><option key={v.cedula} value={v.cedula}>{v.nombre}</option>)}
          </select>
        </Fld>
        <Fld label="Cliente" w={220}>
          <div style={{position:'relative'}}>
            <input style={S.inp} value={filtCliente}
              onChange={e=>buscarClientes(e.target.value)}
              onBlur={()=>setTimeout(()=>setShowSuger(false),200)}
              onFocus={()=>filtCliente.length>=2&&setShowSuger(true)}
              placeholder="Escribe el nombre..." onKeyDown={e=>e.key==='Enter'&&generar()}/>
            {showSuger && sugerencias.length>0 && (
              <div style={{position:'absolute',top:34,left:0,right:0,background:'#fff',border:'1px solid #c8d5ea',borderRadius:5,boxShadow:'0 4px 12px rgba(0,0,0,0.15)',zIndex:100,maxHeight:200,overflowY:'auto'}}>
                {sugerencias.map(s=>(
                  <div key={s.cedula} onMouseDown={()=>seleccionarSugerencia(s)}
                    style={{padding:'7px 12px',cursor:'pointer',fontSize:12,borderBottom:'1px solid #eee'}}
                    onMouseEnter={e=>e.target.style.background='#eef2ff'}
                    onMouseLeave={e=>e.target.style.background='#fff'}>
                    <strong>{s.nombre}</strong> <span style={{color:'#888',fontSize:11}}>{s.cedula}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </Fld>
        <Fld label="Estado" w={140}>
          <select style={S.inp} value={filtEstado} onChange={e=>setFiltEstado(e.target.value)}>
            <option value="pendiente">Pendientes</option>
            <option value="pagada">Pagadas</option>
            <option value="todas">Todas</option>
          </select>
        </Fld>
        <Fld label="Mora mínima" w={140}>
          <select style={S.inp} value={filtMora} onChange={e=>setFiltMora(e.target.value)}>
            <option value="todas">Todas</option>
            <option value="mora30">+30 días</option>
            <option value="mora60">+60 días</option>
            <option value="mora90">+90 días</option>
          </select>
        </Fld>
        <div style={{display:'flex',alignItems:'flex-end',gap:8}}>
          <button onClick={generar} disabled={cargando} style={S.btnGenerar}>
            {cargando ? <><span style={{fontSize:17}}>⏳</span> Cargando…</> : <><span style={{fontSize:17}}>🔍</span> Generar</>}
          </button>
          {generado && <>
            <button onClick={()=>imprimir('resumen')} style={S.btnPrint}><span style={{fontSize:16}}>🖨</span> Resumen</button>
            <button onClick={()=>imprimir('detalle')} style={S.btnPrint}><span style={{fontSize:16}}>🖨</span> Detalle</button>
            <button onClick={imprimirCarteraCompleta} style={{...S.btnPrint,background:'#1a3a6b'}}><span style={{fontSize:16}}>📄</span> Cartera Completa</button>
          </>}
        </div>
      </div>

      {!generado && !cargando && (
        <div style={{textAlign:'center',padding:60,color:'#aab8d4',fontSize:14}}>
          Selecciona los filtros y presiona <strong>Generar</strong>
        </div>
      )}

      {generado && (
        <>
          {/* TOTALES RÁPIDOS */}
          <div style={S.totalBar}>
            <Tot label="Clientes" val={resumen.length}          color="#1a3a6b"/>
            <Tot label="Notas"    val={notas.length}            color="#e65100"/>
            <Tot label="$ Valor"  val={fmtM(totales.valor)}     color="#555"/>
            <Tot label="$ Abonado" val={fmtM(totales.abonado)}  color="#2e7d32"/>
            <Tot label="$ Saldo"  val={fmtM(totales.saldo)}     color="#c62828" grande/>
          </div>

          {/* BUSCAR CLIENTE DENTRO DE LOS RESULTADOS YA GENERADOS */}
          <div style={S.buscaResultados}>
            <input style={{...S.inp, maxWidth:280}} value={busquedaPost}
              placeholder="Buscar cliente en estos resultados..."
              onChange={e=>setBusquedaPost(e.target.value)}
              onKeyDown={e=>e.key==='Enter'&&setBusquedaAplicada(busquedaPost.trim())}/>
            <button onClick={()=>setBusquedaAplicada(busquedaPost.trim())} style={S.btnSel}>
              <span style={{fontSize:15}}>🔍</span> Buscar
            </button>
            {busquedaAplicada && (
              <>
                <span style={{fontSize:12,color:'#555'}}>
                  {resumenFiltrado.length} cliente(s) encontrados para "<strong>{busquedaAplicada}</strong>"
                </span>
                <button onClick={()=>{setBusquedaPost('');setBusquedaAplicada('')}} style={S.btnSel}>
                  <span style={{fontSize:13}}>✕</span> Limpiar
                </button>
              </>
            )}
          </div>

          {/* INDICADOR CLIENTE SELECCIONADO */}
          {clienteSelDrill && (
            <div style={{background:'#e8f0fe',padding:'6px 16px',fontSize:12,display:'flex',alignItems:'center',gap:12,borderBottom:'1px solid #c8d5ea'}}>
              <span><span style={{fontSize:15}}>🔍</span> Viendo notas de: <strong>{clienteSelDrill.nombre}</strong> ({clienteSelDrill.cedula})</span>
              <button onClick={()=>{setClienteSelDrill(null);setTab('resumen')}}
                style={{background:'#c62828',color:'#fff',border:'none',borderRadius:4,padding:'2px 10px',cursor:'pointer',fontSize:11}}>
                <span style={{fontSize:14}}>✕</span> Ver todos
              </button>
            </div>
          )}

          {/* TABS */}
          <div style={S.tabs}>
            {TABS.map(t=>(
              <button key={t.id} onClick={()=>setTab(t.id)}
                style={{...S.tab,...(tab===t.id?S.tabActivo:{})}}>
                <span style={{fontSize:17}}>{t.icon}</span> {t.label}
              </button>
            ))}
            {/* Botón abonar */}
            {(usuario?.rol==='admin'||usuario?.rol==='vendedor'||usuario?.rol==='cajera') && (
              <button onClick={()=>{setModoAbono(!modoAbono);setDistribucio([]);setMsgAbono(null)}}
                style={{...S.tab,marginLeft:'auto',background:modoAbono?'#1a3a6b':'#2e7d32',color:'#fff',border:'none'}}>
                <span style={{fontSize:17}}>💵</span> {modoAbono ? 'Cancelar abono' : 'Registrar abono'}
              </button>
            )}
          </div>

          {/* PANEL DE ABONOS */}
          {modoAbono && (
            <div style={S.abonoPanel}>
              <div style={S.abonoPanelTit}>
                <span style={{fontSize:17}}>💵</span> REGISTRAR ABONO — selecciona las notas y el valor total a distribuir
              </div>

              <div style={{display:'flex',gap:12,alignItems:'flex-end',flexWrap:'wrap',marginBottom:10}}>
                <Fld label="Valor total del abono" w={200}>
                  <input style={{...S.inp,fontWeight:700,fontSize:15}} type="number" min={0}
                    value={valorAbono} onChange={e=>setValorAbono(e.target.value)}
                    placeholder="$0" onKeyDown={e=>e.key==='Enter'&&distribuir()}/>
                </Fld>
                <Fld label="Medio de pago" w={150}>
                  <select style={S.inp} value={medioAbono} onChange={e=>setMedioAbono(e.target.value)}>
                    <option value="E">Efectivo</option>
                    <option value="T">Transferencia</option>
                    <option value="M">Mixto</option>
                  </select>
                </Fld>
                <Fld label="Tipo descuento" w={140}>
                  <select style={S.inp} value={tipoDescTotal} onChange={e=>setTipoDescTotal(e.target.value)}>
                    <option value="pct">Porcentaje (%)</option>
                    <option value="monto">Monto fijo ($)</option>
                  </select>
                </Fld>
                <Fld label={tipoDescTotal==='pct' ? 'Descuento (%)' : 'Descuento ($)'} w={160}>
                  <input style={{...S.inp,fontWeight:700,color:'#8e44ad'}} type="number" min={0}
                    value={valorDescTotal} onChange={e=>setValorDescTotal(e.target.value)}
                    placeholder="0" onKeyDown={e=>e.key==='Enter'&&distribuir()}/>
                </Fld>
                <div style={{display:'flex',gap:8}}>
                  <button onClick={seleccionarTodas} style={S.btnSel}>Seleccionar todas</button>
                  <button onClick={limpiarSeleccion} style={S.btnSel}>Limpiar selección</button>
                  <button onClick={distribuir} style={{...S.btnGenerar,background:'#1565c0'}}>
                    <span style={{fontSize:17}}>⚡</span> Distribuir
                  </button>
                </div>
              </div>

              {Object.keys(notasSel).length > 0 && (
                <div style={{fontSize:12,color:'#555',marginBottom:6}}>
                  {Object.keys(notasSel).length} nota(s) seleccionadas — Saldo total: <strong>{fmtM(saldoSel)}</strong>
                </div>
              )}

              {/* Resultado de distribución */}
              {distribucio.length > 0 && (
                <div style={S.distBox}>
                  <div style={{fontWeight:700,marginBottom:8,fontSize:13}}>Distribución propuesta:</div>
                  {distribucio.map(d=>(
                    <div key={d.numnotaent} style={S.distFila}>
                      <span style={{fontWeight:700}}>Nota #{d.numnotaent}</span>
                      <span style={{color:'#555'}}>{d.nombreclie}</span>
                      <span>Saldo: <strong>{fmtM(d.saldo)}</strong></span>
                      <span style={{color:'#2e7d32',fontWeight:700}}>Aplica: {fmtM(d.aplicar)}</span>
                      {d.descuento > 0 && <span style={{color:'#8e44ad',fontWeight:700}}>Descuento: {fmtM(d.descuento)}</span>}
                      <span style={{color: d.saldo-d.aplicar-(d.descuento||0)<=0?'#2e7d32':'#c62828'}}>
                        Resta: {fmtM(d.saldo-d.aplicar-(d.descuento||0))}
                      </span>
                    </div>
                  ))}
                  <div style={{marginTop:10,display:'flex',gap:10,alignItems:'center'}}>
                    <button onClick={guardarAbonos} disabled={guardandoA} style={S.btnGuardar}>
                      {guardandoA ? <><span style={{fontSize:17}}>⏳</span> Guardando…</> : <><span style={{fontSize:17}}>💾</span> Confirmar y guardar</>}
                    </button>
                    <span style={{fontSize:12,color:'#666'}}>
                      Total a aplicar: <strong>{fmtM(distribucio.reduce((s,d)=>s+d.aplicar,0))}</strong>
                      {distribucio.some(d=>d.descuento>0) && <> &nbsp;|&nbsp; Total descuento: <strong style={{color:'#8e44ad'}}>{fmtM(distribucio.reduce((s,d)=>s+(d.descuento||0),0))}</strong></>}
                    </span>
                  </div>
                </div>
              )}

              {msgAbono && (
                <div style={{...S.msg, ...(msgAbono.ok ? S.msgOk : S.msgErr)}}>{msgAbono.txt}</div>
              )}
            </div>
          )}

          {/* CONTENIDO TABS */}
          <div style={S.contenido}>
            {/* RESUMEN */}
            {tab==='resumen' && (
              <table style={S.tabla}>
                <thead>
                  <tr style={S.thead}>
                    {['Cédula','Cliente','Notas','$ Valor','$ Abonado','$ Saldo','Días mora'].map(h=>(
                      <th key={h} style={{...S.th,textAlign:['Notas','$ Valor','$ Abonado','$ Saldo','Días mora'].includes(h)?'right':'left'}}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {resumenFiltrado.length === 0
                    ? <tr><td colSpan={7} style={{textAlign:'center',padding:30,color:'#aaa'}}>{busquedaAplicada ? `Ningún cliente coincide con "${busquedaAplicada}".` : 'Sin resultados con esos filtros.'}</td></tr>
                    : resumenFiltrado.map((c,i) => (
                      <tr key={c.cedula||i}
                        onClick={()=>verDetalleCliente(c)}
                        style={{background:clienteSelDrill?.cedula===c.cedula?'#e8f0fe':i%2===0?'#fff':'#f5f7ff',cursor:'pointer'}}
                        title="Clic para ver detalle de notas">
                        <td style={S.td}>{c.cedula}</td>
                        <td style={{...S.td,fontWeight:600,color:'#1a3a6b',textDecoration:'underline'}}>{c.nombre}</td>
                        <td style={{...S.td,textAlign:'right'}}>{c.notas}</td>
                        <td style={{...S.td,textAlign:'right'}}>{fmtM(c.valor)}</td>
                        <td style={{...S.td,textAlign:'right',color:'#2e7d32'}}>{fmtM(c.abonado)}</td>
                        <td style={{...S.td,textAlign:'right',fontWeight:700,color:'#c62828'}}>{fmtM(c.saldo)}</td>
                        <td style={{...S.td,textAlign:'right'}}>
                          <span style={{background:bgMora(c.maxMora),color:colorMora(c.maxMora),padding:'2px 8px',borderRadius:10,fontWeight:700,fontSize:12}}>
                            {c.maxMora}
                          </span>
                        </td>
                      </tr>
                    ))
                  }
                </tbody>
                <tfoot>
                  <tr style={{background:'#e8eaf6',fontWeight:700}}>
                    <td style={S.td} colSpan={2}>TOTALES — {resumenFiltrado.length} clientes</td>
                    <td style={{...S.td,textAlign:'right'}}>{totalesResumenFiltrado.notas}</td>
                    <td style={{...S.td,textAlign:'right'}}>{fmtM(totalesResumenFiltrado.valor)}</td>
                    <td style={{...S.td,textAlign:'right',color:'#2e7d32'}}>{fmtM(totalesResumenFiltrado.abonado)}</td>
                    <td style={{...S.td,textAlign:'right',color:'#c62828'}}>{fmtM(totalesResumenFiltrado.saldo)}</td>
                    <td style={S.td}></td>
                  </tr>
                </tfoot>
              </table>
            )}

            {/* DETALLE */}
            {tab==='detalle' && (
              <table style={S.tabla}>
                <thead>
                  <tr style={S.thead}>
                    {modoAbono && <th style={{...S.th,fontSize:16}}>✓</th>}
                    {['Nota','Fecha','Vence','Cliente','$ Valor','$ Abonado','$ Saldo','Días nota','Días vencido'].map(h=>(
                      <th key={h} style={{...S.th,textAlign:['$ Valor','$ Abonado','$ Saldo','Días nota','Días vencido'].includes(h)?'right':'left'}}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {notasFiltradas.length === 0
                    ? <tr><td colSpan={modoAbono?10:9} style={{textAlign:'center',padding:30,color:'#aaa'}}>{busquedaAplicada ? `Ningún cliente coincide con "${busquedaAplicada}".` : 'Sin resultados con esos filtros.'}</td></tr>
                    : notasFiltradas.map((n,i) => {
                      const selec = !!notasSel[n.numnotaent]
                      return (
                        <tr key={n.numnotaent} style={{background:selec?'#e8f5e9':i%2===0?'#fff':'#f5f7ff',cursor:modoAbono?'pointer':'default'}}
                          onClick={()=>modoAbono&&(n.saldo||0)>0&&toggleNota(n.numnotaent)}>
                          {modoAbono && (
                            <td style={{...S.td,textAlign:'center'}}>
                              {(n.saldo||0)>0
                                ? <input type="checkbox" checked={selec} onChange={()=>toggleNota(n.numnotaent)} onClick={e=>e.stopPropagation()}/>
                                : <span style={{color:'#aaa',fontSize:10}}>pagada</span>
                              }
                            </td>
                          )}
                          <td style={{...S.td,fontWeight:700,color:'#1a3a6b',textDecoration:'underline',cursor:'pointer'}}
                            title="Ver detalle de abonos de esta nota"
                            onClick={e=>{e.stopPropagation(); setNotaAbonosSel(n)}}>{n.numnotaent}</td>
                          <td style={S.td}>{fmtFecha(n.fechanotae)}</td>
                          <td style={S.td}>{fmtFecha(n.fechavence)}</td>
                          <td style={S.td}>{n.nombreclie}</td>
                          <td style={{...S.td,textAlign:'right'}}>{fmtM(n.valtotal)}</td>
                          <td style={{...S.td,textAlign:'right',color:'#2e7d32'}}>{fmtM(n.valabono)}</td>
                          <td style={{...S.td,textAlign:'right',fontWeight:700,color:n.saldo>0?'#c62828':'#2e7d32'}}>{fmtM(n.saldo)}</td>
                          <td style={{...S.td,textAlign:'right',color:'#888'}}>{n.diasNota}</td>
                          <td style={{...S.td,textAlign:'right'}}>
                            {n.diasVencido > 0
                              ? <span style={{background:bgMora(n.diasVencido),color:colorMora(n.diasVencido),padding:'2px 8px',borderRadius:10,fontWeight:700,fontSize:11}}>{n.diasVencido}</span>
                              : <span style={{color:'#2e7d32',fontSize:11}}>vigente</span>
                            }
                          </td>
                        </tr>
                      )
                    })
                  }
                </tbody>
                <tfoot>
                  <tr style={{background:'#e8eaf6',fontWeight:700}}>
                    {modoAbono && <td style={S.td}></td>}
                    <td style={S.td} colSpan={4}>TOTALES — {notasFiltradas.length} notas</td>
                    <td style={{...S.td,textAlign:'right'}}>{fmtM(notasFiltradas.reduce((s,n)=>s+(n.valtotal||0),0))}</td>
                    <td style={{...S.td,textAlign:'right',color:'#2e7d32'}}>{fmtM(notasFiltradas.reduce((s,n)=>s+(n.valabono||0),0))}</td>
                    <td style={{...S.td,textAlign:'right',color:'#c62828'}}>{fmtM(notasFiltradas.reduce((s,n)=>s+(n.saldo||0),0))}</td>
                    <td style={S.td} colSpan={2}></td>
                  </tr>
                </tfoot>
              </table>
            )}
          </div>
        </>
      )}

      {notaAbonosSel && (
        <ModalAbonos
          supabase={supabase}
          nroDoc={notaAbonosSel.numnotaent}
          totalNota={notaAbonosSel.valtotal}
          totalAbonos={notaAbonosSel.valabono}
          onClose={async()=>{setNotaAbonosSel(null); await generar()}}
        />
      )}
    </div>
  )
}

// ── Sub-componentes ───────────────────────────────────────────────────────────
function Fld({label,w,children}){
  return(
    <div style={{display:'flex',flexDirection:'column',gap:4,width:w,flexShrink:0}}>
      <label style={{fontSize:11,fontWeight:700,color:'#5577aa',textTransform:'uppercase'}}>{label}</label>
      {children}
    </div>
  )
}
function Tot({label,val,color,grande}){
  return(
    <div style={{display:'flex',flexDirection:'column',alignItems:'center',gap:2}}>
      <span style={{fontSize:10,fontWeight:700,color:'#888',textTransform:'uppercase'}}>{label}</span>
      <span style={{fontSize:grande?18:14,fontWeight:900,color}}>{val}</span>
    </div>
  )
}

// ── Estilos ───────────────────────────────────────────────────────────────────
const S = {
  wrap:       {minHeight:'100vh',background:'#eef2f7',display:'flex',flexDirection:'column',fontFamily:'Arial,sans-serif'},
  header:     {background:'linear-gradient(90deg,#1a3a6b,#2c5fa8)',padding:'12px 20px',display:'flex',alignItems:'center',justifyContent:'space-between'},
  headerTxt:  {display:'flex',flexDirection:'column'},
  headerTit:  {color:'#fff',fontWeight:900,fontSize:18,letterSpacing:2},
  btnMenu:    {background:'rgba(255,255,255,0.15)',border:'1px solid rgba(255,255,255,0.3)',color:'#fff',borderRadius:6,padding:'6px 16px',cursor:'pointer',fontSize:13,fontWeight:700},
  filtros:    {display:'flex',flexWrap:'wrap',gap:12,padding:'14px 16px',background:'#fff',borderBottom:'1px solid #dde3ee',alignItems:'flex-end'},
  inp:        {height:32,border:'1px solid #c8d5ea',borderRadius:5,padding:'0 9px',fontSize:13,background:'#fff',outline:'none',width:'100%',color:'#1a3a6b',boxSizing:'border-box'},
  btnGenerar: {height:32,background:'#1a3a6b',color:'#fff',border:'none',borderRadius:6,padding:'0 18px',cursor:'pointer',fontSize:13,fontWeight:700,whiteSpace:'nowrap'},
  btnPrint:   {height:32,background:'#2e7d32',color:'#fff',border:'none',borderRadius:6,padding:'0 14px',cursor:'pointer',fontSize:12,fontWeight:700},
  btnSel:     {height:32,background:'#eef2ff',color:'#1a3a6b',border:'1px solid #c8d5ea',borderRadius:6,padding:'0 12px',cursor:'pointer',fontSize:12,fontWeight:600},
  btnGuardar: {height:36,background:'#2e7d32',color:'#fff',border:'none',borderRadius:6,padding:'0 20px',cursor:'pointer',fontSize:13,fontWeight:700},
  totalBar:   {display:'flex',gap:20,padding:'10px 20px',background:'#fff',borderBottom:'1px solid #dde3ee',flexWrap:'wrap'},
  buscaResultados: {display:'flex',gap:10,alignItems:'center',padding:'8px 20px',background:'#f5f7fb',borderBottom:'1px solid #dde3ee',flexWrap:'wrap'},
  tabs:       {display:'flex',gap:4,padding:'8px 16px',background:'#f5f7fb',borderBottom:'1px solid #dde3ee'},
  tab:        {padding:'7px 16px',border:'1px solid #c8d5ea',borderRadius:'6px 6px 0 0',background:'#fff',color:'#555',cursor:'pointer',fontSize:13,fontWeight:600},
  tabActivo:  {background:'#1a3a6b',color:'#fff',border:'1px solid #1a3a6b'},
  contenido:  {flex:1,overflowY:'auto',padding:'0 0 20px'},
  tabla:      {width:'100%',borderCollapse:'collapse',fontSize:13},
  thead:      {background:'#1a3a6b',position:'sticky',top:0,zIndex:2},
  th:         {padding:'8px 10px',fontWeight:700,color:'#fff',whiteSpace:'nowrap',fontSize:12},
  td:         {padding:'6px 10px',borderBottom:'1px solid #eee',verticalAlign:'middle'},
  // panel abonos
  abonoPanel: {background:'#f0f7ff',border:'1px solid #90caf9',margin:'8px 16px',borderRadius:8,padding:'14px 18px'},
  abonoPanelTit:{fontWeight:700,color:'#1565c0',marginBottom:10,fontSize:13},
  distBox:    {background:'#fff',border:'1px solid #c8d5ea',borderRadius:6,padding:'12px',marginTop:8},
  distFila:   {display:'flex',gap:16,padding:'5px 0',borderBottom:'1px solid #f0f0f0',fontSize:13,flexWrap:'wrap',alignItems:'center'},
  msg:        {borderRadius:6,padding:'8px 14px',fontSize:13,fontWeight:600,marginTop:8},
  msgOk:      {background:'#e8f5e9',color:'#2e7d32',border:'1px solid #a5d6a7'},
  msgErr:     {background:'#fdecea',color:'#c62828',border:'1px solid #ef9a9a'},
}
