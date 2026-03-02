import { useState, useEffect, useRef } from 'react'
import { X, Download, Upload, FolderOpen } from 'lucide-react'
import { useAppStore } from '../stores/useAppStore'
import { useTranslation } from 'react-i18next'

const SERVER_TYPE_IDS = ['paper', 'vanilla', 'fabric']
const SERVER_TYPE_COLORS = { paper: 'bg-yellow-400', vanilla: 'bg-gray-400', fabric: 'bg-indigo-400' }

export default function CreateServerModal({ onClose }) {
  const { t } = useTranslation()
  const addServer = useAppStore(s => s.addServer)
  const [mode, setMode] = useState('fresh') // 'fresh' | 'import'

  // Fresh mode state
  const [step, setStep] = useState(1)
  const [type, setType] = useState('paper')
  const [versions, setVersions] = useState([])
  const [loadingVersions, setLoadingVersions] = useState(false)
  const [form, setForm] = useState({
    name: '',
    version: '',
    port: 25565,
    minMemory: 512,
    maxMemory: 2048,
    javaPath: 'java',
    maxPlayers: 20,
  })
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState('')

  // Import mode state
  const [importForm, setImportForm] = useState({
    name: '',
    type: 'auto',
    version: '',
    port: 25565,
    maxPlayers: 20,
    minMemory: 512,
    maxMemory: 2048,
    javaPath: 'java',
  })
  const [importFile, setImportFile] = useState(null)
  const [importing, setImporting] = useState(false)
  const fileInputRef = useRef(null)

  // Fetch available port on mount for both modes
  useEffect(() => {
    fetch('/api/servers/available-port')
      .then(r => r.json())
      .then(d => {
        if (d.port) {
          setForm(f => ({ ...f, port: d.port }))
          setImportForm(f => ({ ...f, port: d.port }))
        }
      })
      .catch(() => {})
  }, [])

  // Fresh mode: load versions when type changes
  useEffect(() => {
    if (mode !== 'fresh') return
    setLoadingVersions(true)
    setForm(f => ({ ...f, version: '' }))
    fetch(`/api/servers/versions?type=${type}`)
      .then(r => r.json())
      .then(v => {
        setVersions(Array.isArray(v) ? v : [])
        setForm(f => ({ ...f, version: Array.isArray(v) && v.length > 0 ? v[0] : '' }))
      })
      .catch(() => setVersions([]))
      .finally(() => setLoadingVersions(false))
  }, [type, mode])

  function set(key, val) {
    setForm(f => ({ ...f, [key]: val }))
  }

  function setImport(key, val) {
    setImportForm(f => ({ ...f, [key]: val }))
  }

  function handleFileChange(e) {
    const file = e.target.files[0]
    if (!file) return
    setImportFile(file)
    // Pre-fill name from filename (strip .zip extension)
    if (!importForm.name) {
      const nameFromFile = file.name.replace(/\.zip$/i, '').replace(/[-_]/g, ' ')
      setImportForm(f => ({ ...f, name: nameFromFile }))
    }
  }

  async function handleCreate() {
    if (!form.name.trim()) return setError(t('createServer.errorNameRequired'))
    if (!form.version) return setError(t('createServer.errorSelectVersion'))
    setError('')
    setCreating(true)
    try {
      const res = await fetch('/api/servers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, type }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      addServer(data)
      onClose()
    } catch (err) {
      setError(err.message)
    } finally {
      setCreating(false)
    }
  }

  async function handleImport() {
    if (!importFile) return setError(t('createServer.errorSelectZip'))
    if (!importForm.name.trim()) return setError(t('createServer.errorNameRequired'))
    setError('')
    setImporting(true)
    try {
      const fd = new FormData()
      fd.append('file', importFile)
      fd.append('name', importForm.name.trim())
      fd.append('type', importForm.type === 'auto' ? '' : importForm.type)
      fd.append('version', importForm.version)
      fd.append('port', String(importForm.port))
      fd.append('maxPlayers', String(importForm.maxPlayers))
      fd.append('minMemory', String(importForm.minMemory))
      fd.append('maxMemory', String(importForm.maxMemory))
      fd.append('javaPath', importForm.javaPath)

      const res = await fetch('/api/servers/import', { method: 'POST', body: fd })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      addServer(data)
      onClose()
    } catch (err) {
      setError(err.message)
    } finally {
      setImporting(false)
    }
  }

  const isImportMode = mode === 'import'

  const IMPORT_TYPES = [
    { id: 'auto', label: t('createServer.autoDetect'), desc: t('createServer.autoDetectDesc') },
    ...SERVER_TYPE_IDS.map(id => ({
      id,
      label: t(`createServer.serverTypes.${id}.label`),
      desc: t(`createServer.serverTypes.${id}.desc`),
    })),
  ]

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative card w-full max-w-lg fade-in shadow-2xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-gray-200 dark:border-gray-800 flex-shrink-0">
          <div>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">{t('createServer.title')}</h2>
            <p className="text-sm text-gray-400 mt-0.5">
              {isImportMode ? t('createServer.importZip') : t('createServer.stepOf', { step })}
            </p>
          </div>
          <button onClick={onClose} className="btn-ghost btn-icon">
            <X size={18} />
          </button>
        </div>

        <div className="p-5 overflow-y-auto flex-1">
          {/* Mode picker */}
          <div className="grid grid-cols-2 gap-3 mb-5">
            <button
              onClick={() => { setMode('fresh'); setError('') }}
              className={`flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-colors text-center ${
                mode === 'fresh'
                  ? 'border-brand-500 bg-brand-50 dark:bg-brand-900/20'
                  : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
              }`}
            >
              <Download size={20} className={mode === 'fresh' ? 'text-brand-500' : 'text-gray-400'} />
              <div>
                <p className={`text-sm font-medium ${mode === 'fresh' ? 'text-brand-700 dark:text-brand-300' : 'text-gray-700 dark:text-gray-300'}`}>
                  {t('createServer.freshInstall')}
                </p>
                <p className="text-xs text-gray-400 mt-0.5">{t('createServer.freshInstallDesc')}</p>
              </div>
            </button>
            <button
              onClick={() => { setMode('import'); setError('') }}
              className={`flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-colors text-center ${
                mode === 'import'
                  ? 'border-brand-500 bg-brand-50 dark:bg-brand-900/20'
                  : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
              }`}
            >
              <Upload size={20} className={mode === 'import' ? 'text-brand-500' : 'text-gray-400'} />
              <div>
                <p className={`text-sm font-medium ${mode === 'import' ? 'text-brand-700 dark:text-brand-300' : 'text-gray-700 dark:text-gray-300'}`}>
                  {t('createServer.importZipMode')}
                </p>
                <p className="text-xs text-gray-400 mt-0.5">{t('createServer.importZipDesc')}</p>
              </div>
            </button>
          </div>

          {/* ── Import form ── */}
          {isImportMode && (
            <div className="space-y-4">
              {/* ZIP file picker */}
              <div>
                <label className="label">{t('createServer.zipFile')}</label>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".zip"
                  className="hidden"
                  onChange={handleFileChange}
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg border-2 border-dashed transition-colors text-sm ${
                    importFile
                      ? 'border-brand-400 bg-brand-50 dark:bg-brand-900/20 text-brand-700 dark:text-brand-300'
                      : 'border-gray-300 dark:border-gray-600 hover:border-brand-400 text-gray-500 dark:text-gray-400'
                  }`}
                >
                  <FolderOpen size={16} className="flex-shrink-0" />
                  <span className="truncate">
                    {importFile ? importFile.name : t('createServer.selectZip')}
                  </span>
                </button>
              </div>

              <div>
                <label className="label">{t('createServer.serverName')}</label>
                <input
                  className="input"
                  placeholder={t('createServer.serverNamePlaceholder')}
                  value={importForm.name}
                  onChange={e => setImport('name', e.target.value)}
                  autoFocus
                />
              </div>

              <div>
                <label className="label">{t('createServer.serverType')}</label>
                <div className="grid grid-cols-2 gap-2">
                  {IMPORT_TYPES.map(t_ => (
                    <button
                      key={t_.id}
                      type="button"
                      onClick={() => setImport('type', t_.id)}
                      className={`px-3 py-2 rounded-lg border text-sm text-left transition-colors ${
                        importForm.type === t_.id
                          ? 'border-brand-500 bg-brand-50 dark:bg-brand-900/20 text-brand-700 dark:text-brand-300 font-medium'
                          : 'border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:border-gray-300 dark:hover:border-gray-600'
                      }`}
                    >
                      {t_.label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="label">{t('createServer.version')}</label>
                <input
                  className="input"
                  placeholder={t('createServer.autoDetectVersion')}
                  value={importForm.version}
                  onChange={e => setImport('version', e.target.value)}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label">{t('createServer.port')}</label>
                  <input
                    type="number"
                    className="input"
                    value={importForm.port}
                    onChange={e => setImport('port', Number(e.target.value))}
                  />
                </div>
                <div>
                  <label className="label">{t('createServer.maxPlayers')}</label>
                  <input
                    type="number"
                    className="input"
                    value={importForm.maxPlayers}
                    onChange={e => setImport('maxPlayers', Number(e.target.value))}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label">{t('createServer.minRam')}</label>
                  <input
                    type="number"
                    className="input"
                    value={importForm.minMemory}
                    step={256}
                    onChange={e => setImport('minMemory', Number(e.target.value))}
                  />
                </div>
                <div>
                  <label className="label">{t('createServer.maxRam')}</label>
                  <input
                    type="number"
                    className="input"
                    value={importForm.maxMemory}
                    step={256}
                    onChange={e => setImport('maxMemory', Number(e.target.value))}
                  />
                </div>
              </div>

              <div>
                <label className="label">{t('createServer.javaExecutable')}</label>
                <input
                  className="input"
                  placeholder="java"
                  value={importForm.javaPath}
                  onChange={e => setImport('javaPath', e.target.value)}
                />
              </div>
            </div>
          )}

          {/* ── Fresh install: step 1 ── */}
          {!isImportMode && step === 1 && (
            <div className="space-y-4">
              <div>
                <label className="label">{t('createServer.serverName')}</label>
                <input
                  className="input"
                  placeholder={t('createServer.serverNamePlaceholder')}
                  value={form.name}
                  onChange={e => set('name', e.target.value)}
                  autoFocus
                />
              </div>

              <div>
                <label className="label">{t('createServer.serverType')}</label>
                <div className="space-y-2">
                  {SERVER_TYPE_IDS.map(typeId => (
                    <button
                      key={typeId}
                      onClick={() => setType(typeId)}
                      className={`w-full flex items-center gap-3 p-3 rounded-lg border-2 text-left transition-colors ${
                        type === typeId
                          ? 'border-brand-500 bg-brand-50 dark:bg-brand-900/20 dark:border-brand-600'
                          : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
                      }`}
                    >
                      <span className={`w-3 h-3 rounded-full flex-shrink-0 ${SERVER_TYPE_COLORS[typeId]}`} />
                      <div>
                        <p className="text-sm font-medium text-gray-900 dark:text-white">{t(`createServer.serverTypes.${typeId}.label`)}</p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">{t(`createServer.serverTypes.${typeId}.desc`)}</p>
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="label">{t('createServer.version')}</label>
                {loadingVersions ? (
                  <div className="input flex items-center gap-2 text-gray-400">
                    <span className="w-3 h-3 border border-gray-300 border-t-transparent rounded-full animate-spin" />
                    {t('createServer.loadingVersions')}
                  </div>
                ) : (
                  <select
                    className="input"
                    value={form.version}
                    onChange={e => set('version', e.target.value)}
                  >
                    {versions.map(v => (
                      <option key={v} value={v}>{v}</option>
                    ))}
                  </select>
                )}
              </div>
            </div>
          )}

          {/* ── Fresh install: step 2 ── */}
          {!isImportMode && step === 2 && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label">{t('createServer.port')}</label>
                  <input
                    type="number"
                    className="input"
                    value={form.port}
                    onChange={e => set('port', Number(e.target.value))}
                  />
                </div>
                <div>
                  <label className="label">{t('createServer.maxPlayers')}</label>
                  <input
                    type="number"
                    className="input"
                    value={form.maxPlayers || 20}
                    onChange={e => set('maxPlayers', Number(e.target.value))}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label">{t('createServer.minRam')}</label>
                  <input
                    type="number"
                    className="input"
                    value={form.minMemory}
                    step={256}
                    onChange={e => set('minMemory', Number(e.target.value))}
                  />
                </div>
                <div>
                  <label className="label">{t('createServer.maxRam')}</label>
                  <input
                    type="number"
                    className="input"
                    value={form.maxMemory}
                    step={256}
                    onChange={e => set('maxMemory', Number(e.target.value))}
                  />
                </div>
              </div>

              <div>
                <label className="label">{t('createServer.javaExecutable')}</label>
                <input
                  className="input"
                  placeholder="java"
                  value={form.javaPath}
                  onChange={e => set('javaPath', e.target.value)}
                />
                <p className="text-xs text-gray-400 mt-1">
                  {t('createServer.javaHelp')}
                </p>
              </div>

              <div className="p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
                <p className="text-xs text-blue-700 dark:text-blue-300">
                  <strong>Note:</strong> {t('createServer.jarNote')}
                </p>
              </div>
            </div>
          )}

          {error && (
            <p className="mt-3 text-sm text-red-500 dark:text-red-400">{error}</p>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between p-5 border-t border-gray-200 dark:border-gray-800 flex-shrink-0">
          {!isImportMode && step === 2 ? (
            <button className="btn-secondary" onClick={() => setStep(1)}>{t('createServer.back')}</button>
          ) : (
            <div />
          )}
          <div className="flex gap-2">
            <button className="btn-secondary" onClick={onClose}>{t('createServer.cancel')}</button>

            {isImportMode ? (
              <button
                className="btn-primary"
                onClick={handleImport}
                disabled={importing}
              >
                {importing ? (
                  <>
                    <span className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    {t('createServer.importing')}
                  </>
                ) : (
                  <>
                    <Upload size={14} />
                    {t('createServer.importServer')}
                  </>
                )}
              </button>
            ) : step === 1 ? (
              <button
                className="btn-primary"
                onClick={() => {
                  if (!form.name.trim()) return setError(t('createServer.errorNameRequired'))
                  setError('')
                  setStep(2)
                }}
              >
                {t('createServer.next')}
              </button>
            ) : (
              <button
                className="btn-primary"
                onClick={handleCreate}
                disabled={creating}
              >
                {creating ? (
                  <>
                    <span className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    {t('createServer.creating')}
                  </>
                ) : (
                  <>
                    <Download size={14} />
                    {t('createServer.createDownload')}
                  </>
                )}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
