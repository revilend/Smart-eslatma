import * as THREE from 'three'
import { CITY } from './city'

/**
 * Piyodalar — trotuarlar bo'ylab yuradi.
 *
 * Ular ko'cha markazida emas, balki `SIDEWALK_OFFSET` masofada yuradi
 * (trotuar blokning chetida), shuning uchun mashina bilan to'qnashmaydi.
 * Model `InstancedMesh` — yuzlab odam bitta mesh bilan chiziladi.
 */

/**
 * Piyodalar trotuarda yuradigan masofa (ko'cha markazidan).
 * Blok chetida — binolar 14.4 m dan boshlanadi, shuning uchun bu
 * lenta binolarga tegmaydi. Piyodalar bu lenta bilan bog'lanadi
 * (qochganda ham ko'chaga chiqmaydi).
 */
const SIDEWALK_MIN = CITY.ROAD / 2 + 1.4
/**
 * Piyoda tana kengligi ~0.8 m. Lenta ikkinchi chegarasi binolardan
 * (ko'chadan ~10.5 m) aniq uzoq turishi shart:
 * `SIDEWALK_MAX + PROBE_RADIUS` < binolarning yaqin chegarasi.
 */
const PROBE_RADIUS = 0.45
const SIDEWALK_MAX = SIDEWALK_MIN + 1.4
/** Yurish tezligi (m/s). */
const WALK_SPEED = 1.5
/** Mashinadan qachish tezligi. */
const FLEE_SPEED = 4.2

const SKIN = [0xf0c8a0, 0xd9a066, 0x8d5524, 0xffdbac]
const SHIRT = [0x4f7fd9, 0xd94f4f, 0x5fb878, 0xe0a13a, 0x8b5cf6, 0x0ea5e9, 0xec4899]

export class PedestrianSystem {
  private readonly group = new THREE.Group()
  private peds: {
    x: number
    z: number
    vx: number
    vz: number
    phase: number
    scale: number
    /** Piyoda qaysi ko'cha bo'ylab yuradi (trotuarning markazi). */
    lane: number
    /** Ko'cha o'qi: 'z' = Z bo'ylab, 'x' = X bo'ylab yuradi. */
    axis: 'x' | 'z'
    /** Tro-tuarning qaysi tomonida (mos yo'nalish belgisi). */
    side: number
    /** Qochish qancha davom etishi (sekund). */
    flee: number
  }[] = []
  /** Tanalar va boshlar uchun instanced mesh'lar. */
  private bodies!: THREE.InstancedMesh
  private heads!: THREE.InstancedMesh
  private dummy = new THREE.Object3D()

  constructor(
    scene: THREE.Scene,
    roads: number[],
    playerStart: { x: number; z: number },
    count = 60,
  ) {
    const bodyGeo = new THREE.BoxGeometry(0.6, 1.3, 0.4)
    const bodyMat = new THREE.MeshStandardMaterial({ vertexColors: false, roughness: 0.9 })
    this.bodies = new THREE.InstancedMesh(bodyGeo, bodyMat, count)
    this.bodies.instanceMatrix.setUsage(THREE.DynamicDrawUsage)

    const headGeo = new THREE.SphereGeometry(0.22, 6, 5)
    const headMat = new THREE.MeshStandardMaterial({ roughness: 0.9 })
    this.heads = new THREE.InstancedMesh(headGeo, headMat, count)
    this.heads.instanceMatrix.setUsage(THREE.DynamicDrawUsage)

    // Har bir piyoda uchun tasodifiy rang
    const bodyColors = new Float32Array(count * 3)
    const headColors = new Float32Array(count * 3)
    for (let i = 0; i < count; i++) {
      const shirt = new THREE.Color(
        SHIRT[Math.floor(Math.random() * SHIRT.length)],
      )
      bodyColors[i * 3] = shirt.r
      bodyColors[i * 3 + 1] = shirt.g
      bodyColors[i * 3 + 2] = shirt.b
      const skin = new THREE.Color(SKIN[Math.floor(Math.random() * SKIN.length)])
      headColors[i * 3] = skin.r
      headColors[i * 3 + 1] = skin.g
      headColors[i * 3 + 2] = skin.b
    }
    this.bodies.setColorAt(0, new THREE.Color(1, 1, 1))
    this.heads.setColorAt(0, new THREE.Color(1, 1, 1))
    for (let i = 0; i < count; i++) {
      this.bodies.setColorAt(i, new THREE.Color(bodyColors[i * 3], bodyColors[i * 3 + 1], bodyColors[i * 3 + 2]))
      this.heads.setColorAt(i, new THREE.Color(headColors[i * 3], headColors[i * 3 + 1], headColors[i * 3 + 2]))
    }
    if (this.bodies.instanceColor) this.bodies.instanceColor.needsUpdate = true
    if (this.heads.instanceColor) this.heads.instanceColor.needsUpdate = true

    this.group.add(this.bodies)
    this.group.add(this.heads)
    scene.add(this.group)

    // Boshlang'ich joylashuv — trotuarda, o'yinchidan uzoqda
    for (let i = 0; i < count; i++) {
      const ped = {
        x: 0, z: 0, vx: 0, vz: 0,
        phase: Math.random() * Math.PI * 2,
        scale: 0.9 + Math.random() * 0.2,
        lane: 0, axis: 'z' as 'z' | 'x', side: 1, flee: 0,
      }
      this.respawn(ped, roads, playerStart)
      this.peds.push(ped)
    }
  }

