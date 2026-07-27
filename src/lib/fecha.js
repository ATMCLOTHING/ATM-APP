// src/lib/fecha.js
// Formatea fechas al estilo DD/MM/AAAA para mostrarlas en toda la app.
// Las fechas llegan de Supabase como texto "AAAA-MM-DD" o "AAAA-MM-DDTHH:MM:SS...".
// Se arma con split de texto (no `new Date(f).toLocaleDateString()`) porque ese camino
// interpreta "AAAA-MM-DD" como medianoche UTC y, según la zona horaria del navegador,
// puede mostrar el día anterior.
export const fmtFecha = f => {
  if (!f) return ''
  const soloFecha = String(f).slice(0, 10)
  const [y, m, d] = soloFecha.split('-')
  if (!y || !m || !d || y.length !== 4) return String(f)
  return `${d}/${m}/${y}`
}
