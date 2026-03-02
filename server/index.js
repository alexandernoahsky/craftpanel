const express = require('express')
const http = require('http')
const { Server } = require('socket.io')
const path = require('path')
const fs = require('fs-extra')
const os = require('os')
const session = require('express-session')
const bcrypt = require('bcryptjs')
const cors = require('cors')

const serverManager = require('./serverManager')
const serversRouter = require('./routes/servers')
const modsRouter = require('./routes/mods')
const settingsRouter = require('./routes/settings')
const playersRouter = require('./routes/players')
const backupRouter = require('./routes/backup')

const app = express()
const server = http.createServer(app)
const io = new Server(server, {
  cors: {
    origin: process.env.NODE_ENV === 'production' ? false : 'http://localhost:5173',
    credentials: true,
  },
})

// ── Config ──────────────────────────────────────────────────────────────────
const DATA_DIR = path.join(__dirname, 'data')
const CONFIG_PATH = path.join(DATA_DIR, 'config.json')
const PORT = process.env.PORT || 3001

fs.ensureDirSync(DATA_DIR)

function loadConfig() {
  if (!fs.existsSync(CONFIG_PATH)) {
    return { passwordHash: null, sessionSecret: null }
  }
  return fs.readJsonSync(CONFIG_PATH)
}

function saveConfig(config) {
  fs.writeJsonSync(CONFIG_PATH, config, { spaces: 2 })
}

// Persist session secret so restarts don't invalidate existing sessions
const cfg = loadConfig()
if (!cfg.sessionSecret) {
  cfg.sessionSecret = 'craftpanel-' + require('crypto').randomBytes(32).toString('hex')
  saveConfig(cfg)
}
const SESSION_SECRET = process.env.SESSION_SECRET || cfg.sessionSecret

// ── Middleware ───────────────────────────────────────────────────────────────
const sessionMiddleware = session({
  secret: SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: { httpOnly: true, maxAge: 7 * 24 * 60 * 60 * 1000 },
})

app.use(sessionMiddleware)
app.use(express.json())

if (process.env.NODE_ENV !== 'production') {
  app.use(cors({ origin: 'http://localhost:5173', credentials: true }))
}

// ── Auth middleware ──────────────────────────────────────────────────────────
function requireAuth(req, res, next) {
  const config = loadConfig()
  // If no password is set yet, allow access to set it up
  if (!config.passwordHash) return next()
  if (req.session && req.session.authenticated) return next()
  res.status(401).json({ error: 'Unauthorized' })
}

// ── Auth routes ──────────────────────────────────────────────────────────────
app.post('/api/auth/login', (req, res) => {
  const { username, password } = req.body
  const config = loadConfig()

  if (!config.passwordHash) {
    // First-time setup: set the username and password
    if (!username || !password) return res.status(400).json({ error: 'Username and password required' })
    const hash = bcrypt.hashSync(password, 10)
    saveConfig({ ...config, username, passwordHash: hash })
    req.session.authenticated = true
    return res.json({ success: true, firstTime: true })
  }

  if (username !== config.username || !bcrypt.compareSync(password, config.passwordHash)) {
    return res.status(401).json({ error: 'Invalid username or password' })
  }

  req.session.authenticated = true
  res.json({ success: true })
})

app.post('/api/auth/logout', (req, res) => {
  req.session.destroy()
  res.json({ success: true })
})

app.get('/api/auth/status', (req, res) => {
  const config = loadConfig()
  res.json({
    authenticated: !!(req.session && req.session.authenticated),
    needsSetup: !config.passwordHash,
    username: config.username || null,
  })
})

app.post('/api/auth/change-password', requireAuth, (req, res) => {
  const { currentPassword, newPassword } = req.body
  const config = loadConfig()

  if (config.passwordHash && !bcrypt.compareSync(currentPassword, config.passwordHash)) {
    return res.status(401).json({ error: 'Current password is incorrect' })
  }

  const hash = bcrypt.hashSync(newPassword, 10)
  saveConfig({ ...config, passwordHash: hash })
  res.json({ success: true })
})

// ── System stats ─────────────────────────────────────────────────────────────
let prevNetSnapshot = null

function readNetBytes() {
  if (process.platform !== 'linux') return null
  try {
    const raw = fs.readFileSync('/proc/net/dev', 'utf8')
    let rx = 0, tx = 0
    for (const line of raw.split('\n').slice(2)) {
      const cols = line.trim().split(/\s+/)
      if (cols.length < 10) continue
      const iface = cols[0].replace(':', '')
      if (iface === 'lo') continue  // skip loopback
      rx += parseInt(cols[1]) || 0
      tx += parseInt(cols[9]) || 0
    }
    return { rx, tx }
  } catch { return null }
}

app.get('/api/system/stats', requireAuth, (req, res) => {
  const total = os.totalmem()
  const free  = os.freemem()
  const used  = total - free

  let network = { rxPerSec: 0, txPerSec: 0, supported: false }
  const bytes = readNetBytes()
  const now   = Date.now()

  if (bytes) {
    network.supported = true
    if (prevNetSnapshot) {
      const dt = (now - prevNetSnapshot.time) / 1000
      if (dt > 0) {
        network.rxPerSec = Math.max(0, (bytes.rx - prevNetSnapshot.rx) / dt)
        network.txPerSec = Math.max(0, (bytes.tx - prevNetSnapshot.tx) / dt)
      }
    }
    prevNetSnapshot = { rx: bytes.rx, tx: bytes.tx, time: now }
  }

  res.json({ ram: { total, used, free }, network })
})

// ── API routes ───────────────────────────────────────────────────────────────
app.use((req, res, next) => {
  req.io = io
  req.serverManager = serverManager
  next()
})

app.use('/api/servers', requireAuth, serversRouter)
app.use('/api/mods', requireAuth, modsRouter)
app.use('/api/settings', requireAuth, settingsRouter)
app.use('/api/players', requireAuth, playersRouter)
app.use('/api/backup', requireAuth, backupRouter)

// ── Serve frontend ───────────────────────────────────────────────────────────
if (process.env.NODE_ENV === 'production') {
  const distPath = path.join(__dirname, '..', 'dist')
  app.use(express.static(distPath))
  app.get('*', (req, res) => {
    res.sendFile(path.join(distPath, 'index.html'))
  })
}

// ── Socket.io ────────────────────────────────────────────────────────────────
// Share express session with socket.io
const wrap = middleware => (socket, next) => middleware(socket.request, {}, next)
io.use(wrap(sessionMiddleware))

io.use((socket, next) => {
  const config = loadConfig()
  if (!config.passwordHash) return next()
  if (socket.request.session && socket.request.session.authenticated) return next()
  next(new Error('Unauthorized'))
})

io.on('connection', (socket) => {
  socket.on('subscribe-server', (serverId) => {
    socket.join(`server-${serverId}`)
    // Send recent logs to newly connected client
    const logs = serverManager.getConsoleLogs(serverId)
    socket.emit('console-history', { serverId, logs })
  })

  socket.on('unsubscribe-server', (serverId) => {
    socket.leave(`server-${serverId}`)
  })

  socket.on('server-command', ({ serverId, command }) => {
    serverManager.sendCommand(serverId, command)
  })
})

serverManager.setIo(io)

// ── Start ────────────────────────────────────────────────────────────────────
server.listen(PORT, () => {
  const config = loadConfig()
  console.log(`\n🟢 CraftPanel running on http://localhost:${PORT}`)
  if (!config.passwordHash) {
    console.log('⚠️  No password set — you will be prompted to create one on first login.\n')
  }
})
