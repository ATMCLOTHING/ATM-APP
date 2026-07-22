// src/components/ControlDocumentos.jsx
import { useState, useEffect } from 'react'
import { WZCLOSE } from '../lib/assets'

const fmt    = n => Number(n||0).toLocaleString('es-CO',{minimumFractionDigits:0})
const fmtFec = f => f ? new Date(f+'T00:00:00').toLocaleDateString('es-CO',{day:'2-digit',month:'2-digit',year:'numeric'}) : ''

const ESTADOS = [
  { id:'almacen',  label:'Almacén',           color:'#1a3a6b', bg:'#e8eef8', icon:'🏪' },
  { id:'vendedor', label:'Vendedor',           color:'#e65100', bg:'#fff3e0', icon:'🤝' },
  { id:'cxc',      label:'Cuentas por Cobrar', color:'#6a1b9a', bg:'#f3e5f5', icon:'📂' },
  { id:'liquidada',label:'Liquidada',          color:'#2e7d32', bg:'#e8f5e9', icon:'✅' },
  { id:'eliminada',label:'Eliminada',          color:'#c62828', bg:'#ffebee', icon:'🗑' },
]

const getEstado = id => ESTADOS.find(e=>e.id===id) || ESTADOS[0]

export default function ControlDocumentos({ supabase, onClose }) {
  const [notas,       setNotas]       = useState([])
  const [vendedores,  setVendedores]  = useState([])
  const [filtroVend,  setFiltroVend]  = useState('')
  const [filtroEst,   setFiltroEst]   = useState('')
  const [filtroBusq,  setFiltroBusq]  = useState('')
  const [cargando,    setCargando]    = useState(false)
  const [msg,         setMsg]         = useState(null)
  const [cambiando,   setCambiando]   = useState({}) // {id: true} mientras guarda

  useEffect(() => { cargarVendedores() }, [])
  useEffect(() => { cargarNotas() }, [filtroVend, filtroEst])

  async function cargarVendedores() {
    const {data} = await supabase.from('vendedores').select('cedula,nombre').order('nombre')
    setVendedores(data||[])
  }

  async function cargarNotas() {
    setCargando(true)
    let q = supabase.from('encnotaen')
      .select('numnotaent,fechanotae,nombreclie,cedrifclie,cedvended,valtotal,saldo,estado_doc,anulada')
      .lt('numnotaent', 1000000)          // solo notas de vendedor
      .or('anulada.is.null,anulada.neq.S')
      .order('numnotaent', {ascending:false})
      .limit(300)

    if (filtroVend) q = q.eq('cedvended', filtroVend)
    if (filtroEst)  q = q.eq('estado_doc', filtroEst)

    const {data, error} = await q
    if (error) { setMsg({tipo:'err', texto:`❌ ${error.message}`}); setCargando(false); return }

    // Enriquecer con nombre del vendedor
    const vendMap = {}
    ;(vendedores).forEach(v => { vendMap[v.cedula] = v.nombre })
    const enriquecidas = (data||[]).map(n => ({...n, nomvended: vendMap[n.cedvended]||n.cedvended||'Sin vendedor'}))
    setNotas(enriquecidas)
    setCargando(false)
  }

  async function cambiarEstado(nota, nuevoEstado) {
    setCambiando(p=>({...p,[nota.numnotaent]:true}))
    const {error} = await supabase.from('encnotaen')
      .update({estado_doc: nuevoEstado})
      .eq('numnotaent', nota.numnotaent)
    if (error) {
      setMsg({tipo:'err', texto:`❌ ${error.message}`})
    } else {
      setNotas(prev => prev.map(n =>
        n.numnotaent === nota.numnotaent ? {...n, estado_doc: nuevoEstado} : n
      ))
    }
    setCambiando(p=>({...p,[nota.numnotaent]:false}))
  }

  // Filtro de búsqueda en JS (nombre cliente o # doc)
  const notasFiltradas = notas.filter(n => {
    if (!filtroBusq) return true
    const b = filtroBusq.toLowerCase()
    return String(n.numnotaent).includes(b) ||
           (n.nombreclie||'').toLowerCase().includes(b) ||
           (n.cedrifclie||'').includes(b) ||
           (n.nomvended||'').toLowerCase().includes(b)
  })

  // Resumen por estado
  const resumen = ESTADOS.map(e => ({
    ...e,
    cant: notas.filter(n=>(n.estado_doc||'almacen')===e.id).length,
    saldo: notas.filter(n=>(n.estado_doc||'almacen')===e.id).reduce((s,n)=>s+(n.saldo||0),0)
  }))

  return (
    <div style={P.pagina}>
      <div style={P.ventana}>

        {/* TÍTULO */}
        <div style={P.titulo}>
          <div style={{display:'flex',flexDirection:'column',marginRight:14,lineHeight:1}}>
            <span style={{fontFamily:'Arial Black',fontWeight:900,fontSize:20,color:'#fff',letterSpacing:3}}>ATM</span>
            <span style={{fontSize:9,color:'rgba(255,255,255,0.8)',letterSpacing:2}}>A TU MEDIDA</span>
          </div>
          <span style={P.titTxt}>CONTROL DE DOCUMENTOS</span>
          <button onClick={onClose} style={P.btnCerrar}>← Menú</button>
        </div>

        {msg && (
          <div style={{...P.alerta, background:msg.tipo==='ok'?'#e8f5e9':'#ffebee', color:msg.tipo==='ok'?'#2e7d32':'#c62828', border:`1px solid ${msg.tipo==='ok'?'#a5d6a7':'#ef9a9a'}`}}>
            {msg.texto}
            <button onClick={()=>setMsg(null)} style={P.alertaX}>✕</button>
          </div>
        )}

        {/* RESUMEN POR ESTADO */}
        <div style={P.resumenGrid}>
          {resumen.map(e=>(
            <div key={e.id}
              onClick={()=>setFiltroEst(filtroEst===e.id?'':e.id)}
              style={{...P.resumenCard, background:e.bg, border:`2px solid ${filtroEst===e.id?e.color:'transparent'}`, cursor:'pointer'}}>
              <span style={{fontSize:26}}>{e.icon}</span>
              <div>
                <div style={{fontSize:10,color:'#666',fontWeight:600,textTransform:'uppercase'}}>{e.label}</div>
                <div style={{fontSize:18,fontWeight:900,color:e.color}}>{e.cant}</div>
                <div style={{fontSize:10,color:'#888'}}>Saldo: ${fmt(e.saldo)}</div>
              </div>
            </div>
          ))}
        </div>

        {/* FILTROS */}
        <div style={P.filtros}>
          <select style={P.sel} value={filtroVend} onChange={e=>setFiltroVend(e.target.value)}>
            <option value="">— Todos los vendedores —</option>
            {vendedores.map(v=><option key={v.cedula} value={v.cedula}>{v.nombre}</option>)}
          </select>
          <select style={P.sel} value={filtroEst} onChange={e=>setFiltroEst(e.target.value)}>
            <option value="">— Todos los estados —</option>
            {ESTADOS.map(e=><option key={e.id} value={e.id}>{e.icon} {e.label}</option>)}
          </select>
          <input
            style={{...P.sel, flex:1}}
            placeholder="🔍 Buscar por # doc, cliente, cédula o vendedor…"
            value={filtroBusq}
            onChange={e=>setFiltroBusq(e.target.value)}
          />
          <button onClick={cargarNotas} style={P.btnRecargar} title="Recargar">🔄</button>
        </div>

        {/* TABLA */}
        <div style={P.tablaWrap}>
          {cargando ? (
            <div style={{textAlign:'center',padding:40,color:'#888'}}>Cargando documentos…</div>
          ) : (
            <table style={P.tabla}>
              <thead>
                <tr style={P.thead}>
                  {['# Doc','Fecha','Cédula','Cliente','Vendedor','Total','Saldo','Estado','Cambiar a'].map(h=>(
                    <th key={h} style={P.th}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {notasFiltradas.length === 0 && (
                  <tr><td colSpan={9} style={{textAlign:'center',padding:24,color:'#aaa'}}>Sin documentos para mostrar.</td></tr>
                )}
                {notasFiltradas.map((n,i)=>{
                  const est = getEstado(n.estado_doc||'almacen')
                  const guardando = cambiando[n.numnotaent]
                  return (
                    <tr key={n.numnotaent} style={{background:i%2===0?'#fff':'#f8faff'}}>
                      <td style={{...P.td,fontWeight:700,color:'#1a3a6b'}}>{n.numnotaent}</td>
                      <td style={P.td}>{fmtFec(n.fechanotae)}</td>
                      <td style={P.td}>{n.cedrifclie}</td>
                      <td style={{...P.td,maxWidth:180,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{n.nombreclie}</td>
                      <td style={{...P.td,maxWidth:140,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{n.nomvended}</td>
                      <td style={{...P.td,textAlign:'right',fontWeight:600}}>${fmt(n.valtotal)}</td>
                      <td style={{...P.td,textAlign:'right',fontWeight:700,color:n.saldo>0?'#c62828':'#2e7d32'}}>${fmt(n.saldo)}</td>
                      <td style={P.td}>
                        <span style={{...P.badge, background:est.bg, color:est.color, border:`1px solid ${est.color}44`}}>
                          <span style={{fontSize:14}}>{est.icon}</span> {est.label}
                        </span>
                      </td>
                      <td style={{...P.td,minWidth:200}}>
                        {guardando ? (
                          <span style={{fontSize:11,color:'#888'}}>Guardando…</span>
                        ) : (
                          <div style={{display:'flex',gap:3,flexWrap:'wrap'}}>
                            {ESTADOS.filter(e=>e.id!==(n.estado_doc||'almacen')).map(e=>(
                              <button key={e.id}
                                onClick={()=>cambiarEstado(n,e.id)}
                                title={`Mover a ${e.label}`}
                                style={{...P.btnEst, background:e.bg, color:e.color, border:`1px solid ${e.color}66`}}>
                                {e.icon}
                              </button>
                            ))}
                          </div>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>

        <div style={{padding:'8px 16px',fontSize:11,color:'#888',textAlign:'right'}}>
          {notasFiltradas.length} documento(s) mostrado(s)
        </div>
      </div>
    </div>
  )
}

const P = {
  pagina:      {minHeight:'100vh',background:'#d6dce8',padding:10},
  ventana:     {background:'#eef1f7',borderRadius:8,border:'2px solid #8fa4c8',boxShadow:'0 4px 20px rgba(0,0,0,0.2)',maxWidth:1300,margin:'0 auto',overflow:'hidden',display:'flex',flexDirection:'column'},
  titulo:      {background:'linear-gradient(90deg,#1a3a6b,#2c5fa8)',color:'#fff',padding:'8px 14px',display:'flex',alignItems:'center'},
  titTxt:      {fontWeight:900,fontSize:15,letterSpacing:2,flex:1,textAlign:'center'},
  btnCerrar:   {background:'rgba(255,255,255,0.2)',border:'1px solid rgba(255,255,255,0.4)',color:'#fff',borderRadius:5,padding:'4px 12px',cursor:'pointer',fontWeight:700,fontSize:13},
  alerta:      {margin:'6px 12px',padding:'7px 12px',borderRadius:5,fontSize:12,display:'flex',justifyContent:'space-between',alignItems:'center'},
  alertaX:     {background:'none',border:'none',cursor:'pointer',fontWeight:900,fontSize:18},
  resumenGrid: {display:'flex',gap:10,padding:'12px 16px',flexWrap:'wrap'},
  resumenCard: {display:'flex',alignItems:'center',gap:10,padding:'10px 16px',borderRadius:8,flex:1,minWidth:140,transition:'all 0.15s',userSelect:'none'},
  filtros:     {display:'flex',gap:8,padding:'0 16px 10px',alignItems:'center',flexWrap:'wrap'},
  sel:         {height:32,border:'1px solid #c8d5ea',borderRadius:5,padding:'0 8px',fontSize:12,outline:'none',color:'#1a3a6b',background:'#fff',minWidth:180},
  btnRecargar: {height:32,padding:'0 10px',border:'1px solid #c8d5ea',borderRadius:5,background:'#fff',cursor:'pointer',fontSize:18},
  tablaWrap:   {overflowX:'auto',overflowY:'auto',flex:1,maxHeight:'calc(100vh - 280px)',margin:'0 0 0 0'},
  tabla:       {width:'100%',borderCollapse:'collapse',fontSize:12},
  thead:       {background:'#1a3a6b',position:'sticky',top:0,zIndex:2},
  th:          {padding:'8px 10px',textAlign:'left',fontWeight:700,color:'#fff',whiteSpace:'nowrap',borderRight:'1px solid #2c5fa8'},
  td:          {padding:'5px 8px',borderBottom:'1px solid #e8eef5',verticalAlign:'middle',fontSize:12},
  badge:       {display:'inline-block',padding:'2px 8px',borderRadius:10,fontSize:11,fontWeight:700,whiteSpace:'nowrap'},
  btnEst:      {border:'none',borderRadius:4,padding:'3px 7px',cursor:'pointer',fontSize:17,fontWeight:700,whiteSpace:'nowrap'},
}
