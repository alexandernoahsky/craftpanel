const { spawn } = require('child_process')
const net = require('net')
const path = require('path')
const fs = require('fs-extra')
const { v4: uuidv4 } = require('uuid')
const axios = require('axios')

// ── Minecraft protocol helpers (for wake proxy) ───────────────────────────────
function readVarInt(buf, offset) {
  let result = 0, shift = 0, pos = offset, byte
  do {
    if (pos >= buf.length) return { value: -1, newOffset: pos }
    byte = buf[pos++]
    result |= (byte & 0x7F) << shift
    shift += 7
  } while (byte & 0x80)
  return { value: result, newOffset: pos }
}

function writeVarInt(value) {
  const bytes = []
  do {
    let byte = value & 0x7F
    value >>>= 7
    if (value !== 0) byte |= 0x80
    bytes.push(byte)
  } while (value !== 0)
  return Buffer.from(bytes)
}

function writeMcString(str) {
  const encoded = Buffer.from(str, 'utf8')
  return Buffer.concat([writeVarInt(encoded.length), encoded])
}

function buildMcPacket(id, payload) {
  const body = payload ? Buffer.concat([writeVarInt(id), payload]) : writeVarInt(id)
  return Buffer.concat([writeVarInt(body.length), body])
}

const DATA_DIR = path.join(__dirname, 'data')
const SERVERS_FILE = path.join(DATA_DIR, 'servers.json')
const SERVERS_DIR = path.join(__dirname, '..', 'minecraft_servers')

fs.ensureDirSync(DATA_DIR)
fs.ensureDirSync(SERVERS_DIR)

if (!fs.existsSync(SERVERS_FILE)) {
  fs.writeJsonSync(SERVERS_FILE, { servers: [] }, { spaces: 2 })
}

class ServerManager {
  constructor() {
    this.processes = new Map()    // serverId -> ChildProcess
    this.consoleLogs = new Map()  // serverId -> { text, time }[]
    this.players = new Map()      // serverId -> Set<string>
    this.idleTimers = new Map()   // serverId -> Timeout (hibernate countdown)
    this.sleepingServers = new Set() // servers being stopped for hibernation
    this.wakeProxies = new Map()  // serverId -> { server: net.Server, sockets: Set }
    this.startingServers = new Set() // guards against concurrent startServer calls
    this.io = null
    this.maxLogLines = 1000
  }

  setIo(io) {
    this.io = io
  }

  // ── Data persistence ──────────────────────────────────────────────────────
  loadServers() {
    return fs.readJsonSync(SERVERS_FILE).servers
  }

  saveServers(servers) {
    fs.writeJsonSync(SERVERS_FILE, { servers }, { spaces: 2 })
  }

  getServer(id) {
    return this.loadServers().find(s => s.id === id)
  }

  updateServer(id, updates) {
    const servers = this.loadServers()
    const idx = servers.findIndex(s => s.id === id)
    if (idx === -1) return null
    servers[idx] = { ...servers[idx], ...updates }
    this.saveServers(servers)
    return servers[idx]
  }

  // ── Console logs ──────────────────────────────────────────────────────────
  getConsoleLogs(serverId) {
    return this.consoleLogs.get(serverId) || []
  }

  appendLog(serverId, line) {
    if (!this.consoleLogs.has(serverId)) {
      this.consoleLogs.set(serverId, [])
    }
    const logs = this.consoleLogs.get(serverId)
    const entry = { text: line, time: new Date().toISOString() }
    logs.push(entry)
    if (logs.length > this.maxLogLines) logs.shift()
    if (this.io) {
      this.io.to(`server-${serverId}`).emit('console-line', { serverId, ...entry })
    }
  }

  // ── Player tracking ───────────────────────────────────────────────────────
  getPlayers(serverId) {
    return Array.from(this.players.get(serverId) || [])
  }

