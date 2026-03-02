import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  Play, Square, RotateCcw, Trash2, ArrowLeft,
  Terminal, Package, Settings, Users, HardDrive,
  Server, AlertCircle, Pencil
} from 'lucide-react'
import { useAppStore } from '../stores/useAppStore'
import StatusBadge from '../components/StatusBadge'
import Console from '../components/Console'
import ServerSettings from '../components/ServerSettings'
import ModBrowser from '../components/ModBrowser'
import InstalledMods from '../components/InstalledMods'
import Players from '../components/Players'
import BackupManager from '../components/BackupManager'
import { useTranslation, Trans } from 'react-i18next'
import clsx from 'clsx'

export default function ServerDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { servers } = useAppStore()
  const server = servers.find(s => s.id === id)
  const { t } = useTranslation()

  const [tab, setTab] = useState('console')
  const [modTab, setModTab] = useState('installed')
  const [actioning, setActioning] = useState(null)
  const [showDelete, setShowDelete] = useState(false)
  const [modRefreshKey, setModRefreshKey] = useState(0)
  const [editingName, setEditingName] = useState(false)
  const [nameInput, setNameInput] = useState('')

  const TABS = [
    { id: 'console',   label: t('serverDetail.tabs.console'),   icon: Terminal },
    { id: 'mods',      label: t('serverDetail.tabs.mods'),      icon: Package },
    { id: 'settings',  label: t('serverDetail.tabs.settings'),  icon: Settings },
    { id: 'players',   label: t('serverDetail.tabs.players'),   icon: Users },
    { id: 'backup',    label: t('serverDetail.tabs.backup'),    icon: HardDrive },
  ]

  const canStart = server && (server.status === 'stopped' || server.status === 'error')
  const canStop = server && (server.status === 'running' || server.status === 'starting')
  const canRestart = server && server.status === 'running'

  async function action(endpoint) {
    setActioning(endpoint)
    try {
      await fetch(`/api/servers/${id}/${endpoint}`, { method: 'POST' })
    } finally {
      setTimeout(() => setActioning(null), 1000)
    }
  }

  async function saveServerName() {
    const newName = nameInput.trim()
    setEditingName(false)
    if (!newName || newName === server.name) return
    try {
      await fetch(`/api/servers/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newName }),
      })
    } catch (err) {
      alert('Failed to rename server: ' + err.message)
    }
  }

  async function handleDelete() {
    try {
      const res = await fetch(`/api/servers/${id}`, { method: 'DELETE' })
      if (!res.ok) {
        const data = await res.json()
        alert('Failed to delete server: ' + (data.error || 'Unknown error'))
        return
      }
      useAppStore.getState().removeServer(id)
      navigate('/')
    } catch (err) {
      alert('Failed to delete server: ' + err.message)
    }
  }

  if (!server) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-gray-400">
        <Server size={40} className="mb-3 opacity-40" />
        <p className="text-lg font-medium text-gray-900 dark:text-white">{t('serverDetail.serverNotFound')}</p>
        <button className="btn-secondary mt-4" onClick={() => navigate('/')}>
          <ArrowLeft size={14} />
          {t('serverDetail.backToDashboard')}
        </button>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center gap-4 px-6 py-4 border-b border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 flex-shrink-0">
        <button
          className="btn-ghost btn-icon -ml-1"
          onClick={() => navigate('/')}
          title="Back"
        >
          <ArrowLeft size={18} />
        </button>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3">
            {editingName ? (
              <input
                autoFocus
                className="text-xl font-bold bg-transparent border-b-2 border-brand-500 outline-none text-gray-900 dark:text-white w-64"
                value={nameInput}
                onChange={e => setNameInput(e.target.value)}
                onBlur={saveServerName}
                onKeyDown={e => {
                  if (e.key === 'Enter') e.currentTarget.blur()
                  if (e.key === 'Escape') setEditingName(false)
                }}
              />
            ) : (
              <div className="flex items-center gap-1.5 group min-w-0">
                <h1 className="text-xl font-bold text-gray-900 dark:text-white truncate">{server.name}</h1>
                <button
                  className="opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-800 flex-shrink-0"
                  onClick={() => { setNameInput(server.name); setEditingName(true) }}
                  title={t('serverDetail.renameServer')}
                >
                  <Pencil size={13} className="text-gray-400" />
                </button>
              </div>
            )}
            <StatusBadge status={server.status} />
          </div>
          <p className="text-sm text-gray-400 capitalize mt-0.5">
            {server.type} {server.version} · {t('serverDetail.port')} {server.port}
          </p>
        </div>

        {/* Server controls */}
        <div className="flex items-center gap-2 flex-shrink-0">
          {server.status === 'running' && (
            <div className="flex items-center gap-2 mr-2 text-sm text-gray-500 dark:text-gray-400">
              <Users size={14} />
              {server.playerCount || 0}/{server.maxPlayers}
            </div>
          )}

          {canStart && (
            <button
              className="btn-primary btn-sm"
              onClick={() => action('start')}
              disabled={actioning === 'start' || server.status === 'installing'}
            >
              {actioning === 'start' ? (
                <span className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : <Play size={13} />}
              {t('serverDetail.start')}
            </button>
          )}

          {canStop && (
            <button
              className="btn-danger btn-sm"
              onClick={() => action('stop')}
              disabled={actioning === 'stop'}
            >
              {actioning === 'stop' ? (
                <span className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : <Square size={13} />}
              {t('serverDetail.stop')}
            </button>
          )}

          {canRestart && (
            <button
              className="btn-secondary btn-sm"
              onClick={() => action('restart')}
              disabled={actioning === 'restart'}
              title={t('serverDetail.restart')}
            >
              <RotateCcw size={13} />
            </button>
          )}

          <button
            className="btn-ghost btn-sm text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20"
            onClick={() => setShowDelete(true)}
            title={t('serverDetail.deleteServer')}
          >
            <Trash2 size={13} />
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 px-6 flex-shrink-0">
        {TABS.map(tab_ => (
          <button
            key={tab_.id}
            onClick={() => setTab(tab_.id)}
            className={clsx(
              'flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors',
              tab === tab_.id
                ? 'border-brand-500 text-brand-600 dark:text-brand-400'
                : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
            )}
          >
            <tab_.icon size={15} />
            {tab_.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="flex-1 overflow-hidden p-6">
        {tab === 'console' && (
          <Console serverId={id} serverStatus={server.status} />
        )}

        {tab === 'mods' && (
          <div className="h-full flex flex-col">
            {/* Mod sub-tabs */}
            <div className="flex gap-1 mb-4">
              {['installed', 'browse'].map(mt => (
                <button
                  key={mt}
                  onClick={() => setModTab(mt)}
                  className={`px-4 py-1.5 rounded-lg text-sm font-medium capitalize transition-colors ${
                    modTab === mt
                      ? 'bg-brand-500 text-white'
                      : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800'
                  }`}
                >
                  {mt === 'installed' ? t('serverDetail.modTabs.installed') : t('serverDetail.modTabs.browse')}
                </button>
              ))}
            </div>
            <div className="flex-1 overflow-auto">
              {modTab === 'installed' ? (
                <InstalledMods key={modRefreshKey} serverId={id} />
              ) : (
                <ModBrowser
                  serverId={id}
                  server={server}
                  onInstalled={() => setModRefreshKey(k => k + 1)}
                />
              )}
            </div>
          </div>
        )}

        {tab === 'settings' && (
          <ServerSettings serverId={id} server={server} />
        )}

        {tab === 'backup' && (
          <div className="h-full overflow-y-auto">
            <BackupManager serverId={id} server={server} />
          </div>
        )}

        {tab === 'players' && (
          <Players serverId={id} server={server} />
        )}
      </div>

      {/* Delete modal */}
      {showDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setShowDelete(false)} />
          <div className="relative card p-6 w-full max-w-sm fade-in shadow-2xl">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center">
                <AlertCircle size={20} className="text-red-500" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">{t('serverDetail.deleteModal.title')}</h3>
            </div>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-5">
              <Trans
                i18nKey="serverDetail.deleteModal.description"
                values={{ name: server.name }}
                components={{ bold: <strong className="text-gray-900 dark:text-white" /> }}
              />
            </p>
            <div className="flex gap-2 justify-end">
              <button className="btn-secondary" onClick={() => setShowDelete(false)}>{t('serverDetail.deleteModal.cancel')}</button>
              <button className="btn-danger" onClick={handleDelete}>{t('serverDetail.deleteModal.confirm')}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
