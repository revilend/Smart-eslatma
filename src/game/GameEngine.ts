import * as THREE from 'three'
import { CITY, buildCity } from './city'
import { CarPhysicsState, SPEED_LIMITS, createCar, stepCar } from './car'

export interface HudState {
  speed: number
  money: number
  deliveries: number
  markerActive: boolean
  markerDistance: number
  hitFlash: number
  muted: boolean
}

export type EngineStatus = 'ready' | 'unsupported'

/**
 * Three.js asosidagi o'yin muhiti: sahna, kamera, render loop,
 * yashil marker (pickup) va HUD holati.
 */
export class GameEngine {
  readonly status: EngineStatus = 'ready'

  private renderer: THREE.WebGLRenderer
  private scene = new THREE.Scene()
  private camera: THREE.PerspectiveCamera
  private car: THREE.Group
  private marker: THREE.Group
  private carState: CarPhysicsState = { speed: 0, heading: 0, x: 0, z: 0 }
  private obstacles: { minX: number; maxX: number; minZ: number; maxZ: number }[] = []
  private clock = new THREE.Clock()
  private raf = 0
  private running = false

  private keys: Record<string, boolean> = {}
  private touch = { throttle: 0, steer: 0 }

  private money = 0
  private deliveries = 0
  private markerActive = true
  private markerPos = new THREE.Vector3(0, 2, -20)
  private hitFlash = 0
  private muted = false

  private hudAccum = 0
  private camPos = new THREE.Vector3(0, 12, 18)
  private lookTarget = new THREE.Vector3()

