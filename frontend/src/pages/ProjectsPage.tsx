import { useEffect, useState } from 'react'
import { api } from '../api'
import type { Goal, Project } from '../types'

export default function ProjectsPage() {
  const [projects, setProjects] = useState<Project[]>([])
  const [goals, setGoals] = useState<Goal[]>([])
  const [pn, setPn] = useState({ name: '', description: '' })
  const [gn, setGn] = useState({ title: '', horizon: 'mid', priority: 3 })

  const reload = () => {
    api.get<Project[]>('/api/projects').then(setProjects)
    api.get<Goal[]>('/api/goals').then(setGoals)
  }
  useEffect(reload, [])

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      <section>
        <h1 className="text-xl font-bold mb-3">Proyectos</h1>
        <div className="card space-y-2 mb-3">
          <div className="flex gap-2">
            <input className="input" placeholder="Nombre del proyecto" value={pn.name}
              onChange={(e) => setPn({ ...pn, name: e.target.value })} />
            <button className="btn-primary shrink-0" onClick={async () => {
              if (!pn.name.trim()) return
              await api.post('/api/projects', pn); setPn({ name: '', description: '' }); reload()
            }}>Añadir</button>
          </div>
          <input className="input" placeholder="Descripción" value={pn.description}
            onChange={(e) => setPn({ ...pn, description: e.target.value })} />
        </div>
        <div className="grid gap-2 md:grid-cols-2">
          {projects.map((p) => (
            <div key={p.id} className="card">
              <div className="flex justify-between">
                <span className="font-medium">{p.name}</span>
                <span className="chip">{p.status}</span>
              </div>
              <p className="text-xs text-slate-400 mt-1">{p.description}</p>
              <button className="btn-ghost text-xs mt-2" onClick={async () => {
                await api.del(`/api/projects/${p.id}`); reload()
              }}>Eliminar</button>
            </div>
          ))}
        </div>
      </section>
      <section>
        <h2 className="text-lg font-bold mb-3">Objetivos</h2>
        <div className="card flex gap-2 mb-3 items-end">
          <div className="flex-1"><label className="label">Meta</label>
            <input className="input" value={gn.title} onChange={(e) => setGn({ ...gn, title: e.target.value })} /></div>
          <div><label className="label">Horizonte</label>
            <select className="input" value={gn.horizon} onChange={(e) => setGn({ ...gn, horizon: e.target.value })}>
              <option value="short">Corto</option><option value="mid">Medio</option><option value="long">Largo</option>
            </select></div>
          <div><label className="label">Prioridad</label>
            <input className="input !w-20" type="number" min={1} max={5} value={gn.priority}
              onChange={(e) => setGn({ ...gn, priority: +e.target.value })} /></div>
          <button className="btn-primary" onClick={async () => {
            if (!gn.title.trim()) return
            await api.post('/api/goals', gn); setGn({ title: '', horizon: 'mid', priority: 3 }); reload()
          }}>Añadir</button>
        </div>
        <div className="space-y-1">
          {goals.map((g) => (
            <div key={g.id} className="card !p-2 flex items-center gap-3 text-sm">
              <span className="chip">{g.horizon}</span>
              <span className="flex-1">{g.title}</span>
              <span className="text-xs text-slate-500">prio {g.priority}</span>
              <button className="btn-ghost text-xs" onClick={async () => {
                await api.put(`/api/goals/${g.id}`, { status: g.status === 'active' ? 'done' : 'active' }); reload()
              }}>{g.status === 'active' ? 'marcar hecha' : 'reactivar'}</button>
              <button className="btn-danger text-xs" onClick={async () => { await api.del(`/api/goals/${g.id}`); reload() }}>✕</button>
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}
