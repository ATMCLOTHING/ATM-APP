// src/components/ModalAutorizarUsuario.jsx
// Modal para pedir usuario + contraseña de una persona AUTORIZADA para una acción puntual
// (a diferencia de ModalPin, que valida un PIN genérico compartido, este valida la
// identidad de un usuario real y su permiso específico — ej. revertir abonos).

import { useState, useEffect, useRef } from 'react'
import { tienePermiso } from '../lib/auth'

export default function ModalAutorizarUsuario({ supabase, titulo, descripcion, modulo, accion, onConfirm, onClose }) {
  const [usuario,   setUsuarioInput] = useState('')
  const [password,  setPassword]    = useState('')
  const [error,     setError]       = useState(null)
  const [cargando,  setCargando]    = useState(false)
  const inputRef = useRef()

  useEffect(() => { setTimeout(() => inputRef.current?.focus(), 100) }, [])

  async function validar() {
    if (!usuario.trim() || !password.trim()) { setError('Ingresa usuario y contraseña.'); return }
    setCargando(true)
    const { data } = await supabase.from('usuarios')
      .select('*').eq('usuario', usuario.trim().toLowerCase()).eq('activo', true).limit(1)
    const u = data?.[0]
    if (!u || u.password_hash !== password) {
      setError('Usuario o contraseña incorrectos.')
      setPassword(''); setCargando(false)
      setTimeout(() => inputRef.current?.focus(), 50)
      return
    }
    let autorizado = u.rol === 'admin'
    if (!autorizado) {
      const { data: perms } = await supabase.from('usuario_permisos').select('*').eq('usuario_id', u.id)
      autorizado = tienePermiso({ ...u, permisos: perms || [] }, modulo, accion)
    }
    setCargando(false)
    if (!autorizado) {
      setError(`${u.nombre} no está autorizado para esta acción.`)
      setPassword('')
      setTimeout(() => inputRef.current?.focus(), 50)
      return
    }
    onConfirm(u)
  }

  return (
    <div style={S.fondo}>
      <div style={S.modal}>
        <div style={S.cabecera}>
          <span><span style={{fontSize:20}}>🔐</span> {titulo || 'Autorización requerida'}</span>
          <button onClick={onClose} style={S.btnX}>✕</button>
        </div>
        {descripcion && (
          <p style={{fontSize:13,color:'#555',margin:'0 0 14px',lineHeight:1.5}}>{descripcion}</p>
        )}
        <label style={S.lbl}>Usuario autorizado
          <input
            ref={inputRef}
            style={S.inp}
            value={usuario}
            onChange={e=>{setUsuarioInput(e.target.value);setError(null)}}
            onKeyDown={e=>e.key==='Enter'&&validar()}
            placeholder="usuario"
            autoCapitalize="off"
          />
        </label>
        <label style={{...S.lbl,marginTop:10}}>Contraseña
          <input
            type="password"
            style={S.inp}
            value={password}
            onChange={e=>{setPassword(e.target.value);setError(null)}}
            onKeyDown={e=>e.key==='Enter'&&validar()}
            placeholder="••••"
          />
        </label>
        {error && <div style={S.error}>{error}</div>}
        <div style={{display:'flex',gap:8,justifyContent:'flex-end',marginTop:14}}>
          <button onClick={onClose} style={S.btnCancelar}>Cancelar</button>
          <button onClick={validar} disabled={cargando} style={S.btnConfirmar}>
            {cargando ? 'Verificando…' : <><span style={{fontSize:17}}>✅</span> Confirmar</>}
          </button>
        </div>
      </div>
    </div>
  )
}

const S = {
  fondo:      { position:'fixed',inset:0,background:'rgba(0,0,0,0.6)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:500 },
  modal:      { background:'#fff',borderRadius:10,padding:24,width:340,boxShadow:'0 8px 32px rgba(0,0,0,0.35)' },
  cabecera:   { display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:14,fontSize:15,fontWeight:800,color:'#1a3a6b' },
  btnX:       { background:'#e74c3c',color:'#fff',border:'none',borderRadius:4,padding:'2px 8px',cursor:'pointer',fontWeight:700,fontSize:17 },
  lbl:        { display:'flex',flexDirection:'column',gap:4,fontSize:12,fontWeight:700,color:'#1a3a6b' },
  inp:        { height:32,border:'2px solid #c8d5ea',borderRadius:6,padding:'0 10px',fontSize:14,outline:'none',marginTop:2 },
  error:      { color:'#c62828',fontSize:12,fontWeight:700,marginTop:8,textAlign:'center' },
  btnCancelar:{ background:'#eee',border:'1px solid #ccc',borderRadius:6,padding:'7px 16px',cursor:'pointer',fontWeight:700,fontSize:13 },
  btnConfirmar:{ background:'#1a3a6b',color:'#fff',border:'none',borderRadius:6,padding:'7px 20px',cursor:'pointer',fontWeight:700,fontSize:13 },
}
