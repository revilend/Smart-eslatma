import * as THREE from 'three'

/** Tuzilma o'lchamlari (dunyo birligi = 1 metr). */
export const CITY = {
  /** Blok tarmog'i: har bir kvadrat katak bitta blok. */
  GRID: 11,
  /** Kvadrat orasidagi masofa (markazdan markazgacha). */
  BLOCK: 26,
  /** Yo'l kengligi. */
  ROAD: 12,
  get CELL() {
    return this.BLOCK + this.ROAD
  },
  get HALF() {
    return ((this.GRID - 1) / 2) * this.CELL
  },
}

/** Bino uchun arzon deterministik tasodifiylik (seeded PRNG). */
function makeRandom(seed: number) {
  let s = seed >>> 0
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0
    return s / 4294967296
  }
}

/** Blok ichidagi binolarni bitta guruh (merged) geometriya sifatida quradi. */
export interface CityResult {
  group: THREE.Group
  /** Ko'chada olib ketadigan binolarning AABB ro'yxati. */
  obstacles: { minX: number; maxX: number; minZ: number; maxZ: number }[]
  /** Ko'chalar markazining X koordinatalari. */
  roadLines: number[]
}

const BUILDING_PALETTE = [
  0x2f5d8a, // ko'k
  0x35506e, // to'q ko'k
  0x4a5a72, // kulrang-ko'k
  0x3a4a63,
  0x274b6d,
  0x40566e,
]

const WINDOW_COLOR = 0xffe9a8

