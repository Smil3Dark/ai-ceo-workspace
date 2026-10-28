import { Suspense, useEffect, useMemo, useRef, useState } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { OrbitControls, Text, Html } from '@react-three/drei'
import { api, connectBus } from '../api'
import type { AgentVisual, OfficeData } from '../types'
import * as THREE from 'three'

/* Backend visual states (Spanish, from office_service.STATUS_MAP) */
const STATE_COLOR: Record<string, string> = {
  sin_actividad: '#4f8ff7', esperando: '#eab308', trabajando: '#f7b84f',
  en_verificacion: '#22d3ee', esperando_confirmacion: '#e11d48',
  bloqueado: '#a855f7', error: '#ef4444', pausado: '#64748b',
  sin_configurar: '#334155',
}
const STATE_LABEL: Record<string, string> = {
  sin_actividad: 'en espera', esperando: 'programado', trabajando: 'trabajando',
  en_verificacion: 'verificando', esperando_confirmacion: 'esperando tu confirmación',
  bloqueado: 'bloqueado', error: 'error', pausado: 'en pausa',
  sin_configurar: 'sin configurar',
}

/* Map backend zones (office/auto-layout) to world coords of the room */
const ZONE_ORIGIN: Record<string, [number, number]> = {
  ceo_desk: [8, -5.5], dev_area: [1, -1.5], library: [-5, -4.5],
  comms_area: [8.5, -1.5], meeting_room: [-8.5, -5],
  leisure_zone: [-8.5, 5.5], open_space: [0, 1.5],
}
function slotPos(zone: string, slot: number): [number, number, number] {
  const [zx, zz] = ZONE_ORIGIN[zone] || ZONE_ORIGIN.open_space
  return [zx + (slot % 3) * 1.9 - 1.9, 0, zz + Math.floor(slot / 3) * 1.9]
}

function Room({ scenario, layout }: { scenario: string; layout: any }) {
  if (scenario === 'lab') {
    return (
      <group>
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.02, 0]}>
          <planeGeometry args={[30, 30]} /><meshStandardMaterial color="#101726" />
        </mesh>
        <gridHelper args={[30, 30, '#26304a', '#1b2540']} />
        <pointLight position={[0, 5, 0]} intensity={0.7} color="#7fd4ff" />
      </group>
    )
  }
  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.02, 0]}>
        <planeGeometry args={[26, 18]} /><meshStandardMaterial color="#2b241d" />
      </mesh>
      <mesh position={[0, 2, -9]}>
        <boxGeometry args={[26, 4.2, 0.15]} /><meshStandardMaterial color="#1d2740" />
      </mesh>
      <mesh position={[-13, 2, 0]} rotation={[0, Math.PI / 2, 0]}>
        <boxGeometry args={[18, 4.2, 0.15]} /><meshStandardMaterial color="#1d2740" />
      </mesh>
      {[[-9, -8.9], [-3, -8.9], [3, -8.9], [9, -8.9]].map(([x, z], i) => (
        <mesh key={i} position={[x, 2.4, z]}>
          <boxGeometry args={[4.4, 2, 0.1]} />
          <meshStandardMaterial color="#7fb7ff" emissive="#3a6ea8" emissiveIntensity={0.55} />
        </mesh>
      ))}
      {/* meeting room zone */}
      {layout?.meeting_room && (
        <group position={[-8.5, 0, -5]}>
          <mesh position={[0, 0.4, 0]}><boxGeometry args={[2.6, 0.12, 1.4]} />
            <meshStandardMaterial color="#4a3b28" /></mesh>
          {[[-1.4, -0.8], [-1.4, 0.8], [1.4, -0.8], [1.4, 0.8]].map(([x, z], i) => (
            <mesh key={i} position={[x, 0.25, z]}><boxGeometry args={[0.5, 0.5, 0.5]} />
              <meshStandardMaterial color="#33415e" /></mesh>
          ))}
        </group>
      )}
      {/* leisure zone: sofas */}
      {layout?.leisure_zone && (
        <group position={[-8.5, 0, 5.5]}>
          {[[0, 0], [1.8, 0.6]].map(([x, z], i) => (
            <mesh key={i} position={[x, 0.35, z]}><boxGeometry args={[1.8, 0.7, 0.9]} />
              <meshStandardMaterial color="#7c4d2a" /></mesh>
          ))}
          <mesh position={[0.9, 0.3, -1.2]}><boxGeometry args={[1.4, 0.6, 0.7]} />
            <meshStandardMaterial color="#3d5a3a" /></mesh>
        </group>
      )}
      {[[-12, -7], [12, 7]].slice(0, layout?.plants ? 2 : 0).map(([x, z], i) => (
        <group key={`p${i}`} position={[x, 0, z]}>
          <mesh position={[0, 0.3, 0]}><cylinderGeometry args={[0.3, 0.4, 0.6]} />
            <meshStandardMaterial color="#6b4a2f" /></mesh>
          <mesh position={[0, 1.1, 0]}><sphereGeometry args={[0.7, 8, 8]} />
            <meshStandardMaterial color="#2f6d3a" /></mesh>
        </group>
      ))}
    </group>
  )
}

