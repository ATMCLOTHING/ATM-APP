// src/components/Dashboard.jsx
import { useState, useEffect } from 'react'
import { LOGO } from '../lib/assets'

const fmt = n => Number(n||0).toLocaleString('es-CO',{minimumFractionDigits:0})
const hoy = () => { const d=new Date(); return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0') }

export default function Dashboard({ supabase, usuario, onModulo, onLogout }) {
  const [metricas, setMetricas] = useState(null)
  const [cargando, setCargando] = useState(true)

  useEffect(() => { cargarMetricas() }, [])

  async function cargarMetricas() {
    setCargando(true)
    const hoyStr = hoy()

    const {data:notas} = await supabase.from('encnotaen')
      .select('valtotal,valabono,saldo,cedvended,anulada,cantotal')
      .gte('fechanotae', hoyStr).lte('fechanotae', hoyStr)

    const notasActivas = (notas||[]).filter(n=>n.anulada!=='S')
    const totalVentas  = notasActivas.reduce((s,n)=>s+(n.valtotal||0),0)
    const totalAbonos  = notasActivas.reduce((s,n)=>s+(n.valabono||0),0)
    const totalPrendas = notasActivas.reduce((s,n)=>s+(n.cantotal||0),0)

    const {data:cartera} = await supabase.from('encnotaen')
      .select('saldo').eq('anulada','N').gt('saldo',0)
    const totalCartera = (cartera||[]).reduce((s,n)=>s+(n.saldo||0),0)

    const {data:bajos} = await supabase.from('articulo')
      .select('codartic,descartic,existencia,existminim')
      .filter('existencia','lte','existminim').eq('estado','A').limit(5)

    const {data:vends} = await supabase.from('vendedores').select('cedula,nombre')
    const vendMap = {}
    ;(vends||[]).forEach(v=>{ vendMap[v.cedula]=v.nombre })
    const porVend = {}
    notasActivas.forEach(n=>{
      const k = n.cedvended||'SIN VENDEDOR'
      if(!porVend[k]) porVend[k]={nombre:vendMap[k]||k,total:0,notas:0}
      porVend[k].total += n.valtotal||0
      porVend[k].notas++
    })
    const topVend = Object.values(porVend).sort((a,b)=>b.total-a.total).slice(0,5)

    setMetricas({
      totalVentas, totalAbonos, totalPrendas,
      cantNotas: notasActivas.length,
      totalCartera, bajos:bajos||[], topVend
    })
    setCargando(false)
  }

  const MODULOS = [
    {id:'nota',       icon:'📋', label:'Nota de Entrega', color:'#1a3a6b', roles:['admin','cajera','vendedor']},
    {id:'clientes',   icon:'👤', label:'Clientes',        color:'#1565c0', roles:['admin','cajera','vendedor']},
    {id:'articulos',  icon:'📦', label:'Artículos',       color:'#e65100', roles:['admin','bodega']},
    {id:'proveedores',icon:'🏭', label:'Proveedores',     color:'#00838f', roles:['admin','bodega']},
    {id:'cierre',     icon:'💰', label:'Cierre de Caja',  color:'#6a1b9a', roles:['admin']},
    {id:'cartera',    icon:'📊', label:'Cartera',         color:'#2e7d32', roles:['admin','vendedor']},
    {id:'usuarios',   icon:'👥', label:'Usuarios',        color:'#c62828', roles:['admin']},
  ]

  const modulosVisibles = MODULOS.filter(m => {
    if (usuario.rol === 'admin') return true
    return m.roles.includes(usuario.rol)
  })

  return (
    <div style={S.pagina}>
      <div style={S.header}>
        <img src={LOGO} alt="ATM" style={{height:40,objectFit:'contain'}}/>
        <div style={{flex:1}}>
          <div style={S.headerTitulo}>A TU MEDIDA — Control de Inventarios</div>
          <div style={S.headerSub}>Hoy: {new Date().toLocaleDateString('es-CO',{weekday:'long',year:'numeric',month:'long',day:'numeric'})}</div>
        </div>
        <div style={{display:'flex',alignItems:'center',gap:12}}>
          <div style={{textAlign:'right'}}>
            <div style={{color:'#fff',fontWeight:700,fontSize:13}}>{usuario.nombre}</div>
            <div style={{color:'rgba(255,255,255,0.7)',fontSize:11,textTransform:'uppercase'}}>{usuario.rol}</div>
          </div>
          <button onClick={onLogout} style={S.btnSalir} title="Cerrar sesión">⏻</button>
        </div>
      </div>

      <div style={S.contenido}>
        {usuario.rol === 'admin' && (
          <div style={S.seccion}>
            <div style={S.secTit}>📈 Resumen del día</div>
            {cargando ? (
              <div style={{textAlign:'center',padding:20,color:'#888'}}>Cargando métricas…</div>
            ) : metricas && (
              <div style={S.metricasGrid}>
                <Metrica label="Ventas del día"    val={`$${fmt(metricas.totalVentas)}`}  color="#1a3a6b" icon="💰"/>
                <Metrica label="Notas creadas"     val={metricas.cantNotas}               color="#2e7d32" icon="📋"/>
                <Metrica label="Prendas vendidas"  val={metricas.totalPrendas}            color="#e65100" icon="📦"/>
                <Metrica label="Abonos del día"    val={`$${fmt(metricas.totalAbonos)}`}  color="#00838f" icon="💵"/>
                <Metrica label="Cartera pendiente" val={`$${fmt(metricas.totalCartera)}`} color="#c62828" icon="⚠️"/>
              </div>
            )}
          </div>
        )}

        <div style={{display:'grid',gridTemplateColumns:usuario.rol==='admin'?'1fr 1fr':'1fr',gap:16}}>
          <div style={S.seccion}>
            <div style={S.secTit}>🚀 Módulos</div>
            <div style={S.modulosGrid}>
              {modulosVisibles.map(m=>(
                <button key={m.id} onClick={()=>onModulo(m.id)}
                  style={{...S.moduloBtn,border:`2px solid ${m.color}`,boxShadow:`0 4px 12px ${m.color}22`}}>
                  <span style={{fontSize:30}}>{m.icon}</span>
                  <span style={{fontSize:12,fontWeight:800,color:m.color,textAlign:'center'}}>{m.label}</span>
                </button>
              ))}
            </div>
          </div>

          {usuario.rol === 'admin' && metricas && (
            <div style={{display:'flex',flexDirection:'column',gap:16}}>
              {metricas.topVend.length > 0 && (
                <div style={S.seccion}>
                  <div style={S.secTit}>🏆 Top Vendedoras Hoy</div>
                  {metricas.topVend.map((v,i)=>(
                    <div key={v.nombre} style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'6px 0',borderBottom:'1px solid #eee'}}>
                      <div style={{display:'flex',alignItems:'center',gap:8}}>
                        <span style={{width:22,height:22,background:'#1a3a6b',color:'#fff',borderRadius:'50%',display:'flex',alignItems:'center',justifyContent:'center',fontSize:11,fontWeight:700}}>{i+1}</span>
                        <span style={{fontSize:13,fontWeight:600}}>{v.nombre}</span>
                      </div>
                      <div style={{textAlign:'right'}}>
                        <div style={{fontSize:13,fontWeight:700,color:'#1a3a6b'}}>${fmt(v.total)}</div>
                        <div style={{fontSize:10,color:'#888'}}>{v.notas} notas</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {metricas.bajos.length > 0 && (
                <div style={S.seccion}>
                  <div style={S.secTit}>⚠️ Existencias Bajas</div>
                  {metricas.bajos.map(a=>(
                    <div key={a.codartic} style={{display:'flex',justifyContent:'space-between',padding:'5px 0',borderBottom:'1px solid #eee',fontSize:12}}>
                      <span><strong>{a.codartic}</strong> — {a.descartic}</span>
                      <span style={{color:'#c62828',fontWeight:700}}>{a.existencia} / {a.existminim}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function Metrica({label,val,color,icon}){
  return(
    <div style={{background:'#fff',borderRadius:10,padding:'14px 18px',border:`2px solid ${color}22`,boxShadow:`0 2px 8px ${color}11`,display:'flex',alignItems:'center',gap:12}}>
      <span style={{fontSize:28}}>{icon}</span>
      <div>
        <div style={{fontSize:11,color:'#888',fontWeight:600,textTransform:'uppercase'}}>{label}</div>
        <div style={{fontSize:20,fontWeight:900,color}}>{val}</div>
      </div>
    </div>
  )
}

const S={
  pagina:      {minHeight:'100vh',background:'#d6dce8',display:'flex',flexDirection:'column'},
  header:      {background:'linear-gradient(90deg,#1a3a6b,#2c5fa8)',padding:'12px 24px',display:'flex',alignItems:'center',gap:16},
  headerTitulo:{color:'#fff',fontWeight:900,fontSize:15,letterSpacing:1},
  headerSub:   {color:'rgba(255,255,255,0.7)',fontSize:11},
  btnSalir:    {background:'rgba(255,255,255,0.15)',border:'1px solid rgba(255,255,255,0.3)',color:'#fff',borderRadius:'50%',width:36,height:36,cursor:'pointer',fontSize:16,display:'flex',alignItems:'center',justifyContent:'center'},
  contenido:   {padding:20,flex:1,display:'flex',flexDirection:'column',gap:16,maxWidth:1200,margin:'0 auto',width:'100%'},
  seccion:     {background:'#fff',borderRadius:10,padding:16,boxShadow:'0 2px 8px rgba(0,0,0,0.06)'},
  secTit:      {fontSize:13,fontWeight:800,color:'#1a3a6b',marginBottom:12,paddingBottom:6,borderBottom:'2px solid #eef0f5'},
  metricasGrid:{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(180px,1fr))',gap:10},
  modulosGrid: {display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(130px,1fr))',gap:10},
  moduloBtn:   {background:'#fff',borderRadius:12,padding:'18px 12px',display:'flex',flexDirection:'column',alignItems:'center',gap:8,cursor:'pointer',transition:'all 0.15s'},
}
