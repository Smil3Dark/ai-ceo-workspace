import { useEffect, useState } from 'react'
import { api } from '../api'
import type { Agent } from '../types'

/** Simulation mode: dry-run a plan — no real actions are executed. */
export default function SimulationPage() {
  const [agents, setAgents] = useState<Agent[]>([])
  const [steps, setSteps] = useState<any[]>([{ title: '', agent_name: '', depends_on: [], tools: [] }])
  const [result, setResult] = useState<any | null>(null)
  const [busy, setBusy] = useState(false)
  const tools = ['memory_search', 'memory_write', 'file_read', 'file_write',
    'doc_search', 'doc_index', 'http_get', 'send_message', 'publish_content',
    'exec_code', 'report_result']

  useEffect(() => { api.get<Agent[]>('/api/agents').then(setAgents) }, [])

  const upd = (i: number, k: string, v: any) =>
    setSteps((s) => s.map((x, j) => (j === i ? { ...x, [k]: v } : x)))

  return (
    <div className="max-w-3xl mx-auto p-6 space-y-4">
      <h1 className="text-xl font-bold">Modo simulación</h1>
      <p className="text-sm text-slate-400">
        Analiza un plan antes de ejecutarlo. No se envían mensajes, no se
        modifican archivos reales ni se hacen operaciones externas.
      </p>
      {steps.map((s, i) => (
        <div key={i} className="card space-y-2">
          <div className="flex gap-2 items-center">
            <span className="text-xs text-slate-500 w-6">#{i + 1}</span>
            <input className="input flex-1" placeholder="Título del paso" value={s.title}
              onChange={(e) => upd(i, 'title', e.target.value)} />
            <select className="input !w-44" value={s.agent_name}
              onChange={(e) => upd(i, 'agent_name', e.target.value)}>
              <option value="">(elegir agente)</option>
              {agents.filter((a) => !a.is_ceo).map((a) => <option key={a.id} value={a.name}>{a.name}</option>)}
            </select>
            <button className="btn-ghost text-xs" onClick={() => setSteps(steps.filter((_, j) => j !== i))}>✕</button>
          </div>
          <div className="flex gap-2 items-center text-xs flex-wrap">
            <span className="text-slate-500">depende de:</span>
            {steps.map((_, j) => j !== i && (
              <label key={j} className="chip cursor-pointer">
                <input type="checkbox" className="mr-1"
                  checked={s.depends_on.includes(j)}
                  onChange={(e) => upd(i, 'depends_on',
                    e.target.checked ? [...s.depends_on, j] : s.depends_on.filter((d: number) => d !== j))} />
                #{j + 1}
              </label>
            ))}
            <span className="text-slate-500 ml-3">herramientas:</span>
            {tools.map((t) => (
              <label key={t} className="chip cursor-pointer">
                <input type="checkbox" className="mr-1" checked={s.tools.includes(t)}
                  onChange={(e) => upd(i, 'tools',
                    e.target.checked ? [...s.tools, t] : s.tools.filter((x: string) => x !== t))} />
                {t}
              </label>
            ))}
          </div>
        </div>
      ))}
      <div className="flex gap-2">
        <button className="btn-ghost" onClick={() => setSteps([...steps, { title: '', agent_name: '', depends_on: [], tools: [] }])}>+ Paso</button>
        <button className="btn-primary" disabled={busy || !steps[0]?.title} onClick={async () => {
          setBusy(true)
          try { setResult(await api.post('/api/simulation', { steps })) }
          finally { setBusy(false) }
        }}>{busy ? 'Simulando…' : 'Simular plan'}</button>
      </div>

      {result && (
        <div className="card space-y-3">
          <h2 className="font-semibold">Resultado de la simulación <span className="chip ml-2">sin ejecución real</span></h2>
          <div className={`text-sm ${result.would_execute ? 'text-ok' : 'text-warn'}`}>
            {result.would_execute ? '✔ El plan podría ejecutarse' : '✘ El plan tiene bloqueos'}
          </div>
          {result.warnings.length > 0 && (
            <div><h3 className="text-xs uppercase text-slate-500">Avisos</h3>
              {result.warnings.map((w: string, i: number) => <div key={i} className="text-sm text-accent">⚠ {w}</div>)}</div>
          )}
          {result.missing_permissions.length > 0 && (
            <div><h3 className="text-xs uppercase text-slate-500">Permisos que faltan</h3>
              {result.missing_permissions.map((m: any, i: number) => (
                <div key={i} className="text-sm">
                  Paso #{m.step + 1} · {m.agent} · <code>{m.tool}</code> →
                  <span className="text-warn"> {m.scope}</span>
                  {m.needs_confirmation && <span className="text-accent"> (necesitaría tu confirmación)</span>}
                </div>))}</div>
          )}
          <div className="text-xs text-slate-500">
            Tokens estimados: ~{result.estimated_tokens.in} in / ~{result.estimated_tokens.out} out. {result.cost_note}
          </div>
        </div>
      )}
    </div>
  )
}
