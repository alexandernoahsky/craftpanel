const express = require('express')
const router = express.Router()
const path = require('path')
const fs = require('fs-extra')
const axios = require('axios')
const multer = require('multer')
const AdmZip = require('adm-zip')

const MODRINTH_API = 'https://api.modrinth.com/v2'

// Determine the Modrinth project_type and loader facets from server type
function getModrinthFacets(serverType, gameVersion) {
  const facets = []

  if (serverType === 'paper' || serverType === 'spigot' || serverType === 'bukkit') {
    // Paper servers use Bukkit plugins
    facets.push(['project_type:plugin'])
    facets.push(['categories:paper', 'categories:spigot', 'categories:bukkit', 'categories:purpur'])
  } else if (serverType === 'fabric') {
    facets.push(['project_type:mod'])
    facets.push(['categories:fabric'])
  } else if (serverType === 'forge') {
    facets.push(['project_type:mod'])
    facets.push(['categories:forge'])
  } else {
    // vanilla — datapacks or show all mods
    facets.push(['project_type:mod', 'project_type:plugin', 'project_type:datapack'])
  }

  if (gameVersion) {
    facets.push([`versions:${gameVersion}`])
  }

  return facets
}

// GET /api/mods/search?query=&game_version=&loader=&offset=&server_type=&category=&sort=
router.get('/search', async (req, res) => {
  try {
    const { query = '', game_version, server_type, offset = 0, category, sort } = req.query
    const facets = getModrinthFacets(server_type, game_version)

    if (category) {
      facets.push([`categories:${category}`])
    }

    const params = {
      query,
      facets: JSON.stringify(facets),
      limit: 20,
      offset: Number(offset),
      index: sort || 'relevance',
    }

    const { data } = await axios.get(`${MODRINTH_API}/search`, { params, timeout: 15000 })
    res.json(data)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// GET /api/mods/project/:slug
router.get('/project/:slug', async (req, res) => {
  try {
    const [projectRes, versionsRes] = await Promise.all([
      axios.get(`${MODRINTH_API}/project/${req.params.slug}`, { timeout: 10000 }),
      axios.get(`${MODRINTH_API}/project/${req.params.slug}/version`, { timeout: 10000 }),
    ])
    res.json({ project: projectRes.data, versions: versionsRes.data })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// GET /api/mods/server/:id — list installed mods
router.get('/server/:id', (req, res) => {
  try {
    const server = req.serverManager.getServer(req.params.id)
    if (!server) return res.status(404).json({ error: 'Server not found' })

    const modsDir = path.join(server.directory, 'mods')
    if (!fs.existsSync(modsDir)) return res.json([])

    const files = fs.readdirSync(modsDir).filter(f => f.endsWith('.jar'))
    const mods = files.map(f => {
      const stat = fs.statSync(path.join(modsDir, f))
      return { filename: f, size: stat.size, installedAt: stat.mtime }
    })
    res.json(mods)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// POST /api/mods/server/:id/install — download from Modrinth
router.post('/server/:id/install', async (req, res) => {
  try {
    const { versionId } = req.body
    if (!versionId) return res.status(400).json({ error: 'versionId required' })

    const server = req.serverManager.getServer(req.params.id)
    if (!server) return res.status(404).json({ error: 'Server not found' })

    const modsDir = path.join(server.directory, 'mods')
    fs.ensureDirSync(modsDir)

    const versionRes = await axios.get(`${MODRINTH_API}/version/${versionId}`, { timeout: 10000 })
    const versionData = versionRes.data
    const primaryFile = versionData.files.find(f => f.primary) || versionData.files[0]
    if (!primaryFile) return res.status(400).json({ error: 'No downloadable file found' })

    const destPath = path.join(modsDir, primaryFile.filename)
    const response = await axios({ url: primaryFile.url, responseType: 'stream', timeout: 120000 })
    const writer = fs.createWriteStream(destPath)
    response.data.pipe(writer)
    await new Promise((resolve, reject) => {
      writer.on('finish', resolve)
      writer.on('error', reject)
    })

    res.json({ success: true, filename: primaryFile.filename })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// POST /api/mods/server/:id/upload — upload a .jar or .zip file manually
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 100 * 1024 * 1024 }, // 100MB
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase()
    if (ext === '.jar' || ext === '.zip') return cb(null, true)
    cb(new Error('Only .jar and .zip files are allowed'))
  },
})

router.post('/server/:id/upload', upload.single('file'), async (req, res) => {
  try {
    const server = req.serverManager.getServer(req.params.id)
    if (!server) return res.status(404).json({ error: 'Server not found' })
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' })

    const modsDir = path.join(server.directory, 'mods')
    fs.ensureDirSync(modsDir)

    const ext = path.extname(req.file.originalname).toLowerCase()
    const installed = []

    if (ext === '.jar') {
      const dest = path.join(modsDir, req.file.originalname)
      fs.writeFileSync(dest, req.file.buffer)
      installed.push(req.file.originalname)
    } else if (ext === '.zip') {
      // Extract all .jar files from the zip
      const zip = new AdmZip(req.file.buffer)
      const entries = zip.getEntries()
      for (const entry of entries) {
        if (!entry.isDirectory && entry.entryName.endsWith('.jar')) {
          const filename = path.basename(entry.entryName)
          zip.extractEntryTo(entry, modsDir, false, true)
          installed.push(filename)
        }
      }
      if (installed.length === 0) {
        return res.status(400).json({ error: 'No .jar files found in the zip' })
      }
    }

    res.json({ success: true, installed })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// DELETE /api/mods/server/:id/:filename
router.delete('/server/:id/:filename', (req, res) => {
  try {
    const server = req.serverManager.getServer(req.params.id)
    if (!server) return res.status(404).json({ error: 'Server not found' })

    const filePath = path.join(server.directory, 'mods', req.params.filename)
    if (!fs.existsSync(filePath)) return res.status(404).json({ error: 'File not found' })

    fs.removeSync(filePath)
    res.json({ success: true })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

module.exports = router
