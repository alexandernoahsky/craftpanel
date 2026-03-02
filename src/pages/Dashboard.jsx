import { useState, useEffect, useRef } from 'react'
import { Plus, Server, Activity, Users, Zap, Cpu, Wifi } from 'lucide-react'
import { useAppStore } from '../stores/useAppStore'
import ServerCard from '../components/ServerCard'
import CreateServerModal from '../components/CreateServerModal'
import { useTranslation } from 'react-i18next'

function StatCard({ icon: Icon, label, value, sub, color = 'text-brand-500' }) {
  return (
    <div className="card p-5">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm text-gray-500 dark:text-gray-400">{label}</p>
          <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1">{value}</p>
          {sub && <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">{sub}</p>}
        </div>
        <div className={`p-2.5 rounded-xl bg-gray-100 dark:bg-gray-800 ${color}`}>
          <Icon size={20} />
        </div>
      </div>
    </div>
  )
}

function fmtBytes(b) {
  if (b >= 1024 * 1024 * 1024) return `${(b / 1024 / 1024 / 1024).toFixed(1)} GB`
  if (b >= 1024 * 1024)        return `${(b / 1024 / 1024).toFixed(0)} MB`
  return `${b} B`
}

function fmtSpeed(bps) {
  if (bps >= 1024 * 1024) return `${(bps / 1024 / 1024).toFixed(1)} MB/s`
  if (bps >= 1024)        return `${(bps / 1024).toFixed(1)} KB/s`
  return `${Math.round(bps)} B/s`
}

export default function Dashboard() {
  const { servers, loading } = useAppStore()
  const { t } = useTranslation()
  const [showCreate, setShowCreate] = useState(false)
  const [sysStats, setSysStats] = useState(null)
  const pollRef = useRef(null)

  useEffect(() => {
    async function fetchStats() {
      try {
        const res = await fetch('/api/system/stats')
        if (res.ok) setSysStats(await res.json())
      } catch {}
    }
    fetchStats()
    pollRef.current = setInterval(fetchStats, 3000)
    return () => clearInterval(pollRef.current)
  }, [])

  const running = servers.filter(s => s.status === 'running').length
  const sleeping = servers.filter(s => s.status === 'sleeping').length
  const totalPlayers = servers.filter(s => s.status === 'running').reduce((a, s) => a + (s.playerCount || 0), 0)
  const totalRam = servers.reduce((a, s) => a + (s.maxMemory || 0), 0)

  const ramUsedVal  = sysStats ? fmtBytes(sysStats.ram.used) : '—'
  const ramSub      = sysStats ? `of ${fmtBytes(sysStats.ram.total)} · ${Math.round(sysStats.ram.used / sysStats.ram.total * 100)}% used` : t('dashboard.loading')
  const netVal      = sysStats?.network.supported ? `↓ ${fmtSpeed(sysStats.network.rxPerSec)}` : '—'
  const netSub      = sysStats?.network.supported ? `↑ ${fmtSpeed(sysStats.network.txPerSec)}` : t('dashboard.networkNotAvailable')

  const runningSub = sleeping > 0
    ? t('dashboard.sleeping', { count: sleeping })
    : t('dashboard.stopped', { count: servers.length - running })

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Page header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{t('dashboard.title')}</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
            {t('dashboard.serversConfigured', { count: servers.length })}
          </p>
        </div>
        <button
          className="btn-primary"
          onClick={() => setShowCreate(true)}
        >
          <Plus size={16} />
          {t('dashboard.newServer')}
        </button>
      </div>

      {/* Server stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
        <StatCard icon={Server} label={t('dashboard.totalServers')} value={servers.length} color="text-blue-500" />
        <StatCard
          icon={Activity}
          label={t('dashboard.running')}
          value={running}
          sub={runningSub}
          color="text-brand-500"
        />
        <StatCard
          icon={Users}
          label={t('dashboard.onlinePlayers')}
          value={totalPlayers}
          sub={t('dashboard.acrossAllServers')}
          color="text-purple-500"
        />
        <StatCard
          icon={Zap}
          label={t('dashboard.allocatedRam')}
          value={totalRam >= 1024 ? `${(totalRam / 1024).toFixed(1)} GB` : `${totalRam} MB`}
          sub={t('dashboard.maxHeap')}
          color="text-orange-500"
        />
      </div>

      {/* System resource stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
        <StatCard icon={Cpu}  label={t('dashboard.systemRam')} value={ramUsedVal} sub={ramSub} color="text-teal-500" />
        <StatCard icon={Wifi} label={t('dashboard.networkIO')} value={netVal}    sub={netSub} color="text-indigo-500" />
      </div>

      {/* Server grid */}
      {loading && servers.length === 0 ? (
        <div className="flex items-center justify-center h-48 text-gray-400">
          <div className="w-6 h-6 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : servers.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-64 text-center fade-in">
          <div className="w-16 h-16 bg-gray-100 dark:bg-gray-800 rounded-2xl flex items-center justify-center mb-4">
            <Server size={32} className="text-gray-400" />
          </div>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">{t('dashboard.noServers')}</h3>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 mb-4">
            {t('dashboard.noServersDesc')}
          </p>
          <button className="btn-primary" onClick={() => setShowCreate(true)}>
            <Plus size={16} />
            {t('dashboard.createServer')}
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {servers.map(server => (
            <ServerCard key={server.id} server={server} />
          ))}
          <button
            onClick={() => setShowCreate(true)}
            className="flex flex-col items-center justify-center h-48 rounded-xl border-2 border-dashed border-gray-200 dark:border-gray-800 hover:border-brand-400 dark:hover:border-brand-700 text-gray-400 dark:text-gray-600 hover:text-brand-500 dark:hover:text-brand-400 transition-colors cursor-pointer"
          >
            <Plus size={24} className="mb-2" />
            <span className="text-sm font-medium">{t('dashboard.addServer')}</span>
          </button>
        </div>
      )}

      {showCreate && <CreateServerModal onClose={() => setShowCreate(false)} />}
    </div>
  )
}
