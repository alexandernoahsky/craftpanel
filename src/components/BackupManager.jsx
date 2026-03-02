import { useState, useEffect, useCallback } from 'react'
import { HardDrive, Cloud, FolderOpen, CheckCircle, RefreshCw, ExternalLink, Download } from 'lucide-react'
import { getSocket } from '../hooks/useSocket'
import { useTranslation } from 'react-i18next'

function formatBytes(bytes) {
  if (bytes < 1024) return bytes + ' B'
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
  if (bytes < 1024 * 1024 * 1024) return (bytes / 1024 / 1024).toFixed(1) + ' MB'
  return (bytes / 1024 / 1024 / 1024).toFixed(2) + ' GB'
}

const DEST_TAB_IDS = ['local', 'smb', 'googleDrive', 'dropbox']
const DEST_ICONS = { local: Download, smb: HardDrive, googleDrive: Cloud, dropbox: FolderOpen }

export default function BackupManager({ serverId }) {
  const { t } = useTranslation()
  const [destTab, setDestTab] = useState('smb')
  const [config, setConfig] = useState(null)
  const [configLoading, setConfigLoading] = useState(true)

  // Form state (separated so edits don't mutate config)
  const [localEnabled, setLocalEnabled] = useState(false)
  const [smb, setSmb] = useState({ host: '', share: '', path: '/backups', username: '', password: '' })
  const [gdrive, setGdrive] = useState({ clientId: '', clientSecret: '', folderId: '' })
  const [dropbox, setDropbox] = useState({ appKey: '', appSecret: '', path: '/backups' })

  const [saving, setSaving] = useState(false)
  const [backingUp, setBackingUp] = useState(false)
  const [progress, setProgress] = useState(null)
  const [history, setHistory] = useState([])
  const [historyLoading, setHistoryLoading] = useState(true)

  const loadConfig = useCallback(async () => {
    setConfigLoading(true)
    try {
      const res = await fetch('/api/backup/config')
      const data = await res.json()
      setConfig(data)
      setLocalEnabled(!!(data.local?.enabled))
      setSmb({
        host: data.smb?.host || '',
        share: data.smb?.share || '',
        path: data.smb?.path || '/backups',
        username: data.smb?.username || '',
        password: data.smb?.password || '',
      })
      setGdrive({
        clientId: data.googleDrive?.clientId || '',
        clientSecret: data.googleDrive?.clientSecret || '',
        folderId: data.googleDrive?.folderId || '',
      })
      setDropbox({
        appKey: data.dropbox?.appKey || '',
        appSecret: data.dropbox?.appSecret || '',
        path: data.dropbox?.path || '/backups',
      })
    } finally {
      setConfigLoading(false)
    }
  }, [])

  const loadHistory = useCallback(async () => {
    setHistoryLoading(true)
    try {
      const res = await fetch(`/api/backup/${serverId}/history`)
      const data = await res.json()
      setHistory(Array.isArray(data) ? data : [])
    } finally {
      setHistoryLoading(false)
    }
  }, [serverId])

  useEffect(() => {
    loadConfig()
    loadHistory()
  }, [loadConfig, loadHistory])

  // Listen for OAuth popup success messages
  useEffect(() => {
    function handler(e) {
      if (e.data?.type === 'oauth-success') loadConfig()
    }
    window.addEventListener('message', handler)
    return () => window.removeEventListener('message', handler)
  }, [loadConfig])

  // Socket.io backup events
  useEffect(() => {
    const sock = getSocket()
    function onProgress(data) {
      if (data.serverId === serverId) setProgress(data)
    }
    function onComplete(data) {
      if (data.serverId === serverId) {
        setBackingUp(false)
        setProgress(null)
        setHistory(h => [data.entry, ...h])
      }
    }
    function onError(data) {
      if (data.serverId === serverId) {
        setBackingUp(false)
        setProgress(null)
        alert('Backup failed: ' + data.error)
      }
    }
    sock.on('backup-progress', onProgress)
    sock.on('backup-complete', onComplete)
    sock.on('backup-error', onError)
    return () => {
      sock.off('backup-progress', onProgress)
      sock.off('backup-complete', onComplete)
      sock.off('backup-error', onError)
    }
  }, [serverId])

  async function saveLocal(enabled) {
    setSaving(true)
    try {
      await fetch('/api/backup/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ local: { enabled } }),
      })
      await loadConfig()
    } finally {
      setSaving(false)
    }
  }

  async function saveSmb() {
    setSaving(true)
    try {
      await fetch('/api/backup/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ smb }),
      })
      await loadConfig()
    } finally {
      setSaving(false)
    }
  }

  async function saveGdrive() {
    setSaving(true)
    try {
      await fetch('/api/backup/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ googleDrive: gdrive }),
      })
      await loadConfig()
    } finally {
      setSaving(false)
    }
  }

  async function saveDropbox() {
    setSaving(true)
    try {
      await fetch('/api/backup/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dropbox }),
      })
      await loadConfig()
    } finally {
      setSaving(false)
    }
  }

  function connectOAuth(provider) {
    window.open(`/api/backup/oauth/${provider}/init`, `${provider}_oauth`, 'width=600,height=700,noopener')
  }

  async function disconnect(provider) {
    await fetch(`/api/backup/oauth/${provider}/disconnect`, { method: 'POST' })
    await loadConfig()
  }

  async function createBackup() {
    setBackingUp(true)
    setProgress({ phase: 'zipping', percent: 0 })
    try {
      const res = await fetch(`/api/backup/${serverId}/create`, { method: 'POST' })
      const data = await res.json()
      if (!res.ok) {
        setBackingUp(false)
        setProgress(null)
        alert('Failed to start backup: ' + (data.error || 'Unknown error'))
      }
    } catch (err) {
      setBackingUp(false)
      setProgress(null)
      alert('Failed to start backup: ' + err.message)
    }
  }

  function getProgressLabel() {
    if (!progress) return ''
    if (progress.phase === 'zipping') return t('backup.progress.zipping')
    const dest = progress.destination === 'googleDrive' ? 'Google Drive'
      : progress.destination === 'smb' ? 'SMB'
      : progress.destination === 'dropbox' ? 'Dropbox'
      : progress.destination
    return t('backup.progress.uploadingTo', { destination: dest })
  }

  function getDestLabel(d) {
    if (d === 'googleDrive') return t('backup.history.drive')
    if (d === 'smb') return t('backup.history.smb')
    if (d === 'local') return t('backup.history.local')
    return t('backup.history.dropbox')
  }

  const anyConnected = config?.local?.enabled || config?.smb?.configured || config?.googleDrive?.connected || config?.dropbox?.connected
  const origin = config?.callbackBaseUrl || window.location.origin

  if (configLoading) {
    return (
      <div className="flex items-center justify-center h-48 text-gray-400">
        <div className="w-6 h-6 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Destinations */}
      <div className="card p-0 overflow-hidden">
        <div className="px-4 pt-4 pb-2 border-b border-gray-200 dark:border-gray-800">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white">{t('backup.destinations')}</h3>
          <p className="text-xs text-gray-400 mt-0.5">{t('backup.destinationsDesc')}</p>
        </div>

        {/* Sub-tabs */}
        <div className="flex border-b border-gray-200 dark:border-gray-800 px-4">
          {DEST_TAB_IDS.map(tabId => {
            const Icon = DEST_ICONS[tabId]
            return (
              <button
                key={tabId}
                onClick={() => setDestTab(tabId)}
                className={`flex items-center gap-1.5 px-3 py-2.5 text-sm font-medium border-b-2 transition-colors ${
                  destTab === tabId
                    ? 'border-brand-500 text-brand-600 dark:text-brand-400'
                    : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
                }`}
              >
                <Icon size={13} />
                {t(`backup.tabs.${tabId}`)}
                {tabId === 'local' && config?.local?.enabled && (
                  <span className="w-1.5 h-1.5 bg-green-500 rounded-full" />
                )}
                {tabId === 'smb' && config?.smb?.configured && (
                  <span className="w-1.5 h-1.5 bg-green-500 rounded-full" />
                )}
                {tabId === 'googleDrive' && config?.googleDrive?.connected && (
                  <span className="w-1.5 h-1.5 bg-green-500 rounded-full" />
                )}
                {tabId === 'dropbox' && config?.dropbox?.connected && (
                  <span className="w-1.5 h-1.5 bg-green-500 rounded-full" />
                )}
              </button>
            )
          })}
        </div>

        <div className="p-4 space-y-3">
          {/* Local */}
          {destTab === 'local' && (
            <div className="space-y-3">
              <p className="text-xs text-gray-500 dark:text-gray-400">
                {t('backup.local.desc')}
              </p>
              <div className="flex items-center justify-between py-2 px-3 bg-gray-50 dark:bg-gray-800/50 rounded-lg">
                <div>
                  <p className="text-sm font-medium text-gray-900 dark:text-white">{t('backup.local.saveLocally')}</p>
                  <p className="text-xs text-gray-400 font-mono mt-0.5 break-all">{config?.local?.directory}</p>
                </div>
                <button
                  type="button"
                  onClick={() => saveLocal(!localEnabled)}
                  disabled={saving}
                  className={`relative inline-flex h-6 w-11 flex-shrink-0 items-center rounded-full transition-colors ${
                    localEnabled ? 'bg-brand-500' : 'bg-gray-300 dark:bg-gray-700'
                  }`}
                >
                  <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
                    localEnabled ? 'translate-x-6' : 'translate-x-1'
                  }`} />
                </button>
              </div>
              {localEnabled && (
                <p className="text-xs text-green-600 dark:text-green-400 flex items-center gap-1">
                  <CheckCircle size={12} /> {t('backup.local.enabled')}
                </p>
              )}
            </div>
          )}

          {/* SMB */}
          {destTab === 'smb' && (
            <>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">{t('backup.smb.host')}</label>
                  <input
                    className="input"
                    value={smb.host}
                    onChange={e => setSmb(s => ({ ...s, host: e.target.value }))}
                    placeholder="192.168.1.100"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">{t('backup.smb.share')}</label>
                  <input
                    className="input"
                    value={smb.share}
                    onChange={e => setSmb(s => ({ ...s, share: e.target.value }))}
                    placeholder="backups"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">{t('backup.smb.username')}</label>
                  <input
                    className="input"
                    value={smb.username}
                    onChange={e => setSmb(s => ({ ...s, username: e.target.value }))}
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">{t('backup.smb.password')}</label>
                  <input
                    className="input"
                    type="password"
                    value={smb.password}
                    onChange={e => setSmb(s => ({ ...s, password: e.target.value }))}
                  />
                </div>
                <div className="col-span-2">
                  <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">{t('backup.smb.remotePath')}</label>
                  <input
                    className="input"
                    value={smb.path}
                    onChange={e => setSmb(s => ({ ...s, path: e.target.value }))}
                    placeholder="/backups"
                  />
                </div>
              </div>
              <div className="flex items-center gap-3">
                <button className="btn-primary btn-sm" onClick={saveSmb} disabled={saving}>
                  {saving && <span className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />}
                  {t('backup.smb.save')}
                </button>
                {config?.smb?.configured && (
                  <span className="text-xs text-green-600 dark:text-green-400 flex items-center gap-1">
                    <CheckCircle size={12} /> {t('backup.smb.configured')}
                  </span>
                )}
              </div>
            </>
          )}

          {/* Google Drive */}
          {destTab === 'googleDrive' && (
            <>
              <div className="p-3 bg-gray-50 dark:bg-gray-800/50 rounded-lg text-xs text-gray-600 dark:text-gray-400 space-y-1">
                <p>
                  {t('backup.googleDrive.step1')}{' '}
                  <a href="https://console.cloud.google.com/apis/credentials" target="_blank" rel="noopener" className="text-brand-500 hover:underline inline-flex items-center gap-0.5">
                    {t('backup.googleDrive.step1Link')} <ExternalLink size={10} />
                  </a>
                  {t('backup.googleDrive.step1Post')}
                </p>
                <p>{t('backup.googleDrive.step2')}</p>
                <code className="block bg-white dark:bg-gray-900 px-2 py-1 rounded border border-gray-200 dark:border-gray-700 text-[11px] break-all">
                  {origin}/api/backup/oauth/google/callback
                </code>
              </div>
              <div className="space-y-2">
                <div>
                  <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">{t('backup.googleDrive.clientId')}</label>
                  <input
                    className="input"
                    value={gdrive.clientId}
                    onChange={e => setGdrive(s => ({ ...s, clientId: e.target.value }))}
                    placeholder="...apps.googleusercontent.com"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">{t('backup.googleDrive.clientSecret')}</label>
                  <input
                    className="input"
                    type="password"
                    value={gdrive.clientSecret}
                    onChange={e => setGdrive(s => ({ ...s, clientSecret: e.target.value }))}
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                    {t('backup.googleDrive.folderId')} <span className="text-gray-400 font-normal">{t('backup.googleDrive.folderIdOptional')}</span>
                  </label>
                  <input
                    className="input"
                    value={gdrive.folderId}
                    onChange={e => setGdrive(s => ({ ...s, folderId: e.target.value }))}
                    placeholder="1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgVE2upms"
                  />
                </div>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <button className="btn-secondary btn-sm" onClick={saveGdrive} disabled={saving}>
                  {saving && <span className="w-3 h-3 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />}
                  {t('backup.googleDrive.saveCredentials')}
                </button>
                {config?.googleDrive?.connected ? (
                  <>
                    <span className="text-xs text-green-600 dark:text-green-400 flex items-center gap-1">
                      <CheckCircle size={12} /> {t('backup.googleDrive.connected')}
                    </span>
                    <button
                      className="btn-ghost btn-sm text-red-500 hover:text-red-600"
                      onClick={() => disconnect('google')}
                    >
                      {t('backup.googleDrive.disconnect')}
                    </button>
                  </>
                ) : (
                  <button
                    className="btn-primary btn-sm"
                    onClick={() => connectOAuth('google')}
                    disabled={!gdrive.clientId || !gdrive.clientSecret}
                  >
                    {t('backup.googleDrive.connectButton')}
                  </button>
                )}
              </div>
            </>
          )}

          {/* Dropbox */}
          {destTab === 'dropbox' && (
            <>
              <div className="p-3 bg-gray-50 dark:bg-gray-800/50 rounded-lg text-xs text-gray-600 dark:text-gray-400 space-y-1">
                <p>
                  {t('backup.dropbox.step1')}{' '}
                  <a href="https://www.dropbox.com/developers/apps" target="_blank" rel="noopener" className="text-brand-500 hover:underline inline-flex items-center gap-0.5">
                    {t('backup.dropbox.step1Link')} <ExternalLink size={10} />
                  </a>
                  {t('backup.dropbox.step1Post')}
                </p>
                <p>{t('backup.dropbox.step2')}</p>
                <code className="block bg-white dark:bg-gray-900 px-2 py-1 rounded border border-gray-200 dark:border-gray-700 text-[11px] break-all">
                  {origin}/api/backup/oauth/dropbox/callback
                </code>
              </div>
              <div className="space-y-2">
                <div>
                  <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">{t('backup.dropbox.appKey')}</label>
                  <input
                    className="input"
                    value={dropbox.appKey}
                    onChange={e => setDropbox(s => ({ ...s, appKey: e.target.value }))}
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">{t('backup.dropbox.appSecret')}</label>
                  <input
                    className="input"
                    type="password"
                    value={dropbox.appSecret}
                    onChange={e => setDropbox(s => ({ ...s, appSecret: e.target.value }))}
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">{t('backup.dropbox.remotePath')}</label>
                  <input
                    className="input"
                    value={dropbox.path}
                    onChange={e => setDropbox(s => ({ ...s, path: e.target.value }))}
                    placeholder="/backups"
                  />
                </div>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <button className="btn-secondary btn-sm" onClick={saveDropbox} disabled={saving}>
                  {saving && <span className="w-3 h-3 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />}
                  {t('backup.dropbox.saveCredentials')}
                </button>
                {config?.dropbox?.connected ? (
                  <>
                    <span className="text-xs text-green-600 dark:text-green-400 flex items-center gap-1">
                      <CheckCircle size={12} /> {t('backup.dropbox.connected')}
                    </span>
                    <button
                      className="btn-ghost btn-sm text-red-500 hover:text-red-600"
                      onClick={() => disconnect('dropbox')}
                    >
                      {t('backup.dropbox.disconnect')}
                    </button>
                  </>
                ) : (
                  <button
                    className="btn-primary btn-sm"
                    onClick={() => connectOAuth('dropbox')}
                    disabled={!dropbox.appKey || !dropbox.appSecret}
                  >
                    {t('backup.dropbox.connectButton')}
                  </button>
                )}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Create Backup */}
      <div className="card p-4">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white">{t('backup.createBackup.title')}</h3>
            <p className="text-xs text-gray-400 mt-0.5">
              {t('backup.createBackup.desc')}
            </p>
          </div>
          <button
            className="btn-primary flex-shrink-0"
            onClick={createBackup}
            disabled={!anyConnected || backingUp}
          >
            {backingUp ? (
              <span className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              <HardDrive size={14} />
            )}
            {backingUp ? t('backup.createBackup.backingUp') : t('backup.createBackup.button')}
          </button>
        </div>

        {!anyConnected && (
          <p className="text-xs text-amber-600 dark:text-amber-400">
            {t('backup.createBackup.noDestination')}
          </p>
        )}

        {progress && (
          <div className="mt-2 space-y-1">
            <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400">
              <span>{getProgressLabel()}</span>
              <span>{progress.percent}%</span>
            </div>
            <div className="h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
              <div
                className="h-full bg-brand-500 rounded-full transition-all duration-300"
                style={{ width: `${progress.percent}%` }}
              />
            </div>
          </div>
        )}
      </div>

      {/* Backup History */}
      <div className="card p-0 overflow-hidden">
        <div className="px-4 pt-4 pb-2 border-b border-gray-200 dark:border-gray-800 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white">{t('backup.history.title')}</h3>
          <button className="btn-ghost btn-sm" onClick={loadHistory} title="Refresh">
            <RefreshCw size={12} />
          </button>
        </div>

        {historyLoading ? (
          <div className="flex justify-center p-6">
            <div className="w-5 h-5 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : history.length === 0 ? (
          <p className="text-sm text-gray-400 px-4 py-6 text-center">{t('backup.history.noBackups')}</p>
        ) : (
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-gray-200 dark:border-gray-700">
                <th className="text-left px-4 py-2 text-gray-500 dark:text-gray-400 font-medium">{t('backup.history.filename')}</th>
                <th className="text-left px-4 py-2 text-gray-500 dark:text-gray-400 font-medium">{t('backup.history.size')}</th>
                <th className="text-left px-4 py-2 text-gray-500 dark:text-gray-400 font-medium">{t('backup.history.date')}</th>
                <th className="text-left px-4 py-2 text-gray-500 dark:text-gray-400 font-medium">{t('backup.history.destinations')}</th>
              </tr>
            </thead>
            <tbody>
              {history.map(entry => (
                <tr key={entry.id} className="border-b border-gray-100 dark:border-gray-800 last:border-0">
                  <td className="px-4 py-2 text-gray-700 dark:text-gray-300 font-mono truncate max-w-xs">
                    {entry.filename}
                  </td>
                  <td className="px-4 py-2 text-gray-500 whitespace-nowrap">{formatBytes(entry.sizeBytes)}</td>
                  <td className="px-4 py-2 text-gray-500 whitespace-nowrap">
                    {new Date(entry.createdAt).toLocaleString()}
                  </td>
                  <td className="px-4 py-2">
                    <div className="flex gap-1 flex-wrap items-center">
                      {entry.destinations.map(d => (
                        <span
                          key={d}
                          className="badge bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 text-[10px]"
                        >
                          {getDestLabel(d)}
                        </span>
                      ))}
                      {entry.localPath && (
                        <a
                          href={`/api/backup/download/${entry.id}`}
                          download={entry.filename}
                          className="flex items-center gap-0.5 text-[10px] text-brand-600 dark:text-brand-400 hover:underline ml-1"
                        >
                          <Download size={10} />
                          {t('backup.history.download')}
                        </a>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
