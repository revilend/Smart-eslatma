import { useCallback, useEffect, useRef, useState } from 'react'
import { GameEngine, type HudState } from './game/GameEngine'
import Speedometer from './components/Speedometer'
import TouchControls, { type TouchInput } from './components/TouchControls'

const MAX_KMH = 125

const INITIAL_HUD: HudState = {
  speed: 0,
  money: 0,
  deliveries: 0,
  markerActive: true,
  markerDistance: 0,
  hitFlash: 0,
  muted: false,
}

/** Tugmalar faqat touch qurilmalarda ko'rsatiladi. */
function useIsTouchDevice() {
  const [isTouch, setIsTouch] = useState(false)
  useEffect(() => {
    const check = () =>
      setIsTouch(window.matchMedia('(pointer: coarse)').matches)
    check()
    window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [])
  return isTouch
}

export default function App() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const engineRef = useRef<GameEngine | null>(null)
  const [hud, setHud] = useState<HudState>(INITIAL_HUD)
  const [showTouch, setShowTouch] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const isTouch = useIsTouchDevice()

  useEffect(() => {
    setShowTouch(isTouch)
  }, [isTouch])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    let engine: GameEngine
    try {
      engine = new GameEngine(canvas, setHud)
    } catch (e) {
      console.error(e)
      setError(
        '3D rendering ishga tushmadi. Brauzeringizda WebGL yoqilganligini tekshiring.',
      )
      return
    }

    engineRef.current = engine
    engine.start()

    return () => {
      engine.destroy()
      engineRef.current = null
    }
  }, [])

  const handleTouch = useCallback((input: TouchInput) => {
    engineRef.current?.setTouchInput(input.throttle, input.steer)
  }, [])

  const toggleMute = useCallback(() => {
    engineRef.current?.toggleMute()
  }, [])

  if (error) {
    return (
      <div className="flex h-full w-full items-center justify-center bg-slate-900 p-8 text-center text-white">
        <p className="text-lg font-semibold">{error}</p>
      </div>
    )
  }

  return (
    <div className="relative h-full w-full overflow-hidden bg-sky-200">
      {/* 3D sahna */}
      <canvas ref={canvasRef} className="absolute inset-0" />

      {/* To'qnashuv qizil chaqnashi */}
      {hud.hitFlash > 0.02 && (
        <div
          className="pointer-events-none absolute inset-0 z-10 bg-red-500 mix-blend-overlay"
          style={{ opacity: Math.min(0.45, hud.hitFlash * 0.45) }}
        />
      )}

      {/* Yuqori chap: tezlik + pul */}
      <div className="pointer-events-none absolute left-0 top-0 z-20 flex items-start gap-4 p-4 sm:p-6">
        <Speedometer speed={hud.speed} max={MAX_KMH} />
        <div className="mt-3 space-y-1">
          <div className="flex items-center gap-2 text-amber-300">
            <span className="text-xl">💰</span>
            <span className="tabular text-3xl font-bold drop-shadow">
              ${hud.money}
            </span>
          </div>
          <div className="text-sm font-semibold text-white/80 drop-shadow">
            Yetkazilgan: {hud.deliveries}
          </div>
        </div>
      </div>

      {/* Yuqori o'ng: vazifa + ovoz */}
      <div className="pointer-events-none absolute right-0 top-0 z-20 flex flex-col items-end gap-3 p-4 sm:p-6">
        <button
          onClick={toggleMute}
          className="pointer-events-auto rounded-xl border border-white/20 bg-black/40 px-3 py-2 text-sm font-bold text-white backdrop-blur-md transition hover:bg-black/60"
          aria-label="Toggle sound"
        >
          {hud.muted ? '🔇 Ovoz' : '🔊 Ovoz'}
        </button>
      </div>

      {/* Pastki markaz: vazifa matni */}
      <div className="pointer-events-none absolute inset-x-0 bottom-32 z-20 px-4 text-center sm:bottom-40">
        <p className="text-xl font-bold text-white drop-shadow-[0_2px_6px_rgba(0,0,0,0.8)] sm:text-2xl">
          {hud.markerActive
            ? 'Yashil markerni top'
            : 'Ajoyib! Yangi buyurtma keldi…'}
        </p>
        {hud.markerActive && (
          <p className="mt-1 text-sm font-semibold text-white/75 drop-shadow">
            Masofa: {Math.round(hud.markerDistance)} m
          </p>
        )}
        <p className="mt-2 hidden text-sm font-semibold text-white/70 drop-shadow sm:block">
          WASD / Strelkalar — haydash · Space — tormoz · M — ovoz
        </p>
        {showTouch && (
          <p className="mt-2 text-sm font-semibold text-white/70 drop-shadow sm:hidden">
            Tugmalardan foydalanib haydang
          </p>
        )}
      </div>

      {/* Mobil tugmalar */}
      {showTouch && <TouchControls onChange={handleTouch} />}
    </div>
  )
}
