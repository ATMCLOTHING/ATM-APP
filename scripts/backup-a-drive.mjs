// Sube un archivo de respaldo a una carpeta de Google Drive, autorizado como
// la cuenta atmjeans.app@gmail.com (las cuentas de servicio de Google no
// tienen cupo de almacenamiento propio en Drive personal, por eso se usa
// autorización OAuth de la cuenta real en vez de una cuenta de servicio).
// Se usa desde el workflow de GitHub Actions .github/workflows/backup-semanal.yml
// — no se ejecuta desde la app.
//
// El refresh token se genera una sola vez con scripts/setup-google-oauth.mjs.
//
// Variables de entorno requeridas:
//   GDRIVE_CLIENT_ID     -> Client ID de la credencial OAuth "Desktop app"
//   GDRIVE_CLIENT_SECRET -> Client Secret de esa misma credencial
//   GDRIVE_REFRESH_TOKEN -> token generado por setup-google-oauth.mjs
//   GDRIVE_FOLDER_ID     -> ID de la carpeta de Drive destino
//
// Uso: node scripts/backup-a-drive.mjs <ruta-del-archivo>

import { google } from 'googleapis'
import fs from 'fs'
import path from 'path'

const filePath = process.argv[2]
if (!filePath) {
  console.error('Uso: node scripts/backup-a-drive.mjs <ruta-del-archivo>')
  process.exit(1)
}
if (!fs.existsSync(filePath)) {
  console.error(`No existe el archivo: ${filePath}`)
  process.exit(1)
}

const clientId = process.env.GDRIVE_CLIENT_ID
const clientSecret = process.env.GDRIVE_CLIENT_SECRET
const refreshToken = process.env.GDRIVE_REFRESH_TOKEN
const folderId = process.env.GDRIVE_FOLDER_ID

for (const [nombre, valor] of Object.entries({
  GDRIVE_CLIENT_ID: clientId, GDRIVE_CLIENT_SECRET: clientSecret,
  GDRIVE_REFRESH_TOKEN: refreshToken, GDRIVE_FOLDER_ID: folderId,
})) {
  if (!valor) { console.error(`Falta la variable de entorno ${nombre}`); process.exit(1) }
}

const oauth2Client = new google.auth.OAuth2(clientId, clientSecret)
oauth2Client.setCredentials({ refresh_token: refreshToken })

const drive = google.drive({ version: 'v3', auth: oauth2Client })

const nombreArchivo = path.basename(filePath)

const { data } = await drive.files.create({
  requestBody: { name: nombreArchivo, parents: [folderId] },
  media: { mimeType: 'application/gzip', body: fs.createReadStream(filePath) },
  fields: 'id, name, webViewLink',
})

console.log(`Respaldo subido a Drive: ${data.name} (id: ${data.id})`)
