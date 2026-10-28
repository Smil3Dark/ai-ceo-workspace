import { useEffect, useState } from 'react'
import { api, connectBus } from '../api'
import type { Agent, Task } from '../types'

const STATUS: Record<string, string> = {
  pending: '⏳ pendiente', planned: '🗓 planificada', running: '▶ en ejecución',
  awaiting_authorization: '⏸ esperando autorización', blocked: '🚫 bloqueada',
  verifying: '🔍 en verificación', completed: '✅ completada',
  failed: '❌ fallida', cancelled: '⛔ cancelada',
}

export default function TasksPage() {
  const [tasks, setTasks] = useState<Task[]>([])
  const [agents, setAgents] = useState<Agent[]>([])
  const [f, setF] = useState('all')
  const [sel, setSel] = useState<any | null>(null)
  const [nw, setNw] = useState({ title: '', description: '', agent_id: '' })

  const reload = () => api.get<Task[]>(`/api/tasks${f !== 'all' ? `?status=${f}` : ''}`).then(setTasks)
  useEffect(() => { reload(); api.get<Agent[]>('/api/agents').then(setAgents) }, [f])
  useEffect(() => connectBus((t) => { if (t === 'task') reload() }), [f])

  const open = async (id: number) => setSel(await api.get(`/api/tasks/${id}`))

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">Tareas</h1>
        <select className="input !w-48" value={f} onChange={(e) => setF(e.target.value)}>
          <option value="all">Todos los estados</option>
          {Object.entries(STATUS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
      </div>
      <div className="card flex gap-2 items-end">
        <div className="flex-1"><label className="label">Nueva tarea</label>
          <input className="input" placeholder="Título" value={nw.title}
            onChange={(e) => setNw({ ...nw, title: e.target.value })} /></div>
        <div className="flex-1"><label className="label">Descripción</label>
          <input className="input" value={nw.description}
            onChange={(e) => setNw({ ...nw, description: e.target.value })} /></div>
        <div><label className="label">Agente</label>
          <select className="input" value={nw.agent_id}
            onChange={(e) => setNw({ ...nw, agent_id: e.target.value })}>
            <option value="">(CEO decide)</option>
            {agents.filter((a) => !a.is_ceo).map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
          </select></div>
        <button className="btn-primary" onClick={async () => {
          if (!nw.title.trim()) return
          await api.post('/api/tasks', { ...nw, agent_id: nw.agent_id ? +nw.agent_id : null })
          setNw({ title: '', description: '', agent_id: '' }); reload()
        }}>Asignar</button>
      </div>
      <div className="space-y-2">
        {tasks.map((t) => (
          <button key={t.id} className="card !p-3 w-full text-left" onClick={() => open(t.id)}>
            <div className="flex justify-between items-center">
              <span className="font-medium">{t.title}</span>
              <span className="text-xs">{STATUS[t.status] || t.status}</span>
            </div>
            <div className="text-xs text-slate-500 mt-1">
              {t.agent_name || 'sin asignar'} · intentos {t.attempts}/{t.max_attempts}
              {t.cost_usd ? ` · $${t.cost_usd.toFixed(4)}` : ''} · por {t.created_by}
            </div>
            {t.error && <div className="text-xs text-warn mt-1">{t.error}</div>}
          </button>
        ))}
        {tasks.length === 0 && <div className="card text-sm text-slate-500">Sin tareas.</div>}
      </div>

      {sel && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-20" onClick={() => setSel(null)}>
          <div className="card w-[560px] max-h-[80vh] overflow-y-auto scroll-thin" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-between mb-2">
              <h3 className="font-bold">{sel.title}</h3>
              <button className="btn-ghost" onClick={() => setSel(null)}>✕</button>
            </div>
            <div className="text-sm space-y-1">
              <div>Estado: <b>{STATUS[sel.status] || sel.status}</b></div>
              {sel.result?.answer && <div className="bg-ink rounded p-2 text-xs whitespace-pre-wrap">{sel.result.answer}</div>}
              {sel.result?.verification && <div className="text-xs text-accent">{sel.result.verification}</div>}
              {sel.error && <div className="text-xs text-warn">{sel.error}</div>}
            </div>
            <h4 className="text-xs uppercase text-slate-500 mt-4 mb-1">Ejecución ({sel.executions.length} pasos)</h4>
            <div className="space-y-1 text-xs">
              {sel.executions.map((e: any) => (
                <div key={e.id} className="bg-ink rounded p-2">
                  <span className="text-accent2">#{e.step} {e.kind}</span>
                  <span className="text-slate-500"> {e.status} {e.cost ? `$${e.cost.toFixed(5)}` : ''}</span>
                  <pre className="text-slate-400 whitespace-pre-wrap mt-1">{JSON.stringify(e.detail).slice(0, 400)}</pre>
                </div>
              ))}
            </div>
            <div className="flex gap-2 mt-3">
              {['pending', 'running', 'planned', 'awaiting_authorization'].includes(sel.status) && (
                <button className="btn-danger text-xs" onClick={async () => { await api.post(`/api/tasks/${sel.id}/cancel`); setSel(null); reload() }}>Cancelar</button>
              )}
              {['failed', 'cancelled'].includes(sel.status) && (
                <button className="btn-ghost text-xs" onClick={async () => { await api.post(`/api/tasks/${sel.id}/retry`); setSel(null); reload() }}>Reintentar</button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
