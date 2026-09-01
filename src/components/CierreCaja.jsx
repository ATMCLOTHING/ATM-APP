import { useState } from 'react'
import { WZCLOSE, WZPRINT, WZLOCATE } from '../lib/assets'
import { fmtFecha } from '../lib/fecha'
import { fetchAll } from '../lib/fetchAll'

const fmt = n => Number(n||0).toLocaleString('es-CO',{minimumFractionDigits:0,maximumFractionDigits:0})

const normMedio = m => {
  if (!m) return 'efectivo'
  const v = String(m).trim().toUpperCase()
  if (v==='E' || v==='EFECTIVO')                   return 'efectivo'
  if (v==='T' || v==='TRANSFERENCIA')              return 'transferencia'
  if (v==='M' || v==='MIXTO')                      return 'mixto'
  if (v==='C' || v==='CREDITO' || v==='CRÉDITO')   return 'credito'
  return 'efectivo'
}

// cedvended con cédula larga = vendedor externo (no del mostrador)
const esVendedorExterno = cedv => {
  const n = Number(cedv)
  return n > 1000
}

// Suma todas las filas de un bloque (vendMostrador, vendExterno, porCaja) para obtener su subtotal
const sumarBloque = filas => Object.values(filas).reduce((s,v) => ({
  notas:        s.notas + v.notas,
  efectivo:     s.efectivo + v.efectivo,
  transferencia:s.transferencia + v.transferencia,
  mixto:        s.mixto + v.mixto,
  credito:      s.credito + v.credito,
  noAbonado:    s.noAbonado + v.noAbonado,
  total:        s.total + v.total,
  digital:      s.digital + (v.digital||0),
}), {notas:0,efectivo:0,transferencia:0,mixto:0,credito:0,noAbonado:0,total:0,digital:0})

const LABEL_CAJA = {
  'caja1': 'Caja 1', 'caja2': 'Caja 2', 'caja3': 'Caja 3',
  'admin': 'Admin',  'laura': 'Laura (vendedora)', 'prendas': 'Bodega',
  // históricos FoxPro
  'MARIA': 'María', 'ALEJA': 'Aleja', 'LAURA': 'Laura', 'CLAUDIA': 'Claudia',
}

