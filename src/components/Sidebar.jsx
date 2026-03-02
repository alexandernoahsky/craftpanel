import { NavLink, useNavigate } from 'react-router-dom'
import { LayoutDashboard, Server, Moon, Sun, LogOut, Globe } from 'lucide-react'
import { useTheme } from '../contexts/ThemeContext'
import { useAppStore } from '../stores/useAppStore'
import { disconnectSocket } from '../hooks/useSocket'
import { useTranslation } from 'react-i18next'
import clsx from 'clsx'

const LANGUAGES = [
  { code: 'en', label: 'English' },
  { code: 'zh', label: '中文' },
  { code: 'fr', label: 'Français' },
  { code: 'ko', label: '한국어' },
  { code: 'es', label: 'Español' },
]

function StatusDot({ status }) {
  const colors = {
    running: 'bg-brand-500',
    starting: 'bg-yellow-400 pulse-dot',
    stopping: 'bg-orange-400 pulse-dot',
    stopped: 'bg-gray-400',
    installing: 'bg-blue-400 pulse-dot',
    error: 'bg-red-500',
  }
  return <span className={clsx('w-2 h-2 rounded-full flex-shrink-0', colors[status] || 'bg-gray-400')} />
}

export default function Sidebar() {
  const { theme, toggle } = useTheme()
  const servers = useAppStore(s => s.servers)
  const navigate = useNavigate()
  const { t, i18n } = useTranslation()

  async function handleLogout() {
    await fetch('/api/auth/logout', { method: 'POST' })
    disconnectSocket()
    window.location.reload()
  }

  return (
    <aside className="w-60 flex flex-col h-full bg-white dark:bg-gray-900 border-r border-gray-200 dark:border-gray-800 flex-shrink-0">
      {/* Logo */}
      <div className="flex items-center gap-3 px-4 py-5 border-b border-gray-200 dark:border-gray-800">
        <div className="w-8 h-8 bg-brand-500 rounded-lg flex items-center justify-center flex-shrink-0">
          <Server size={16} className="text-white" />
        </div>
        <div>
          <span className="font-bold text-gray-900 dark:text-white text-sm">{t('app.name')}</span>
          <p className="text-[10px] text-gray-400 dark:text-gray-500">{t('app.tagline')}</p>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto p-3 space-y-1">
        <NavLink
          to="/"
          end
          className={({ isActive }) => clsx(
            'flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors',
            isActive
              ? 'bg-brand-50 text-brand-700 dark:bg-brand-900/30 dark:text-brand-400'
              : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-gray-900 dark:hover:text-gray-100'
          )}
        >
          <LayoutDashboard size={16} />
          {t('sidebar.dashboard')}
        </NavLink>

        {/* Servers list */}
        {servers.length > 0 && (
          <div className="pt-2">
            <p className="px-3 mb-1 text-[10px] font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-600">
              {t('sidebar.servers')}
            </p>
            {servers.map(server => (
              <NavLink
                key={server.id}
                to={`/server/${server.id}`}
                className={({ isActive }) => clsx(
                  'flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-colors group',
                  isActive
                    ? 'bg-brand-50 text-brand-700 dark:bg-brand-900/30 dark:text-brand-400'
                    : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-gray-900 dark:hover:text-gray-100'
                )}
              >
                <StatusDot status={server.status} />
                <span className="truncate flex-1">{server.name}</span>
                {server.status === 'running' && (
                  <span className="text-[10px] text-gray-400 dark:text-gray-500 group-hover:text-gray-500">
                    {server.playerCount}/{server.maxPlayers}
                  </span>
                )}
              </NavLink>
            ))}
          </div>
        )}
      </nav>

      {/* Bottom actions */}
      <div className="p-3 border-t border-gray-200 dark:border-gray-800 space-y-1">
        {/* Language switcher */}
        <div className="flex items-center gap-2 px-3 py-2 text-sm text-gray-600 dark:text-gray-400">
          <Globe size={16} className="flex-shrink-0" />
          <select
            value={i18n.resolvedLanguage}
            onChange={e => i18n.changeLanguage(e.target.value)}
            className="flex-1 bg-transparent text-sm text-gray-600 dark:text-gray-400 focus:outline-none cursor-pointer"
          >
            {LANGUAGES.map(l => (
              <option key={l.code} value={l.code}>{l.label}</option>
            ))}
          </select>
        </div>

        <button
          onClick={toggle}
          className="flex items-center gap-3 w-full px-3 py-2 rounded-lg text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-gray-900 dark:hover:text-gray-100 transition-colors"
        >
          {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
          {theme === 'dark' ? t('sidebar.lightMode') : t('sidebar.darkMode')}
        </button>
        <button
          onClick={handleLogout}
          className="flex items-center gap-3 w-full px-3 py-2 rounded-lg text-sm text-gray-600 dark:text-gray-400 hover:bg-red-50 dark:hover:bg-red-900/20 hover:text-red-600 dark:hover:text-red-400 transition-colors"
        >
          <LogOut size={16} />
          {t('sidebar.signOut')}
        </button>
      </div>
    </aside>
  )
}