  parsePlayerEvent(serverId, line) {
    // Pattern: "PlayerName joined the game"
    const joinMatch = line.match(/:\s+(\w+)\s+joined the game/)
    // Pattern: "PlayerName[/ip] logged in with entity id..."
    const loginMatch = line.match(/:\s+(\w+)\[.*\] logged in/)
    // Pattern: "PlayerName left the game"
    const leaveMatch = line.match(/:\s+(\w+)\s+left the game/)
    // Pattern: "PlayerName lost connection: ..."
    const lostMatch = line.match(/:\s+(\w+) lost connection:/)
    // Pattern: "PlayerName was kicked from the game: ..."
    const kickedMatch = line.match(/:\s+(\w+) was kicked from the game:/)

    const joining = joinMatch?.[1] || loginMatch?.[1]
    const leaving = leaveMatch?.[1] || lostMatch?.[1] || kickedMatch?.[1]

    if (!this.players.has(serverId)) {
      this.players.set(serverId, new Set())
    }
    const set = this.players.get(serverId)
    let changed = false

    if (joining) {
      set.add(joining)
      changed = true
    }
    if (leaving) {
      set.delete(leaving)
      changed = true
    }

    if (changed) {
      const server = this.getServer(serverId)
      if (server) {
        const count = set.size
        this.updateServer(serverId, { playerCount: count })
        this.broadcastServerUpdate(serverId)
      }
      // Broadcast player list update to all clients
      if (this.io) {
        this.io.emit('players-update', {
          serverId,
          players: Array.from(set),
        })
      }
      // Idle hibernate: start countdown when server empties, cancel when someone joins
      if (set.size === 0) {
        const srv = this.getServer(serverId)
        if (srv?.status === 'running') this.scheduleIdleStop(serverId)
      } else {
        this.cancelIdleStop(serverId)
      }
    }

    // Parse "list" command response: "There are N of a max of M players online: p1, p2"
    const listMatch = line.match(/There are (\d+) of a max of \d+ players online:(.*)/)
    if (listMatch) {
      const names = listMatch[2].trim()
      if (names) {
        names.split(',').map(n => n.trim()).filter(Boolean).forEach(n => set.add(n))
      } else {
        set.clear()
      }
      if (this.io) {
        this.io.emit('players-update', {
          serverId,
          players: Array.from(set),
        })
      }
    }
  }

  // ── Server CRUD ───────────────────────────────────────────────────────────
  async createServer({ name, type, version, port, minMemory, maxMemory, javaPath, maxPlayers }) {
    const id = uuidv4()
    const directory = path.join(SERVERS_DIR, id)
    fs.ensureDirSync(directory)

    const serverObj = {
      id,
      name,
      type,
      version,
      port: port || 25565,
      minMemory: minMemory || 1024,
      maxMemory: maxMemory || 2048,
      javaPath: javaPath || 'java',
      directory,
      status: 'installing',
      createdAt: new Date().toISOString(),
      playerCount: 0,
      maxPlayers: maxPlayers || 20,
    }

    const servers = this.loadServers()
    servers.push(serverObj)
    this.saveServers(servers)

    this.downloadAndInstall(serverObj).catch(err => {
      console.error(`Failed to install server ${id}:`, err.message)
      this.updateServer(id, { status: 'error', errorMessage: err.message })
      this.broadcastServerUpdate(id)
    })

    return serverObj
  }

  async getJarUrl(type, version) {
    if (type === 'paper') return this.getPaperUrl(version)
    if (type === 'vanilla') return this.getVanillaUrl(version)
    if (type === 'fabric') return this.getFabricUrl(version)
    throw new Error(`Unsupported server type for auto-download: ${type}`)
  }

  async downloadJar(url, jarPath) {
    const response = await axios({ url, responseType: 'stream', timeout: 180000 })
    const writer = fs.createWriteStream(jarPath)
    response.data.pipe(writer)
    await new Promise((resolve, reject) => {
      writer.on('finish', resolve)
      writer.on('error', reject)
      response.data.on('error', reject)
    })
  }

  async downloadAndInstall(server) {
    this.appendLog(server.id, `[CraftPanel] Starting installation of ${server.type} ${server.version}...`)
    this.broadcastServerUpdate(server.id)

    if (server.type === 'forge') {
      throw new Error('Forge installer must be run manually. Download from https://files.minecraftforge.net/')
    }

    const jarPath = path.join(server.directory, 'server.jar')
    const downloadUrl = await this.getJarUrl(server.type, server.version)
    this.appendLog(server.id, `[CraftPanel] Downloading from ${downloadUrl}`)
    await this.downloadJar(downloadUrl, jarPath)

    fs.writeFileSync(path.join(server.directory, 'eula.txt'), 'eula=true\n')
    fs.writeFileSync(path.join(server.directory, 'server.properties'), this.defaultServerProperties(server))

    this.appendLog(server.id, '[CraftPanel] Installation complete! Server is ready to start.')
    this.updateServer(server.id, { status: 'stopped' })
    this.broadcastServerUpdate(server.id)
  }