function Desk({ pos }: { pos: [number, number, number] }) {
  return (
    <group position={pos}>
      <mesh position={[0, 0.38, 0]}><boxGeometry args={[1.6, 0.08, 0.8]} />
        <meshStandardMaterial color="#5a4632" /></mesh>
      {[[-0.7, -0.3], [0.7, -0.3], [-0.7, 0.3], [0.7, 0.3]].map(([x, z], i) => (
        <mesh key={i} position={[x, 0.19, z]}><boxGeometry args={[0.06, 0.38, 0.06]} />
          <meshStandardMaterial color="#3a2f22" /></mesh>
      ))}
      <mesh position={[0.25, 0.62, -0.15]} rotation={[-0.25, 0, 0]}>
        <boxGeometry args={[0.55, 0.35, 0.03]} />
        <meshStandardMaterial color="#10131c" emissive="#4f8ff7" emissiveIntensity={0.9} />
      </mesh>
    </group>
  )
}

function Avatar({ ag, pos, wandering }: {
  ag: AgentVisual; pos: [number, number, number]; wandering: boolean
}) {
  const ref = useRef<THREE.Group>(null)
  const leisure = ag.state === 'sin_actividad' && ag.agent_id % 3 === 0
  const target = useMemo<[number, number, number]>(() =>
    wandering && leisure ? [-8 + (ag.agent_id % 2), 0, 4.5]
      : [pos[0], 0, pos[2] - 0.55], [pos, leisure, wandering, ag.agent_id])
  useFrame((_, dt) => {
    if (!ref.current) return
    const d = ref.current.position
    d.x += (target[0] - d.x) * Math.min(1, dt * 1.2)
    d.z += (target[2] - d.z) * Math.min(1, dt * 1.2)
  })
  const color = STATE_COLOR[ag.state] || '#4f8ff7'
  const isCeo = ag.role === 'ceo'
  return (
    <group>
      <Desk pos={pos} />
      <group ref={ref} position={[pos[0], 0, pos[2] - 0.55]}>
        <mesh position={[0, 0.55, 0]}>
          <capsuleGeometry args={[0.22, 0.45, 4, 10]} />
          <meshStandardMaterial color={ag.avatar?.color || '#4f8ff7'} />
        </mesh>
        <mesh position={[0, 1.05, 0]}>
          <sphereGeometry args={[0.2, 16, 16]} />
          <meshStandardMaterial color="#f2d5b8" />
        </mesh>
        {isCeo && (
          <mesh position={[0, 1.28, 0]}><coneGeometry args={[0.18, 0.28, 8]} />
            <meshStandardMaterial color="#f7b84f" /></mesh>
        )}
        <Text position={[0, 1.65, 0]} fontSize={0.22} color="#e9edf5" anchorX="center">
          {isCeo ? `👑 ${ag.name}` : ag.name}
        </Text>
        <Text position={[0, 1.4, 0]} fontSize={0.15} color={color} anchorX="center">
          {STATE_LABEL[ag.state] || ag.state}
        </Text>
      </group>
    </group>
  )
}

function DayNight({ on, hour, light }: { on: boolean; hour: number; light: any }) {
  const cfg = useMemo(() => {
    if (!on) return { intensity: light?.intensity ?? 0.9, color: '#ffffff', bg: '#0f1420' }
    const t = Math.sin((hour - 6) / 24 * Math.PI * 2) * 0.5 + 0.5
    return {
      intensity: 0.15 + t * 0.95,
      color: hour < 7 || hour > 18 ? '#8fa8ff' : '#fff4dd',
      bg: hour < 6 || hour > 19 ? '#05070d' : hour < 9 || hour > 17 ? '#2a3450' : '#0f1420',
    }
  }, [on, hour, light])
  return (
    <>
      <color attach="background" args={[cfg.bg]} />
      <ambientLight intensity={cfg.intensity * (light?.ambient ?? 0.5) * 2} color={cfg.color} />
      <directionalLight position={[6, 8, 4]} intensity={cfg.intensity} color={cfg.color} />
      {light?.interior_lights && <pointLight position={[0, 3.5, 0]} intensity={0.4} color="#ffd9a0" />}
    </>
  )
}

