import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../api'
import type { Agent, Provider } from '../types'

const STATUS_COLOR: Record<string, string> = {
  active: 'text-ok', paused: 'text-warn', pending_config: 'text-accent2',
  archived: 'text-slate-500',
}
const STATUS_LABEL: Record<string, string> = {
  active: 'activo', paused: 'pausado', pending_config: 'pendiente de config',
  archived: 'archivado',
}

export default function AgentsPage() {
  const [agents, setAgents] = useState<Agent[]>([])
  const [sel, setSel] = useState<Agent | null>(null)
  const [providers, setProviders] = useState<Provider[]>([])
  const [msg, setMsg] = useState('')

  const reload = () => api.get<Agent[]>('/api/agents').then(setAgents)
  useEffect(() => {
    reload()
    api.get<Provider[]>('/api/providers').then(setProviders)
  }, [])

  const openDetail = async (id: number) =>
    setSel(await api.get<Agent>(`/api/agents/${id}`))

  const act = async (path: string) => { await api.post(path); reload(); setSel(null) }

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-bold">Creación — mis agentes</h1>
        <div className="flex gap-2">
          <Link to="/teams" className="btn-ghost">Equipos recomendados</Link>
          <Link to="/agents/new" className="btn-primary">+ Crear agente</Link>
        </div>
      </div>
      {msg && <div className="card text-sm mb-3 text-accent">{msg}</div>}
      <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
        {agents.map((a) => (
          <button key={a.id} onClick={() => openDetail(a.id)}
            className="card text-left hover:border-accent2">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full flex items-center justify-center text-lg"
                style={{ background: a.avatar?.color || '#556' }}>
                {a.is_ceo ? '👔' : '🤖'}
              </div>
              <div>
                <div className="font-semibold">{a.name}{a.is_ceo && ' (CEO)'}</div>
                <div className="text-xs text-slate-400">{a.role || 'sin rol'} · {a.model || 'sin modelo'}</div>
              </div>
            </div>
            <div className={`text-xs mt-2 ${STATUS_COLOR[a.status]}`}>
              ● {STATUS_LABEL[a.status] || a.status}
              {a.config_pending_reason && ` — ${a.config_pending_reason}`}
            </div>
          </button>
        ))}
        {agents.length === 0 && (
          <div className="card text-slate-500 text-sm col-span-full">
            Aún no hay agentes. Crea uno con lenguaje natural o pide un equipo
            recomendado.
          </div>
        )}
      </div>

      {sel && <AgentDetail a={sel} providers={providers}
        onClose={() => setSel(null)} onChanged={() => { reload(); openDetail(sel.id) }}
        onAction={act} setMsg={setMsg} />}
    </div>
  )
}

