// src/lib/auth.js
// Manejo de autenticación y sesión de usuario

export const AUTH_KEY = 'atm_usuario'

export function getUsuario() {
  try {
    const s = localStorage.getItem(AUTH_KEY)
    return s ? JSON.parse(s) : null
  } catch { return null }
}

export function setUsuario(u) {
  localStorage.setItem(AUTH_KEY, JSON.stringify(u))
}

export function cerrarSesion() {
  localStorage.removeItem(AUTH_KEY)
}

export function tienePermiso(usuario, modulo, accion='puede_ver') {
  if (!usuario) return false
  if (usuario.rol === 'admin') return true
  const perm = (usuario.permisos||[]).find(p=>p.modulo===modulo)
  return perm ? (perm[accion]||false) : false
}
