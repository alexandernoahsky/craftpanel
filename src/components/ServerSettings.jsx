import { useState, useEffect } from 'react'
import { Save, RefreshCw, CheckCircle } from 'lucide-react'
import { useTranslation } from 'react-i18next'

const KNOWN_PROPS = [
  { key: 'server-port',               labelKey: 'settings.props.server-port',               type: 'number',   group: 'Network' },
  { key: 'online-mode',               labelKey: 'settings.props.online-mode',               type: 'boolean',  group: 'Network' },
  { key: 'max-players',               labelKey: 'settings.props.max-players',               type: 'number',   group: 'Players' },
  { key: 'gamemode',                  labelKey: 'settings.props.gamemode',                  type: 'select',   options: ['survival', 'creative', 'adventure', 'spectator'], group: 'Gameplay' },
  { key: 'difficulty',                labelKey: 'settings.props.difficulty',                type: 'select',   options: ['peaceful', 'easy', 'normal', 'hard'], group: 'Gameplay' },
  { key: 'pvp',                       labelKey: 'settings.props.pvp',                       type: 'boolean',  group: 'Gameplay' },
  { key: 'allow-flight',              labelKey: 'settings.props.allow-flight',              type: 'boolean',  group: 'Gameplay' },
  { key: 'enable-command-block',      labelKey: 'settings.props.enable-command-block',      type: 'boolean',  group: 'Gameplay' },
  { key: 'motd',                      labelKey: 'settings.props.motd',                      type: 'text',     group: 'Display' },
  { key: 'level-name',                labelKey: 'settings.props.level-name',                type: 'text',     group: 'World' },
  { key: 'level-seed',                labelKey: 'settings.props.level-seed',                type: 'text',     group: 'World' },
  { key: 'level-type',                labelKey: 'settings.props.level-type',                type: 'select',   options: ['minecraft:normal', 'minecraft:flat', 'minecraft:large_biomes', 'minecraft:amplified'], group: 'World' },
  { key: 'view-distance',             labelKey: 'settings.props.view-distance',             type: 'number',   group: 'Performance' },
  { key: 'simulation-distance',       labelKey: 'settings.props.simulation-distance',       type: 'number',   group: 'Performance' },
  { key: 'spawn-protection',          labelKey: 'settings.props.spawn-protection',          type: 'number',   group: 'World' },
  { key: 'white-list',                labelKey: 'settings.props.white-list',                type: 'boolean',  group: 'Players' },
  { key: 'enforce-whitelist',         labelKey: 'settings.props.enforce-whitelist',         type: 'boolean',  group: 'Players' },
  { key: 'max-world-size',            labelKey: 'settings.props.max-world-size',            type: 'number',   group: 'World' },
  { key: 'prevent-proxy-connections', labelKey: 'settings.props.prevent-proxy-connections', type: 'boolean',  group: 'Security',
    helpKey: 'settings.propHelp.prevent-proxy-connections' },
  { key: 'enable-rcon',               labelKey: 'settings.props.enable-rcon',               type: 'boolean',  group: 'Security',
    helpKey: 'settings.propHelp.enable-rcon' },
  { key: 'rcon.password',             labelKey: 'settings.props.rcon.password',             type: 'password', group: 'Security',
    helpKey: 'settings.propHelp.rcon.password' },
  { key: 'rcon.port',                 labelKey: 'settings.props.rcon.port',                 type: 'number',   group: 'Security' },
  { key: 'rate-limit',                labelKey: 'settings.props.rate-limit',                type: 'number',   group: 'Security',
    helpKey: 'settings.propHelp.rate-limit' },
  { key: 'hide-online-players',       labelKey: 'settings.props.hide-online-players',       type: 'boolean',  group: 'Security' },
]

const PROP_GROUPS = [...new Set(KNOWN_PROPS.map(p => p.group))]

const SERVER_TYPE_IDS = ['paper', 'vanilla', 'fabric']

