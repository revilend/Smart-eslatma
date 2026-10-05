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
  /**
 * Blok/ko'cha tarmog'i — karta o'lchamini belgilaydi.
 * **Toq son** bo'lishi shart: juft sonli GRID da ko'cha markazlari
 * kvadratning markaziga nisbatan asimmetrik bo'lib qoladi, plyaj
 * halqasi esa to'g'ri chiqmaydi.
 */
  GRID: 55,
  /** Kvadrat o'lchami. */
  BLOCK: 26,
  /** Ko'cha kengligi. */
  ROAD: 12,
  /** Blok markazlari orasidagi masofa. */
  get CELL() {
    return this.BLOCK + this.ROAD
  },
  /**
   * Shahar yarim kengligi — tashqi yo'l markazigacha + uning yarim
   * kengligi. Shu qiymat qaytarilmaydi, aks holda tashqi yo'llardagi
   * to'xtagan mashinalar plyaj zonasiga tushib qolardi.
   */
  get HALF() {
    return ((this.GRID - 1) / 2) * this.CELL + this.CELL / 2 + this.ROAD / 2
  },
}

/** Bir render chunk'idagi bloklar soni (kvadrat). */
const CHUNK_BLOCKS = 6

/** Prop'lar (chiroq, daraxt) shu masofada turadi — ichki ko'chada emas. */
const PROP_OFFSET = CITY.ROAD / 2 + 2
/** To'xtagan mashinalar yo'l chetida, ichki chiziqda. */
const PARKED_OFFSET = CITY.ROAD / 2 - 1.5
/**
 * Blok chetida trotuvar uchun qoldiriladigan minimal joy.
 * Binolar shundan yaqinlashmaydi — aks holda piyodalar yuradigan
 * lenta bino ichiga tushadi.
 */
export const SIDEWALK_CLEARANCE = 4.5

/** i-chindagi blok yoki ko'cha markazining koordinatasi. */
export function axisAt(i: number, cell: number, grid: number): number {
  return (i - (grid - 1) / 2) * cell
}

/**
 * Ko'cha markazlari: har bir qo'shni blok markazi orasida bittadan.
 * `i` juftlab qadamlaydi, shuning uchun qo'shni yo'llar bir markazga
 * to'g'ramaydi.
 */
/**
 * Ko'cha markazlari: har bir qo'shni blok markazi orasida bittadan,
 * hamda shaharning ikki chetida bittadan tashqi yo'l.
 *
 * Simmetrik bo'lishi shart — aks holda plyaj halqasi bir tomonda
 * keng, ikkinchisida tor bo'lib qoladi.
 */
export function roadCenters(cell: number, grid: number): number[] {
  const inner: number[] = []
  // Qo'shni bloklar orasidagi yo'llar: [min, max] simmetrik chiqadi
  for (let i = 0; i <= grid - 2; i++) inner.push(axisAt(i, cell, grid) + cell / 2)
  const edge = Math.abs(axisAt(grid - 1, cell, grid) + cell / 2)
  return [...inner, -edge, edge].sort((a, b) => a - b)
}

/** Blok markazlari (bino va trotuyar shu yerda turadi). */
export function blockCenters(cell: number, grid: number): number[] {
  const out: number[] = []
  for (let i = 0; i < grid; i++) out.push(axisAt(i, cell, grid))
  return out
}

/**
 * Avtomobilning boshlang'ich nuqtasi — markaziy ko'cha chorrahasida.
 * Shahar generatsiyasi va dvigatel shu yagona manbadan foydalanadi,
 * aks holda prop'lar spawn ustiga tushib qolishi mumkin.
 */
export function spawnPoint(): { x: number; z: number; heading: number } {
  const roads = roadCenters(CITY.CELL, CITY.GRID)
  return {
    x: roads[Math.floor(roads.length / 2)] ?? 0,
    z: 0,
    heading: 0,
  }
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
  /** Bog' bo'lgan bloklar (binolar o'rniga tabiat). */
  parks: { x: number; z: number }[]
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
  /** Ko'chadagi chiroqlar (qorong'i ustun + yorqin lampa). */
  lampsDark: THREE.BufferGeometry[]
  /** Lampa boshlari — emissive, kechqurun yorug'ligi. */
  lampsGlow: THREE.BufferGeometry[]
  /** Daraxtlar: tanasi (daraxt) va bargi (yashil). */
  treesTrunk: THREE.BufferGeometry[]
  treesLeaf: THREE.BufferGeometry[]
  /** Ko'cha bench'lari, ustun-uskuna. */
  streetProps: THREE.BufferGeometry[]
  /** To'xtagan mashinalar. */
  parked: THREE.BufferGeometry[]
}

