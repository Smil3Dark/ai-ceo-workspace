import { useEffect, useState } from 'react'
import { api } from '../api'
import type { Memory } from '../types'

const CATS = ['profile', 'preference', 'goal', 'project', 'agent',
  'task_history', 'document', 'verified_knowledge', 'fact']

export default function MemoryPage() {
  const [items, setItems] = useState<Memory[]>([])
  const [cat, setCat] = useState('')
  const [q, setQ] = useState('')
  const [editId, setEditId] = useState<number | null>(null)
  const [editTxt, setEditTxt] = useState('')

  const reload = () => api.get<Memory[]>(`/api/memory?q=${encodeURIComponent(q)}${cat ? `&category=${cat}` : ''}`).then(setItems)
  useEffect(() => { reload() }, [cat])

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">Memoria</h1>
        <div className="flex gap-2">
          <button className="btn-ghost text-xs" onClick={async () => {
            const data = await api.get('/api/memory/export')
            const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
            const u = URL.createObjectURL(blob)
            const el = document.createElement('a'); el.href = u; el.download = 'memoria.json'; el.click()
          }}>Exportar</button>
          <label className="btn-ghost text-xs cursor-pointer">Importar
            <input type="file" className="hidden" accept=".json"
              onChange={async (e) => {
                const f = e.target.files?.[0]; if (!f) return
                const data = JSON.parse(await f.text())
                const r = await api.post<{ imported: number }>('/api/memory/import', data)
                alert(`${r.imported} recuerdos importados`); reload()
              }} />
          </label>
        </div>
      </div>
      <div className="flex gap-2">
        <input className="input flex-1" placeholder="Buscar…" value={q}
          onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && reload()} />
        <button className="btn-ghost" onClick={reload}>Buscar</button>
      </div>
      <div className="flex gap-1 flex-wrap">
        <button className={`chip ${!cat ? 'bg-accent text-ink' : ''}`} onClick={() => setCat('')}>todas</button>
        {CATS.map((c) => (
          <button key={c} className={`chip ${cat === c ? 'bg-accent text-ink' : ''}`}
            onClick={() => setCat(c)}>{c}</button>
        ))}
      </div>
      <div className="space-y-2">
        {items.map((m) => (
          <div key={m.id} className="card !p-3">
            {editId === m.id ? (
              <div className="space-y-2">
                <textarea className="input" rows={3} value={editTxt} onChange={(e) => setEditTxt(e.target.value)} />
                <div className="flex gap-2">
                  <button className="btn-primary text-xs" onClick={async () => {
                    await api.put(`/api/memory/${m.id}`, { content: editTxt })
                    setEditId(null); reload()
                  }}>Guardar</button>
                  <button className="btn-ghost text-xs" onClick={() => setEditId(null)}>Cancelar</button>
                </div>
              </div>
            ) : (
              <>
                <div className="text-sm whitespace-pre-wrap">{m.content}</div>
                <div className="flex items-center gap-2 mt-2">
                  <span className="chip">{m.category}</span>
                  <span className="chip">{m.kind}</span>
                  {m.verified && <span className="chip bg-ok/40">verificado</span>}
                  {m.source && <span className="text-xs text-slate-500">origen: {m.source}</span>}
                  <span className="flex-1" />
                  <button className="btn-ghost text-xs" onClick={() => { setEditId(m.id); setEditTxt(m.content) }}>Editar</button>
                  <button className="btn-danger text-xs" onClick={async () => {
                    if (confirm('¿Eliminar este recuerdo?')) { await api.del(`/api/memory/${m.id}`); reload() }
                  }}>Eliminar</button>
                </div>
              </>
            )}
          </div>
        ))}
        {items.length === 0 && <div className="card text-slate-500 text-sm">Sin recuerdos en esta categoría.</div>}
      </div>
    </div>
  )
}
