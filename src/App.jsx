import { useState } from 'react'
import { supabase } from './lib/supabase'
import { LOGO } from './lib/assets'
import NotaDeEntrega from './components/NotaDeEntrega'
import Articulos     from './components/Articulos'
import Proveedores   from './components/Proveedores'
import CierreCaja    from './components/CierreCaja'

export default function App() {
  const [modulo, setModulo] = useState(null)

  if (modulo === 'nota')       return <NotaDeEntrega supabase={supabase} onClose={()=>setModulo(null)}/>
  if (modulo === 'articulos')  return <Articulos     supabase={supabase} onClose={()=>setModulo(null)}/>
  if (modulo === 'proveedores')return <Proveedores   supabase={supabase} onClose={()=>setModulo(null)}/>
  if (modulo === 'cierre')      return <CierreCaja    supabase={supabase} onClose={()=>setModulo(null)}/>

  return (
    <div style={s.pagina}>
      <div style={s.tarjeta}>
        <div style={s.header}>
          <img src={LOGO} alt="ATM" style={s.logo} />
          <div>
            <div style={s.empresa}>A TU MEDIDA</div>
            <div style={s.slogan}>CONTROL DE INVENTARIOS</div>
          </div>
        </div>
        <div style={s.divisor} />
        <div style={s.grid}>
          <Btn icon="📋" label="Nota de Entrega" color="#1a3a6b" onClick={()=>setModulo('nota')}/>
          <Btn icon="📦" label="Artículos"        color="#e65100" onClick={()=>setModulo('articulos')}/>
          <Btn icon="🏭" label="Proveedores"      color="#00838f" onClick={()=>setModulo('proveedores')}/>
          <Btn icon="👥" label="Clientes"         color="#2e7d32" disabled/>
          <Btn icon="💰" label="Cierre de Caja"   color="#6a1b9a" onClick={()=>setModulo('cierre')}/>
          <Btn icon="📊" label="Inventario"       color="#c62828" disabled/>
        </div>
        <div style={s.pie}>© 2026 ATM Clothing — Todos los derechos reservados</div>
      </div>
    </div>
  )
}

function Btn({ icon, label, color, onClick, disabled }) {
  return (
    <button onClick={onClick} disabled={disabled} style={{
      background: disabled ? '#f5f5f5' : '#fff',
      border: `2px solid ${disabled ? '#e0e0e0' : color}`,
      borderRadius: 16, padding: '22px 12px',
      display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10,
      cursor: disabled ? 'not-allowed' : 'pointer',
      opacity: disabled ? 0.4 : 1,
      boxShadow: disabled ? 'none' : `0 4px 16px ${color}33`,
    }}>
      <span style={{ fontSize: 34 }}>{icon}</span>
      <span style={{ fontSize: 12, fontWeight: 800, color: disabled ? '#bbb' : color, textAlign: 'center' }}>{label}</span>
      {disabled && <span style={{ fontSize: 9, color: '#ccc' }}>Próximamente</span>}
    </button>
  )
}

const s = {
  pagina:  { minHeight: '100vh', background: 'linear-gradient(135deg,#1a3a6b,#2c5fa8)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 },
  tarjeta: { background: '#fff', borderRadius: 24, padding: '36px 40px', width: '100%', maxWidth: 520, boxShadow: '0 20px 60px rgba(0,0,0,0.3)' },
  header:  { display: 'flex', alignItems: 'center', gap: 16, marginBottom: 24 },
  logo:    { height: 70, objectFit: 'contain' },
  empresa: { fontSize: 26, fontWeight: 900, color: '#1a3a6b', letterSpacing: 2 },
  slogan:  { fontSize: 11, color: '#7a99cc', letterSpacing: 2, textTransform: 'uppercase', marginTop: 2 },
  divisor: { height: 2, background: 'linear-gradient(90deg,#1a3a6b,#2c5fa8,transparent)', borderRadius: 2, marginBottom: 24 },
  grid:    { display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 12, marginBottom: 24 },
  pie:     { textAlign: 'center', fontSize: 10, color: '#aab8d4' },
}