function AgentDetail({ a, providers, onClose, onChanged, onAction, setMsg }: {
  a: Agent; providers: Provider[]; onClose: () => void;
  onChanged: () => void; onAction: (p: string) => Promise<void>;
  setMsg: (s: string) => void;
}) {
  const [tab, setTab] = useState('identidad')
  const [f, setF] = useState<Partial<Agent>>({ ...a })
  const set = (k: keyof Agent, v: any) => setF((s) => ({ ...s, [k]: v }))
  const save = async () => {
    const r = await api.put<{ warning?: string }>(`/api/agents/${a.id}`, f)
    if (r.warning) setMsg(r.warning)
    onChanged()
  }

  const TABS = ['identidad', 'apariencia', 'voz', 'operación', 'permisos', 'actividad']
  return (
    <div className="fixed inset-0 bg-black/60 flex justify-end z-20" onClick={onClose}>
      <div className="w-[560px] max-w-full h-full bg-panel border-l border-edge p-4 overflow-y-auto scroll-thin"
        onClick={(e) => e.stopPropagation()}>
        <div className="flex justify-between items-center mb-3">
          <h2 className="font-bold text-lg">{a.name}</h2>
          <button className="btn-ghost" onClick={onClose}>✕</button>
        </div>
        <div className="flex gap-1 mb-4 flex-wrap">
          {TABS.map((t) => (
            <button key={t} onClick={() => setTab(t)}
              className={`chip ${tab === t ? 'bg-accent text-ink' : ''}`}>{t}</button>
          ))}
        </div>

        {tab === 'identidad' && (
          <div className="space-y-3">
            <div><label className="label">Nombre</label>
              <input className="input" value={f.name || ''} onChange={(e) => set('name', e.target.value)} /></div>
            <div><label className="label">Función / rol</label>
              <input className="input" value={f.role || ''} onChange={(e) => set('role', e.target.value)} /></div>
            <div><label className="label">Especialidad</label>
              <input className="input" value={f.specialty || ''} onChange={(e) => set('specialty', e.target.value)} /></div>
            <div><label className="label">Objetivo principal</label>
              <textarea className="input" rows={2} value={f.objective || ''} onChange={(e) => set('objective', e.target.value)} /></div>
            <div><label className="label">Instrucciones</label>
              <textarea className="input" rows={5} value={f.instructions || ''} onChange={(e) => set('instructions', e.target.value)} /></div>
            <div><label className="label">Prioridad (1-5)</label>
              <input className="input" type="number" min={1} max={5} value={f.priority ?? 3}
                onChange={(e) => set('priority', +e.target.value)} /></div>
          </div>
        )}

        {tab === 'apariencia' && (
          <div className="space-y-3">
            <div><label className="label">Color principal</label>
              <input type="color" className="w-16 h-10 rounded" value={f.avatar?.color || '#4f8ff7'}
                onChange={(e) => set('avatar', { ...(f.avatar || {}), color: e.target.value })} /></div>
            <div><label className="label">Estilo</label>
              <select className="input" value={f.avatar?.style || 'stylized'}
                onChange={(e) => set('avatar', { ...(f.avatar || {}), style: e.target.value })}>
                <option value="stylized">Estilizado</option>
                <option value="robot">Robot</option>
                <option value="formal">Formal</option>
              </select></div>
            <div><label className="label">Vestimenta</label>
              <select className="input" value={f.avatar?.outfit || 'casual'}
                onChange={(e) => set('avatar', { ...(f.avatar || {}), outfit: e.target.value })}>
                <option value="casual">Casual</option>
                <option value="formal">Formal</option>
                <option value="tech">Técnica</option>
              </select></div>
            <p className="text-xs text-slate-500">Se refleja en su avatar de la oficina 3D.</p>
          </div>
        )}

        {tab === 'voz' && (
          <div className="space-y-3">
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={!!f.voice?.enabled}
                onChange={(e) => set('voice', { ...(f.voice || {}), enabled: e.target.checked })} />
              Respuestas habladas activadas
            </label>
            <div><label className="label">Idioma de voz</label>
              <select className="input" value={f.voice?.lang || 'es-MX'}
                onChange={(e) => set('voice', { ...(f.voice || {}), lang: e.target.value })}>
                <option value="es-MX">Español (MX)</option>
                <option value="es-ES">Español (ES)</option>
                <option value="en-US">English (US)</option>
              </select></div>
            <div><label className="label">Velocidad</label>
              <input className="input" type="range" min={0.5} max={2} step={0.1}
                value={f.voice?.rate ?? 1}
                onChange={(e) => set('voice', { ...(f.voice || {}), rate: +e.target.value })} /></div>
            <div><label className="label">Tono</label>
              <input className="input" type="range" min={0.5} max={1.5} step={0.1}
                value={f.voice?.pitch ?? 1}
                onChange={(e) => set('voice', { ...(f.voice || {}), pitch: +e.target.value })} /></div>
            <p className="text-xs text-slate-500">La voz usa la síntesis del navegador (Web Speech API), independiente del modelo de IA.</p>
          </div>
        )}

        {tab === 'operación' && (
          <div className="space-y-3">
            <div><label className="label">Proveedor</label>
              <select className="input" value={f.provider_id ?? ''}
                onChange={(e) => set('provider_id', e.target.value ? +e.target.value : null)}>
                <option value="">Automático según modo global</option>
                {providers.map((p) => <option key={p.id} value={p.id}>{p.name} ({p.kind})</option>)}
              </select></div>
            <div><label className="label">Modelo</label>
              <input className="input" value={f.model || ''} placeholder="ej. qwen2.5:0.5b"
                onChange={(e) => set('model', e.target.value)} /></div>
            <div><label className="label">Autonomía</label>
              <select className="input" value={f.autonomy || 'ask_first'}
                onChange={(e) => set('autonomy', e.target.value)}>
                <option value="ask_first">Preguntar antes de actuar</option>
                <option value="balanced">Equilibrada</option>
                <option value="autonomous">Autónoma (dentro de sus permisos)</option>
              </select></div>
            <div><label className="label">Presupuesto máximo (USD, 0 = sin límite propio)</label>
              <input className="input" type="number" step="0.01" value={f.budget ?? 0}
                onChange={(e) => set('budget', +e.target.value)} />
              <div className="text-xs text-slate-500 mt-1">Gastado: ${(a.spent || 0).toFixed(4)}</div></div>
            <div><label className="label">Memoria que puede consultar</label>
              <div className="flex flex-wrap gap-1">
                {['fact', 'preference', 'goal', 'project', 'agent', 'task_history', 'document', 'verified_knowledge'].map((c) => (
                  <button key={c} className={`chip ${((f.memory_scope || []).includes(c)) ? 'bg-accent2' : ''}`}
                    onClick={() => {
                      const cur = new Set(f.memory_scope || [])
                      cur.has(c) ? cur.delete(c) : cur.add(c)
                      set('memory_scope', [...cur])
                    }}>{c}</button>
                ))}
              </div></div>
            <div><label className="label">Herramientas habilitadas</label>
              <div className="flex flex-wrap gap-1">
                {['memory_search', 'memory_write', 'doc_search', 'doc_index',
                  'file_read', 'file_write', 'http_get', 'send_message',
                  'publish_content', 'exec_code', 'delegate_task',
                  'report_result'].map((t) => (
                  <button key={t} className={`chip ${((f.tools || []).includes(t)) ? 'bg-ok/70' : ''}`}
                    onClick={() => {
                      const cur = new Set(f.tools || [])
                      cur.has(t) ? cur.delete(t) : cur.add(t)
                      set('tools', [...cur])
                    }}>{t}</button>
                ))}
              </div>
              <p className="text-xs text-slate-500 mt-1">Habilitar una herramienta no equivale a autorizarla: también necesita el permiso en la pestaña "permisos".</p></div>
          </div>
        )}

        {tab === 'permisos' && (
          <PermissionsEditor agentId={a.id} />
        )}

        {tab === 'actividad' && <AgentActivity agentId={a.id} />}

        <div className="flex gap-2 mt-5 flex-wrap">
          <button className="btn-primary" onClick={save}>Guardar</button>
          {a.status === 'paused'
            ? <button className="btn-ghost" onClick={() => onAction(`/api/agents/${a.id}/resume`)}>Reanudar</button>
            : <button className="btn-ghost" onClick={() => onAction(`/api/agents/${a.id}/pause`)}>Pausar</button>}
          <button className="btn-ghost" onClick={() => onAction(`/api/agents/${a.id}/duplicate`)}>Duplicar</button>
          <button className="btn-ghost" onClick={async () => {
            const data = await api.get(`/api/agents/${a.id}/export`)
            const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
            const u = URL.createObjectURL(blob)
            const el = document.createElement('a'); el.href = u
            el.download = `agente_${a.id}.json`; el.click()
          }}>Exportar</button>
          {!a.is_ceo && (
            <button className="btn-danger" onClick={async () => {
              const r = await api.del<{ ok: boolean; needs_confirm?: boolean; message?: string }>(
                `/api/agents/${a.id}`)
              if (r.needs_confirm) {
                if (confirm(r.message)) await api.del(`/api/agents/${a.id}?confirm=true`)
              }
              onClose(); onChanged()
            }}>Eliminar</button>
          )}
        </div>
      </div>
    </div>
  )
}

