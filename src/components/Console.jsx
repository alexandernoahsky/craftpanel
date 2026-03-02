import { useEffect, useRef, useState, useCallback } from 'react'
import { Terminal, Send, Trash2, ChevronDown } from 'lucide-react'
import { useServerConsole, sendCommand } from '../hooks/useSocket'
import { useTranslation } from 'react-i18next'
import clsx from 'clsx'

function colorize(text) {
  // Basic Minecraft log level coloring
  if (text.includes('[ERROR]') || text.includes('ERROR') || text.includes('Exception')) {
    return 'text-red-400'
  }
  if (text.includes('[WARN]') || text.includes('WARN')) {
    return 'text-yellow-400'
  }
  if (text.includes('[CraftPanel]')) {
    return 'text-blue-400'
  }
  if (text.startsWith('>')) {
    return 'text-brand-400'
  }
  if (text.includes('Done (') || text.includes('logged in') || text.includes('joined the game')) {
    return 'text-brand-400'
  }
  if (text.includes('lost connection') || text.includes('left the game')) {
    return 'text-orange-400'
  }
  return 'text-gray-300 dark:text-gray-300'
}

export default function Console({ serverId, serverStatus }) {
  const { t } = useTranslation()
  const [lines, setLines] = useState([])
  const [command, setCommand] = useState('')
  const [history, setHistory] = useState([])
  const [historyIdx, setHistoryIdx] = useState(-1)
  const [autoScroll, setAutoScroll] = useState(true)
  const bottomRef = useRef(null)
  const containerRef = useRef(null)
  const inputRef = useRef(null)

  const isRunning = serverStatus === 'running' || serverStatus === 'starting'

  const handleEvent = useCallback((event) => {
    if (event.type === 'history') {
      setLines(event.logs || [])
    } else if (event.type === 'line') {
      setLines(prev => {
        const next = [...prev, { text: event.text, time: event.time }]
        return next.slice(-500) // keep last 500 lines
      })
    }
  }, [])

  useServerConsole(serverId, handleEvent)

  // Auto-scroll
  useEffect(() => {
    if (autoScroll && bottomRef.current) {
      bottomRef.current.scrollIntoView({ behavior: 'smooth' })
    }
  }, [lines, autoScroll])

  function handleScroll() {
    const el = containerRef.current
    if (!el) return
    const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 40
    setAutoScroll(atBottom)
  }

  function handleSubmit(e) {
    e.preventDefault()
    const cmd = command.trim()
    if (!cmd || !isRunning) return
    sendCommand(serverId, cmd)
    setHistory(h => [cmd, ...h.slice(0, 99)])
    setCommand('')
    setHistoryIdx(-1)
  }

  function handleKeyDown(e) {
    if (e.key === 'ArrowUp') {
      e.preventDefault()
      const next = Math.min(historyIdx + 1, history.length - 1)
      setHistoryIdx(next)
      setCommand(history[next] || '')
    } else if (e.key === 'ArrowDown') {
      e.preventDefault()
      const next = Math.max(historyIdx - 1, -1)
      setHistoryIdx(next)
      setCommand(next === -1 ? '' : history[next])
    }
  }

  return (
    <div className="flex flex-col h-full bg-gray-950 rounded-xl border border-gray-800 overflow-hidden">
      {/* Toolbar */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-gray-800 bg-gray-900">
        <div className="flex items-center gap-2 text-sm text-gray-400">
          <Terminal size={14} />
          <span>{t('console.title')}</span>
          <span className="text-gray-600">·</span>
          <span className="text-xs">{t('console.lines', { count: lines.length })}</span>
        </div>
        <div className="flex items-center gap-2">
          {!autoScroll && (
            <button
              className="btn-ghost btn-sm text-xs gap-1"
              onClick={() => {
                setAutoScroll(true)
                bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
              }}
            >
              <ChevronDown size={12} />
              {t('console.scrollToBottom')}
            </button>
          )}
          <button
            className="btn-ghost btn-sm text-xs gap-1"
            onClick={() => setLines([])}
            title={t('console.clearConsole')}
          >
            <Trash2 size={12} />
          </button>
        </div>
      </div>

      {/* Log output */}
      <div
        ref={containerRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto p-4 space-y-0.5"
        onClick={() => inputRef.current?.focus()}
      >
        {lines.length === 0 ? (
          <div className="flex items-center justify-center h-full text-gray-600 text-sm">
            {isRunning ? t('console.waitingForOutput') : t('console.startServerPrompt')}
          </div>
        ) : (
          lines.map((line, i) => (
            <div key={i} className={clsx('console-font text-xs leading-5 whitespace-pre-wrap break-all', colorize(line.text))}>
              {line.text}
            </div>
          ))
        )}
        <div ref={bottomRef} />
      </div>

      {/* Command input */}
      <form
        onSubmit={handleSubmit}
        className="flex items-center gap-2 px-4 py-3 border-t border-gray-800 bg-gray-900"
      >
        <span className="console-font text-brand-400 text-sm select-none">&gt;</span>
        <input
          ref={inputRef}
          type="text"
          value={command}
          onChange={e => setCommand(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={isRunning ? t('console.enterCommand') : t('console.serverNotRunning')}
          disabled={!isRunning}
          className="flex-1 bg-transparent console-font text-sm text-gray-100 placeholder-gray-600 focus:outline-none disabled:opacity-40"
          autoComplete="off"
          spellCheck={false}
        />
        <button
          type="submit"
          disabled={!isRunning || !command.trim()}
          className="text-gray-500 hover:text-brand-400 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          title={t('console.sendCommand')}
        >
          <Send size={14} />
        </button>
      </form>
    </div>
  )
}
