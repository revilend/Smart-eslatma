import * as THREE from 'three'

/** Bino chegarasi (AABB). */
export interface Obstacle {
  minX: number
  maxX: number
  minZ: number
  maxZ: number
}

export interface CarPhysicsState {
  /** Tezlik, m/s (manfiy = teskari). */
  speed: number
  /** Burilish burchagi (rad). */
  heading: number
  x: number
  z: number
}

const MAX_SPEED = 34 // m/s (~122 km/h)
const MAX_REVERSE = 12
const ACCEL = 26
const BRAKE = 46
const DRAG = 7
const TURN_RATE = 2.1

/** O'yinchi avtomobilining 3D modelini yaratadi. */
export function createCar(): THREE.Group {
  const car = new THREE.Group()

  const bodyMat = new THREE.MeshStandardMaterial({
    color: 0xf2f5f8,
    roughness: 0.35,
    metalness: 0.55,
  })
  const darkMat = new THREE.MeshStandardMaterial({
    color: 0x11151c,
    roughness: 0.5,
    metalness: 0.3,
  })
  const glassMat = new THREE.MeshStandardMaterial({
    color: 0x1a2a3a,
    roughness: 0.1,
    metalness: 0.7,
    transparent: true,
    opacity: 0.85,
  })
  const tailMat = new THREE.MeshBasicMaterial({ color: 0xff3b3b })
  const headMat = new THREE.MeshBasicMaterial({ color: 0xfff4c2 })

  // Kuzov
  const body = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.72, 4.4), bodyMat)
  body.position.y = 0.62
  body.castShadow = true
  car.add(body)

  // Kabina
  const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.75, 0.6, 2.2), glassMat)
  cabin.position.set(0, 1.24, -0.25)
  cabin.castShadow = true
  car.add(cabin)

  // Kapot va bagaj qatlamlari — siluetni taxminiy realroq qiladi
  const hood = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.2, 1.3), bodyMat)
  hood.position.set(0, 1.02, 1.35)
  hood.castShadow = true
  car.add(hood)

  const trunk = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.18, 0.9), bodyMat)
  trunk.position.set(0, 1.0, -1.7)
  trunk.castShadow = true
  car.add(trunk)

  // G'ildovlar
  const wheelGeo = new THREE.CylinderGeometry(0.42, 0.42, 0.34, 18)
  wheelGeo.rotateZ(Math.PI / 2)
  const wheelPositions: [number, number, number][] = [
    [-1.0, 0.42, 1.45],
    [1.0, 0.42, 1.45],
    [-1.0, 0.42, -1.4],
    [1.0, 0.42, -1.4],
  ]
  for (const [x, y, z] of wheelPositions) {
    const wheel = new THREE.Mesh(wheelGeo, darkMat)
    wheel.position.set(x, y, z)
    wheel.castShadow = true
    car.add(wheel)
  }

  // Chiroq va stop lamplari
  for (const x of [-0.65, 0.65]) {
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.22, 0.12), headMat)
    head.position.set(x, 0.72, 2.22)
    car.add(head)

    const tail = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.2, 0.1), tailMat)
    tail.position.set(x, 0.78, -2.22)
    car.add(tail)
  }

  // Pastki soya (kontaktni mustahkamlash uchun yumshoq disk)
  const blob = new THREE.Mesh(
    new THREE.CircleGeometry(1.6, 20),
    new THREE.MeshBasicMaterial({
      color: 0x000000,
      transparent: true,
      opacity: 0.25,
    }),
  )
  blob.rotation.x = -Math.PI / 2
  blob.position.y = 0.02
  car.add(blob)

  return car
}

/** Bir qadamlik arcade fizikasi. `throttle`: -1..1, `steer`: -1..1. */
export function stepCar(
  state: CarPhysicsState,
  throttle: number,
  steer: number,
  dt: number,
  obstacles: Obstacle[],
  bounds: number,
): { hit: boolean } {
  // --- Uzunlik bo'yicha tezlik ---
  if (throttle > 0) {
    state.speed += ACCEL * throttle * dt
  } else if (throttle < 0) {
    // Ikkala tomonlama: gaz bosilganda ham tezlanadi, orqaga qaraganda
    state.speed += BRAKE * throttle * dt
  }

  // Tormoz / drag
  if (throttle === 0) {
    const d = DRAG * dt * Math.sign(state.speed)
    if (Math.abs(state.speed) <= Math.abs(d)) state.speed = 0
    else state.speed -= d
  }

  state.speed = THREE.MathUtils.clamp(state.speed, -MAX_REVERSE, MAX_SPEED)

  // --- Burilish (tezlikka bog'liq, teskarida ham ishlaydi) ---
  const speedRatio = Math.abs(state.speed) / MAX_SPEED
  const dir = state.speed >= 0 ? 1 : -1
  state.heading += steer * TURN_RATE * speedRatio * dir * dt

  // --- Pozitsiyani yangilash ---
  const nx = state.x + Math.sin(state.heading) * state.speed * dt
  const nz = state.z + Math.cos(state.heading) * state.speed * dt

  // --- Bino bilan to'qnashuv ---
  let hit = false
  const halfW = 1.3
  const halfL = 2.2
  const probe = {
    minX: nx - halfW,
    maxX: nx + halfW,
    minZ: nz - halfL,
    maxZ: nz + halfL,
  }

  for (const o of obstacles) {
    if (
      probe.minX < o.maxX &&
      probe.maxX > o.minX &&
      probe.minZ < o.maxZ &&
      probe.maxZ > o.minZ
    ) {
      hit = true
      break
    }
  }

  if (hit) {
    // To'qnashuvda tezlikni yo'qotamiz, lekin joyida turamiz
    state.speed *= -0.25
  } else {
    state.x = nx
    state.z = nz
  }

  // Shahar chegarasidan chiqmaslik
  state.x = THREE.MathUtils.clamp(state.x, -bounds, bounds)
  state.z = THREE.MathUtils.clamp(state.z, -bounds, bounds)

  return { hit }
}

export const SPEED_LIMITS = { MAX_SPEED, MAX_REVERSE }
