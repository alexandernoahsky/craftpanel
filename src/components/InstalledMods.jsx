import { useState, useEffect } from 'react'
import { Package, Trash2, RefreshCw, HardDrive } from 'lucide-react'
import { useTranslation } from 'react-i18next'

function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export default function InstalledMods({ serverId }) {
  const { t } = useTranslation()
  const [mods, setMods] = useState([])
  const [loading, setLoading] = useState(true)
  const [deleting, setDeleting] = useState(null)

  async function load() {
    setLoading(true)
    try {
      const res = await fetch(`/api/mods/server/${serverId}`)
      if (res.ok) setMods(await res.json())
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [serverId])

  async function deleteMod(filename) {
    setDeleting(filename)
    try {
      await fetch(`/api/mods/server/${serverId}/${encodeURIComponent(filename)}`, { method: 'DELETE' })
      setMods(m => m.filter(mod => mod.filename !== filename))
    } finally {
      setDeleting(null)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-32 text-gray-400">
        <div className="w-6 h-6 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <p className="text-sm text-gray-500 dark:text-gray-400">
          {t('installedMods.count', { count: mods.length })}
        </p>
        <button className="btn-ghost btn-sm" onClick={load}>
          <RefreshCw size={12} />
          {t('installedMods.refresh')}
        </button>
      </div>

      {mods.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-32 text-gray-400 border-2 border-dashed border-gray-200 dark:border-gray-800 rounded-xl">
          <Package size={28} className="mb-2 opacity-40" />
          <p className="text-sm">{t('installedMods.noModsInstalled')}</p>
          <p className="text-xs mt-0.5">{t('installedMods.noModsDesc')}</p>
        </div>
      ) : (
        <div className="space-y-2">
          {mods.map(mod => (
            <div
              key={mod.filename}
              className="flex items-center gap-3 p-3 rounded-lg border border-gray-200 dark:border-gray-800 hover:border-gray-300 dark:hover:border-gray-700 transition-colors"
            >
              <div className="w-8 h-8 bg-gray-100 dark:bg-gray-800 rounded-lg flex items-center justify-center flex-shrink-0">
                <Package size={14} className="text-gray-400" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 dark:text-white truncate">{mod.filename}</p>
                <div className="flex items-center gap-2 mt-0.5">
                  <HardDrive size={10} className="text-gray-400" />
                  <span className="text-xs text-gray-400">{formatBytes(mod.size)}</span>
                  <span className="text-gray-300 dark:text-gray-700">·</span>
                  <span className="text-xs text-gray-400">
                    {new Date(mod.installedAt).toLocaleDateString()}
                  </span>
                </div>
              </div>
              <button
                className="btn-ghost btn-sm text-gray-400 hover:text-red-500 dark:hover:text-red-400"
                onClick={() => deleteMod(mod.filename)}
                disabled={deleting === mod.filename}
                title={t('installedMods.removeMod')}
              >
                {deleting === mod.filename ? (
                  <span className="w-3 h-3 border border-current border-t-transparent rounded-full animate-spin" />
                ) : (
                  <Trash2 size={14} />
                )}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
