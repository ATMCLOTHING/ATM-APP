// src/components/Login.jsx
import { useState } from 'react'
import { LOGO } from '../lib/assets'
import { setUsuario } from '../lib/auth'

export default function Login({ supabase, onLogin }) {
  const [usuario,  setUsuarioInput] = useState('')
  const [password, setPassword]     = useState('')
  const [error,    setError]        = useState('')
  const [cargando, setCargando]     = useState(false)
  const [cambPass, setCambPass]     = useState(false)
  const [nuevaPass,setNuevaPass]    = useState('')
  const [nuevaPass2,setNuevaPass2]  = useState('')
  const [userTemp, setUserTemp]     = useState(null)

  async function ingresar() {
    if (!usuario.trim() || !password.trim()) { setError('Ingresa usuario y contraseña.'); return }
    setCargando(true); setError('')
    const {data, error:err} = await supabase.from('usuarios')
      .select('*').eq('usuario', usuario.trim().toLowerCase()).eq('activo', true).limit(1)
    if (err || !data?.length) { setError('Usuario no encontrado o inactivo.'); setCargando(false); return }
    const u = data[0]
    if (u.password_hash !== password) { setError('Contraseña incorrecta.'); setCargando(false); return }

    // cargar permisos
    const {data:perms} = await supabase.from('usuario_permisos')
      .select('*').eq('usuario_id', u.id)

    const userObj = {...u, password_hash:undefined, permisos: perms||[]}

    // registrar acceso en log
    await supabase.from('log_actividad').insert({
      usuario_id: u.id, usuario: u.usuario,
      accion: 'LOGIN', modulo: 'sistema',
      detalle: `Ingresó al sistema`
    })

    // actualizar último acceso
    await supabase.from('usuarios').update({ultimo_acceso: new Date().toISOString()}).eq('id', u.id)

    if (u.debe_cambiar_pass) {
      setUserTemp(userObj); setCambPass(true); setCargando(false); return
    }

    setUsuario(userObj)
    onLogin(userObj)
    setCargando(false)
  }

  async function cambiarPassword() {
    if (!nuevaPass || nuevaPass.length < 6) { setError('La contraseña debe tener al menos 6 caracteres.'); return }
    if (nuevaPass !== nuevaPass2) { setError('Las contraseñas no coinciden.'); return }
    setCargando(true)
    await supabase.from('usuarios').update({
      password_hash: nuevaPass, debe_cambiar_pass: false
    }).eq('id', userTemp.id)
    const userObj = {...userTemp, debe_cambiar_pass: false}
    setUsuario(userObj)
    onLogin(userObj)
    setCargando(false)
  }

  if (cambPass) return (
    <div style={S.pagina}>
      <div style={S.card}>
        <img src={LOGO} alt="ATM" style={S.logo}/>
        <h2 style={S.titulo}>Cambiar Contraseña</h2>
        <p style={{color:'#888',fontSize:12,marginBottom:16,textAlign:'center'}}>
          Debes cambiar tu contraseña antes de continuar
        </p>
        {error && <div style={S.error}>{error}</div>}
        <input type="password" style={S.inp} value={nuevaPass}
          onChange={e=>setNuevaPass(e.target.value)} placeholder="Nueva contraseña (mín. 6 caracteres)"/>
        <input type="password" style={S.inp} value={nuevaPass2}
          onChange={e=>setNuevaPass2(e.target.value)} placeholder="Confirmar contraseña"
          onKeyDown={e=>e.key==='Enter'&&cambiarPassword()}/>
        <button onClick={cambiarPassword} disabled={cargando} style={S.btnLogin}>
          {cargando ? 'Guardando…' : 'Guardar y entrar'}
        </button>
      </div>
    </div>
  )

  return (
    <div style={S.pagina}>
      <div style={S.card}>
        <img src={LOGO} alt="ATM" style={S.logo}/>
        <h1 style={S.empresa}>A TU MEDIDA</h1>
        <p style={S.slogan}>CONTROL DE INVENTARIOS</p>
        <div style={S.divisor}/>
        {error && <div style={S.error}>{error}</div>}
        <label style={S.lbl}>Usuario
          <input style={S.inp} value={usuario}
            onChange={e=>setUsuarioInput(e.target.value.toLowerCase())}
            onKeyDown={e=>e.key==='Enter'&&ingresar()}
            placeholder="Nombre de usuario" autoFocus/>
        </label>
        <label style={S.lbl}>Contraseña
          <input type="password" style={S.inp} value={password}
            onChange={e=>setPassword(e.target.value)}
            onKeyDown={e=>e.key==='Enter'&&ingresar()}
            placeholder="Contraseña"/>
        </label>
        <button onClick={ingresar} disabled={cargando} style={S.btnLogin}>
          {cargando ? '⏳ Verificando…' : 'Ingresar'}
        </button>
        <p style={{textAlign:'center',fontSize:11,color:'#aab8d4',marginTop:16}}>
          ATM Clothing Brand © 2026
        </p>
      </div>
    </div>
  )
}

const S = {
  pagina:  {minHeight:'100vh',background:'linear-gradient(135deg,#1a3a6b,#2c5fa8)',display:'flex',alignItems:'center',justifyContent:'center',padding:24},
  card:    {background:'#fff',borderRadius:20,padding:'40px 36px',width:'100%',maxWidth:380,boxShadow:'0 20px 60px rgba(0,0,0,0.3)',display:'flex',flexDirection:'column',gap:12},
  logo:    {height:80,objectFit:'contain',alignSelf:'center',marginBottom:4},
  empresa: {fontSize:24,fontWeight:900,color:'#1a3a6b',letterSpacing:2,textAlign:'center',margin:0},
  slogan:  {fontSize:10,color:'#7a99cc',letterSpacing:2,textAlign:'center',margin:0},
  divisor: {height:2,background:'linear-gradient(90deg,#1a3a6b,#2c5fa8,transparent)',borderRadius:2,margin:'4px 0'},
  titulo:  {fontSize:18,fontWeight:800,color:'#1a3a6b',textAlign:'center',margin:0},
  error:   {background:'#ffebee',color:'#c62828',border:'1px solid #ef9a9a',borderRadius:6,padding:'8px 12px',fontSize:12},
  lbl:     {display:'flex',flexDirection:'column',gap:4,fontSize:11,fontWeight:700,color:'#1a3a6b'},
  inp:     {height:36,border:'1px solid #c8d5ea',borderRadius:6,padding:'0 12px',fontSize:13,outline:'none',color:'#1a3a6b'},
  btnLogin:{background:'linear-gradient(90deg,#1a3a6b,#2c5fa8)',color:'#fff',border:'none',borderRadius:8,padding:'10px',cursor:'pointer',fontWeight:800,fontSize:14,marginTop:4},
}
