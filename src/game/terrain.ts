import * as THREE from 'three'
import { CITY } from './city'

/**
 * Tabiat qatlami: shahar atrofida plyaj, keyin dengiz, ufqda tog'lar
 * va shahar ichida bog'lar.
 *
 * Barcha geometriyalar `mergeGeometries` bilan birlashtiriladi, shuning
 * uchun minglab obyekt bo'lsa ham render arzon.
 */

/** Shakarning yarim kengligidan plyajgacha masofa. */
const BEACH_WIDTH = 95
/** Plyajdan suv chegarasigacha (plyajning oxiri). */
const WATER_START = CITY.HALF + BEACH_WIDTH
/** Tog'lar boshlanadigan masofa. */
const MOUNTAIN_START = WATER_START + 230
/** Tog'lar qanchalik uzoqqa cho'ziladi. */
const MOUNTAIN_SPREAD = 780

export interface TerrainResult {
  group: THREE.Group
  /** Suv yuzasi (to'lqin animatsiyasi uchun). */
  water: THREE.Mesh
  /** O'yinchi uchun ruxsat berilgan chegaralar. */
  limits: { beach: number }
}

/** Deterministik tasodifiylik. */
function makeRandom(seed: number) {
  let s = seed >>> 0
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0
    return s / 4294967296
  }
}

