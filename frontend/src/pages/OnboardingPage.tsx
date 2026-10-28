import { useState } from 'react'
import { api } from '../api'

const STEPS = ['Tu perfil', 'Modo de IA', 'Preferencias', 'Confirmar']

export default function OnboardingPage({ onDone }: { onDone: () => void }) {
  const [step, setStep] = useState(0)
  const [busy, setBusy] = useState(false)
  const [f, setF] = useState({
    display_name: '', occupation: '', companies: '', goals_summary: '',
    assistant_name: 'Atlas', ai_mode: 'local',
    cost_pref: 'free_first', priority_pref: 'balanced',
    provider_choice: 'recommend', privacy_pref: 'balanced',
  })
  const set = (k: string, v: string) => setF((s) => ({ ...s, [k]: v }))

  const Opt = ({ k, v, label, desc }: { k: string; v: string; label: string; desc?: string }) => (
    <button onClick={() => set(k, v)}
      className={`card text-left w-full ${f[k as keyof typeof f] === v ? 'border-accent' : ''}`}>
      <div className="font-medium text-sm">{label}</div>
      {desc && <div className="text-xs text-slate-400 mt-0.5">{desc}</div>}
    </button>
  )

  return (
    <div className="max-w-2xl mx-auto p-6">
      <h1 className="text-2xl font-bold mb-1">Configuración inicial</h1>
      <p className="text-sm text-slate-400 mb-6">
        Paso {step + 1} de {STEPS.length}: {STEPS[step]} — todo es editable después.
      </p>

      {step === 0 && (
        <div className="space-y-3">
          <div><label className="label">¿Cómo quieres que te llame?</label>
            <input className="input" value={f.display_name} onChange={(e) => set('display_name', e.target.value)} /></div>
          <div><label className="label">Nombre del asistente CEO</label>
            <input className="input" value={f.assistant_name} onChange={(e) => set('assistant_name', e.target.value)} /></div>
          <div><label className="label">Ocupación o actividad principal</label>
            <input className="input" placeholder="Ej.: tengo una paletería" value={f.occupation} onChange={(e) => set('occupation', e.target.value)} /></div>
          <div><label className="label">Empresas o proyectos</label>
            <input className="input" value={f.companies} onChange={(e) => set('companies', e.target.value)} /></div>
          <div><label className="label">Objetivos principales</label>
            <textarea className="input" rows={3} value={f.goals_summary} onChange={(e) => set('goals_summary', e.target.value)} /></div>
        </div>
      )}

      {step === 1 && (
        <div className="space-y-3">
          <p className="text-sm text-slate-300">¿Dónde quieres ejecutar la inteligencia artificial?</p>
          <Opt k="ai_mode" v="local" label="Localmente" desc="Modelos en tu computadora (Ollama). Máxima privacidad, sin coste por consulta." />
          <Opt k="ai_mode" v="online" label="En línea" desc="Proveedores externos (OpenAI, Groq, OpenRouter…). Necesita API key y puede tener coste." />
          <Opt k="ai_mode" v="hybrid" label="Combinando ambos" desc="Local para lo sencillo/privado, nube para lo complejo." />
        </div>
      )}

      {step === 2 && (
        <div className="space-y-4">
          <div>
            <p className="text-sm text-slate-300 mb-2">¿Qué prefieres en servicios en línea?</p>
            <div className="grid gap-2">
              <Opt k="cost_pref" v="free_first" label="Gratuitos cuando existan y sean suficientes" />
              <Opt k="cost_pref" v="paid" label="Servicios de pago" />
              <Opt k="cost_pref" v="mixed" label="Combinación de gratuitos y de pago" />
            </div>
          </div>
          <div>
            <p className="text-sm text-slate-300 mb-2">¿Cuál es tu prioridad?</p>
            <div className="grid grid-cols-2 gap-2">
              <Opt k="priority_pref" v="save_money" label="Ahorrar dinero" />
              <Opt k="priority_pref" v="quality" label="Mejores resultados" />
              <Opt k="priority_pref" v="privacy" label="Privacidad" />
              <Opt k="priority_pref" v="speed" label="Respuestas rápidas" />
              <Opt k="priority_pref" v="balanced" label="Equilibrar" />
            </div>
          </div>
          <div>
            <p className="text-sm text-slate-300 mb-2">¿Cómo configuro los proveedores?</p>
            <div className="grid gap-2">
              <Opt k="provider_choice" v="recommend" label="Recomiéndame opciones compatibles" />
              <Opt k="provider_choice" v="manual" label="Quiero seleccionarlos yo" />
              <Opt k="provider_choice" v="mixed" label="Combinar ambas" />
            </div>
          </div>
        </div>
      )}

      {step === 3 && (
        <div className="card space-y-2 text-sm">
          <div><span className="text-slate-400">Asistente:</span> {f.assistant_name}</div>
          <div><span className="text-slate-400">Modo IA:</span> {f.ai_mode}</div>
          <div><span className="text-slate-400">Coste:</span> {f.cost_pref} · <span className="text-slate-400">Prioridad:</span> {f.priority_pref}</div>
          <div><span className="text-slate-400">Perfil:</span> {f.display_name || '(sin nombre)'} — {f.occupation || '-'}</div>
          <p className="text-xs text-slate-500 pt-2">
            Después podrás conectar proveedores en "Modelos". Sin proveedor, el
            asistente te guiará pero no podrá generar respuestas de IA.
          </p>
        </div>
      )}

      <div className="flex justify-between mt-6">
        <button className="btn-ghost" disabled={step === 0} onClick={() => setStep(step - 1)}>Atrás</button>
        {step < STEPS.length - 1
          ? <button className="btn-primary" onClick={() => setStep(step + 1)}>Siguiente</button>
          : <button className="btn-primary" disabled={busy} onClick={async () => {
              setBusy(true)
              try {
                await api.post('/api/onboarding', {
                  profile: {
                    display_name: f.display_name, occupation: f.occupation,
                    companies: f.companies, goals_summary: f.goals_summary,
                    privacy_pref: f.privacy_pref,
                  },
                  ai_mode: f.ai_mode, cost_pref: f.cost_pref,
                  priority_pref: f.priority_pref,
                  provider_choice: f.provider_choice,
                  assistant_name: f.assistant_name,
                })
                onDone()
              } finally { setBusy(false) }
            }}>Crear mi asistente</button>}
      </div>
    </div>
  )
}
