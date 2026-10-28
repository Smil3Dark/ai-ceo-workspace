import { Component, Suspense, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { OrbitControls, Html } from '@react-three/drei'
import { useNavigate } from 'react-router-dom'
import { api, connectBus } from '../api'
import type { AgentVisual, OfficeData } from '../types'
import * as THREE from 'three'

/* Backend visual states (Spanish, from office_service.STATUS_MAP) */
const STATE_COLOR: Record<string, string> = {
  sin_actividad: '#4f8ff7', esperando: '#eab308', trabajando: '#22d3ee',
  en_verificacion: '#34c98e', esperando_confirmacion: '#ff2d95',
  bloqueado: '#a855f7', error: '#ef4444', pausado: '#64748b',
  sin_configurar: '#334155',
}
const STATE_LABEL: Record<string, string> = {
  sin_actividad: 'en espera', esperando: 'programado', trabajando: 'trabajando',
  en_verificacion: 'verificando', esperando_confirmacion: 'esperando tu confirmación',
  bloqueado: 'bloqueado', error: 'error', pausado: 'en pausa',
  sin_configurar: 'sin configurar',
}

/* LEGO palette (office-only; the rest of the app uses jet black/cerulean/neon rose) */
const LEGO = {
  plate: '#9da3a8', plateDark: '#5b636b', stud: '#8f959a',
  wall: '#f2f2ee', wallTop: '#e6e6e0',
  desk: '#c8a86a', deskDark: '#a8895a', chair: '#7a2d24',
  screen: '#0e1420', skin: '#f5c542', paper: '#f5f2ea',
}

/* zone anchors inside the baseplate (roughly matches the reference photo) */
const ZONE_ORIGIN: Record<string, [number, number]> = {
  ceo_desk: [-8.4, -4.6], dev_area: [2.5, -3.2], library: [-8.6, 2.5],
  comms_area: [8.4, -3.2], meeting_room: [-4.5, 5.2], leisure_zone: [6.5, 5.2],
  open_space: [0, 1.4],
}

function roleKind(role: string): string {
  const r = (role || '').toLowerCase()
  if (/ceo|direc|jef|líder|lider|chief/.test(r)) return 'ceo'
  if (/dev|progr|cod|soft|ingen|tec|dat/.test(r)) return 'dev'
  if (/invest|research|anal|escrit|doc|biblio/.test(r)) return 'research'
  if (/comun|market|vent|social|prensa|email|mensaj/.test(r)) return 'comms'
  if (/finan|contad|econo|presu|pago/.test(r)) return 'finance'
  if (/diseñ|art|ux|ui|graf|creativ/.test(r)) return 'design'
  return 'staff'
}

/* ---------------- LEGO pieces ---------------- */

function Studs({ w, d, y = 0.02, color = LEGO.stud, step = 0.5, x0 = 0, z0 = 0 }: {
  w: number; d: number; y?: number; color?: string; step?: number; x0?: number; z0?: number
}) {
  const ref = useRef<THREE.InstancedMesh>(null)
  const count = Math.floor(w / step) * Math.floor(d / step)
  useLayoutEffect(() => {
    const m = ref.current; if (!m) return
    const o = new THREE.Object3D()
    let i = 0
    for (let x = -w / 2 + step / 2; x < w / 2; x += step)
      for (let z = -d / 2 + step / 2; z < d / 2; z += step) {
        o.position.set(x0 + x, y, z0 + z); o.updateMatrix()
        m.setMatrixAt(i++, o.matrix)
      }
    m.instanceMatrix.needsUpdate = true
  }, [w, d, y, step, x0, z0])
  return (
    <instancedMesh key={count} ref={ref} args={[undefined, undefined, count]}>
      <cylinderGeometry args={[0.09, 0.09, 0.05, 10]} />
      <meshStandardMaterial color={color} />
    </instancedMesh>
  )
}

/* One LEGO brick: box + studs on top */
function Brick({ pos, size, color }: {
  pos: [number, number, number]; size: [number, number, number]; color: string
}) {
  const studs = Math.max(1, Math.round(size[0] / 0.5))
  return (
    <group position={pos}>
      <mesh><boxGeometry args={size} /><meshStandardMaterial color={color} /></mesh>
      {Array.from({ length: studs }).map((_, i) => (
        <mesh key={i} position={[-size[0] / 2 + (i + 0.5) * (size[0] / studs), size[1] / 2 + 0.025, 0]}>
          <cylinderGeometry args={[0.09, 0.09, 0.05, 10]} />
          <meshStandardMaterial color={color} />
        </mesh>
      ))}
    </group>
  )
}

/* Stacked-brick wall along X at fixed z */
function WallX({ x0, x1, z, h = 0.9, doorAt }: {
  x0: number; x1: number; z: number; h?: number; doorAt?: number
}) {
  const courses = Math.max(1, Math.round(h / 0.3))
  const bricks: ReactNode[] = []
  for (let c = 0; c < courses; c++) {
    const off = c % 2 ? 0.6 : 0
    for (let x = x0 + off; x + 1.2 <= x1 + 0.01; x += 1.2) {
      const mid = x + 0.6
      if (doorAt !== undefined && Math.abs(mid - doorAt) < 0.9 && c < courses - 1) continue
      bricks.push(<Brick key={`${c}-${x}`} pos={[mid, 0.15 + c * 0.3, z]}
        size={[1.2, 0.3, 0.3]} color={c % 2 ? LEGO.wall : LEGO.wallTop} />)
    }
  }
  return <group>{bricks}</group>
}

function MinifigFace() {
  const tex = useMemo(() => {
    const c = document.createElement('canvas'); c.width = c.height = 128
    const g = c.getContext('2d')!
    g.fillStyle = LEGO.skin; g.fillRect(0, 0, 128, 128)
    g.fillStyle = '#111'
    g.beginPath(); g.arc(44, 52, 7, 0, 7); g.arc(84, 52, 7, 0, 7); g.fill()
    g.strokeStyle = '#111'; g.lineWidth = 6; g.lineCap = 'round'
    g.beginPath(); g.arc(64, 70, 22, 0.15 * Math.PI, 0.85 * Math.PI); g.stroke()
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace
    return t
  }, [])
  return <meshStandardMaterial map={tex} />
}

/* A seated LEGO minifig on a chair, behind its desk */
function Minifig({ ag, deskZ }: { ag: AgentVisual; deskZ: number }) {
  const ref = useRef<THREE.Group>(null)
  const color = ag.avatar?.color || '#4f8ff7'
  const working = ag.state === 'trabajando' || ag.state === 'en_verificacion'
  useFrame(({ clock }) => {
    if (ref.current) ref.current.rotation.z = working ? Math.sin(clock.elapsedTime * 6) * 0.03 : 0
  })
  return (
    <group ref={ref} position={[0, 0, deskZ + 0.55]}>
      {/* chair */}
      <mesh position={[0, 0.28, 0.22]}><boxGeometry args={[0.55, 0.08, 0.5]} />
        <meshStandardMaterial color={LEGO.chair} /></mesh>
      <mesh position={[0, 0.55, 0.45]}><boxGeometry args={[0.55, 0.55, 0.08]} />
        <meshStandardMaterial color={LEGO.chair} /></mesh>
      {/* legs (seated) */}
      {[-0.11, 0.11].map((x, i) => (
        <mesh key={i} position={[x, 0.45, 0.1]}><boxGeometry args={[0.16, 0.22, 0.4]} />
          <meshStandardMaterial color="#1c2530" /></mesh>
      ))}
      {/* torso */}
      <mesh position={[0, 0.85, 0.18]}><boxGeometry args={[0.46, 0.55, 0.26]} />
        <meshStandardMaterial color={color} /></mesh>
      {[-0.3, 0.3].map((x, i) => (
        <mesh key={`a${i}`} position={[x, 0.85, 0.18]} rotation={[0.35, 0, 0]}>
          <boxGeometry args={[0.12, 0.45, 0.12]} />
          <meshStandardMaterial color={color} /></mesh>
      ))}
      {/* head with LEGO face */}
      <mesh position={[0, 1.32, 0.18]}>
        <cylinderGeometry args={[0.19, 0.19, 0.24, 20]} />
        <MinifigFace />
      </mesh>
      {/* hair */}
      <mesh position={[0, 1.47, 0.18]} scale={[1, 0.55, 1]}>
        <sphereGeometry args={[0.2, 16, 12]} />
        <meshStandardMaterial color={ag.role === 'ceo' ? '#5a4632' : '#2b2b2b'} />
      </mesh>
      {ag.role === 'ceo' && (
        <mesh position={[0, 1.62, 0.18]}><coneGeometry args={[0.14, 0.2, 8]} />
          <meshStandardMaterial color="#ffd34d" emissive="#8a6d00" emissiveIntensity={0.3} /></mesh>
      )}
    </group>
  )
}

/* role-specific decoration sitting on the desk */
function RoleDecor({ kind }: { kind: string }) {
  switch (kind) {
    case 'dev':
      return (<group>
        {[-0.3, 0.3].map((x, i) => (
          <group key={i} position={[x, 0, -0.1]}>
            <mesh position={[0, 0.32, 0]}><boxGeometry args={[0.5, 0.32, 0.04]} />
              <meshStandardMaterial color={LEGO.screen} emissive="#007ba7" emissiveIntensity={0.9} /></mesh>
            <mesh position={[0, 0.12, 0]}><boxGeometry args={[0.06, 0.16, 0.06]} />
              <meshStandardMaterial color="#333" /></mesh>
          </group>))}
        <mesh position={[0, 0.03, 0.25]}><boxGeometry args={[0.7, 0.04, 0.25]} />
          <meshStandardMaterial color="#222" /></mesh>
      </group>)
    case 'research':
      return (<group>
        {['#b3392e', '#2e5cb3', '#2e8b57'].map((c, i) => (
          <mesh key={i} position={[-0.45, 0.04 + i * 0.07, -0.05]} rotation={[0, i * 0.2, 0]}>
            <boxGeometry args={[0.4, 0.06, 0.55]} /><meshStandardMaterial color={c} /></mesh>))}
        <mesh position={[0.35, 0.02, 0]} rotation={[0, 0.15, 0]}>
          <boxGeometry args={[0.45, 0.02, 0.6]} /><meshStandardMaterial color={LEGO.paper} /></mesh>
        <mesh position={[0.45, 0.02, 0.32]} rotation={[0, -0.1, 0]}>
          <boxGeometry args={[0.45, 0.02, 0.6]} /><meshStandardMaterial color={LEGO.paper} /></mesh>
      </group>)
    case 'comms':
      return (<group>
        <mesh position={[-0.4, 0.25, -0.1]}><cylinderGeometry args={[0.02, 0.02, 0.5, 8]} />
          <meshStandardMaterial color="#888" /></mesh>
        <mesh position={[-0.4, 0.52, -0.1]}><sphereGeometry args={[0.07, 10, 10]} />
          <meshStandardMaterial color="#ff2d95" emissive="#ff2d95" emissiveIntensity={0.5} /></mesh>
        <mesh position={[0.3, 0.06, 0.1]} rotation={[0.2, 0, 0]}>
          <boxGeometry args={[0.3, 0.08, 0.4]} /><meshStandardMaterial color="#222" /></mesh>
        <mesh position={[0.3, 0.12, -0.02]}><boxGeometry args={[0.22, 0.04, 0.28]} />
          <meshStandardMaterial color={LEGO.screen} emissive="#34c98e" emissiveIntensity={0.7} /></mesh>
      </group>)
    case 'finance':
      return (<group>
        {[0.05, 0.1, 0.15].map((y, i) => (
          <mesh key={i} position={[-0.35, y, -0.05]}><cylinderGeometry args={[0.12, 0.12, 0.045, 14]} />
            <meshStandardMaterial color="#ffd34d" metalness={0.6} roughness={0.3} /></mesh>))}
        <mesh position={[0.3, 0.04, 0.1]} rotation={[0, -0.2, 0]}>
          <boxGeometry args={[0.35, 0.05, 0.45]} /><meshStandardMaterial color="#d8d8d8" /></mesh>
      </group>)
    case 'design':
      return (<group>
        {['#ff2d95', '#007ba7', '#ffd34d', '#34c98e'].map((c, i) => (
          <mesh key={i} position={[-0.5 + i * 0.3, 0.03, 0.15]}>
            <boxGeometry args={[0.22, 0.04, 0.22]} /><meshStandardMaterial color={c} /></mesh>))}
        <mesh position={[0.25, 0.25, -0.15]} rotation={[-0.3, 0, 0]}>
          <boxGeometry args={[0.45, 0.35, 0.03]} /><meshStandardMaterial color={LEGO.paper} /></mesh>
      </group>)
    case 'ceo':
      return (<group>
        <mesh position={[-0.45, 0.22, -0.1]}><cylinderGeometry args={[0.03, 0.05, 0.4, 10]} />
          <meshStandardMaterial color="#8a6d00" /></mesh>
        <mesh position={[-0.45, 0.45, -0.1]}><sphereGeometry args={[0.12, 12, 10]} />
          <meshStandardMaterial color="#ffd34d" emissive="#ffd34d" emissiveIntensity={0.6} /></mesh>
        <mesh position={[0.35, 0.32, -0.1]}><boxGeometry args={[0.55, 0.35, 0.04]} />
          <meshStandardMaterial color={LEGO.screen} emissive="#007ba7" emissiveIntensity={0.9} /></mesh>
      </group>)
    default:
      return (<group>
        <mesh position={[0, 0.3, -0.1]}><boxGeometry args={[0.5, 0.32, 0.04]} />
          <meshStandardMaterial color={LEGO.screen} emissive="#4f8ff7" emissiveIntensity={0.9} /></mesh>
        <mesh position={[-0.3, 0.02, 0.2]} rotation={[0, 0.2, 0]}>
          <boxGeometry args={[0.35, 0.02, 0.5]} /><meshStandardMaterial color={LEGO.paper} /></mesh>
        <mesh position={[0.4, 0.08, 0.2]}><cylinderGeometry args={[0.06, 0.05, 0.14, 10]} />
          <meshStandardMaterial color="#b3392e" /></mesh>
      </group>)
  }
}

/* Desk + chair + seated minifig + nameplate + role decor */
function SeatStation({ ag, pos, onSel }: {
  ag: AgentVisual; pos: [number, number, number]; onSel: () => void
}) {
  const kind = roleKind(ag.role)
  const wide = kind === 'ceo' ? 2.4 : 1.7
  const col = STATE_COLOR[ag.state] || '#4f8ff7'
  return (
    <group position={pos} onClick={(e) => { e.stopPropagation(); onSel() }}>
      {/* desk */}
      <mesh position={[0, 0.37, 0]}><boxGeometry args={[wide, 0.74, 0.9]} />
        <meshStandardMaterial color={kind === 'ceo' ? '#8a6a4a' : LEGO.desk} /></mesh>
      <mesh position={[0, 0.76, 0]}><boxGeometry args={[wide, 0.05, 0.95]} />
        <meshStandardMaterial color={LEGO.deskDark} /></mesh>
      <group position={[0, 0.78, 0]}><RoleDecor kind={kind} /></group>
      {/* nameplate on the desk front */}
      <mesh position={[0, 0.5, 0.46]}><boxGeometry args={[1.1, 0.22, 0.03]} />
        <meshStandardMaterial color="#0a0a0a" /></mesh>
      <Html position={[0, 0.5, 0.49]} center transform distanceFactor={9}
        style={{ pointerEvents: 'none' }}>
        <div style={{
          fontSize: 9, fontWeight: 700, color: '#fff', whiteSpace: 'nowrap',
          letterSpacing: 0.5,
        }}>{ag.name.toUpperCase()}</div>
      </Html>
      {/* minifig seated behind the desk */}
      <Minifig ag={ag} deskZ={0.5} />
      {/* floating name pill like the reference */}
      <Html position={[0, 2.05, 0.6]} center distanceFactor={10}
        style={{ pointerEvents: 'none' }}>
        <div style={{
          display: 'flex', alignItems: 'center', gap: 5, background: 'rgba(255,255,255,0.95)',
          borderRadius: 999, padding: '3px 10px 3px 4px', fontSize: 12, fontWeight: 600,
          color: '#111', boxShadow: '0 2px 6px rgba(0,0,0,0.4)', whiteSpace: 'nowrap',
        }}>
          <span style={{
            width: 16, height: 16, borderRadius: '50%', background: LEGO.skin,
            display: 'inline-block', position: 'relative', flexShrink: 0,
          }}>
            <span style={{
              position: 'absolute', right: -2, top: -2, width: 7, height: 7,
              borderRadius: '50%', background: col, border: '1.5px solid #fff',
            }} />
          </span>
          {ag.name}
        </div>
      </Html>
    </group>
  )
}

/* meeting room: brick table + chairs */
function MeetingRoom({ pos }: { pos: [number, number] }) {
  return (
    <group position={[pos[0], 0, pos[1]]}>
      <mesh position={[0, 0.45, 0]}><boxGeometry args={[2.6, 0.15, 1.3]} />
        <meshStandardMaterial color="#4a3b28" /></mesh>
      {[[-1.1, -0.5], [1.1, -0.5], [-1.1, 0.5], [1.1, 0.5]].map(([x, z], i) => (
        <mesh key={i} position={[x, 0.22, z]}><boxGeometry args={[0.12, 0.44, 0.12]} />
          <meshStandardMaterial color="#3a2f22" /></mesh>))}
      {[[-0.9, -1.1], [0, -1.1], [0.9, -1.1], [-0.9, 1.1], [0, 1.1], [0.9, 1.1]].map(([x, z], i) => (
        <group key={`c${i}`} position={[x, 0, z]}>
          <mesh position={[0, 0.28, 0]}><boxGeometry args={[0.5, 0.08, 0.45]} />
            <meshStandardMaterial color="#33415e" /></mesh>
          <mesh position={[0, 0.5, z < 0 ? -0.2 : 0.2]}><boxGeometry args={[0.5, 0.45, 0.07]} />
            <meshStandardMaterial color="#33415e" /></mesh>
        </group>))}
    </group>
  )
}

/* leisure zone: brick couches + plant + coffee table */
function LeisureZone({ pos }: { pos: [number, number] }) {
  return (
    <group position={[pos[0], 0, pos[1]]}>
      {[0, 1.9].map((x, i) => (
        <group key={i} position={[x, 0, 0]}>
          <mesh position={[0, 0.25, 0]}><boxGeometry args={[1.7, 0.5, 0.85]} />
            <meshStandardMaterial color="#b8541e" /></mesh>
          <mesh position={[0, 0.6, -0.32]}><boxGeometry args={[1.7, 0.4, 0.2]} />
            <meshStandardMaterial color="#b8541e" /></mesh>
        </group>))}
      <mesh position={[0.95, 0.2, -1.4]}><boxGeometry args={[1.3, 0.4, 0.7]} />
        <meshStandardMaterial color="#3d5a3a" /></mesh>
      <group position={[-1.4, 0, 0]}>
        <mesh position={[0, 0.3, 0]}><cylinderGeometry args={[0.28, 0.36, 0.6, 10]} />
          <meshStandardMaterial color="#6b4a2f" /></mesh>
        <mesh position={[0, 1, 0]}><sphereGeometry args={[0.65, 8, 8]} />
          <meshStandardMaterial color="#2f8b3a" /></mesh>
      </group>
    </group>
  )
}

/* whole room: studded baseplate + white brick walls + zones */
function Room({ layout }: { layout: any }) {
  return (
    <group>
      {/* baseplate */}
      <mesh position={[0, -0.05, 0]}><boxGeometry args={[22, 0.1, 16]} />
        <meshStandardMaterial color={LEGO.plate} /></mesh>
      <Studs w={22} d={16} y={0.02} />
      {/* walls: back + two sides, white bricks, with a door gap on the right wall */}
      <WallX x0={-11} x1={11} z={-8} h={1.2} />
      <group rotation={[0, Math.PI / 2, 0]}>
        <WallX x0={-8} x1={8} z={-11} h={1.2} />
      </group>
      <group rotation={[0, Math.PI / 2, 0]}>
        <WallX x0={-8} x1={8} z={11} h={1.2} doorAt={2} />
      </group>
      {layout?.meeting_room && <MeetingRoom pos={ZONE_ORIGIN.meeting_room} />}
      {layout?.leisure_zone && <LeisureZone pos={ZONE_ORIGIN.leisure_zone} />}
      {layout?.plants !== false && (
        <group position={[9.8, 0, 6.8]}>
          <mesh position={[0, 0.3, 0]}><cylinderGeometry args={[0.28, 0.36, 0.6, 10]} />
            <meshStandardMaterial color="#6b4a2f" /></mesh>
          <mesh position={[0, 1, 0]}><sphereGeometry args={[0.65, 8, 8]} />
            <meshStandardMaterial color="#2f8b3a" /></mesh>
        </group>
      )}
    </group>
  )
}

function DayNight({ on, hour, light }: { on: boolean; hour: number; light: any }) {
  const cfg = useMemo(() => {
    if (!on) return { intensity: light?.intensity ?? 0.9, color: '#ffffff', bg: '#0a0a0a' }
    const t = Math.sin((hour - 6) / 24 * Math.PI * 2) * 0.5 + 0.5
    return {
      intensity: 0.15 + t * 0.95,
      color: hour < 7 || hour > 18 ? '#8fa8ff' : '#fff4dd',
      bg: hour < 6 || hour > 19 ? '#05070d' : hour < 9 || hour > 17 ? '#1a2438' : '#0a0a0a',
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

/* Catches WebGL/renderer failures so a broken 3D context can't unmount the
   whole app (spec: the office is an optional visual layer). */
class CanvasBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false }
  static getDerivedStateFromError() { return { failed: true } }
  componentDidCatch(err: unknown) { console.error('office 3D error', err) }
  render() {
    if (this.state.failed) return (
      <div className="h-full flex items-center justify-center text-slate-400 text-sm p-8 text-center">
        La oficina 3D no está disponible en este navegador o GPU (WebGL).<br />
        Los agentes siguen funcionando: puedes gestionarlos desde Agentes y Tareas.
      </div>
    )
    return this.props.children
  }
}

/* minifig face icon for the bottom dock (SVG so it always renders) */
function DockFace({ color, size = 40 }: { color: string; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 40 40">
      <rect x="13" y="4" width="14" height="5" rx="2" fill={color} />
      <rect x="8" y="8" width="24" height="26" rx="8" fill="#f5c542" />
      <circle cx="16" cy="20" r="2.2" fill="#111" />
      <circle cx="24" cy="20" r="2.2" fill="#111" />
      <path d="M14 25 q6 6 12 0" stroke="#111" strokeWidth="2.2" fill="none" strokeLinecap="round" />
    </svg>
  )
}

/* bottom dock: all agents' faces + status color + counters (like the reference) */
function AgentDock({ agents, sel, onSel }: {
  agents: AgentVisual[]; sel: AgentVisual | null; onSel: (a: AgentVisual) => void
}) {
  const nav = useNavigate()
  const [ov, setOv] = useState<any>(null)
  useEffect(() => {
    const load = () => api.get<any>('/api/admin/overview').then(setOv).catch(() => {})
    load()
    return connectBus(() => load())
  }, [])
  return (
    <div className="border-t border-edge bg-panel/95 backdrop-blur px-3 py-2 flex items-end gap-2 overflow-x-auto scroll-thin">
      <button onClick={() => nav('/agents/new')}
        className="shrink-0 w-14 rounded-xl bg-accent2/90 hover:bg-accent2 text-white flex flex-col items-center py-1.5 transition-colors">
        <span className="text-lg leading-none">+</span>
        <span className="text-[10px] mt-1">Nuevo</span>
      </button>
      {agents.map((a) => {
        const col = STATE_COLOR[a.state] || '#4f8ff7'
        const active = sel?.agent_id === a.agent_id
        return (
          <button key={a.agent_id} onClick={() => onSel(a)} title={`${a.name} — ${STATE_LABEL[a.state] || a.state}`}
            className={`shrink-0 w-14 rounded-xl flex flex-col items-center py-1.5 transition-colors ${active ? 'bg-edge ring-1 ring-accent' : 'hover:bg-edge/60'}`}>
            <span className="relative">
              <DockFace color={a.avatar?.color || '#4f8ff7'} size={34} />
              <span className="absolute -right-1 -top-0.5 w-3 h-3 rounded-full border-2 border-panel"
                style={{ background: col }} />
            </span>
            <span className="text-[10px] mt-1 max-w-full truncate">{a.name}</span>
          </button>
        )
      })}
      <div className="ml-auto flex items-center gap-2 shrink-0">
        {[
          ['Tareas', (ov?.tasks_pending ?? 0) + (ov?.tasks_running ?? 0), 'bg-accent2'],
          ['Para ti', ov?.approvals_pending ?? 0, 'bg-warn'],
          ['Agentes', agents.length, 'bg-edge'],
        ].map(([label, n, cls]) => (
          <div key={label as string} className="flex flex-col items-center px-3 py-1 rounded-xl bg-ink border border-edge">
            <span className={`${cls} text-white text-xs font-bold rounded-full min-w-[1.4rem] h-5 px-1 flex items-center justify-center`}>{n}</span>
            <span className="text-[10px] text-slate-400 mt-0.5">{label}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

/* desk grid position for agent i when it has no explicit placement */
function autoSlot(i: number): [number, number, number] {
  const perRow = 4
  const row = Math.floor(i / perRow), col = i % perRow
  return [-6 + col * 3.4, 0, -2.2 + row * 3.2]
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

  const agentPos = (a: AgentVisual, i: number): [number, number, number] => {
    const p = cfg.placements?.[String(a.agent_id)]
    if (p?.zone && ZONE_ORIGIN[p.zone]) {
      const [zx, zz] = ZONE_ORIGIN[p.zone]
      return [zx + (p.slot % 3) * 2.1 - 2.1, 0, zz + Math.floor(p.slot / 3) * 2.2]
    }
    return autoSlot(i)
  }

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
        <CanvasBoundary>
          <Canvas camera={{ position: [11, 10, 12], fov: 42 }}>
            <DayNight on={cycleOn} hour={hour} light={cfg.lighting} />
            <Suspense fallback={null}>
              {cfg.scenario === 'lab' ? (
                <group>
                  <mesh position={[0, -0.05, 0]}><boxGeometry args={[22, 0.1, 16]} />
                    <meshStandardMaterial color="#0e1420" /></mesh>
                  <Studs w={22} d={16} y={0.02} color="#1b2540" />
                  <gridHelper args={[22, 22, '#007ba7', '#1b2540']} position={[0, 0.03, 0]} />
                </group>
              ) : <Room layout={cfg.layout} />}
              {data.agents.map((a, i) => (
                <SeatStation key={a.agent_id} ag={a} pos={agentPos(a, i)}
                  onSel={() => setSel(a)} />
              ))}
            </Suspense>
            <OrbitControls maxPolarAngle={Math.PI / 2.15} minDistance={4} maxDistance={30}
              enablePan enableRotate enableZoom />
          </Canvas>
        </CanvasBoundary>
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
            <label className="text-xs flex items-center gap-2">
              <input type="checkbox" checked={cfg.layout?.plants !== false}
                onChange={(e) => set({ layout: { ...cfg.layout, plants: e.target.checked } })} />
              plantas
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
      <AgentDock agents={data.agents} sel={sel} onSel={setSel} />
    </div>
  )
}