function PropField({ prop, value, onChange }) {
  if (prop.type === 'boolean') {
    const checked = value === 'true'
    return (
      <button
        type="button"
        onClick={() => onChange(checked ? 'false' : 'true')}
        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
          checked ? 'bg-brand-500' : 'bg-gray-300 dark:bg-gray-700'
        }`}
      >
        <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
          checked ? 'translate-x-6' : 'translate-x-1'
        }`} />
      </button>
    )
  }
  if (prop.type === 'select') {
    return (
      <select className="input max-w-xs" value={value || ''} onChange={e => onChange(e.target.value)}>
        {prop.options.map(o => <option key={o} value={o}>{o}</option>)}
      </select>
    )
  }
  if (prop.type === 'password') {
    return (
      <input
        type="password"
        className="input max-w-xs"
        value={value || ''}
        onChange={e => onChange(e.target.value)}
        autoComplete="new-password"
      />
    )
  }
  return (
    <input
      type={prop.type === 'number' ? 'number' : 'text'}
      className="input max-w-xs"
      value={value || ''}
      onChange={e => onChange(e.target.value)}
    />
  )
}

export default function ServerSettings({ serverId, server }) {
  const { t } = useTranslation()

  const ALL_TABS = [...PROP_GROUPS, t('settings.tabs.version')]

  const [props, setProps] = useState({})
  const [extraProps, setExtraProps] = useState({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [activeGroup, setActiveGroup] = useState(PROP_GROUPS[0])

  // RAM + idle state — synced from server prop
  const [minRam, setMinRam] = useState(server?.minMemory || 512)
  const [maxRam, setMaxRam] = useState(server?.maxMemory || 2048)
  const [idleTimeout, setIdleTimeout] = useState(server?.idleTimeout ?? 0)
  const [savingRam, setSavingRam] = useState(false)
  const [ramSaved, setRamSaved] = useState(false)

  // Version tab state
  const [versionType, setVersionType] = useState('')
  const [versionValue, setVersionValue] = useState('')
  const [typeVersions, setTypeVersions] = useState([])
  const [typeVersionsLoading, setTypeVersionsLoading] = useState(false)
  const [changingType, setChangingType] = useState(false)

  const VERSION_TAB = t('settings.tabs.version')
  const isVersionTab = activeGroup === VERSION_TAB

  // Keep RAM + idle inputs in sync when server data updates (e.g. after a PATCH)
  useEffect(() => {
    if (server) {
      setMinRam(server.minMemory || 512)
      setMaxRam(server.maxMemory || 2048)
      setIdleTimeout(server.idleTimeout ?? 0)
    }
  }, [server?.minMemory, server?.maxMemory, server?.idleTimeout])

  // Auto-fetch versions when Version tab is opened
  useEffect(() => {
    if (!isVersionTab) return
    const type = server?.type && server.type !== 'forge' ? server.type : 'paper'
    setVersionType(type)
    loadTypeVersions(type)
  }, [activeGroup])

  async function load() {
    setLoading(true)
    try {
      const res = await fetch(`/api/settings/${serverId}`)
      if (!res.ok) return
      const data = await res.json()
      const p = data.properties || {}
      setProps(p)
      const knownKeys = KNOWN_PROPS.map(k => k.key)
      const extra = {}
      Object.entries(p).forEach(([k, v]) => {
        if (!knownKeys.includes(k)) extra[k] = v
      })
      setExtraProps(extra)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [serverId])

  function updateProp(key, value) {
    setProps(p => ({ ...p, [key]: value }))
  }

  async function save() {
    setSaving(true)
    setSaved(false)
    try {
      await fetch(`/api/settings/${serverId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ properties: { ...props, ...extraProps } }),
      })
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    } finally {
      setSaving(false)
    }
  }

  async function saveRam() {
    setSavingRam(true)
    try {
      await fetch(`/api/servers/${serverId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ minMemory: Number(minRam), maxMemory: Number(maxRam), idleTimeout: Number(idleTimeout) }),
      })
      setRamSaved(true)
      setTimeout(() => setRamSaved(false), 2000)
    } finally {
      setSavingRam(false)
    }
  }

  async function loadTypeVersions(type) {
    setTypeVersionsLoading(true)
    setTypeVersions([])
    setVersionValue('')
    try {
      const res = await fetch(`/api/servers/versions?type=${type}`)
      const data = await res.json()
      const versions = Array.isArray(data) ? data : []
      setTypeVersions(versions)
      if (versions.length > 0) setVersionValue(versions[0]) // pre-select latest
    } finally {
      setTypeVersionsLoading(false)
    }
  }

  async function handleChangeType() {
    setChangingType(true)
    try {
      const res = await fetch(`/api/servers/${serverId}/change-type`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: versionType, version: versionValue }),
      })
      const data = await res.json()
      if (!res.ok) alert('Failed: ' + (data.error || 'Unknown error'))
    } finally {
      setChangingType(false)
    }
  }

  const isServerRunning = server?.status === 'running' || server?.status === 'starting' || server?.status === 'stopping'
  const isInstalling = server?.status === 'installing'
  const isCurrentVersion = versionType === server?.type && versionValue === server?.version
  const groupProps = KNOWN_PROPS.filter(p => p.group === activeGroup)

  if (loading) {
    return (
      <div className="flex items-center justify-center h-48 text-gray-400">
        <div className="w-6 h-6 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full">
      {/* Tab bar */}
      <div className="flex items-center justify-between mb-4 flex-shrink-0">
        <div className="flex gap-1 overflow-x-auto">
          {ALL_TABS.map(g => (
            <button
              key={g}
              onClick={() => setActiveGroup(g)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${
                activeGroup === g
                  ? 'bg-brand-500 text-white'
                  : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800'
              }`}
            >
              {g}
            </button>
          ))}
        </div>

        {!isVersionTab && (
          <div className="flex gap-2 flex-shrink-0">
            <button className="btn-secondary btn-sm" onClick={load}>
              <RefreshCw size={12} />
              {t('settings.reload')}
            </button>
            <button
              className={saved ? 'btn btn-sm bg-brand-500 text-white' : 'btn-primary btn-sm'}
              onClick={save}
              disabled={saving}
            >
              {saving ? (
                <span className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <Save size={12} />
              )}
              {saved ? t('settings.saved') : t('settings.save')}
            </button>
          </div>
        )}
      </div>

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto">

        {/* ── Version tab ── */}
        {isVersionTab && (
          <div className="space-y-4 max-w-lg">
            {/* Current */}
            <div className="card p-4">
              <p className="text-xs text-gray-400 mb-1.5">{t('settings.version.currentlyRunning')}</p>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="badge bg-brand-100 dark:bg-brand-900/30 text-brand-700 dark:text-brand-300 capitalize text-sm px-3 py-1">
                  {server?.type || '—'}
                </span>
                <span className="text-sm font-mono text-gray-700 dark:text-gray-300">{server?.version || '—'}</span>
                {isInstalling && (
                  <span className="text-xs text-amber-600 dark:text-amber-400 flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse inline-block" />
                    {t('settings.version.installingJar')}
                  </span>
                )}
              </div>
            </div>

            {/* Type picker */}
            <div className="card p-4">
              <p className="text-sm font-medium text-gray-900 dark:text-white mb-3">{t('settings.version.serverType')}</p>
              <div className="space-y-2">
                {SERVER_TYPE_IDS.map(typeId => (
                  <button
                    key={typeId}
                    onClick={() => { setVersionType(typeId); loadTypeVersions(typeId) }}
                    className={`w-full text-left px-3 py-2.5 rounded-lg border transition-colors ${
                      versionType === typeId
                        ? 'border-brand-500 bg-brand-50 dark:bg-brand-900/20'
                        : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
                    }`}
                  >
                    <span className={`text-sm font-medium ${versionType === typeId ? 'text-brand-700 dark:text-brand-300' : 'text-gray-900 dark:text-white'}`}>
                      {t(`settings.serverTypes.${typeId}.label`)}
                    </span>
                    <span className="text-xs text-gray-400 ml-2">{t(`settings.serverTypes.${typeId}.desc`)}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Version picker — auto-fetched from live APIs */}
            <div className="card p-4">
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm font-medium text-gray-900 dark:text-white">{t('settings.version.version')}</p>
                {typeVersions.length > 0 && !typeVersionsLoading && (
                  <span className="text-xs text-green-600 dark:text-green-400 flex items-center gap-1">
                    <CheckCircle size={11} /> {t('settings.version.latest')}: {typeVersions[0]}
                  </span>
                )}
              </div>
              {typeVersionsLoading ? (
                <div className="flex items-center gap-2 text-xs text-gray-400 py-1">
                  <div className="w-3 h-3 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
                  {t('settings.version.fetchingVersions')}
                </div>
              ) : (
                <select
                  className="input"
                  value={versionValue}
                  onChange={e => setVersionValue(e.target.value)}
                >
                  {typeVersions.map((v, i) => (
                    <option key={v} value={v}>{v}{i === 0 ? ` ${t('settings.version.latestLabel')}` : ''}</option>
                  ))}
                </select>
              )}
            </div>

            {/* Apply */}
            <div className="card p-4 space-y-3">
              {isServerRunning ? (
                <p className="text-sm text-amber-600 dark:text-amber-400">
                  {t('settings.version.stopFirst')}
                </p>
              ) : isCurrentVersion ? (
                <p className="text-sm text-gray-400">{t('settings.version.alreadyOn', { type: versionType, version: versionValue })}</p>
              ) : (
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  {t('settings.version.jarNote')}
                </p>
              )}
              <button
                className="btn-primary"
                onClick={handleChangeType}
                disabled={!versionType || !versionValue || isServerRunning || isInstalling || isCurrentVersion || changingType}
              >
                {changingType && (
                  <span className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
                )}
                {changingType
                  ? t('settings.version.startingDownload')
                  : t('settings.version.apply', {
                      type: versionType ? versionType.charAt(0).toUpperCase() + versionType.slice(1) : '',
                      version: versionValue,
                    })}
              </button>
              {isInstalling && (
                <p className="text-xs text-gray-400">
                  {t('settings.version.downloadInProgress')}
                </p>
              )}
            </div>
          </div>
        )}

        {/* ── Property tabs ── */}
        {!isVersionTab && (
          <>
            {/* RAM section — Performance tab only */}
            {activeGroup === 'Performance' && (
              <div className="mb-4 p-4 bg-gray-50 dark:bg-gray-800/50 rounded-xl border border-gray-200 dark:border-gray-700">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <p className="text-sm font-medium text-gray-900 dark:text-white">{t('settings.ram.title')}</p>
                    <p className="text-xs text-gray-400 mt-0.5">{t('settings.ram.subtitle')}</p>
                  </div>
                  <button
                    className={ramSaved ? 'btn btn-sm bg-brand-500 text-white' : 'btn-secondary btn-sm'}
                    onClick={saveRam}
                    disabled={savingRam}
                  >
                    {savingRam ? (
                      <span className="w-3 h-3 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
                    ) : ramSaved ? (
                      <CheckCircle size={12} />
                    ) : (
                      <Save size={12} />
                    )}
                    {ramSaved ? t('settings.saved') : t('settings.saveRam')}
                  </button>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                      {t('settings.ram.minRam')} <span className="text-gray-400 font-normal">-Xms</span>
                    </label>
                    <input
                      type="number"
                      className="input"
                      value={minRam}
                      min={256}
                      max={maxRam}
                      step={256}
                      onChange={e => setMinRam(e.target.value)}
                    />
                    <p className="text-xs text-gray-400 mt-0.5">{(minRam / 1024).toFixed(1)} GB</p>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                      {t('settings.ram.maxRam')} <span className="text-gray-400 font-normal">-Xmx</span>
                    </label>
                    <input
                      type="number"
                      className="input"
                      value={maxRam}
                      min={minRam}
                      max={65536}
                      step={256}
                      onChange={e => setMaxRam(e.target.value)}
                    />
                    <p className="text-xs text-gray-400 mt-0.5">{(maxRam / 1024).toFixed(1)} GB</p>
                  </div>
                </div>
                <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-700">
                  <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                    {t('settings.ram.idleLabel')}
                  </label>
                  <input
                    type="number"
                    className="input max-w-xs"
                    value={idleTimeout}
                    min={0}
                    step={1}
                    onChange={e => setIdleTimeout(e.target.value)}
                  />
                  <p className="text-xs text-gray-400 mt-0.5">
                    {t('settings.ram.idleHelp')}
                  </p>
                </div>
              </div>
            )}

            {/* Props list */}
            <div className="space-y-1">
              {groupProps.map(prop => (
                <div
                  key={prop.key}
                  className="flex items-center justify-between py-3 px-4 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors"
                >
                  <div className="flex-1 min-w-0 mr-4">
                    <p className="text-sm font-medium text-gray-900 dark:text-white">{t(prop.labelKey)}</p>
                    <p className="text-xs text-gray-400 font-mono mt-0.5">{prop.key}</p>
                    {prop.helpKey && (
                      <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">{t(prop.helpKey)}</p>
                    )}
                  </div>
                  <PropField
                    prop={prop}
                    value={props[prop.key] ?? ''}
                    onChange={v => updateProp(prop.key, v)}
                  />
                </div>
              ))}
            </div>

            <p className="text-xs text-gray-400 dark:text-gray-600 mt-3 px-4 pb-4">
              {t('settings.propsNote')}
            </p>
          </>
        )}
      </div>
    </div>
  )
}