  async changeType(serverId, newType, newVersion) {
    const server = this.getServer(serverId)
    if (!server) throw new Error('Server not found')
    if (this.processes.has(serverId)) throw new Error('Stop the server before changing its type')

    this.appendLog(serverId, `[CraftPanel] Changing server type to ${newType} ${newVersion}...`)
    this.updateServer(serverId, { status: 'installing' })
    this.broadcastServerUpdate(serverId)

    const jarPath = path.join(server.directory, 'server.jar')
    if (fs.existsSync(jarPath)) fs.removeSync(jarPath)

    const downloadUrl = await this.getJarUrl(newType, newVersion)
    this.appendLog(serverId, `[CraftPanel] Downloading ${newType} ${newVersion} from ${downloadUrl}`)
    await this.downloadJar(downloadUrl, jarPath)

    this.updateServer(serverId, { type: newType, version: newVersion, status: 'stopped' })
    this.broadcastServerUpdate(serverId)
    this.appendLog(serverId, `[CraftPanel] Server type changed to ${newType} ${newVersion}. Ready to start.`)
  }

  defaultServerProperties(server) {
    return `#Minecraft server properties
server-port=${server.port}
max-players=${server.maxPlayers || 20}
gamemode=survival
difficulty=easy
level-name=world
motd=A Minecraft Server managed by CraftPanel
online-mode=true
pvp=true
spawn-protection=16
view-distance=10
simulation-distance=10
enable-command-block=false
allow-flight=false
prevent-proxy-connections=false
enable-rcon=false
rcon.password=
rcon.port=25575
rate-limit=0
hide-online-players=false
`
  }

  async deleteServer(id) {
    const server = this.getServer(id)
    if (!server) throw new Error('Server not found')
    if (this.processes.has(id)) throw new Error('Stop the server before deleting it')

    this.cancelIdleStop(id)
    await this.stopWakeProxy(id)
    await fs.remove(server.directory)
    const servers = this.loadServers().filter(s => s.id !== id)
    this.saveServers(servers)
    this.consoleLogs.delete(id)
    this.players.delete(id)
  }

  // ── Process management ────────────────────────────────────────────────────
  async startServer(id) {
    const server = this.getServer(id)
    if (!server) throw new Error('Server not found')
    if (this.processes.has(id)) throw new Error('Server is already running')
    if (this.startingServers.has(id)) throw new Error('Server is already starting')
    if (server.status === 'installing') throw new Error('Server is still being installed')

    const jarPath = path.join(server.directory, 'server.jar')
    if (!fs.existsSync(jarPath)) throw new Error('server.jar not found')

    const args = [
      `-Xms${server.minMemory}M`,
      `-Xmx${server.maxMemory}M`,
      '-jar', 'server.jar',
      '--nogui',
    ]

    this.startingServers.add(id)
    this.cancelIdleStop(id)
    this.sleepingServers.delete(id)
    await this.stopWakeProxy(id)
    this.appendLog(id, `[CraftPanel] Starting server: ${server.javaPath} ${args.join(' ')}`)
    this.updateServer(id, { status: 'starting', playerCount: 0 })
    this.players.set(id, new Set())
    this.broadcastServerUpdate(id)

    const proc = spawn(server.javaPath, args, {
      cwd: server.directory,
      stdio: ['pipe', 'pipe', 'pipe'],
    })

    this.startingServers.delete(id)
    this.processes.set(id, proc)

    const handleLine = (line) => {
      this.appendLog(id, line)
      if (line.includes('Done (') && line.includes('For help, type')) {
        this.updateServer(id, { status: 'running' })
        this.broadcastServerUpdate(id)
      }
      this.parsePlayerEvent(id, line)
    }

    let stdoutBuf = ''
    proc.stdout.on('data', (data) => {
      stdoutBuf += data.toString()
      const lines = stdoutBuf.split('\n')
      stdoutBuf = lines.pop()
      lines.filter(l => l.trim()).forEach(handleLine)
    })

    let stderrBuf = ''
    proc.stderr.on('data', (data) => {
      stderrBuf += data.toString()
      const lines = stderrBuf.split('\n')
      stderrBuf = lines.pop()
      lines.filter(l => l.trim()).forEach(l => this.appendLog(id, l))
    })

    proc.on('exit', (code) => {
      this.processes.delete(id)
      this.players.set(id, new Set())
      this.appendLog(id, `[CraftPanel] Server process exited with code ${code}`)
      const finalStatus = this.sleepingServers.has(id) ? 'sleeping' : 'stopped'
      this.sleepingServers.delete(id)
      this.updateServer(id, { status: finalStatus, playerCount: 0 })
      this.broadcastServerUpdate(id)
      if (finalStatus === 'sleeping') this.startWakeProxy(id)
    })

    proc.on('error', (err) => {
      this.startingServers.delete(id)
      this.processes.delete(id)
      this.players.set(id, new Set())
      this.appendLog(id, `[CraftPanel] Failed to start: ${err.message}`)
      this.updateServer(id, { status: 'error', errorMessage: err.message })
      this.broadcastServerUpdate(id)
    })
  }

