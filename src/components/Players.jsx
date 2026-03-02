import { useState, useEffect } from 'react'
import { Users, Shield, Ban, Megaphone, MessageSquare, Send, CheckCircle } from 'lucide-react'
import { usePlayersList } from '../hooks/useSocket'
import { useTranslation } from 'react-i18next'

// section: optional header label (translation key under players.sections)
const QUICK_COMMANDS = [
  // ── Players ───────────────────────────────────────────────
  { section: 'Players' },
  { labelKey: 'players.commands.listPlayers',     icon: Users,     cmd: () => 'list' },
  { labelKey: 'players.commands.sayBroadcast',    icon: Megaphone, hasInput: true, prefix: 'say ',             placeholder: 'message…' },
  { labelKey: 'players.commands.teleport',                         hasInput: true, prefix: 'tp ',              placeholder: 'player [dest]' },
  { labelKey: 'players.commands.killPlayer',                       hasInput: true, prefix: 'kill ',            placeholder: 'player', variant: 'danger' },
  { labelKey: 'players.commands.giveOp',          icon: Shield,    hasInput: true, prefix: 'op ',             placeholder: 'player' },
  { labelKey: 'players.commands.removeOp',        icon: Shield,    hasInput: true, prefix: 'deop ',           placeholder: 'player', variant: 'danger' },
  { labelKey: 'players.commands.kickPlayer',      icon: Ban,       hasInput: true, prefix: 'kick ',           placeholder: 'player [reason]' },
  { labelKey: 'players.commands.banPlayer',       icon: Ban,       hasInput: true, prefix: 'ban ',            placeholder: 'player [reason]', variant: 'danger' },
  { labelKey: 'players.commands.unbanPlayer',                      hasInput: true, prefix: 'pardon ',         placeholder: 'player' },
  { labelKey: 'players.commands.giveItem',                         hasInput: true, prefix: 'give ',           placeholder: 'player item [amount]' },
  // ── Whitelist ─────────────────────────────────────────────
  { section: 'Whitelist' },
  { labelKey: 'players.commands.whitelistOn',                      cmd: () => 'whitelist on' },
  { labelKey: 'players.commands.whitelistOff',                     cmd: () => 'whitelist off',  variant: 'danger' },
  { labelKey: 'players.commands.wlAdd',                            hasInput: true, prefix: 'whitelist add ',    placeholder: 'player' },
  { labelKey: 'players.commands.wlRemove',                         hasInput: true, prefix: 'whitelist remove ', placeholder: 'player', variant: 'danger' },
  // ── World ─────────────────────────────────────────────────
  { section: 'World' },
  { labelKey: 'players.commands.timeDay',                          cmd: () => 'time set day' },
  { labelKey: 'players.commands.timeNight',                        cmd: () => 'time set night' },
  { labelKey: 'players.commands.weatherClear',                     cmd: () => 'weather clear' },
  { labelKey: 'players.commands.weatherRain',                      cmd: () => 'weather rain' },
  { labelKey: 'players.commands.weatherThunder',                   cmd: () => 'weather thunder' },
  { labelKey: 'players.commands.difficultyPeaceful',               cmd: () => 'difficulty peaceful' },
  { labelKey: 'players.commands.difficultyEasy',                   cmd: () => 'difficulty easy' },
  { labelKey: 'players.commands.difficultyNormal',                 cmd: () => 'difficulty normal' },
  { labelKey: 'players.commands.difficultyHard',                   cmd: () => 'difficulty hard', variant: 'danger' },
  // ── Server ────────────────────────────────────────────────
  { section: 'Server' },
  { labelKey: 'players.commands.saveWorld',                        cmd: () => 'save-all' },
  { labelKey: 'players.commands.worldSeed',                        cmd: () => 'seed' },
  { labelKey: 'players.commands.reload',                           cmd: () => 'reload confirm' },
]

