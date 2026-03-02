import { useState } from 'react'
import { useTheme } from '../contexts/ThemeContext'
import { Moon, Sun, Eye, EyeOff, Server } from 'lucide-react'
import { useTranslation } from 'react-i18next'

export default function LoginPage({ onLogin, needsSetup }) {
  const { theme, toggle } = useTheme()
  const { t } = useTranslation()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [showPw, setShowPw] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    if (!username.trim() || !password.trim()) return
    setError('')
    setLoading(true)
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      })
      const data = await res.json()
      if (res.ok) {
        onLogin(data.firstTime || false)
      } else {
        setError(data.error || t('auth.loginFailed'))
      }
    } catch {
      setError(t('auth.connectionError'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 dark:bg-gray-950 p-4">
      <button
        onClick={toggle}
        className="fixed top-4 right-4 btn-icon btn-ghost"
        aria-label="Toggle theme"
      >
        {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
      </button>

      <div className="w-full max-w-sm fade-in">
        <div className="flex flex-col items-center mb-8">
          <div className="w-16 h-16 bg-brand-500 rounded-2xl flex items-center justify-center mb-4 shadow-lg">
            <Server size={32} className="text-white" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{t('app.name')}</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            {needsSetup ? t('auth.createAccount') : t('auth.signIn')}
          </p>
        </div>

        <div className="card p-6">
          {needsSetup && (
            <div className="mb-4 p-3 bg-brand-50 dark:bg-brand-900/20 border border-brand-200 dark:border-brand-800 rounded-lg">
              <p className="text-sm text-brand-700 dark:text-brand-300 font-medium">{t('auth.firstTimeSetup')}</p>
              <p className="text-xs text-brand-600 dark:text-brand-400 mt-0.5">
                {t('auth.firstTimeDesc')}
              </p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="label">{needsSetup ? t('auth.createUsername') : t('auth.username')}</label>
              <input
                type="text"
                value={username}
                onChange={e => setUsername(e.target.value)}
                placeholder={t('auth.enterUsername')}
                className="input"
                autoFocus
                autoComplete="username"
              />
            </div>

            <div>
              <label className="label">{needsSetup ? t('auth.createPassword') : t('auth.password')}</label>
              <div className="relative">
                <input
                  type={showPw ? 'text' : 'password'}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder={t('auth.enterPassword')}
                  className="input pr-10"
                  autoComplete={needsSetup ? 'new-password' : 'current-password'}
                />
                <button
                  type="button"
                  onClick={() => setShowPw(v => !v)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
                >
                  {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            {error && (
              <p className="text-sm text-red-500 dark:text-red-400">{error}</p>
            )}

            <button
              type="submit"
              className="btn-primary w-full justify-center"
              disabled={loading || !username.trim() || !password.trim()}
            >
              {loading ? (
                <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : null}
              {needsSetup ? t('auth.createAccountButton') : t('auth.signInButton')}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
