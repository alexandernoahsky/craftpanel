const express = require('express')
const router = express.Router()
const path = require('path')
const fs = require('fs-extra')

function parseProperties(content) {
  const props = {}
  content.split('\n').forEach(line => {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) return
    const idx = trimmed.indexOf('=')
    if (idx === -1) return
    const key = trimmed.substring(0, idx).trim()
    const value = trimmed.substring(idx + 1).trim()
    props[key] = value
  })
  return props
}

function serializeProperties(props, original = '') {
  // Preserve comments from original, update values
  const lines = original.split('\n')
  const updated = new Set()

  const result = lines.map(line => {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) return line
    const idx = trimmed.indexOf('=')
    if (idx === -1) return line
    const key = trimmed.substring(0, idx).trim()
    if (props[key] !== undefined) {
      updated.add(key)
      return `${key}=${props[key]}`
    }
    return line
  })

  // Add any new keys not in original
  Object.entries(props).forEach(([k, v]) => {
    if (!updated.has(k)) result.push(`${k}=${v}`)
  })

  return result.join('\n')
}

// GET /api/settings/:id — read server.properties
router.get('/:id', (req, res) => {
  try {
    const server = req.serverManager.getServer(req.params.id)
    if (!server) return res.status(404).json({ error: 'Server not found' })

    const propsPath = path.join(server.directory, 'server.properties')
    if (!fs.existsSync(propsPath)) return res.json({})

    const content = fs.readFileSync(propsPath, 'utf8')
    res.json({ properties: parseProperties(content), raw: content })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// PUT /api/settings/:id — update server.properties
router.put('/:id', (req, res) => {
  try {
    const server = req.serverManager.getServer(req.params.id)
    if (!server) return res.status(404).json({ error: 'Server not found' })

    const propsPath = path.join(server.directory, 'server.properties')
    const original = fs.existsSync(propsPath) ? fs.readFileSync(propsPath, 'utf8') : ''
    const updated = serializeProperties(req.body.properties || {}, original)
    fs.writeFileSync(propsPath, updated)
    res.json({ success: true })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// GET /api/settings/:id/ops — read ops.json
router.get('/:id/ops', (req, res) => {
  try {
    const server = req.serverManager.getServer(req.params.id)
    if (!server) return res.status(404).json({ error: 'Server not found' })
    const opsPath = path.join(server.directory, 'ops.json')
    if (!fs.existsSync(opsPath)) return res.json([])
    res.json(fs.readJsonSync(opsPath))
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// GET /api/settings/:id/whitelist — read whitelist.json
router.get('/:id/whitelist', (req, res) => {
  try {
    const server = req.serverManager.getServer(req.params.id)
    if (!server) return res.status(404).json({ error: 'Server not found' })
    const wlPath = path.join(server.directory, 'whitelist.json')
    if (!fs.existsSync(wlPath)) return res.json([])
    res.json(fs.readJsonSync(wlPath))
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

module.exports = router
