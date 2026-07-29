// Sube un archivo de respaldo a una carpeta de Google Drive usando una cuenta
// de servicio de Google. Se usa desde el workflow de GitHub Actions
// .github/workflows/backup-semanal.yml — no se ejecuta desde la app.
//
// Variables de entorno requeridas:
//   GOOGLE_SERVICE_ACCOUNT_JSON  -> contenido del JSON de la cuenta de servicio
//   GDRIVE_FOLDER_ID             -> ID de la carpeta de Drive destino
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

const credentials = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_JSON)
const folderId = process.env.GDRIVE_FOLDER_ID
if (!folderId) {
  console.error('Falta la variable de entorno GDRIVE_FOLDER_ID')
  process.exit(1)
}

const auth = new google.auth.GoogleAuth({
  credentials,
  scopes: ['https://www.googleapis.com/auth/drive.file'],
})

const drive = google.drive({ version: 'v3', auth })

const nombreArchivo = path.basename(filePath)

const { data } = await drive.files.create({
  requestBody: { name: nombreArchivo, parents: [folderId] },
  media: { mimeType: 'application/gzip', body: fs.createReadStream(filePath) },
  fields: 'id, name, webViewLink',
})

console.log(`Respaldo subido a Drive: ${data.name} (id: ${data.id})`)
