// src/components/ModalPin.jsx
// Modal genérico para validar PIN de administrador

import { useState, useEffect, useRef } from 'react'

export default function ModalPin({ supabase, titulo, descripcion, onConfirm, onClose }) {
  const [pin,     setPin]     = useState('')
  const [error,   setError]   = useState(null)
  const [cargando,setCargando] = useState(false)
  const inputRef = useRef()

  useEffect(() => { setTimeout(() => inputRef.current?.focus(), 100) }, [])

  async function validar() {
    if (!pin.trim()) { setError('Ingresa el PIN.'); return }
    setCargando(true)
    const { data } = await supabase
      .from('usuarios')
      .select('id')
      .eq('usuario', 'PIN')
      .eq('password_hash', pin.trim())
      .limit(1)
    setCargando(false)
    if (data && data.length > 0) {
      onConfirm()
    } else {
      setError('PIN incorrecto.')
      setPin('')
      setTimeout(() => inputRef.current?.focus(), 50)
    }
  }

  return (
    <div style={S.fondo}>
      <div style={S.modal}>
        <div style={S.cabecera}>
          <span>🔐 {titulo || 'Autorización requerida'}</span>
          <button onClick={onClose} style={S.btnX}>✕</button>
        </div>
        {descripcion && (
          <p style={{fontSize:13,color:'#555',margin:'0 0 14px',lineHeight:1.5}}>{descripcion}</p>
        )}
        <label style={S.lbl}>PIN de Administrador
          <input
            ref={inputRef}
            type="password"
            style={S.inp}
            value={pin}
            onChange={e=>{setPin(e.target.value);setError(null)}}
            onKeyDown={e=>e.key==='Enter'&&validar()}
            placeholder="••••"
            maxLength={20}
          />
        </label>
        {error && <div style={S.error}>{error}</div>}
        <div style={{display:'flex',gap:8,justifyContent:'flex-end',marginTop:14}}>
          <button onClick={onClose} style={S.btnCancelar}>Cancelar</button>
          <button onClick={validar} disabled={cargando} style={S.btnConfirmar}>
            {cargando ? 'Verificando…' : '✅ Confirmar'}
          </button>
        </div>
      </div>
    </div>
  )
}

const S = {
  fondo:      { position:'fixed',inset:0,background:'rgba(0,0,0,0.6)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:500 },
  modal:      { background:'#fff',borderRadius:10,padding:24,width:320,boxShadow:'0 8px 32px rgba(0,0,0,0.35)' },
  cabecera:   { display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:14,fontSize:15,fontWeight:800,color:'#1a3a6b' },
  btnX:       { background:'#e74c3c',color:'#fff',border:'none',borderRadius:4,padding:'2px 8px',cursor:'pointer',fontWeight:700,fontSize:17 },
  lbl:        { display:'flex',flexDirection:'column',gap:4,fontSize:12,fontWeight:700,color:'#1a3a6b' },
  inp:        { height:36,border:'2px solid #c8d5ea',borderRadius:6,padding:'0 12px',fontSize:18,letterSpacing:4,outline:'none',marginTop:2,textAlign:'center' },
  error:      { color:'#c62828',fontSize:12,fontWeight:700,marginTop:8,textAlign:'center' },
  btnCancelar:{ background:'#eee',border:'1px solid #ccc',borderRadius:6,padding:'7px 16px',cursor:'pointer',fontWeight:700,fontSize:13 },
  btnConfirmar:{ background:'#1a3a6b',color:'#fff',border:'none',borderRadius:6,padding:'7px 20px',cursor:'pointer',fontWeight:700,fontSize:13 },
}
