import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../api'

export default function TeamsPage() {
  const nav = useNavigate()
  const [project, setProject] = useState('')
  const [proposal, setProposal] = useState<any | null>(null)
  const [busy, setBusy] = useState(false)

  const ask = async () => {
    setBusy(true)
    try { setProposal(await api.post('/api/agents/team-proposal', { project })) }
    finally { setBusy(false) }
  }

  const accept = async () => {
    setBusy(true)
    try {
      await api.post('/api/agents/team-create',
        { name: `Equipo: ${project.slice(0, 40)}`, project, members: proposal.members })
      nav('/agents')
    } finally { setBusy(false) }
  }

  return (
    <div className="max-w-2xl mx-auto p-6 space-y-4">
      <h1 className="text-xl font-bold">Equipos recomendados</h1>
      <p className="text-sm text-slate-400">
        Describe tu proyecto y recibirás una propuesta de equipo. Nada se crea
        sin tu aprobación.
      </p>
      <textarea className="input" rows={3} value={project}
        placeholder="Ej.: analiza mi empresa de ropa y crea una propuesta para aumentar las ventas"
        onChange={(e) => setProject(e.target.value)} />
      <button className="btn-primary" disabled={!project.trim() || busy} onClick={ask}>
        {busy ? 'Analizando…' : 'Proponer equipo'}
      </button>

      {proposal && (
        <div className="space-y-3">
          {proposal.members.map((m: any, i: number) => (
            <div key={i} className="card flex items-start gap-3">
              <div className="w-9 h-9 rounded-full flex items-center justify-center"
                style={{ background: m.avatar?.color }}>🤖</div>
              <div className="flex-1">
                <div className="font-semibold">{m.name} <span className="text-xs text-slate-400">({m.role})</span></div>
                <div className="text-xs text-slate-400">{m.reason}</div>
                <div className="text-xs text-slate-500 mt-1">
                  Herramientas: {m.tools.join(', ')}
                </div>
              </div>
            </div>
          ))}
          <div className="flex gap-2">
            <button className="btn-primary" disabled={busy} onClick={accept}>
              Aceptar equipo recomendado
            </button>
            <button className="btn-ghost" onClick={() => nav('/agents/new')}>
              Personalizar / crear manualmente
            </button>
            <button className="btn-ghost" onClick={() => setProposal(null)}>
              Rechazar
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
