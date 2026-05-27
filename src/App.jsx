// src/App.jsx
// Pantalla principal de ATM-APP.
// Desde aquí se navega a los diferentes módulos (Nota de Entrega, etc.)

import { useState } from 'react'
import { supabase } from './lib/supabase'
import NotaDeEntrega from './components/NotaDeEntrega'

export default function App() {
  const [modulo, setModulo] = useState(null)

  if (modulo === 'nota') {
    return <NotaDeEntrega supabase={supabase} onClose={() => setModulo(null)} />
  }

  return (
    <div style={s.wrapper}>
      <div style={s.header}>
        <div style={s.logo}>ATM</div>
        <div>
          <div style={s.title}>A TU MEDIDA</div>
          <div style={s.subtitle}>CONTROL DE INVENTARIOS</div>
        </div>
      </div>

      <div style={s.menu}>
        <MenuBtn icon="📋" label="Nota de Entrega" onClick={() => setModulo('nota')} />
        <MenuBtn icon="👥" label="Clientes"        onClick={() => {}} disabled />
        <MenuBtn icon="📦" label="Artículos"       onClick={() => {}} disabled />
        <MenuBtn icon="💰" label="Cartera"         onClick={() => {}} disabled />
        <MenuBtn icon="🛒" label="Compras"         onClick={() => {}} disabled />
        <MenuBtn icon="📊" label="Inventario"      onClick={() => {}} disabled />
      </div>

      <div style={s.footer}>
        © 2025 ATM Clothing — Sistema de Control de Inventarios
      </div>
    </div>
  )
}

function MenuBtn({ icon, label, onClick, disabled }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        ...s.menuBtn,
        opacity: disabled ? 0.4 : 1,
        cursor: disabled ? 'not-allowed' : 'pointer',
      }}
    >
      <span style={s.menuIcon}>{icon}</span>
      <span style={s.menuLabel}>{label}</span>
    </button>
  )
}

const s = {
  wrapper: {
    minHeight: '100vh',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 32,
    padding: 24,
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    gap: 16,
  },
  logo: {
    width: 64,
    height: 64,
    background: 'linear-gradient(135deg, #1a3a6b, #2c5fa8)',
    color: '#fff',
    borderRadius: 12,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: 22,
    fontWeight: 900,
    letterSpacing: 2,
    boxShadow: '0 4px 16px rgba(26,58,107,0.3)',
  },
  title: {
    fontSize: 28,
    fontWeight: 900,
    color: '#1a3a6b',
    letterSpacing: 3,
  },
  subtitle: {
    fontSize: 13,
    color: '#5577aa',
    letterSpacing: 2,
    textTransform: 'uppercase',
  },
  menu: {
    display: 'grid',
    gridTemplateColumns: 'repeat(3, 160px)',
    gap: 16,
  },
  menuBtn: {
    background: '#fff',
    border: '2px solid #c8d5ea',
    borderRadius: 12,
    padding: '20px 12px',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 10,
    boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
    transition: 'all 0.15s',
  },
  menuIcon: { fontSize: 32 },
  menuLabel: {
    fontSize: 12,
    fontWeight: 700,
    color: '#1a3a6b',
    textAlign: 'center',
    letterSpacing: 0.5,
  },
  footer: {
    fontSize: 11,
    color: '#8fa4c8',
    letterSpacing: 1,
  },
}
