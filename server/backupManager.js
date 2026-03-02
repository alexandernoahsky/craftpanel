const path = require('path')
const fs = require('fs-extra')
const archiver = require('archiver')
const axios = require('axios')
const { v4: uuidv4 } = require('uuid')
const { google } = require('googleapis')

const BACKUPS_FILE = path.join(__dirname, 'data', 'backups.json')

function loadHistory() {
  if (!fs.existsSync(BACKUPS_FILE)) return []
  try {
    return fs.readJsonSync(BACKUPS_FILE)
  } catch {
    return []
  }
}

function saveHistory(entry) {
  const history = loadHistory()
  history.unshift(entry)
  fs.writeJsonSync(BACKUPS_FILE, history, { spaces: 2 })
}

function getHistory(serverId) {
  return loadHistory().filter(e => e.serverId === serverId)
}

function createArchive(serverDir, outputPath, onProgress) {
  return new Promise((resolve, reject) => {
    const output = fs.createWriteStream(outputPath)
    const archive = archiver('zip', { zlib: { level: 6 } })

    archive.on('progress', (p) => {
      if (p.entries.total > 0) {
        const percent = Math.round((p.entries.processed / p.entries.total) * 100)
        onProgress?.({ phase: 'zipping', percent: Math.min(percent, 99) })
      }
    })

    output.on('close', () => resolve(archive.pointer()))
    archive.on('error', reject)

    archive.pipe(output)
    archive.directory(serverDir, false)
    archive.finalize()
  })
}

async function uploadToSmb(archivePath, smbConfig, onProgress) {
  const SMB2 = require('@marsaud/smb2')
  const smb2Client = new SMB2({
    share: `\\\\${smbConfig.host}\\${smbConfig.share}`,
    domain: '',
    username: smbConfig.username,
    password: smbConfig.password,
  })

  onProgress?.({ phase: 'uploading', destination: 'smb', percent: 0 })

  try {
    const filename = path.basename(archivePath)
    const remotePath = (smbConfig.path || '/backups').replace(/\//g, '\\').replace(/^\\/, '') + '\\' + filename
    const fileBuffer = await fs.readFile(archivePath)

    await new Promise((resolve, reject) => {
      smb2Client.writeFile(remotePath, fileBuffer, err => {
        if (err) reject(err)
        else resolve()
      })
    })

    onProgress?.({ phase: 'uploading', destination: 'smb', percent: 100 })
  } finally {
    smb2Client.close?.()
  }
}

async function uploadToDrive(archivePath, driveConfig, onProgress) {
  const auth = new google.auth.OAuth2(driveConfig.clientId, driveConfig.clientSecret)
  auth.setCredentials({ refresh_token: driveConfig.refreshToken })
  const drive = google.drive({ version: 'v3', auth })

  const filename = path.basename(archivePath)
  const stat = await fs.stat(archivePath)
  const fileSize = stat.size
  let uploaded = 0

  onProgress?.({ phase: 'uploading', destination: 'googleDrive', percent: 0 })

  const readStream = fs.createReadStream(archivePath)
  readStream.on('data', chunk => {
    uploaded += chunk.length
    const percent = Math.round((uploaded / fileSize) * 100)
    onProgress?.({ phase: 'uploading', destination: 'googleDrive', percent: Math.min(percent, 99) })
  })

  const fileMetadata = {
    name: filename,
    ...(driveConfig.folderId ? { parents: [driveConfig.folderId] } : {}),
  }

  await drive.files.create({
    requestBody: fileMetadata,
    media: { mimeType: 'application/zip', body: readStream },
    fields: 'id',
  })

  onProgress?.({ phase: 'uploading', destination: 'googleDrive', percent: 100 })
}

async function uploadToDropbox(archivePath, dropboxConfig, onProgress) {
  const filename = path.basename(archivePath)
  const remotePath = (dropboxConfig.path || '/backups') + '/' + filename
  const fileBuffer = await fs.readFile(archivePath)
  const fileSize = fileBuffer.length

  onProgress?.({ phase: 'uploading', destination: 'dropbox', percent: 0 })

  // Get fresh access token via refresh token
  const tokenRes = await axios.post('https://api.dropboxapi.com/oauth2/token', null, {
    params: {
      grant_type: 'refresh_token',
      refresh_token: dropboxConfig.refreshToken,
      client_id: dropboxConfig.appKey,
      client_secret: dropboxConfig.appSecret,
    },
  })
  const accessToken = tokenRes.data.access_token

  // Start upload session
  const startRes = await axios.post(
    'https://content.dropboxapi.com/2/files/upload_session/start',
    Buffer.alloc(0),
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Dropbox-API-Arg': JSON.stringify({ close: false }),
        'Content-Type': 'application/octet-stream',
      },
    }
  )
  const sessionId = startRes.data.session_id

  // Upload in 8MB chunks
  const CHUNK_SIZE = 8 * 1024 * 1024
  let offset = 0

  while (offset < fileSize) {
    const end = Math.min(offset + CHUNK_SIZE, fileSize)
    const chunk = fileBuffer.slice(offset, end)
    const isLast = end >= fileSize

    if (isLast) {
      await axios.post(
        'https://content.dropboxapi.com/2/files/upload_session/finish',
        chunk,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Dropbox-API-Arg': JSON.stringify({
              cursor: { session_id: sessionId, offset },
              commit: { path: remotePath, mode: 'add', autorename: true },
            }),
            'Content-Type': 'application/octet-stream',
          },
        }
      )
    } else {
      await axios.post(
        'https://content.dropboxapi.com/2/files/upload_session/append_v2',
        chunk,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Dropbox-API-Arg': JSON.stringify({
              cursor: { session_id: sessionId, offset },
              close: false,
            }),
            'Content-Type': 'application/octet-stream',
          },
        }
      )
    }

    offset = end
    const percent = Math.round((offset / fileSize) * 100)
    onProgress?.({ phase: 'uploading', destination: 'dropbox', percent: Math.min(percent, isLast ? 100 : 99) })
  }
}

module.exports = { createArchive, uploadToSmb, uploadToDrive, uploadToDropbox, loadHistory, saveHistory, getHistory }
