import { useCallback, useEffect, useRef, useState } from 'react'

export interface TouchInput {
  throttle: number
  steer: number
}

interface TouchControlsProps {
  onChange: (input: TouchInput) => void
}

type Btn = 'gas' | 'reverse' | 'left' | 'right'

const LABELS: Record<Btn, string> = {
  gas: 'GAS',
  reverse: 'REV',
  left: '◀',
  right: '▶',
}

const COLORS: Record<Btn, string> = {
  gas: 'bg-emerald-500/80 border-emerald-300/70 active:bg-emerald-400',
  reverse: 'bg-rose-500/80 border-rose-300/70 active:bg-rose-400',
  left: 'bg-slate-500/70 border-slate-300/60 active:bg-slate-400',
  right: 'bg-slate-500/70 border-slate-300/60 active:bg-slate-400',
}

/**
 * Mobil uchun ekrandagi tugmalar: Gas, Reverse, Left, Right.
 * Ko'rsatish/yashirish `visible` orqali boshqariladi.
 */
export default function TouchControls({ onChange }: TouchControlsProps) {
  const [pressed, setPressed] = useState<Record<Btn, boolean>>({
    gas: false,
    reverse: false,
    left: false,
    right: false,
  })
  const pressedRef = useRef(pressed)
  pressedRef.current = pressed

  const emit = useCallback(() => {
    const p = pressedRef.current
    const throttle = (p.gas ? 1 : 0) + (p.reverse ? -1 : 0)
    const steer = (p.right ? 1 : 0) + (p.left ? -1 : 0)
    onChange({ throttle, steer })
  }, [onChange])

  const set = (btn: Btn, down: boolean) => {
    setPressed((prev) => {
      if (prev[btn] === down) return prev
      const next = { ...prev, [btn]: down }
      pressedRef.current = next
      return next
    })
    // setState async — darhol xabar beramiz
    queueMicrotask(emit)
  }

  // Sahna o'zgarganda tugmalar bosilgan holatda qolmasin
  useEffect(() => {
    const reset = () => {
      setPressed({ gas: false, reverse: false, left: false, right: false })
      onChange({ throttle: 0, steer: 0 })
    }
    window.addEventListener('blur', reset)
    return () => window.removeEventListener('blur', reset)
  }, [onChange])

  const bind = (btn: Btn) => ({
    onPointerDown: (e: React.PointerEvent) => {
      e.preventDefault()
      ;(e.target as HTMLElement).setPointerCapture?.(e.pointerId)
      set(btn, true)
    },
    onPointerUp: (e: React.PointerEvent) => {
      e.preventDefault()
      set(btn, false)
    },
    onPointerCancel: () => set(btn, false),
    onPointerLeave: () => set(btn, false),
    onContextMenu: (e: React.MouseEvent) => e.preventDefault(),
  })

  const btnBase =
    'flex items-center justify-center rounded-2xl border-2 text-white font-bold backdrop-blur-md select-none touch-none transition-transform active:scale-95'

  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-0 z-20 flex items-end justify-between p-3 pb-6 sm:p-6">
      {/* Chap tomon — burilish */}
      <div className="pointer-events-auto flex gap-3">
        <button
          {...bind('left')}
          aria-label="Left"
          className={`${btnBase} ${COLORS.left} h-20 w-20 text-2xl shadow-lg sm:h-24 sm:w-24`}
        >
          {LABELS.left}
        </button>
        <button
          {...bind('right')}
          aria-label="Right"
          className={`${btnBase} ${COLORS.right} h-20 w-20 text-2xl shadow-lg sm:h-24 sm:w-24`}
        >
          {LABELS.right}
        </button>
      </div>

      {/* O'ng tomon — gaz / teskari */}
      <div className="pointer-events-auto flex gap-3">
        <button
          {...bind('reverse')}
          aria-label="Reverse"
          className={`${btnBase} ${COLORS.reverse} h-16 w-16 text-sm shadow-lg sm:h-20 sm:w-20`}
        >
          {LABELS.reverse}
        </button>
        <button
          {...bind('gas')}
          aria-label="Gas"
          className={`${btnBase} ${COLORS.gas} h-20 w-20 text-base shadow-lg sm:h-24 sm:w-24`}
        >
          {LABELS.gas}
        </button>
      </div>
    </div>
  )
}
