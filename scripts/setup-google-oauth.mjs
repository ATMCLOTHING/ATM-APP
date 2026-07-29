// Autorización única para que el respaldo semanal pueda subir archivos a la
// cuenta de Google Drive de atmjeans.app@gmail.com. Abre el navegador para
// que inicies sesión y apruebes el permiso, y guarda el resultado
// directamente como secretos de GitHub (gh secret set) — el token nunca se
// muestra en pantalla completo.
//
// No es parte del workflow automático: se corre una sola vez, a mano.
//
// Uso: GOOGLE_CLIENT_ID=... GOOGLE_CLIENT_SECRET=... node scripts/setup-google-oauth.mjs

import http from 'http'
import { execSync } from 'child_process'
import { google } from 'googleapis'

const clientId = process.env.GOOGLE_CLIENT_ID
const clientSecret = process.env.GOOGLE_CLIENT_SECRET
if (!clientId || !clientSecret) {
  console.error('Faltan las variables de entorno GOOGLE_CLIENT_ID y/o GOOGLE_CLIENT_SECRET')
  process.exit(1)
}

const PORT = 51876
const redirectUri = `http://localhost:${PORT}`
const oauth2Client = new google.auth.OAuth2(clientId, clientSecret, redirectUri)

const authUrl = oauth2Client.generateAuthUrl({
  access_type: 'offline',
  prompt: 'consent',
  scope: ['https://www.googleapis.com/auth/drive.file'],
})

console.log('\nAbre esta URL e inicia sesión con atmjeans.app@gmail.com (se debería abrir sola):\n')
console.log(authUrl + '\n')
try { execSync(`start "" "${authUrl}"`, { shell: 'cmd.exe' }) } catch {}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, redirectUri)
  const code = url.searchParams.get('code')
  const errorParam = url.searchParams.get('error')

  if (errorParam) {
    res.end('Google devolvió un error. Revisa la terminal.')
    console.error('Error de Google:', errorParam)
    server.close()
    process.exit(1)
  }
  if (!code) {
    res.end('No llegó ningún código. Cierra esta pestaña e inténtalo de nuevo.')
    return
  }

  res.end('Listo, ya puedes cerrar esta pestaña y volver a la terminal.')
  server.close()

  const { tokens } = await oauth2Client.getToken(code)
  if (!tokens.refresh_token) {
    console.error('\nGoogle no devolvió un refresh_token.')
    console.error('Suele pasar si ya habías autorizado esta app antes. Ve a')
    console.error('https://myaccount.google.com/permissions, quita el acceso a esta app,')
    console.error('y vuelve a correr este script.')
    process.exit(1)
  }

  console.log('\nAutorización recibida. Guardando los secretos en GitHub...')
  execSync(`gh secret set GDRIVE_REFRESH_TOKEN --body "${tokens.refresh_token}"`, { stdio: 'inherit' })
  execSync(`gh secret set GDRIVE_CLIENT_ID --body "${clientId}"`, { stdio: 'inherit' })
  execSync(`gh secret set GDRIVE_CLIENT_SECRET --body "${clientSecret}"`, { stdio: 'inherit' })
  console.log('\n✅ Listo. Los 3 secretos de Google (CLIENT_ID, CLIENT_SECRET, REFRESH_TOKEN) quedaron guardados en GitHub.')
  process.exit(0)
})

server.listen(PORT, () => {
  console.log(`Esperando la autorización en ${redirectUri} ...`)
})
