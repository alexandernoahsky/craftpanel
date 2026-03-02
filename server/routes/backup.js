const express = require('express')
const router = express.Router()
const path = require('path')
const fs = require('fs-extra')
const crypto = require('crypto')
const os = require('os')
const { v4: uuidv4 } = require('uuid')
const { google } = require('googleapis')
const axios = require('axios')

const backupManager = require('../backupManager')

const DATA_DIR = path.join(__dirname, '..', 'data')
const CONFIG_PATH = path.join(DATA_DIR, 'config.json')
const BACKUP_FILES_DIR = path.join(DATA_DIR, 'backup_files')

fs.ensureDirSync(BACKUP_FILES_DIR)

function loadConfig() {
  if (!fs.existsSync(CONFIG_PATH)) return {}
  return fs.readJsonSync(CONFIG_PATH)
}

function saveConfig(config) {
  fs.writeJsonSync(CONFIG_PATH, config, { spaces: 2 })
}

// In-memory CSRF nonces (expire after 10 minutes)
const oauthNonces = new Map()
setInterval(() => {
  const cutoff = Date.now() - 10 * 60 * 1000
  for (const [k, v] of oauthNonces) {
    if (v.ts < cutoff) oauthNonces.delete(k)
  }
}, 60 * 1000)

// GET /api/backup/config
router.get('/config', (req, res) => {
  const config = loadConfig()
  const backup = config.backup || {}
  const callbackBaseUrl = `${req.protocol}://${req.get('host')}`
  res.json({
    callbackBaseUrl,
    smb: {
      host: backup.smb?.host || '',
      share: backup.smb?.share || '',
      path: backup.smb?.path || '/backups',
      username: backup.smb?.username || '',
      password: backup.smb?.password ? '••••••••' : '',
      configured: !!(backup.smb?.host && backup.smb?.share),
    },
    googleDrive: {
      clientId: backup.googleDrive?.clientId || '',
      clientSecret: backup.googleDrive?.clientSecret ? '••••••••' : '',
      folderId: backup.googleDrive?.folderId || '',
      connected: !!(backup.googleDrive?.refreshToken),
    },
    dropbox: {
      appKey: backup.dropbox?.appKey || '',
      appSecret: backup.dropbox?.appSecret ? '••••••••' : '',
      path: backup.dropbox?.path || '/backups',
      connected: !!(backup.dropbox?.refreshToken),
    },
    local: {
      enabled: !!(backup.local?.enabled),
      directory: BACKUP_FILES_DIR,
    },
  })
})

// POST /api/backup/config
router.post('/config', (req, res) => {
  const config = loadConfig()
  if (!config.backup) config.backup = {}
  const { smb, googleDrive, dropbox } = req.body

  if (req.body.local !== undefined) {
    config.backup.local = { enabled: !!req.body.local.enabled }
  }
  if (smb) {
    config.backup.smb = {
      host: smb.host ?? config.backup.smb?.host ?? '',
      share: smb.share ?? config.backup.smb?.share ?? '',
      path: smb.path ?? config.backup.smb?.path ?? '/backups',
      username: smb.username ?? config.backup.smb?.username ?? '',
      password: (smb.password && smb.password !== '••••••••')
        ? smb.password
        : (config.backup.smb?.password ?? ''),
    }
  }
  if (googleDrive) {
    config.backup.googleDrive = {
      ...(config.backup.googleDrive || {}),
      clientId: googleDrive.clientId ?? config.backup.googleDrive?.clientId ?? '',
      clientSecret: (googleDrive.clientSecret && googleDrive.clientSecret !== '••••••••')
        ? googleDrive.clientSecret
        : (config.backup.googleDrive?.clientSecret ?? ''),
      folderId: googleDrive.folderId ?? config.backup.googleDrive?.folderId ?? '',
    }
  }
  if (dropbox) {
    config.backup.dropbox = {
      ...(config.backup.dropbox || {}),
      appKey: dropbox.appKey ?? config.backup.dropbox?.appKey ?? '',
      appSecret: (dropbox.appSecret && dropbox.appSecret !== '••••••••')
        ? dropbox.appSecret
        : (config.backup.dropbox?.appSecret ?? ''),
      path: dropbox.path ?? config.backup.dropbox?.path ?? '/backups',
    }
  }

  saveConfig(config)
  res.json({ success: true })
})