export function buildTerrain(seed = 991733): TerrainResult {
  const rand = makeRandom(seed)
  const group = new THREE.Group()
  const HALF = CITY.HALF

  // ---------------------------------------------------------------- Ground
  // Butun maydon: quyilmaydigan asos — shundan ufq boshlansin.
  const base = new THREE.Mesh(
    new THREE.PlaneGeometry(MOUNTAIN_START * 6, MOUNTAIN_START * 6),
    new THREE.MeshStandardMaterial({ color: 0x1d2330, roughness: 1 }),
  )
  base.rotation.x = -Math.PI / 2
  base.position.y = -0.05
  base.receiveShadow = true
  group.add(base)

  // ----------------------------------------------------------------- Beach
  // Shahr kvadrati atrofida qumli halqa. Kvadrat ufq radiusidan kichik,
  // shuning uchun burchaklar suv bilan to'ldiriladi.
  const sandMat = new THREE.MeshStandardMaterial({
    color: 0xe4d3a3,
    roughness: 1,
  })
  const sandGeoms: THREE.BufferGeometry[] = []

  const addSandRect = (w: number, d: number, x: number, z: number) => {
    const g = new THREE.PlaneGeometry(w, d)
    g.rotateX(-Math.PI / 2)
    g.translate(x, 0.02, z)
    sandGeoms.push(g)
  }
  // To'rt tomon halqasi (chekkalar chegara oralig'ini qoldiradi)
  const outer = HALF + BEACH_WIDTH
  addSandRect(BEACH_WIDTH * 2, BEACH_WIDTH * 2, 0, HALF + BEACH_WIDTH / 2) // +Z
  addSandRect(BEACH_WIDTH * 2, BEACH_WIDTH * 2, 0, -(HALF + BEACH_WIDTH / 2)) // -Z
  addSandRect(BEACH_WIDTH * 2, BEACH_WIDTH * 2, HALF + BEACH_WIDTH / 2, 0) // +X
  addSandRect(BEACH_WIDTH * 2, BEACH_WIDTH * 2, -(HALF + BEACH_WIDTH / 2), 0) // -X
  // To'rt burchakni to'ldiruvchi kvadratlar
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      addSandRect(outer * 2, outer * 2, sx * outer, sz * outer)
    }
  }
  const sand = mergeGeometries(sandGeoms)
  if (sand) {
    const mesh = new THREE.Mesh(sand, sandMat)
    mesh.receiveShadow = true
    group.add(mesh)
  }

  // To'lqin chizig'i — plyaj va suv chegarasida
  const foamGeoms: THREE.BufferGeometry[] = []
  for (let i = 0; i < 90; i++) {
    const t = (i / 90) * Math.PI * 2
    // To'rt tomon bo'ylab joylashuv
    const along = (rand() - 0.5) * 2 * outer
    let x: number, z: number
    const side = Math.floor(rand() * 4)
    if (side === 0) { x = along; z = outer }
    else if (side === 1) { x = along; z = -outer }
    else if (side === 2) { x = outer; z = along }
    else { x = -outer; z = along }
    void t
    const g = new THREE.PlaneGeometry(6 + rand() * 10, 3 + rand() * 4)
    g.rotateX(-Math.PI / 2)
    g.rotateY(rand() * Math.PI)
    g.translate(x, 0.06, z)
    foamGeoms.push(g)
  }
  const foam = mergeGeometries(foamGeoms)
  if (foam) {
    group.add(
      new THREE.Mesh(
        foam,
        new THREE.MeshBasicMaterial({ color: 0xf2f6ff, transparent: true, opacity: 0.7 }),
      ),
    )
  }

  // ----------------------------------------------------------------- Water
  const waterMat = new THREE.MeshStandardMaterial({
    color: 0x1c6fa8,
    roughness: 0.15,
    metalness: 0.5,
    transparent: true,
    opacity: 0.92,
  })
  const water = new THREE.Mesh(
    new THREE.PlaneGeometry(MOUNTAIN_START * 6, MOUNTAIN_START * 6, 1, 1),
    waterMat,
  )
  water.rotation.x = -Math.PI / 2
  water.position.y = -0.35
  group.add(water)

  // ------------------------------------------------------------- Mountains
  // Ufqda tog' halqasi — shakl shunchalik muhim emas, kontur sezilarli.
  const rockMat = new THREE.MeshStandardMaterial({
    color: 0x5b6474,
    roughness: 1,
    flatShading: true,
  })
  const snowMat = new THREE.MeshStandardMaterial({
    color: 0xeef3f8,
    roughness: 0.9,
    flatShading: true,
  })
  const rockGeoms: THREE.BufferGeometry[] = []
  const snowGeoms: THREE.BufferGeometry[] = []

  const ringR = MOUNTAIN_START + MOUNTAIN_SPREAD * 0.55
  const count = 46
  for (let i = 0; i < count; i++) {
    const a = (i / count) * Math.PI * 2 + rand() * 0.1
    const dist = ringR + (rand() - 0.5) * MOUNTAIN_SPREAD * 0.7
    const x = Math.cos(a) * dist
    const z = Math.sin(a) * dist
    // Balandlik va balandlik kengligi bog'liq
    const h = 190 + rand() * 340
    const r = 150 + rand() * 190
    // Konusning siljishi — tepalik cho'qig'i markazda emas
    const top = new THREE.ConeGeometry(r, h, 6, 1)
    top.rotateY(rand() * Math.PI)
    top.translate(x, h / 2 - 6, z)
    rockGeoms.push(top)

    // Qorli uchi — konusning yuqori qismi
    const snowR = r * 0.34
    const snowH = h * 0.3
    const snow = new THREE.ConeGeometry(snowR, snowH, 6, 1)
    snow.rotateY(rand() * Math.PI)
    snow.translate(x, h - snowH / 2 - 6 + 2, z)
    snowGeoms.push(snow)
  }

  // Dengizga yaqinroq past tepaliklar (ikkinchi qatlam)
  for (let i = 0; i < 26; i++) {
    const a = rand() * Math.PI * 2
    const dist = WATER_START + rand() * 190
    const h = 26 + rand() * 60
    const r = 40 + rand() * 70
    const g = new THREE.ConeGeometry(r, h, 5, 1)
    g.translate(Math.cos(a) * dist, h / 2 - 5, Math.sin(a) * dist)
    rockGeoms.push(g)
  }

  const rock = mergeGeometries(rockGeoms)
  if (rock) group.add(new THREE.Mesh(rock, rockMat))
  const snow = mergeGeometries(snowGeoms)
  if (snow) group.add(new THREE.Mesh(snow, snowMat))

  return { group, water, limits: { beach: HALF + BEACH_WIDTH - 8 } }
}

