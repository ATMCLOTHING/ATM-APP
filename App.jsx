import { useState, useEffect } from 'react'
import { supabase } from './lib/supabase'
import { getUsuario, setUsuario, cerrarSesion } from './lib/auth'
import Login           from './components/Login'
import Dashboard       from './components/Dashboard'
import NotaDeEntrega   from './components/NotaDeEntrega'
import Articulos       from './components/Articulos'
import Proveedores     from './components/Proveedores'
import CierreCaja      from './components/CierreCaja'
import GestionUsuarios from './components/GestionUsuarios'
import Cartera         from './components/Cartera'
import Comisiones      from './components/Comisiones'
import Clientes        from './components/Clientes'

export default function App() {
  const [usuario, setUsuarioState] = useState(null)
  const [modulo,  setModulo]       = useState(null)
  const [listo,   setListo]        = useState(false)

  useEffect(() => {
    const u = getUsuario()
    if (u) setUsuarioState(u)
    setListo(true)
  }, [])

  function onLogin(u) {
    setUsuario(u)
    setUsuarioState(u)
    if (u.rol === 'cajera' || u.rol === 'vendedor') setModulo('nota')
    else if (u.rol === 'bodega') setModulo('articulos')
    else setModulo(null)
  }

  function onLogout() {
    cerrarSesion()
    setUsuarioState(null)
    setModulo(null)
  }

  function onModulo(id) { setModulo(id) }
  function onClose()    { setModulo(null) }

  if (!listo) return null
  if (!usuario) return <Login supabase={supabase} onLogin={onLogin}/>

  if (modulo === 'nota')       return <NotaDeEntrega   supabase={supabase} usuario={usuario} onClose={onClose}/>
  if (modulo === 'articulos')  return <Articulos        supabase={supabase} usuario={usuario} onClose={onClose}/>
  if (modulo === 'proveedores')return <Proveedores      supabase={supabase} usuario={usuario} onClose={onClose}/>
  if (modulo === 'cierre')     return <CierreCaja       supabase={supabase} usuario={usuario} onClose={onClose}/>
  if (modulo === 'usuarios')   return <GestionUsuarios  supabase={supabase} usuario={usuario} onClose={onClose}/>
  if (modulo === 'cartera')    return <Cartera          supabase={supabase} usuario={usuario} onClose={onClose}/>
  if (modulo === 'comisiones') return <Comisiones       supabase={supabase} usuario={usuario} onClose={onClose}/>
  if (modulo === 'clientes')   return <Clientes         supabase={supabase} usuario={usuario} onClose={onClose}/>

  return (
    <Dashboard
      supabase={supabase}
      usuario={usuario}
      onModulo={onModulo}
      onLogout={onLogout}
    />
  )
}