// GET /api/backup/oauth/google/init
router.get('/oauth/google/init', (req, res) => {
  const config = loadConfig()
  const gd = config.backup?.googleDrive
  if (!gd?.clientId || !gd?.clientSecret) {
    return res.status(400).send('Save Google client credentials first')
  }
  const redirectUri = `${req.protocol}://${req.get('host')}/api/backup/oauth/google/callback`
  const auth = new google.auth.OAuth2(gd.clientId, gd.clientSecret, redirectUri)
  const state = crypto.randomBytes(16).toString('hex')
  oauthNonces.set(state, { provider: 'google', ts: Date.now() })
  const authUrl = auth.generateAuthUrl({
    access_type: 'offline',
    prompt: 'consent',
    scope: ['https://www.googleapis.com/auth/drive.file'],
    state,
  })
  res.redirect(authUrl)
})

// GET /api/backup/oauth/google/callback
router.get('/oauth/google/callback', async (req, res) => {
  const { code, state, error } = req.query
  if (error) {
    return res.send(`<html><body><p>Error: ${error}</p><script>window.opener?.postMessage({type:'oauth-error',provider:'google'},'*');setTimeout(()=>window.close(),2000)</script></body></html>`)
  }
  if (!state || !oauthNonces.has(state)) {
    return res.status(400).send('Invalid state parameter')
  }
  oauthNonces.delete(state)

  const config = loadConfig()
  const gd = config.backup?.googleDrive
  const redirectUri = `${req.protocol}://${req.get('host')}/api/backup/oauth/google/callback`
  const auth = new google.auth.OAuth2(gd.clientId, gd.clientSecret, redirectUri)

  try {
    const { tokens } = await auth.getToken(code)
    if (tokens.refresh_token) {
      config.backup.googleDrive.refreshToken = tokens.refresh_token
      saveConfig(config)
    }
    res.send(`<html><body><p>Google Drive connected! You can close this tab.</p><script>window.opener?.postMessage({type:'oauth-success',provider:'google'},'*');window.close()</script></body></html>`)
  } catch (err) {
    res.status(500).send(`<html><body><p>Failed: ${err.message}</p><script>window.opener?.postMessage({type:'oauth-error',provider:'google'},'*');setTimeout(()=>window.close(),3000)</script></body></html>`)
  }
})

// POST /api/backup/oauth/google/disconnect
router.post('/oauth/google/disconnect', (req, res) => {
  const config = loadConfig()
  if (config.backup?.googleDrive) {
    delete config.backup.googleDrive.refreshToken
  }
  saveConfig(config)
  res.json({ success: true })
})

// GET /api/backup/oauth/dropbox/init
router.get('/oauth/dropbox/init', (req, res) => {
  const config = loadConfig()
  const db = config.backup?.dropbox
  if (!db?.appKey || !db?.appSecret) {
    return res.status(400).send('Save Dropbox app credentials first')
  }
  const redirectUri = `${req.protocol}://${req.get('host')}/api/backup/oauth/dropbox/callback`
  const state = crypto.randomBytes(16).toString('hex')
  oauthNonces.set(state, { provider: 'dropbox', ts: Date.now() })
  const authUrl = `https://www.dropbox.com/oauth2/authorize?client_id=${encodeURIComponent(db.appKey)}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code&token_access_type=offline&state=${state}`
  res.redirect(authUrl)
})

// GET /api/backup/oauth/dropbox/callback
router.get('/oauth/dropbox/callback', async (req, res) => {
  const { code, state, error } = req.query
  if (error) {
    return res.send(`<html><body><p>Error: ${error}</p><script>window.opener?.postMessage({type:'oauth-error',provider:'dropbox'},'*');setTimeout(()=>window.close(),2000)</script></body></html>`)
  }
  if (!state || !oauthNonces.has(state)) {
    return res.status(400).send('Invalid state parameter')
  }
  oauthNonces.delete(state)

  const config = loadConfig()
  const db = config.backup?.dropbox
  const redirectUri = `${req.protocol}://${req.get('host')}/api/backup/oauth/dropbox/callback`

  try {
    const tokenRes = await axios.post('https://api.dropboxapi.com/oauth2/token', null, {
      params: {
        code,
        grant_type: 'authorization_code',
        client_id: db.appKey,
        client_secret: db.appSecret,
        redirect_uri: redirectUri,
      },
    })
    config.backup.dropbox.refreshToken = tokenRes.data.refresh_token
    saveConfig(config)
    res.send(`<html><body><p>Dropbox connected! You can close this tab.</p><script>window.opener?.postMessage({type:'oauth-success',provider:'dropbox'},'*');window.close()</script></body></html>`)
  } catch (err) {
    res.status(500).send(`<html><body><p>Failed: ${err.message}</p><script>window.opener?.postMessage({type:'oauth-error',provider:'dropbox'},'*');setTimeout(()=>window.close(),3000)</script></body></html>`)
  }
})

