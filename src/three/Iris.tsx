import { useMemo, type RefObject } from 'react'
import { AdditiveBlending, BufferAttribute, BufferGeometry, Color, type ShaderMaterial } from 'three'

const COUNT = 3000

const vertex = /* glsl */ `
  uniform float uFocus;      // 0 = scattered + defocused, 1 = sharp iris
  uniform float uPupil;      // ring scale (pupil dilation)
  uniform float uPixelRatio;
  uniform float uSize;
  attribute vec3 aScatter;
  attribute float aRand;
  attribute float aT;        // 0 inner (near pupil) … 1 outer edge
  varying float vT;
  varying float vAlpha;

  void main() {
    // Each particle converges with its own delay so the iris "assembles" rather than snaps.
    float f = smoothstep(aRand * 0.35, 0.65 + aRand * 0.35, uFocus);
    vec3 ring = vec3(position.xy * uPupil, position.z);
    vec3 p = mix(aScatter, ring, f);
    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    gl_Position = projectionMatrix * mv;
    float defocus = 1.0 - f;
    gl_PointSize = uSize * (0.6 + aRand * 1.4) * (1.0 + defocus * 3.5) * uPixelRatio / -mv.z;
    vT = aT;
    vAlpha = (0.25 + 0.75 * f) * (0.35 + aRand * 0.65);
  }
`

const fragment = /* glsl */ `
  uniform vec3 uInner;
  uniform vec3 uOuter;
  uniform float uFade;
  varying float vT;
  varying float vAlpha;

  void main() {
    float d = length(gl_PointCoord - 0.5);
    float a = smoothstep(0.5, 0.0, d);
    vec3 col = mix(uInner, uOuter, smoothstep(0.1, 0.55, vT));
    gl_FragColor = vec4(col, a * vAlpha * uFade);
  }
`

function seeded(seed: number) {
  return () => {
    seed = (seed * 16807) % 2147483647
    return (seed - 1) / 2147483646
  }
}

export function createIrisUniforms() {
  return {
    uFocus: { value: 0 },
    uPupil: { value: 1 },
    uPixelRatio: { value: 1 },
    uSize: { value: 26 },
    uFade: { value: 1 },
    uInner: { value: new Color('#e9c27a') },
    uOuter: { value: new Color('#5eead4') },
  }
}
export type IrisUniforms = ReturnType<typeof createIrisUniforms>
export type IrisMaterial = ShaderMaterial & { uniforms: IrisUniforms }

/**
 * Point-cloud iris: radial fibres that converge from a scattered blur into a sharp ring.
 * NOTE: R3F copies the `uniforms` prop, so animate via `materialRef.current.uniforms`, not the object passed in.
 */
export function Iris({ materialRef }: { materialRef: RefObject<IrisMaterial | null> }) {
  const uniforms = useMemo(() => createIrisUniforms(), [])
  const geometry = useMemo(() => {
    const rand = seeded(7)
    const pos = new Float32Array(COUNT * 3)
    const scatter = new Float32Array(COUNT * 3)
    const r = new Float32Array(COUNT)
    const t = new Float32Array(COUNT)
    for (let i = 0; i < COUNT; i++) {
      const a = rand() * Math.PI * 2
      const tt = Math.pow(rand(), 0.85)
      const radius = 1.02 + tt * 1.15
      pos[i * 3] = Math.cos(a) * radius
      pos[i * 3 + 1] = Math.sin(a) * radius
      pos[i * 3 + 2] = (rand() - 0.5) * 0.12
      // scattered start: a loose sphere shell
      const u = rand() * 2 - 1
      const th = rand() * Math.PI * 2
      const sr = 2.5 + rand() * 2.5
      const s = Math.sqrt(1 - u * u)
      scatter[i * 3] = s * Math.cos(th) * sr
      scatter[i * 3 + 1] = s * Math.sin(th) * sr
      scatter[i * 3 + 2] = u * sr
      r[i] = rand()
      t[i] = tt
    }
    const g = new BufferGeometry()
    g.setAttribute('position', new BufferAttribute(pos, 3))
    g.setAttribute('aScatter', new BufferAttribute(scatter, 3))
    g.setAttribute('aRand', new BufferAttribute(r, 1))
    g.setAttribute('aT', new BufferAttribute(t, 1))
    return g
  }, [])

  return (
    <points geometry={geometry} name="iris">
      <shaderMaterial
        ref={materialRef}
        vertexShader={vertex}
        fragmentShader={fragment}
        uniforms={uniforms}
        transparent
        depthWrite={false}
        blending={AdditiveBlending}
      />
    </points>
  )
}
