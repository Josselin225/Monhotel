import { useState, useEffect } from 'react'
import { useAuth } from '../context/AuthContext'
import { loadSettings, Settings } from '../pages/SettingsPage'

function AnalogClock({ h, m, s }: { h: number; m: number; s: number }) {
  const hourDeg   = (h % 12) * 30 + m * 0.5
  const minuteDeg = m * 6 + s * 0.1
  const secondDeg = s * 6

  const hand = (deg: number, len: number, width: number, color: string) => {
    const rad = ((deg - 90) * Math.PI) / 180
    const x   = 16 + len * Math.cos(rad)
    const y   = 16 + len * Math.sin(rad)
    return (
      <line x1="16" y1="16" x2={x} y2={y}
        stroke={color} strokeWidth={width} strokeLinecap="round" />
    )
  }

  const ticks = Array.from({ length: 12 }, (_, i) => {
    const rad = ((i * 30 - 90) * Math.PI) / 180
    const r1  = 13.5
    const r2  = i % 3 === 0 ? 11 : 12.5
    return (
      <line key={i}
        x1={16 + r1 * Math.cos(rad)} y1={16 + r1 * Math.sin(rad)}
        x2={16 + r2 * Math.cos(rad)} y2={16 + r2 * Math.sin(rad)}
        stroke="currentColor" strokeWidth={i % 3 === 0 ? 1.5 : 0.8} strokeLinecap="round"
      />
    )
  })

  return (
    <svg width="32" height="32" viewBox="0 0 32 32"
      className="text-gray-400 dark:text-gray-500 shrink-0"
    >
      {/* Cadran */}
      <circle cx="16" cy="16" r="14.5" fill="none" stroke="currentColor" strokeWidth="1" />
      {ticks}
      {/* Aiguilles */}
      {hand(hourDeg,   7,   2,   'var(--tw-color, #374151)')}
      {hand(minuteDeg, 10,  1.5, 'var(--tw-color, #374151)')}
      {hand(secondDeg, 11,  0.8, '#f59e0b')}
      {/* Centre */}
      <circle cx="16" cy="16" r="1.5" fill="#f59e0b" />
    </svg>
  )
}

export default function ClockWidget() {
  const { user } = useAuth()
  const [now, setNow] = useState(() => new Date())
  const [clockFormat, setClockFormat] = useState<Settings['clockFormat']>(
    () => loadSettings(user?.username ?? 'guest').clockFormat
  )

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(id)
  }, [])

  useEffect(() => {
    const handler = (e: Event) =>
      setClockFormat((e as CustomEvent<Settings>).detail.clockFormat)
    window.addEventListener('mh-settings-changed', handler)
    return () => window.removeEventListener('mh-settings-changed', handler)
  }, [])

  const rawH = now.getHours()
  const m    = now.getMinutes()
  const s    = now.getSeconds()

  const is12 = clockFormat === '12h'
  const h    = is12 ? (rawH % 12 || 12) : rawH
  const hh   = String(h).padStart(2, '0')
  const mm   = String(m).padStart(2, '0')
  const ss   = String(s).padStart(2, '0')
  const ampm = is12 ? (rawH < 12 ? 'AM' : 'PM') : null

  return (
    <div className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-gray-50 dark:bg-gray-800 border border-gray-100 dark:border-gray-700 select-none">
      {/* Analogique */}
      <AnalogClock h={rawH} m={m} s={s} />

      {/* Numérique */}
      <div className="hidden sm:flex flex-col items-start leading-none">
        <span className="text-[13px] font-mono font-semibold text-gray-700 dark:text-gray-200 tracking-tight">
          {hh}:{mm}
          <span className="text-hotel-gold">:{ss}</span>
          {ampm && <span className="text-[10px] text-gray-400 ml-1">{ampm}</span>}
        </span>
        <span className="text-[9px] text-gray-400 dark:text-gray-500 tracking-wide uppercase mt-0.5">
          {now.toLocaleDateString('fr-FR', { weekday: 'short', day: '2-digit', month: 'short' })}
        </span>
      </div>
    </div>
  )
}
