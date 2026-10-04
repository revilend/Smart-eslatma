# City Cab — 3D Driving Game

Three.js bilan qurilgan brauzerli 3D shahar haydash o'yini. Loyiha Vite + React + TypeScript + Tailwind stack'ida.

## O'yin nima qiladi

- **Tuzilgan shahar** — 11×11 blokli prospektalar, avtomatik generatsiya qilinuvchi binolar, trotuarlar va ko'cha chiziqlari. Ufqda tuman (fog) effekti.
- **Chase kamera** — avtomobil ortidan kuzatib boradi; tezlik oshgan sayin orqada qoladi, banking (mashina yo'lga yonma egiladi).
- **Arcade fizika** — gaz, tormoz, teskari, tezlikka bog'liq burilish, binolarga urilishda tezlikni yo'qotish va qisqa qarshilik.
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

Xotira va samaradorlik uchun binolar, tomlar, deraza lentalari va ko'cha chiziqlari `mergeGeometries` yordamida bitta geometriyaga birlashtiriladi — shuning uchun shaharda minglab obyekt bo'lsa ham render tez ishlaydi.