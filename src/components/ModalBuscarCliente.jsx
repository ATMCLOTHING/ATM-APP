// src/components/ModalBuscarCliente.jsx
// Ventana de búsqueda de clientes — se abre cuando cédula está vacía

import { useState } from 'react'

export default function ModalBuscarCliente({ supabase, onSelect, onClose }) {
  const [busqueda,  setBusqueda]  = useState('')
  const [resultados,setResultados]= useState([])
  const [buscando,  setBuscando]  = useState(false)
  const [buscado,   setBuscado]   = useState(false)

  async function buscar() {
    if (!busqueda.trim()) return
    setBuscando(true)
    const esNum = /^\d+$/.test(busqueda.trim())
    const q = supabase.from('clientes')
      .select('id,cedula,nombre,celular,ciudad,direccion,nom_empresa,departamento')
    const {data} = await (esNum
      ? q.ilike('cedula', `%${busqueda}%`)
      : q.ilike('nombre', `%${busqueda}%`)
    ).limit(20)
    setResultados(data||[])
    setBuscado(true)
    setBuscando(false)
  }

  return (
    <div style={S.fondo}>
      <div style={S.modal}>
        <div style={S.titulo}>
          <span><span style={{fontSize:21}}>🔍</span> BUSCAR CLIENTE</span>
          <button onClick={onClose} style={S.btnX}>✕</button>
        </div>

        <div style={S.buscaFila}>
          <input
            autoFocus
            style={S.inp}
            value={busqueda}
            onChange={e=>setBusqueda(e.target.value)}
            onKeyDown={e=>e.key==='Enter'&&buscar()}
            placeholder="Nombre, cédula o NIT…"
          />
          <button onClick={buscar} disabled={buscando} style={S.btnBuscar}>
            {buscando ? <span style={{fontSize:17}}>⏳</span> : <><span style={{fontSize:17}}>🔍</span> Buscar</>}
          </button>
        </div>

        {buscado && resultados.length === 0 && (
          <p style={S.sinRes}>No se encontraron clientes con ese criterio.</p>
        )}

        {resultados.length > 0 && (
          <div style={S.listaWrap}>
            <table style={S.tabla}>
              <thead>
                <tr style={S.thead}>
                  <th style={S.th}>Cédula / NIT</th>
                  <th style={S.th}>Nombre</th>
                  <th style={S.th}>Ciudad</th>
                  <th style={S.th}>Celular</th>
                  <th style={S.th}></th>
                </tr>
              </thead>
              <tbody>
                {resultados.map((c,i) => (
                  <tr key={c.id}
                    style={{background:i%2===0?'#fff':'#f5f7fc',cursor:'pointer'}}
                    onClick={()=>onSelect(c)}>
                    <td style={S.td}><strong>{c.cedula}</strong></td>
                    <td style={S.td}>{c.nombre}</td>
                    <td style={S.td}>{c.ciudad}</td>
                    <td style={S.td}>{c.celular}</td>
                    <td style={{...S.td,textAlign:'center'}}>
                      <button onClick={e=>{e.stopPropagation();onSelect(c)}} style={S.btnSel}>
                        Seleccionar
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div style={{textAlign:'right',marginTop:12}}>
          <button onClick={onClose} style={S.btnCerrar}>Cancelar</button>
        </div>
      </div>
    </div>
  )
}

const S = {
  fondo:    {position:'fixed',inset:0,background:'rgba(0,0,0,0.55)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:300},
  modal:    {background:'#fff',borderRadius:10,padding:24,width:680,maxHeight:'85vh',display:'flex',flexDirection:'column',boxShadow:'0 12px 40px rgba(0,0,0,0.3)'},
  titulo:   {display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:16,fontSize:16,fontWeight:900,color:'#1a3a6b'},
  btnX:     {background:'#e74c3c',color:'#fff',border:'none',borderRadius:5,padding:'3px 10px',cursor:'pointer',fontWeight:900,fontSize:20},
  buscaFila:{display:'flex',gap:8,marginBottom:14},
  inp:      {flex:1,height:36,border:'2px solid #c8d5ea',borderRadius:6,padding:'0 12px',fontSize:14,outline:'none',color:'#1a3a6b'},
  btnBuscar:{background:'#1a3a6b',color:'#fff',border:'none',borderRadius:6,padding:'0 20px',cursor:'pointer',fontWeight:700,fontSize:13,height:36},
  sinRes:   {textAlign:'center',color:'#888',padding:20,fontSize:13},
  listaWrap:{overflowY:'auto',flex:1,border:'1px solid #e0e7f0',borderRadius:6},
  tabla:    {width:'100%',borderCollapse:'collapse',fontSize:13},
  thead:    {background:'#1a3a6b',position:'sticky',top:0},
  th:       {padding:'8px 12px',color:'#fff',fontWeight:700,textAlign:'left',fontSize:12},
  td:       {padding:'8px 12px',borderBottom:'1px solid #eee',fontSize:13},
  btnSel:   {background:'#2980b9',color:'#fff',border:'none',borderRadius:4,padding:'4px 10px',cursor:'pointer',fontWeight:700,fontSize:11},
  btnCerrar:{background:'#888',color:'#fff',border:'none',borderRadius:6,padding:'7px 20px',cursor:'pointer',fontWeight:700,fontSize:13},
}