  async stopServer(id) {
    const proc = this.processes.get(id)
    if (!proc) throw new Error('Server is not running')

    this.cancelIdleStop(id)
    this.appendLog(id, '[CraftPanel] Sending stop command...')
    this.updateServer(id, { status: 'stopping' })
    this.broadcastServerUpdate(id)

    proc.stdin.write('stop\n')

    return new Promise((resolve) => {
      const timeout = setTimeout(() => {
        if (this.processes.has(id)) {
          this.appendLog(id, '[CraftPanel] Force killing server after timeout...')
          proc.kill('SIGKILL')
        }
        resolve()
      }, 30000)

      proc.on('exit', () => {
        clearTimeout(timeout)
        resolve()
      })
    })
  }

  async restartServer(id) {
    if (this.processes.has(id)) {
      await this.stopServer(id)
      await new Promise(r => setTimeout(r, 2000))
    }
    await this.startServer(id)
  }

  sendCommand(id, command) {
    const proc = this.processes.get(id)
    if (!proc) return false
    proc.stdin.write(command + '\n')
    this.appendLog(id, `> ${command}`)
    return true
  }

  isRunning(id) {
    return this.processes.has(id)
  }

  broadcastServerUpdate(id) {
    if (!this.io) return
    const server = this.getServer(id)
    if (server) {
      this.io.emit('server-update', server)
    }
  }

  // ── Idle hibernation ──────────────────────────────────────────────────────
  scheduleIdleStop(id) {
    const server = this.getServer(id)
    const minutes = Number(server?.idleTimeout) || 0
    if (!minutes || minutes <= 0) return
    this.cancelIdleStop(id)
    this.idleTimers.set(id, setTimeout(async () => {
      this.idleTimers.delete(id)
      if (!this.processes.has(id)) return
      const players = this.players.get(id)
      if (players && players.size > 0) return
      this.appendLog(id, `[CraftPanel] No players for ${minutes} minute(s). Hibernating to save RAM...`)
      this.sleepingServers.add(id)
      await this.stopServer(id).catch(() => {})
    }, minutes * 60 * 1000))
  }

  cancelIdleStop(id) {
    if (this.idleTimers.has(id)) {
      clearTimeout(this.idleTimers.get(id))
      this.idleTimers.delete(id)
    }
  }

