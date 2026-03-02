const express = require('express')
const router = express.Router()
const net = require('net')
const path = require('path')
const fs = require('fs-extra')
const os = require('os')
const multer = require('multer')
const AdmZip = require('adm-zip')
const { v4: uuidv4 } = require('uuid')

// ── Helpers ───────────────────────────────────────────────────────────────────

function isPortAvailable(port) {
  return new Promise(resolve => {
    const server = net.createServer()
    server.once('error', () => resolve(false))
    server.once('listening', () => server.close(() => resolve(true)))
    server.listen(port, '0.0.0.0')
  })
}

function parseProperties(text) {
  const result = {}
  for (const line of text.split('\n')) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const eq = trimmed.indexOf('=')
    if (eq === -1) continue
    result[trimmed.slice(0, eq).trim()] = trimmed.slice(eq + 1)
  }
  return result
}

function detectServerType(serverDir) {
  if (
    fs.existsSync(path.join(serverDir, 'paper-global.yml')) ||
    fs.existsSync(path.join(serverDir, 'bukkit.yml')) ||
    fs.existsSync(path.join(serverDir, 'spigot.yml'))
  ) return 'paper'
  if (fs.existsSync(path.join(serverDir, 'fabric-server-launch.properties'))) return 'fabric'
  if (fs.existsSync(path.join(serverDir, 'libraries', 'net', 'minecraftforge'))) return 'forge'
  return 'vanilla'
}

function detectVersion(serverDir) {
  // 1. version.json — present in vanilla and some Paper/Spigot builds
  const vj = path.join(serverDir, 'version.json')
  if (fs.existsSync(vj)) {
    try {
      const v = JSON.parse(fs.readFileSync(vj, 'utf8')).name || ''
      if (v) return v
    } catch {}
  }

  // 2. logs/latest.log — most reliable across all server types.
  //    Only read the first 8 KB so it's fast even with large log files.
  //    Vanilla/Paper/Spigot: "Starting minecraft server version 1.20.4"
  //    Paper/Spigot alt:     "(MC: 1.20.4)"
  //    Fabric:               "Loading Minecraft 1.20.4 with Fabric Loader"
  const logFile = path.join(serverDir, 'logs', 'latest.log')
  if (fs.existsSync(logFile)) {
    try {
      const fd = fs.openSync(logFile, 'r')
      const buf = Buffer.alloc(8192)
      const bytesRead = fs.readSync(fd, buf, 0, 8192, 0)
      fs.closeSync(fd)
      const head = buf.slice(0, bytesRead).toString('utf8')
      let m = head.match(/Starting minecraft server version (\d+\.\d+(?:\.\d+)?)/i)
      if (!m) m = head.match(/\(MC:\s*(\d+\.\d+(?:\.\d+)?)\)/i)
      if (!m) m = head.match(/Loading Minecraft (\d+\.\d+(?:\.\d+)?) with/i)
      if (m) return m[1]
    } catch {}
  }

  // 3. JAR filenames in the server root — covers named distributions.
  //    e.g. paper-1.20.4-368.jar, spigot-1.20.4.jar, minecraft_server.1.20.4.jar
  try {
    const MC_VER = /(\d+\.\d+(?:\.\d+)?)/
    const jars = fs.readdirSync(serverDir).filter(f => f.endsWith('.jar') && f !== 'server.jar')
    for (const jar of jars) {
      const m = jar.match(MC_VER)
      if (m) return m[1]
    }
  } catch {}

  return ''
}

function extractZip(zipPath, destDir) {
  const zip = new AdmZip(zipPath)
  const entries = zip.getEntries()

  // Detect single-root-folder ZIPs (macOS/Windows wrapping)
  const rootDirs = new Set()
  for (const entry of entries) {
    const parts = entry.entryName.replace(/\\/g, '/').split('/')
    if (parts.length > 1 && parts[0]) rootDirs.add(parts[0])
  }

  const hasCommonRoot =
    rootDirs.size === 1 &&
    entries.every(e => {
      const name = e.entryName.replace(/\\/g, '/')
      return name.startsWith([...rootDirs][0] + '/') || name === [...rootDirs][0]
    })

  // Always extract manually so we can guard against path traversal
  const prefix = hasCommonRoot ? ([...rootDirs][0] + '/') : ''
  for (const entry of entries) {
    if (entry.isDirectory) continue
    let relPath = entry.entryName.replace(/\\/g, '/')
    if (prefix) relPath = relPath.slice(prefix.length)
    if (!relPath) continue
    // Path traversal guard: resolved dest must stay within destDir
    const dest = path.resolve(destDir, relPath)
    if (!dest.startsWith(path.resolve(destDir) + path.sep) && dest !== path.resolve(destDir)) continue
    fs.ensureDirSync(path.dirname(dest))
    fs.writeFileSync(dest, entry.getData())
  }
}

