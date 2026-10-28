import { useEffect, useState } from 'react'
import { api } from '../api'

export default function CostsPage() {
  const [data, setData] = useState<any>(null)
  const [limit, setLimit] = useState('')
  const reload = () => api.get('/api/costs').then(setData)
  useEffect(() => { reload() }, [])

  if (!data) return <div className="p-6 text-slate-500">Cargando…</div>
  return (
    <div className="max-w-4xl mx-auto p-6 space-y-4">
      <h1 className="text-xl font-bold">Costes</h1>
      <div className="grid grid-cols-3 gap-3">
        <div className="card"><div className="text-2xl font-bold">${data.total_cost_usd.toFixed(4)}</div>
          <div className="text-xs text-slate-500">coste total registrado</div></div>
        <div className="card"><div className="text-2xl font-bold">{data.total_records}</div>
          <div className="text-xs text-slate-500">llamadas a modelos</div></div>
        <div className="card">
          <label className="label">Límite de gasto global (USD, 0 = sin límite)</label>
          <div className="flex gap-2">
            <input className="input" type="number" step="0.01" placeholder={String(data.spend_limit)}
              value={limit} onChange={(e) => setLimit(e.target.value)} />
            <button className="btn-primary" onClick={async () => {
              await api.put('/api/costs/limit', { spend_limit: +limit || 0 }); reload()
            }}>Fijar</button>
          </div>
        </div>
      </div>
      <div className="card">
        <h2 className="font-semibold mb-2">Por agente</h2>
        <table className="w-full">
          <thead><tr><th>Agente</th><th>Tokens in</th><th>Tokens out</th><th>Coste</th><th>Llamadas</th></tr></thead>
          <tbody>
            {data.by_agent.map((r: any, i: number) => (
              <tr key={i}><td>{r.agent}</td><td>{r.tokens_in}</td><td>{r.tokens_out}</td>
                <td>${r.cost_usd.toFixed(5)}</td><td>{r.calls}</td></tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="card">
        <h2 className="font-semibold mb-2">Historial</h2>
        <div className="text-xs space-y-1 max-h-64 overflow-y-auto scroll-thin">
          {data.history.map((r: any) => (
            <div key={r.id} className="flex gap-3 text-slate-400">
              <span>{new Date(r.created_at).toLocaleString()}</span>
              <span>{r.model}</span>
              <span>{r.tokens_in}+{r.tokens_out} tok</span>
              <span className={r.estimated ? 'text-accent' : 'text-ok'}>
                ${r.cost_usd.toFixed(5)}{r.estimated ? ' (est.)' : ''}
              </span>
            </div>
          ))}
        </div>
        <p className="text-xs text-slate-600 mt-2">Los costes marcados "(est.)" son estimaciones de la app; los demás provienen del uso real reportado por el proveedor.</p>
      </div>
    </div>
  )
}
