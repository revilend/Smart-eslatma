import * as THREE from 'three'

/**
 * Tuzilma o'lchamlari (dunyo birligi = 1 metr).
 *
 * Blok markazlari `CELL` oralig'ida, ko'cha markazlari esa qo'shni blok
 * markazlarining O'RTASIDA (CELL/2 siljish bilan) joylashadi. Shu tarzda
 * `CELL = BLOCK + ROAD` tengligi saqlanadi va trotuyar bilan ko'cha orasida
 * bo'sh (unpaved) bo'lak qolmaydi.
 */
export const CITY = {
  /** Blok/ko'cha tarmog'i. */
  GRID: 11,
  /** Kvadrat o'lchami. */
  BLOCK: 26,
  /** Ko'cha kengligi. */
  ROAD: 12,
  /** Blok markazlari orasidagi masofa. */
  get CELL() {
    return this.BLOCK + this.ROAD
  },
  /** Shahar yarim kengligi (chegara). */
  get HALF() {
    return ((this.GRID - 1) / 2) * this.CELL + this.CELL / 2
  },
}

/** i-chindagi blok yoki ko'cha markazining koordinatasi. */
export function axisAt(i: number, cell: number, grid: number): number {
  return (i - (grid - 1) / 2) * cell
}

/**
 * Ko'cha markazlari: har bir qo'shni blok markazi orasida bittadan.
 * Natija har bir yo'lda bitta aniq markaz bo'ladi (ikki qo'shni yo'l
 * bitta markazga to'g'ramasligi uchun `i` juftlab qadamlaydi).
 */
export function roadCenters(cell: number, grid: number): number[] {
  const out: number[] = []
  for (let i = 0; i <= grid; i += 2) {
    out.push(axisAt(i, cell, grid) - cell / 2)
  }
  return out
}

/** Blok markazlari (bino va trotuyar shu yerda turadi). */
export function blockCenters(cell: number, grid: number): number[] {
  const out: number[] = []
  for (let i = 0; i < grid; i++) out.push(axisAt(i, cell, grid))
  return out
}

/** Bino uchun arzon deterministik tasodifiylik (seeded PRNG). */
function makeRandom(seed: number) {
  let s = seed >>> 0
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0
    return s / 4294967296
  }
}

export interface CityResult {
  group: THREE.Group
  /** Bino chegaralari — to'qnashuv uchun AABB ro'yxati. */
  obstacles: { minX: number; maxX: number; minZ: number; maxZ: number }[]
  /** Ko'cha markazlari (spawn va marker joylashuvi uchun). */
  roads: number[]
  /** Blok markazlari. */
  blocks: number[]
}

const BUILDING_PALETTE = [
  0x2f5d8a,
  0x35506e,
  0x4a5a72,
  0x3a4a63,
  0x274b6d,
  0x40566e,
]

const WINDOW_COLOR = 0xffe9a8

