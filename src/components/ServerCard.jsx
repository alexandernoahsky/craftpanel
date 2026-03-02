import { useNavigate } from 'react-router-dom'
import { Play, Square, RotateCcw, Users, Cpu, HardDrive, Moon } from 'lucide-react'
import StatusBadge from './StatusBadge'
import { useTranslation } from 'react-i18next'
import clsx from 'clsx'

const TYPE_COLORS = {
  paper:   'bg-yellow-400',
  vanilla: 'bg-gray-400',
  fabric:  'bg-indigo-400',
  forge:   'bg-orange-400',
}

export default function ServerCard({ server }) {
  const navigate = useNavigate()
  const { t } = useTranslation()

  async function action(e, endpoint) {
    e.stopPropagation()
    await fetch(`/api/servers/${server.id}/${endpoint}`, { method: 'POST' })
  }

  const canStart = server.status === 'stopped' || server.status === 'error'
  const isSleeping = server.status === 'sleeping'
  const canStop = server.status === 'running' || server.status === 'starting'
  const canRestart = server.status === 'running'

  return (
    <div
      className="card p-5 cursor-pointer hover:shadow-md hover:border-brand-200 dark:hover:border-brand-800 transition-all duration-200 fade-in"
      onClick={() => navigate(`/server/${server.id}`)}
    >
      {/* Header */}
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className={clsx('w-2 h-full min-h-[2rem] rounded-full', TYPE_COLORS[server.type] || 'bg-gray-400')} />
          <div>
            <h3 className="font-semibold text-gray-900 dark:text-white leading-tight">{server.name}</h3>
            <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5 capitalize">
              {server.type} {server.version}
            </p>
          </div>
        </div>
        <StatusBadge status={server.status} />
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3 mb-4">
        <div className="flex flex-col items-center justify-center bg-gray-50 dark:bg-gray-800/60 rounded-lg p-2">
          <Users size={14} className="text-gray-400 mb-1" />
          <span className="text-sm font-semibold text-gray-900 dark:text-white">
            {server.status === 'running' ? `${server.playerCount || 0}/${server.maxPlayers}` : '—'}
          </span>
          <span className="text-[10px] text-gray-400">{t('serverCard.players')}</span>
        </div>
        <div className="flex flex-col items-center justify-center bg-gray-50 dark:bg-gray-800/60 rounded-lg p-2">
          <HardDrive size={14} className="text-gray-400 mb-1" />
          <span className="text-sm font-semibold text-gray-900 dark:text-white">
            {server.maxMemory >= 1024 ? `${(server.maxMemory / 1024).toFixed(1)}G` : `${server.maxMemory}M`}
          </span>
          <span className="text-[10px] text-gray-400">{t('serverCard.maxRam')}</span>
        </div>
        <div className="flex flex-col items-center justify-center bg-gray-50 dark:bg-gray-800/60 rounded-lg p-2">
          <Cpu size={14} className="text-gray-400 mb-1" />
          <span className="text-sm font-semibold text-gray-900 dark:text-white">{server.port}</span>
          <span className="text-[10px] text-gray-400">{t('serverCard.port')}</span>
        </div>
      </div>

      {/* Actions */}
      <div className="flex gap-2" onClick={e => e.stopPropagation()}>
        {isSleeping && (
          <button
            className="btn-primary btn-sm flex-1 justify-center"
            onClick={e => action(e, 'start')}
          >
            <Moon size={12} />
            {t('serverCard.wake')}
          </button>
        )}
        {canStart && (
          <button
            className="btn-primary btn-sm flex-1 justify-center"
            onClick={e => action(e, 'start')}
            disabled={server.status === 'installing'}
          >
            <Play size={12} />
            {t('serverCard.start')}
          </button>
        )}
        {canStop && (
          <button
            className="btn-danger btn-sm flex-1 justify-center"
            onClick={e => action(e, 'stop')}
          >
            <Square size={12} />
            {t('serverCard.stop')}
          </button>
        )}
        {canRestart && (
          <button
            className="btn-secondary btn-sm"
            onClick={e => action(e, 'restart')}
            title={t('serverCard.restart')}
          >
            <RotateCcw size={12} />
          </button>
        )}
      </div>
    </div>
  )
}
