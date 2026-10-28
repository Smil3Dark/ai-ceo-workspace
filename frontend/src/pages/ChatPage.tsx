import { useEffect, useRef, useState } from 'react'
import { api } from '../api'
import type { Msg } from '../types'
import VoiceControls from '../components/VoiceControls'

export default function ChatPage() {
  const [convId, setConvId] = useState<number | null>(null)
  const [msgs, setMsgs] = useState<Msg[]>([])
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const [speakReplies, setSpeakReplies] = useState(true)
  const [convs, setConvs] = useState<{ id: number; title: string }[]>([])
  const endRef = useRef<HTMLDivElement>(null)

  const load = async (cid: number) => {
    setConvId(cid)
    setMsgs(await api.get<Msg[]>(`/api/chat/conversations/${cid}/messages`))
  }
  useEffect(() => {
    api.get<{ id: number; title: string }[]>('/api/chat/conversations')
      .then(async (cs) => {
        setConvs(cs)
        if (cs.length) await load(cs[0].id)
      }).catch(() => {})
  }, [])
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [msgs])

  const speak = (t: string) => {
    if (!speakReplies || !('speechSynthesis' in window)) return
    const u = new SpeechSynthesisUtterance(t)
    u.lang = 'es-MX'
    speechSynthesis.speak(u)
  }

  const send = async () => {
    if (!text.trim() || busy) return
    const t = text; setText(''); setBusy(true); setErr('')
    setMsgs((m) => [...m, { id: -1, role: 'user', content: t, created_at: '' }])
    try {
      const r = await api.post<{ conversation_id: number; message: Msg }>(
        '/api/chat/send', { text: t, conversation_id: convId })
      if (!convId) setConvId(r.conversation_id)
      setMsgs(await api.get<Msg[]>(`/api/chat/conversations/${r.conversation_id}/messages`))
      speak(r.message.content)
    } catch (e: any) { setErr(e.message) } finally { setBusy(false) }
  }

  return (
    <div className="flex h-full">
      <div className="w-48 border-r border-edge p-2 space-y-1 overflow-y-auto scroll-thin">
        <button className="btn-ghost w-full text-left"
          onClick={async () => {
            const c = await api.post<{ id: number }>('/api/chat/conversations')
            setConvs((c2) => [{ id: c.id, title: 'Nueva' }, ...c2]); load(c.id)
          }}>+ Nueva conversación</button>
        {convs.map((c) => (
          <button key={c.id} onClick={() => load(c.id)}
            className={`w-full text-left px-2 py-1.5 rounded text-xs truncate ${c.id === convId ? 'bg-edge text-accent' : 'text-slate-400 hover:bg-edge/50'}`}>
            {c.title}
          </button>
        ))}
      </div>
      <div className="flex-1 flex flex-col">
        <div className="flex-1 overflow-y-auto scroll-thin p-4 space-y-3">
          {msgs.length === 0 && (
            <div className="text-slate-500 text-sm mt-10 text-center">
              Escríbele a tu asistente CEO. Puede responder, recomendar equipos,
              delegar tareas en agentes y recordar lo que le cuentes.
            </div>
          )}
          {msgs.map((m, i) => (
            <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[75%] rounded-xl px-3 py-2 text-sm whitespace-pre-wrap ${
                m.role === 'user' ? 'bg-accent2/80' : 'bg-panel border border-edge'}`}>
                {m.content}
                {m.meta?.delegated_tasks && (
                  <div className="mt-1 text-xs text-accent">
                    → Tareas delegadas: {m.meta.delegated_tasks.join(', ')} (ver Tareas)
                  </div>
                )}
                {m.meta?.proposal && (
                  <div className="mt-1 text-xs text-accent2">
                    → Propuesta generada — revísala en Creación &gt; Agentes
                  </div>
                )}
              </div>
            </div>
          ))}
          {busy && <div className="text-xs text-slate-500 animate-pulse">procesando…</div>}
          <div ref={endRef} />
        </div>
        {err && <div className="px-4 py-1 text-xs text-warn">{err}</div>}
        <div className="border-t border-edge p-3 flex items-center gap-2">
          <VoiceControls
            onTranscript={(t) => setText((x) => (x ? x + ' ' : '') + t)}
            speakReplies={speakReplies}
            onToggleSpeak={setSpeakReplies} />
          <input className="input flex-1" value={text}
            placeholder="Escribe o dicta una instrucción…"
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && send()} />
          <button className="btn-primary" onClick={send} disabled={busy}>Enviar</button>
          <button className="btn-ghost" title="Detener operaciones pendientes"
            onClick={async () => { const r = await api.post<{ stopped: number }>('/api/chat/stop'); setErr(r.stopped ? `${r.stopped} tarea(s) canceladas` : 'No había operaciones pendientes') }}>
            ■
          </button>
        </div>
      </div>
    </div>
  )
}
