import * as THREE from 'three'
import { CITY } from './city'

/**
 * AI mashinalar — ko'cha tarmog'i bo'ylab harakat qiladi.
 *
 * Har bir mashina bitta ko'cha markaz chizig'ida (lane offset bilan)
 * yuradi va chorrahadan o'tganda keyingi ko'chaga buriladi. Shu tarzda
 * ular hech qachon bino ichiga kirmaydi.
 */

/**
 * Ko'chadagi chiziq (mashina markaz chizig'idan qancha masofada).
 * To'xtagan mashinalar ROAD/2 - 1.5 = 4.5 da turadi va yon chegarasi
 * 3.5 gacha cho'ziladi. AI mashina yon chegarasi (2.2 + 1.2 = 3.4)
 * shundan ichkarida bo'lishi shart — aks holda to'xtagan mashina ustiga
 * bosib uriladi.
 */
const LANE_OFFSET = 2.2
/** Oddiy mashina tezligi (m/s). */
const CRUISE = 11

export interface TrafficCar {
  group: THREE.Group
  x: number
  z: number
  heading: number
  speed: number
  /** Qaysi o'q bo'ylab harakat qilayotgani: 'x' yoki 'z'. */
  axis: 'x' | 'z'
  /** Yo'nalish belgisi (+1 / -1). */
  dir: 1 | -1
  /** Ko'cha markaz chizig'i qiymati. */
  lane: number
  /** Istiqbolga qarab qarama-qarshi yo'nalishda tezlikni moslash. */
  targetSpeed: number
  color: number
}

const CAR_COLORS = [
  0xd94f4f, 0x4f7fd9, 0xe8e8e8, 0x3b3f47,
  0xe0a13a, 0x5fb878, 0x8b5cf6, 0x0ea5e9,
]

/** Oddiy mashina modeli — bitta geometriya, ko'p nusxada ishlatiladi. */
export function createTrafficCar(color: number): THREE.Group {
  const g = new THREE.Group()
  const body = new THREE.Mesh(
    new THREE.BoxGeometry(1.9, 0.8, 4.2),
    new THREE.MeshStandardMaterial({ color, roughness: 0.4, metalness: 0.45 }),
  )
  body.position.y = 0.62
  g.add(body)

  const cabin = new THREE.Mesh(
    new THREE.BoxGeometry(1.7, 0.6, 2.1),
    new THREE.MeshStandardMaterial({ color: 0x1a2a3a, roughness: 0.15, metalness: 0.6 }),
  )
  cabin.position.set(0, 1.28, -0.2)
  g.add(cabin)

  const skirt = new THREE.Mesh(
    new THREE.BoxGeometry(1.95, 0.32, 3.9),
    new THREE.MeshStandardMaterial({ color: 0x11151c, roughness: 0.9 }),
  )
  skirt.position.y = 0.26
  g.add(skirt)

  // Qizil stop lamplari — orqadan qaraganda ko'rinishi uchun
  const tail = new THREE.Mesh(
    new THREE.BoxGeometry(1.5, 0.16, 0.08),
    new THREE.MeshBasicMaterial({ color: 0xff3b3b }),
  )
  tail.position.set(0, 0.75, -2.12)
  g.add(tail)

  return g
}

export class TrafficSystem {
  readonly cars: TrafficCar[] = []
  private roads: number[]
  private spawnTimer = 0

  constructor(
    scene: THREE.Scene,
    roads: number[],
    private playerStart: { x: number; z: number },
    count = 18,
  ) {
    this.roads = roads
    for (let i = 0; i < count; i++) {
      const color = CAR_COLORS[i % CAR_COLORS.length]
      const group = createTrafficCar(color)
      scene.add(group)
      const car: TrafficCar = {
        group, x: 0, z: 0, heading: 0, speed: CRUISE,
        axis: 'z', dir: 1, lane: 0, targetSpeed: CRUISE, color,
      }
      this.cars.push(car)
      // Dastlabki joylashuv — o'yinchi atrofida tarqalsin
      this.respawn(car, true)
    }
  }

  /** Ko'cha markaz chizig'idan chetlash (o'ng tomondan haydash). */
  private laneOffset(car: TrafficCar): number {
    // Yo'nalishga qarab chiziqning o'ng tomonida yurish
    return LANE_OFFSET * car.dir
  }

  