const hoy  = () => { const d=new Date(); return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0') }
const ayer = () => { const d=new Date(); d.setDate(d.getDate()-1); return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0') }

// Lista de fechas 'YYYY-MM-DD' entre desde y hasta, ambas incluidas
const rangoFechas = (desde, hasta) => {
  const arr = []
  let d = new Date(desde+'T00:00:00')
  const fin = new Date(hasta+'T00:00:00')
  while (d <= fin) {
    arr.push(d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0'))
    d.setDate(d.getDate()+1)
  }
  return arr
}


export default function CierreCaja({ supabase, onClose, onAyuda }) {
  const [desde,    setDesde]    = useState(hoy())
  const [hasta,    setHasta]    = useState(hoy())
  const [datos,    setDatos]    = useState(null)
  const [cargando, setCargando] = useState(false)
  const [tab,      setTab]      = useState('consolidado')
  const [criterioVentasDia, setCriterioVentasDia] = useState('marca')

  async function generar() {
    setCargando(true)
    try {
      const notas = await fetchAll(() => supabase.from('encnotaen')
        .select('numnotaent,fechanotae,nombreclie,cedrifclie,cedvended,valtotal,valabono,saldo,formapago,mediopago,cantotal,codclient,usuario')
        .gte('fechanotae', desde).lte('fechanotae', hasta)
        .or('anulada.is.null,anulada.neq.S')
        .order('numnotaent', {ascending:true}))

      const numNotas = notas.map(n => n.numnotaent)
      let detalle = []
      if (numNotas.length > 0) {
        // .in() con miles de números en la URL puede fallar por longitud, así que se pide en
        // tandas de 300 notas; cada tanda igual se pagina con fetchAll por si trae >1000 artículos.
        const CHUNK = 300
        for (let i = 0; i < numNotas.length; i += CHUNK) {
          const tanda = numNotas.slice(i, i + CHUNK)
          const rows = await fetchAll(() => supabase.from('detnotaen')
            .select('numnotaent,codartic,descartic,marca,cantidad,valunit,valtotal')
            .in('numnotaent', tanda)
            .order('id', {ascending:true}))
          detalle = detalle.concat(rows)
        }
      }

      const {data:vends} = await supabase.from('vendedores').select('cedula,nombre')
      const vendMap = {}
      ;(vends||[]).forEach(v => { vendMap[String(v.cedula)] = v.nombre })

      const notasAyer = await fetchAll(() => supabase.from('encnotaen')
        .select('valtotal').gte('fechanotae', ayer()).lte('fechanotae', ayer())
        .or('anulada.is.null,anulada.neq.S')
        .order('numnotaent', {ascending:true}))

      // OJO: detabonos no tiene columna cedvended (solo encnotaen la tiene) — pedirla
      // rompía toda la consulta; antes fallaba en silencio y dejaba abonos en blanco.
      const abonos = await fetchAll(() => supabase.from('detabonos')
        .select('numnotaent,valabono,mediopago,fechaabono,usuario')
        .gte('fechaabono', desde).lte('fechaabono', hasta)
        .order('id', {ascending:true}))

      // Cartera pendiente: se trae SIEMPRE completa (sin filtrar por desde/hasta), porque una
      // deuda de un cliente no desaparece solo porque el rango de fechas del informe cambió.
      const carteraGlobal = await fetchAll(() => supabase.from('encnotaen')
        .select('numnotaent,fechanotae,nombreclie,cedrifclie,cedvended,valtotal,valabono,saldo')
        .or('anulada.is.null,anulada.neq.S').gt('saldo', 0)
        .order('numnotaent', {ascending:true}))
      const totalCarteraGlobal = carteraGlobal.reduce((s,n) => s+(n.saldo||0), 0)

      // Notas anuladas en el período
      const notasAnuladas = await fetchAll(() => supabase.from('encnotaen')
        .select('numnotaent,fechanotae,nombreclie,cedrifclie,valtotal,motivoanula,fechaanula,cedvended,usuario')
        .gte('fechanotae', desde).lte('fechanotae', hasta)
        .eq('anulada','S')
        .order('numnotaent', {ascending:false}))

      // Marca DIGITAL: se muestra aparte y no se suma al cierre de caja
      const digitalPorNota = {}
      let totalDigital = 0
      detalle.forEach(d => {
        if ((d.marca||'').trim().toUpperCase() === 'DIGITAL') {
          digitalPorNota[d.numnotaent] = (digitalPorNota[d.numnotaent]||0) + Number(d.valtotal||0)
          totalDigital += Number(d.valtotal||0)
        }
      })

      setDatos({ notas, detalle, vendMap, abonos, notasAyer, carteraGlobal, totalCarteraGlobal, digitalPorNota, totalDigital, notasAnuladas })
    } catch(e) { console.error(e) }
    setCargando(false)
  }

  // ── CONSOLIDADO ──────────────────────────────────────────────────────────
  // porVendedor: agrupa por cedvended (quién vendió)
  // porCaja: agrupa por usuario (en qué caja se registró)
  function calcConsolidado() {
    if (!datos) return null
    const { notas, vendMap, digitalPorNota } = datos

    const porVendedor = {}   // cedvended → totales
    const porCaja     = {}   // usuario   → totales
    const totales     = { efectivo:0, transferencia:0, mixto:0, credito:0, noAbonado:0, total:0, notas:0, digital:0 }

    const acum = (obj, key, n, val) => {
      if (!obj[key]) obj[key] = { efectivo:0, transferencia:0, mixto:0, credito:0, noAbonado:0, total:0, notas:0, digital:0 }
      const v     = obj[key]
      const medio = normMedio(n.mediopago)
      const esC   = n.formapago !== 'CONTADO' && (n.saldo||0) > 0
      const valDig = digitalPorNota[n.numnotaent]||0
      if (esC) { v.credito += n.valabono||0; v.noAbonado += n.saldo||0 }
      else {
        if (medio==='efectivo')           v.efectivo      += val
        else if (medio==='transferencia') v.transferencia += val
        else if (medio==='mixto')         v.mixto         += val
        else                              v.efectivo      += val
      }
      v.total += val
      v.digital += valDig
      v.notas++
    }

    notas.forEach(n => {
      const cedv  = String(n.cedvended||'')
      const usu   = (n.usuario||'').trim()
      const medio = normMedio(n.mediopago)
      const esC   = n.formapago !== 'CONTADO' && (n.saldo||0) > 0
      const valDig = digitalPorNota[n.numnotaent]||0
      const val   = (n.valtotal||0) - valDig   // excluye lo facturado en marca DIGITAL

      // Por vendedor (cedvended)
      const nomVend = cedv ? (vendMap[cedv] || `Vendedor ${cedv}`) : 'Sin vendedor'
      acum(porVendedor, nomVend, n, val)

      // Por caja (usuario)
      const nomCaja = LABEL_CAJA[usu] || usu || 'Sin caja'
      acum(porCaja, nomCaja, n, val)

      // Totales generales
      totales.total += val
      totales.digital += valDig
      totales.notas++
      if (esC) { totales.credito += n.valabono||0; totales.noAbonado += n.saldo||0 }
      else {
        if (medio==='efectivo')           totales.efectivo      += val
        else if (medio==='transferencia') totales.transferencia += val
        else if (medio==='mixto')         totales.mixto         += val
        else                              totales.efectivo      += val
      }
    })

    // Separar vendedores externos de vendedoras de mostrador
    const vendExterno  = {}
    const vendMostrador = {}
    Object.entries(porVendedor).forEach(([nom, v]) => {
      // Buscar la cédula original para saber si es externo
      const cedv = Object.keys(vendMap).find(k => vendMap[k] === nom) || ''
      if (esVendedorExterno(cedv)) vendExterno[nom] = v
      else vendMostrador[nom] = v
    })

    return {
      porVendedor, vendMostrador, vendExterno, porCaja, totales,
      subtotalMostrador: sumarBloque(vendMostrador),
      subtotalExterno:   sumarBloque(vendExterno),
    }
  }

  // ── VENTAS POR MARCA ──────────────────────────────────────────────────────
  function calcMarcas() {
    if (!datos) return null
    const porMarca = {}
    datos.detalle.forEach(d => {
      const marca = (d.marca||'').trim() || 'SIN MARCA'
      if (!porMarca[marca]) porMarca[marca] = { unidades:0, total:0 }
      porMarca[marca].unidades += Number(d.cantidad)||0
      porMarca[marca].total    += Number(d.valtotal)||0
    })
    return porMarca
  }

  // ── RESUMEN DEL DÍA ───────────────────────────────────────────────────────
  function calcResumen() {
    if (!datos) return null
    const { notas, abonos, notasAyer, digitalPorNota, totalDigital } = datos

    let totalVentas=0, totalCredito=0, totalContado=0
    let totalEfectivo=0, totalTransferencia=0, totalMixto=0

    notas.forEach(n => {
      const valDig = digitalPorNota[n.numnotaent]||0
      const val   = (n.valtotal||0) - valDig   // excluye lo facturado en marca DIGITAL
      const medio = normMedio(n.mediopago)
      const esC   = n.formapago !== 'CONTADO' && (n.saldo||0) > 0
      totalVentas += val
      if (esC) { totalCredito += val }
      else {
        totalContado += val
        if (medio==='efectivo')           totalEfectivo      += val
        else if (medio==='transferencia') totalTransferencia += val
        else if (medio==='mixto')         totalMixto         += val
        else                              totalEfectivo      += val
      }
    })

    // Excluir abonos con mediopago='Vale' — no es dinero real que ingresó
    const abonosReales = abonos.filter(a => (a.mediopago||'').trim().toLowerCase() !== 'vale')
    const totalAbonosCredito = abonosReales.reduce((s,a) => s+(a.valabono||0), 0)
    const totalValesAplicados = abonos.filter(a => (a.mediopago||'').trim().toLowerCase() === 'vale')
                                      .reduce((s,a) => s+(a.valabono||0), 0)
    const totalAyer          = notasAyer.reduce((s,n) => s+(n.valtotal||0), 0)
    const totalIngresado     = totalEfectivo + totalTransferencia + totalMixto + totalAbonosCredito

    return {
      totalVentas, totalCredito, totalContado,
      totalEfectivo, totalTransferencia, totalMixto,
      totalIngresado, totalAbonosCredito, totalAyer,
      totalPendiente: datos.totalCarteraGlobal||0,
      totalDigital: totalDigital||0,
      totalValesAplicados,
      cantNotas: notas.length
    }
  }

  // ── TOP ARTÍCULOS ─────────────────────────────────────────────────────────
  function calcTopArticulos() {
    if (!datos) return []
    const map = {}
    datos.detalle.forEach(d => {
      if (!map[d.codartic]) map[d.codartic] = { codartic:d.codartic, descartic:d.descartic, unidades:0, total:0 }
      map[d.codartic].unidades += Number(d.cantidad)||0
      map[d.codartic].total    += Number(d.valtotal)||0
    })
    return Object.values(map).sort((a,b) => b.total-a.total).slice(0,10)
  }

  // ── CARTERA PENDIENTE POR VENDEDOR ────────────────────────────────────────
  // Resumen de toda la cartera pendiente (saldo>0, sin filtrar por fecha) agrupado por el
  // vendedor que hizo la nota (cedvended): una fila por vendedor con sus totales.
  function calcCarteraPorVendedor() {
    if (!datos) return []
    const { carteraGlobal, vendMap } = datos
    const porVend = {}
    ;(carteraGlobal||[]).forEach(n => {
      const cedv = String(n.cedvended||'')
      const nombre = cedv ? (vendMap[cedv] || `Vendedor ${cedv}`) : 'Sin vendedor asignado'
      if (!porVend[nombre]) porVend[nombre] = { notas:0, totalSaldo:0, totalAbonado:0, totalFacturado:0, sumaDias:0, ultimaFecha:null }
      const v = porVend[nombre]
      const diasVencido = Math.floor((new Date()-new Date(n.fechanotae))/(1000*60*60*24))
      v.notas++
      v.totalSaldo     += n.saldo||0
      v.totalAbonado   += n.valabono||0
      v.totalFacturado += n.valtotal||0
      v.sumaDias       += diasVencido
      if (!v.ultimaFecha || n.fechanotae > v.ultimaFecha) v.ultimaFecha = n.fechanotae
    })
    return Object.entries(porVend)
      .map(([nombre, v]) => ({ nombre, ...v, promedioDias: v.notas>0 ? Math.round(v.sumaDias/v.notas) : 0 }))
      .sort((a,b) => b.totalSaldo-a.totalSaldo)
  }

  // ── VENTAS POR CLIENTE ────────────────────────────────────────────────────
  function calcVentasCliente() {
    if (!datos) return { mostrador:[], clientes:[], totMostrador:0 }
    const MOSTRADOR = ['99','9','999','5031']
    const esMost = n => MOSTRADOR.includes(String(n.codclient||'').trim()) || MOSTRADOR.includes(String(n.cedrifclie||'').trim())
    const mostrador = datos.notas.filter(esMost)
    const clientes  = datos.notas.filter(n => !esMost(n))
    const map = {}
    clientes.forEach(n => {
      const k = String(n.cedrifclie||n.codclient||'?')
      if (!map[k]) map[k] = { cedula:k, nombre:n.nombreclie, notas:0, total:0, abonado:0, saldo:0 }
      map[k].notas++; map[k].total += n.valtotal||0; map[k].abonado += n.valabono||0; map[k].saldo += n.saldo||0
    })
    return { mostrador, clientes:Object.values(map).sort((a,b)=>b.total-a.total), totMostrador:mostrador.reduce((s,n)=>s+(n.valtotal||0),0) }
  }

  // ── DINERO INGRESADO POR DÍA ──────────────────────────────────────────────
  // Igual lógica que calcResumen(), pero discriminado día por día dentro del rango.
  function calcDineroPorDia() {
    if (!datos) return []
    const { notas, abonos, digitalPorNota } = datos
    const porDia = {}
    rangoFechas(desde, hasta).forEach(f => { porDia[f] = { fecha:f, notas:0, efectivo:0, transferencia:0, mixto:0, credito:0, abonosCartera:0, valesAplicados:0, totalVentas:0, totalIngresado:0 } })
    const get = f => { if (!porDia[f]) porDia[f] = { fecha:f, notas:0, efectivo:0, transferencia:0, mixto:0, credito:0, abonosCartera:0, valesAplicados:0, totalVentas:0, totalIngresado:0 }; return porDia[f] }

    notas.forEach(n => {
      const d = get(n.fechanotae)
      const valDig = digitalPorNota[n.numnotaent]||0
      const val   = (n.valtotal||0) - valDig
      const medio = normMedio(n.mediopago)
      const esC   = n.formapago !== 'CONTADO' && (n.saldo||0) > 0
      d.notas++
      d.totalVentas += val
      if (esC) { d.credito += val }
      else {
        if (medio==='efectivo')           d.efectivo      += val
        else if (medio==='transferencia') d.transferencia += val
        else if (medio==='mixto')         d.mixto         += val
        else                              d.efectivo      += val
      }
    })

    abonos.forEach(a => {
      const d = get(a.fechaabono)
      if ((a.mediopago||'').trim().toLowerCase()==='vale') { d.valesAplicados += a.valabono||0; return }
      d.abonosCartera += a.valabono||0
    })

    return Object.values(porDia).map(d => ({ ...d, totalIngresado: d.efectivo+d.transferencia+d.mixto+d.abonosCartera }))
      .sort((a,b) => a.fecha.localeCompare(b.fecha))
  }

  // ── VENTAS POR DÍA, AGRUPADAS POR MARCA O POR REFERENCIA (a elección) ─────
  function calcVentasPorDia(criterio) {
    if (!datos) return []
    const { notas, detalle } = datos
    const fechaPorNota = {}
    notas.forEach(n => { fechaPorNota[n.numnotaent] = n.fechanotae })

    const porDia = {}
    rangoFechas(desde, hasta).forEach(f => { porDia[f] = { fecha:f, items:{}, totalUnidades:0, totalVenta:0 } })

    detalle.forEach(d => {
      const f = fechaPorNota[d.numnotaent]
      if (!f) return
      if (!porDia[f]) porDia[f] = { fecha:f, items:{}, totalUnidades:0, totalVenta:0 }
      const dia = porDia[f]
      const key = criterio==='referencia' ? `${d.codartic} — ${d.descartic}` : ((d.marca||'').trim() || 'SIN MARCA')
      if (!dia.items[key]) dia.items[key] = { unidades:0, total:0 }
      dia.items[key].unidades += Number(d.cantidad)||0
      dia.items[key].total    += Number(d.valtotal)||0
      dia.totalUnidades += Number(d.cantidad)||0
      dia.totalVenta    += Number(d.valtotal)||0
    })

    return Object.values(porDia).sort((a,b) => a.fecha.localeCompare(b.fecha))
  }

  const cons      = calcConsolidado()
  const marcas    = calcMarcas()
  const resumen   = calcResumen()
  const topArts   = calcTopArticulos()
  const carteraPorVend = calcCarteraPorVendedor()
  const ventasCli = calcVentasCliente()
  const dineroPorDia = calcDineroPorDia()
  const ventasPorDia = calcVentasPorDia(criterioVentasDia)

  // ── HELPERS IMPRESIÓN ─────────────────────────────────────────────────────
  // @page con orientación explícita: sin esto, el navegador puede reusar la orientación de la
  // última impresión (p.ej. si el usuario imprimió antes un reporte ancho en horizontal), y estos
  // reportes saldrían volteados aunque el preview se vea bien. "landscape" para las tablas de
  // muchas columnas, "portrait" para las más angostas.
  const estilosImp = (orientacion='portrait') => `
    @page { size: letter ${orientacion}; margin: 10mm; }
    body{font-family:Arial,sans-serif;font-size:11px;padding:20px;}
    h2,h3{color:#1a3a6b;text-align:center;margin:8px 0;}
    .sub{text-align:center;color:#555;margin-bottom:12px;}
    table{width:100%;border-collapse:collapse;margin-bottom:18px;}
    th{background:#1a3a6b;color:#fff;padding:6px 8px;text-align:right;font-size:10px;}
    th:first-child{text-align:left;}
    td{padding:5px 8px;border-bottom:1px solid #eee;text-align:right;}
    td:first-child{text-align:left;}
    tr:nth-child(even){background:#f5f7fc;}
    .tot{font-weight:900;background:#dde3ee!important;}
    .sec{background:#e8eaf6;font-weight:700;font-size:11px;}
    @media print{body{padding:8px;}}
  `

  const filaTabla = (nom, v) => `
    <tr>
      <td>${nom}</td>
      <td>${v.notas}</td>
      <td>${v.efectivo?'$'+fmt(v.efectivo):''}</td>
      <td>${v.transferencia?'$'+fmt(v.transferencia):''}</td>
      <td>${v.mixto?'$'+fmt(v.mixto):''}</td>
      <td>${v.credito?'$'+fmt(v.credito):''}</td>
      <td style="color:#c62828">${v.noAbonado?'$'+fmt(v.noAbonado):''}</td>
      <td><b>$${fmt(v.total)}</b></td>
    </tr>`

  const cabeceraTabla = (titulo) => `
    <tr class="sec"><td colspan="8">${titulo}</td></tr>
    <tr style="background:#1a3a6b">
      <th style="text-align:left">NOMBRE</th><th>NOTAS</th><th>EFECTIVO</th>
      <th>TRANSF.</th><th>MIXTO</th><th>CRÉDITO</th><th>NO ABONADO</th><th>TOTAL</th>
    </tr>`

  const filaSubtotal = (etiqueta, v) => `
    <tr style="background:#eef2ff;font-style:italic;font-weight:800">
      <td>Subtotal ${etiqueta}</td>
      <td>${v.notas}</td>
      <td>${v.efectivo?'$'+fmt(v.efectivo):''}</td>
      <td>${v.transferencia?'$'+fmt(v.transferencia):''}</td>
      <td>${v.mixto?'$'+fmt(v.mixto):''}</td>
      <td>${v.credito?'$'+fmt(v.credito):''}</td>
      <td style="color:#c62828">${v.noAbonado?'$'+fmt(v.noAbonado):''}</td>
      <td><b>$${fmt(v.total)}</b></td>
    </tr>`

  function imprimirConsolidado() {
    if (!cons) return
    const w = window.open('','_blank','width=1000,height=700')
    w.document.write(`<html><head><meta charset="UTF-8"><title>Consolidado</title><style>${estilosImp('landscape')}</style></head><body>
    <h2>ATM — CONSOLIDADO DE MOVIMIENTOS</h2>
    <div class="sub">DESDE ${fmtFecha(desde)} &nbsp;&nbsp; HASTA ${fmtFecha(hasta)}</div>
    <table>
      <tbody>
        ${cabeceraTabla('VENTAS POR VENDEDORA DE MOSTRADOR')}
        ${Object.entries(cons.vendMostrador).sort((a,b)=>b[1].total-a[1].total).map(([n,v])=>filaTabla(n,v)).join('')}
        ${Object.keys(cons.vendMostrador).length ? filaSubtotal('mostrador', cons.subtotalMostrador) : ''}
        ${Object.keys(cons.vendExterno).length ? cabeceraTabla('VENTAS POR VENDEDOR EXTERNO') + Object.entries(cons.vendExterno).map(([n,v])=>filaTabla(n,v)).join('') + filaSubtotal('vendedores externos', cons.subtotalExterno) : ''}
        ${cabeceraTabla('TOTALES POR CAJA')}
        ${Object.entries(cons.porCaja).map(([n,v])=>filaTabla(n,v)).join('')}
        ${Object.keys(cons.porCaja).length ? filaSubtotal('por caja', sumarBloque(cons.porCaja)) : ''}
        <tr class="tot">
          <td>TOTALES GENERALES</td>
          <td>${cons.totales.notas}</td>
          <td>${cons.totales.efectivo?'$'+fmt(cons.totales.efectivo):''}</td>
          <td>${cons.totales.transferencia?'$'+fmt(cons.totales.transferencia):''}</td>
          <td>${cons.totales.mixto?'$'+fmt(cons.totales.mixto):''}</td>
          <td>${cons.totales.credito?'$'+fmt(cons.totales.credito):''}</td>
          <td style="color:#c62828">${cons.totales.noAbonado?'$'+fmt(cons.totales.noAbonado):''}</td>
          <td><b>$${fmt(cons.totales.total)}</b></td>
        </tr>
      </tbody>
    </table>
    <div style="display:flex;gap:12px;margin-bottom:14px;">
      <div style="flex:1;background:#e8f5e9;border:1px dashed #2e7d32;border-radius:6px;padding:10px 14px;font-weight:700;color:#1b5e20;display:flex;justify-content:space-between;">
        <span>👗 TOTAL VENTAS MOSTRADOR</span><span>$${fmt(cons.subtotalMostrador.total)}</span>
      </div>
      ${Object.keys(cons.vendExterno).length ? `<div style="flex:1;background:#e3f2fd;border:1px dashed #1565c0;border-radius:6px;padding:10px 14px;font-weight:700;color:#0d47a1;display:flex;justify-content:space-between;">
        <span>👤 TOTAL VENTAS VENDEDORES EXTERNOS</span><span>$${fmt(cons.subtotalExterno.total)}</span>
      </div>` : ''}
    </div>
    <div style="background:#ede7f6;border:1px dashed #7e57c2;border-radius:6px;padding:10px 14px;font-weight:700;color:#4527a0;display:flex;justify-content:space-between;">
      <span>📲 MARCA DIGITAL (no incluida en el cierre de caja)</span><span>$${fmt(cons.totales.digital)}</span>
    </div>
    </body></html>`)
    w.document.close(); w.focus(); setTimeout(()=>{w.print();w.close()},400)
  }

  function imprimirMarcas() {
    if (!marcas) return
    const w = window.open('','_blank','width=700,height=500')
    w.document.write(`<html><head><meta charset="UTF-8"><title>Marcas</title><style>${estilosImp('portrait')}</style></head><body>
    <h2>ATM — VENTAS POR MARCA</h2>
    <div class="sub">DESDE ${fmtFecha(desde)} &nbsp;&nbsp; HASTA ${fmtFecha(hasta)}</div>
    <table><thead><tr><th style="text-align:left">Marca</th><th>Unidades</th><th>$ Promedio</th><th>$ Total</th></tr></thead><tbody>
    ${Object.entries(marcas).sort((a,b)=>b[1].total-a[1].total).map(([m,v])=>`
      <tr><td>${m}</td><td>${v.unidades}</td><td>$${fmt(v.unidades>0?v.total/v.unidades:0)}</td><td>$${fmt(v.total)}</td></tr>`).join('')}
    <tr class="tot"><td>TOTALES (sin DIGITAL)</td><td>${Object.entries(marcas).filter(([m])=>m.trim().toUpperCase()!=='DIGITAL').reduce((s,[,v])=>s+v.unidades,0)}</td><td></td>
    <td>$${fmt(Object.entries(marcas).filter(([m])=>m.trim().toUpperCase()!=='DIGITAL').reduce((s,[,v])=>s+v.total,0))}</td></tr>
    </tbody></table></body></html>`)
    w.document.close(); w.focus(); setTimeout(()=>{w.print();w.close()},400)
  }

  function imprimirTop() {
    const w = window.open('','_blank','width=700,height=500')
    w.document.write(`<html><head><meta charset="UTF-8"><title>Top</title><style>${estilosImp('portrait')}</style></head><body>
    <h2>ATM — TOP 10 ARTÍCULOS</h2>
    <div class="sub">DESDE ${fmtFecha(desde)} &nbsp;&nbsp; HASTA ${fmtFecha(hasta)}</div>
    <table><thead><tr><th style="text-align:left">#</th><th style="text-align:left">Código</th><th style="text-align:left">Descripción</th><th>Unidades</th><th>$ Total</th></tr></thead><tbody>
    ${topArts.map((a,i)=>`<tr><td>${i+1}</td><td>${a.codartic}</td><td>${a.descartic}</td><td>${a.unidades}</td><td>$${fmt(a.total)}</td></tr>`).join('')}
    </tbody></table></body></html>`)
    w.document.close(); w.focus(); setTimeout(()=>{w.print();w.close()},400)
  }

  function imprimirCartera() {
    const w = window.open('','_blank','width=900,height=600')
    w.document.write(`<html><head><meta charset="UTF-8"><title>Cartera</title><style>${estilosImp('landscape')}.mora{color:#c62828;font-weight:700;}</style></head><body>
    <h2>ATM — CARTERA PENDIENTE POR VENDEDOR</h2>
    <div class="sub">Corte al ${fmtFecha(hoy())} (cartera completa, no depende del rango de fechas)</div>
    <table><thead><tr>
      <th style="text-align:left">Vendedor</th><th style="text-align:left">Última nota</th>
      <th>Total adeudado</th><th>Abonado</th><th>Saldo</th><th>Prom. días</th>
    </tr></thead><tbody>
    ${carteraPorVend.map(v=>`<tr>
      <td>${v.nombre}</td><td>${v.ultimaFecha?fmtFecha(v.ultimaFecha):''}</td>
      <td>$${fmt(v.totalFacturado)}</td><td>$${fmt(v.totalAbonado)}</td>
      <td style="color:#c62828;font-weight:700">$${fmt(v.totalSaldo)}</td>
      <td class="${v.promedioDias>30?'mora':''}">${v.promedioDias}d</td></tr>`).join('')}
    <tr class="tot"><td colspan="4">TOTAL CARTERA PENDIENTE (todos los vendedores)</td>
      <td>$${fmt(carteraPorVend.reduce((s,v)=>s+v.totalSaldo,0))}</td><td></td></tr>
    </tbody></table></body></html>`)
    w.document.close(); w.focus(); setTimeout(()=>{w.print();w.close()},400)
  }

  function imprimirAnuladas() {
    const an = datos?.notasAnuladas||[]
    const w = window.open('','_blank','width=900,height=600')
    w.document.write(`<html><head><meta charset="UTF-8"><title>Anuladas</title><style>${estilosImp('landscape')}</style></head><body>
    <h2>ATM — NOTAS ANULADAS</h2>
    <div class="sub">DESDE ${fmtFecha(desde)} &nbsp;&nbsp; HASTA ${fmtFecha(hasta)} &nbsp;&nbsp; Total: ${an.length} notas</div>
    <table><thead><tr>
      <th style="text-align:left">Nota</th><th style="text-align:left">Fecha</th>
      <th style="text-align:left">Cliente</th><th>Total</th>
      <th style="text-align:left">Motivo</th><th style="text-align:left">Anulada el</th>
    </tr></thead><tbody>
    ${an.map((n,i)=>`<tr style="background:${i%2===0?'#fff':'#fdecea'}">
      <td style="color:#c62828;font-weight:700">${n.numnotaent}</td>
      <td>${fmtFecha(n.fechanotae)}</td><td>${n.nombreclie}</td>
      <td style="text-align:right">$${fmt(n.valtotal)}</td>
      <td>${n.motivoanula||'—'}</td><td>${n.fechaanula?fmtFecha(n.fechaanula):'—'}</td>
    </tr>`).join('')}
    <tr class="tot"><td colspan="3">TOTAL ANULADO</td>
    <td style="text-align:right;color:#c62828">$${fmt(an.reduce((s,n)=>s+(n.valtotal||0),0))}</td>
    <td colspan="2"></td></tr>
    </tbody></table></body></html>`)
    w.document.close(); w.focus(); setTimeout(()=>{w.print();w.close()},400)
  }


  function calcPorUsuario() {
    if (!datos) return null
    const { notas, detalle, abonos, vendMap, digitalPorNota } = datos
    const usuarios = {}
    const get = (usu) => {
      if (!usuarios[usu]) usuarios[usu] = {
        efectivo:0, transferencia:0, mixto:0, totalIngresado:0,
        ventaContado:0, ventaCredito:0, prendas:0, notas:0, cobroCartera:0,
        porMarca:{}, porVendedor:{},
      }
      return usuarios[usu]
    }
    const notasHoy = new Set(notas.map(n=>n.numnotaent))
    notas.forEach(n => {
      const usu  = (n.usuario||'Sin usuario').trim()
      const u    = get(usu)
      const medio= normMedio(n.mediopago)
      const esC  = n.formapago !== 'CONTADO' && (n.saldo||0) > 0
      const valD = digitalPorNota[n.numnotaent]||0
      const val  = (n.valtotal||0) - valD
      u.notas++; u.prendas += n.cantotal||0
      if (esC) {
        u.ventaCredito += val
      } else {
        u.ventaContado += val
        if (medio==='efectivo')           { u.efectivo      += val; u.totalIngresado += val }
        else if (medio==='transferencia') { u.transferencia += val; u.totalIngresado += val }
        else                              { u.mixto         += val; u.totalIngresado += val }
      }
      const cedv = String(n.cedvended||'')
      const nomV = cedv ? (vendMap[cedv]||`Vendedor ${cedv}`) : 'Sin vendedor'
      if (!u.porVendedor[cedv]) u.porVendedor[cedv] = {nombre:nomV, contado:0, credito:0}
      if (esC) u.porVendedor[cedv].credito += val
      else     u.porVendedor[cedv].contado += val
    })
    abonos.forEach(a => {
      if (notasHoy.has(a.numnotaent)) return
      if ((a.mediopago||'').toLowerCase()==='vale') return
      const usu = (a.usuario||'Sin usuario').trim()
      const u   = get(usu)
      u.cobroCartera   += a.valabono||0
      u.totalIngresado += a.valabono||0
      const m = normMedio(a.mediopago)
      if (m==='efectivo')           u.efectivo      += a.valabono||0
      else if (m==='transferencia') u.transferencia += a.valabono||0
      else                          u.mixto         += a.valabono||0
    })
    detalle.forEach(d => {
      const usu  = (d.usuario||'Sin usuario').trim()
      const u    = get(usu)
      const marc = (d.marca||'SIN MARCA').trim().toUpperCase()
      if (marc==='DIGITAL') return
      if (!u.porMarca[marc]) u.porMarca[marc] = {unidades:0, total:0}
      u.porMarca[marc].unidades += Number(d.cantidad||0)
      u.porMarca[marc].total    += Number(d.valtotal||0)
    })
    return usuarios
  }

  function imprimirPorUsuario() {
    const pu = calcPorUsuario()
    if (!pu) return
    const w = window.open('','_blank','width=1000,height=700')
    w.document.write(`<html><head><meta charset="UTF-8"><title>Por Usuario</title>
    <style>@page{size:letter portrait;margin:10mm;}body{font-family:Arial,sans-serif;font-size:11px;margin:16px;}
    h2{color:#1a3a6b;text-align:center;margin-bottom:4px;}
    .sub{text-align:center;color:#555;margin-bottom:14px;}
    table{width:100%;border-collapse:collapse;margin-bottom:8px;}
    th{background:#1a3a6b;color:#fff;padding:5px 8px;font-size:10px;text-align:right;}
    th:first-child{text-align:left;}
    td{padding:4px 8px;border-bottom:1px solid #eee;font-size:10px;text-align:right;}
    td:first-child{text-align:left;}
    .tot{background:#dde3ee;font-weight:900;}
    .usu{background:#1a3a6b;color:#fff;font-size:13px;font-weight:900;padding:8px 10px;margin:16px 0 6px;}
    @media print{body{margin:6px;}}</style></head><body>
    <h2>ATM — CONSOLIDADO POR USUARIO</h2>
    <div class="sub">DESDE ${fmtFecha(desde)} | HASTA ${fmtFecha(hasta)}</div>
    ${Object.entries(pu).sort((a,b)=>a[0].localeCompare(b[0])).map(([usu,u])=>`
      <div class="usu">👤 ${usu}</div>
      <table><thead><tr>
        <th>Concepto</th><th>Efectivo</th><th>Transferencia</th><th>Mixto</th><th>TOTAL</th>
      </tr></thead><tbody>
        <tr><td>Ventas contado</td><td></td><td></td><td></td><td>$${fmt(u.ventaContado)}</td></tr>
        <tr><td>Ventas crédito</td><td>—</td><td>—</td><td>—</td><td>$${fmt(u.ventaCredito)}</td></tr>
        <tr><td>Cobros de cartera</td><td colspan="3" style="text-align:center;color:#888">abonos a notas anteriores</td><td>$${fmt(u.cobroCartera)}</td></tr>
        <tr class="tot"><td>DINERO QUE INGRESÓ</td><td>$${fmt(u.efectivo)}</td><td>$${fmt(u.transferencia)}</td><td>$${fmt(u.mixto)}</td><td>$${fmt(u.totalIngresado)}</td></tr>
      </tbody></table>
      <p style="font-size:11px;font-weight:700;margin:4px 0">Prendas vendidas: ${fmt(u.prendas)} | Notas: ${u.notas}</p>
      <table><thead><tr><th style="text-align:left">Marca</th><th>Unidades</th><th>$ Total</th></tr></thead><tbody>
        ${Object.entries(u.porMarca).sort((a,b)=>b[1].total-a[1].total).map(([m,v])=>`
          <tr><td>${m}</td><td>${fmt(v.unidades)}</td><td>$${fmt(v.total)}</td></tr>`).join('')}
      </tbody></table>
      <table style="margin-top:6px"><thead><tr>
        <th style="text-align:left">Vendedor</th><th>Contado</th><th>Crédito</th><th>Total</th>
      </tr></thead><tbody>
        ${Object.entries(u.porVendedor).sort((a,b)=>(b[1].contado+b[1].credito)-(a[1].contado+a[1].credito)).map(([,v])=>`
          <tr><td>${v.nombre}</td><td>$${fmt(v.contado)}</td><td>$${fmt(v.credito)}</td><td><b>$${fmt(v.contado+v.credito)}</b></td></tr>`).join('')}
      </tbody></table>
    `).join('<hr style="margin:10px 0;border-color:#c8d5ea">')}
    </body></html>`)
    w.document.close(); w.focus(); setTimeout(()=>{w.print();w.close()},400)
  }

  function imprimirVentasCliente() {
    const w = window.open('','_blank','width=900,height=600')
    w.document.write(`<html><head><meta charset="UTF-8"><title>Clientes</title><style>${estilosImp('landscape')}</style></head><body>
    <h2>ATM — VENTAS POR CLIENTE</h2>
    <div class="sub">DESDE ${fmtFecha(desde)} &nbsp;&nbsp; HASTA ${fmtFecha(hasta)}</div>
    <div class="sec" style="padding:5px 8px;margin-bottom:4px">VENTAS MOSTRADOR — $${fmt(ventasCli.totMostrador)} (${ventasCli.mostrador.length} notas)</div>
    <div class="sec" style="padding:5px 8px;margin-bottom:4px;margin-top:12px">VENTAS A CLIENTES ESPECÍFICOS</div>
    <table><thead><tr><th style="text-align:left">Cédula</th><th style="text-align:left">Cliente</th><th>Notas</th><th>Total</th><th>Abonado</th><th>Saldo</th></tr></thead><tbody>
    ${ventasCli.clientes.map(cl=>`<tr><td>${cl.cedula}</td><td>${cl.nombre}</td><td>${cl.notas}</td>
      <td>$${fmt(cl.total)}</td><td>$${fmt(cl.abonado)}</td><td style="color:#c62828">$${fmt(cl.saldo)}</td></tr>`).join('')}
    <tr class="tot"><td colspan="3">TOTALES</td>
    <td>$${fmt(ventasCli.clientes.reduce((s,c)=>s+c.total,0))}</td>
    <td>$${fmt(ventasCli.clientes.reduce((s,c)=>s+c.abonado,0))}</td>
    <td style="color:#c62828">$${fmt(ventasCli.clientes.reduce((s,c)=>s+c.saldo,0))}</td></tr>
    </tbody></table></body></html>`)
    w.document.close(); w.focus(); setTimeout(()=>{w.print();w.close()},400)
  }

  function imprimirResumen() {
    if (!resumen) return
    const w = window.open('','_blank','width=700,height=600')
    w.document.write(`<html><head><meta charset="UTF-8"><title>Resumen</title>
    <style>@page{size:letter portrait;margin:10mm;}body{font-family:Arial,sans-serif;font-size:12px;padding:20px;}
    h2{color:#1a3a6b;text-align:center;}.sub{text-align:center;color:#555;margin-bottom:16px;}
    .f{display:flex;justify-content:space-between;padding:8px 12px;border-bottom:1px solid #eee;}
    .f.tot{font-weight:900;font-size:14px;background:#dde3ee;border-top:2px solid #1a3a6b;}
    .lbl{color:#333;}.val{color:#1a3a6b;font-weight:700;}
    @media print{body{padding:8px;}}</style></head><body>
    <h2>RESUMEN DE VENTAS DIARIAS</h2>
    <div class="sub">DESDE ${fmtFecha(desde)} &nbsp;&nbsp; HASTA ${fmtFecha(hasta)}</div>
    <div class="f"><span class="lbl">Notas generadas</span><span class="val">${resumen.cantNotas}</span></div>
    <div class="f tot"><span class="lbl">VENTAS TOTALES</span><span class="val">$${fmt(resumen.totalVentas)}</span></div>
    <div class="f"><span class="lbl">Ventas a crédito</span><span class="val">$${fmt(resumen.totalCredito)}</span></div>
    <div class="f"><span class="lbl">Ventas de contado</span><span class="val">$${fmt(resumen.totalContado)}</span></div>
    <div class="f"><span class="lbl">Ingresos en efectivo</span><span class="val">$${fmt(resumen.totalEfectivo)}</span></div>
    <div class="f"><span class="lbl">Ingresos en transferencia</span><span class="val">$${fmt(resumen.totalTransferencia)}</span></div>
    <div class="f"><span class="lbl">Ingresos en mixto</span><span class="val">$${fmt(resumen.totalMixto)}</span></div>
    <div class="f"><span class="lbl">Abonos a créditos recibidos</span><span class="val">$${fmt(resumen.totalAbonosCredito)}</span></div>
    <div class="f tot"><span class="lbl">TOTAL DINERO INGRESADO</span><span class="val">$${fmt(resumen.totalIngresado)}</span></div>
    <div class="f"><span class="lbl" style="color:#c62828">Saldo pendiente por cobrar</span><span class="val" style="color:#c62828">$${fmt(resumen.totalPendiente)}</span></div>
    <div class="f" style="background:#ede7f6;border:1px dashed #7e57c2;border-radius:6px;margin-top:6px;"><span class="lbl" style="color:#4527a0;font-weight:700;">📲 MARCA DIGITAL (no incluida en el cierre)</span><span class="val" style="color:#4527a0;">$${fmt(resumen.totalDigital)}</span></div>
    <div class="f"><span class="lbl">Ventas día anterior</span><span class="val">$${fmt(resumen.totalAyer)}</span></div>
    <div class="f"><span class="lbl" style="color:${resumen.totalVentas>=resumen.totalAyer?'#2e7d32':'#c62828'}">
      ${resumen.totalVentas>=resumen.totalAyer?'▲ MEJOR QUE AYER':'▼ MENOR QUE AYER'}
      (${resumen.totalAyer>0?Math.round((resumen.totalVentas-resumen.totalAyer)/resumen.totalAyer*100):0}%)
    </span><span></span></div>
    </body></html>`)
    w.document.close(); w.focus(); setTimeout(()=>{w.print();w.close()},400)
  }

  function imprimirDineroPorDia() {
    if (!dineroPorDia) return
    const w = window.open('','_blank','width=1000,height=700')
    w.document.write(`<html><head><meta charset="UTF-8"><title>Dinero por Día</title><style>${estilosImp('landscape')}</style></head><body>
    <h2>ATM — DINERO INGRESADO POR DÍA</h2>
    <div class="sub">DESDE ${fmtFecha(desde)} &nbsp;&nbsp; HASTA ${fmtFecha(hasta)}</div>
    <table><thead><tr>
      <th style="text-align:left">Fecha</th><th>Notas</th><th>Efectivo</th><th>Transf.</th><th>Mixto</th>
      <th>Vtas. Crédito</th><th>Abonos Cartera</th><th>Total Ingresado</th>
    </tr></thead><tbody>
    ${dineroPorDia.map(d=>`<tr>
      <td>${fmtFecha(d.fecha)}</td><td>${d.notas}</td>
      <td>${d.efectivo?'$'+fmt(d.efectivo):''}</td>
      <td>${d.transferencia?'$'+fmt(d.transferencia):''}</td>
      <td>${d.mixto?'$'+fmt(d.mixto):''}</td>
      <td>${d.credito?'$'+fmt(d.credito):''}</td>
      <td>${d.abonosCartera?'$'+fmt(d.abonosCartera):''}</td>
      <td><b>$${fmt(d.totalIngresado)}</b></td>
    </tr>`).join('')}
    <tr class="tot">
      <td>TOTALES</td>
      <td>${dineroPorDia.reduce((s,d)=>s+d.notas,0)}</td>
      <td>$${fmt(dineroPorDia.reduce((s,d)=>s+d.efectivo,0))}</td>
      <td>$${fmt(dineroPorDia.reduce((s,d)=>s+d.transferencia,0))}</td>
      <td>$${fmt(dineroPorDia.reduce((s,d)=>s+d.mixto,0))}</td>
      <td>$${fmt(dineroPorDia.reduce((s,d)=>s+d.credito,0))}</td>
      <td>$${fmt(dineroPorDia.reduce((s,d)=>s+d.abonosCartera,0))}</td>
      <td><b>$${fmt(dineroPorDia.reduce((s,d)=>s+d.totalIngresado,0))}</b></td>
    </tr>
    </tbody></table></body></html>`)
    w.document.close(); w.focus(); setTimeout(()=>{w.print();w.close()},400)
  }

  function imprimirVentasPorDia() {
    if (!ventasPorDia) return
    const w = window.open('','_blank','width=1000,height=700')
    const titCriterio = criterioVentasDia==='referencia' ? 'REFERENCIA' : 'MARCA'
    w.document.write(`<html><head><meta charset="UTF-8"><title>Ventas por Día</title><style>${estilosImp('portrait')}
    .diaTit{background:#1a3a6b;color:#fff;padding:6px 10px;font-weight:700;margin:14px 0 4px;border-radius:3px;display:flex;justify-content:space-between;}
    </style></head><body>
    <h2>ATM — VENTAS POR DÍA (${titCriterio})</h2>
    <div class="sub">DESDE ${fmtFecha(desde)} &nbsp;&nbsp; HASTA ${fmtFecha(hasta)}</div>
    ${ventasPorDia.filter(d=>Object.keys(d.items).length>0).map(d=>`
      <div class="diaTit"><span>📅 ${fmtFecha(d.fecha)}</span><span>${d.totalUnidades} unid. — $${fmt(d.totalVenta)}</span></div>
      <table><thead><tr><th style="text-align:left">${criterioVentasDia==='referencia'?'Referencia':'Marca'}</th><th>Unidades</th><th>Total</th></tr></thead><tbody>
      ${Object.entries(d.items).sort((a,b)=>b[1].total-a[1].total).map(([k,v])=>`<tr><td>${k}</td><td>${v.unidades}</td><td>$${fmt(v.total)}</td></tr>`).join('')}
      </tbody></table>`).join('')}
    ${ventasPorDia.every(d=>Object.keys(d.items).length===0) ? '<p style="text-align:center;color:#888">Sin ventas en este período.</p>' : ''}
    </body></html>`)
    w.document.close(); w.focus(); setTimeout(()=>{w.print();w.close()},400)
  }

  // ── RENDER ────────────────────────────────────────────────────────────────
  const TABS = [
    {id:'consolidado', icon:'📊', label:'Consolidado'},
    {id:'marcas',      icon:'🏷️', label:'Ventas por Marca'},
    {id:'clientes',    icon:'👥', label:'Ventas por Cliente'},
    {id:'resumen',     icon:'💰', label:'Resumen del Día'},
    {id:'dineroDia',   icon:'📅', label:'Dinero Ingresado por Día'},
    {id:'ventasDia',   icon:'📆', label:'Ventas por Día (Marca/Ref)'},
    {id:'top',         icon:'🏆', label:'Top Artículos'},
    {id:'cartera',     icon:'📋', label:'Cartera Pendiente'},
    {id:'anuladas',    icon:'🗑', label:'Notas Anuladas'},
    {id:'porusuario',  icon:'👤', label:'Por Usuario'},
  ]

  const TablaConsolidado = ({ titulo, datos: filas, icono }) => {
    const hayFilas = Object.keys(filas).length > 0
    const sub = sumarBloque(filas)
    return (
      <div style={{marginBottom:24}}>
        <div style={P.secTit}><span style={{fontSize:18}}>{icono}</span> {titulo} — {fmtFecha(desde)} al {fmtFecha(hasta)}</div>
        <table style={P.tabla}>
          <thead>
            <tr style={P.thead}>
              {['Nombre','Notas','Efectivo','Transferencia','Mixto','Crédito','No Abonado','Total'].map(h=>(
                <th key={h} style={{...P.th, textAlign:h==='Nombre'?'left':'right'}}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {Object.entries(filas).sort((a,b)=>b[1].total-a[1].total).map(([nom,v],i)=>(
              <tr key={nom} style={{background:i%2===0?'#fff':'#f5f7fc'}}>
                <td style={{...P.td,fontWeight:600}}>{nom}</td>
                <td style={{...P.td,textAlign:'right',color:'#555'}}>{v.notas}</td>
                <td style={{...P.td,textAlign:'right',color:'#2e7d32'}}>{v.efectivo?`$${fmt(v.efectivo)}`:''}</td>
                <td style={{...P.td,textAlign:'right',color:'#1565c0'}}>{v.transferencia?`$${fmt(v.transferencia)}`:''}</td>
                <td style={{...P.td,textAlign:'right',color:'#6a1b9a'}}>{v.mixto?`$${fmt(v.mixto)}`:''}</td>
                <td style={{...P.td,textAlign:'right',color:'#e65100'}}>{v.credito?`$${fmt(v.credito)}`:''}</td>
                <td style={{...P.td,textAlign:'right',color:'#c62828'}}>{v.noAbonado?`$${fmt(v.noAbonado)}`:''}</td>
                <td style={{...P.td,textAlign:'right',fontWeight:700,color:'#1a3a6b'}}>${fmt(v.total)}</td>
              </tr>
            ))}
            {hayFilas && (
              <tr style={{...P.totRow,background:'#eef2ff',fontStyle:'italic'}}>
                <td style={P.td}>Subtotal {titulo.toLowerCase()}</td>
                <td style={{...P.td,textAlign:'right'}}>{sub.notas}</td>
                <td style={{...P.td,textAlign:'right',color:'#2e7d32'}}>{sub.efectivo?`$${fmt(sub.efectivo)}`:''}</td>
                <td style={{...P.td,textAlign:'right',color:'#1565c0'}}>{sub.transferencia?`$${fmt(sub.transferencia)}`:''}</td>
                <td style={{...P.td,textAlign:'right',color:'#6a1b9a'}}>{sub.mixto?`$${fmt(sub.mixto)}`:''}</td>
                <td style={{...P.td,textAlign:'right',color:'#e65100'}}>{sub.credito?`$${fmt(sub.credito)}`:''}</td>
                <td style={{...P.td,textAlign:'right',color:'#c62828'}}>{sub.noAbonado?`$${fmt(sub.noAbonado)}`:''}</td>
                <td style={{...P.td,textAlign:'right',fontWeight:800,color:'#1a3a6b'}}>${fmt(sub.total)}</td>
              </tr>
            )}
            {!hayFilas && (
              <tr><td colSpan={8} style={{textAlign:'center',padding:16,color:'#aaa'}}>Sin datos en este período.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    )
  }

  return (
    <div style={P.pagina}>
      <div style={P.ventana}>
        <div style={P.titulo}>
          <div style={P.logoTxt}>
            <span style={{fontFamily:'Arial Black',fontWeight:900,fontSize:20,color:'#fff',letterSpacing:3}}>ATM</span>
            <span style={{fontSize:9,color:'rgba(255,255,255,0.8)',letterSpacing:2}}>A TU MEDIDA</span>
          </div>
          <span style={P.titTxt}>CIERRE DE CAJA / INFORMES</span>
          {onAyuda && <button onClick={onAyuda} title="Ayuda" style={{background:'rgba(255,255,255,0.2)',border:'1px solid rgba(255,255,255,0.4)',color:'#fff',borderRadius:'50%',width:36,height:36,cursor:'pointer',fontSize:18}}>❓</button>}
          <button onClick={onClose} style={P.btnCerrar}>← Menú</button>
        </div>

        <div style={P.filtros}>
          <label style={P.lbl}>Desde<input type="date" style={P.inp} value={desde} onChange={e=>setDesde(e.target.value)}/></label>
          <label style={P.lbl}>Hasta<input type="date" style={P.inp} value={hasta} onChange={e=>setHasta(e.target.value)}/></label>
          <button onClick={generar} disabled={cargando} style={P.btnGenerar}>
            {cargando ? <><span style={{fontSize:17}}>⏳</span> Calculando…</> : <><span style={{fontSize:17}}>🔍</span> Generar Informes</>}
          </button>
          {datos && (
            <div style={{marginLeft:'auto',display:'flex',gap:8}}>
              {tab==='consolidado' && <button onClick={imprimirConsolidado} style={P.btnPrint}><span style={{fontSize:16}}>🖨</span> Imprimir</button>}
              {tab==='marcas'      && <button onClick={imprimirMarcas}      style={P.btnPrint}><span style={{fontSize:16}}>🖨</span> Imprimir</button>}
              {tab==='clientes'    && <button onClick={imprimirVentasCliente} style={P.btnPrint}><span style={{fontSize:16}}>🖨</span> Imprimir</button>}
              {tab==='resumen'     && <button onClick={imprimirResumen}     style={P.btnPrint}><span style={{fontSize:16}}>🖨</span> Imprimir</button>}
              {tab==='dineroDia'   && <button onClick={imprimirDineroPorDia} style={P.btnPrint}><span style={{fontSize:16}}>🖨</span> Imprimir</button>}
              {tab==='ventasDia'   && <button onClick={imprimirVentasPorDia} style={P.btnPrint}><span style={{fontSize:16}}>🖨</span> Imprimir</button>}
              {tab==='top'         && <button onClick={imprimirTop}         style={P.btnPrint}><span style={{fontSize:16}}>🖨</span> Imprimir</button>}
              {tab==='cartera'     && <button onClick={imprimirCartera}     style={P.btnPrint}><span style={{fontSize:16}}>🖨</span> Imprimir</button>}
              {tab==='anuladas'    && <button onClick={imprimirAnuladas}    style={P.btnPrint}><span style={{fontSize:16}}>🖨</span> Imprimir</button>}
              {tab==='porusuario'  && <button onClick={imprimirPorUsuario}  style={P.btnPrint}><span style={{fontSize:16}}>🖨</span> Imprimir</button>}
            </div>
          )}
        </div>

        {!datos && !cargando && (
          <div style={{textAlign:'center',padding:60,color:'#aab8d4',fontSize:14}}>
            Selecciona el rango de fechas y presiona <strong>Generar Informes</strong>
          </div>
        )}
        {cargando && <div style={{textAlign:'center',padding:60,color:'#1a3a6b',fontSize:14}}>⏳ Cargando datos…</div>}

        {datos && !cargando && (
          <>
            <div style={P.tabs}>
              {TABS.map(t=>(
                <button key={t.id} onClick={()=>setTab(t.id)}
                  style={{...P.tab,...(tab===t.id?P.tabActivo:{})}}>
                  <span style={{fontSize:16}}>{t.icon}</span> {t.label}
                </button>
              ))}
            </div>

            <div style={P.contenido}>

              {/* ── CONSOLIDADO ── */}
              {tab==='consolidado' && cons && (
                <div>
                  <TablaConsolidado titulo="Ventas por Vendedora de Mostrador" icono="👗" datos={cons.vendMostrador} />
                  {Object.keys(cons.vendExterno).length > 0 && (
                    <TablaConsolidado titulo="Ventas por Vendedor Externo" icono="👤" datos={cons.vendExterno} />
                  )}

                  {/* Comparación total mostrador vs externos */}
                  <div style={{display:'flex',gap:12,marginBottom:24}}>
                    <div style={{...P.digitalBox,flex:1,background:'#e8f5e9',border:'1px dashed #2e7d32',color:'#1b5e20'}}>
                      <span><span style={{fontSize:17}}>👗</span> TOTAL VENTAS MOSTRADOR</span>
                      <strong>${fmt(cons.subtotalMostrador.total)}</strong>
                    </div>
                    {Object.keys(cons.vendExterno).length > 0 && (
                      <div style={{...P.digitalBox,flex:1,background:'#e3f2fd',border:'1px dashed #1565c0',color:'#0d47a1'}}>
                        <span><span style={{fontSize:17}}>👤</span> TOTAL VENTAS VENDEDORES EXTERNOS</span>
                        <strong>${fmt(cons.subtotalExterno.total)}</strong>
                      </div>
                    )}
                  </div>

                  <TablaConsolidado titulo="Totales por Caja" icono="🏧" datos={cons.porCaja} />

                  {/* Fila de totales generales */}
                  <div style={P.secTit}><span style={{fontSize:18}}>📊</span> Totales Generales</div>
                  <table style={P.tabla}>
                    <tbody>
                      <tr style={P.totRow}>
                        <td style={{...P.td,width:'25%'}}><strong>TOTALES GENERALES</strong></td>
                        <td style={{...P.td,textAlign:'right'}}>{cons.totales.notas} notas</td>
                        <td style={{...P.td,textAlign:'right',color:'#2e7d32'}}>${fmt(cons.totales.efectivo)}</td>
                        <td style={{...P.td,textAlign:'right',color:'#1565c0'}}>${fmt(cons.totales.transferencia)}</td>
                        <td style={{...P.td,textAlign:'right',color:'#6a1b9a'}}>${fmt(cons.totales.mixto)}</td>
                        <td style={{...P.td,textAlign:'right',color:'#e65100'}}>${fmt(cons.totales.credito)}</td>
                        <td style={{...P.td,textAlign:'right',color:'#c62828'}}>${fmt(cons.totales.noAbonado)}</td>
                        <td style={{...P.td,textAlign:'right',fontSize:15,color:'#1a3a6b'}}><strong>${fmt(cons.totales.total)}</strong></td>
                      </tr>
                    </tbody>
                  </table>

                  {/* DIGITAL — aparte, no se suma al cierre */}
                  <div style={P.digitalBox}>
                    <span><span style={{fontSize:17}}>📲</span> MARCA DIGITAL (no incluida en el cierre de caja)</span>
                    <strong>${fmt(cons.totales.digital)}</strong>
                  </div>
                </div>
              )}

              {/* ── VENTAS POR MARCA ── */}
              {tab==='marcas' && marcas && (
                <div>
                  <div style={P.secTit}><span style={{fontSize:18}}>🏷️</span> Ventas por Marca — {fmtFecha(desde)} al {fmtFecha(hasta)}</div>
                  <table style={P.tabla}>
                    <thead>
                      <tr style={P.thead}>
                        {['Marca','Unidades','$ Promedio','$ Total'].map(h=>(
                          <th key={h} style={{...P.th,textAlign:h==='Marca'?'left':'right'}}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {Object.entries(marcas).sort((a,b)=>b[1].total-a[1].total).map(([m,v],i)=>{
                        const esDigital = m.trim().toUpperCase()==='DIGITAL'
                        return (
                          <tr key={m} style={{background:esDigital?'#ede7f6':i%2===0?'#fff':'#f5f7fc'}}>
                            <td style={{...P.td,fontWeight:600,color:esDigital?'#4527a0':'#333'}}>{m}{esDigital?<> <span style={{fontSize:15}}>📲</span></>:''}</td>
                            <td style={{...P.td,textAlign:'right'}}>{v.unidades}</td>
                            <td style={{...P.td,textAlign:'right'}}>${fmt(v.unidades>0?v.total/v.unidades:0)}</td>
                            <td style={{...P.td,textAlign:'right',fontWeight:700,color:esDigital?'#4527a0':'#1a3a6b'}}>${fmt(v.total)}</td>
                          </tr>
                        )
                      })}
                      <tr style={P.totRow}>
                        <td style={P.td}><strong>TOTALES (sin DIGITAL)</strong></td>
                        <td style={{...P.td,textAlign:'right'}}>{Object.entries(marcas).filter(([m])=>m.trim().toUpperCase()!=='DIGITAL').reduce((s,[,v])=>s+v.unidades,0)}</td>
                        <td style={P.td}></td>
                        <td style={{...P.td,textAlign:'right',fontSize:14,color:'#1a3a6b'}}><strong>${fmt(Object.entries(marcas).filter(([m])=>m.trim().toUpperCase()!=='DIGITAL').reduce((s,[,v])=>s+v.total,0))}</strong></td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              )}

              {/* ── RESUMEN DEL DÍA ── */}
              {tab==='resumen' && resumen && (
                <div style={{maxWidth:600}}>
                  <div style={P.secTit}><span style={{fontSize:18}}>💰</span> Resumen del Día — {fmtFecha(desde)} al {fmtFecha(hasta)}</div>
                  {[
                    {lbl:'Notas generadas',                          val:resumen.cantNotas},
                    {lbl:'Ventas totales (contado + crédito)',        val:`$${fmt(resumen.totalVentas)}`,        grande:true},
                    {lbl:'Ventas a crédito',                          val:`$${fmt(resumen.totalCredito)}`},
                    {lbl:'Ventas de contado',                         val:`$${fmt(resumen.totalContado)}`},
                    {lbl:'Ingresos en efectivo',                      val:`$${fmt(resumen.totalEfectivo)}`},
                    {lbl:'Ingresos en transferencia',                 val:`$${fmt(resumen.totalTransferencia)}`},
                    {lbl:'Ingresos en mixto',                         val:`$${fmt(resumen.totalMixto)}`},
                    {lbl:'Abonos a créditos recibidos hoy',           val:`$${fmt(resumen.totalAbonosCredito)}`},
                    {lbl:'Vales aplicados (no es dinero)',              val:`$${fmt(resumen.totalValesAplicados)}`, color:'#7b1fa2'},
                    {lbl:'TOTAL DINERO INGRESADO',                    val:`$${fmt(resumen.totalIngresado)}`,     grande:true, color:'#1a3a6b'},
                    {lbl:'Saldo pendiente por cobrar',                val:`$${fmt(resumen.totalPendiente)}`,    color:'#c62828'},
                    {lbl:'Ventas día anterior',                       val:`$${fmt(resumen.totalAyer)}`},
                    {lbl:resumen.totalVentas>=resumen.totalAyer?'▲ Mejor que ayer':'▼ Menor que ayer',
                     val:`${resumen.totalAyer>0?Math.round((resumen.totalVentas-resumen.totalAyer)/resumen.totalAyer*100):0}%`,
                     color:resumen.totalVentas>=resumen.totalAyer?'#2e7d32':'#c62828'},
                  ].map((r,i)=>(
                    <div key={i} style={{...P.resumenFila,background:r.grande?'#eef2ff':'#fff',borderTop:r.grande?'2px solid #1a3a6b':'none'}}>
                      <span style={{fontSize:r.grande?13:12,fontWeight:r.grande?800:500,color:'#333'}}>{r.lbl}</span>
                      <span style={{fontSize:r.grande?16:13,fontWeight:700,color:r.color||'#1a3a6b'}}>{r.val}</span>
                    </div>
                  ))}

                  {/* DIGITAL — aparte, no se suma al cierre */}
                  <div style={P.digitalBox}>
                    <span><span style={{fontSize:17}}>📲</span> MARCA DIGITAL (no incluida en el cierre de caja)</span>
                    <strong>${fmt(resumen.totalDigital)}</strong>
                  </div>
                </div>
              )}

              {/* ── DINERO INGRESADO POR DÍA ── */}
              {tab==='dineroDia' && dineroPorDia && (
                <div>
                  <div style={P.secTit}><span style={{fontSize:18}}>📅</span> Dinero Ingresado por Día — {fmtFecha(desde)} al {fmtFecha(hasta)}</div>
                  <table style={P.tabla}>
                    <thead>
                      <tr style={P.thead}>
                        {['Fecha','Notas','Efectivo','Transferencia','Mixto','Ventas Crédito','Abonos Cartera','Total Ingresado'].map(h=>(
                          <th key={h} style={{...P.th, textAlign:h==='Fecha'?'left':'right'}}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {dineroPorDia.map((d,i)=>(
                        <tr key={d.fecha} style={{background:i%2===0?'#fff':'#f5f7fc'}}>
                          <td style={{...P.td,fontWeight:600}}>{fmtFecha(d.fecha)}</td>
                          <td style={{...P.td,textAlign:'right',color:'#555'}}>{d.notas}</td>
                          <td style={{...P.td,textAlign:'right',color:'#2e7d32'}}>{d.efectivo?`$${fmt(d.efectivo)}`:''}</td>
                          <td style={{...P.td,textAlign:'right',color:'#1565c0'}}>{d.transferencia?`$${fmt(d.transferencia)}`:''}</td>
                          <td style={{...P.td,textAlign:'right',color:'#6a1b9a'}}>{d.mixto?`$${fmt(d.mixto)}`:''}</td>
                          <td style={{...P.td,textAlign:'right',color:'#e65100'}}>{d.credito?`$${fmt(d.credito)}`:''}</td>
                          <td style={{...P.td,textAlign:'right',color:'#8e24aa'}}>{d.abonosCartera?`$${fmt(d.abonosCartera)}`:''}</td>
                          <td style={{...P.td,textAlign:'right',fontWeight:700,color:'#1a3a6b'}}>${fmt(d.totalIngresado)}</td>
                        </tr>
                      ))}
                      {dineroPorDia.length>0 && (
                        <tr style={P.totRow}>
                          <td style={P.td}><strong>TOTALES</strong></td>
                          <td style={{...P.td,textAlign:'right'}}>{dineroPorDia.reduce((s,d)=>s+d.notas,0)}</td>
                          <td style={{...P.td,textAlign:'right',color:'#2e7d32'}}>${fmt(dineroPorDia.reduce((s,d)=>s+d.efectivo,0))}</td>
                          <td style={{...P.td,textAlign:'right',color:'#1565c0'}}>${fmt(dineroPorDia.reduce((s,d)=>s+d.transferencia,0))}</td>
                          <td style={{...P.td,textAlign:'right',color:'#6a1b9a'}}>${fmt(dineroPorDia.reduce((s,d)=>s+d.mixto,0))}</td>
                          <td style={{...P.td,textAlign:'right',color:'#e65100'}}>${fmt(dineroPorDia.reduce((s,d)=>s+d.credito,0))}</td>
                          <td style={{...P.td,textAlign:'right',color:'#8e24aa'}}>${fmt(dineroPorDia.reduce((s,d)=>s+d.abonosCartera,0))}</td>
                          <td style={{...P.td,textAlign:'right',fontSize:14,color:'#1a3a6b'}}><strong>${fmt(dineroPorDia.reduce((s,d)=>s+d.totalIngresado,0))}</strong></td>
                        </tr>
                      )}
                      {dineroPorDia.length===0 && <tr><td colSpan={8} style={{textAlign:'center',padding:16,color:'#aaa'}}>Sin datos en este período.</td></tr>}
                    </tbody>
                  </table>
                </div>
              )}

              {/* ── VENTAS POR DÍA (MARCA / REFERENCIA) ── */}
              {tab==='ventasDia' && ventasPorDia && (
                <div>
                  <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:10,flexWrap:'wrap',gap:8}}>
                    <div style={{...P.secTit,marginBottom:0,border:'none',paddingBottom:0}}><span style={{fontSize:18}}>📆</span> Ventas por Día — {fmtFecha(desde)} al {fmtFecha(hasta)}</div>
                    <div style={{display:'flex',gap:6}}>
                      <button onClick={()=>setCriterioVentasDia('marca')}
                        style={{padding:'6px 14px',borderRadius:5,cursor:'pointer',fontSize:12,fontWeight:700,border:'1px solid #1a3a6b',background:criterioVentasDia==='marca'?'#1a3a6b':'#fff',color:criterioVentasDia==='marca'?'#fff':'#1a3a6b'}}>Por Marca</button>
                      <button onClick={()=>setCriterioVentasDia('referencia')}
                        style={{padding:'6px 14px',borderRadius:5,cursor:'pointer',fontSize:12,fontWeight:700,border:'1px solid #1a3a6b',background:criterioVentasDia==='referencia'?'#1a3a6b':'#fff',color:criterioVentasDia==='referencia'?'#fff':'#1a3a6b'}}>Por Referencia</button>
                    </div>
                  </div>
                  {ventasPorDia.every(d=>Object.keys(d.items).length===0)
                    ? <div style={{textAlign:'center',padding:30,color:'#aaa'}}>Sin ventas en este período.</div>
                    : ventasPorDia.filter(d=>Object.keys(d.items).length>0).map(d => (
                      <div key={d.fecha} style={{marginBottom:20}}>
                        <div style={{background:'#1a3a6b',color:'#fff',padding:'6px 12px',borderRadius:5,marginBottom:6,fontWeight:700,fontSize:13,display:'flex',justifyContent:'space-between'}}>
                          <span>📅 {fmtFecha(d.fecha)}</span>
                          <span style={{fontWeight:400,opacity:0.85}}>{d.totalUnidades} unidades · ${fmt(d.totalVenta)}</span>
                        </div>
                        <table style={P.tabla}>
                          <thead>
                            <tr style={P.thead}>
                              <th style={{...P.th,textAlign:'left'}}>{criterioVentasDia==='referencia'?'Referencia':'Marca'}</th>
                              <th style={{...P.th,textAlign:'right'}}>Unidades</th>
                              <th style={{...P.th,textAlign:'right'}}>Total</th>
                            </tr>
                          </thead>
                          <tbody>
                            {Object.entries(d.items).sort((a,b)=>b[1].total-a[1].total).map(([k,v],i)=>(
                              <tr key={k} style={{background:i%2===0?'#fff':'#f5f7fc'}}>
                                <td style={{...P.td,fontWeight:600}}>{k}</td>
                                <td style={{...P.td,textAlign:'right'}}>{v.unidades}</td>
                                <td style={{...P.td,textAlign:'right',fontWeight:700,color:'#1a3a6b'}}>${fmt(v.total)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    ))
                  }
                </div>
              )}

              {/* ── TOP ARTÍCULOS ── */}
              {tab==='top' && (
                <div>
                  <div style={P.secTit}><span style={{fontSize:18}}>🏆</span> Top 10 Artículos — {fmtFecha(desde)} al {fmtFecha(hasta)}</div>
                  <table style={P.tabla}>
                    <thead>
                      <tr style={P.thead}>
                        {['#','Código','Descripción','Unidades','$ Total'].map(h=>(
                          <th key={h} style={{...P.th,textAlign:['Unidades','$ Total'].includes(h)?'right':'left'}}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {topArts.map((a,i)=>(
                        <tr key={a.codartic} style={{background:i%2===0?'#fff':'#f5f7fc'}}>
                          <td style={{...P.td,color:'#aaa',fontWeight:700}}>{i+1}</td>
                          <td style={{...P.td,fontWeight:700,color:'#1a3a6b'}}>{a.codartic}</td>
                          <td style={P.td}>{a.descartic}</td>
                          <td style={{...P.td,textAlign:'right',fontWeight:600}}>{a.unidades}</td>
                          <td style={{...P.td,textAlign:'right',fontWeight:700,color:'#1a3a6b'}}>${fmt(a.total)}</td>
                        </tr>
                      ))}
                      {topArts.length===0 && <tr><td colSpan={5} style={{textAlign:'center',padding:20,color:'#888'}}>Sin ventas en el período.</td></tr>}
                    </tbody>
                  </table>
                </div>
              )}

              {/* ── VENTAS POR CLIENTE ── */}
              {tab==='clientes' && ventasCli && (
                <div>
                  <div style={P.secTit}><span style={{fontSize:18}}>👥</span> Ventas por Cliente — {fmtFecha(desde)} al {fmtFecha(hasta)}</div>
                  <div style={{background:'#1a3a6b',color:'#fff',padding:'6px 12px',borderRadius:5,marginBottom:8,fontWeight:700,fontSize:13}}>
                    VENTAS MOSTRADOR (CLIENTE GENERAL) — ${fmt(ventasCli.totMostrador)}
                    <span style={{marginLeft:16,fontSize:11,fontWeight:400,opacity:0.8}}>{ventasCli.mostrador.length} notas</span>
                  </div>
                  <div style={{background:'#1a3a6b',color:'#fff',padding:'6px 12px',borderRadius:5,marginBottom:8,marginTop:16,fontWeight:700,fontSize:13}}>
                    VENTAS A CLIENTES ESPECÍFICOS
                  </div>
                  <table style={P.tabla}>
                    <thead>
                      <tr style={P.thead}>
                        {['Cédula','Cliente','Notas','Total','Abonado','Saldo'].map(h=>(
                          <th key={h} style={{...P.th,textAlign:['Notas','Total','Abonado','Saldo'].includes(h)?'right':'left'}}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {ventasCli.clientes.map((cl,i)=>(
                        <tr key={cl.cedula} style={{background:i%2===0?'#fff':'#f5f7fc'}}>
                          <td style={P.td}>{cl.cedula}</td>
                          <td style={{...P.td,fontWeight:600}}>{cl.nombre}</td>
                          <td style={{...P.td,textAlign:'right'}}>{cl.notas}</td>
                          <td style={{...P.td,textAlign:'right',fontWeight:700,color:'#1a3a6b'}}>${fmt(cl.total)}</td>
                          <td style={{...P.td,textAlign:'right',color:'#2e7d32'}}>${fmt(cl.abonado)}</td>
                          <td style={{...P.td,textAlign:'right',color:cl.saldo>0?'#c62828':'#2e7d32',fontWeight:700}}>${fmt(cl.saldo)}</td>
                        </tr>
                      ))}
                      {ventasCli.clientes.length>0 && (
                        <tr style={P.totRow}>
                          <td colSpan={3} style={P.td}><strong>TOTALES</strong></td>
                          <td style={{...P.td,textAlign:'right',fontSize:14,color:'#1a3a6b'}}>${fmt(ventasCli.clientes.reduce((s,c)=>s+c.total,0))}</td>
                          <td style={{...P.td,textAlign:'right',color:'#2e7d32'}}>${fmt(ventasCli.clientes.reduce((s,c)=>s+c.abonado,0))}</td>
                          <td style={{...P.td,textAlign:'right',color:'#c62828',fontSize:14}}>${fmt(ventasCli.clientes.reduce((s,c)=>s+c.saldo,0))}</td>
                        </tr>
                      )}
                      {ventasCli.clientes.length===0 && <tr><td colSpan={6} style={{textAlign:'center',padding:20,color:'#888'}}>Sin ventas a clientes específicos.</td></tr>}
                    </tbody>
                  </table>
                </div>
              )}

              {/* ── CARTERA PENDIENTE POR VENDEDOR ── */}
              {tab==='cartera' && (
                <div>
                  <div style={P.secTit}><span style={{fontSize:18}}>📋</span> Cartera Pendiente por Vendedor</div>
                  <div style={{fontSize:11,color:'#888',marginBottom:12,marginTop:-6}}>
                    Muestra toda la cartera pendiente actual (no depende del rango de fechas de arriba).
                  </div>
                  <table style={P.tabla}>
                    <thead>
                      <tr style={P.thead}>
                        {['Vendedor','Última nota','Total adeudado','Abonado','Saldo','Prom. días'].map(h=>(
                          <th key={h} style={{...P.th,textAlign:['Total adeudado','Abonado','Saldo','Prom. días'].includes(h)?'right':'left'}}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {carteraPorVend.map((v,i)=>(
                        <tr key={v.nombre} style={{background:i%2===0?'#fff':'#f5f7fc'}}>
                          <td style={{...P.td,fontWeight:700,color:'#1a3a6b'}}>{v.nombre}</td>
                          <td style={P.td}>{fmtFecha(v.ultimaFecha)}</td>
                          <td style={{...P.td,textAlign:'right'}}>${fmt(v.totalFacturado)}</td>
                          <td style={{...P.td,textAlign:'right',color:'#2e7d32'}}>${fmt(v.totalAbonado)}</td>
                          <td style={{...P.td,textAlign:'right',fontWeight:700,color:'#c62828'}}>${fmt(v.totalSaldo)}</td>
                          <td style={{...P.td,textAlign:'right',color:v.promedioDias>30?'#c62828':v.promedioDias>15?'#e65100':'#555'}}>{v.promedioDias}d</td>
                        </tr>
                      ))}
                      {carteraPorVend.length>0 && (
                        <tr style={P.totRow}>
                          <td colSpan={4} style={P.td}><strong>TOTAL CARTERA PENDIENTE (todos los vendedores)</strong></td>
                          <td style={{...P.td,textAlign:'right',fontSize:14,color:'#c62828'}}>${fmt(carteraPorVend.reduce((s,v)=>s+v.totalSaldo,0))}</td>
                          <td style={P.td}></td>
                        </tr>
                      )}
                      {carteraPorVend.length===0 && <tr><td colSpan={6} style={{textAlign:'center',padding:20,color:'#2e7d32',fontWeight:700}}><span style={{fontSize:16}}>✅</span> Sin cartera pendiente.</td></tr>}
                    </tbody>
                  </table>
                </div>
              )}

              {/* ── POR USUARIO ── */}
              {tab==='porusuario' && (() => {
                const pu = calcPorUsuario()
                if (!pu) return <div style={{textAlign:'center',padding:30,color:'#aaa'}}>Sin datos.</div>
                return (
                  <div>
                    <div style={P.secTit}><span style={{fontSize:18}}>👤</span> Consolidado por Usuario — {fmtFecha(desde)} al {fmtFecha(hasta)}</div>
                    {Object.entries(pu).sort((a,b)=>a[0].localeCompare(b[0])).map(([usu,u])=>(
                      <div key={usu} style={{marginBottom:24,border:'1px solid #e0e7f0',borderRadius:8,overflow:'hidden'}}>
                        {/* Header usuario */}
                        <div style={{background:'#1a3a6b',color:'#fff',padding:'10px 14px',fontWeight:900,fontSize:14,display:'flex',gap:16,alignItems:'center'}}>
                          <span>👤 {usu}</span>
                          <span style={{fontSize:12,fontWeight:400,opacity:0.8}}>{u.notas} notas · {fmt(u.prendas)} prendas</span>
                        </div>

                        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:0}}>
                          {/* Bloque dinero */}
                          <div style={{padding:'12px 14px',borderRight:'1px solid #eee'}}>
                            <div style={{fontSize:11,fontWeight:800,color:'#1a3a6b',marginBottom:8,textTransform:'uppercase'}}>Dinero que ingresó</div>
                            <FilaVal label="Efectivo"       val={u.efectivo}       color="#2e7d32"/>
                            <FilaVal label="Transferencia"  val={u.transferencia}  color="#1565c0"/>
                            <FilaVal label="Mixto"          val={u.mixto}          color="#6a1b9a"/>
                            <FilaVal label="Cobro cartera"  val={u.cobroCartera}   color="#e65100"/>
                            <FilaVal label="TOTAL"          val={u.totalIngresado} color="#1a3a6b" bold/>
                            <div style={{marginTop:8,borderTop:'1px solid #eee',paddingTop:6}}>
                              <FilaVal label="Ventas crédito" val={u.ventaCredito} color="#c62828"/>
                            </div>
                          </div>

                          {/* Por marca */}
                          <div style={{padding:'12px 14px',borderRight:'1px solid #eee'}}>
                            <div style={{fontSize:11,fontWeight:800,color:'#1a3a6b',marginBottom:8,textTransform:'uppercase'}}>Por marca</div>
                            <table style={{width:'100%',fontSize:12,borderCollapse:'collapse'}}>
                              <thead><tr>
                                <th style={{textAlign:'left',color:'#888',fontSize:10,fontWeight:700,paddingBottom:4}}>Marca</th>
                                <th style={{textAlign:'right',color:'#888',fontSize:10,fontWeight:700,paddingBottom:4}}>Uds</th>
                                <th style={{textAlign:'right',color:'#888',fontSize:10,fontWeight:700,paddingBottom:4}}>Total</th>
                              </tr></thead>
                              <tbody>
                                {Object.entries(u.porMarca).sort((a,b)=>b[1].total-a[1].total).map(([m,v])=>(
                                  <tr key={m}>
                                    <td style={{padding:'2px 0',color:'#333'}}>{m}</td>
                                    <td style={{textAlign:'right',color:'#666'}}>{fmt(v.unidades)}</td>
                                    <td style={{textAlign:'right',fontWeight:600,color:'#1a3a6b'}}>${fmt(v.total)}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>

                          {/* Por vendedor */}
                          <div style={{padding:'12px 14px'}}>
                            <div style={{fontSize:11,fontWeight:800,color:'#1a3a6b',marginBottom:8,textTransform:'uppercase'}}>Por vendedor</div>
                            <table style={{width:'100%',fontSize:12,borderCollapse:'collapse'}}>
                              <thead><tr>
                                <th style={{textAlign:'left',color:'#888',fontSize:10,fontWeight:700,paddingBottom:4}}>Vendedor</th>
                                <th style={{textAlign:'right',color:'#888',fontSize:10,fontWeight:700,paddingBottom:4}}>Contado</th>
                                <th style={{textAlign:'right',color:'#888',fontSize:10,fontWeight:700,paddingBottom:4}}>Crédito</th>
                              </tr></thead>
                              <tbody>
                                {Object.entries(u.porVendedor).sort((a,b)=>(b[1].contado+b[1].credito)-(a[1].contado+a[1].credito)).map(([k,v])=>(
                                  <tr key={k}>
                                    <td style={{padding:'2px 0',color:'#333',maxWidth:120,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{v.nombre}</td>
                                    <td style={{textAlign:'right',color:'#2e7d32',fontWeight:600}}>${fmt(v.contado)}</td>
                                    <td style={{textAlign:'right',color:'#c62828'}}>${fmt(v.credito)}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )
              })()}

              {/* ── NOTAS ANULADAS ── */}
              {tab==='anuladas' && (
                <div>
                  <div style={P.secTit}><span style={{fontSize:18}}>🗑</span> Notas Anuladas — {fmtFecha(desde)} al {fmtFecha(hasta)}</div>
                  {(datos.notasAnuladas||[]).length === 0
                    ? <div style={{textAlign:'center',padding:30,color:'#2e7d32',fontWeight:700}}><span style={{fontSize:16}}>✅</span> No hay notas anuladas en este período.</div>
                    : (
                      <table style={P.tabla}>
                        <thead>
                          <tr style={P.thead}>
                            {['Nota','Fecha','Cliente','Total','Motivo','Anulada el','Usuario'].map(h=>(
                              <th key={h} style={{...P.th,textAlign:h==='Total'?'right':'left'}}>{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {(datos.notasAnuladas||[]).map((n,i)=>(
                            <tr key={n.numnotaent} style={{background:i%2===0?'#fff':'#fdecea'}}>
                              <td style={{...P.td,fontWeight:700,color:'#c62828'}}>{n.numnotaent}</td>
                              <td style={P.td}>{fmtFecha(n.fechanotae)}</td>
                              <td style={P.td}>{n.nombreclie}</td>
                              <td style={{...P.td,textAlign:'right'}}>${fmt(n.valtotal)}</td>
                              <td style={P.td}>{n.motivoanula||'—'}</td>
                              <td style={P.td}>{n.fechaanula?fmtFecha(n.fechaanula):'—'}</td>
                              <td style={P.td}>{n.usuario||'—'}</td>
                            </tr>
                          ))}
                          <tr style={P.totRow}>
                            <td colSpan={3} style={P.td}><strong>TOTAL ANULADO</strong></td>
                            <td style={{...P.td,textAlign:'right',color:'#c62828'}}>${fmt((datos.notasAnuladas||[]).reduce((s,n)=>s+(n.valtotal||0),0))}</td>
                            <td colSpan={3} style={P.td}>{(datos.notasAnuladas||[]).length} notas</td>
                          </tr>
                        </tbody>
                      </table>
                    )
                  }
                </div>
              )}

            </div>
          </>
        )}
      </div>
    </div>
  )
}

const P={
  pagina:     {minHeight:'100vh',background:'#d6dce8',padding:10},
  ventana:    {background:'#eef1f7',borderRadius:8,border:'2px solid #8fa4c8',boxShadow:'0 4px 20px rgba(0,0,0,0.2)',maxWidth:1200,margin:'0 auto',overflow:'hidden',display:'flex',flexDirection:'column'},
  titulo:     {background:'linear-gradient(90deg,#1a3a6b,#2c5fa8)',color:'#fff',padding:'8px 14px',display:'flex',alignItems:'center'},
  logoTxt:    {display:'flex',flexDirection:'column',marginRight:14,lineHeight:1.1},
  titTxt:     {fontWeight:900,fontSize:15,letterSpacing:2,flex:1,textAlign:'center'},
  btnCerrar:  {background:'rgba(255,255,255,0.2)',border:'1px solid rgba(255,255,255,0.4)',color:'#fff',borderRadius:5,padding:'4px 12px',cursor:'pointer',fontWeight:700,fontSize:13},
  filtros:    {display:'flex',gap:12,alignItems:'flex-end',padding:'10px 14px',background:'#fff',borderBottom:'1px solid #c8d5ea',flexWrap:'wrap'},
  lbl:        {display:'flex',flexDirection:'column',gap:3,fontSize:11,fontWeight:700,color:'#1a3a6b'},
  inp:        {height:28,border:'1px solid #c8d5ea',borderRadius:4,padding:'0 8px',fontSize:12,outline:'none'},
  btnGenerar: {background:'#1a3a6b',color:'#fff',border:'none',borderRadius:5,padding:'0 20px',cursor:'pointer',fontWeight:700,fontSize:13,height:32},
  btnPrint:   {background:'#2e7d32',color:'#fff',border:'none',borderRadius:5,padding:'0 14px',cursor:'pointer',fontWeight:700,fontSize:12,height:32},
  tabs:       {display:'flex',gap:0,background:'#dde3ee',borderBottom:'2px solid #8fa4c8',overflowX:'auto'},
  tab:        {padding:'9px 16px',cursor:'pointer',fontSize:12,fontWeight:600,color:'#5577aa',border:'none',background:'transparent',whiteSpace:'nowrap',borderBottom:'3px solid transparent'},
  tabActivo:  {color:'#1a3a6b',fontWeight:800,borderBottom:'3px solid #1a3a6b',background:'#fff'},
  contenido:  {padding:'14px 16px',overflowY:'auto',flex:1,maxHeight:'calc(100vh - 200px)'},
  secTit:     {fontSize:14,fontWeight:800,color:'#1a3a6b',marginBottom:10,paddingBottom:6,borderBottom:'2px solid #c8d5ea'},
  tabla:      {width:'100%',borderCollapse:'collapse',fontSize:12},
  thead:      {background:'#1a3a6b',position:'sticky',top:0},
  th:         {padding:'7px 10px',color:'#fff',fontWeight:700,fontSize:11,whiteSpace:'nowrap'},
  td:         {padding:'6px 10px',borderBottom:'1px solid #eee',fontSize:12},
  totRow:     {background:'#dde3ee',fontWeight:900},
  resumenFila:{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'8px 14px',borderBottom:'1px solid #eee',borderRadius:4,marginBottom:2},
  digitalBox: {display:'flex',justifyContent:'space-between',alignItems:'center',padding:'10px 14px',marginTop:10,background:'#ede7f6',border:'1px dashed #7e57c2',borderRadius:6,fontSize:13,fontWeight:700,color:'#4527a0'},
}

function FilaVal({label, val, color='#333', bold=false}) {
  const fmt = n => Number(n||0).toLocaleString('es-CO',{minimumFractionDigits:0})
  return (
    <div style={{display:'flex',justifyContent:'space-between',fontSize:12,padding:'2px 0',borderBottom:'1px solid #f5f5f5'}}>
      <span style={{color:'#666'}}>{label}</span>
      <span style={{color, fontWeight:bold?900:600}}>${fmt(val)}</span>
    </div>
  )
}
