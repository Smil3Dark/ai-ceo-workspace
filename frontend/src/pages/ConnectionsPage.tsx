import { useEffect, useState } from 'react'
import { api } from '../api'
import type { Provider } from '../types'

export default function ConnectionsPage() {
  const [providers, setProviders] = useState<Provider[]>([])
  const [mode, setMode] = useState('local')
  const [test, setTest] = useState<Record<number, { ok: boolean; detail: string }>>({})
  const [showNew, setShowNew] = useState(false)
  const [f, setF] = useState({ name: '', kind: 'ollama', base_url: 'http://localhost:11434',
    default_model: '', api_key: '', is_free: true, cost_per_1k_in: 0, cost_per_1k_out: 0 })
  const [modeMsg, setModeMsg] = useState('')

  const reload = () => {
    api.get<Provider[]>('/api/providers').then(setProviders)
    api.get<{ ai_mode: string }>('/api/providers/mode').then((m) => setMode(m.ai_mode))
  }
  useEffect(reload, [])

  return (
    <div className="max-w-3xl mx-auto p-6 space-y-4">
      <h1 className="text-xl font-bold">Modelos y conexiones</h1>

      <div className="card">
        <div className="label">Modalidad de IA</div>
        <div className="flex gap-2">
          {[['local', 'Local'], ['online', 'En línea'], ['hybrid', 'Híbrido']].map(([v, l]) => (
            <button key={v} className={`chip ${mode === v ? 'bg-accent text-ink' : ''}`}
              onClick={async () => {
                const r = await api.put<any>('/api/providers/mode', { ai_mode: v })
                setMode(v)
                setModeMsg(r.agents_outside_mode.length
                  ? `Aviso: ${r.agents_outside_mode.length} agente(s) usan proveedores fuera del modo.`
                  : `Modo cambiado de ${r.previous} a ${r.current}. Agentes y configuraciones conservados.`)
              }}>{l}</button>
          ))}
        </div>
        {modeMsg && <p className="text-xs text-accent mt-2">{modeMsg}</p>}
      </div>

      <div className="flex justify-between items-center">
        <h2 className="font-semibold">Proveedores</h2>
        <button className="btn-ghost" onClick={() => setShowNew(!showNew)}>+ Añadir</button>
      </div>

      {showNew && (
        <div className="card space-y-2">
          <div className="grid grid-cols-2 gap-2">
            <div><label className="label">Nombre</label>
              <input className="input" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></div>
            <div><label className="label">Tipo</label>
              <select className="input" value={f.kind}
                onChange={(e) => setF({ ...f, kind: e.target.value,
                  base_url: e.target.value === 'ollama' ? 'http://localhost:11434' : 'https://api.openai.com' })}>
                <option value="ollama">Ollama (local)</option>
                <option value="openai_compat">API compatible con OpenAI</option>
              </select></div>
            <div><label className="label">URL base</label>
              <input className="input" value={f.base_url} onChange={(e) => setF({ ...f, base_url: e.target.value })} /></div>
            <div><label className="label">Modelo por defecto</label>
              <input className="input" placeholder="ej. qwen2.5:0.5b, gpt-4o-mini"
                value={f.default_model} onChange={(e) => setF({ ...f, default_model: e.target.value })} /></div>
            <div><label className="label">API key (se guarda cifrada, nunca se muestra)</label>
              <input className="input" type="password" value={f.api_key}
                onChange={(e) => setF({ ...f, api_key: e.target.value })} /></div>
            <div className="flex items-end gap-2 pb-1">
              <label className="text-sm flex items-center gap-2">
                <input type="checkbox" checked={f.is_free}
                  onChange={(e) => setF({ ...f, is_free: e.target.checked })} />
                Gratuito
              </label></div>
            {!f.is_free && <>
              <div><label className="label">$/1k tokens entrada</label>
                <input className="input" type="number" step="0.0001" value={f.cost_per_1k_in}
                  onChange={(e) => setF({ ...f, cost_per_1k_in: +e.target.value })} /></div>
              <div><label className="label">$/1k tokens salida</label>
                <input className="input" type="number" step="0.0001" value={f.cost_per_1k_out}
                  onChange={(e) => setF({ ...f, cost_per_1k_out: +e.target.value })} /></div>
            </>}
          </div>
          <div className="flex gap-2">
            <button className="btn-primary" onClick={async () => {
              await api.post('/api/providers', f); setShowNew(false); reload()
            }}>Guardar y probar después</button>
            <button className="btn-ghost" onClick={() => setShowNew(false)}>Cancelar</button>
          </div>
        </div>
      )}

      {providers.map((p) => (
        <div key={p.id} className="card flex items-center gap-3">
          <div className={`w-2.5 h-2.5 rounded-full ${p.last_test_ok ? 'bg-ok' : 'bg-slate-600'}`} />
          <div className="flex-1">
            <div className="font-medium">{p.name}
              <span className="text-xs text-slate-400 ml-2">{p.kind} · {p.default_model || 'sin modelo'}</span></div>
            <div className="text-xs text-slate-500">{p.base_url} {p.is_free ? '· gratis' : '· de pago'} {p.has_key && '· 🔑 guardada'}</div>
            {test[p.id] && (
              <div className={`text-xs mt-1 ${test[p.id].ok ? 'text-ok' : 'text-warn'}`}>{test[p.id].detail}</div>
            )}
          </div>
          <label className="text-xs flex items-center gap-1">
            <input type="checkbox" checked={p.enabled}
              onChange={async (e) => { await api.put(`/api/providers/${p.id}`, { enabled: e.target.checked }); reload() }} />
            activo
          </label>
          <button className="btn-ghost text-xs" onClick={async () => {
            const r = await api.post<{ ok: boolean; detail: string }>(`/api/providers/${p.id}/test`)
            setTest((t) => ({ ...t, [p.id]: r }))
          }}>Probar</button>
          <button className="btn-ghost text-xs" onClick={async () => {
            const m = await api.get<{ models: string[] }>(`/api/providers/${p.id}/models`)
            alert(m.models.length ? `Modelos:\n${m.models.join('\n')}` : 'Sin lista de modelos')
          }}>Modelos</button>
          <button className="btn-danger text-xs" onClick={async () => {
            if (confirm(`Eliminar ${p.name}?`)) { await api.del(`/api/providers/${p.id}`); reload() }
          }}>✕</button>
        </div>
      ))}
      {providers.length === 0 && (
        <div className="card text-sm text-slate-500">
          Sin proveedores. Para modo local instala Ollama (https://ollama.com),
          ejecútalo con <code>ollama serve</code>, descarga un modelo
          (<code>ollama pull qwen2.5:0.5b</code>) y añade aquí el proveedor
          "Ollama (local)" con URL http://localhost:11434.
        </div>
      )}
    </div>
  )
}
