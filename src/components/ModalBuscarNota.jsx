// src/components/ModalBuscarNota.jsx
import { useState } from 'react'

const fmt = n => Number(n||0).toLocaleString('es-CO',{minimumFractionDigits:2,maximumFractionDigits:2})
const hoy = () => { const d=new Date(); return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0') }
const unMesAtras = () => { const d=new Date(); d.setMonth(d.getMonth()-1); return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0') }

export default function ModalBuscarNota({ supabase, onSelect, onClose }) {
  const [nroNota,   setNroNota]   = useState('')
  const [cedula,    setCedula]    = useState('')
  const [nombre,    setNombre]    = useState('')
  const [desde,     setDesde]     = useState(unMesAtras())
  const [hasta,     setHasta]     = useState(hoy())
  const [usarFecha, setUsarFecha] = useState(false)
  const [resultados,setResultados]= useState([])
  const [buscando,  setBuscando]  = useState(false)
  const [buscado,   setBuscado]   = useState(false)
  const [seleccion, setSeleccion] = useState(null)

  async function buscar() {
    setBuscando(true); setBuscado(false); setResultados([]); setSeleccion(null)
    let q = supabase.from('encnotaen')
      .select('numnotaent,fechanotae,cedrifclie,nombreclie,valtotal,valabono,saldo,anulada,cantotal')
      .order('numnotaent', {ascending:false})
      .limit(100)

    if (nroNota.trim())  q = q.ilike('numnotaent', `%${nroNota.trim()}%`)
    if (cedula.trim())   q = q.ilike('cedrifclie',  `%${cedula.trim()}%`)
    if (nombre.trim())   q = q.ilike('nombreclie',  `%${nombre.trim()}%`)
    if (usarFecha) {
      q = q.gte('fechanotae', desde).lte('fechanotae', hasta)
    }

    const {data, error} = await q
    setResultados(data||[])
    setBuscado(true); setBuscando(false)
  }

  function elegir(nota) {
    onSelect(nota.numnotaent)
  }

  return (
    <div style={S.fondo}>
      <div style={S.modal}>
        <div style={S.titulo}>
          <span>🔍 BUSCAR NOTA DE ENTREGA</span>
          <button onClick={onClose} style={S.btnX}>✕</button>
        </div>

        {/* FILTROS */}
        <div style={S.filtros}>
          <div style={S.filaF}>
            <label style={S.lbl}>N° Nota
              <input style={S.inp} value={nroNota} onChange={e=>setNroNota(e.target.value)}
                onKeyDown={e=>e.key==='Enter'&&buscar()} placeholder="Ej: 1073609"/>
            </label>
            <label style={S.lbl}>Cédula cliente
              <input style={S.inp} value={cedula} onChange={e=>setCedula(e.target.value)}
                onKeyDown={e=>e.key==='Enter'&&buscar()} placeholder="Cédula o NIT"/>
            </label>
            <label style={S.lbl}>Nombre cliente
              <input style={S.inp} value={nombre} onChange={e=>setNombre(e.target.value)}
                onKeyDown={e=>e.key==='Enter'&&buscar()} placeholder="Nombre o parte del nombre"/>
            </label>
          </div>
          <div style={S.filaF}>
            <label style={{...S.lbl,flexDirection:'row',alignItems:'center',gap:8,width:'auto'}}>
              <input type="checkbox" checked={usarFecha} onChange={e=>setUsarFecha(e.target.checked)}/>
              Filtrar por fecha
            </label>
            {usarFecha && <>
              <label style={S.lbl}>Desde
                <input type="date" style={S.inp} value={desde} onChange={e=>setDesde(e.target.value)}/>
              </label>
              <label style={S.lbl}>Hasta
                <input type="date" style={S.inp} value={hasta} onChange={e=>setHasta(e.target.value)}/>
              </label>
            </>}
            <button onClick={buscar} disabled={buscando} style={S.btnBuscar}>
              {buscando ? '⏳ Buscando…' : '🔍 Buscar'}
            </button>
          </div>
        </div>

        {/* RESULTADOS */}
        {buscado && resultados.length===0 && (
          <p style={{textAlign:'center',color:'#888',padding:20}}>No se encontraron notas con esos criterios.</p>
        )}

        {resultados.length>0 && (
          <div style={S.tablaWrap}>
            <table style={S.tabla}>
              <thead>
                <tr style={S.thead}>
                  {['N° Nota','Fecha','Cédula','Cliente','Prendas','Total','Abonado','Saldo','Estado'].map(h=>(
                    <th key={h} style={S.th}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {resultados.map((n,i)=>(
                  <tr key={n.numnotaent}
                    onClick={()=>setSeleccion(n.numnotaent)}
                    onDoubleClick={()=>elegir(n)}
                    style={{
                      background: seleccion===n.numnotaent ? '#dbeafe' : i%2===0?'#fff':'#f5f7fc',
                      cursor:'pointer',
                      outline: seleccion===n.numnotaent ? '2px solid #2980b9' : 'none',
                    }}>
                    <td style={{...S.td,fontWeight:700,color:'#1a3a6b'}}>{n.numnotaent}</td>
                    <td style={S.td}>{n.fechanotae}</td>
                    <td style={S.td}>{n.cedrifclie}</td>
                    <td style={S.td}>{n.nombreclie}</td>
                    <td style={{...S.td,textAlign:'center'}}>{n.cantotal||0}</td>
                    <td style={{...S.td,textAlign:'right'}}>${fmt(n.valtotal)}</td>
                    <td style={{...S.td,textAlign:'right',color:'#2e7d32'}}>${fmt(n.valabono)}</td>
                    <td style={{...S.td,textAlign:'right',color:(n.saldo||0)>0?'#c62828':'#2e7d32',fontWeight:700}}>${fmt(n.saldo)}</td>
                    <td style={{...S.td,textAlign:'center'}}>
                      {n.anulada==='S'
                        ? <span style={{color:'#c62828',fontWeight:700,fontSize:11}}>ANULADA</span>
                        : <span style={{color:'#2e7d32',fontSize:11}}>Activa</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* BOTONES */}
        <div style={S.botones}>
          <span style={{fontSize:12,color:'#888'}}>
            {resultados.length>0 ? `${resultados.length} nota(s) encontrada(s). Doble clic o botón Abrir para cargar.` : ''}
          </span>
          <div style={{display:'flex',gap:8}}>
            <button onClick={onClose} style={S.btnCancelar}>Cancelar</button>
            <button onClick={()=>seleccion&&elegir({numnotaent:seleccion})}
              disabled={!seleccion} style={{...S.btnAbrir,opacity:seleccion?1:0.4}}>
              📋 Abrir nota
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

const S = {
  fondo:    {position:'fixed',inset:0,background:'rgba(0,0,0,0.55)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:300},
  modal:    {background:'#fff',borderRadius:10,padding:20,width:860,maxHeight:'90vh',display:'flex',flexDirection:'column',gap:12,boxShadow:'0 12px 40px rgba(0,0,0,0.3)'},
  titulo:   {display:'flex',justifyContent:'space-between',alignItems:'center',fontSize:16,fontWeight:900,color:'#1a3a6b'},
  btnX:     {background:'#e74c3c',color:'#fff',border:'none',borderRadius:5,padding:'3px 10px',cursor:'pointer',fontWeight:900,fontSize:15},
  filtros:  {background:'#f0f4ff',border:'1px solid #c8d5ea',borderRadius:6,padding:12,display:'flex',flexDirection:'column',gap:8},
  filaF:    {display:'flex',gap:12,alignItems:'flex-end',flexWrap:'wrap'},
  lbl:      {display:'flex',flexDirection:'column',gap:3,fontSize:11,fontWeight:700,color:'#1a3a6b',flex:1,minWidth:160},
  inp:      {height:28,border:'1px solid #c8d5ea',borderRadius:4,padding:'0 8px',fontSize:12,outline:'none',marginTop:2},
  btnBuscar:{background:'#1a3a6b',color:'#fff',border:'none',borderRadius:5,padding:'0 20px',cursor:'pointer',fontWeight:700,fontSize:13,height:34,alignSelf:'flex-end',whiteSpace:'nowrap'},
  tablaWrap:{overflowY:'auto',flex:1,border:'1px solid #e0e7f0',borderRadius:6,maxHeight:380},
  tabla:    {width:'100%',borderCollapse:'collapse',fontSize:12},
  thead:    {background:'#1a3a6b',position:'sticky',top:0},
  th:       {padding:'7px 8px',color:'#fff',fontWeight:700,textAlign:'left',fontSize:11,whiteSpace:'nowrap'},
  td:       {padding:'6px 8px',borderBottom:'1px solid #eee',fontSize:12},
  botones:  {display:'flex',justifyContent:'space-between',alignItems:'center',paddingTop:4},
  btnCancelar:{background:'#888',color:'#fff',border:'none',borderRadius:5,padding:'7px 18px',cursor:'pointer',fontWeight:700},
  btnAbrir:  {background:'#1a3a6b',color:'#fff',border:'none',borderRadius:5,padding:'7px 18px',cursor:'pointer',fontWeight:700},
}
