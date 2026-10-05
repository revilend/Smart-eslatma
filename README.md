# City Cab — 3D Driving Game

Three.js bilan qurilgan brauzerli 3D shahar haydash o'yini. Loyiha Vite + React + TypeScript + Tailwind stack'ida.

## O'yin nima qiladi

- **Katta karta** — 31×31 blokli (~1.18 km²) prospektalar, avtomatik generatsiya qilinuvchi 1200+ bino, trotuarlar va ko'cha chiziqlari. Ufqda tuman (fog) effekti.
- **Chase kamera** — avtomobil ortidan kuzatib boradi; tezlik oshgan sayin orqada qoladi, banking (mashina yo'lga yonma egiladi).
- **Arcade fizika** — gaz, tormoz, teskari, tezlikka bog'liq burilish, binolarga urilishda tezlikni yo'qotish va qisqa qarshilik. To'qnashuv uniform grid orqali tekshiriladi, shuning uchun 1200+ bina bo'lganda ham har kadr tez.
- **Yashil marker (pickup)** — aylanuvchi neon konus. Uni topib yetib boring: har bir yetkazilma +$25.
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
│   └── city.ts         # shahar generatsiyasi, bino va ko'cha geometriyasi
├── components/
│   ├── Speedometer.tsx # SVG tezlik o'lchagich
│   └── TouchControls.tsx  # mobil tugmalar
├── App.tsx             # canvas + HUD + boshqaruv
└── index.css           # Tailwind + shrift
```

Xotira va samaradorlik uchun binolar, tomlar, deraza lentalari, trotuarlar va ko'cha chiziqlari `mergeGeometries` yordamida **chunk** (4×4 blok) bo'yicha birlashtiriladi. Shu tarzda:

- bir katta mesh o'rniga ~321 ta kichik mesh — **frustum culling ishlaydi**, ko'rinmaydigan qismlar render qilinmaydi;
- to'qnashuv **uniform grid** indeksi orqali tekshiriladi — kadrda 1266 bina o'rniga o'rtacha ~12 ta yaqin bina ko'rib chiqiladi;
- quyosh nishoni mashinani kuzatadi, shuning uchun soya karta chekka qismida ham aniq qoladi.