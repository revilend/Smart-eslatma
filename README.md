# City Cab — 3D Driving Game

Three.js bilan qurilgan brauzerli 3D shahar haydash o'yini. Loyiha Vite + React + TypeScript + Tailwind stack'ida.

## O'yin nima qiladi

- **Ulkan jonli shahar** — 45×45 blokli (~1.71 km) prospektalar, 2700+ bino, ko'cha chiroqlari, daraxtlar, bench'lar va to'xtagan mashinalar. Ufqda tuman effekti.
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
│   ├── city.ts         # shahar generatsiyasi, bino/prop geometriyasi
│   ├── traffic.ts      # AI mashinalar (ko'chada haydaydi, buriladi)
│   └── pedestrians.ts  # piyodalar (InstancedMesh, trotuarda yuradi)
├── components/
│   ├── Speedometer.tsx   # SVG tezlik o'lchagich
│   ├── TouchControls.tsx # mobil tugmalar
│   └── Minimap.tsx       # aylanma radar (yo'llar, marker, AI mashinalar)
├── App.tsx             # canvas + HUD + minimapa + boshqaruv
└── index.css           # Tailwind + shrift
```

Xotira va samaradorlik uchun binolar, tomlar, deraza lentalari, trotuarlar, ko'cha chiziqlari va barcha prop'lar `mergeGeometries` yordamida **chunk** (6×6 blok) bo'yicha birlashtiriladi. Shu tarzda:

- bir katta mesh o'rniga ~705 ta kichik mesh — **frustum culling ishlaydi**, ko'rinmaydigan qismlar render qilinmaydi;
- to'qnashuv **uniform grid** indeksi orqali tekshiriladi — 3147 obyekt bo'lganda ham kadrda ~14 ta yaqin obyekt ko'riladi;
- quyosh nishoni mashinani kuzatadi, shuning uchun soya karta chekka qismida ham aniq qoladi;
- `spawnPoint()` shahar generatsiyasi va dvigatel uchun yagona manba — prop'lar hech qachon spawn ustiga tushmaydi;
- piyodalar va AI mashinalar o'z **chiziqlariga bog'langan**: AI `ROAD/2 - 3.3` masofada (to'xtagan mashinalardan xavfsiz), piyodalar esa 8–10 m dagi trotuar lentasida — shuning uchun hech qanday ob'yekt ichida qolmaydi.