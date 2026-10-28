/** API client + realtime bus. Base URL configurable (Android points at the
 * machine running the backend). */
const BASE_KEY = 'aceo_api_base'
export function apiBase(): string {
  return localStorage.getItem(BASE_KEY) || ''
}
export function setApiBase(v: string) {
  localStorage.setItem(BASE_KEY, v.replace(/\/$/, ''))
}

async function req<T>(path: string, opts: RequestInit = {}): Promise<T> {
  const r = await fetch(`${apiBase()}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...opts,
  })
  if (!r.ok) {
    let detail = `${r.status}`
    try { detail = (await r.json()).detail || detail } catch { /* noop */ }
    throw new Error(detail)
  }
  return r.json()
}

export const api = {
  get: <T>(p: string) => req<T>(p),
  post: <T>(p: string, body?: unknown) =>
    req<T>(p, { method: 'POST', body: JSON.stringify(body ?? {}) }),
  put: <T>(p: string, body?: unknown) =>
    req<T>(p, { method: 'PUT', body: JSON.stringify(body ?? {}) }),
  del: <T>(p: string) => req<T>(p, { method: 'DELETE' }),
  upload: async <T>(p: string, file: File): Promise<T> => {
    const fd = new FormData()
    fd.append('file', file)
    const r = await fetch(`${apiBase()}${p}`, { method: 'POST', body: fd })
    if (!r.ok) throw new Error(`${r.status}`)
    return r.json()
  },
}

export type BusHandler = (type: string, data: any) => void
export function connectBus(onEvent: BusHandler): () => void {
  const proto = location.protocol === 'https:' ? 'wss' : 'ws'
  const host = apiBase()
    ? apiBase().replace(/^https?:\/\//, '').replace(/^wss?:\/\//, '')
    : location.host
  let ws: WebSocket | null = null
  let alive = true
  const open = () => {
    if (!alive) return
    ws = new WebSocket(`${proto}://${host}/ws`)
    ws.onmessage = (e) => {
      try {
        const m = JSON.parse(e.data)
        onEvent(m.type, m.data)
      } catch { /* noop */ }
    }
    ws.onclose = () => setTimeout(open, 3000)
  }
  open()
  return () => { alive = false; ws?.close() }
}