function PermissionsEditor({ agentId }: { agentId: number }) {
  const [rows, setRows] = useState<any[]>([])
  const reload = () => api.get<any[]>(`/api/agents/${agentId}/permissions`).then(setRows)
  useEffect(() => { reload() }, [agentId])
  return (
    <div className="space-y-2">
      <p className="text-xs text-slate-500">Mínimo privilegio: marca solo lo necesario.
        Los permisos sensibles siempre piden confirmación.</p>
      {rows.map((p) => (
        <div key={p.scope} className="card !p-2 flex items-center gap-2 text-sm">
          <span className="flex-1 font-mono text-xs">{p.scope}
            {p.sensitive && <span className="text-warn ml-1" title="sensible">●</span>}</span>
          <select className="bg-ink border border-edge rounded px-1 py-0.5 text-xs"
            value={p.effect}
            onChange={async (e) => {
              if (p.permission_id) {
                await api.put(`/api/permissions/${p.permission_id}`, { ...p, effect: e.target.value })
              } else {
                await api.post(`/api/agents/${agentId}/permissions`, { scope: p.scope, effect: e.target.value })
              }
              reload()
            }}>
            <option value="unset">sin permiso</option>
            <option value="allow">permitir</option>
            <option value="deny">denegar</option>
          </select>
          <label className="text-xs flex items-center gap-1 text-slate-400">
            <input type="checkbox" checked={p.requires_confirmation}
              disabled={p.effect !== 'allow'}
              onChange={async (e) => {
                if (p.permission_id) {
                  await api.put(`/api/permissions/${p.permission_id}`,
                    { ...p, requires_confirmation: e.target.checked })
                } else {
                  await api.post(`/api/agents/${agentId}/permissions`,
                    { scope: p.scope, requires_confirmation: e.target.checked })
                }
                reload()
              }} />
            confirmar
          </label>
        </div>
      ))}
    </div>
  )
}

function AgentActivity({ agentId }: { agentId: number }) {
  const [tasks, setTasks] = useState<any[]>([])
  useEffect(() => {
    api.get<any[]>('/api/tasks').then((ts) =>
      setTasks(ts.filter((t) => t.agent_id === agentId).slice(0, 20)))
  }, [agentId])
  return (
    <div className="space-y-2 text-sm">
      {tasks.length === 0 && <p className="text-slate-500">Sin tareas todavía.</p>}
      {tasks.map((t) => (
        <div key={t.id} className="card !p-2">
          <div className="flex justify-between">
            <span>{t.title}</span>
            <span className="text-xs text-slate-400">{t.status}</span>
          </div>
          {t.error && <div className="text-xs text-warn mt-1">{t.error}</div>}
        </div>
      ))}
    </div>
  )
}