  /** Piyodani trotuarga joylashtiradi va uni o'sha ko'chaga bog'laydi. */
  private respawn(
    ped: {
      x: number; z: number; vx: number; vz: number
      lane: number; axis: 'x' | 'z'; side: number; flee: number
    },
    roads: number[],
    playerStart: { x: number; z: number },
  ) {
    // Chekka ko'chalarni tanlamaymiz — u yerda trotuarda yuradigan
    // yo'nalish karta tashqarisiga chiqib ketardi.
    const inner = roads.filter((r) => Math.abs(r) < CITY.HALF - 30)
    const pool = inner.length > 0 ? inner : roads
    const road = pool[Math.floor(Math.random() * pool.length)]
    const side = Math.random() < 0.5 ? -1 : 1
    const along = (Math.random() - 0.5) * 2 * (CITY.HALF - 30)

    ped.lane = road
    ped.side = side
    ped.flee = 0
    // Yandex: ko'chaning ikki chetida yurish mumkin
    if (Math.random() < 0.5) {
      ped.axis = 'z'
      ped.x = road + (SIDEWALK_MIN + Math.random() * (SIDEWALK_MAX - SIDEWALK_MIN)) * side
      ped.z = along
      ped.vx = 0
      ped.vz = (Math.random() < 0.5 ? -1 : 1) * WALK_SPEED
    } else {
      ped.axis = 'x'
      ped.x = along
      ped.z = road + (SIDEWALK_MIN + Math.random() * (SIDEWALK_MAX - SIDEWALK_MIN)) * side
      ped.vx = (Math.random() < 0.5 ? -1 : 1) * WALK_SPEED
      ped.vz = 0
    }

    // O'yinchi ustida paydo bo'lmasin
    const dx = ped.x - playerStart.x
    const dz = ped.z - playerStart.z
    if (Math.hypot(dx, dz) < 15) {
      if (ped.axis === 'z') ped.z = along > 0 ? -along : along
      else ped.x = along > 0 ? -along : along
    }
  }

