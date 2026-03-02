import { useEffect, useState } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { ThemeProvider } from './contexts/ThemeContext'
import { useAppStore } from './stores/useAppStore'
import { useGlobalSocket } from './hooks/useSocket'
import Layout from './components/Layout'
import Dashboard from './pages/Dashboard'
import ServerDetail from './pages/ServerDetail'
import LoginPage from './pages/LoginPage'
import Onboarding from './pages/Onboarding'

function AuthGate({ children }) {
  const [auth, setAuth] = useState(null) // null = loading
  const [showOnboarding, setShowOnboarding] = useState(false)

  useEffect(() => {
    fetch('/api/auth/status')
      .then(r => r.json())
      .then(setAuth)
      .catch(() => setAuth({ authenticated: false, needsSetup: false }))
  }, [])

  if (auth === null) {
    return (
      <div className="h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (!auth.authenticated) {
    return (
      <LoginPage
        onLogin={(firstTime) => {
          setAuth({ authenticated: true })
          if (firstTime) setShowOnboarding(true)
        }}
        needsSetup={auth.needsSetup}
      />
    )
  }

  if (showOnboarding) {
    return <Onboarding onDone={() => setShowOnboarding(false)} />
  }

  return children
}

function AppInner() {
  const fetchServers = useAppStore(s => s.fetchServers)
  useGlobalSocket()

  useEffect(() => {
    fetchServers()
    const interval = setInterval(fetchServers, 30000)
    return () => clearInterval(interval)
  }, [fetchServers])

  return (
    <Layout>
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/server/:id" element={<ServerDetail />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Layout>
  )
}

export default function App() {
  return (
    <ThemeProvider>
      <BrowserRouter>
        <AuthGate>
          <AppInner />
        </AuthGate>
      </BrowserRouter>
    </ThemeProvider>
  )
}
