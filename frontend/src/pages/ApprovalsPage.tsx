import { useEffect, useState } from 'react'
import { api } from '../api'
import type { Approval } from '../types'

const RISK: Record<string, string> = { low: 'text-ok', medium: 'text-accent', high: 'text-warn' }

export default function ApprovalsPage({ onChanged }: { onChanged?: () => void }) {
  const [items, setItems] = useState<Approval[]>([])
  const [filter, setFilter] = useState('pending')
  const reload = () => api.get<Approval[]>(`/api/approvals?status=${filter}`).then(setItems)
  useEffect(() => { reload() }, [filter])

  const decide = async (id: number, decision: string) => {
    const r = await api.post<{ execution?: any }>(`/api/approvals/${id}/resolve`, { decision })
    if (r.execution?.error) alert('Ejecutado con error: ' + r.execution.error)
    else if (r.execution) alert('Acción ejecutada correctamente.')
    reload(); onChanged?.()
  }

  return (
    <div className="max-w-3xl mx-auto p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">Confirmaciones</h1>
        <select className="input !w-44" value={filter} onChange={(e) => setFilter(e.target.value)}>
          <option value="pending">Pendientes</option>
          <option value="all">Todas</option>
          <option value="approved">Aprobadas</option>
          <option value="rejected">Rechazadas</option>
        </select>
      </div>
      <p className="text-xs text-slate-500">
        Una solicitud nunca se ejecuta por sí sola: solo tu aprobación la activa.
      </p>
      {items.map((r) => (
        <div key={r.id} className="card">
          <div className="flex justify-between items-start">
            <div>
              <div className="font-semibold">{r.action_type}
                <span className={`text-xs ml-2 ${RISK[r.risk]}`}>riesgo {r.risk}</span></div>
              <div className="text-sm text-slate-400 mt-1">{r.reason}</div>
              <div className="text-xs text-slate-500 mt-2">
                Agente: {r.agent} · Tarea: {r.task_id ?? '-'} ·
                Coste est.: {r.cost_estimate != null ? `$${r.cost_estimate}` : 'n/d'}
              </div>
              <pre className="text-xs bg-ink rounded p-2 mt-2 overflow-x-auto max-w-lg">
                {JSON.stringify(r.resources, null, 1)}
              </pre>
            </div>
            <span className="chip">{r.status}</span>
          </div>
          {r.status === 'pending' && (
            <div className="flex gap-2 mt-3">
              <button className="btn-primary text-xs" onClick={() => decide(r.id, 'approved')}>Aprobar y ejecutar</button>
              <button className="btn-ghost text-xs" onClick={() => decide(r.id, 'modified')}>Aprobar modificada</button>
              <button className="btn-ghost text-xs" onClick={() => decide(r.id, 'postponed')}>Posponer</button>
              <button className="btn-danger text-xs" onClick={() => decide(r.id, 'rejected')}>Rechazar</button>
            </div>
          )}
        </div>
      ))}
      {items.length === 0 && <div className="card text-slate-500 text-sm">No hay solicitudes {filter === 'pending' ? 'pendientes' : ''}.</div>}
    </div>
  )
}
