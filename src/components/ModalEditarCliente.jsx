// src/components/ModalEditarCliente.jsx
// Permite editar los datos del cliente y actualiza la tabla clientes

import { useState } from 'react'

export default function ModalEditarCliente({ supabase, cliente, onGuardar, onClose }) {
  const [form, setForm] = useState({
    nombre: cliente?.nombre || '',
    direccion: cliente?.direccion || '',
    celular:    cliente?.celular    || '',
    ciudad:     cliente?.ciudad     || '',
    departamento: cliente?.departamento || '',
    nom_empresa: cliente?.nom_empresa || '',
  })
  const [guardando, setGuardando] = useState(false)
  const [msg,       setMsg]       = useState(null)

  function upd(campo, val) { setForm(prev=>({...prev,[campo]:val})) }

  async function guardar() {
    if (!form.nombre.trim()) { setMsg('El nombre es obligatorio.'); return }
    setGuardando(true)
    const {error} = await supabase.from('clientes')
      .update(form)
      .eq('id', cliente.id)
    if (error) {
      setMsg(`Error: ${error.message}`)
    } else {
      onGuardar({...cliente, ...form})
    }
    setGuardando(false)
  }

  return (
    <div style={S.fondo}>
      <div style={S.modal}>
        <div style={S.titulo}>
          <span>✎ EDITAR CLIENTE — {cliente?.cedula||cliente?.id}</span>
          <button onClick={onClose} style={S.btnX}>✕</button>
        </div>

        {msg && <div style={S.err}>{msg}</div>}

        <div style={S.grid}>
          <Campo label="Nombre / Razón Social" span={2}>
            <input style={S.inp} value={form.nombre} onChange={e=>upd('nombre',e.target.value)} />
          </Campo>
          <Campo label="Empresa">
            <input style={S.inp} value={form.nomempresa} onChange={e=>upd('nom_empresa',e.target.value)} />
          </Campo>
          <Campo label="Dirección" span={2}>
            <input style={S.inp} value={form.direcicion} onChange={e=>upd('direccion',e.target.value)} />
          </Campo>
          <Campo label="Celular">
            <input style={S.inp} value={form.celular} onChange={e=>upd('celular',e.target.value)} />
          </Campo>
          <Campo label="Ciudad">
            <input style={S.inp} value={form.ciudad} onChange={e=>upd('ciudad',e.target.value)} />
          </Campo>
          <Campo label="Departamento">
            <input style={S.inp} value={form.departamen} onChange={e=>upd('departamento',e.target.value)} />
          </Campo>
        </div>

        <div style={{display:'flex',justifyContent:'flex-end',gap:8,marginTop:16}}>
          <button onClick={onClose} style={S.btnCancel}>Cancelar</button>
          <button onClick={guardar} disabled={guardando} style={S.btnGuardar}>
            {guardando ? '⏳ Guardando…' : '💾 Guardar cambios'}
          </button>
        </div>
      </div>
    </div>
  )
}

function Campo({label,children,span}) {
  return (
    <div style={{display:'flex',flexDirection:'column',gap:3,gridColumn:span?`span ${span}`:undefined}}>
      <span style={{fontSize:11,fontWeight:700,color:'#5577aa',textTransform:'uppercase',letterSpacing:0.5}}>{label}</span>
      {children}
    </div>
  )
}

const S = {
  fondo:     {position:'fixed',inset:0,background:'rgba(0,0,0,0.55)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:300},
  modal:     {background:'#fff',borderRadius:10,padding:24,width:560,boxShadow:'0 12px 40px rgba(0,0,0,0.3)'},
  titulo:    {display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:16,fontSize:14,fontWeight:900,color:'#1a3a6b'},
  btnX:      {background:'#e74c3c',color:'#fff',border:'none',borderRadius:5,padding:'3px 10px',cursor:'pointer',fontWeight:900,fontSize:15},
  err:       {background:'#ffebee',color:'#c62828',border:'1px solid #ef9a9a',borderRadius:5,padding:'6px 12px',marginBottom:12,fontSize:12},
  grid:      {display:'grid',gridTemplateColumns:'1fr 1fr',gap:12},
  inp:       {height:32,border:'1px solid #c8d5ea',borderRadius:5,padding:'0 10px',fontSize:13,outline:'none',color:'#1a3a6b'},
  btnCancel: {background:'#888',color:'#fff',border:'none',borderRadius:6,padding:'8px 18px',cursor:'pointer',fontWeight:700,fontSize:13},
  btnGuardar:{background:'#1a3a6b',color:'#fff',border:'none',borderRadius:6,padding:'8px 20px',cursor:'pointer',fontWeight:700,fontSize:13},
}