export function buildCity(seed = 20240711): CityResult {
  const rand = makeRandom(seed)
  const group = new THREE.Group()
  const obstacles: CityResult['obstacles'] = []
  const cell = CITY.CELL
  const roads = roadCenters(cell, CITY.GRID)
  const blocks = blockCenters(cell, CITY.GRID)

  // ---------- Ko'cha yuzasi (butun shahar bo'ylab) ----------
  const roadMat = new THREE.MeshStandardMaterial({
    color: 0x1d2330,
    roughness: 0.92,
    metalness: 0.02,
  })
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(2400, 2400), roadMat)
  ground.rotation.x = -Math.PI / 2
  ground.receiveShadow = true
  group.add(ground)

  const sidewalkMat = new THREE.MeshStandardMaterial({
    color: 0x8d9bb0,
    roughness: 0.95,
  })

  // ---------- Bloklar: har biri trotuvar + 1..3 bino ----------
  const buildingGeoms: THREE.BufferGeometry[] = []
  const roofGeoms: THREE.BufferGeometry[] = []
  const winGeoms: THREE.BufferGeometry[] = []
  const dashGeoms: THREE.BufferGeometry[] = []

  for (const cx of blocks) {
    for (const cz of blocks) {
      // Trotuvar plitasi — blok o'lchamida, ko'cha chetlariga tegib turadi
      const sidewalk = new THREE.Mesh(
        new THREE.BoxGeometry(CITY.BLOCK, 0.18, CITY.BLOCK),
        sidewalkMat,
      )
      sidewalk.position.set(cx, 0.09, cz)
      sidewalk.receiveShadow = true
      group.add(sidewalk)

      // 1-3 bino (markazda balandroq, chetlarda past — gorizont chiziladi)
      const lots = rand() < 0.35 ? 2 : 1

      for (let k = 0; k < lots; k++) {
        const w = 8 + rand() * 7
        const d = 8 + rand() * 7
        // Markazga yaqinlik bo'yicha balandlik
        const centrality = 1 - Math.min(1, Math.hypot(cx, cz) / CITY.HALF)
        const h = 10 + rand() * 24 + centrality * rand() * 48

        const offX = lots === 1 ? 0 : k === 0 ? -4.6 : 4.6
        const offZ = (rand() - 0.5) * 2
        const x = cx + offX
        const z = cz + offZ

        // --- Bino korpusi ---
        const geo = new THREE.BoxGeometry(w, h, d)
        geo.translate(x, h / 2 + 0.18, z)
        const c = new THREE.Color(
          BUILDING_PALETTE[Math.floor(rand() * BUILDING_PALETTE.length)],
        )
        const colors = new Float32Array(geo.attributes.position.count * 3)
        for (let v = 0; v < geo.attributes.position.count; v++) {
          colors[v * 3] = c.r
          colors[v * 3 + 1] = c.g
          colors[v * 3 + 2] = c.b
        }
        geo.setAttribute('color', new THREE.BufferAttribute(colors, 3))
        buildingGeoms.push(geo)

        // --- Tom ---
        const roof = new THREE.BoxGeometry(w + 0.5, 0.6, d + 0.5)
        roof.translate(x, h + 0.45, z)
        roofGeoms.push(roof)

        // --- Deraza lentalari ---
        for (let wy = 3; wy < h - 1.5; wy += 3.2) {
          const band = new THREE.BoxGeometry(w + 0.12, 0.3, d + 0.12)
          band.translate(x, wy + 0.18, z)
          winGeoms.push(band)
        }

        obstacles.push({
          minX: x - w / 2,
          maxX: x + w / 2,
          minZ: z - d / 2,
          maxZ: z + d / 2,
        })
      }
    }
  }

  // ---------- Geometriyalarni birlashtirish (performance) ----------
  const mergedBuildings = mergeGeometries(buildingGeoms)
  if (mergedBuildings) {
    const mesh = new THREE.Mesh(
      mergedBuildings,
      new THREE.MeshStandardMaterial({
        vertexColors: true,
        roughness: 0.72,
        metalness: 0.12,
      }),
    )
    mesh.castShadow = true
    mesh.receiveShadow = true
    group.add(mesh)
  }

  const mergedRoofs = mergeGeometries(roofGeoms)
  if (mergedRoofs) {
    const mesh = new THREE.Mesh(
      mergedRoofs,
      new THREE.MeshStandardMaterial({ color: 0x1a2130, roughness: 0.85 }),
    )
    mesh.castShadow = true
    group.add(mesh)
  }

  const mergedWindows = mergeGeometries(winGeoms)
  if (mergedWindows) {
    group.add(
      new THREE.Mesh(mergedWindows, new THREE.MeshBasicMaterial({ color: WINDOW_COLOR })),
    )
  }

  // ---------- Ko'cha chiziqlari (faqat ko'cha markazlarida) ----------
  const limit = CITY.HALF
  for (const r of roads) {
    for (let z = -limit; z < limit; z += 6) {
      const g = new THREE.PlaneGeometry(0.4, 3)
      g.rotateX(-Math.PI / 2)
      g.translate(r, 0.05, z)
      dashGeoms.push(g)
    }
    for (let x = -limit; x < limit; x += 6) {
      const g = new THREE.PlaneGeometry(3, 0.4)
      g.rotateX(-Math.PI / 2)
      g.translate(x, 0.05, r)
      dashGeoms.push(g)
    }
  }
  const mergedDash = mergeGeometries(dashGeoms)
  if (mergedDash) {
    group.add(
      new THREE.Mesh(mergedDash, new THREE.MeshBasicMaterial({ color: 0xd8e0ea })),
    )
  }

  return { group, obstacles, roads, blocks }
}

/** Bir nechta BoxGeometry ni bitta geometriyaga birlashtiradi (position + normal + uv + color). */
function mergeGeometries(geos: THREE.BufferGeometry[]): THREE.BufferGeometry | null {
  if (geos.length === 0) return null
  const positions: number[] = []
  const normals: number[] = []
  const uvs: number[] = []
  const colors: number[] = []
  const indices: number[] = []
  let offset = 0

  for (const geo of geos) {
    const pos = geo.attributes.position
    const nor = geo.attributes.normal
    const uv = geo.attributes.uv
    const col = geo.attributes.color

    for (let i = 0; i < pos.count; i++) {
      positions.push(pos.getX(i), pos.getY(i), pos.getZ(i))
      normals.push(nor ? nor.getX(i) : 0, nor ? nor.getY(i) : 1, nor ? nor.getZ(i) : 0)
      uvs.push(uv ? uv.getX(i) : 0, uv ? uv.getY(i) : 0)
      if (col) colors.push(col.getX(i), col.getY(i), col.getZ(i))
      else colors.push(1, 1, 1)
    }
    const idx = geo.index
    if (idx) for (let i = 0; i < idx.count; i++) indices.push(idx.getX(i) + offset)
    else for (let i = 0; i < pos.count; i++) indices.push(i + offset)
    offset += pos.count
    geo.dispose()
  }

  const merged = new THREE.BufferGeometry()
  merged.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  merged.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3))
  merged.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2))
  merged.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3))
  merged.setIndex(indices)
  merged.computeBoundingSphere()
  return merged
}