  /**
   * Piyodalarni har kadrda yangilaydi.
   *
   * Har bir piyoda o'z ko'chasi va tro-tuvar lentasiga bog'langan:
   * u faqat o'sha yo'l bo'ylab yuradi. Qochish paytida ham lateral
   * cheklanadi, shuning uchun hech qachon ko'chaga yoki bino ichiga
   * tushmaydi.
   */
  update(
    dt: number,
    player: { x: number; z: number },
    roads: number[],
    blocked: (x: number, z: number, rx: number, rz: number) => boolean,
  ) {
    const d = this.dummy
    const limit = CITY.HALF - 6
    // Piyoda o'lchamidagi to'sqinlik sinovi (mashina emas)
    const pedBlocked = (x: number, z: number) =>
      blocked(x, z, PROBE_RADIUS, PROBE_RADIUS)
    // Lateral siljishdan keyin to'sqinlikni tekshirish uchun yordamchi
    const blockedAt = (x: number, z: number, axis: 'x' | 'z', lanePos: number) =>
      axis === 'z' ? pedBlocked(lanePos, z) : pedBlocked(x, lanePos)

    for (let i = 0; i < this.peds.length; i++) {
      const p = this.peds[i]
      const dx = p.x - player.x
      const dz = p.z - player.z
      const distSq = dx * dx + dz * dz

      // --- Mashina yaqinlashsa qochish (1.2 s) ---
      if (distSq < 100) p.flee = 1.2
      else p.flee = Math.max(0, p.flee - dt)

      // --- Tezlik: qochayotgani tezroq, aks holda sekin yuradi ---
      const speed = p.flee > 0 ? FLEE_SPEED : WALK_SPEED
      const fleeing = p.flee > 0

      // Yo'nalish: asosan o'z o'qi bo'ylab, qochganda o'yinchiga yaqinlash
      let wantX: number
      let wantZ: number
      if (fleeing) {
        const dist = Math.sqrt(distSq) || 1
        // Trotuar bo'ylab qochish — o'yinchidan uzoqlashgan tomon
        wantX = p.axis === 'z' ? 0 : Math.sign(p.vx) || 1
        wantZ = p.axis === 'z' ? Math.sign(p.vz) || 1 : 0
        // yaqinlashgan bo'lsa (distsiya qisqargan) — orqada qoch
        void dist
      } else {
        wantX = p.axis === 'x' ? Math.sign(p.vx) || 1 : 0
        wantZ = p.axis === 'z' ? Math.sign(p.vz) || 1 : 0
      }

      // Sekin-astin tezlikka o'tish
      const k = Math.min(1, dt * 4)
      p.vx += (wantX * speed - p.vx) * k
      p.vz += (wantZ * speed - p.vz) * k

      // --- Harakat ---
      let nx = p.x + p.vx * dt
      let nz = p.z + p.vz * dt

      // Karta chegarasiga tegib ketsa — yo'nalishni teskarisiga o'zgartiramiz
      const along = p.axis === 'z' ? nz : nx
      if (Math.abs(along) > limit) {
        if (p.axis === 'z') p.vz = -p.vz
        else p.vx = -p.vx
        nx = p.x
        nz = p.z
      }

      // Trotuar lentasini qat'iy saqlash: lateral o'q o'z o'qi bo'lishi mumkin emas
      // (aks holda piyoda ko'chaga yoki blok ichiga chiqib ketadi)
      if (p.axis === 'z') {
        nx = p.lane + SIDEWALK_MIN * p.side
        if (pedBlocked(nx, nz)) {
          p.vz = -p.vz
          nz = p.z
        }
      } else {
        nz = p.lane + SIDEWALK_MIN * p.side
        if (pedBlocked(nx, nz)) {
          p.vx = -p.vx
          nx = p.x
        }
      }

      // To'sqinlik bo'lsa — trotuar lentasining ikkinchi chetiga surilib
      // aylanib o'tadi, shunda to'xtagan mashina ustiga bosib o'tmaydi.
      const nearEdge = p.lane + SIDEWALK_MIN * p.side
      const farEdge = p.lane + SIDEWALK_MAX * p.side
      const lanePos = p.axis === 'z' ? nx : nz
      if (Math.abs(lanePos - nearEdge) < 0.05 && blockedAt(nx, nz, p.axis, farEdge)) {
        if (p.axis === 'z') nx = farEdge
        else nz = farEdge
      }

      p.x = nx
      p.z = nz

      // O'yinchidan juda uzoqda — qayta joylashtiramiz
      if (distSq > 340 * 340) this.respawn(p, roads, player)

      // --- Model (yurish animatsiyasi) ---
      p.phase += dt * (fleeing ? 10 : 6)
      const bob = Math.abs(Math.sin(p.phase)) * 0.09
      const heading = Math.atan2(p.vx, p.vz)
      d.position.set(p.x, 0.95 * p.scale + bob, p.z)
      d.rotation.set(0, heading, 0)
      d.scale.setScalar(p.scale)
      d.updateMatrix()
      this.bodies.setMatrixAt(i, d.matrix)

      d.position.set(p.x, 1.78 * p.scale + bob, p.z)
      d.updateMatrix()
      this.heads.setMatrixAt(i, d.matrix)
    }

    this.bodies.instanceMatrix.needsUpdate = true
    this.heads.instanceMatrix.needsUpdate = true
  }
}