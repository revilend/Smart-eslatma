# City Cab — 3D Driving Game

Three.js bilan qurilgan brauzerli 3D shahar haydash o'yini. Loyiha Vite + React + TypeScript + Tailwind stack'ida.

## O'yin nima qiladi

- **Katta orol** — 55×55 blokli (~2.1 km) shahar, 3800+ bino, ko'chalar, chiroqlar, daraxtlar va to'xtagan mashinalar.
- **Tabiat** — shahar atrofida **plyaj** (qum), undan keyin **dengiz** (juda sekin to'lqin animatsiyasi bilan), ufqda **qorli tog'lar**. Markazda shahar ichida **bog'lar** — binolar o'rniga ko'kalamdor maydon, daraxtlar va yo'llar.
- **AI haydovchilar** — 18 ta mashina ko'cha tarmog'i bo'ylab mustaqil haydaydi: chorrahadan buriladi, oldingi mashina yoki to'sqinlikni ko'rganda sekinlashadi. O'yinchi ularga urilsa, tezlikni yo'qotadi.
- **Piyodalar** — 60 ta odam tro-tuarda yuradi va mashina yaqinlashsa qochadi. `InstancedMesh` bilan chiziladi, shuning uchun bitta mesh hisoblanadi.
- **Minimap (radar)** — yuqori o'ng burchakda aylanma xarita: yo'llar, yashil marker, qizil AI mashinalar va markazda o'q o'qi (GTA uslubidagi radar).
- **Chase kamera** — avtomobil ortidan kuzatib boradi; tezlik oshgan sayin orqada qoladi, banking (mashina yo'lga yonma egiladi).
- **Arcade fizika** — gaz, tormoz, teskari, tezlikka bog'liq burilish, binolarga va mashinalarga urilishda tezlikni yo'qotish va qisqa qarshilik. To'qnashuv uniform grid orqali tekshiriladi: 3100+ obyekt bo'lganda ham kadrda faqat ~14 ta yaqin obyekt ko'rib chiqiladi.
- **Yashil marker (pickup)** — aylanuvchi neon konus. Uni topib yetib boring: har bir yetkazilma +$25. Marker doim ko'cha markazida va hech qachon bino yoki mashina ustiga tushmaydi (`isBlocked()` bilan tekshiriladi).
- **Tezlik o'lchagich** — SVG yoy, gradient rang (yashil → sariq → qizil) va real vaqtda km/h.
- **Mobil tugmalar** — ekranda GAS, REV, ◀, ▶ tugmalari; barmoq bilan bosib turib haydash mumkin.

## Boshqaruv

| Harakat | Klaviatura | Mobil |
| --- | --- | --- |
| Oldinga gaz | `W` / `↑` | **GAS** tugmasi |
| Orqaga / tormoz | `S` / `↓` | **REV** tugmasi |
| Chapga burilish | `A` / `←` | **◀** tugmasi |
| O'ngga burilish | `D` / `→` | **▶** tugmasi |
| Tormoz | `Space` | — |
| Ovozni o'chirish | `M` | 🔊 tugmasi |

## Ishga tushirish

```bash
bun install     # bog'liqliklar
bun run dev     # lokal server (0.0.0.0:5173)
bun run build   # production build -> dist/
bun run typecheck
```

## Tuzilma

```
src/
├── game/
│   ├── GameEngine.ts   # sahna, kamera, render loop, marker, HUD holati
│   ├── car.ts          # avtomobil modeli + arcade fizikasi + to'qnashuv
│   ├── city.ts         # shahar generatsiyasi, bino/prop/bog' geometriyasi
│   ├── terrain.ts      # plyaj, dengiz, tog'lar va bog'lar
│   ├── traffic.ts      # AI mashinalar (ko'chada haydaydi, buriladi)
│   └── pedestrians.ts  # piyodalar (InstancedMesh, trotuarda yuradi)
├── components/
│   ├── Speedometer.tsx   # SVG tezlik o'lchagich
│   ├── TouchControls.tsx # mobil tugmalar
│   └── Minimap.tsx       # aylanma radar (yo'llar, marker, AI mashinalar)
├── App.tsx             # canvas + HUD + minimapa + boshqaruv
└── index.css           # Tailwind + shrift
```

Xotira va samaradorlik uchun binolar, tomlar, deraza lentalari, trotuarlar, ko'chalar va barcha prop'lar `mergeGeometries` yordamida **chunk** (6×6 blok) bo'yicha birlashtiriladi. Shu tarzda:

- bir katta mesh o'rniga ~1100 ta kichik mesh — **frustum culling ishlaydi**, ko'rinmaydigan qismlar render qilinmaydi;
- to'qnashuv **uniform grid** indeksi orqali tekshiriladi — 5000+ obyekt bo'lganda ham kadrda faqat ~15 ta yaqin obyekt ko'riladi;
- quyosh nishoni mashinani kuzatadi, shuning uchun soya karta chekka qismida ham aniq qoladi;
- `spawnPoint()` shahar generatsiyasi va dvigatel uchun yagona manba;
- piyodalar va AI mashinalar o'z **chiziqlariga bog'langan** — shuning uchun hech qanday ob'yekt ichida qolmaydi;
- shahar generatsiyasi ~2 s davom etadi, shuning uchun **yuklanish ekrani** ko'rsatiladi.