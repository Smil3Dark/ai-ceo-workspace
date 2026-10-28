import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../api'

/** Conversational wizard: describe -> proposal -> accept/edit/cancel (spec §5). */
export default function CreateAgentPage() {
  const nav = useNavigate()
  const [desc, setDesc] = useState('')
  const [answers, setAnswers] = useState<Record<string, string>>({})
  const [proposal, setProposal] = useState<any | null>(null)
  const [edit, setEdit] = useState<any | null>(null)
  const [busy, setBusy] = useState(false)

  const propose = async () => {
    setBusy(true)
    try {
      const p = await api.post('/api/agents/propose', { description: desc, answers })
      setProposal(p); setEdit({ ...p })
    } finally { setBusy(false) }
  }

  const create = async () => {
    setBusy(true)
    try {
      await api.post('/api/agents/create', edit)
      nav('/agents')
    } finally { setBusy(false) }
  }

  if (!proposal) {
    return (
      <div className="max-w-xl mx-auto p-6 space-y-4">
        <h1 className="text-xl font-bold">Crear agente</h1>
        <p className="text-sm text-slate-400">
          Describe en lenguaje natural lo que necesitas. La IA propondrá la
          configuración y tú decides.
        </p>
        <textarea className="input" rows={4} value={desc}
          placeholder="Ej.: quiero un agente que investigue tendencias de moda, analice competidores y proponga diseños para mi marca de ropa"
          onChange={(e) => setDesc(e.target.value)} />
        <div className="grid grid-cols-2 gap-2">
          <div><label className="label">¿Nivel de autonomía?</label>
            <select className="input" value={answers.autonomy || 'ask_first'}
              onChange={(e) => setAnswers({ ...answers, autonomy: e.target.value })}>
              <option value="ask_first">Que pregunte primero</option>
              <option value="balanced">Equilibrada</option>
              <option value="autonomous">Autónomo</option>
            </select></div>
          <div><label className="label">Presupuesto (USD, opcional)</label>
            <input className="input" type="number" value={answers.budget || ''}
              onChange={(e) => setAnswers({ ...answers, budget: e.target.value })} /></div>
        </div>
        <button className="btn-primary w-full" disabled={!desc.trim() || busy}
          onClick={propose}>{busy ? 'Generando propuesta…' : 'Generar propuesta'}</button>
      </div>
    )
  }

  return (
    <div className="max-w-2xl mx-auto p-6 space-y-4">
      <h1 className="text-xl font-bold">Propuesta de agente</h1>
      <p className="text-sm text-slate-400">Revisa, edita lo que necesites y confirma.</p>
      <div className="card space-y-3">
        <div><label className="label">Nombre</label>
          <input className="input" value={edit.name} onChange={(e) => setEdit({ ...edit, name: e.target.value })} /></div>
        <div className="grid grid-cols-2 gap-2">
          <div><label className="label">Rol</label>
            <input className="input" value={edit.role} onChange={(e) => setEdit({ ...edit, role: e.target.value })} /></div>
          <div><label className="label">Modelo</label>
            <input className="input" value={edit.model} onChange={(e) => setEdit({ ...edit, model: e.target.value })} /></div>
        </div>
        <div><label className="label">Objetivo</label>
          <textarea className="input" rows={2} value={edit.objective}
            onChange={(e) => setEdit({ ...edit, objective: e.target.value })} /></div>
        <div><label className="label">Instrucciones</label>
          <textarea className="input" rows={4} value={edit.instructions}
            onChange={(e) => setEdit({ ...edit, instructions: e.target.value })} /></div>
        <div><label className="label">Herramientas</label>
          <div className="flex flex-wrap gap-1">
            {edit.tools.map((t: string) => <span key={t} className="chip">{t}</span>)}
          </div></div>
        <div><label className="label">Permisos solicitados</label>
          <div className="flex flex-wrap gap-1">
            {edit.permissions.map((p: any) => (
              <span key={p.scope} className={`chip ${p.requires_confirmation ? 'border border-warn' : ''}`}>
                {p.scope}{p.requires_confirmation && ' ⚠'}
              </span>))}
          </div></div>
        <div className="grid grid-cols-2 gap-2 text-sm">
          <div>Proveedor: {edit.provider_name || '⚠ ninguno (quedará pendiente)'}</div>
          <div>Autonomía: {edit.autonomy}</div>
        </div>
        {edit.limitations?.length > 0 && (
          <div className="text-xs text-accent">
            {edit.limitations.map((l: string, i: number) => <div key={i}>⚠ {l}</div>)}
          </div>
        )}
      </div>
      <div className="flex gap-2">
        <button className="btn-primary flex-1" disabled={busy} onClick={create}>
          Aceptar y crear agente
        </button>
        <button className="btn-ghost" onClick={() => { setProposal(null); setEdit(null) }}>
          Cancelar
        </button>
      </div>
    </div>
  )
}