  /**
   * Ko'chalar kesishgan chorrahadan o'tganda keyingi yo'lga burilish.
   * `car` o'z o'qi bo'ylab `pos` da, `crossRoads` — kesib o'tadigan
   * ko'cha markazlari.
   */
  private maybeTurn(car: TrafficCar, prevPos: number, nextPos: number) {
    // Kesib o'tilayotgan chorrahani topamiz (oldingan keyinga o'tganlar)
    const lo = Math.min(prevPos, nextPos)
    const hi = Math.max(prevPos, nextPos)
    const crossed: number[] = []
    for (const r of this.roads) {
      if (r > lo && r <= hi) crossed.push(r)
    }
    if (crossed.length === 0) return

    const cross = crossed[0]
    // 35% ehtimol bilan burilish, aks holda to'g'ri yo'l davom etadi
    if (Math.random() > 0.35) return

    // Burilish: o'q almashadi, yangi ko'cha markaziga o'tamiz
    if (car.axis === 'z') {
      // Z bo'ylab ketayotgan edik, endi X bo'ylab ketamiz
      car.lane = cross
      car.axis = 'x'
    } else {
      // X bo'ylab ketayotgan edik, endi Z bo'ylab ketamiz
      car.lane = cross
      car.axis = 'z'
    }
  }

  /** Mashinani o'yinchi atrofidagi bo'sh ko'chaga qo'yadi. */
  private respawn(car: TrafficCar, initial = false) {
    const road = this.roads[Math.floor(Math.random() * this.roads.length)]
    car.lane = road
    car.axis = Math.random() < 0.5 ? 'x' : 'z'
    car.dir = Math.random() < 0.5 ? 1 : -1
    car.speed = CRUISE * (0.8 + Math.random() * 0.4)
    car.targetSpeed = car.speed

    // O'yinchidan masofa: initialda uning atrofida, keyinroq oldinga
    const spread = initial ? 120 : 220
    const along = (Math.random() - 0.5) * spread
    this.placeOnRoad(car, along)

    // Agar o'yinchi ustida paydo bo'lsa — boshqa joyga ko'chiramiz
    const dx = car.x - this.playerStart.x
    const dz = car.z - this.playerStart.z
    if (Math.hypot(dx, dz) < 22) {
      car.dir = (car.dir === 1 ? -1 : 1) as 1 | -1
      this.placeOnRoad(car, along > 0 ? -along : along)
    }
  }

  /** Mashinani ko'cha chizig'i bo'ylab joylashtiradi. */
  private placeOnRoad(car: TrafficCar, along: number) {
    const off = this.laneOffset(car)
    if (car.axis === 'z') {
      car.x = car.lane + off
      car.z = along
      car.heading = car.dir === 1 ? 0 : Math.PI
    } else {
      car.x = along
      car.z = car.lane + off
      car.heading = car.dir === 1 ? Math.PI / 2 : -Math.PI / 2
    }
  }

  /**
   * Har kadrda AI mashinalarini yangilaydi.
   * `player` — o'yinchi holati (to'qnashuvni aniqlash uchun).
   */
  update(
    dt: number,
    player: { x: number; z: number; speed: number },
    blocked: (x: number, z: number) => boolean,
  ): { hitPlayer: boolean } {
    let hitPlayer = false

    // Sekundiga yangi mashinalar qo'shish (despawn o'rniga)
    this.spawnTimer += dt
    if (this.spawnTimer > 0.6) {
      this.spawnTimer = 0
      // O'yinchidan juda uzoqda turgan mashinani qayta joylashtiramiz
      for (const car of this.cars) {
        const d = Math.hypot(car.x - player.x, car.z - player.z)
        if (d > 340) this.respawn(car)
      }
    }

    for (const car of this.cars) {
      // --- Oldindagi mashina yoki to'sqinlik bo'lsa sekinlash ---
      let blockedAhead = false
      const look = 9
      if (car.axis === 'z') {
        blockedAhead = blocked(car.x, car.z + car.dir * look)
      } else {
        blockedAhead = blocked(car.x + car.dir * look, car.z)
      }
      car.targetSpeed = blockedAhead ? 0 : CRUISE * (0.75 + Math.random() * 0.35)
      // Sekinlash sekin, tezlash tez
      const accel = car.targetSpeed > car.speed ? 6 : 14
      car.speed += THREE.MathUtils.clamp(car.targetSpeed - car.speed, -accel * dt, accel * dt)

      // --- Harakat ---
      const prevPos = car.axis === 'z' ? car.z : car.x
      if (car.axis === 'z') {
        car.z += car.dir * car.speed * dt
        if (Math.abs(car.z) > CITY.HALF + 20) { this.respawn(car); continue }
      } else {
        car.x += car.dir * car.speed * dt
        if (Math.abs(car.x) > CITY.HALF + 20) { this.respawn(car); continue }
      }
      const nextPos = car.axis === 'z' ? car.z : car.x
      this.maybeTurn(car, prevPos, nextPos)

      // --- Model ---
      car.group.position.set(car.x, 0, car.z)
      car.group.rotation.y = car.heading

      // --- O'yinchi bilan to'qnashuv ---
      const dx = car.x - player.x
      const dz = car.z - player.z
      if (dx * dx + dz * dz < 12) hitPlayer = true
    }

    return { hitPlayer }
  }
}