function emptyChunk(): ChunkData {
  return {
    buildings: [], roofs: [], windows: [], sidewalks: [], dashes: [],
    lampsDark: [], lampsGlow: [], treesTrunk: [], treesLeaf: [],
    streetProps: [], parked: [],
  }
}

/** Yordamchi: vertikal ustun yasash. */
function post(w: number, h: number, d: number, x: number, y: number, z: number) {
  const g = new THREE.BoxGeometry(w, h, d)
  g.translate(x, y + h / 2, z)
  return g
}

export function buildCity(seed = 20240711): CityResult {
  const rand = makeRandom(seed)
  const group = new THREE.Group()
  const obstacles: CityResult['obstacles'] = []
  const cell = CITY.CELL
  const roads = roadCenters(cell, CITY.GRID)
  const blocks = blockCenters(cell, CITY.GRID)
  const limit = CITY.HALF
  const parks: { x: number; z: number }[] = []

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

      // --- Bog' bloklari: binolar o'rniga ochiq maydon ---
      // Markazga yaqinroq bloklarda ko'proq bog' — shaharning yashil zonasi
      const centrality = 1 - Math.min(1, Math.hypot(cx, cz) / limit)
      const parkChance = 0.05 + centrality * 0.06
      if (rand() < parkChance) {
        parks.push({ x: cx, z: cz })
        // Bog'ning yaxlit ko'kalamini chizish (trotuar ustiga)
        const lawn = new THREE.BoxGeometry(CITY.BLOCK, 0.2, CITY.BLOCK)
        lawn.translate(cx, 0.1, cz)
        chunk.sidewalks.push(lawn)
        continue
      }

      // Trotuvar — geometriya sifatida (alohida mesh emas)
      const walk = new THREE.BoxGeometry(CITY.BLOCK, 0.18, CITY.BLOCK)
      walk.translate(cx, 0.09, cz)
      chunk.sidewalks.push(walk)

      // Markazda balandroq, chetlarda past — gorizont chiziladi
      const lots = rand() < 0.35 ? 2 : 1

      for (let k = 0; k < lots; k++) {
        const w = 8 + rand() * 6
        const d = 8 + rand() * 6
        const h = 10 + rand() * 24 + centrality * rand() * 48

        // Bino blok markazidan SIDEWALK_CLEARANCE ichkarida qolishi shart —
        // aks holda u ko'chaga yopishib, trotuarda yurishga joy qolmaydi.
        const reach = CITY.BLOCK / 2 - SIDEWALK_CLEARANCE
        const maxOff = Math.max(0, reach - Math.max(w, d) / 2)
        const offX = lots === 1 ? 0 : (k === 0 ? -1 : 1) * Math.min(4.2, maxOff)
        const offZ = (rand() - 0.5) * 2 * Math.min(2, maxOff)
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
        // Baland binolarda lentalar kamroq: uzinflik bo'lsa ham
        // 2.1M verteksdan oshmasligi kerak (GPU yuklamasi).
        const bandStep = h > 45 ? 5.2 : 3.4
        for (let wy = 3; wy < h - 1.5; wy += bandStep) {
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

  // ---------- Ko'cha buyumlari: chiroq, daraxt, bench, to'xtagan mashina ----------
  // Bular ko'cha markazidan PROP_OFFSET masofada turadi, ya'ni ichki
  // yo'l chizig'i bo'sh qoladi — mashina hech qachon prop ustiga urilmaydi.
  const CAR_COLORS = [0xd94f4f, 0x4f7fd9, 0xe8e8e8, 0x3b3f47, 0xe0a13a, 0x5fb878]
  const lampStep = CITY.CELL // har bir kvadratda bitta chiroq

  for (const r of roads) {
    for (let t = -limit + lampStep / 2; t < limit; t += lampStep) {
      // Har chorrahada emas, uzun yo'llarda: t chiroq turadigan nuqta
      const chunk = chunkOf(r, t)
      const side = Math.round(t / lampStep) % 2 === 0 ? 1 : -1

      // --- Ko'cha chirog'i ---
      const lx = r + PROP_OFFSET * side
      const poleH = 6.5
      chunk.lampsDark.push(post(0.28, poleH, 0.28, lx, 0.18, t))
      // Yelg'aa bo'ylab cho'zilgan yondiruvchi qo'llancha
      const arm = new THREE.BoxGeometry(2.2, 0.18, 0.18)
      arm.translate(lx - 1.1 * side, poleH + 0.15, t)
      chunk.lampsDark.push(arm)
      // Lampa boshi — emissive
      const head = new THREE.BoxGeometry(0.9, 0.3, 0.5)
      head.translate(lx - 2.1 * side, poleH - 0.05, t)
      chunk.lampsGlow.push(head)

      // --- Daraxt (ko'cha chetida, chiroq'dan keyin) ---
      if (rand() < 0.75) {
        const tx = r + (PROP_OFFSET + 2.6) * side
        const th = 3 + rand() * 2.5
        chunk.treesTrunk.push(post(0.5, th, 0.5, tx, 0.18, t))
        const crown = new THREE.IcosahedronGeometry(1.6 + rand() * 1.1, 0)
        crown.translate(tx, th + 0.18 + 1.5, t)
        chunk.treesLeaf.push(crown)
      }

      // --- Bench ---
      if (rand() < 0.3) {
        const bx = r - PROP_OFFSET * side
        const seat = new THREE.BoxGeometry(0.7, 0.18, 2.2)
        seat.translate(bx, 0.75, t)
        chunk.streetProps.push(seat)
        const backrest = new THREE.BoxGeometry(0.16, 0.8, 2.2)
        backrest.translate(bx + 0.3 * side, 1.2, t)
        chunk.streetProps.push(backrest)
      }

      // --- To'xtagan mashina (yo'l chetida, ichki chiziqda) ---
      if (rand() < 0.45) {
        const px = r + PARKED_OFFSET * side
        const carLen = 4.2
        const color = new THREE.Color(CAR_COLORS[Math.floor(rand() * CAR_COLORS.length)])
        const body = new THREE.BoxGeometry(1.9, 0.75, carLen)
        body.translate(px, 0.6, t)
        const cols = new Float32Array(body.attributes.position.count * 3)
        for (let v = 0; v < body.attributes.position.count; v++) {
          cols[v * 3] = color.r; cols[v * 3 + 1] = color.g; cols[v * 3 + 2] = color.b
        }
        body.setAttribute('color', new THREE.BufferAttribute(cols, 3))
        chunk.parked.push(body)
        // kabina
        const cabin = new THREE.BoxGeometry(1.7, 0.6, carLen * 0.5)
        cabin.translate(px, 1.25, t)
        chunk.streetProps.push(cabin)
        // g'ildovlar ko'rinmagan — pastki qora qatlam
        const skirt = new THREE.BoxGeometry(1.95, 0.35, carLen * 0.92)
        skirt.translate(px, 0.28, t)
        chunk.streetProps.push(skirt)

        // To'xtagan mashina ham to'qnashuv obyekti
        obstacles.push({
          minX: px - 1.0, maxX: px + 1.0,
          minZ: t - carLen / 2, maxZ: t + carLen / 2,
        })
      }
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
  // Prop materiallari
  const matLampDark = new THREE.MeshStandardMaterial({
    color: 0x2a3140, roughness: 0.7, metalness: 0.4,
  })
  const matLampGlow = new THREE.MeshBasicMaterial({ color: 0xffeeb0 })
  const matTrunk = new THREE.MeshStandardMaterial({ color: 0x5a4632, roughness: 1 })
  const matLeaf = new THREE.MeshStandardMaterial({
    color: 0x3f7d46, roughness: 0.95, flatShading: true,
  })
  const matStreetProp = new THREE.MeshStandardMaterial({
    color: 0x3a4252, roughness: 0.8,
  })
  const matParked = new THREE.MeshStandardMaterial({
    vertexColors: true, roughness: 0.45, metalness: 0.4,
  })

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
    // Prop'lar mayda chiziladi (yorqin yuzalar soya olmaydi)
    add(chunk.lampsDark, matLampDark, false)
    add(chunk.lampsGlow, matLampGlow, false)
    add(chunk.treesTrunk, matTrunk, false)
    add(chunk.treesLeaf, matLeaf, false)
    add(chunk.streetProps, matStreetProp, false)
    add(chunk.parked, matParked, true)
  }

  return { group, obstacles, roads, blocks, parks }
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