  // ── Wake proxy ─────────────────────────────────────────────────────────────
  // Listens on the MC port while sleeping. Any login attempt wakes the server
  // and receives a "reconnect in ~30s" disconnect. Status pings show "Waking up".
  startWakeProxy(id) {
    if (this.wakeProxies.has(id)) return
    const server = this.getServer(id)
    if (!server) return

    const sockets = new Set()
    const proxy = net.createServer(socket => {
      sockets.add(socket)
      socket.on('close', () => sockets.delete(socket))
      socket.on('error', () => {})
      socket.setTimeout(8000, () => socket.destroy())

      let buf = Buffer.alloc(0)
      let handled = false

      socket.on('data', chunk => {
        if (handled) return
        buf = Buffer.concat([buf, chunk])

        // Parse handshake packet to find next_state
        let pos = 0
        const pktLen = readVarInt(buf, pos); if (pktLen.value < 0) return; pos = pktLen.newOffset
        const pktId  = readVarInt(buf, pos); if (pktId.value !== 0x00) { socket.destroy(); handled = true; return }; pos = pktId.newOffset
        const proto  = readVarInt(buf, pos); if (proto.value < 0) return; pos = proto.newOffset
        const addrLen = readVarInt(buf, pos); if (addrLen.value < 0) return; pos = addrLen.newOffset
        if (buf.length < pos + addrLen.value + 3) return // wait for more data
        pos += addrLen.value + 2 // skip address string + port (u16)
        const nextState = readVarInt(buf, pos); if (nextState.value < 0) return
        handled = true

        if (nextState.value === 1) {
          // Status ping — show "Waking up" MOTD
          socket.removeAllListeners('data')
          socket.once('data', () => {
            const statusJson = JSON.stringify({
              version: { name: 'Waking up...', protocol: proto.value },
              players: { max: server.maxPlayers || 20, online: 0, sample: [] },
              description: { text: `\u26a1 ${server.name} is waking up...` },
            })
            socket.write(buildMcPacket(0x00, writeMcString(statusJson)))
            socket.once('data', () => socket.destroy()) // ignore ping packet
          })
        } else if (nextState.value === 2) {
          // Login attempt — wake the server, send disconnect message
          this.appendLog(id, '[CraftPanel] Wake proxy: player connecting, waking server...')
          socket.removeAllListeners('data')
          socket.once('data', () => {
            const msg = JSON.stringify({ text: `\u26a1 ${server.name} is waking up! Please reconnect in ~30 seconds.`, color: 'yellow' })
            socket.write(buildMcPacket(0x00, writeMcString(msg)))
            setTimeout(() => socket.destroy(), 500)
          })
          // Start the server (stopWakeProxy is called inside startServer)
          this.startServer(id).catch(() => {})
        } else {
          socket.destroy()
        }
      })
    })

    proxy.on('error', err => {
      this.appendLog(id, `[CraftPanel] Wake proxy error on :${server.port} — ${err.message}`)
      this.wakeProxies.delete(id)
    })

    proxy.listen(server.port, () => {
      this.appendLog(id, `[CraftPanel] Wake proxy active on :${server.port} — connect to wake.`)
    })

    this.wakeProxies.set(id, { server: proxy, sockets })
  }

  stopWakeProxy(id) {
    return new Promise(resolve => {
      const entry = this.wakeProxies.get(id)
      if (!entry) return resolve()
      this.wakeProxies.delete(id)
      for (const s of entry.sockets) s.destroy()
      entry.server.close(resolve)
    })
  }

  // ── Version APIs ──────────────────────────────────────────────────────────
  async getVanillaVersions() {
    const res = await axios.get('https://launchermeta.mojang.com/mc/game/version_manifest_v2.json', { timeout: 10000 })
    return res.data.versions.filter(v => v.type === 'release').map(v => v.id).slice(0, 50)
  }

  async getPaperVersions() {
    const res = await axios.get('https://api.papermc.io/v2/projects/paper', { timeout: 10000 })
    return res.data.versions.filter(v => /^\d+\.\d+(\.\d+)?$/.test(v)).reverse().slice(0, 50)
  }

  async getFabricVersions() {
    const res = await axios.get('https://meta.fabricmc.net/v2/versions/game', { timeout: 10000 })
    return res.data.filter(v => v.stable).map(v => v.version).slice(0, 50)
  }

  async getVanillaUrl(version) {
    const manifest = await axios.get('https://launchermeta.mojang.com/mc/game/version_manifest_v2.json', { timeout: 10000 })
    const entry = manifest.data.versions.find(v => v.id === version)
    if (!entry) throw new Error(`Vanilla version ${version} not found`)
    const versionData = await axios.get(entry.url, { timeout: 10000 })
    const serverInfo = versionData.data.downloads?.server
    if (!serverInfo) throw new Error(`No server jar available for ${version}`)
    return serverInfo.url
  }

  async getPaperUrl(version) {
    const buildsRes = await axios.get(`https://api.papermc.io/v2/projects/paper/versions/${version}/builds`, { timeout: 10000 })
    const builds = buildsRes.data.builds.filter(b => b.channel === 'default' || b.channel === 'experimental')
    const latestBuild = builds[builds.length - 1]
    const fileName = latestBuild.downloads.application.name
    return `https://api.papermc.io/v2/projects/paper/versions/${version}/builds/${latestBuild.build}/downloads/${fileName}`
  }

  async getFabricUrl(version) {
    const loaders = await axios.get(`https://meta.fabricmc.net/v2/versions/loader/${version}`, { timeout: 10000 })
    const loaderVersion = loaders.data[0].loader.version
    const installers = await axios.get('https://meta.fabricmc.net/v2/versions/installer', { timeout: 10000 })
    const installerVersion = installers.data[0].version
    return `https://meta.fabricmc.net/v2/versions/loader/${version}/${loaderVersion}/${installerVersion}/server/jar`
  }
}

module.exports = new ServerManager()