export function buildCity(seed = 20240711): CityResult {
  const rand = makeRandom(seed)
  const group = new THREE.Group()
  const obstacles: CityResult['obstacles'] = []

  // ---------- Yer va ko'cha qatlamlari ----------
  const groundMat = new THREE.MeshStandardMaterial({
    color: 0x2b3242,
    roughness: 1,
    metalness: 0,
  })
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(2000, 2000), groundMat)
  ground.rotation.x = -Math.PI / 2
  ground.receiveShadow = true
  group.add(ground)

  // Ko'cha qatlami: katta to'q ko'k yuzani qo'yamiz va har bir katak
  // uchun quyuqroq "yo'l" plitasini joylaymiz — shunda chekka chiziqlar aniq ko'rinadi.
  const roadMat = new THREE.MeshStandardMaterial({
    color: 0x1d2330,
    roughness: 0.92,
    metalness: 0.02,
  })
  const sidewalkMat = new THREE.MeshStandardMaterial({
    color: 0x8d9bb0,
    roughness: 0.95,
  })

  for (let i = 0; i < CITY.GRID; i++) {
    for (let j = 0; j < CITY.GRID; j++) {
      const cx = (i - (CITY.GRID - 1) / 2) * CITY.CELL
      const cz = (j - (CITY.GRID - 1) / 2) * CITY.CELL

      // Yo'l to'shagi (har 2-katakda, uzun yo'llar uchun)
      if (i % 2 === 0) {
        const slab = new THREE.Mesh(
          new THREE.PlaneGeometry(CITY.ROAD, CITY.CELL + CITY.ROAD),
          roadMat,
        )
        slab.rotation.x = -Math.PI / 2
        slab.position.set(cx, 0.01, cz)
        slab.receiveShadow = true
        group.add(slab)
      }
      if (j % 2 === 0) {
        const slab = new THREE.Mesh(
          new THREE.PlaneGeometry(CITY.CELL + CITY.ROAD, CITY.ROAD),
          roadMat,
        )
        slab.rotation.x = -Math.PI / 2
        slab.position.set(cx, 0.01, cz)
        slab.receiveShadow = true
        group.add(slab)
      }

      // Kengaytirilgan chorraha kataklari
      if (i % 2 === 0 && j % 2 === 0) {
        const plaza = new THREE.Mesh(
          new THREE.PlaneGeometry(CITY.ROAD, CITY.ROAD),
          roadMat,
        )
        plaza.rotation.x = -Math.PI / 2
        plaza.position.set(cx, 0.02, cz)
        plaza.receiveShadow = true
        group.add(plaza)
      }

      // Trotuarlar (kvadratning chetlari bo'ylab)
      const sidewalk = new THREE.Mesh(
        new THREE.BoxGeometry(CITY.BLOCK, 0.18, CITY.BLOCK),
        sidewalkMat,
      )
      sidewalk.position.set(cx, 0.09, cz)
      sidewalk.receiveShadow = true
      group.add(sidewalk)
    }
  }

  // ---------- Binolar ----------
  // Har bir blok ichida 1-3 bino quramiz (ichki bo'shliq qoldiramiz).
  const buildingGeoms: THREE.BufferGeometry[] = []
  const roofGeoms: THREE.BufferGeometry[] = []
  const winGeoms: THREE.BufferGeometry[] = []

  for (let i = 0; i < CITY.GRID; i++) {
    for (let j = 0; j < CITY.GRID; j++) {
      const cx = (i - (CITY.GRID - 1) / 2) * CITY.CELL
      const cz = (j - (CITY.GRID - 1) / 2) * CITY.CELL

      const lots = rand() < 0.35 ? 2 : 1
      for (let k = 0; k < lots; k++) {
        // Bino o'lchamlari
        const w = 7 + rand() * 8
        const d = 7 + rand() * 8
        // Markaziy qismda balandroq, chetlarda past — ko'cha gorizonti uchun
        const distFromCenter = Math.hypot(i - (CITY.GRID - 1) / 2, j - (CITY.GRID - 1) / 2)
        const heightBias = Math.max(0, 1 - distFromCenter / (CITY.GRID / 2))
        const h = 8 + rand() * 26 + heightBias * rand() * 46

        // Lot ichidagi joylashuv
        const offX = lots === 1 ? 0 : (k === 0 ? -4.5 : 4.5)
        const offZ = (rand() - 0.5) * 3
        const x = cx + offX
        const z = cz + offZ

        // Bimoli bino
        const geo = new THREE.BoxGeometry(w, h, d)
        geo.translate(x, h / 2 + 0.18, z)
        buildingGeoms.push(geo)

        // Shift: har binoga boshqa rang (material orqali emas, attribute orqali)
        const colors = new Float32Array(geo.attributes.position.count * 3)
        const c = new THREE.Color(
          BUILDING_PALETTE[Math.floor(rand() * BUILDING_PALETTE.length)],
        )
        for (let v = 0; v < geo.attributes.position.count; v++) {
          colors[v * 3] = c.r
          colors[v * 3 + 1] = c.g
          colors[v * 3 + 2] = c.b
        }
        geo.setAttribute('color', new THREE.BufferAttribute(colors, 3))

        // Tom qatlami
        const roof = new THREE.BoxGeometry(w + 0.5, 0.6, d + 0.5)
        roof.translate(x, h + 0.45, z)
        roofGeoms.push(roof)

        // Deraza chizig'i (yorqin neon lenta)
        for (let wy = 3; wy < h - 1.5; wy += 3.2) {
          const band = new THREE.BoxGeometry(w + 0.12, 0.28, d + 0.12)
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

  // Geometriyalarni birlashtirish (performance uchun)
  const mergedBuildings = mergeGeometries(buildingGeoms)
  if (mergedBuildings) {
    const mat = new THREE.MeshStandardMaterial({
      vertexColors: true,
      roughness: 0.72,
      metalness: 0.12,
    })
    const mesh = new THREE.Mesh(mergedBuildings, mat)
    mesh.castShadow = true
    mesh.receiveShadow = true
    group.add(mesh)
  }

  const mergedRoofs = mergeGeometries(roofGeoms)
  if (mergedRoofs) {
    const mat = new THREE.MeshStandardMaterial({
      color: 0x1a2130,
      roughness: 0.85,
    })
    const mesh = new THREE.Mesh(mergedRoofs, mat)
    mesh.castShadow = true
    group.add(mesh)
  }

  const mergedWindows = mergeGeometries(winGeoms)
  if (mergedWindows) {
    const mat = new THREE.MeshBasicMaterial({ color: WINDOW_COLOR })
    const mesh = new THREE.Mesh(mergedWindows, mat)
    group.add(mesh)
  }

  // ---------- Ko'cha chiziqlari ----------
  const lineMat = new THREE.MeshBasicMaterial({ color: 0xd8e0ea })
  const dashGeoms: THREE.BufferGeometry[] = []
  for (let i = 0; i < CITY.GRID; i += 2) {
    const cx = (i - (CITY.GRID - 1) / 2) * CITY.CELL
    // Vertikal yo'l chizig'i (X = cx), Z bo'ylab
    for (let z = -CITY.HALF; z < CITY.HALF; z += 6) {
      const g = new THREE.PlaneGeometry(0.4, 3)
      g.rotateX(-Math.PI / 2)
      g.translate(cx, 0.04, z)
      dashGeoms.push(g)
    }
    // Gorizontal yo'l chizig'i (Z = cx), X bo'ylab
    for (let x = -CITY.HALF; x < CITY.HALF; x += 6) {
      const g = new THREE.PlaneGeometry(3, 0.4)
      g.rotateX(-Math.PI / 2)
      g.translate(x, 0.04, cx)
      dashGeoms.push(g)
    }
  }
  const mergedDash = mergeGeometries(dashGeoms)
  if (mergedDash) {
    group.add(new THREE.Mesh(mergedDash, lineMat))
  }

  const roadLines: number[] = []
  for (let i = 0; i < CITY.GRID; i += 2) {
    roadLines.push((i - (CITY.GRID - 1) / 2) * CITY.CELL)
  }

  return { group, obstacles, roadLines }
}

/** Bir nechta BoxGeometry ni bitta geometriyaga birlashtiradi (position + color). */
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
      if (col) {
        colors.push(col.getX(i), col.getY(i), col.getZ(i))
      } else {
        colors.push(1, 1, 1)
      }
    }
    const idx = geo.index
    if (idx) {
      for (let i = 0; i < idx.count; i++) indices.push(idx.getX(i) + offset)
    } else {
      for (let i = 0; i < pos.count; i++) indices.push(i + offset)
    }
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
