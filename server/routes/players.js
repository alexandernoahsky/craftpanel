const express = require('express')
const router = express.Router()

// POST /api/players/:id/command — send a player-related command
router.post('/:id/command', (req, res) => {
  try {
    const { command } = req.body
    if (!command) return res.status(400).json({ error: 'command required' })
    req.serverManager.sendCommand(req.params.id, command)
    res.json({ success: true })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

module.exports = router
