import { useEffect, useState } from 'react'
import { api } from '../api'

interface Grant { agent: string; scope: string; confirm: boolean; sensitive: boolean }

export default function AdminPage() {
  const [ov, setOv] = useState<any>(null)
  const [grants, setGrants] = useState<Grant[]>([])

  useEffect(() => {
    api.get('/api/admin/overview').then(setOv)
    api.get<{ id: number; name: string }[]>('/api/agents').then(async (agents) => {
      const rows: Grant[] = []
      for (const a of agents) {
        const detail = await api.get<any>(`/api/agents/${a.id}`)
        for (const p of detail.permissions || []) {
          if (p.effect === 'allow') {
            rows.push({ agent: a.name, scope: p.scope,
              confirm: p.requires_confirmation, sensitive: p.sensitive })
          }
        }
      }
      setGrants(rows)
    })
  }, [])

  if (!ov) return <div className="p-6 text-slate-500">Cargando…</div>
  return (
    <div className="max-w-5xl mx-auto p-6 space-y-4">
      <h1 className="text-xl font-bold">Panel de administrador</h1>
      <div className="grid grid-cols-4 gap-3">
        {[['Agentes totales', ov.agents_total], ['Activos', ov.agents_active],
          ['Pausados', ov.agents_paused], ['Sin actividad', ov.agents_idle]].map(([l, v]) => (
          <div key={l} className="card"><div className="text-2xl font-bold">{v}</div>
            <div className="text-xs text-slate-500">{l}</div></div>
        ))}
      </div>
      <div className="grid grid-cols-3 gap-3 md:grid-cols-6">
        {[['pendientes', ov.tasks_pending], ['en ejecución', ov.tasks_running],
          ['bloqueadas', ov.tasks_blocked], ['completadas', ov.tasks_done],
          ['fallidas', ov.tasks_failed], ['autorizaciones', ov.approvals_pending]].map(([l, v]) => (
          <div key={l} className="card !p-3"><span className="text-xs text-slate-500">{l}</span>
            <div className="text-xl font-bold">{v}</div></div>
        ))}
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="card"><div className="text-2xl font-bold">${(ov.costs ?? 0).toFixed(4)}</div>
          <div className="text-xs text-slate-500">coste total</div></div>
        <div className="card"><div className="text-2xl font-bold">{ov.paused ? '⏸' : '▶'}</div>
          <div className="text-xs text-slate-500">{ov.paused ? 'sistema en pausa' : 'sistema activo'}</div></div>
      </div>
      <div className="card">
        <h2 className="font-semibold mb-2">Permisos concedidos ({grants.length})</h2>
        <table className="w-full">
          <thead><tr><th>Agente</th><th>Alcance</th><th>Confirmación</th><th>Sensible</th></tr></thead>
          <tbody>
            {grants.map((g, i) => (
              <tr key={i}><td>{g.agent}</td><td className="font-mono text-xs">{g.scope}</td>
                <td>{g.confirm ? 'siempre pide' : 'sin confirmar'}</td>
                <td>{g.sensitive ? <span className="text-warn">sí</span> : 'no'}</td></tr>
            ))}
          </tbody>
        </table>
        {grants.length === 0 && <p className="text-xs text-slate-500">Ningún permiso concedido todavía.</p>}
      </div>
      <p className="text-xs text-slate-600">El CEO no es excepción: usa este panel para supervisarlo también.</p>
    </div>
  )
}
