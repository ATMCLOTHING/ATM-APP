// src/components/ModalBuscarNota.jsx
import { useState } from 'react'

const fmt  = n => Number(n||0).toLocaleString('es-CO',{minimumFractionDigits:0,maximumFractionDigits:0})
const fmtM = n => '$' + fmt(n)
const hoy  = () => { const d=new Date(); return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0') }
const unMesAtras = () => { const d=new Date(); d.setMonth(d.getMonth()-1); return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0') }

export default function ModalBuscarNota({ supabase, onSelect, onClose }) {
  const [nroNota,   setNroNota]   = useState('')
  const [cedula,    setCedula]    = useState('')
  const [nombre,    setNombre]    = useState('')
  const [desde,     setDesde]     = useState(unMesAtras())
  const [hasta,     setHasta]     = useState(hoy())
  const [usarFecha, setUsarFecha] = useState(true)
  const [filtEstado,setFiltEstado]= useState('todas')  // todas|pendiente|pagada
  const [resultados,setResultados]= useState([])
  const [buscando,  setBuscando]  = useState(false)
  const [buscado,   setBuscado]   = useState(false)
  const [seleccion, setSeleccion] = useState(null)

  async function buscar() {
    setBuscando(true); setBuscado(false); setResultados([]); setSeleccion(null)

    let q = supabase.from('encnotaen')
      .select('numnotaent,fechanotae,fechavence,cedrifclie,nombreclie,valtotal,valabono,saldo,anulada,cantotal,cedvended')
      .order('numnotaent', {ascending:false})
      .limit(200)

    // filtros
    let buscaPorNumero = false
    if (nroNota.trim()) {
      const n = Number(nroNota.trim().replace(/\D/g,''))
      if (!isNaN(n)) { q = q.eq('numnotaent', n); buscaPorNumero = true }
    }
    if (cedula.trim())   q = q.ilike('cedrifclie',  `%${cedula.trim()}%`)
    if (nombre.trim())   q = q.ilike('nombreclie',  `%${nombre.trim()}%`)
    // si se busca un número de nota puntual, el rango de fechas no aplica (podría ser una nota antigua)
    if (usarFecha && !buscaPorNumero) q = q.gte('fechanotae', desde).lte('fechanotae', hasta)

    // filtro estado — NO filtrar anuladas como si fueran pagadas
    if (filtEstado === 'pendiente') q = q.gt('saldo', 0).neq('anulada','S')
    else if (filtEstado === 'pagada') q = q.lte('saldo', 0).neq('anulada','S')
    else if (filtEstado === 'anuladas') q = q.eq('anulada','S')
    // 'todas' → sin filtro adicional

    const {data, error} = await q
    if (error) console.error('Error buscando notas:', error)
    setResultados(data||[])
    setBuscado(true); setBuscando(false)
  }

  function elegir(nota) {
    onSelect(nota.numnotaent)
  }

  const colorSaldo = n => {
    if (n.anulada === 'S') return '#888'
    if ((n.saldo||0) <= 0) return '#2e7d32'
    return '#c62828'
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
            <Lbl text="N° Nota">
              <input style={S.inp} value={nroNota} autoFocus
                onChange={e=>setNroNota(e.target.value)}
                onKeyDown={e=>e.key==='Enter'&&buscar()}
                placeholder="Ej: 3002336"/>
            </Lbl>
            <Lbl text="Cédula cliente">
              <input style={S.inp} value={cedula}
                onChange={e=>setCedula(e.target.value)}
                onKeyDown={e=>e.key==='Enter'&&buscar()}
                placeholder="Cédula o NIT"/>
            </Lbl>
            <Lbl text="Nombre cliente">
              <input style={S.inp} value={nombre}
                onChange={e=>setNombre(e.target.value)}
                onKeyDown={e=>e.key==='Enter'&&buscar()}
                placeholder="Nombre o parte del nombre"/>
            </Lbl>
            <Lbl text="Estado">
              <select style={S.inp} value={filtEstado} onChange={e=>setFiltEstado(e.target.value)}>
                <option value="todas">Todas</option>
                <option value="pendiente">Con saldo pendiente</option>
                <option value="pagada">Pagadas</option>
                <option value="anuladas">Anuladas</option>
              </select>
            </Lbl>
          </div>

          <div style={S.filaF}>
            <label style={{display:'flex',alignItems:'center',gap:6,fontSize:12,fontWeight:600,color:'#555',cursor:'pointer'}}>
              <input type="checkbox" checked={usarFecha} onChange={e=>setUsarFecha(e.target.checked)}/>
              Filtrar por fecha
            </label>
            {usarFecha && <>
              <Lbl text="Desde">
                <input type="date" style={S.inp} value={desde} onChange={e=>setDesde(e.target.value)}/>
              </Lbl>
              <Lbl text="Hasta">
                <input type="date" style={S.inp} value={hasta} onChange={e=>setHasta(e.target.value)}/>
              </Lbl>
            </>}
            <button onClick={buscar} disabled={buscando} style={S.btnBuscar}>
              {buscando ? '⏳ Buscando…' : '🔍 Buscar'}
            </button>
          </div>
        </div>

        {/* RESULTADOS */}
        <div style={S.listaWrap}>
          {!buscado && (
            <div style={S.hint}>Ingresa criterios de búsqueda y presiona <strong>Buscar</strong> o <strong>Enter</strong></div>
          )}
          {buscado && resultados.length === 0 && (
            <div style={S.hint}>No se encontraron notas con esos criterios.</div>
          )}
          {resultados.length > 0 && (
            <>
              <div style={S.countBar}>
                {resultados.length} nota(s) encontrada(s)
                {resultados.length === 200 && <span style={{color:'#e65100'}}> — mostrando las 200 más recientes, refina la búsqueda</span>}
              </div>
              <table style={S.tabla}>
                <thead>
                  <tr style={S.thead}>
                    <th style={S.th}>N° Nota</th>
                    <th style={S.th}>Fecha</th>
                    <th style={S.th}>Vence</th>
                    <th style={{...S.th,textAlign:'left'}}>Cliente</th>
                    <th style={S.th}>Prendas</th>
                    <th style={S.th}>$ Total</th>
                    <th style={S.th}>$ Abonado</th>
                    <th style={S.th}>$ Saldo</th>
                    <th style={S.th}>Estado</th>
                  </tr>
                </thead>
                <tbody>
                  {resultados.map((n,i) => {
                    const sel = seleccion?.numnotaent === n.numnotaent
                    return (
                      <tr key={n.numnotaent}
                        style={{background:sel?'#e3f2fd':i%2===0?'#fff':'#f8faff', cursor:'pointer'}}
                        onClick={()=>setSeleccion(n)}
                        onDoubleClick={()=>elegir(n)}>
                        <td style={{...S.td,fontWeight:700,color:'#1a3a6b',textAlign:'center'}}>{n.numnotaent}</td>
                        <td style={{...S.td,textAlign:'center'}}>{n.fechanotae?.slice(0,10)||''}</td>
                        <td style={{...S.td,textAlign:'center'}}>{n.fechavence?.slice(0,10)||''}</td>
                        <td style={{...S.td,maxWidth:220,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{n.nombreclie}</td>
                        <td style={{...S.td,textAlign:'center'}}>{n.cantotal||0}</td>
                        <td style={{...S.td,textAlign:'right'}}>{fmtM(n.valtotal)}</td>
                        <td style={{...S.td,textAlign:'right',color:'#2e7d32'}}>{fmtM(n.valabono)}</td>
                        <td style={{...S.td,textAlign:'right',fontWeight:700,color:colorSaldo(n)}}>{fmtM(n.saldo)}</td>
                        <td style={{...S.td,textAlign:'center'}}>
                          {n.anulada==='S'
                            ? <span style={{background:'#fdecea',color:'#c62828',padding:'2px 8px',borderRadius:8,fontSize:11,fontWeight:700}}>ANULADA</span>
                            : (n.saldo||0)<=0
                              ? <span style={{background:'#e8f5e9',color:'#2e7d32',padding:'2px 8px',borderRadius:8,fontSize:11,fontWeight:700}}>PAGADA</span>
                              : <span style={{background:'#fff3e0',color:'#e65100',padding:'2px 8px',borderRadius:8,fontSize:11,fontWeight:700}}>PENDIENTE</span>
                          }
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </>
          )}
        </div>

        {/* PIE */}
        <div style={S.pie}>
          {seleccion && (
            <span style={{fontSize:12,color:'#555'}}>
              Seleccionada: <strong>Nota #{seleccion.numnotaent}</strong> — {seleccion.nombreclie} — {fmtM(seleccion.saldo)} saldo
            </span>
          )}
          <div style={{marginLeft:'auto',display:'flex',gap:8}}>
            <button onClick={onClose} style={S.btnCx}>Cancelar</button>
            <button onClick={()=>seleccion&&elegir(seleccion)}
              disabled={!seleccion} style={S.btnOk}>
              ✅ Abrir nota
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

function Lbl({text,children}){
  return(
    <div style={{display:'flex',flexDirection:'column',gap:3}}>
      <span style={{fontSize:11,fontWeight:700,color:'#5577aa',textTransform:'uppercase'}}>{text}</span>
      {children}
    </div>
  )
}

const S = {
  fondo:    {position:'fixed',inset:0,background:'rgba(0,0,0,0.55)',zIndex:2000,display:'flex',alignItems:'center',justifyContent:'center'},
  modal:    {background:'#fff',borderRadius:10,width:'92vw',maxWidth:1100,maxHeight:'88vh',display:'flex',flexDirection:'column',boxShadow:'0 8px 40px rgba(0,0,0,0.25)',fontFamily:'Arial,sans-serif'},
  titulo:   {background:'#1a3a6b',color:'#fff',padding:'12px 18px',display:'flex',justifyContent:'space-between',alignItems:'center',fontSize:15,fontWeight:'bold',borderRadius:'10px 10px 0 0'},
  btnX:     {background:'none',border:'none',color:'#fff',fontSize:20,cursor:'pointer'},
  filtros:  {padding:'14px 16px',borderBottom:'1px solid #eee',display:'flex',flexDirection:'column',gap:10},
  filaF:    {display:'flex',gap:12,alignItems:'flex-end',flexWrap:'wrap'},
  inp:      {height:30,border:'1px solid #c8d5ea',borderRadius:5,padding:'0 8px',fontSize:13,color:'#1a3a6b',outline:'none',width:160},
  btnBuscar:{height:30,background:'#1a3a6b',color:'#fff',border:'none',borderRadius:5,padding:'0 20px',cursor:'pointer',fontSize:13,fontWeight:700},
  listaWrap:{flex:1,overflowY:'auto'},
  hint:     {textAlign:'center',padding:40,color:'#aaa',fontSize:13},
  countBar: {padding:'6px 14px',background:'#f5f7ff',fontSize:12,color:'#555',borderBottom:'1px solid #eee'},
  tabla:    {width:'100%',borderCollapse:'collapse',fontSize:13},
  thead:    {background:'#1a3a6b',position:'sticky',top:0,zIndex:1},
  th:       {padding:'8px 10px',color:'#fff',fontWeight:700,textAlign:'center',whiteSpace:'nowrap',fontSize:12},
  td:       {padding:'6px 10px',borderBottom:'1px solid #f0f0f0',verticalAlign:'middle'},
  pie:      {padding:'10px 16px',borderTop:'1px solid #eee',display:'flex',alignItems:'center',gap:10},
  btnOk:    {background:'#1a3a6b',color:'#fff',border:'none',borderRadius:6,padding:'7px 20px',cursor:'pointer',fontSize:13,fontWeight:700},
  btnCx:    {background:'#eee',color:'#333',border:'none',borderRadius:6,padding:'7px 16px',cursor:'pointer',fontSize:13},
}