// POST /api/backup/oauth/dropbox/disconnect
router.post('/oauth/dropbox/disconnect', (req, res) => {
  const config = loadConfig()
  if (config.backup?.dropbox) {
    delete config.backup.dropbox.refreshToken
  }
  saveConfig(config)
  res.json({ success: true })
})

// GET /api/backup/:serverId/history
router.get('/:serverId/history', (req, res) => {
  res.json(backupManager.getHistory(req.params.serverId))
})

// POST /api/backup/:serverId/create
router.post('/:serverId/create', async (req, res) => {
  const { serverId } = req.params
  const io = req.io
  const serverMgr = req.serverManager
  const server = serverMgr.getServer(serverId)
  if (!server) return res.status(404).json({ error: 'Server not found' })

  const config = loadConfig()
  const backup = config.backup || {}
  const destinations = []
  if (backup.local?.enabled) destinations.push('local')
  if (backup.smb?.host && backup.smb?.share) destinations.push('smb')
  if (backup.googleDrive?.refreshToken) destinations.push('googleDrive')
  if (backup.dropbox?.refreshToken) destinations.push('dropbox')

  if (destinations.length === 0) {
    return res.status(400).json({ error: 'No backup destination configured' })
  }

  // Respond immediately; do the work async
  res.json({ success: true, message: 'Backup started' })

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
  const safeName = server.name.replace(/[^a-z0-9]/gi, '_')
  const filename = `${safeName}_${timestamp}.zip`
  const tmpPath = path.join(os.tmpdir(), filename)

  try {
    io.emit('backup-progress', { serverId, phase: 'zipping', percent: 0 })

    await backupManager.createArchive(server.directory, tmpPath, p => {
      io.emit('backup-progress', { serverId, ...p })
    })

    const stat = await fs.stat(tmpPath)
    const onProgress = p => io.emit('backup-progress', { serverId, ...p })
    const completedDestinations = []
    let localPath = null

    if (destinations.includes('local')) {
      localPath = path.join(BACKUP_FILES_DIR, filename)
      await fs.copy(tmpPath, localPath)
      completedDestinations.push('local')
    }
    if (destinations.includes('smb')) {
      await backupManager.uploadToSmb(tmpPath, backup.smb, onProgress)
      completedDestinations.push('smb')
    }
    if (destinations.includes('googleDrive')) {
      await backupManager.uploadToDrive(tmpPath, backup.googleDrive, onProgress)
      completedDestinations.push('googleDrive')
    }
    if (destinations.includes('dropbox')) {
      await backupManager.uploadToDropbox(tmpPath, backup.dropbox, onProgress)
      completedDestinations.push('dropbox')
    }

    const entry = {
      id: uuidv4(),
      serverId,
      filename,
      sizeBytes: stat.size,
      destinations: completedDestinations,
      createdAt: new Date().toISOString(),
      ...(localPath ? { localPath } : {}),
    }
    backupManager.saveHistory(entry)
    io.emit('backup-complete', { serverId, entry })
  } catch (err) {
    console.error(`Backup failed for server ${serverId}:`, err.message)
    io.emit('backup-error', { serverId, error: err.message })
  } finally {
    fs.remove(tmpPath).catch(() => {})
  }
})

// GET /api/backup/download/:backupId
router.get('/download/:backupId', (req, res) => {
  const history = backupManager.loadHistory()
  const entry = history.find(e => e.id === req.params.backupId)
  if (!entry) return res.status(404).json({ error: 'Backup not found' })
  if (!entry.localPath) return res.status(404).json({ error: 'No local file for this backup' })
  if (!fs.existsSync(entry.localPath)) return res.status(404).json({ error: 'Backup file no longer exists on disk' })
  res.download(entry.localPath, entry.filename)
})

module.exports = router
