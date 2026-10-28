import { Suspense, useEffect, useMemo, useRef, useState } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { OrbitControls, Text, RoundedBox, Html } from '@react-three/drei'
import { api, connectBus } from '../api'
import type { AgentVisual, OfficeData } from '../types'
import * as THREE from 'three'

const STATE_COLOR: Record<string, string> = {
  idle: '#4f8ff7', working: '#f7b84f', waiting_permission: '#e11d48',
  blocked: '#a855f7', paused: '#64748b', offline: '#334155',
}
const STATE_LABEL: Record<string, string> = {
  idle: 'en espera', working: 'trabajando', waiting_permission: 'esperando permiso',
  blocked: 'bloqueado', paused: 'en pausa', offline: 'desconectado',
}

function Room({ scenario }: { scenario: string }) {
  if (scenario === 'lab') {
    return (
      <group>
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.02, 0]}>
          <planeGeometry args={[30, 30]} /><meshStandardMaterial color="#101726" />
        </mesh>
        <gridHelper args={[30, 30, '#26304a', '#1b2540']} />
      </group>
    )
  }
  return (
    <group>
      {/* floor + walls of an office */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.02, 0]}>
        <planeGeometry args={[26, 18]} /><meshStandardMaterial color="#2b241d" />
      </mesh>
      <mesh position={[0, 2, -9]}>
        <boxGeometry args={[26, 4.2, 0.15]} /><meshStandardMaterial color="#1d2740" />
      </mesh>
      <mesh position={[-13, 2, 0]} rotation={[0, Math.PI / 2, 0]}>
        <boxGeometry args={[18, 4.2, 0.15]} /><meshStandardMaterial color="#1d2740" />
      </mesh>
      {/* windows */}
      {[[-9, -8.9], [-3, -8.9], [3, -8.9], [9, -8.9]].map(([x, z], i) => (
        <mesh key={i} position={[x, 2.4, z]}>
          <boxGeometry args={[4.4, 2, 0.1]} />
          <meshStandardMaterial color="#7fb7ff" emissive="#3a6ea8" emissiveIntensity={0.55} />
        </mesh>
      ))}
      {/* sofas leisure zone */}
      {[[-9, 6], [-7, 6.6]].map(([x, z], i) => (
        <mesh key={`s${i}`} position={[x, 0.35, z]}>
          <boxGeometry args={[1.8, 0.7, 0.9]} /><meshStandardMaterial color="#7c4d2a" />
        </mesh>
      ))}
      <mesh position={[-8, 0.3, 5.4]}><boxGeometry args={[1.4, 0.6, 0.7]} />
        <meshStandardMaterial color="#3d5a3a" /></mesh>
      {/* plants */}
      {[[-12, -7], [12, 7]].map(([x, z], i) => (
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

function Avatar({ ag, pos, cycle }: { ag: AgentVisual; pos: [number, number, number]; cycle: boolean }) {
  const ref = useRef<THREE.Group>(null)
  const leisure = ag.status === 'idle' && Math.random() < 0.25
  const target = useMemo<[number, number, number]>(() =>
    leisure ? [-8 + Math.random() * 2, 0, 5.4 + Math.random() * 1.5] : [pos[0], 0, pos[2] - 0.55],
    [pos, leisure])
  useFrame((_, dt) => {
    if (!ref.current || !cycle) return
    const d = ref.current.position
    d.x += (target[0] - d.x) * Math.min(1, dt * 1.2)
    d.z += (target[2] - d.z) * Math.min(1, dt * 1.2)
  })
  const color = STATE_COLOR[ag.status] || '#4f8ff7'
  return (
    <group>
      <Desk pos={pos} />
      <group ref={ref} position={[pos[0], 0, pos[2] - 0.55]}>
        {/* body */}
        <mesh position={[0, 0.55, 0]}>
          <capsuleGeometry args={[0.22, 0.45, 4, 10]} />
          <meshStandardMaterial color={ag.avatar_color || '#4f8ff7'} />
        </mesh>
        {/* head */}
        <mesh position={[0, 1.05, 0]}>
          <sphereGeometry args={[0.2, 16, 16]} />
          <meshStandardMaterial color="#f2d5b8" />
        </mesh>
        {/* hat accents CEO */}
        {ag.is_ceo && (
          <mesh position={[0, 1.28, 0]}><coneGeometry args={[0.18, 0.28, 8]} />
            <meshStandardMaterial color="#f7b84f" /></mesh>
        )}
        {/* name + status */}
        <Text position={[0, 1.65, 0]} fontSize={0.22} color="#e9edf5" anchorX="center">
          {ag.is_ceo ? `👑 ${ag.name}` : ag.name}
        </Text>
        <Text position={[0, 1.4, 0]} fontSize={0.15} color={color} anchorX="center">
          {STATE_LABEL[ag.status] || ag.status}
        </Text>
        <Html position={[0, 1.9, 0]} center distanceFactor={8}>
          <div className="w-24 h-1.5 bg-black/60 rounded overflow-hidden">
            <div className="h-full" style={{ width: `${Math.min(100, ag.usage)}%`, background: color }} />
          </div>
        </Html>
      </group>
    </group>
  )
}

function DayNight({ cycle, hour }: { cycle: boolean; hour: number }) {
  const light = useMemo(() => {
    if (!cycle) return { intensity: 0.9, color: '#ffffff', bg: '#0f1420' }
    const t = Math.sin((hour - 6) / 24 * Math.PI * 2) * 0.5 + 0.5
    return {
      intensity: 0.15 + t * 0.95,
      color: hour < 7 || hour > 18 ? '#8fa8ff' : '#fff4dd',
      bg: hour < 6 || hour > 19 ? '#05070d' : hour < 9 || hour > 17 ? '#2a3450' : '#0f1420',
    }
  }, [cycle, hour])
  return (
    <>
      <color attach="background" args={[light.bg]} />
      <ambientLight intensity={light.intensity * 0.5} color={light.color} />
      <directionalLight position={[6, 8, 4]} intensity={light.intensity} color={light.color} />
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
  useEffect(() => {
    if (!data?.cycle) return
    const iv = setInterval(() => setHour((h) => (h + 0.5) % 24), 4000)
    return () => clearInterval(iv)
  }, [data?.cycle])

  const set = async (k: string, v: any) => {
    setData(await api.put('/api/office', { [k]: v }))
  }

  if (!data) return <div className="p-6 text-slate-500">Cargando oficina…</div>
  const positions = data.placements

  return (
    <div className="h-full flex flex-col">
      <div className="flex items-center gap-2 px-4 py-2 border-b border-edge flex-wrap">
        <h1 className="font-bold mr-2">Oficina 3D</h1>
        <select className="input !w-40" value={data.scenario} onChange={(e) => set('scenario', e.target.value)}>
          <option value="office">Oficina moderna</option>
          <option value="lab">Laboratorio</option>
        </select>
        <select className="input !w-36" value={data.layout} onChange={(e) => set('layout', e.target.value)}>
          <option value="grid">Cuadrícula</option>
          <option value="open">Espacio abierto</option>
        </select>
        <label className="text-xs flex items-center gap-1">
          <input type="checkbox" checked={data.cycle} onChange={(e) => set('cycle', e.target.checked)} />
          ciclo día/noche
        </label>
        {data.cycle && <span className="chip">{String(Math.floor(hour)).padStart(2, '0')}:00</span>}
        <label className="text-xs flex items-center gap-1 ml-auto">
          <input type="checkbox" checked={admin} onChange={(e) => setAdmin(e.target.checked)} />
          modo administrador
        </label>
      </div>
      <div className="flex-1 relative">
        <Canvas camera={{ position: [9, 8, 10], fov: 45 }}>
          <DayNight cycle={data.cycle} hour={hour} />
          <Suspense fallback={null}>
            <Room scenario={data.scenario} />
            {data.agents.map((a) => positions[a.id] && (
              <group key={a.id}
                onClick={() => setSel(a)}>
                <Avatar ag={a} pos={positions[a.id] as [number, number, number]} cycle={data.cycle} />
              </group>
            ))}
          </Suspense>
          <OrbitControls maxPolarAngle={Math.PI / 2.15} minDistance={3} maxDistance={22}
            enablePan enableRotate enableZoom />
        </Canvas>
        {admin && (
          <div className="absolute right-3 top-3 card w-72 space-y-2 max-h-[80%] overflow-y-auto scroll-thin">
            <h3 className="font-semibold">Administrador de oficina</h3>
            <label className="label">Iluminación</label>
            <select className="input" value={data.lighting} onChange={(e) => set('lighting', e.target.value)}>
              <option value="auto">Automática</option><option value="day">Día</option>
              <option value="night">Noche</option><option value="warm">Cálida</option>
            </select>
            <label className="label">Reorganizar</label>
            <button className="btn-ghost text-xs w-full" onClick={async () =>
              setData(await api.post('/api/office/auto-layout'))}>Disposición automática por zonas</button>
            <div className="text-xs text-slate-500">
              Zonas: puestos de trabajo (centro), reunión (izquierda),
              ocio (abajo-izquierda), recepción (entrada).
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
              <div>Estado: <span style={{ color: STATE_COLOR[sel.status] }}>{STATE_LABEL[sel.status]}</span></div>
              <div>Rol: {sel.role} · Modelo: {sel.model}</div>
              {sel.task && <div>Tarea: {sel.task.title}</div>}
              <div>Uso de contexto: {sel.usage}%</div>
              {sel.waiting_auth && <div className="text-warn">⏸ Esperando tu autorización en Confirmaciones</div>}
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
