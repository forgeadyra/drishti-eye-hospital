/**
 * Hero 3D scene — "coming into focus". Loaded lazily (React.lazy) only on capable devices,
 * after the page has loaded, so it never competes with text/CTA rendering.
 *
 *  - frameloop="demand": a frame renders only when something changes (scroll, pointer, intro),
 *    and stops entirely once motion has settled.
 *  - frameloop="never" while the canvas is off-screen or the tab is hidden.
 *  - DPR capped at 1.5 (drops to 1 if PerformanceMonitor detects a struggling GPU).
 *  - Fully procedural: no GLB/texture downloads. Environment light is generated on the GPU.
 */
import { useEffect, useMemo, useRef, useState } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { PerformanceMonitor } from '@react-three/drei'
import { MathUtils, PMREMGenerator, type Group } from 'three'
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js'
import gsap from 'gsap'
import { heroState } from '../lib/heroState'
import { gsapEase } from '../motion/config'
import { Iris, type IrisMaterial } from './Iris'

const MAX_DPR = 1.5
const smoothstep = (a: number, b: number, x: number) => {
  const t = MathUtils.clamp((x - a) / (b - a), 0, 1)
  return t * t * (3 - 2 * t)
}

function GeneratedEnvironment() {
  const gl = useThree((s) => s.gl)
  const scene = useThree((s) => s.scene)
  useEffect(() => {
    const pmrem = new PMREMGenerator(gl)
    const env = pmrem.fromScene(new RoomEnvironment(), 0.04).texture
    scene.environment = env
    return () => {
      scene.environment = null
      env.dispose()
      pmrem.dispose()
    }
  }, [gl, scene])
  return null
}

function Lens() {
  return (
    <group position={[0, 0, 0.6]}>
      <mesh scale={[1, 1, 0.16]} renderOrder={2}>
        <sphereGeometry args={[2.4, 64, 32]} />
        {/* Thin reflective glass. (Real transmission can't refract the additive, transparent iris
            points, and costs an extra render pass, so the glass is faked with env reflections.) */}
        <meshPhysicalMaterial
          color="#0b1b2b"
          roughness={0.03}
          metalness={0}
          clearcoat={1}
          clearcoatRoughness={0.04}
          envMapIntensity={0.7}
          transparent
          opacity={0.06}
          depthWrite={false}
        />
      </mesh>
      <mesh>
        <torusGeometry args={[2.41, 0.018, 16, 160]} />
        <meshStandardMaterial color="#e9c27a" metalness={1} roughness={0.25} />
      </mesh>
    </group>
  )
}

function Rig() {
  const root = useRef<Group>(null)
  const iris = useRef<IrisMaterial>(null)
  const camera = useThree((s) => s.camera)
  const viewport = useThree((s) => s.viewport)
  const size = useThree((s) => s.size)
  const invalidate = useThree((s) => s.invalidate)
  const gl = useThree((s) => s.gl)
  const current = useRef({ focus: 0, rx: 0, ry: 0, pupil: 1, camZ: 6, fade: 0 })

  useEffect(() => {
    heroState.requestFrame = () => invalidate()
    const tween = gsap.to(heroState, { intro: 1, duration: 2.4, ease: gsapEase.out, onUpdate: () => invalidate() })
    return () => {
      tween.kill()
      heroState.requestFrame = () => {}
    }
  }, [invalidate])

  // Responsive placement: iris sits right of the copy on wide screens, above it on portrait.
  const wide = size.width / size.height > 1.05
  const layout = useMemo(() => {
    const vw = viewport.width
    const vh = viewport.height
    // the lens rim (r≈2.4, sitting slightly in front of z=0) spans ~70% of viewport height (wide) / ~80% of width (portrait)
    return wide
      ? { x: vw * 0.24, y: 0, s: Math.min(1, (vh * 0.33) / 2.4) }
      : { x: 0, y: vh * 0.2, s: Math.min(0.8, (vw * 0.38) / 2.4) }
  }, [wide, viewport.width, viewport.height])

  useFrame((_, delta) => {
    // generous cap: time-correct on slow GPUs, but no huge jump after the loop was paused
    const dt = Math.min(delta, 1 / 8)
    const p = heroState.progress
    const { x, y } = heroState.pointer
    const target = {
      // assembles on load (intro), the last bit of sharpening is scroll-driven
      focus: heroState.intro * (0.85 + 0.15 * smoothstep(0, 0.25, p)),
      rx: -y * 0.3,
      ry: x * 0.4,
      // pupil contracts as the cursor nears the centre, like a reaction to light
      pupil: 0.92 + Math.min(Math.hypot(x, y), 1) * 0.12,
      camZ: 6 - smoothstep(0.3, 1, p) * 5.3,
      fade: heroState.intro * (1 - smoothstep(0.8, 1, p)),
    }
    const c = current.current
    let moving = false
    for (const k of Object.keys(target) as (keyof typeof target)[]) {
      c[k] = MathUtils.damp(c[k], target[k], 4.5, dt)
      if (Math.abs(c[k] - target[k]) > 1e-3) moving = true
      else c[k] = target[k]
    }
    const u = iris.current?.uniforms
    if (u) {
      u.uFocus.value = c.focus
      u.uPupil.value = c.pupil
      u.uFade.value = c.fade
      u.uPixelRatio.value = gl.getPixelRatio()
      u.uSize.value = 26 * Math.max(layout.s, 0.45)
    }
    if (root.current) {
      root.current.rotation.set(c.rx, c.ry, 0)
      root.current.position.set(layout.x, layout.y, 0)
      root.current.scale.setScalar(layout.s)
    }
    camera.position.z = c.camZ
    if (moving) invalidate()
  })

  return (
    <group ref={root}>
      <Iris materialRef={iris} />
      <Lens />
    </group>
  )
}

export default function HeroScene({ onReady, onFail }: { onReady: () => void; onFail: () => void }) {
  const wrap = useRef<HTMLDivElement>(null)
  const [inView, setInView] = useState(true)
  const [tabVisible, setTabVisible] = useState(() => !document.hidden)
  const [dpr, setDpr] = useState(Math.min(window.devicePixelRatio || 1, MAX_DPR))

  useEffect(() => {
    const el = wrap.current
    if (!el) return
    const io = new IntersectionObserver(([e]) => setInView(Boolean(e?.isIntersecting)))
    io.observe(el)
    const onVis = () => setTabVisible(!document.hidden)
    document.addEventListener('visibilitychange', onVis)
    return () => {
      io.disconnect()
      document.removeEventListener('visibilitychange', onVis)
    }
  }, [])

  const active = inView && tabVisible

  return (
    <div ref={wrap} className="absolute inset-0">
      <Canvas
        frameloop={active ? 'demand' : 'never'}
        dpr={dpr}
        gl={{ antialias: false, alpha: true, stencil: false, powerPreference: 'high-performance' }}
        camera={{ position: [0, 0, 6], fov: 40, near: 0.1, far: 50 }}
        onCreated={({ gl }) => {
          gl.domElement.addEventListener('webglcontextlost', (e) => {
            e.preventDefault()
            onFail()
          })
          onReady()
        }}
      >
        <PerformanceMonitor onDecline={() => setDpr(1)} />
        <GeneratedEnvironment />
        <Rig />
      </Canvas>
    </div>
  )
}
