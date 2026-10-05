import { useEffect, useRef } from 'react'

export interface MinimapState {
  playerX: number
  playerZ: number
  heading: number
  markerX: number
  markerZ: number
  markerActive: boolean
  traffic: { x: number; z: number }[]
  roads: number[]
  half: number
}

interface MinimapProps {
  /** O'yin muhiti har kadrda to'ldiradi. */
  stateRef: React.MutableRefObject<MinimapState | null>
  size?: number
}

/**
 * GTA uslubidagi aylanma radar (minimapa).
 * O'yinchi markazda, yo'llar va boshqa mashinalar atrofida chiziladi.
 */
export default function Minimap({ stateRef, size = 150 }: MinimapProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    canvas.width = size * dpr
    canvas.height = size * dpr
    ctx.scale(dpr, dpr)

    const cx = size / 2
    const cy = size / 2
    // Ko'rsatiladigan radius (dunyo birligi)
    const VIEW = 130
    const scale = (size / 2) / VIEW

    let raf = 0
    const draw = () => {
      raf = requestAnimationFrame(draw)
      const s = stateRef.current
      if (!s) return

      ctx.clearRect(0, 0, size, size)

      // --- Doira foni ---
      ctx.save()
      ctx.beginPath()
      ctx.arc(cx, cy, size / 2 - 1, 0, Math.PI * 2)
      ctx.clip()
      ctx.fillStyle = 'rgba(12, 18, 32, 0.82)'
      ctx.fillRect(0, 0, size, size)

      // O'yinchi atrofini aylantiramiz — har doim yuqoriga qaragan
      ctx.translate(cx, cy)
      ctx.rotate(s.heading)
      ctx.translate(-s.playerX * scale, -s.playerZ * scale)
      ctx.scale(1, -1) // world Z o'qi pastga qaragan

      // --- Yo'llar ---
      ctx.strokeStyle = '#4a5a78'
      ctx.lineWidth = Math.max(3, CITY_ROAD * scale)
      ctx.beginPath()
      for (const r of s.roads) {
        ctx.moveTo(r * scale, -s.half * scale)
        ctx.lineTo(r * scale, s.half * scale)
        ctx.moveTo(-s.half * scale, r * scale)
        ctx.lineTo(s.half * scale, r * scale)
      }
      ctx.stroke()

      // --- Marker ---
      if (s.markerActive) {
        ctx.fillStyle = '#2ee65a'
        ctx.beginPath()
        ctx.arc(s.markerX * scale, s.markerZ * scale, 4.5, 0, Math.PI * 2)
        ctx.fill()
      }

      // --- AI mashinalar ---
      ctx.fillStyle = '#ff8a4f'
      for (const t of s.traffic) {
        ctx.beginPath()
        ctx.arc(t.x * scale, t.z * scale, 2.6, 0, Math.PI * 2)
        ctx.fill()
      }

      ctx.restore()

      // --- Doira ramkasi ---
      ctx.strokeStyle = 'rgba(255,255,255,0.35)'
      ctx.lineWidth = 2
      ctx.beginPath()
      ctx.arc(cx, cy, size / 2 - 1, 0, Math.PI * 2)
      ctx.stroke()

      // --- O'yinchi strelkasi (markazda, har doim) ---
      ctx.fillStyle = '#ffffff'
      ctx.strokeStyle = '#0b1020'
      ctx.lineWidth = 1.5
      ctx.beginPath()
      ctx.moveTo(cx, cy - 7)
      ctx.lineTo(cx + 5, cy + 6)
      ctx.lineTo(cx, cy + 3)
      ctx.lineTo(cx - 5, cy + 6)
      ctx.closePath()
      ctx.fill()
      ctx.stroke()
    }
    draw()

    return () => cancelAnimationFrame(raf)
  }, [stateRef, size])

  return (
    <canvas
      ref={canvasRef}
      style={{ width: size, height: size }}
      className="rounded-full shadow-lg drop-shadow-[0_2px_8px_rgba(0,0,0,0.6)]"
    />
  )
}

/** Ko'cha kengligi (chizilgan chiziqning qalinligi uchun). */
const CITY_ROAD = 12