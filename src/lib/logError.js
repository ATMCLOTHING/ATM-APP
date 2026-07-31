// src/lib/logError.js
// Registro de errores en operaciones críticas de guardado (notas, artículos, abonos).
// Se usa además del mensaje que ya se le muestra al usuario en pantalla, para que quede
// un rastro consultable de cuándo y por qué algo no se guardó (evita "huecos" silenciosos
// en la numeración de notas, como pasó con las notas 50435/50952).
//
// Nunca debe interrumpir el flujo de la app: si el propio registro del log falla,
// solo se avisa por consola.
export async function logError(supabase, { modulo, accion, mensaje, numnotaent, usuario, detalle }) {
  try {
    await supabase.from('log_errores').insert({
      modulo, accion, mensaje: String(mensaje || '').slice(0, 2000),
      numnotaent: numnotaent || null,
      usuario: usuario || null,
      detalle: detalle || null,
    })
  } catch (e) {
    console.error('No se pudo registrar el error en log_errores:', e)
  }
}
