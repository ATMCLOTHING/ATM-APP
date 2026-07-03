// src/components/ModalInventario.jsx
// Resumen del inventario agrupado por marca, con totales en unidades y en costo.
// Se puede filtrar por marca y exportar a impresión.

import { useState, useEffect } from 'react'

const fmt  = n => Number(n||0).toLocaleString('es-CO',{minimumFractionDigits:0})
const fmtM = n => '$' + fmt(n)

export default function ModalInventario({ supabase, onClose }) {
  const [articulos, setArticulos]  = useState([])
  const [cargando,  setCargando]   = useState(true)
  const [grupoPor,  setGrupoPor]   = useState('marca')  // marca | tipo | genero
  const [filtro,    setFiltro]     = useState('')
  const [soloActivos, setSoloActivos] = useState(true)

  useEffect(() => { cargar() }, [])

  async function cargar() {
    setCargando(true)
    const { data } = await supabase.from('articulo')
      .select('codartic,descartic,marca,tipo,genero,existencia,preciocomp,preciovent,estado')
      .order('marca').order('descartic')
    setArticulos(data || [])
    setCargando(false)
  }

  const filtrados = articulos.filter(a => {
    if (soloActivos && a.estado !== 'A') return false
    if (!filtro) return true
    const q = filtro.toLowerCase()
    return (a.marca||'').toLowerCase().includes(q) ||
           (a.tipo||'').toLowerCase().includes(q) ||
           (a.genero||'').toLowerCase().includes(q) ||
           (a.descartic||'').toLowerCase().includes(q)
  })

  // Agrupar
  const grupos = {}
  filtrados.forEach(a => {
    const k = a[grupoPor] || 'SIN ' + grupoPor.toUpperCase()
    if (!grupos[k]) grupos[k] = { items:[], unidades:0, costoTotal:0, valorVenta:0 }
    grupos[k].items.push(a)
    grupos[k].unidades   += Number(a.existencia||0)
    grupos[k].costoTotal += Number(a.existencia||0) * Number(a.preciocomp||0)
    grupos[k].valorVenta += Number(a.existencia||0) * Number(a.preciovent||0)
  })

  const totUnidades   = filtrados.reduce((s,a) => s + Number(a.existencia||0), 0)
  const totCosto      = filtrados.reduce((s,a) => s + Number(a.existencia||0)*Number(a.preciocomp||0), 0)
  const totVenta      = filtrados.reduce((s,a) => s + Number(a.existencia||0)*Number(a.preciovent||0), 0)

  function imprimir() {
    const w = window.open('','_blank','width=900,height=700')
    w.document.write(`<html><head><title>Inventario</title>
    <style>body{font-family:Arial,sans-serif;font-size:11px;margin:20px;}
    h2{color:#1a3a6b;text-align:center;}
    .sub{text-align:center;color:#555;margin-bottom:12px;}
    table{width:100%;border-collapse:collapse;margin-bottom:16px;}
    th{background:#1a3a6b;color:#fff;padding:5px 8px;text-align:right;font-size:10px;}
    th:first-child,th:nth-child(2){text-align:left;}
    td{padding:4px 8px;border-bottom:1px solid #eee;text-align:right;font-size:10px;}
    td:first-child,td:nth-child(2){text-align:left;}
    .grp{background:#e8eaf6;font-weight:700;font-size:11px;}
    .tot{background:#1a3a6b;color:#fff;font-weight:900;}
    @media print{body{margin:8px;}}</style></head><body>
    <h2>ATM — RESUMEN DE INVENTARIO</h2>
    <div class="sub">Agrupado por ${grupoPor.toUpperCase()} — ${new Date().toLocaleDateString('es-CO')} — ${filtrados.length} artículos activos</div>
    ${Object.entries(grupos).sort((a,b)=>a[0].localeCompare(b[0])).map(([k,g])=>`
      <table><thead>
        <tr class="grp"><td colspan="5">${k} — ${g.items.length} refs | ${fmt(g.unidades)} uds | Costo: ${fmtM(g.costoTotal)} | Venta: ${fmtM(g.valorVenta)}</td></tr>
        <tr><th style="text-align:left">Código</th><th style="text-align:left">Descripción</th><th>Existencia</th><th>$ Costo</th><th>$ Precio Venta</th></tr>
      </thead><tbody>
      ${g.items.map(a=>`<tr>
        <td>${a.codartic}</td><td>${a.descartic}</td>
        <td>${fmt(a.existencia)}</td>
        <td>${fmtM(a.preciocomp)}</td>
        <td>${fmtM(a.preciovent)}</td>
      </tr>`).join('')}
      </tbody></table>
    `).join('')}
    <table><thead>
      <tr class="tot"><td colspan="2">TOTALES GENERALES — ${filtrados.length} referencias</td>
      <td>${fmt(totUnidades)} uds</td>
      <td>${fmtM(totCosto)}</td>
      <td>${fmtM(totVenta)}</td></tr>
    </thead></table>
    </body></html>`)
    w.document.close(); w.focus(); setTimeout(()=>{ w.print(); w.close() }, 400)
  }

  return (
    <div style={S.fondo}>
      <div style={S.modal}>
        {/* Header */}
        <div style={S.header}>
          <span style={S.tit}>📊 RESUMEN DE INVENTARIO</span>
          <button onClick={imprimir} style={S.btnPrint}>🖨 Imprimir</button>
          <button onClick={onClose}  style={S.btnX}>✕ Cerrar</button>
        </div>

        {/* Controles */}
        <div style={S.controles}>
          <label style={S.lbl}>Agrupar por
            <select style={S.inp} value={grupoPor} onChange={e=>setGrupoPor(e.target.value)}>
              <option value="marca">Marca</option>
              <option value="tipo">Tipo (Jean, Camiseta…)</option>
              <option value="genero">Género</option>
            </select>
          </label>
          <label style={S.lbl}>Buscar
            <input style={{...S.inp,width:220}} value={filtro} onChange={e=>setFiltro(e.target.value)}
              placeholder="Marca, tipo, descripción…"/>
          </label>
          <label style={{...S.lbl,flexDirection:'row',alignItems:'center',gap:6,marginTop:16}}>
            <input type="checkbox" checked={soloActivos} onChange={e=>setSoloActivos(e.target.checked)}/>
            Solo artículos activos
          </label>
        </div>

        {/* Resumen general */}
        <div style={S.resumen}>
          <div style={S.card}><span style={S.cardLbl}>Referencias</span><span style={S.cardVal}>{filtrados.length}</span></div>
          <div style={S.card}><span style={S.cardLbl}>Total unidades</span><span style={S.cardVal}>{fmt(totUnidades)}</span></div>
          <div style={S.card}><span style={S.cardLbl}>Costo inventario</span><span style={{...S.cardVal,color:'#c62828'}}>{fmtM(totCosto)}</span></div>
          <div style={S.card}><span style={S.cardLbl}>Valor venta</span><span style={{...S.cardVal,color:'#2e7d32'}}>{fmtM(totVenta)}</span></div>
        </div>

        {/* Tabla por grupos */}
        <div style={S.tabla}>
          {cargando ? (
            <div style={{textAlign:'center',padding:40,color:'#888'}}>⏳ Cargando inventario…</div>
          ) : (
            Object.entries(grupos)
              .sort((a,b) => a[0].localeCompare(b[0]))
              .map(([k, g]) => (
                <div key={k} style={S.grupo}>
                  <div style={S.grupoHeader}>
                    <span style={{fontWeight:800}}>{k}</span>
                    <span style={{fontSize:12,color:'#888'}}>{g.items.length} refs</span>
                    <span style={{fontWeight:700}}>{fmt(g.unidades)} uds</span>
                    <span style={{color:'#c62828'}}>Costo: {fmtM(g.costoTotal)}</span>
                    <span style={{color:'#2e7d32'}}>Venta: {fmtM(g.valorVenta)}</span>
                  </div>
                  <table style={S.tablaInner}>
                    <thead>
                      <tr style={S.thead}>
                        <th style={{...S.th,textAlign:'left'}}>Código</th>
                        <th style={{...S.th,textAlign:'left',minWidth:200}}>Descripción</th>
                        <th style={S.th}>Existencia</th>
                        <th style={S.th}>$ Costo</th>
                        <th style={S.th}>$ Precio</th>
                        <th style={S.th}>$ Total costo</th>
                      </tr>
                    </thead>
                    <tbody>
                      {g.items.map((a,i)=>(
                        <tr key={a.codartic} style={{background:i%2===0?'#fff':'#f8faff'}}>
                          <td style={{...S.td,fontWeight:700,color:'#1a3a6b'}}>{a.codartic}</td>
                          <td style={S.td}>{a.descartic}</td>
                          <td style={{...S.td,textAlign:'right',fontWeight:Number(a.existencia)<0?700:400,color:Number(a.existencia)<0?'#c62828':'#333'}}>
                            {fmt(a.existencia)}
                          </td>
                          <td style={{...S.td,textAlign:'right',color:'#666'}}>{fmtM(a.preciocomp)}</td>
                          <td style={{...S.td,textAlign:'right'}}>{fmtM(a.preciovent)}</td>
                          <td style={{...S.td,textAlign:'right',fontWeight:600}}>{fmtM(Number(a.existencia||0)*Number(a.preciocomp||0))}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ))
          )}
        </div>
      </div>
    </div>
  )
}

const S = {
  fondo:       {position:'fixed',inset:0,background:'rgba(0,0,0,0.6)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:500},
  modal:       {background:'#f0f2f5',borderRadius:10,width:'92vw',maxWidth:1100,height:'92vh',display:'flex',flexDirection:'column',boxShadow:'0 8px 40px rgba(0,0,0,0.3)',overflow:'hidden'},
  header:      {background:'linear-gradient(90deg,#1a3a6b,#2c5fa8)',padding:'10px 16px',display:'flex',alignItems:'center',gap:10},
  tit:         {fontSize:15,fontWeight:900,color:'#fff',letterSpacing:2,flex:1},
  btnPrint:    {background:'rgba(255,255,255,0.2)',border:'1px solid rgba(255,255,255,0.4)',color:'#fff',borderRadius:5,padding:'5px 12px',cursor:'pointer',fontWeight:700,fontSize:12},
  btnX:        {background:'#e74c3c',border:'none',color:'#fff',borderRadius:5,padding:'5px 10px',cursor:'pointer',fontWeight:700,fontSize:13},
  controles:   {display:'flex',gap:14,padding:'10px 14px',background:'#fff',borderBottom:'1px solid #dde3ee',flexWrap:'wrap',alignItems:'flex-end'},
  lbl:         {display:'flex',flexDirection:'column',gap:3,fontSize:11,fontWeight:700,color:'#1a3a6b'},
  inp:         {height:28,border:'1px solid #c8d5ea',borderRadius:4,padding:'0 8px',fontSize:12,outline:'none'},
  resumen:     {display:'flex',gap:10,padding:'10px 14px',background:'#fff',borderBottom:'1px solid #dde3ee',flexWrap:'wrap'},
  card:        {display:'flex',flexDirection:'column',gap:2,background:'#f4f6fb',border:'1px solid #e0e7f0',borderRadius:6,padding:'8px 14px'},
  cardLbl:     {fontSize:10,fontWeight:700,color:'#888',textTransform:'uppercase'},
  cardVal:     {fontSize:17,fontWeight:900,color:'#1a3a6b'},
  tabla:       {flex:1,overflowY:'auto',padding:'10px 14px'},
  grupo:       {marginBottom:16,borderRadius:6,overflow:'hidden',border:'1px solid #e0e7f0'},
  grupoHeader: {display:'flex',gap:16,alignItems:'center',background:'#e8eaf6',padding:'8px 12px',fontSize:13,fontWeight:600,color:'#1a3a6b',flexWrap:'wrap'},
  tablaInner:  {width:'100%',borderCollapse:'collapse',fontSize:12},
  thead:       {background:'#f0f0f0'},
  th:          {padding:'5px 10px',fontWeight:700,color:'#555',textAlign:'center',fontSize:11,whiteSpace:'nowrap'},
  td:          {padding:'4px 10px',borderBottom:'1px solid #f0f0f0',fontSize:12},
}
