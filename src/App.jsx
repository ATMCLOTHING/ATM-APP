import { useState } from 'react'
import { supabase } from './lib/supabase'
import NotaDeEntrega from './components/NotaDeEntrega'

export default function App() {
  const [modulo, setModulo] = useState(null)

  if (modulo === 'nota') {
    return <NotaDeEntrega supabase={supabase} onClose={() => setModulo(null)} />
  }

  return (
    <div style={s.pagina}>
      <div style={s.tarjeta}>
        {/* LOGO */}
        <div style={s.logoWrap}>
          <div style={s.logoCirculo}>
            <span style={s.logoAtm}>ATM</span>
          </div>
          <div>
            <div style={s.empresa}>A TU MEDIDA</div>
            <div style={s.slogan}>CONTROL DE INVENTARIOS</div>
          </div>
        </div>

        <div style={s.divisor} />

        {/* MENÚ */}
        <div style={s.grid}>
          <Boton icon="📋" label="Nota de Entrega" color="#1a3a6b" onClick={() => setModulo('nota')} />
          <Boton icon="👥" label="Clientes"        color="#2e7d32" onClick={() => {}} disabled />
          <Boton icon="📦" label="Artículos"       color="#e65100" onClick={() => {}} disabled />
          <Boton icon="💰" label="Cartera"         color="#6a1b9a" onClick={() => {}} disabled />
          <Boton icon="🛒" label="Compras"         color="#00838f" onClick={() => {}} disabled />
          <Boton icon="📊" label="Inventario"      color="#c62828" onClick={() => {}} disabled />
        </div>

        <div style={s.pie}>© 2026 ATM Clothing — Todos los derechos reservados</div>
      </div>
    </div>
  )
}

function Boton({ icon, label, color, onClick, disabled }) {
  return (
    <button onClick={onClick} disabled={disabled} style={{
      background: disabled ? '#f5f5f5' : '#fff',
      border: `2px solid ${disabled ? '#e0e0e0' : color}`,
      borderRadius: 16,
      padding: '24px 12px',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      gap: 10,
      cursor: disabled ? 'not-allowed' : 'pointer',
      opacity: disabled ? 0.45 : 1,
      boxShadow: disabled ? 'none' : `0 4px 16px ${color}22`,
      transition: 'all 0.15s',
    }}>
      <span style={{ fontSize: 36 }}>{icon}</span>
      <span style={{ fontSize: 12, fontWeight: 800, color: disabled ? '#bbb' : color, textAlign: 'center', letterSpacing: 0.5 }}>
        {label}
      </span>
      {disabled && <span style={{ fontSize: 9, color: '#bbb' }}>Próximamente</span>}
    </button>
  )
}

const s = {
  pagina: {
    minHeight: '100vh',
    background: 'linear-gradient(135deg, #1a3a6b 0%, #2c5fa8 50%, #1a3a6b 100%)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  tarjeta: {
    background: '#fff',
    borderRadius: 24,
    padding: '36px 40px',
    width: '100%',
    maxWidth: 520,
    boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
  },
  logoWrap: {
    display: 'flex',
    alignItems: 'center',
    gap: 16,
    marginBottom: 24,
  },
  logoCirculo: {
    width: 72,
    height: 72,
    borderRadius: 18,
    background: 'linear-gradient(135deg, #1a3a6b, #2c5fa8)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    boxShadow: '0 6px 20px rgba(26,58,107,0.4)',
    flexShrink: 0,
  },
  logoAtm: {
    color: '#fff',
    fontSize: 26,
    fontWeight: 900,
    letterSpacing: 3,
  },
  empresa: {
    fontSize: 26,
    fontWeight: 900,
    color: '#1a3a6b',
    letterSpacing: 2,
    lineHeight: 1.1,
  },
  slogan: {
    fontSize: 11,
    color: '#7a99cc',
    letterSpacing: 2,
    textTransform: 'uppercase',
    marginTop: 2,
  },
  divisor: {
    height: 2,
    background: 'linear-gradient(90deg, #1a3a6b, #2c5fa8, transparent)',
    borderRadius: 2,
    marginBottom: 24,
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(3, 1fr)',
    gap: 12,
    marginBottom: 24,
  },
  pie: {
    textAlign: 'center',
    fontSize: 10,
    color: '#aab8d4',
    letterSpacing: 0.5,
  },
}
