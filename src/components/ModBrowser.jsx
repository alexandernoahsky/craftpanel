import { useState, useEffect, useRef, useCallback } from 'react'
import { Search, Download, X, ChevronDown, Package } from 'lucide-react'
import { useTranslation } from 'react-i18next'

const CATEGORY_IDS = ['', 'optimization', 'adventure', 'technology', 'food', 'decoration', 'storage', 'utility', 'mobs', 'worldgen']

const LOADERS = [
  { id: 'paper', label: 'Paper' },
  { id: 'vanilla', label: 'Vanilla' },
  { id: 'fabric', label: 'Fabric' },
  { id: 'forge', label: 'Forge' },
]

function ModCard({ mod, onInstall, serverId, serverVersion }) {
  const { t } = useTranslation()
  const [versions, setVersions] = useState([])
  const [selectedVersion, setSelectedVersion] = useState('')
  const [expanded, setExpanded] = useState(false)
  const [installing, setInstalling] = useState(false)
  const [installed, setInstalled] = useState(false)

  async function loadVersions() {
    if (versions.length > 0) return
    try {
      const res = await fetch(`/api/mods/project/${mod.slug}`)
      const data = await res.json()
      const filtered = (data.versions || []).filter(v =>
        (!serverVersion || v.game_versions?.includes(serverVersion))
      )
      setVersions(filtered)
      if (filtered.length > 0) setSelectedVersion(filtered[0].id)
    } catch {}
  }

  async function handleInstall() {
    if (!selectedVersion) return
    setInstalling(true)
    try {
      const res = await fetch(`/api/mods/server/${serverId}/install`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ versionId: selectedVersion }),
      })
      if (res.ok) {
        setInstalled(true)
        onInstall()
      }
    } finally {
      setInstalling(false)
    }
  }

  return (
    <div className="card p-4 hover:shadow-md transition-shadow">
      <div className="flex items-start gap-3">
        {mod.icon_url ? (
          <img src={mod.icon_url} alt={mod.title} className="w-12 h-12 rounded-xl object-cover flex-shrink-0" />
        ) : (
          <div className="w-12 h-12 bg-gray-100 dark:bg-gray-800 rounded-xl flex items-center justify-center flex-shrink-0">
            <Package size={20} className="text-gray-400" />
          </div>
        )}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div>
              <h3 className="text-sm font-semibold text-gray-900 dark:text-white truncate">{mod.title}</h3>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 line-clamp-2">{mod.description}</p>
            </div>
          </div>
          <div className="flex items-center gap-3 mt-2">
            <span className="text-xs text-gray-400">
              ⬇ {mod.downloads?.toLocaleString()}
            </span>
            {mod.categories?.slice(0, 2).map(c => (
              <span key={c} className="badge bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 text-[10px]">{c}</span>
            ))}
          </div>
        </div>
      </div>

      {/* Version selector + install */}
      <div className="mt-3 flex items-center gap-2">
        <button
          className="btn-secondary btn-sm flex-1 justify-between"
          onClick={() => { setExpanded(e => !e); loadVersions() }}
        >
          <span className="truncate">
            {versions.length === 0 ? t('mods.selectVersion') : (versions.find(v => v.id === selectedVersion)?.name || t('mods.selectVersion'))}
          </span>
          <ChevronDown size={12} className={`flex-shrink-0 transition-transform ${expanded ? 'rotate-180' : ''}`} />
        </button>
        <button
          className={`btn-sm flex-shrink-0 ${installed ? 'btn-secondary' : 'btn-primary'}`}
          onClick={handleInstall}
          disabled={installing || !selectedVersion || installed}
          title={installed ? t('mods.installed') : t('mods.install')}
        >
          {installing ? (
            <span className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
          ) : (
            <Download size={12} />
          )}
          {installed ? t('mods.installed') : t('mods.install')}
        </button>
      </div>

      {expanded && versions.length > 0 && (
        <div className="mt-2 max-h-32 overflow-y-auto border border-gray-200 dark:border-gray-700 rounded-lg">
          {versions.map(v => (
            <button
              key={v.id}
              onClick={() => { setSelectedVersion(v.id); setExpanded(false) }}
              className={`w-full text-left px-3 py-2 text-xs hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors ${
                selectedVersion === v.id ? 'text-brand-600 dark:text-brand-400 bg-brand-50 dark:bg-brand-900/20' : 'text-gray-700 dark:text-gray-300'
              }`}
            >
              <span className="font-medium">{v.name}</span>
              <span className="text-gray-400 ml-2">{v.game_versions?.join(', ')}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

export default function ModBrowser({ serverId, server, onInstalled }) {
  const { t } = useTranslation()
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState('')
  const [sort, setSort] = useState('')
  const [loaderType, setLoaderType] = useState(server?.type || 'paper')
  const [results, setResults] = useState([])
  const [loading, setLoading] = useState(false)
  const [offset, setOffset] = useState(0)
  const [total, setTotal] = useState(0)
  const debounceRef = useRef(null)
  const sentinelRef = useRef(null)
  const canLoadMore = results.length < total && !loading

  const CATEGORIES = CATEGORY_IDS.map(id => ({
    id,
    label: id === '' ? t('mods.categories.all') : t(`mods.categories.${id}`),
  }))

  const search = useCallback(async (q, cat, off, sortVal, loader) => {
    setLoading(true)
    try {
      const params = new URLSearchParams({
        query: q,
        offset: off,
        game_version: server?.version || '',
        server_type: loader,
        ...(cat ? { category: cat } : {}),
        ...(sortVal ? { sort: sortVal } : {}),
      })
      const res = await fetch(`/api/mods/search?${params}`)
      const data = await res.json()
      if (off === 0) {
        setResults(data.hits || [])
      } else {
        setResults(prev => [...prev, ...(data.hits || [])])
      }
      setTotal(data.total_hits || 0)
      setOffset(off)
    } finally {
      setLoading(false)
    }
  }, [server?.version])

  // Debounced re-search on any filter change
  useEffect(() => {
    clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => search(query, category, 0, sort, loaderType), 400)
    return () => clearTimeout(debounceRef.current)
  }, [query, category, sort, loaderType, search])

  // Infinite scroll via IntersectionObserver
  useEffect(() => {
    if (!sentinelRef.current) return
    const observer = new IntersectionObserver(
      entries => {
        if (entries[0].isIntersecting && canLoadMore) {
          search(query, category, offset + 20, sort, loaderType)
        }
      },
      { threshold: 0.1 }
    )
    observer.observe(sentinelRef.current)
    return () => observer.disconnect()
  }, [canLoadMore, query, category, offset, sort, loaderType, search])

  return (
    <div className="flex flex-col h-full">
      {/* Search bar + sort */}
      <div className="flex gap-2 mb-3">
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            className="input pl-9"
            placeholder={t('mods.searchPlaceholder')}
            value={query}
            onChange={e => setQuery(e.target.value)}
            autoFocus
          />
          {query && (
            <button
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              onClick={() => setQuery('')}
            >
              <X size={14} />
            </button>
          )}
        </div>
        <select
          className="input w-36 flex-shrink-0"
          value={sort}
          onChange={e => setSort(e.target.value)}
        >
          <option value="">{t('mods.sortRelevance')}</option>
          <option value="downloads">{t('mods.sortDownloads')}</option>
          <option value="newest">{t('mods.sortNewest')}</option>
        </select>
      </div>

      {/* Loader chips */}
      <p className="text-xs text-gray-400 mb-1">
        {t('mods.browsingFor')}{' '}
        <span className="font-medium text-gray-700 dark:text-gray-200 capitalize">{loaderType}</span>
        {loaderType !== server?.type && (
          <span> · {t('mods.serverIs')} <span className="capitalize">{server?.type}</span></span>
        )}
      </p>
      <div className="flex gap-1.5 overflow-x-auto pb-1 mb-2 scrollbar-none flex-shrink-0">
        {LOADERS.map(l => (
          <button
            key={l.id}
            onClick={() => { setLoaderType(l.id); setCategory('') }}
            className={`px-3 py-1 rounded-full text-xs font-medium whitespace-nowrap transition-colors flex-shrink-0 ${
              loaderType === l.id
                ? 'bg-brand-500 text-white'
                : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700'
            }`}
          >
            {l.label}
          </button>
        ))}
      </div>

      {/* Category chips */}
      <div className="flex gap-1.5 overflow-x-auto pb-2 mb-3 scrollbar-none flex-shrink-0">
        {CATEGORIES.map(cat => (
          <button
            key={cat.id}
            onClick={() => setCategory(cat.id)}
            className={`px-3 py-1 rounded-full text-xs font-medium whitespace-nowrap transition-colors flex-shrink-0 ${
              category === cat.id
                ? 'bg-brand-500 text-white'
                : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700'
            }`}
          >
            {cat.label}
          </button>
        ))}
      </div>

      {/* Result count */}
      {total > 0 && (
        <p className="text-xs text-gray-400 mb-3">{t('mods.results', { count: total })}</p>
      )}

      <div className="flex-1 overflow-y-auto space-y-3">
        {loading && results.length === 0 ? (
          <div className="flex items-center justify-center h-32 text-gray-400">
            <div className="w-6 h-6 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : results.length === 0 && !loading ? (
          <div className="flex flex-col items-center justify-center h-32 text-gray-400">
            <Package size={32} className="mb-2 opacity-40" />
            <p className="text-sm">{t('mods.noModsFound')}</p>
          </div>
        ) : (
          <>
            {results.map(mod => (
              <ModCard
                key={mod.project_id}
                mod={mod}
                serverId={serverId}
                serverVersion={server?.version}
                serverType={server?.type}
                onInstall={onInstalled}
              />
            ))}

            {/* Sentinel for infinite scroll */}
            <div ref={sentinelRef} className="h-4" />

            {/* Inline load spinner */}
            {loading && results.length > 0 && (
              <div className="flex items-center justify-center py-4">
                <div className="w-5 h-5 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
              </div>
            )}

            {!loading && results.length >= total && total > 0 && (
              <p className="text-center text-xs text-gray-400 py-4">{t('mods.allResultsLoaded')}</p>
            )}
          </>
        )}
      </div>
    </div>
  )
}
