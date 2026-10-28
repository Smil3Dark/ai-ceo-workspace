import { useEffect, useState } from 'react'
import { api } from '../api'

export default function AdminPage() {
  const [ov, setOv] = useState<any>(null)
  const [grants, setGrants] = useState<any[]>([])

  useEffect(() => {
    api.get('/api/admin/overview').then(setOv)
    api.get<{ rows: any[] }>('/api/permissions/matrix').then((r) =>
      setGrants(r.rows.flatMap((a: any) =>
        Object.entries(a.permissions)
          .filter(([, p]: any) => p.permission === 'permitir')
          .map(([scope, p]: any) => ({ agent: a.name, scope, confirm: p.requires_confirmation })))))
  }, [])

  if (!ov) return <div className="p-6 text-slate-500">Cargando…</div>
  return (
    <div className="max-w-5xl mx-auto p-6 space-y-4">
      <h1 className="text-xl font-bold">Panel de administrador</h1>
      <div className="grid grid-cols-4 gap-3">
        {[['Agentes', ov.agents], ['Tareas', ov.tasks], ['Solicitudes pendientes', ov.pending_auth],
          ['Coste total', '$' + ov.costs.total_cost_usd.toFixed(4)]].map(([l, v]) => (
          <div key={l} className="card"><div className="text-2xl font-bold">{v}</div>
            <div className="text-xs text-slate-500">{l}</div></div>
        ))}
      </div>
      <div className="grid grid-cols-3 gap-3">
        {Object.entries(ov.tasks_by_status).map(([k, v]) => (
          <div key={k} className="card !p-3"><span className="chip">{k}</span>
            <span className="text-xl font-bold ml-2">{v as number}</span></div>
        ))}
      </div>
      <div className="card">
        <h2 className="font-semibold mb-2">Permisos concedidos</h2>
        <table className="w-full">
          <thead><tr><th>Agente</th><th>Alcance</th><th>Confirmación</th></tr></thead>
          <tbody>
            {grants.map((g, i) => (
              <tr key={i}><td>{g.agent}</td><td className="font-mono text-xs">{g.scope}</td>
                <td>{g.confirm ? 'siempre pide' : 'sin confirmar'}</td></tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-slate-600">El CEO no es excepción: usa este panel para supervisarlo también.</p>
    </div>
  )
}
