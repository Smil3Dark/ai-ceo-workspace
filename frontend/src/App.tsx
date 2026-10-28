import { useEffect, useState } from 'react'
import { NavLink, Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom'
import { api, connectBus } from './api'
import AdminPage from './pages/AdminPage'
import AgentsPage from './pages/AgentsPage'
import ApprovalsPage from './pages/ApprovalsPage'
import ChatPage from './pages/ChatPage'
import ConnectionsPage from './pages/ConnectionsPage'
import CostsPage from './pages/CostsPage'
import CreateAgentPage from './pages/CreateAgentPage'
import HistoryPage from './pages/HistoryPage'
import MemoryPage from './pages/MemoryPage'
import OfficePage from './pages/OfficePage'
import OnboardingPage from './pages/OnboardingPage'
import ProjectsPage from './pages/ProjectsPage'
import SettingsPage from './pages/SettingsPage'
import SimulationPage from './pages/SimulationPage'
import TasksPage from './pages/TasksPage'
import TeamsPage from './pages/TeamsPage'

const NAV = [
  { to: '/chat', label: 'Asistente', icon: '💬' },
  { to: '/agents', label: 'Creación', icon: '🧩' },
  { to: '/office', label: 'Oficina 3D', icon: '🏢' },
  { to: '/admin', label: 'Administrador', icon: '🛠️' },
  { to: '/simulation', label: 'Simulación', icon: '🧪' },
  { to: '/tasks', label: 'Tareas', icon: '📋' },
  { to: '/approvals', label: 'Confirmaciones', icon: '✅' },
  { to: '/memory', label: 'Memoria', icon: '🧠' },
  { to: '/projects', label: 'Proyectos', icon: '🎯' },
  { to: '/connections', label: 'Modelos', icon: '🔌' },
  { to: '/history', label: 'Historial', icon: '📜' },
  { to: '/costs', label: 'Costes', icon: '💰' },
  { to: '/settings', label: 'Ajustes', icon: '⚙️' },
]

export default function App() {
  const [ready, setReady] = useState(false)
  const [onboarded, setOnboarded] = useState(true)
  const [unread, setUnread] = useState(0)
  const [paused, setPaused] = useState(false)
  const [pendingAuth, setPendingAuth] = useState(0)
  const nav = useNavigate()
  const loc = useLocation()

  useEffect(() => {
    api.get<{ onboarding_done: boolean }>('/api/onboarding/status')
      .then((s) => setOnboarded(s.onboarding_done))
      .catch(() => {})
      .finally(() => setReady(true))
    api.get<any[]>('/api/notifications?unread=true').then((n) => setUnread(n.length)).catch(() => {})
    api.get<any>('/api/admin/overview').then((o) => {
      setPaused(o.paused); setPendingAuth(o.approvals_pending)
    }).catch(() => {})
    const off = connectBus((type) => {
      if (type === 'notification') {
        setUnread((u) => u + 1)
      }
      if (type === 'system') {
        api.get<any>('/api/system/status').then((s) => setPaused(s.paused)).catch(() => {})
      }
    })
    return off
  }, [])

  useEffect(() => {
    if (loc.pathname === '/approvals') return
    api.get<any>('/api/admin/overview').then((o) => setPendingAuth(o.approvals_pending)).catch(() => {})
  }, [loc.pathname])

  if (!ready) return <div className="p-8 text-slate-400">Cargando…</div>
  if (!onboarded && loc.pathname !== '/onboarding') return <Navigate to="/onboarding" replace />

  return (
    <div className="flex h-screen">
      <aside className="w-56 shrink-0 border-r border-edge bg-panel/60 flex flex-col">
        <div className="p-4 border-b border-edge">
          <div className="font-bold text-accent">AI CEO Workspace</div>
          <div className="text-xs text-slate-500">tu organización de agentes</div>
        </div>
        <nav className="flex-1 overflow-y-auto scroll-thin p-2 space-y-0.5">
          {NAV.map((n) => (
            <NavLink key={n.to} to={n.to}
              className={({ isActive }) => `navlink ${isActive ? 'active' : ''}`}>
              <span>{n.icon}</span>
              <span className="flex-1">{n.label}</span>
              {n.to === '/approvals' && pendingAuth > 0 && (
                <span className="bg-warn text-ink text-xs rounded-full px-1.5">{pendingAuth}</span>
              )}
            </NavLink>
          ))}
        </nav>
        <div className="p-3 border-t border-edge space-y-2">
          <button
            className={`w-full ${paused ? 'btn-primary' : 'btn-danger'}`}
            onClick={async () => {
              const r = await api.post<{ paused: boolean }>('/api/admin/pause-all', { paused: !paused })
              setPaused(r.paused)
            }}>
            {paused ? '▶ Reanudar sistema' : '⏸ Pausa general'}
          </button>
          <button className="w-full btn-ghost text-xs" onClick={() => nav('/settings')}>
            🔔 {unread} notificaciones
          </button>
        </div>
      </aside>
      <main className="flex-1 overflow-y-auto scroll-thin">
        <Routes>
          <Route path="/onboarding" element={<OnboardingPage onDone={() => { setOnboarded(true); nav('/chat') }} />} />
          <Route path="/chat" element={<ChatPage />} />
          <Route path="/agents" element={<AgentsPage />} />
          <Route path="/agents/new" element={<CreateAgentPage />} />
          <Route path="/teams" element={<TeamsPage />} />
          <Route path="/office" element={<OfficePage />} />
          <Route path="/admin" element={<AdminPage />} />
          <Route path="/simulation" element={<SimulationPage />} />
          <Route path="/tasks" element={<TasksPage />} />
          <Route path="/approvals" element={<ApprovalsPage onChanged={() => setPendingAuth(0)} />} />
          <Route path="/memory" element={<MemoryPage />} />
          <Route path="/projects" element={<ProjectsPage />} />
          <Route path="/connections" element={<ConnectionsPage />} />
          <Route path="/history" element={<HistoryPage />} />
          <Route path="/costs" element={<CostsPage />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="*" element={<Navigate to="/chat" replace />} />
        </Routes>
      </main>
    </div>
  )
}