function CommandButton({ item, serverId, isRunning }) {
  const { t } = useTranslation()
  const [input, setInput] = useState('')
  const [sent, setSent] = useState(false)
  const [open, setOpen] = useState(false)

  const label = t(item.labelKey)

  async function send(cmd) {
    if (!isRunning || !cmd?.trim()) return
    await fetch(`/api/players/${serverId}/command`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ command: cmd }),
    })
    setSent(true)
    setInput('')
    setOpen(false)
    setTimeout(() => setSent(false), 1500)
  }

  const baseClass = item.variant === 'danger'
    ? 'btn-danger btn-sm'
    : 'btn-secondary btn-sm'

  const sentClass = 'btn btn-sm bg-green-500 hover:bg-green-600 text-white'

  if (!item.hasInput) {
    return (
      <button
        className={sent ? sentClass : baseClass}
        onClick={() => send(item.cmd())}
        disabled={!isRunning}
      >
        {sent ? <CheckCircle size={12} /> : (item.icon && <item.icon size={12} />)}
        {sent ? t('players.done') : label}
      </button>
    )
  }

  return (
    <div className="relative">
      <button
        className={sent ? sentClass : baseClass}
        onClick={() => setOpen(o => !o)}
        disabled={!isRunning}
      >
        {sent ? <CheckCircle size={12} /> : (item.icon && <item.icon size={12} />)}
        {sent ? t('players.sent') : label}
      </button>
      {open && (
        <div className="absolute top-full left-0 mt-1 z-10 flex items-center gap-1 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg p-2 min-w-52">
          <span className="text-xs text-gray-500 font-mono whitespace-nowrap">{item.prefix}</span>
          <input
            className="input py-1 text-xs flex-1 min-w-0"
            autoFocus
            placeholder={item.placeholder || 'value…'}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter' && input.trim()) send(item.prefix + input)
              if (e.key === 'Escape') setOpen(false)
            }}
          />
          <button
            className="btn-primary btn-sm px-2"
            onClick={() => send(item.prefix + input)}
            disabled={!input.trim()}
          >
            <Send size={12} />
          </button>
        </div>
      )}
    </div>
  )
}

export default function Players({ serverId, server }) {
  const { t } = useTranslation()
  const isRunning = server?.status === 'running'
  const [players, setPlayers] = useState([])

  // Fetch current player list on mount and whenever server starts
  useEffect(() => {
    if (!isRunning) {
      setPlayers([])
      return
    }
    fetch(`/api/servers/${serverId}/players`)
      .then(r => r.json())
      .then(data => { if (Array.isArray(data)) setPlayers(data) })
      .catch(() => {})
  }, [serverId, isRunning])

  usePlayersList(serverId, setPlayers)

  return (
    <div className="max-w-2xl">
      {/* Online players */}
      <div className="card p-4 mb-6">
        <div className="flex items-center gap-2 mb-3">
          <Users size={16} className="text-gray-400" />
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
            {t('players.onlinePlayers')}
          </h3>
          <span className="ml-auto text-xs text-gray-400">
            {players.length}/{server?.maxPlayers || '?'}
          </span>
        </div>
        {!isRunning ? (
          <p className="text-xs text-gray-400">{t('players.startToSee')}</p>
        ) : players.length === 0 ? (
          <p className="text-xs text-gray-400">{t('players.noPlayers')}</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {players.map(name => (
              <span
                key={name}
                className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-brand-50 dark:bg-brand-900/20 text-brand-700 dark:text-brand-300 text-xs font-medium"
              >
                <span className="w-1.5 h-1.5 rounded-full bg-brand-400 inline-block" />
                {name}
              </span>
            ))}
          </div>
        )}
      </div>

      <div className="mb-4">
        <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-1">{t('players.quickCommands')}</h3>
        <p className="text-xs text-gray-400">
          {isRunning ? t('players.running') : t('players.notRunning')}
        </p>
      </div>

      <div className="flex flex-wrap gap-2 mb-8">
        {QUICK_COMMANDS.map((item, i) => {
          if (item.section) {
            return (
              <div key={`section-${item.section}`} className="w-full">
                {i > 0 && <div className="border-t border-gray-200 dark:border-gray-700 mt-1 mb-3" />}
                <p className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-2">
                  {t(`players.sections.${item.section}`)}
                </p>
              </div>
            )
          }
          return (
            <CommandButton key={item.labelKey} item={item} serverId={serverId} isRunning={isRunning} />
          )
        })}
      </div>

      <div className="card p-4">
        <div className="flex items-center gap-2 mb-3">
          <MessageSquare size={16} className="text-gray-400" />
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white">{t('players.customCommand')}</h3>
        </div>
        <CustomCommand serverId={serverId} isRunning={isRunning} />
      </div>

      <p className="text-xs text-gray-400 dark:text-gray-600 mt-4">
        {t('players.commandsNote')}
      </p>
    </div>
  )
}

function CustomCommand({ serverId, isRunning }) {
  const { t } = useTranslation()
  const [cmd, setCmd] = useState('')
  const [sent, setSent] = useState(false)

  async function send(e) {
    e.preventDefault()
    if (!isRunning || !cmd.trim()) return
    await fetch(`/api/players/${serverId}/command`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ command: cmd.trim() }),
    })
    setSent(true)
    setCmd('')
    setTimeout(() => setSent(false), 1500)
  }

  return (
    <form onSubmit={send} className="flex gap-2">
      <span className="text-gray-400 font-mono text-sm self-center">/</span>
      <input
        className="input flex-1"
        placeholder={isRunning ? t('players.commandPlaceholder') : t('players.serverNotRunning')}
        value={cmd}
        onChange={e => setCmd(e.target.value)}
        disabled={!isRunning}
      />
      <button type="submit" className="btn-primary" disabled={!isRunning || !cmd.trim()}>
        {sent ? '✓' : <Send size={14} />}
      </button>
    </form>
  )
}