export default function OfficePage() {
  const [data, setData] = useState<OfficeData | null>(null)
  const [admin, setAdmin] = useState(false)
  const [hour, setHour] = useState(10)
  const [sel, setSel] = useState<AgentVisual | null>(null)

  const reload = () => api.get<OfficeData>('/api/office').then(setData)
  useEffect(() => { reload() }, [])
  useEffect(() => connectBus((t) => { if (['agent', 'task', 'office'].includes(t)) reload() }), [])
  const cycleOn = data?.config.cycle?.mode === 'auto'
  useEffect(() => {
    if (!cycleOn) return
    const iv = setInterval(() => setHour((h) => (h + 0.5) % 24), 4000)
    return () => clearInterval(iv)
  }, [cycleOn])

  const set = async (patch: Record<string, any>) => {
    await api.put('/api/office', patch); await reload()
  }

  if (!data) return <div className="p-6 text-slate-500">Cargando oficina…</div>
  const cfg = data.config

  return (
    <div className="h-full flex flex-col">
      <div className="flex items-center gap-2 px-4 py-2 border-b border-edge flex-wrap">
        <h1 className="font-bold mr-2">Oficina 3D</h1>
        <select className="input !w-44" value={cfg.scenario}
          onChange={(e) => set({ scenario: e.target.value })}>
          <option value="corporate">Oficina corporativa</option>
          <option value="lab">Laboratorio</option>
        </select>
        <label className="text-xs flex items-center gap-1">
          <input type="checkbox" checked={cycleOn}
            onChange={(e) => set({ cycle: { ...cfg.cycle, mode: e.target.checked ? 'auto' : 'off' } })} />
          ciclo día/noche
        </label>
        {cycleOn && <span className="chip">{String(Math.floor(hour)).padStart(2, '0')}:00</span>}
        <label className="text-xs flex items-center gap-1 ml-auto">
          <input type="checkbox" checked={admin} onChange={(e) => setAdmin(e.target.checked)} />
          modo administrador
        </label>
      </div>
      <div className="flex-1 relative">
        <Canvas camera={{ position: [9, 8, 10], fov: 45 }}>
          <DayNight on={cycleOn} hour={hour} light={cfg.lighting} />
          <Suspense fallback={null}>
            <Room scenario={cfg.scenario} layout={cfg.layout} />
            {data.agents.map((a, i) => {
              const p = cfg.placements?.[String(a.agent_id)]
              const pos = p ? slotPos(p.zone, p.slot) : slotPos('open_space', i)
              return (
                <group key={a.agent_id} onClick={() => setSel(a)}>
                  <Avatar ag={a} pos={pos} wandering={cycleOn && !!cfg.layout?.leisure_zone} />
                </group>
              )
            })}
          </Suspense>
          <OrbitControls maxPolarAngle={Math.PI / 2.15} minDistance={3} maxDistance={22}
            enablePan enableRotate enableZoom />
        </Canvas>
        {admin && (
          <div className="absolute right-3 top-3 card w-72 space-y-2 max-h-[80%] overflow-y-auto scroll-thin">
            <h3 className="font-semibold">Administrador de oficina</h3>
            <label className="label">Intensidad de luz</label>
            <input type="range" className="w-full" min={0.2} max={1.6} step={0.1}
              value={cfg.lighting?.intensity ?? 1}
              onChange={(e) => set({ lighting: { ...cfg.lighting, intensity: +e.target.value } })} />
            <label className="text-xs flex items-center gap-2">
              <input type="checkbox" checked={!!cfg.lighting?.interior_lights}
                onChange={(e) => set({ lighting: { ...cfg.lighting, interior_lights: e.target.checked } })} />
              luces interiores
            </label>
            <label className="text-xs flex items-center gap-2">
              <input type="checkbox" checked={!!cfg.layout?.leisure_zone}
                onChange={(e) => set({ layout: { ...cfg.layout, leisure_zone: e.target.checked } })} />
              zona de ocio
            </label>
            <label className="text-xs flex items-center gap-2">
              <input type="checkbox" checked={!!cfg.layout?.meeting_room}
                onChange={(e) => set({ layout: { ...cfg.layout, meeting_room: e.target.checked } })} />
              sala de reunión
            </label>
            <button className="btn-ghost text-xs w-full" onClick={async () => {
              await api.post('/api/office/auto-layout'); await reload()
            }}>Disposición automática por zonas</button>
            <div className="text-xs text-slate-500">
              Zonas: CEO, desarrollo, biblioteca, comunicaciones, reunión, ocio,
              espacio abierto.
            </div>
          </div>
        )}
        {sel && (
          <div className="absolute left-3 bottom-3 card w-72">
            <div className="flex justify-between">
              <b>{sel.name}</b>
              <button className="btn-ghost" onClick={() => setSel(null)}>✕</button>
            </div>
            <div className="text-xs text-slate-400 mt-1 space-y-1">
              <div>Estado: <span style={{ color: STATE_COLOR[sel.state] }}>{STATE_LABEL[sel.state] || sel.state}</span></div>
              <div>Rol: {sel.role} · estado interno: {sel.db_status}</div>
              {sel.task && <div>Tarea: {sel.task}</div>}
              {sel.state === 'esperando_confirmacion' && (
                <div className="text-warn">⏸ Esperando tu autorización en Confirmaciones</div>
              )}
            </div>
          </div>
        )}
        <div className="absolute left-3 top-3 text-xs text-slate-400 bg-black/40 rounded p-2 space-y-0.5">
          {Object.entries(STATE_LABEL).map(([k, l]) => (
            <div key={k}><span className="inline-block w-2 h-2 rounded-full mr-1"
              style={{ background: STATE_COLOR[k] }} />{l}</div>
          ))}
        </div>
      </div>
    </div>
  )
}
