import { useEffect, useState } from 'react'
import { api, apiBase, setApiBase } from '../api'

export default function SettingsPage() {
  const [s, setS] = useState<any>(null)
  const [base, setBase] = useState(apiBase())
  const [docs, setDocs] = useState<any[]>([])

  const reload = () => api.get<any>('/api/system/status').then((r) => setS(r.settings))
  useEffect(() => { reload(); api.get<any[]>('/api/documents').then(setDocs) }, [])
  if (!s) return <div className="p-6 text-slate-500">Cargando…</div>

  const save = (k: string, v: any) => api.put('/api/system/settings', { [k]: v }).then(setS)

  return (
    <div className="max-w-3xl mx-auto p-6 space-y-4">
      <h1 className="text-xl font-bold">Ajustes</h1>

      <div className="card space-y-3">
        <h2 className="font-semibold">Conexión al servidor</h2>
        <label className="label">URL del backend (vacío = mismo origen; en Android apunta a tu PC, ej. http://192.168.1.10:8000)</label>
        <div className="flex gap-2">
          <input className="input" value={base} onChange={(e) => setBase(e.target.value)} />
          <button className="btn-primary" onClick={() => { setApiBase(base); location.reload() }}>Aplicar</button>
        </div>
      </div>

      <div className="card space-y-3">
        <h2 className="font-semibold">Notificaciones</h2>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={s.notifications?.in_app}
            onChange={(e) => save('notifications', { ...s.notifications, in_app: e.target.checked })} />
          Dentro de la aplicación
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={s.notifications?.sound}
            onChange={(e) => save('notifications', { ...s.notifications, sound: e.target.checked })} />
          Sonido
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={s.notifications?.spoken}
            onChange={(e) => save('notifications', { ...s.notifications, spoken: e.target.checked })} />
          Notificaciones habladas
        </label>
        <button className="btn-ghost text-xs" onClick={() => api.post('/api/system/test-notify')}>Enviar notificación de prueba</button>
      </div>

      <div className="card space-y-3">
        <h2 className="font-semibold">Privacidad</h2>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={s.privacy?.send_private_to_external}
            onChange={(e) => save('privacy', { ...s.privacy, send_private_to_external: e.target.checked })} />
          Permitir enviar información privada a proveedores externos
        </label>
        <p className="text-xs text-slate-500">Desactivado: los datos marcados como privados no salen de tu equipo en modo híbrido.</p>
      </div>

      <div className="card space-y-3">
        <h2 className="font-semibold">Documentos del asistente</h2>
        <label className="btn-ghost text-xs cursor-pointer">Subir documento
          <input type="file" className="hidden" onChange={async (e) => {
            const f = e.target.files?.[0]; if (!f) return
            await api.upload('/api/documents', f)
            api.get<any[]>('/api/documents').then(setDocs)
          }} />
        </label>
        <div className="space-y-1">
          {docs.map((d) => (
            <div key={d.id} className="flex items-center gap-2 text-sm">
              <span className="flex-1">{d.name} <span className="text-xs text-slate-500">({Math.round(d.size / 1024)} KB)</span></span>
              <span className={`chip ${d.indexed ? 'bg-ok/40' : ''}`}>{d.indexed ? 'indexado' : 'sin indexar'}</span>
              <button className="btn-danger text-xs" onClick={async () => { await api.del(`/api/documents/${d.id}`); setDocs(docs.filter((x) => x.id !== d.id)) }}>✕</button>
            </div>
          ))}
        </div>
      </div>

      <div className="card space-y-3">
        <h2 className="font-semibold">Datos y copias de seguridad</h2>
        <div className="flex gap-2 flex-wrap">
          <button className="btn-ghost text-xs" onClick={async () => { const r = await api.post<{ backup: string }>('/api/system/backup'); alert('Copia creada: ' + r.backup) }}>Crear copia ahora</button>
          <button className="btn-ghost text-xs" onClick={async () => {
            const data = await api.get('/api/system/export')
            const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
            const u = URL.createObjectURL(blob); const el = document.createElement('a')
            el.href = u; el.download = 'ai_ceo_export.json'; el.click()
          }}>Exportar mis datos</button>
        </div>
      </div>
    </div>
  )
}
