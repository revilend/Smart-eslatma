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
  /** Blok/ko'cha tarmog'i — karta o'lchamini belgilaydi. */
  GRID: 31,
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

/** Bir render chunk'idagi bloklar soni (kvadrat). */
const CHUNK_BLOCKS = 4

/** i-chindagi blok yoki ko'cha markazining koordinatasi. */
export function axisAt(i: number, cell: number, grid: number): number {
  return (i - (grid - 1) / 2) * cell
}

/**
 * Ko'cha markazlari: har bir qo'shni blok markazi orasida bittadan.
 * `i` juftlab qadamlaydi, shuning uchun qo'shni yo'llar bir markazga
 * to'g'ramaydi.
 */
export function roadCenters(cell: number, grid: number): number[] {
  const out: number[] = []
  for (let i = 0; i <= grid; i += 2) out.push(axisAt(i, cell, grid) - cell / 2)
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
  0x44607e,
]

const WINDOW_COLOR = 0xffe9a8

/** Bitta chunk uchun yig'ilgan geometriyalar. */
interface ChunkData {
  buildings: THREE.BufferGeometry[]
  roofs: THREE.BufferGeometry[]
  windows: THREE.BufferGeometry[]
  sidewalks: THREE.BufferGeometry[]
  dashes: THREE.BufferGeometry[]
}

function emptyChunk(): ChunkData {
  return { buildings: [], roofs: [], windows: [], sidewalks: [], dashes: [] }
}

export function buildCity(seed = 20240711): CityResult {
  const rand = makeRandom(seed)
  const group = new THREE.Group()
  const obstacles: CityResult['obstacles'] = []
  const cell = CITY.CELL
  const roads = roadCenters(cell, CITY.GRID)
  const blocks = blockCenters(cell, CITY.GRID)
  const limit = CITY.HALF

  // Chunk indeksini koordinatadan hisoblaydigan yordamchi
  const chunkKey = (cx: number, cz: number) =>
    `${Math.floor((cx + CITY.HALF) / (CHUNK_BLOCKS * cell))}|${Math.floor(
      (cz + CITY.HALF) / (CHUNK_BLOCKS * cell),
    )}`

  const chunks = new Map<string, ChunkData>()
  const chunkOf = (cx: number, cz: number) => {
    const key = chunkKey(cx, cz)
    let c = chunks.get(key)
    if (!c) {
      c = emptyChunk()
      chunks.set(key, c)
    }
    return c
  }

  // ---------- Ko'cha yuzasi (butun shahar bo'ylab bitta tekis maydon) ----------
  const roadMat = new THREE.MeshStandardMaterial({
    color: 0x1d2330,
    roughness: 0.92,
    metalness: 0.02,
  })
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(limit * 2 + 400, limit * 2 + 400),
    roadMat,
  )
  ground.rotation.x = -Math.PI / 2
  ground.receiveShadow = true
  group.add(ground)

  // ---------- Bloklar: har biri trotuvar + 1..2 bino ----------
  for (const cx of blocks) {
    for (const cz of blocks) {
      const chunk = chunkOf(cx, cz)

      // Trotuvar — geometriya sifatida (alohida mesh emas)
      const walk = new THREE.BoxGeometry(CITY.BLOCK, 0.18, CITY.BLOCK)
      walk.translate(cx, 0.09, cz)
      chunk.sidewalks.push(walk)

      // Markazda balandroq, chetlarda past — gorizont chiziladi
      const centrality = 1 - Math.min(1, Math.hypot(cx, cz) / limit)
      const lots = rand() < 0.35 ? 2 : 1

      for (let k = 0; k < lots; k++) {
        const w = 8 + rand() * 7
        const d = 8 + rand() * 7
        const h = 10 + rand() * 24 + centrality * rand() * 48

        const offX = lots === 1 ? 0 : k === 0 ? -4.6 : 4.6
        const offZ = (rand() - 0.5) * 2
        const x = cx + offX
        const z = cz + offZ

        // --- Bino korpusi (har binoga rang) ---
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
        chunk.buildings.push(geo)

        // --- Tom ---
        const roof = new THREE.BoxGeometry(w + 0.5, 0.6, d + 0.5)
        roof.translate(x, h + 0.45, z)
        chunk.roofs.push(roof)

        // --- Deraza lentalari ---
        for (let wy = 3; wy < h - 1.5; wy += 3.2) {
          const band = new THREE.BoxGeometry(w + 0.12, 0.3, d + 0.12)
          band.translate(x, wy + 0.18, z)
          chunk.windows.push(band)
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

  // ---------- Ko'cha chiziqlari (chunk'larga tarqatilgan) ----------
  for (const r of roads) {
    for (let z = -limit; z < limit; z += 6) {
      const g = new THREE.PlaneGeometry(0.4, 3)
      g.rotateX(-Math.PI / 2)
      g.translate(r, 0.05, z)
      chunkOf(r, z).dashes.push(g)
    }
    for (let x = -limit; x < limit; x += 6) {
      const g = new THREE.PlaneGeometry(3, 0.4)
      g.rotateX(-Math.PI / 2)
      g.translate(x, 0.05, r)
      chunkOf(x, r).dashes.push(g)
    }
  }

  // ---------- Har bir chunk alohida mesh: frustum culling ishlaydi ----------
  const matBuildings = new THREE.MeshStandardMaterial({
    vertexColors: true,
    roughness: 0.72,
    metalness: 0.12,
  })
  const matRoofs = new THREE.MeshStandardMaterial({
    color: 0x1a2130,
    roughness: 0.85,
  })
  const matWindows = new THREE.MeshBasicMaterial({ color: WINDOW_COLOR })
  const matSidewalk = new THREE.MeshStandardMaterial({
    color: 0x8d9bb0,
    roughness: 0.95,
  })
  const matDash = new THREE.MeshBasicMaterial({ color: 0xd8e0ea })

  for (const chunk of chunks.values()) {
    const add = (
      geos: THREE.BufferGeometry[],
      mat: THREE.Material,
      shadow: boolean,
    ) => {
      const merged = mergeGeometries(geos)
      if (!merged) return
      const mesh = new THREE.Mesh(merged, mat)
      mesh.castShadow = shadow
      mesh.receiveShadow = shadow
      group.add(mesh)
    }
    // Binolar ufqdan eng sekin qism — ular soya ham oladi
    add(chunk.buildings, matBuildings, true)
    add(chunk.roofs, matRoofs, true)
    add(chunk.windows, matWindows, false)
    add(chunk.sidewalks, matSidewalk, false)
    add(chunk.dashes, matDash, false)
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
  merged.computeBoundingBox()
  return merged
}