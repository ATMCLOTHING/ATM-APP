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
import ControlDocumentos from './components/ControlDocumentos'
import LogErrores      from './components/LogErrores'
import Egresos         from './components/Egresos'
import Vales           from './components/Vales'
import Vendedores      from './components/Vendedores'
import Manual          from './components/Manual'

export default function App() {
  const [usuario,   setUsuarioState]   = useState(null)
  const [modulo,    setModulo]         = useState(null)
  const [listo,     setListo]          = useState(false)
  const [permisos,  setPermisos]       = useState([])  // módulos extra de usuario_permisos

  useEffect(() => {
    const u = getUsuario()
    if (u) { setUsuarioState(u); cargarPermisos(u.id) }
    setListo(true)
  }, [])

  async function cargarPermisos(userId) {
    if (!userId) return
    const {data} = await supabase.from('usuario_permisos')
      .select('modulo,puede_ver').eq('usuario_id', userId).eq('puede_ver', true)
    setPermisos((data||[]).map(p => p.modulo))
  }

  async function onLogin(u) {
    setUsuario(u)
    setUsuarioState(u)
    await cargarPermisos(u.id)
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
  function onAyuda()    { setModulo('manual') }

  if (!listo) return null
  if (!usuario) return <Login supabase={supabase} onLogin={onLogin}/>

  if (modulo === 'nota')       return <NotaDeEntrega   supabase={supabase} usuario={usuario} onClose={onClose} onAyuda={onAyuda}/>
  if (modulo === 'articulos')  return <Articulos        supabase={supabase} usuario={usuario} onClose={onClose} onAyuda={onAyuda}/>
  if (modulo === 'proveedores')return <Proveedores      supabase={supabase} usuario={usuario} onClose={onClose} onAyuda={onAyuda}/>
  if (modulo === 'cierre')     return <CierreCaja       supabase={supabase} usuario={usuario} onClose={onClose} onAyuda={onAyuda}/>
  if (modulo === 'usuarios')   return <GestionUsuarios  supabase={supabase} usuario={usuario} onClose={onClose} onAyuda={onAyuda}/>
  if (modulo === 'cartera')    return <Cartera          supabase={supabase} usuario={usuario} onClose={onClose} onAyuda={onAyuda}/>
  if (modulo === 'documentos') return <ControlDocumentos supabase={supabase} usuario={usuario} onClose={onClose} onAyuda={onAyuda}/>
  if (modulo === 'log_errores')return <LogErrores       supabase={supabase} usuario={usuario} onClose={onClose} onAyuda={onAyuda}/>
  if (modulo === 'egresos')    return <Egresos           supabase={supabase} usuario={usuario} onClose={onClose} onAyuda={onAyuda}/>
  if (modulo === 'vales')      return <Vales              supabase={supabase} usuario={usuario} onClose={onClose} onAyuda={onAyuda}/>
  if (modulo === 'vendedores') return <Vendedores          supabase={supabase} usuario={usuario} onClose={onClose} onAyuda={onAyuda}/>
  if (modulo === 'comisiones') return <Comisiones        supabase={supabase} usuario={usuario} onClose={onClose} onAyuda={onAyuda}/>
  if (modulo === 'clientes')   return <Clientes         supabase={supabase} usuario={usuario} onClose={onClose} onAyuda={onAyuda}/>
  if (modulo === 'manual')     return <Manual                                                  onClose={onClose}/>

  return (
    <Dashboard
      supabase={supabase}
      usuario={usuario}
      permisosExtra={permisos}
      onModulo={onModulo}
      onLogout={onLogout}
    />
  )
}
