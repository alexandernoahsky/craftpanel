import { useEffect, useRef } from 'react'
import { io } from 'socket.io-client'
import { useAppStore } from '../stores/useAppStore'

let socket = null

export function getSocket() {
  if (!socket) {
    const url = import.meta.env.DEV ? 'http://localhost:3001' : window.location.origin
    socket = io(url, { withCredentials: true })
  }
  return socket
}

export function disconnectSocket() {
  if (socket) {
    socket.disconnect()
    socket = null
  }
}

export function useGlobalSocket() {
  const updateServer = useAppStore(s => s.updateServer)

  useEffect(() => {
    const sock = getSocket()

    sock.on('server-update', (server) => {
      updateServer(server)
    })

    return () => {
      sock.off('server-update')
    }
  }, [updateServer])
}

export function useServerConsole(serverId, onLine) {
  const onLineRef = useRef(onLine)
  onLineRef.current = onLine

  useEffect(() => {
    if (!serverId) return
    const sock = getSocket()

    sock.emit('subscribe-server', serverId)

    function historyHandler({ serverId: sid, logs }) {
      if (sid === serverId) onLineRef.current({ type: 'history', logs })
    }
    function lineHandler(data) {
      if (data.serverId === serverId) onLineRef.current({ type: 'line', ...data })
    }

    sock.on('console-history', historyHandler)
    sock.on('console-line', lineHandler)

    return () => {
      sock.emit('unsubscribe-server', serverId)
      sock.off('console-history', historyHandler)
      sock.off('console-line', lineHandler)
    }
  }, [serverId])
}

export function usePlayersList(serverId, onUpdate) {
  const onUpdateRef = useRef(onUpdate)
  onUpdateRef.current = onUpdate

  useEffect(() => {
    if (!serverId) return
    const sock = getSocket()

    function handler(data) {
      if (data.serverId === serverId) onUpdateRef.current(data.players)
    }

    sock.on('players-update', handler)
    return () => {
      sock.off('players-update', handler)
    }
  }, [serverId])
}

export function sendCommand(serverId, command) {
  const sock = getSocket()
  sock.emit('server-command', { serverId, command })
}
