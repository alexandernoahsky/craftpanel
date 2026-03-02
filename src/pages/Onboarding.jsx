import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Server, Zap, Layers, Download, CheckCircle } from 'lucide-react'
import { useAppStore } from '../stores/useAppStore'
import { useTranslation } from 'react-i18next'

const SERVER_TYPE_ICONS = {
  paper: Zap,
  vanilla: Server,
  fabric: Layers,
}

const SERVER_TYPE_COLORS = {
  paper:   { color: 'bg-yellow-400', iconColor: 'text-yellow-500', borderColor: 'border-yellow-400' },
  vanilla: { color: 'bg-gray-400',   iconColor: 'text-gray-500',   borderColor: 'border-gray-400' },
  fabric:  { color: 'bg-indigo-400', iconColor: 'text-indigo-500', borderColor: 'border-indigo-400' },
}

const SERVER_TYPE_IDS = ['paper', 'vanilla', 'fabric']

export default function Onboarding({ onDone }) {
  const navigate = useNavigate()
  const addServer = useAppStore(s => s.addServer)
  const { t } = useTranslation()

  const [step, setStep] = useState(1) // 1 = type, 2 = configure, 3 = creating
  const [type, setType] = useState('paper')
  const [versions, setVersions] = useState([])
  const [loadingVersions, setLoadingVersions] = useState(false)
  const [form, setForm] = useState({
    name: '',
    version: '',
    port: 25565,
    maxPlayers: 20,
    minMemory: 512,
    maxMemory: 2048,
    javaPath: 'java',
  })
  const [error, setError] = useState('')
  const [createdId, setCreatedId] = useState(null)

  useEffect(() => {
    if (step !== 2) return
    setLoadingVersions(true)
    setForm(f => ({ ...f, version: '' }))
    fetch(`/api/servers/versions?type=${type}`)
      .then(r => r.json())
      .then(v => {
        const list = Array.isArray(v) ? v : []
        setVersions(list)
        setForm(f => ({ ...f, version: list[0] || '' }))
      })
      .catch(() => setVersions([]))
      .finally(() => setLoadingVersions(false))
  }, [type, step])

  function set(key, val) {
    setForm(f => ({ ...f, [key]: val }))
  }

  function skip() {
    onDone()
  }

  async function handleCreate() {
    if (!form.name.trim()) return setError(t('onboarding.errorNameRequired'))
    if (!form.version) return setError(t('onboarding.errorSelectVersion'))
    setError('')
    setStep(3)
    try {
      const res = await fetch('/api/servers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, type }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to create server')
      addServer(data)
      setCreatedId(data.id)
    } catch (err) {
      setError(err.message)
      setStep(2)
    }
  }

  function goToServer() {
    onDone()
    navigate(`/server/${createdId}`)
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 flex items-center justify-center p-4">
      <div className="w-full max-w-2xl fade-in">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="w-14 h-14 bg-brand-500 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg">
            <Server size={28} className="text-white" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{t('onboarding.welcome')}</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            {t('onboarding.welcomeDesc')}
          </p>
        </div>

        {/* Step indicator */}
        {step < 3 && (
          <div className="flex items-center justify-center gap-2 mb-6">
            {[1, 2].map(s => (
              <div key={s} className="flex items-center gap-2">
                <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-semibold transition-colors ${
                  s === step
                    ? 'bg-brand-500 text-white'
                    : s < step
                    ? 'bg-brand-200 dark:bg-brand-800 text-brand-700 dark:text-brand-300'
                    : 'bg-gray-200 dark:bg-gray-700 text-gray-500 dark:text-gray-400'
                }`}>
                  {s}
                </div>
                {s < 2 && (
                  <div className={`w-12 h-0.5 ${s < step ? 'bg-brand-400' : 'bg-gray-200 dark:bg-gray-700'}`} />
                )}
              </div>
            ))}
          </div>
        )}

        <div className="card p-6">
          {/* Step 1: Choose server type */}
          {step === 1 && (
            <>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-1">{t('onboarding.step1Title')}</h2>
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-5">
                {t('onboarding.step1Desc')}
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-6">
                {SERVER_TYPE_IDS.map(typeId => {
                  const Icon = SERVER_TYPE_ICONS[typeId]
                  const colors = SERVER_TYPE_COLORS[typeId]
                  const selected = type === typeId
                  return (
                    <button
                      key={typeId}
                      onClick={() => setType(typeId)}
                      className={`relative flex flex-col items-start gap-3 p-4 rounded-xl border-2 text-left transition-all ${
                        selected
                          ? 'border-brand-500 bg-brand-50 dark:bg-brand-900/20'
                          : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
                      }`}
                    >
                      {typeId === 'paper' && (
                        <span className="absolute top-2 right-2 text-[10px] font-semibold bg-brand-100 dark:bg-brand-900/40 text-brand-600 dark:text-brand-400 px-1.5 py-0.5 rounded-full">
                          {t('onboarding.recommended')}
                        </span>
                      )}
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${selected ? 'bg-brand-100 dark:bg-brand-900/40' : 'bg-gray-100 dark:bg-gray-800'}`}>
                        <Icon size={20} className={selected ? 'text-brand-600 dark:text-brand-400' : colors.iconColor} />
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-gray-900 dark:text-white">{t(`onboarding.serverTypes.${typeId}.label`)}</p>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 leading-snug">{t(`onboarding.serverTypes.${typeId}.desc`)}</p>
                      </div>
                    </button>
                  )
                })}
              </div>

              <div className="flex items-center justify-between">
                <button onClick={skip} className="text-sm text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors">
                  {t('onboarding.skipForNow')}
                </button>
                <button className="btn-primary" onClick={() => setStep(2)}>
                  {t('onboarding.nextConfigure')}
                </button>
              </div>
            </>
          )}

          {/* Step 2: Configure */}
          {step === 2 && (
            <>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-1">{t('onboarding.step2Title')}</h2>
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-5">
                {t('onboarding.step2Desc')}
              </p>

              <div className="space-y-4">
                <div>
                  <label className="label">{t('onboarding.serverName')}</label>
                  <input
                    className="input"
                    placeholder={t('onboarding.serverNamePlaceholder')}
                    value={form.name}
                    onChange={e => set('name', e.target.value)}
                    autoFocus
                  />
                </div>

                <div>
                  <label className="label">{t('onboarding.version')}</label>
                  {loadingVersions ? (
                    <div className="input flex items-center gap-2 text-gray-400">
                      <span className="w-3 h-3 border border-gray-300 border-t-transparent rounded-full animate-spin" />
                      {t('onboarding.loadingVersions')}
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

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="label">{t('onboarding.port')}</label>
                    <input
                      type="number"
                      className="input"
                      value={form.port}
                      onChange={e => set('port', Number(e.target.value))}
                    />
                  </div>
                  <div>
                    <label className="label">{t('onboarding.maxPlayers')}</label>
                    <input
                      type="number"
                      className="input"
                      value={form.maxPlayers}
                      onChange={e => set('maxPlayers', Number(e.target.value))}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="label">{t('onboarding.minRam')}</label>
                    <input
                      type="number"
                      className="input"
                      value={form.minMemory}
                      step={256}
                      onChange={e => set('minMemory', Number(e.target.value))}
                    />
                  </div>
                  <div>
                    <label className="label">{t('onboarding.maxRam')}</label>
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
                  <label className="label">{t('onboarding.javaExecutable')}</label>
                  <input
                    className="input"
                    placeholder="java"
                    value={form.javaPath}
                    onChange={e => set('javaPath', e.target.value)}
                  />
                  <p className="text-xs text-gray-400 mt-1">
                    {t('onboarding.javaHelp')}
                  </p>
                </div>

                <div className="p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
                  <p className="text-xs text-blue-700 dark:text-blue-300">
                    <strong>Note:</strong> {t('onboarding.jarNote')}
                  </p>
                </div>
              </div>

              {error && (
                <p className="mt-3 text-sm text-red-500 dark:text-red-400">{error}</p>
              )}

              <div className="flex items-center justify-between mt-6">
                <button onClick={skip} className="text-sm text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors">
                  {t('onboarding.skipForNow')}
                </button>
                <div className="flex gap-2">
                  <button className="btn-secondary" onClick={() => setStep(1)}>{t('onboarding.back')}</button>
                  <button className="btn-primary" onClick={handleCreate}>
                    <Download size={14} />
                    {t('onboarding.createServer')}
                  </button>
                </div>
              </div>
            </>
          )}

          {/* Step 3: Creating */}
          {step === 3 && (
            <div className="py-8 flex flex-col items-center text-center">
              {!createdId ? (
                <>
                  <div className="w-16 h-16 border-4 border-brand-500 border-t-transparent rounded-full animate-spin mb-6" />
                  <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">{t('onboarding.creatingTitle')}</h2>
                  <p className="text-sm text-gray-500 dark:text-gray-400" style={{ whiteSpace: 'pre-line' }}>
                    {t('onboarding.creatingDesc')}
                  </p>
                  {error && (
                    <p className="mt-4 text-sm text-red-500 dark:text-red-400">{error}</p>
                  )}
                </>
              ) : (
                <>
                  <div className="w-16 h-16 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mb-6">
                    <CheckCircle size={36} className="text-green-500" />
                  </div>
                  <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">{t('onboarding.createdTitle')}</h2>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
                    {t('onboarding.createdDesc')}
                  </p>
                  <div className="flex gap-3">
                    <button className="btn-secondary" onClick={onDone}>
                      {t('onboarding.goToDashboard')}
                    </button>
                    <button className="btn-primary" onClick={goToServer}>
                      {t('onboarding.openServer')}
                    </button>
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