/**
 * Shahar ichidagi bog' (park) bloklari: ko'k maydon, daraxtlar, o'tin.
 * Binolar o'rniga tabiat — shahar yanada "GTA uslubiga" yaqinlashadi.
 */
export function buildParks(
  blocks: { x: number; z: number }[],
  seed = 5150,
): THREE.Group {
  const rand = makeRandom(seed)
  const group = new THREE.Group()
  const CELL = CITY.CELL
  const BLOCK = CITY.BLOCK

  const grassMat = new THREE.MeshStandardMaterial({ color: 0x3f7d46, roughness: 1 })
  const trunkMat = new THREE.MeshStandardMaterial({ color: 0x5a4632, roughness: 1 })
  const leafMat = new THREE.MeshStandardMaterial({
    color: 0x35803f,
    roughness: 0.95,
    flatShading: true,
  })
  const pathMat = new THREE.MeshStandardMaterial({ color: 0xc4b08c, roughness: 1 })

  for (const b of blocks) {
    // Ko'k maydon
    const lawn = new THREE.Mesh(new THREE.BoxGeometry(BLOCK, 0.2, BLOCK), grassMat)
    lawn.position.set(b.x, 0.1, b.z)
    lawn.receiveShadow = true
    group.add(lawn)

    // Diagonal yo'l — bog'ni chetlab o'tish uchun
    const path = new THREE.Mesh(
      new THREE.BoxGeometry(BLOCK * 1.42, 0.06, 2.4),
      pathMat,
    )
    path.position.set(b.x, 0.2, b.z)
    path.rotation.y = rand() * Math.PI
    group.add(path)

    // Daraxtlar
    const trunks: THREE.BufferGeometry[] = []
    const leaves: THREE.BufferGeometry[] = []
    const n = 6 + Math.floor(rand() * 6)
    for (let i = 0; i < n; i++) {
      const tx = b.x + (rand() - 0.5) * (BLOCK - 5)
      const tz = b.z + (rand() - 0.5) * (BLOCK - 5)
      const th = 2.6 + rand() * 2
      const t = new THREE.BoxGeometry(0.5, th, 0.5)
      t.translate(tx, th / 2 + 0.2, tz)
      trunks.push(t)
      const crown = new THREE.IcosahedronGeometry(1.5 + rand() * 1.1, 0)
      crown.translate(tx, th + 1.2, tz)
      leaves.push(crown)
    }
    const tm = mergeGeometries(trunks)
    if (tm) group.add(new THREE.Mesh(tm, trunkMat))
    const lm = mergeGeometries(leaves)
    if (lm) group.add(new THREE.Mesh(lm, leafMat))
    void CELL
  }

  return group
}

/** Bir nechta geometriyani birlashtirish. */
function mergeGeometries(geos: THREE.BufferGeometry[]): THREE.BufferGeometry | null {
  if (geos.length === 0) return null
  const positions: number[] = []
  const normals: number[] = []
  const uvs: number[] = []
  const indices: number[] = []
  let offset = 0
  for (const geo of geos) {
    const pos = geo.attributes.position
    const nor = geo.attributes.normal
    const uv = geo.attributes.uv
    for (let i = 0; i < pos.count; i++) {
      positions.push(pos.getX(i), pos.getY(i), pos.getZ(i))
      normals.push(nor ? nor.getX(i) : 0, nor ? nor.getY(i) : 1, nor ? nor.getZ(i) : 0)
      uvs.push(uv ? uv.getX(i) : 0, uv ? uv.getY(i) : 0)
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
  merged.setIndex(indices)
  merged.computeBoundingSphere()
  return merged
}