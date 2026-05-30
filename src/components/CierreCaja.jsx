import { useState } from 'react'
import { WZCLOSE, WZPRINT, WZLOCATE } from '../lib/assets'

const fmt = n => Number(n||0).toLocaleString('es-CO',{minimumFractionDigits:0,maximumFractionDigits:0})

// Normaliza mediopago — históricas tienen E/T/M/C, nuevas tienen texto completo
const normMedio = m => {
  if (!m) return 'efectivo'
  const v = String(m).trim().toUpperCase()
  if (v==='E' || v==='EFECTIVO')        return 'efectivo'
  if (v==='T' || v==='TRANSFERENCIA')   return 'transferencia'
  if (v==='M' || v==='MIXTO')           return 'mixto'
  if (v==='C' || v==='CREDITO' || v==='CRÉDITO') return 'credito'
  return 'efectivo'
}

// Determina quién hizo la nota según número
const quienHizoNota = num => {
  const n = Number(num)||0
  if (n < 1000000)              return 'Vendedor/Admin'
  if (n >= 1000000 && n <= 1999999) return 'Cajera 1'
  if (n >= 2000000 && n <= 2999999) return 'Cajera 2'
  if (n >= 3000000 && n <= 3999999) return 'Cajera 3'
  return 'Otro'
}
const hoy = () => { const d=new Date(); return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0') }
const ayer = () => { const d=new Date(); d.setDate(d.getDate()-1); return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0') }

export default function CierreCaja({ supabase, onClose }) {
  const [desde,    setDesde]    = useState(hoy())
  const [hasta,    setHasta]    = useState(hoy())
  const [datos,    setDatos]    = useState(null)
  const [cargando, setCargando] = useState(false)
  const [tab,      setTab]      = useState('consolidado')

  async function generar() {
    setCargando(true)
    try {
      // Notas del período (no anuladas)
      const {data:notas} = await supabase.from('encnotaen')
        .select('numnotaent,fechanotae,nombreclie,cedrifclie,cedvended,valtotal,valabono,saldo,formapago,mediopago,cantotal,codclient,usuario')
        .gte('fechanotae',desde).lte('fechanotae',hasta)
        .or('anulada.is.null,anulada.neq.S')

      // Detalle de notas
      const numNotas = (notas||[]).map(n=>n.numnotaent)
      let detalle = []
      if (numNotas.length > 0) {
        const {data:det} = await supabase.from('detnotaen')
          .select('numnotaent,codartic,descartic,cantidad,valunit,valtotal')
          .in('numnotaent', numNotas)
        detalle = det||[]
      }

      // Artículos con marca
      const codarts = [...new Set(detalle.map(d=>d.codartic))]
      let artMap = {}
      if (codarts.length > 0) {
        const {data:arts} = await supabase.from('articomp')
          .select('codartic,marca').in('codartic',codarts)
        ;(arts||[]).forEach(a=>{ artMap[a.codartic]=a.marca||'SIN MARCA' })
      }

      // Vendedores
      const {data:vends} = await supabase.from('vendedores').select('cedula,nombre')
      const vendMap = {}
      ;(vends||[]).forEach(v=>{ vendMap[v.cedula]=v.nombre })

      // Notas de ayer para comparativo
      const {data:notasAyer} = await supabase.from('encnotaen')
        .select('valtotal,valabono').gte('fechanotae',ayer()).lte('fechanotae',ayer()).or('anulada.is.null,anulada.neq.S')

      // Abonos del período
      const {data:abonos} = await supabase.from('detabonos')
        .select('numnotaent,valabono,mediopago,fechaabono')
        .gte('fechaabono',desde).lte('fechaabono',hasta)

      // Cartera TOTAL — todas las notas con saldo pendiente sin importar fecha
      const {data:carteraTotal} = await supabase.from('encnotaen')
        .select('saldo')
        .or('anulada.is.null,anulada.neq.S')
        .gt('saldo', 0)
      const totalCarteraGlobal = (carteraTotal||[]).reduce((s,n)=>s+(n.saldo||0), 0)

      setDatos({ notas:notas||[], detalle, artMap, vendMap, abonos:abonos||[], notasAyer:notasAyer||[], totalCarteraGlobal })
    } catch(e) { console.error(e) }
    setCargando(false)
  }

  function calcConsolidado() {
    if (!datos) return null
    const { notas, vendMap } = datos

    // Por vendedor
    const porVend = {}
    notas.forEach(n => {
      const key = n.cedvended||'SIN VENDEDOR'
      const nombre = vendMap[key]||key
      if (!porVend[nombre]) porVend[nombre] = {efectivo:0,transferencia:0,mixto:0,credito:0,noAbonado:0,total:0}
      const v = porVend[nombre]
      const medio = normMedio(n.mediopago)
      const esCredito = n.formapago !== 'CONTADO' && n.saldo > 0
      if (esCredito) {
        v.credito   += n.valabono||0
        v.noAbonado += n.saldo||0
      } else {
        if (medio==='efectivo')       v.efectivo      += n.valtotal
        else if (medio==='transferencia') v.transferencia += n.valtotal
        else if (medio==='mixto')     v.mixto         += n.valtotal
        else                          v.efectivo      += n.valtotal
      }
      v.total += n.valtotal
    })

    // Totales
    const totales = {efectivo:0,transferencia:0,mixto:0,credito:0,noAbonado:0,total:0}
    Object.values(porVend).forEach(v=>{
      totales.efectivo      += v.efectivo
      totales.transferencia += v.transferencia
      totales.mixto         += v.mixto
      totales.credito       += v.credito
      totales.noAbonado     += v.noAbonado
      totales.total         += v.total
    })

    // Por cajera — usa campo usuario de la BD
    const LABEL_CAJERA = {
      'caja1': 'Cajera 1', 'caja2': 'Cajera 2', 'caja3': 'Cajera 3',
      'admin': 'Admin', 'laura': 'Vendedor Laura', 'prendas': 'Bodega'
    }
    const porCajera = {}
    notas.forEach(n => {
      const cajera = LABEL_CAJERA[n.usuario] || n.usuario || 'Sin usuario'
      if (!porCajera[cajera]) porCajera[cajera] = {efectivo:0,transferencia:0,mixto:0,credito:0,noAbonado:0,total:0,notas:0}
      const v = porCajera[cajera]
      const medio = normMedio(n.mediopago)
      const esCredito = n.formapago !== 'CONTADO' && n.saldo > 0
      if (esCredito) {
        v.credito   += n.valabono||0
        v.noAbonado += n.saldo||0
      } else {
        if (medio==='efectivo')       v.efectivo      += n.valtotal
        else if (medio==='transferencia') v.transferencia += n.valtotal
        else if (medio==='mixto')     { v.efectivo += n.valtotal/2; v.transferencia += n.valtotal/2 }
        else                          v.efectivo      += n.valtotal
      }
      v.total += n.valtotal
      v.notas++
    })

    return {porVend, totales, porCajera}
  }

  function calcMarcas() {
    if (!datos) return null
    const { detalle, artMap } = datos
    const porMarca = {}
    detalle.forEach(d => {
      const marca = artMap[d.codartic]||'SIN MARCA'
      if (!porMarca[marca]) porMarca[marca] = {unidades:0,total:0}
      porMarca[marca].unidades += Number(d.cantidad)||0
      porMarca[marca].total    += Number(d.valtotal)||0
    })
    return porMarca
  }

  function calcResumen() {
    if (!datos) return null
    const { notas, abonos, notasAyer } = datos
    const MOSTRADOR = ['99','9','999','5031']

    let totalVentas=0,totalCredito=0,totalContado=0
    let totalEfectivo=0,totalTransferencia=0,totalMixto=0
    // Contado NO mostrador = vendedores (usuario admin, notas < 1M)
    // Contado EN mostrador = cajeras (caja1, caja2, caja3)
    let totalNoMostrador=0  // vendedores
    let totalCaja1=0, totalCaja2=0, totalCaja3=0  // cajeras

    notas.forEach(n=>{
      totalVentas += n.valtotal||0
      const medio = normMedio(n.mediopago)
      const esCredito = n.formapago !== 'CONTADO' && (n.saldo||0) > 0
      const usu = (n.usuario||'').toLowerCase()
      const esCaja1 = usu === 'caja1'
      const esCaja2 = usu === 'caja2'
      const esCaja3 = usu === 'caja3'
      const esVendedor = !esCaja1 && !esCaja2 && !esCaja3

      if (!esCredito) {
        totalContado += n.valtotal||0
        if (esVendedor)   totalNoMostrador += n.valtotal||0
        if (esCaja1)      totalCaja1       += n.valtotal||0
        if (esCaja2)      totalCaja2       += n.valtotal||0
        if (esCaja3)      totalCaja3       += n.valtotal||0
        if (medio==='efectivo')           totalEfectivo      += n.valtotal||0
        else if (medio==='transferencia') totalTransferencia += n.valtotal||0
        else if (medio==='mixto')         totalMixto         += n.valtotal||0
        else                              totalEfectivo      += n.valtotal||0
      } else {
        totalCredito += n.valtotal||0
      }
    })

    const totalMostrador     = totalCaja1 + totalCaja2 + totalCaja3
    const totalAbonosCredito = abonos.reduce((s,a)=>s+(a.valabono||0),0)
    const totalAyer          = notasAyer.reduce((s,n)=>s+(n.valtotal||0),0)
    const totalIngresado     = totalEfectivo + totalTransferencia + totalMixto

    return { totalVentas,totalCredito,totalContado,totalMostrador,totalNoMostrador,
             totalEfectivo,totalTransferencia,totalMixto,totalIngresado,
             totalCaja1,totalCaja2,totalCaja3,
             totalAbonosCredito,totalAyer,
             totalPendiente: datos.totalCarteraGlobal||0,
             cantNotas:notas.length }
  }

  function calcTopArticulos() {
    if (!datos) return []
    const { detalle } = datos
    const map = {}
    detalle.forEach(d=>{
      const k=d.codartic
      if(!map[k]) map[k]={codartic:k,descartic:d.descartic,unidades:0,total:0}
      map[k].unidades += Number(d.cantidad)||0
      map[k].total    += Number(d.valtotal)||0
    })
    return Object.values(map).sort((a,b)=>b.total-a.total).slice(0,10)
  }

  function calcCartera() {
    if (!datos) return []
    const { notas } = datos
    return notas.filter(n=>n.saldo>0)
      .sort((a,b)=>a.fechanotae.localeCompare(b.fechanotae))
      .map(n=>({...n, diasVencido: Math.floor((new Date()-new Date(n.fechanotae))/(1000*60*60*24))}))
  }

  function calcVentasCliente() {
    if (!datos) return {mostrador:[], clientes:[]}
    const { notas } = datos
    const MOSTRADOR = ['99','9','999','5031']
    const mostrador = notas.filter(n=>MOSTRADOR.includes(String(n.codclient||'')))
    const clientes  = notas.filter(n=>!MOSTRADOR.includes(String(n.codclient||'')))
    // agrupar por cliente
    const map = {}
    clientes.forEach(n=>{
      const k = n.cedrifclie||String(n.codclient)
      if(!map[k]) map[k]={cedula:k,nombre:n.nombreclie,notas:0,total:0,abonado:0,saldo:0}
      map[k].notas++
      map[k].total   += n.valtotal||0
      map[k].abonado += n.valabono||0
      map[k].saldo   += n.saldo||0
    })
    const totMostrador = mostrador.reduce((s,n)=>s+(n.valtotal||0),0)
    return { mostrador, clientes:Object.values(map).sort((a,b)=>b.total-a.total), totMostrador }
  }

  const cons = calcConsolidado()
  const marcas = calcMarcas()
  const resumen = calcResumen()
  const topArts = calcTopArticulos()
  const cartera = calcCartera()
  const ventasCli = calcVentasCliente()

  function imprimirConsolidado() {
    if (!cons) return
    const w = window.open('','_blank','width=900,height=600')
    w.document.write(`<html><head><title>Consolidado</title>
    <style>
      body{font-family:Arial,sans-serif;font-size:11px;padding:20px;}
      h2,h3{color:#1a3a6b;text-align:center;}
      .sub{text-align:center;color:#555;margin-bottom:12px;}
      table{width:100%;border-collapse:collapse;margin-bottom:20px;}
      th{background:#1a3a6b;color:#fff;padding:6px 8px;text-align:right;font-size:10px;}
      th:first-child{text-align:left;}
      td{padding:5px 8px;border-bottom:1px solid #eee;text-align:right;}
      td:first-child{text-align:left;}
      tr:nth-child(even){background:#f5f7fc;}
      .total-row{font-weight:900;background:#dde3ee!important;font-size:12px;}
      @media print{body{padding:8px;}}
    </style></head><body>
    <h2>INFORME CONSOLIDADO DE MOVIMIENTOS</h2>
    <div class="sub">DESDE ${desde} &nbsp;&nbsp; HASTA ${hasta}</div>
    <table>
      <thead><tr>
        <th>DETALLE</th><th>EFECTIVO</th><th>TRANSF.</th><th>MIXTO</th><th>CRÉDITO</th><th>NO ABONADO</th><th>TOTAL</th>
      </tr></thead>
      <tbody>
        <tr><td colspan="7"><b>INGRESOS</b></td></tr>
        ${Object.entries(cons.porVend).map(([nom,v])=>`
          <tr>
            <td>VENTAS - ${nom.toUpperCase()}</td>
            <td>$${fmt(v.efectivo)}</td><td>$${fmt(v.transferencia)}</td>
            <td>$${fmt(v.mixto)}</td><td>$${fmt(v.credito)}</td>
            <td>$${fmt(v.noAbonado)}</td><td><b>$${fmt(v.total)}</b></td>
          </tr>`).join('')}
        <tr class="total-row">
          <td>INGRESOS TOTALES</td>
          <td>$${fmt(cons.totales.efectivo)}</td><td>$${fmt(cons.totales.transferencia)}</td>
          <td>$${fmt(cons.totales.mixto)}</td><td>$${fmt(cons.totales.credito)}</td>
          <td>$${fmt(cons.totales.noAbonado)}</td><td>$${fmt(cons.totales.total)}</td>
        </tr>
      </tbody>
    </table>
    ${marcas?`
    <table>
      <thead><tr><th>MARCA</th><th>UNIDADES</th><th>$ PROMEDIO</th><th>$ TOTAL</th></tr></thead>
      <tbody>
        ${Object.entries(marcas).sort((a,b)=>b[1].total-a[1].total).map(([m,v])=>`
          <tr><td>${m}</td><td>${v.unidades}</td><td>$${fmt(v.unidades>0?v.total/v.unidades:0)}</td><td>$${fmt(v.total)}</td></tr>
        `).join('')}
        <tr class="total-row"><td>TOTALES</td>
          <td>${Object.values(marcas).reduce((s,v)=>s+v.unidades,0)}</td><td></td>
          <td>$${fmt(Object.values(marcas).reduce((s,v)=>s+v.total,0))}</td></tr>
      </tbody>
    </table>`:''}
    </body></html>`)
    w.document.close(); w.focus(); setTimeout(()=>{w.print();w.close()},400)
  }

  function imprimirMarcas() {
    if (!marcas) return
    const w = window.open('','_blank','width=700,height=500')
    w.document.write(`<html><head><title>Ventas por Marca</title>
    <style>body{font-family:Arial,sans-serif;font-size:12px;padding:20px;}
    h2{color:#1a3a6b;text-align:center;}
    .sub{text-align:center;color:#555;margin-bottom:12px;}
    table{width:100%;border-collapse:collapse;}
    th{background:#1a3a6b;color:#fff;padding:6px 8px;text-align:right;font-size:10px;}
    th:first-child{text-align:left;}
    td{padding:5px 8px;border-bottom:1px solid #eee;text-align:right;}
    td:first-child{text-align:left;}
    tr:nth-child(even){background:#f5f7fc;}
    .tot{font-weight:900;background:#dde3ee;}
    </style></head><body>
    <h2>ATM — VENTAS POR MARCA</h2>
    <div class="sub">DESDE ${desde} &nbsp;&nbsp; HASTA ${hasta}</div>
    <table><thead><tr><th>Marca</th><th>Unidades</th><th>$ Promedio</th><th>$ Total</th></tr></thead>
    <tbody>
    ${Object.entries(marcas).sort((a,b)=>b[1].total-a[1].total).map(([m,v])=>`
      <tr><td>${m}</td><td>${v.unidades}</td>
      <td>$${fmt(v.unidades>0?v.total/v.unidades:0)}</td>
      <td>$${fmt(v.total)}</td></tr>`).join('')}
    <tr class="tot"><td>TOTALES</td>
    <td>${Object.values(marcas).reduce((s,v)=>s+v.unidades,0)}</td><td></td>
    <td>$${fmt(Object.values(marcas).reduce((s,v)=>s+v.total,0))}</td></tr>
    </tbody></table></body></html>`)
    w.document.close(); w.focus(); setTimeout(()=>{w.print();w.close()},400)
  }

  function imprimirTop() {
    const w = window.open('','_blank','width=700,height=500')
    w.document.write(`<html><head><title>Top Artículos</title>
    <style>body{font-family:Arial,sans-serif;font-size:12px;padding:20px;}
    h2{color:#1a3a6b;text-align:center;}
    .sub{text-align:center;color:#555;margin-bottom:12px;}
    table{width:100%;border-collapse:collapse;}
    th{background:#1a3a6b;color:#fff;padding:6px 8px;text-align:left;font-size:10px;}
    td{padding:5px 8px;border-bottom:1px solid #eee;}
    tr:nth-child(even){background:#f5f7fc;}
    </style></head><body>
    <h2>ATM — TOP 10 ARTÍCULOS</h2>
    <div class="sub">DESDE ${desde} &nbsp;&nbsp; HASTA ${hasta}</div>
    <table><thead><tr><th>#</th><th>Código</th><th>Descripción</th><th style="text-align:right">Unidades</th><th style="text-align:right">$ Total</th></tr></thead>
    <tbody>
    ${topArts.map((a,i)=>`
      <tr><td>${i+1}</td><td>${a.codartic}</td><td>${a.descartic}</td>
      <td style="text-align:right">${a.unidades}</td>
      <td style="text-align:right">$${fmt(a.total)}</td></tr>`).join('')}
    </tbody></table></body></html>`)
    w.document.close(); w.focus(); setTimeout(()=>{w.print();w.close()},400)
  }

  function imprimirCartera() {
    const w = window.open('','_blank','width=900,height=600')
    w.document.write(`<html><head><title>Cartera</title>
    <style>body{font-family:Arial,sans-serif;font-size:11px;padding:20px;}
    h2{color:#1a3a6b;text-align:center;}
    .sub{text-align:center;color:#555;margin-bottom:12px;}
    table{width:100%;border-collapse:collapse;}
    th{background:#1a3a6b;color:#fff;padding:6px 8px;font-size:10px;}
    td{padding:5px 8px;border-bottom:1px solid #eee;}
    tr:nth-child(even){background:#f5f7fc;}
    .tot{font-weight:900;background:#dde3ee;}
    .mora{color:#c62828;font-weight:700;}
    </style></head><body>
    <h2>ATM — CARTERA PENDIENTE</h2>
    <div class="sub">DESDE ${desde} &nbsp;&nbsp; HASTA ${hasta}</div>
    <table><thead><tr>
      <th>Nota</th><th>Fecha</th><th>Cliente</th>
      <th style="text-align:right">Total</th><th style="text-align:right">Abonado</th>
      <th style="text-align:right">Saldo</th><th style="text-align:right">Días</th>
    </tr></thead><tbody>
    ${cartera.map(n=>`
      <tr><td>${n.numnotaent}</td><td>${n.fechanotae}</td><td>${n.nombreclie}</td>
      <td style="text-align:right">$${fmt(n.valtotal)}</td>
      <td style="text-align:right">$${fmt(n.valabono)}</td>
      <td style="text-align:right;font-weight:700;color:#c62828">$${fmt(n.saldo)}</td>
      <td style="text-align:right" class="${n.diasVencido>30?'mora':''}">${n.diasVencido}d</td></tr>`).join('')}
    <tr class="tot"><td colspan="5">TOTAL PENDIENTE</td>
    <td style="text-align:right">$${fmt(cartera.reduce((s,n)=>s+n.saldo,0))}</td><td></td></tr>
    </tbody></table></body></html>`)
    w.document.close(); w.focus(); setTimeout(()=>{w.print();w.close()},400)
  }

  function imprimirVentasCliente() {
    const w = window.open('','_blank','width=900,height=600')
    w.document.write(`<html><head><title>Ventas por Cliente</title>
    <style>body{font-family:Arial,sans-serif;font-size:11px;padding:20px;}
    h2{color:#1a3a6b;text-align:center;}
    .sub{text-align:center;color:#555;margin-bottom:12px;}
    .seccion{font-weight:900;background:#1a3a6b;color:#fff;padding:5px 8px;margin-top:12px;}
    table{width:100%;border-collapse:collapse;}
    th{background:#dde3ee;color:#1a3a6b;padding:5px 8px;font-size:10px;font-weight:700;}
    td{padding:5px 8px;border-bottom:1px solid #eee;}
    tr:nth-child(even){background:#f5f7fc;}
    .tot{font-weight:900;background:#dde3ee;}
    </style></head><body>
    <h2>ATM — VENTAS POR CLIENTE</h2>
    <div class="sub">DESDE ${desde} &nbsp;&nbsp; HASTA ${hasta}</div>
    <div class="seccion">VENTAS MOSTRADOR (CLIENTE GENERAL) — $${fmt(ventasCli.totMostrador)}</div>
    <table><thead><tr><th>Nota</th><th>Fecha</th><th style="text-align:right">Total</th><th style="text-align:right">Abonado</th><th style="text-align:right">Saldo</th></tr></thead>
    <tbody>
    ${ventasCli.mostrador.map(n=>`
      <tr><td>${n.numnotaent}</td><td>${n.fechanotae}</td>
      <td style="text-align:right">$${fmt(n.valtotal)}</td>
      <td style="text-align:right">$${fmt(n.valabono)}</td>
      <td style="text-align:right">$${fmt(n.saldo)}</td></tr>`).join('')}
    </tbody></table>
    <div class="seccion">VENTAS A CLIENTES ESPECÍFICOS</div>
    <table><thead><tr><th>Cédula</th><th>Cliente</th><th style="text-align:right">Notas</th><th style="text-align:right">Total</th><th style="text-align:right">Abonado</th><th style="text-align:right">Saldo</th></tr></thead>
    <tbody>
    ${ventasCli.clientes.map(cl=>`
      <tr><td>${cl.cedula}</td><td>${cl.nombre}</td>
      <td style="text-align:right">${cl.notas}</td>
      <td style="text-align:right">$${fmt(cl.total)}</td>
      <td style="text-align:right">$${fmt(cl.abonado)}</td>
      <td style="text-align:right;color:#c62828">$${fmt(cl.saldo)}</td></tr>`).join('')}
    <tr class="tot"><td colspan="3">TOTALES</td>
    <td style="text-align:right">$${fmt(ventasCli.clientes.reduce((s,c)=>s+c.total,0))}</td>
    <td style="text-align:right">$${fmt(ventasCli.clientes.reduce((s,c)=>s+c.abonado,0))}</td>
    <td style="text-align:right;color:#c62828">$${fmt(ventasCli.clientes.reduce((s,c)=>s+c.saldo,0))}</td></tr>
    </tbody></table>
    </body></html>`)
    w.document.close(); w.focus(); setTimeout(()=>{w.print();w.close()},400)
  }

  function imprimirResumen() {
    if (!resumen) return
    const w = window.open('','_blank','width=700,height=500')
    w.document.write(`<html><head><title>Resumen</title>
    <style>
      body{font-family:Arial,sans-serif;font-size:12px;padding:20px;}
      h2,h3{color:#1a3a6b;text-align:center;}
      .sub{text-align:center;color:#555;margin-bottom:16px;}
      .fila{display:flex;justify-content:space-between;padding:8px 12px;border-bottom:1px solid #eee;}
      .fila.total{font-weight:900;font-size:14px;background:#dde3ee;border-top:2px solid #1a3a6b;}
      .lbl{color:#333;}
      .val{color:#1a3a6b;font-weight:700;}
      @media print{body{padding:8px;}}
    </style></head><body>
    <h2>RESUMEN DE VENTAS DIARIAS</h2>
    <div class="sub">DESDE ${desde} &nbsp;&nbsp; HASTA ${hasta}</div>
    <div class="fila"><span class="lbl">VENTAS TOTALES (CONTADO + CRÉDITO)</span><span class="val">$${fmt(resumen.totalVentas)}</span></div>
    <div class="fila"><span class="lbl">VENTAS TOTALES A CRÉDITO</span><span class="val">$${fmt(resumen.totalCredito)}</span></div>
    <div class="fila"><span class="lbl">VENTAS TOTALES DE CONTADO</span><span class="val">$${fmt(resumen.totalContado)}</span></div>
    <div class="fila"><span class="lbl">VENTAS CONTADO NO MOSTRADOR</span><span class="val">$${fmt(resumen.totalNoMostrador)}</span></div>
    <div class="fila"><span class="lbl">VENTAS CONTADO EN MOSTRADOR</span><span class="val">$${fmt(resumen.totalMostrador)}</span></div>
    <div class="fila"><span class="lbl">ABONOS A CRÉDITOS</span><span class="val">$${fmt(resumen.totalAbonosCredito)}</span></div>
    <div class="fila"><span class="lbl">INGRESOS EN EFECTIVO</span><span class="val">$${fmt(resumen.totalEfectivo)}</span></div>
    <div class="fila"><span class="lbl">INGRESOS EN TRANSFERENCIA</span><span class="val">$${fmt(resumen.totalTransferencia)}</span></div>
    <div class="fila"><span class="lbl">INGRESOS EN MIXTO</span><span class="val">$${fmt(resumen.totalMixto)}</span></div>
    <div class="fila"><span class="lbl">CONTADO NO MOSTRADOR (VENDEDORES)</span><span class="val">$${fmt(resumen.totalNoMostrador)}</span></div>
    <div class="fila"><span class="lbl">VENTAS CAJA 1</span><span class="val">$${fmt(resumen.totalCaja1)}</span></div>
    <div class="fila"><span class="lbl">VENTAS CAJA 2</span><span class="val">$${fmt(resumen.totalCaja2)}</span></div>
    <div class="fila"><span class="lbl">VENTAS CAJA 3</span><span class="val">$${fmt(resumen.totalCaja3)}</span></div>
    <div class="fila"><span class="lbl">CONTADO EN MOSTRADOR (CAJERAS)</span><span class="val">$${fmt(resumen.totalMostrador)}</span></div>
    <div class="fila total"><span class="lbl">TOTAL DINERO INGRESADO</span><span class="val">$${fmt(resumen.totalIngresado)}</span></div>
    <div class="fila"><span class="lbl">SALDO PENDIENTE POR COBRAR</span><span class="val" style="color:#c62828">$${fmt(resumen.totalPendiente)}</span></div>
    <div class="fila"><span class="lbl">VENTAS DÍA ANTERIOR</span><span class="val">$${fmt(resumen.totalAyer)}</span></div>
    <div class="fila"><span class="lbl" style="color:${resumen.totalVentas>=resumen.totalAyer?'#2e7d32':'#c62828'}">
      ${resumen.totalVentas>=resumen.totalAyer?'▲ MEJOR QUE AYER':'▼ MENOR QUE AYER'} (${resumen.totalAyer>0?Math.round((resumen.totalVentas-resumen.totalAyer)/resumen.totalAyer*100):0}%)
    </span><span></span></div>
    </body></html>`)
    w.document.close(); w.focus(); setTimeout(()=>{w.print();w.close()},400)
  }

  const TABS = [
    {id:'consolidado', label:'📊 Consolidado por Vendedor'},
    {id:'marcas',      label:'🏷️ Ventas por Marca'},
    {id:'clientes',    label:'👥 Ventas por Cliente'},
    {id:'resumen',     label:'💰 Resumen del Día'},
    {id:'top',         label:'🏆 Top Artículos'},
    {id:'cartera',     label:'📋 Cartera Pendiente'},
  ]

  return (
    <div style={P.pagina}>
      <div style={P.ventana}>
        {/* TÍTULO */}
        <div style={P.titulo}>
          <div style={P.logoTxt}>
            <span style={{fontFamily:'Arial Black',fontWeight:900,fontSize:20,color:'#fff',letterSpacing:3}}>ATM</span>
            <span style={{fontSize:9,color:'rgba(255,255,255,0.8)',letterSpacing:2}}>A TU MEDIDA</span>
          </div>
          <span style={P.titTxt}>CIERRE DE CAJA / INFORMES</span>
          <button onClick={onClose} style={P.btnCerrar}>← Menú</button>
        </div>

        {/* FILTROS */}
        <div style={P.filtros}>
          <label style={P.lbl}>Desde
            <input type="date" style={P.inp} value={desde} onChange={e=>setDesde(e.target.value)}/>
          </label>
          <label style={P.lbl}>Hasta
            <input type="date" style={P.inp} value={hasta} onChange={e=>setHasta(e.target.value)}/>
          </label>
          <button onClick={generar} disabled={cargando} style={P.btnGenerar}>
            {cargando ? '⏳ Calculando…' : '🔍 Generar Informes'}
          </button>
          {datos && (
            <div style={{marginLeft:'auto',display:'flex',gap:8}}>
              {tab==='consolidado' && <button onClick={imprimirConsolidado} style={P.btnPrint}>🖨 Imprimir</button>}
              {tab==='marcas'      && <button onClick={imprimirMarcas}      style={P.btnPrint}>🖨 Imprimir</button>}
              {tab==='clientes'    && <button onClick={imprimirVentasCliente} style={P.btnPrint}>🖨 Imprimir</button>}
              {tab==='resumen'     && <button onClick={imprimirResumen}     style={P.btnPrint}>🖨 Imprimir</button>}
              {tab==='top'         && <button onClick={imprimirTop}         style={P.btnPrint}>🖨 Imprimir</button>}
              {tab==='cartera'     && <button onClick={imprimirCartera}     style={P.btnPrint}>🖨 Imprimir</button>}
            </div>
          )}
        </div>

        {!datos && !cargando && (
          <div style={{textAlign:'center',padding:60,color:'#aab8d4',fontSize:14}}>
            Selecciona el rango de fechas y presiona <strong>Generar Informes</strong>
          </div>
        )}

        {datos && (
          <>
            {/* TABS */}
            <div style={P.tabs}>
              {TABS.map(t=>(
                <button key={t.id} onClick={()=>setTab(t.id)}
                  style={{...P.tab, ...(tab===t.id?P.tabActivo:{})}}>
                  {t.label}
                </button>
              ))}
            </div>

            <div style={P.contenido}>

              {/* ── CONSOLIDADO POR VENDEDOR ── */}
              {tab==='consolidado' && cons && (
                <div>
                  <div style={P.secTit}>📊 Ingresos por Vendedor — {desde} al {hasta}</div>
                  <table style={P.tabla}>
                    <thead>
                      <tr style={P.thead}>
                        {['Vendedor','Efectivo','Transferencia','Mixto','Crédito','No Abonado','Total'].map(h=>(
                          <th key={h} style={{...P.th,textAlign:h==='Vendedor'?'left':'right'}}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {Object.entries(cons.porVend).map(([nom,v],i)=>(
                        <tr key={nom} style={{background:i%2===0?'#fff':'#f5f7fc'}}>
                          <td style={P.td}><strong>{nom.toUpperCase()}</strong></td>
                          <td style={{...P.td,textAlign:'right'}}>{v.efectivo?`$${fmt(v.efectivo)}`:''}</td>
                          <td style={{...P.td,textAlign:'right'}}>{v.transferencia?`$${fmt(v.transferencia)}`:''}</td>
                          <td style={{...P.td,textAlign:'right'}}>{v.mixto?`$${fmt(v.mixto)}`:''}</td>
                          <td style={{...P.td,textAlign:'right'}}>{v.credito?`$${fmt(v.credito)}`:''}</td>
                          <td style={{...P.td,textAlign:'right',color:'#c62828'}}>{v.noAbonado?`$${fmt(v.noAbonado)}`:''}</td>
                          <td style={{...P.td,textAlign:'right',fontWeight:700,color:'#1a3a6b'}}>${fmt(v.total)}</td>
                        </tr>
                      ))}
                      <tr style={P.totRow}>
                        <td style={P.td}><strong>TOTALES</strong></td>
                        <td style={{...P.td,textAlign:'right'}}>${fmt(cons.totales.efectivo)}</td>
                        <td style={{...P.td,textAlign:'right'}}>${fmt(cons.totales.transferencia)}</td>
                        <td style={{...P.td,textAlign:'right'}}>${fmt(cons.totales.mixto)}</td>
                        <td style={{...P.td,textAlign:'right'}}>${fmt(cons.totales.credito)}</td>
                        <td style={{...P.td,textAlign:'right',color:'#c62828'}}>${fmt(cons.totales.noAbonado)}</td>
                        <td style={{...P.td,textAlign:'right',fontSize:15,color:'#1a3a6b'}}>${fmt(cons.totales.total)}</td>
                      </tr>
                    </tbody>
                  </table>

                  {/* TABLA POR CAJERA */}
                  <div style={{marginTop:20}}>
                    <div style={P.secTit}>🏧 Ventas por Cajera / Origen — {desde} al {hasta}</div>
                    <table style={P.tabla}>
                      <thead>
                        <tr style={P.thead}>
                          {['Origen','Notas','$ Efectivo','$ Transferencia','$ Mixto','$ Crédito','$ Por cobrar','$ Total'].map(h=>(
                            <th key={h} style={{...P.th,textAlign:h==='Origen'?'left':'right'}}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {['Cajera 1','Cajera 2','Cajera 3','Admin','Vendedor Laura','Bodega','Sin usuario']
                          .filter(k => cons.porCajera[k])
                          .map((k,i) => {
                            const v = cons.porCajera[k]
                            return (
                              <tr key={k} style={{background:i%2===0?'#fff':'#f8faff'}}>
                                <td style={{...P.td,fontWeight:700}}>{k}</td>
                                <td style={{...P.td,textAlign:'right'}}>{v.notas}</td>
                                <td style={{...P.td,textAlign:'right',color:'#2e7d32'}}>{v.efectivo?`$${fmt(v.efectivo)}`:'-'}</td>
                                <td style={{...P.td,textAlign:'right',color:'#1565c0'}}>{v.transferencia?`$${fmt(v.transferencia)}`:'-'}</td>
                                <td style={{...P.td,textAlign:'right',color:'#6a1b9a'}}>{v.mixto?`$${fmt(v.mixto)}`:'-'}</td>
                                <td style={{...P.td,textAlign:'right',color:'#e65100'}}>{v.credito?`$${fmt(v.credito)}`:'-'}</td>
                                <td style={{...P.td,textAlign:'right',color:'#c62828'}}>{v.noAbonado?`$${fmt(v.noAbonado)}`:'-'}</td>
                                <td style={{...P.td,textAlign:'right',fontWeight:700}}>${fmt(v.total)}</td>
                              </tr>
                            )
                          })
                        }
                      </tbody>
                      <tfoot>
                        <tr style={{background:'#e8eaf6',fontWeight:700}}>
                          <td style={P.td}>TOTALES</td>
                          <td style={{...P.td,textAlign:'right'}}>{Object.values(cons.porCajera).reduce((s,v)=>s+v.notas,0)}</td>
                          <td style={{...P.td,textAlign:'right',color:'#2e7d32'}}>${fmt(cons.totales.efectivo)}</td>
                          <td style={{...P.td,textAlign:'right',color:'#1565c0'}}>${fmt(cons.totales.transferencia)}</td>
                          <td style={{...P.td,textAlign:'right',color:'#6a1b9a'}}>${fmt(cons.totales.mixto)}</td>
                          <td style={{...P.td,textAlign:'right',color:'#e65100'}}>${fmt(cons.totales.credito)}</td>
                          <td style={{...P.td,textAlign:'right',color:'#c62828'}}>${fmt(cons.totales.noAbonado)}</td>
                          <td style={{...P.td,textAlign:'right'}}>${fmt(cons.totales.total)}</td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                </div>
              )}

              {/* ── VENTAS POR MARCA ── */}
              {tab==='marcas' && marcas && (
                <div>
                  <div style={P.secTit}>🏷️ Ventas por Marca — {desde} al {hasta}</div>
                  <table style={P.tabla}>
                    <thead>
                      <tr style={P.thead}>
                        {['Marca','Unidades','$ Promedio','$ Total'].map(h=>(
                          <th key={h} style={{...P.th,textAlign:h==='Marca'?'left':'right'}}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {Object.entries(marcas).sort((a,b)=>b[1].total-a[1].total).map(([m,v],i)=>(
                        <tr key={m} style={{background:i%2===0?'#fff':'#f5f7fc'}}>
                          <td style={P.td}><strong>{m}</strong></td>
                          <td style={{...P.td,textAlign:'right'}}>{v.unidades}</td>
                          <td style={{...P.td,textAlign:'right'}}>${fmt(v.unidades>0?v.total/v.unidades:0)}</td>
                          <td style={{...P.td,textAlign:'right',fontWeight:700,color:'#1a3a6b'}}>${fmt(v.total)}</td>
                        </tr>
                      ))}
                      <tr style={P.totRow}>
                        <td style={P.td}><strong>TOTALES</strong></td>
                        <td style={{...P.td,textAlign:'right'}}>{Object.values(marcas).reduce((s,v)=>s+v.unidades,0)}</td>
                        <td style={P.td}></td>
                        <td style={{...P.td,textAlign:'right',fontSize:15,color:'#1a3a6b'}}>${fmt(Object.values(marcas).reduce((s,v)=>s+v.total,0))}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              )}

              {/* ── RESUMEN DEL DÍA ── */}
              {tab==='resumen' && resumen && (
                <div style={{maxWidth:600}}>
                  <div style={P.secTit}>💰 Resumen del Día — {desde} al {hasta}</div>
                  {[
                    {lbl:'Notas generadas',          val:resumen.cantNotas,          mono:true},
                    {lbl:'Ventas totales (contado + crédito)', val:`$${fmt(resumen.totalVentas)}`, grande:true},
                    {lbl:'Ventas a crédito',                    val:`$${fmt(resumen.totalCredito)}`},
                    {lbl:'Ventas de contado',                   val:`$${fmt(resumen.totalContado)}`},
                    {lbl:'Ingresos en efectivo',                val:`$${fmt(resumen.totalEfectivo)}`},
                    {lbl:'Ingresos en transferencia',           val:`$${fmt(resumen.totalTransferencia)}`},
                    {lbl:'Ingresos en mixto',                   val:`$${fmt(resumen.totalMixto)}`},
                    {lbl:'Contado NO mostrador (vendedores)',   val:`$${fmt(resumen.totalNoMostrador)}`},
                    {lbl:'Ventas Caja 1',                       val:`$${fmt(resumen.totalCaja1)}`},
                    {lbl:'Ventas Caja 2',                       val:`$${fmt(resumen.totalCaja2)}`},
                    {lbl:'Ventas Caja 3',                       val:`$${fmt(resumen.totalCaja3)}`},
                    {lbl:'Contado EN mostrador (cajeras)',      val:`$${fmt(resumen.totalMostrador)}`},
                    {lbl:'Abonos a créditos recibidos hoy',    val:`$${fmt(resumen.totalAbonosCredito)}`},
                    {lbl:'TOTAL DINERO INGRESADO',              val:`$${fmt(resumen.totalIngresado)}`, grande:true, color:'#1a3a6b'},
                    {lbl:'Saldo pendiente por cobrar',val:`$${fmt(resumen.totalPendiente)}`, color:'#c62828'},
                    {lbl:'Ventas día anterior',       val:`$${fmt(resumen.totalAyer)}`},
                    {lbl:resumen.totalVentas>=resumen.totalAyer?'▲ Mejor que ayer':'▼ Menor que ayer',
                     val:`${resumen.totalAyer>0?Math.round((resumen.totalVentas-resumen.totalAyer)/resumen.totalAyer*100):0}%`,
                     color:resumen.totalVentas>=resumen.totalAyer?'#2e7d32':'#c62828'},
                  ].map((r,i)=>(
                    <div key={i} style={{...P.resumenFila,background:r.grande?'#eef2ff':'#fff',borderTop:r.grande?'2px solid #1a3a6b':'none'}}>
                      <span style={{fontSize:r.grande?13:12,fontWeight:r.grande?800:500,color:'#333'}}>{r.lbl}</span>
                      <span style={{fontSize:r.grande?16:13,fontWeight:700,color:r.color||'#1a3a6b'}}>{r.val}</span>
                    </div>
                  ))}
                </div>
              )}

              {/* ── TOP ARTÍCULOS ── */}
              {tab==='top' && (
                <div>
                  <div style={P.secTit}>🏆 Top 10 Artículos — {desde} al {hasta}</div>
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
                          <td style={{...P.td,textAlign:'center',color:'#aaa',fontWeight:700}}>{i+1}</td>
                          <td style={{...P.td,fontWeight:700,color:'#1a3a6b'}}>{a.codartic}</td>
                          <td style={P.td}>{a.descartic}</td>
                          <td style={{...P.td,textAlign:'right',fontWeight:600}}>{a.unidades}</td>
                          <td style={{...P.td,textAlign:'right',fontWeight:700,color:'#1a3a6b'}}>${fmt(a.total)}</td>
                        </tr>
                      ))}
                      {topArts.length===0&&<tr><td colSpan={5} style={{textAlign:'center',padding:20,color:'#888'}}>Sin ventas en el período.</td></tr>}
                    </tbody>
                  </table>
                </div>
              )}

              {/* ── VENTAS POR CLIENTE ── */}
              {tab==='clientes' && ventasCli && (
                <div>
                  <div style={P.secTit}>👥 Ventas por Cliente — {desde} al {hasta}</div>
                  <div style={{background:'#1a3a6b',color:'#fff',padding:'6px 12px',borderRadius:5,marginBottom:8,fontWeight:700,fontSize:13}}>
                    VENTAS MOSTRADOR (CLIENTE GENERAL) — ${fmt(ventasCli.totMostrador)}
                    <span style={{marginLeft:16,fontSize:11,fontWeight:400,opacity:0.8}}>{ventasCli.mostrador.length} notas</span>
                  </div>
                  <div style={{marginBottom:14,fontSize:12,color:'#555'}}>
                    Ventas de mostrador: notas donde el cliente es General (código 99)
                  </div>
                  <div style={{background:'#1a3a6b',color:'#fff',padding:'6px 12px',borderRadius:5,marginBottom:8,fontWeight:700,fontSize:13}}>
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
                      {ventasCli.clientes.length>0&&(
                        <tr style={P.totRow}>
                          <td colSpan={3} style={P.td}><strong>TOTALES</strong></td>
                          <td style={{...P.td,textAlign:'right',fontSize:14,color:'#1a3a6b'}}>${fmt(ventasCli.clientes.reduce((s,c)=>s+c.total,0))}</td>
                          <td style={{...P.td,textAlign:'right',color:'#2e7d32'}}>${fmt(ventasCli.clientes.reduce((s,c)=>s+c.abonado,0))}</td>
                          <td style={{...P.td,textAlign:'right',color:'#c62828',fontSize:14}}>${fmt(ventasCli.clientes.reduce((s,c)=>s+c.saldo,0))}</td>
                        </tr>
                      )}
                      {ventasCli.clientes.length===0&&<tr><td colSpan={6} style={{textAlign:'center',padding:20,color:'#888'}}>Sin ventas a clientes específicos en este período.</td></tr>}
                    </tbody>
                  </table>
                </div>
              )}

              {/* ── CARTERA PENDIENTE ── */}
              {tab==='cartera' && (
                <div>
                  <div style={P.secTit}>📋 Cartera Pendiente — Notas con saldo sin pagar</div>
                  <table style={P.tabla}>
                    <thead>
                      <tr style={P.thead}>
                        {['Nota','Fecha','Cliente','Total','Abonado','Saldo','Días'].map(h=>(
                          <th key={h} style={{...P.th,textAlign:['Total','Abonado','Saldo','Días'].includes(h)?'right':'left'}}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {cartera.map((n,i)=>(
                        <tr key={n.numnotaent} style={{background:i%2===0?'#fff':'#f5f7fc'}}>
                          <td style={{...P.td,fontWeight:700,color:'#1a3a6b'}}>{n.numnotaent}</td>
                          <td style={P.td}>{n.fechanotae}</td>
                          <td style={P.td}>{n.nombreclie}</td>
                          <td style={{...P.td,textAlign:'right'}}>${fmt(n.valtotal)}</td>
                          <td style={{...P.td,textAlign:'right',color:'#2e7d32'}}>${fmt(n.valabono)}</td>
                          <td style={{...P.td,textAlign:'right',fontWeight:700,color:'#c62828'}}>${fmt(n.saldo)}</td>
                          <td style={{...P.td,textAlign:'right',color:n.diasVencido>30?'#c62828':n.diasVencido>15?'#e65100':'#555'}}>
                            {n.diasVencido}d
                          </td>
                        </tr>
                      ))}
                      {cartera.length>0&&(
                        <tr style={P.totRow}>
                          <td colSpan={5} style={P.td}><strong>TOTAL PENDIENTE</strong></td>
                          <td style={{...P.td,textAlign:'right',fontSize:14,color:'#c62828'}}>${fmt(cartera.reduce((s,n)=>s+n.saldo,0))}</td>
                          <td style={P.td}></td>
                        </tr>
                      )}
                      {cartera.length===0&&<tr><td colSpan={7} style={{textAlign:'center',padding:20,color:'#2e7d32',fontWeight:700}}>✅ Sin cartera pendiente en este período.</td></tr>}
                    </tbody>
                  </table>
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
}
