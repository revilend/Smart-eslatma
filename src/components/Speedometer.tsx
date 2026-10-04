interface SpeedometerProps {
  /** km/h */
  speed: number
  max: number
}

/** SVG yoy bo'ylab chiziladigan tezlik o'lchagich. */
export default function Speedometer({ speed, max }: SpeedometerProps) {
  const radius = 88
  const circumference = 2 * Math.PI * radius
  // 270° yoy (75% aylanma)
  const arc = circumference * 0.75
  const pct = Math.min(1, speed / max)
  const dash = arc * pct

  return (
    <div className="pointer-events-none select-none">
      <svg width="150" height="150" viewBox="0 0 210 210" className="drop-shadow-lg">
        {/* Orqa track */}
        <circle
          cx="105"
          cy="105"
          r={radius}
          fill="none"
          stroke="rgba(0,0,0,0.35)"
          strokeWidth="14"
          strokeDasharray={`${arc} ${circumference}`}
          strokeLinecap="round"
          transform="rotate(135 105 105)"
        />
        {/* To'ldirilgan qism — gradient boricha */}
        <defs>
          <linearGradient id="speedGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#39d353" />
            <stop offset="55%" stopColor="#ffd23f" />
            <stop offset="100%" stopColor="#ff3b3b" />
          </linearGradient>
        </defs>
        <circle
          cx="105"
          cy="105"
          r={radius}
          fill="none"
          stroke="url(#speedGrad)"
          strokeWidth="14"
          strokeDasharray={`${dash} ${circumference}`}
          strokeLinecap="round"
          transform="rotate(135 105 105)"
          style={{ transition: 'stroke-dasharray 80ms linear' }}
        />
        {/* Markazdagi qiymat */}
        <text
          x="105"
          y="100"
          textAnchor="middle"
          fill="#fff"
          fontSize="46"
          fontWeight="700"
          className="tabular"
        >
          {Math.round(speed)}
        </text>
        <text
          x="105"
          y="128"
          textAnchor="middle"
          fill="rgba(255,255,255,0.65)"
          fontSize="19"
          fontWeight="600"
        >
          km/h
        </text>
      </svg>
    </div>
  )
}
