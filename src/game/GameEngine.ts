import * as THREE from 'three'
import { CITY, buildCity, type CityResult } from './city'
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
  private obstacles: CityResult['obstacles'] = []
  private roads: number[] = []
  private sun!: THREE.DirectionalLight
  /** Binolarning uniform grid indeksi (to'qnashuv tezligi uchun). */
  private obstacleGrid = new Map<string, CityResult['obstacles']>()
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

    this.camera = new THREE.PerspectiveCamera(62, 1, 0.1, CITY.HALF * 3)

    // ---------- Sahna muhiti ----------
    this.scene.background = new THREE.Color(0x9fc6e8)
    // Katta kartada ufq chizig'i ko'rinishi uchun tuman oralig'i kengaytirilgan
    this.scene.fog = new THREE.Fog(0x9fc6e8, 140, 420)

    // Quyosh — soya ortidan quyidagi yo'nalishda
    const sun = new THREE.DirectionalLight(0xfff4dd, 2.1)
    sun.position.set(60, 90, 40)
    sun.castShadow = true
    sun.shadow.mapSize.set(2048, 2048)
    // Faqat mashina atrofidagi soyalar — karta kattalashganda ham aniq
    const d = 70
    sun.shadow.camera.left = -d
    sun.shadow.camera.right = d
    sun.shadow.camera.top = d
    sun.shadow.camera.bottom = -d
    sun.shadow.camera.far = 300
    sun.shadow.bias = -0.0006
    // Quyosh va uning nishoni mashinaga har kadrda ko'chadi, shunda
    // karta chekka qismida ham soya to'g'ri tushadi
    sun.target.position.set(0, 0, 0)
    this.scene.add(sun)
    this.scene.add(sun.target)
    this.sun = sun
    this.scene.add(new THREE.HemisphereLight(0xbfe0ff, 0x2a3140, 1.15))

    // ---------- Shahar ----------
    const city = buildCity()
    this.scene.add(city.group)
    this.obstacles = city.obstacles
    this.roads = city.roads
    this.buildObstacleGrid()

    // ---------- Avtomobil ----------
    this.car = createCar()
    this.scene.add(this.car)
    // Spawn: eng markaziy ko'cha chorrahasida, +Z yo'nalishi bo'ylab
    this.carState = {
      speed: 0,
      heading: 0,
      x: city.roads[Math.floor(city.roads.length / 2)] ?? 0,
      z: 0,
    }

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
    const bounds = CITY.HALF - 4
    const { hit } = stepCar(
      this.carState,
      brake > 0 ? 0 : throttle,
      steer,
      dt,
      this.obstaclesNear(this.carState.x, this.carState.z),
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

    // Quyoshni mashinaga ergashtiramiz (karta katta, soya kichik oynada)
    this.sun.position.set(this.carState.x + 60, 90, this.carState.z + 40)
    this.sun.target.position.set(this.carState.x, 0, this.carState.z)
    this.sun.target.updateMatrixWorld()
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

  /**
   * Yangi marker joylashuvi: har doim ko'cha markaz chizig'ida,
   * chorrahadan uzoqda — hech qachon bino ichida qolmaydi.
   */
  private pickNewMarker() {
    const limit = CITY.HALF - 8
    // Ko'chaning bir qanoti bo'ylab joylashuv
    const line = this.roads[Math.floor(Math.random() * this.roads.length)]
    const along = (Math.random() * 2 - 1) * limit
    // Marker yo'lning qo'ndagi qirrasida, chorrahadan chetda turadi
    const lane = (Math.random() < 0.5 ? -1 : 1) * 3.2

    if (Math.random() < 0.5) {
      // Vertikal ko'cha: X = markaz chizig'i
      this.markerPos.set(line + lane, 2, along)
    } else {
      // Gorizontal ko'cha: Z = markaz chizig'i
      this.markerPos.set(along, 2, line + lane)
    }

    // Xavfsizlik: agar tasodifiy holatda bino ustida tushsa — qayta urinish
    if (this.isBlocked(this.markerPos.x, this.markerPos.z)) {
      this.pickNewMarker()
      return
    }

    this.marker.position.copy(this.markerPos)
    this.marker.visible = true
    this.markerActive = true
  }

  /**
   * Berilgan nuqtaga yaqin binolar (uniform grid orqali).
   * 1300+ bina bo'lganda har kadrda hammasini skanlash o'rniga
   * faqat yaqin kataklar tekshiriladi.
   */
  private obstaclesNear(x: number, z: number): CityResult['obstacles'] {
    const list: CityResult['obstacles'] = []
    const cellSize = CITY.CELL
    const cx = Math.floor((x + CITY.HALF) / cellSize)
    const cz = Math.floor((z + CITY.HALF) / cellSize)
    for (let gz = cz - 1; gz <= cz + 1; gz++) {
      for (let gx = cx - 1; gx <= cx + 1; gx++) {
        const bucket = this.obstacleGrid.get(`${gx}|${gz}`)
        if (bucket) list.push(...bucket)
      }
    }
    return list
  }

  /** Tinch holatda nuqta bino chegarasi ichida yoki ustida joylashganmi? */
  private isBlocked(x: number, z: number): boolean {
    const pad = 2.5
    for (const o of this.obstaclesNear(x, z)) {
      if (
        x > o.minX - pad &&
        x < o.maxX + pad &&
        z > o.minZ - pad &&
        z < o.maxZ + pad
      ) {
        return true
      }
    }
    return false
  }

  /** Binolarni katak (katak o'lchami = CITY.CELL) bo'yicha indekslaydi. */
  private buildObstacleGrid() {
    const cellSize = CITY.CELL
    for (const o of this.obstacles) {
      // Bino chegarasini qamrab oladigan barcha kataklarga qo'shamiz
      const gx0 = Math.floor((o.minX + CITY.HALF) / cellSize)
      const gx1 = Math.floor((o.maxX + CITY.HALF) / cellSize)
      const gz0 = Math.floor((o.minZ + CITY.HALF) / cellSize)
      const gz1 = Math.floor((o.maxZ + CITY.HALF) / cellSize)
      for (let gz = gz0; gz <= gz1; gz++) {
        for (let gx = gx0; gx <= gx1; gx++) {
          const key = `${gx}|${gz}`
          let bucket = this.obstacleGrid.get(key)
          if (!bucket) {
            bucket = []
            this.obstacleGrid.set(key, bucket)
          }
          bucket.push(o)
        }
      }
    }
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