const importUpload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => cb(null, os.tmpdir()),
    filename: (req, file, cb) => cb(null, `craftpanel-import-${Date.now()}.zip`),
  }),
  limits: { fileSize: 10 * 1024 * 1024 * 1024 },
  fileFilter: (req, file, cb) =>
    path.extname(file.originalname).toLowerCase() === '.zip'
      ? cb(null, true)
      : cb(new Error('Only .zip files are allowed')),
})

// ── Routes ────────────────────────────────────────────────────────────────────

// GET /api/servers
router.get('/', async (req, res) => {
  try {
    const servers = req.serverManager.loadServers()
    res.json(servers)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// GET /api/servers/available-port
router.get('/available-port', async (req, res) => {
  try {
    const usedPorts = new Set(req.serverManager.loadServers().map(s => s.port))
    let port = 25565
    while (port <= 25665) {
      if (!usedPorts.has(port) && await isPortAvailable(port)) return res.json({ port })
      port++
    }
    res.json({ port: 25565 })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// GET /api/servers/versions?type=paper
router.get('/versions', async (req, res) => {
  try {
    const { type } = req.query
    let versions = []
    if (type === 'vanilla') versions = await req.serverManager.getVanillaVersions()
    else if (type === 'paper') versions = await req.serverManager.getPaperVersions()
    else if (type === 'fabric') versions = await req.serverManager.getFabricVersions()
    else return res.status(400).json({ error: 'Invalid type' })
    res.json(versions)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// POST /api/servers/import
router.post('/import', importUpload.single('file'), async (req, res) => {
  const tmpFile = req.file?.path
  try {
    if (!req.file) return res.status(400).json({ error: 'ZIP file is required' })
    const name = (req.body.name || '').trim()
    if (!name) return res.status(400).json({ error: 'Server name is required' })

    const id = uuidv4()
    const serverDir = path.join(__dirname, '..', '..', 'minecraft_servers', id)
    await fs.ensureDir(serverDir)

    // Extract ZIP
    try {
      extractZip(tmpFile, serverDir)
    } catch (extractErr) {
      await fs.remove(serverDir).catch(() => {})
      throw extractErr
    }

    // Clean up tmp file
    await fs.remove(tmpFile)

    // Ensure eula.txt
    const eulaPath = path.join(serverDir, 'eula.txt')
    if (!fs.existsSync(eulaPath)) {
      await fs.writeFile(eulaPath, 'eula=true\n')
    }

    // Read server.properties if present
    let parsedProps = {}
    const propsPath = path.join(serverDir, 'server.properties')
    if (fs.existsSync(propsPath)) {
      parsedProps = parseProperties(await fs.readFile(propsPath, 'utf8'))
    }

    // Resolve fields: form field → parsed prop → hardcoded default
    const port = Number(req.body.port) || Number(parsedProps['server-port']) || 25565
    const maxPlayers = Number(req.body.maxPlayers) || Number(parsedProps['max-players']) || 20
    const minMemory = Number(req.body.minMemory) || 512
    const maxMemory = Number(req.body.maxMemory) || 2048
    const javaPath = (req.body.javaPath || '').trim() || 'java'

    let type = (req.body.type || '').trim()
    if (!type || type === 'auto') type = detectServerType(serverDir)

    let version = (req.body.version || '').trim()
    if (!version) version = detectVersion(serverDir)

    const hasJar = fs.existsSync(path.join(serverDir, 'server.jar'))

    const serverObj = {
      id,
      name,
      type,
      version,
      port,
      maxPlayers,
      minMemory,
      maxMemory,
      javaPath,
      directory: serverDir,
      status: 'stopped',
      createdAt: new Date().toISOString(),
    }

    const servers = req.serverManager.loadServers()
    servers.push(serverObj)
    req.serverManager.saveServers(servers)

    if (!hasJar) {
      req.serverManager.appendLog(id,
        '[CraftPanel] Warning: No server.jar found. Use Settings → Version to download one.')
    }

    req.serverManager.broadcastServerUpdate(id)
    res.status(201).json(serverObj)
  } catch (err) {
    if (tmpFile) await fs.remove(tmpFile).catch(() => {})
    res.status(500).json({ error: err.message })
  }
})

// GET /api/servers/:id
router.get('/:id', (req, res) => {
  const server = req.serverManager.getServer(req.params.id)
  if (!server) return res.status(404).json({ error: 'Not found' })
  res.json(server)
})

// POST /api/servers
router.post('/', async (req, res) => {
  try {
    const { name, type, version, port, minMemory, maxMemory, javaPath, maxPlayers } = req.body
    if (!name || !type || !version) {
      return res.status(400).json({ error: 'name, type, and version are required' })
    }
    const server = await req.serverManager.createServer({ name, type, version, port, minMemory, maxMemory, javaPath, maxPlayers })
    res.status(201).json(server)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// DELETE /api/servers/:id
router.delete('/:id', async (req, res) => {
  try {
    await req.serverManager.deleteServer(req.params.id)
    res.json({ success: true })
  } catch (err) {
    res.status(400).json({ error: err.message })
  }
})

// POST /api/servers/:id/start
router.post('/:id/start', async (req, res) => {
  try {
    await req.serverManager.startServer(req.params.id)
    res.json({ success: true })
  } catch (err) {
    res.status(400).json({ error: err.message })
  }
})

// POST /api/servers/:id/stop
router.post('/:id/stop', async (req, res) => {
  try {
    req.serverManager.stopServer(req.params.id).catch(() => {})
    res.json({ success: true })
  } catch (err) {
    res.status(400).json({ error: err.message })
  }
})

// POST /api/servers/:id/restart
router.post('/:id/restart', async (req, res) => {
  try {
    req.serverManager.restartServer(req.params.id).catch(() => {})
    res.json({ success: true })
  } catch (err) {
    res.status(400).json({ error: err.message })
  }
})

// GET /api/servers/:id/console
router.get('/:id/console', (req, res) => {
  const logs = req.serverManager.getConsoleLogs(req.params.id)
  res.json(logs)
})

// GET /api/servers/:id/players
router.get('/:id/players', (req, res) => {
  const players = req.serverManager.getPlayers(req.params.id)
  res.json(players)
})

// POST /api/servers/:id/change-type
router.post('/:id/change-type', async (req, res) => {
  try {
    const { type, version } = req.body
    if (!['paper', 'vanilla', 'fabric'].includes(type)) {
      return res.status(400).json({ error: 'Invalid type. Must be paper, vanilla, or fabric' })
    }
    if (!version) return res.status(400).json({ error: 'version is required' })

    const server = req.serverManager.getServer(req.params.id)
    if (!server) return res.status(404).json({ error: 'Server not found' })
    if (req.serverManager.isRunning(req.params.id)) {
      return res.status(400).json({ error: 'Stop the server before changing its type' })
    }

    req.serverManager.changeType(req.params.id, type, version).catch(err => {
      console.error(`Failed to change server type: ${err.message}`)
      req.serverManager.updateServer(req.params.id, { status: 'error', errorMessage: err.message })
      req.serverManager.broadcastServerUpdate(req.params.id)
    })

    res.json({ success: true, message: 'Type change started' })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// PATCH /api/servers/:id — update server config (name, memory, java, etc.)
router.patch('/:id', (req, res) => {
  try {
    const allowed = ['name', 'port', 'minMemory', 'maxMemory', 'javaPath', 'maxPlayers', 'idleTimeout']
    const updates = {}
    allowed.forEach(k => { if (req.body[k] !== undefined) updates[k] = req.body[k] })
    const updated = req.serverManager.updateServer(req.params.id, updates)
    if (!updated) return res.status(404).json({ error: 'Not found' })
    req.serverManager.broadcastServerUpdate(req.params.id)
    res.json(updated)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

module.exports = router