  constructor(
    private canvas: HTMLCanvasElement,
    private onHud: (hud: HudState) => void,
  ) {
    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      powerPreference: 'high-performance',
    })
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    this.renderer.shadowMap.enabled = true
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap

    this.camera = new THREE.PerspectiveCamera(62, 1, 0.1, 900)

    // ---------- Sahna muhiti ----------
    this.scene.background = new THREE.Color(0x9fc6e8)
    this.scene.fog = new THREE.Fog(0x9fc6e8, 90, 340)

    // Quyosh
    const sun = new THREE.DirectionalLight(0xfff4dd, 2.1)
    sun.position.set(60, 90, 40)
    sun.castShadow = true
    sun.shadow.mapSize.set(2048, 2048)
    const d = 90
    sun.shadow.camera.left = -d
    sun.shadow.camera.right = d
    sun.shadow.camera.top = d
    sun.shadow.camera.bottom = -d
    sun.shadow.camera.far = 400
    sun.shadow.bias = -0.0006
    this.scene.add(sun)
    this.scene.add(new THREE.HemisphereLight(0xbfe0ff, 0x2a3140, 1.15))

    // ---------- Shahar ----------
    const city = buildCity()
    this.scene.add(city.group)
    this.obstacles = city.obstacles

    // ---------- Avtomobil ----------
    this.car = createCar()
    this.scene.add(this.car)
    this.carState = { speed: 0, heading: Math.PI, x: 0, z: 8 }

    // ---------- Yashil marker ----------
    this.marker = createMarker()
    this.scene.add(this.marker)
    this.pickNewMarker()

    this.attachEvents()
    this.resize()
  }

  // ------------------------------------------------------------------ events

  private attachEvents() {
    window.addEventListener('resize', this.resize)
    window.addEventListener('keydown', this.onKeyDown)
    window.addEventListener('keyup', this.onKeyUp)
  }

  private dispose() {
    cancelAnimationFrame(this.raf)
    window.removeEventListener('resize', this.resize)
    window.removeEventListener('keydown', this.onKeyDown)
    window.removeEventListener('keyup', this.onKeyUp)
    this.renderer.dispose()
  }

  destroy() {
    this.running = false
    this.dispose()
  }

  private resize = () => {
    const w = this.canvas.clientWidth || window.innerWidth
    const h = this.canvas.clientHeight || window.innerHeight
    this.renderer.setSize(w, h, false)
    this.camera.aspect = w / h
    this.camera.updateProjectionMatrix()
  }

  private onKeyDown = (e: KeyboardEvent) => {
    this.keys[e.code] = true
    if (e.code === 'KeyM') this.toggleMute()
    if (
      [
        'ArrowUp',
        'ArrowDown',
        'ArrowLeft',
        'ArrowRight',
        'Space',
        'KeyW',
        'KeyA',
        'KeyS',
        'KeyD',
      ].includes(e.code)
    ) {
      e.preventDefault()
    }
  }

  private onKeyUp = (e: KeyboardEvent) => {
    this.keys[e.code] = false
  }

  toggleMute() {
    this.muted = !this.muted
  }

  /** Mobil tugmalar uchun oyinchi kirishi. */
  setTouchInput(throttle: number, steer: number) {
    this.touch.throttle = throttle
    this.touch.steer = steer
  }

  start() {
    if (this.running) return
    this.running = true
    this.clock.start()
    this.loop()
  }

  // ------------------------------------------------------------------- loop

  private loop = () => {
    if (!this.running) return
    this.raf = requestAnimationFrame(this.loop)
    const dt = Math.min(this.clock.getDelta(), 1 / 30)
    this.update(dt)
    this.renderer.render(this.scene, this.camera)
  }

  private update(dt: number) {
    // --- Kirishlar ---
    const kThrottle =
      (this.keys.ArrowUp || this.keys.KeyW ? 1 : 0) -
      (this.keys.ArrowDown || this.keys.KeyS ? 1 : 0)
    const kSteer =
      (this.keys.ArrowRight || this.keys.KeyD ? 1 : 0) -
      (this.keys.ArrowLeft || this.keys.KeyA ? 1 : 0)
    const brake = this.keys.Space ? 1 : 0

    const throttle = kThrottle !== 0 ? kThrottle : this.touch.throttle
    const steer = kSteer !== 0 ? kSteer : this.touch.steer

    // --- Fizika ---
    const bounds = CITY.HALF - 2
    const { hit } = stepCar(
      this.carState,
      brake > 0 ? 0 : throttle,
      steer,
      dt,
      this.obstacles,
      bounds,
    )
    if (brake > 0) {
      this.carState.speed = THREE.MathUtils.clamp(
        this.carState.speed - 40 * dt,
        -4,
        SPEED_LIMITS.MAX_SPEED,
      )
    }
    if (hit) this.hitFlash = Math.min(1, this.hitFlash + 0.5)

    // --- Model transform ---
    this.car.position.set(this.carState.x, 0, this.carState.z)
    this.car.rotation.y = this.carState.heading
    // Yo'l qatlami bo'ylab engilish ( banking )
    const bank = THREE.MathUtils.clamp(-steer * 0.16, -0.18, 0.18)
    this.car.rotation.z = bank
    // Gaz bosilganda oldinga yengilgan egilish
    this.car.rotation.x = THREE.MathUtils.clamp(-throttle * 0.035, -0.05, 0.05)

    // --- Marker ---
    if (this.markerActive) {
      this.marker.rotation.y += dt * 1.8
      this.marker.position.y = 2 + Math.sin(performance.now() / 320) * 0.35
      const dx = this.markerPos.x - this.carState.x
      const dz = this.markerPos.z - this.carState.z
      if (dx * dx + dz * dz < 12) this.collectMarker()
    }

    // --- Kamera: mashina ortidan chiqib boruvchi (chase) kamera ---
    const back = 15
    const height = 7.5
    const h = this.carState.heading
    const targetX = this.carState.x - Math.sin(h) * back
    const targetZ = this.carState.z - Math.cos(h) * back
    // Smooth follow — tezlikka qarab orqada qoladi
    const lerp = 1 - Math.pow(0.0015, dt)
    this.camPos.x += (targetX - this.camPos.x) * lerp
    this.camPos.y += (height - this.camPos.y) * lerp
    this.camPos.z += (targetZ - this.camPos.z) * lerp
    this.camera.position.copy(this.camPos)
    this.lookTarget.set(
      this.carState.x + Math.sin(h) * 6,
      1.5,
      this.carState.z + Math.cos(h) * 6,
    )
    this.camera.lookAt(this.lookTarget)

    // --- Effektlar ---
    this.hitFlash = Math.max(0, this.hitFlash - dt * 1.8)

    // --- HUD (har 100ms) ---
    this.hudAccum += dt
    if (this.hudAccum > 0.1) {
      this.hudAccum = 0
      const dx = this.markerPos.x - this.carState.x
      const dz = this.markerPos.z - this.carState.z
      this.onHud({
        speed: Math.abs(this.carState.speed) * 3.6,
        money: this.money,
        deliveries: this.deliveries,
        markerActive: this.markerActive,
        markerDistance: Math.sqrt(dx * dx + dz * dz),
        hitFlash: this.hitFlash,
        muted: this.muted,
      })
    }
  }

  // ----------------------------------------------------------------- marker

  private collectMarker() {
    this.markerActive = false
    this.money += 25
    this.deliveries += 1
    // 1.2 sekunddan keyin yangi marker paydo bo'ladi
    window.setTimeout(() => this.pickNewMarker(), 1200)
  }

  private pickNewMarker() {
    // Tasodifiy yo'l nuqtasi
    const lines = [
      ...Array.from({ length: CITY.GRID }, (_, i) =>
        (Math.floor(i / 2) - (CITY.GRID - 1) / 4) * CITY.CELL,
      ),
    ]
    const line = lines[Math.floor(Math.random() * lines.length)]
    const along = (Math.random() - 0.5) * 2 * (CITY.HALF - 6)
    this.markerPos.set(
      line + (Math.random() < 0.5 ? 0 : 0),
      2,
      along,
    )
    // Ikki yo'l kesishganida marker bo'lsin
    if (Math.random() < 0.5) {
      this.markerPos.set(along, 2, line)
    }
    this.marker.position.copy(this.markerPos)
    this.marker.visible = true
    this.markerActive = true
  }
}

/** Yashil, aylanuvchi pickup marker. */
function createMarker(): THREE.Group {
  const g = new THREE.Group()

  // Konus (uchburchak kameraga qaragan holda)
  const cone = new THREE.Mesh(
    new THREE.ConeGeometry(1.1, 2, 4),
    new THREE.MeshStandardMaterial({
      color: 0x2ee65a,
      emissive: 0x0f7a2a,
      emissiveIntensity: 0.8,
      roughness: 0.4,
      flatShading: true,
    }),
  )
  cone.position.y = 2
  cone.rotation.x = Math.PI
  cone.castShadow = true
  g.add(cone)

  // Yer halqasi
  const ring = new THREE.Mesh(
    new THREE.RingGeometry(1.4, 2.0, 32),
    new THREE.MeshBasicMaterial({
      color: 0x7dffa0,
      transparent: true,
      opacity: 0.55,
      side: THREE.DoubleSide,
    }),
  )
  ring.rotation.x = -Math.PI / 2
  ring.position.y = 0.05
  g.add(ring)

  // Yuqoriga qaragan yorug'lik nuri
  const beam = new THREE.Mesh(
    new THREE.CylinderGeometry(1.0, 1.0, 14, 12, 1, true),
    new THREE.MeshBasicMaterial({
      color: 0x4dff8a,
      transparent: true,
      opacity: 0.16,
      side: THREE.DoubleSide,
      depthWrite: false,
    }),
  )
  beam.position.y = 7
  g.add(beam)

  return g
}
