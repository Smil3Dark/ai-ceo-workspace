import { useEffect, useState } from 'react'
import { api } from '../api'

export default function HistoryPage() {
  const [rows, setRows] = useState<any[]>([])
  useEffect(() => { api.get<any[]>('/api/admin/activity?limit=300').then(setRows) }, [])
  return (
    <div className="max-w-4xl mx-auto p-6">
      <h1 className="text-xl font-bold mb-4">Historial de actividad</h1>
      <table className="w-full">
        <thead><tr><th>Hora</th><th>Acción</th><th>Agente</th><th>Tarea</th><th>Herramienta</th><th>Resultado</th><th>Coste</th></tr></thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id}>
              <td className="text-xs text-slate-500">{new Date(r.ts).toLocaleString()}</td>
              <td>{r.action}</td><td>{r.agent_id ?? '-'}</td><td>{r.task_id ?? '-'}</td>
              <td className="font-mono text-xs">{r.tool}</td>
              <td className={r.result === 'error' || r.result === 'denied' ? 'text-warn' : 'text-ok'}>{r.result}</td>
              <td>{r.cost ? `$${r.cost.toFixed(4)}` : ''}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {rows.length === 0 && <div className="card text-slate-500 text-sm mt-4">Sin actividad registrada.</div>}
      <p className="text-xs text-slate-600 mt-3">Las claves secretas nunca se escriben en este registro.</p>
    </div>
  )
}
