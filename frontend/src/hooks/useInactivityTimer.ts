import { useEffect, useRef, useCallback, useState } from 'react'

const EVENTS = ['mousemove', 'mousedown', 'keydown', 'touchstart', 'scroll', 'click']
const WARNING_BEFORE = 60  // secondes avant déconnexion

export interface InactivityState {
  warning: boolean
  countdown: number
  extend: () => void
}

export function useInactivityTimer(
  timeoutSeconds: number,
  onLogout: () => void,
): InactivityState {
  const [warning,   setWarning]   = useState(false)
  const [countdown, setCountdown] = useState(WARNING_BEFORE)

  // Refs pour éviter les stale closures dans les event listeners
  const timeoutRef  = useRef(timeoutSeconds)
  const onLogoutRef = useRef(onLogout)
  const warningRef  = useRef(false)
  useEffect(() => { timeoutRef.current  = timeoutSeconds }, [timeoutSeconds])
  useEffect(() => { onLogoutRef.current = onLogout },       [onLogout])

  const logoutTimerId  = useRef<ReturnType<typeof setTimeout>  | null>(null)
  const warningTimerId = useRef<ReturnType<typeof setTimeout>  | null>(null)
  const countdownIntId = useRef<ReturnType<typeof setInterval> | null>(null)

  const clearAll = useCallback(() => {
    if (logoutTimerId.current)  { clearTimeout(logoutTimerId.current);   logoutTimerId.current  = null }
    if (warningTimerId.current) { clearTimeout(warningTimerId.current);  warningTimerId.current = null }
    if (countdownIntId.current) { clearInterval(countdownIntId.current); countdownIntId.current = null }
  }, [])

  const startTimers = useCallback(() => {
    const secs = timeoutRef.current
    if (!secs) return

    clearAll()
    setWarning(false)
    setCountdown(WARNING_BEFORE)
    warningRef.current = false

    const warningAt = (secs - WARNING_BEFORE) * 1000

    // Avertissement seulement si timeout > WARNING_BEFORE
    if (warningAt > 0) {
      warningTimerId.current = setTimeout(() => {
        setWarning(true)
        warningRef.current = true
        setCountdown(WARNING_BEFORE)
        countdownIntId.current = setInterval(() => {
          setCountdown(c => {
            if (c <= 1) {
              if (countdownIntId.current) clearInterval(countdownIntId.current)
              return 0
            }
            return c - 1
          })
        }, 1000)
      }, warningAt)
    }

    // Timer de déconnexion
    logoutTimerId.current = setTimeout(() => {
      clearAll()
      setWarning(false)
      warningRef.current = false
      onLogoutRef.current()
    }, secs * 1000)
  }, [clearAll])

  // L'utilisateur clique "Je suis encore là"
  const extend = useCallback(() => {
    startTimers()
  }, [startTimers])

  // Enregistrement des événements d'activité
  useEffect(() => {
    if (!timeoutSeconds) {
      clearAll()
      setWarning(false)
      warningRef.current = false
      return
    }

    startTimers()

    const handleActivity = () => {
      // Si la modal d'avertissement est visible, ne pas reset — l'user doit cliquer "Je suis là"
      if (!warningRef.current) startTimers()
    }

    EVENTS.forEach(ev => window.addEventListener(ev, handleActivity, { passive: true }))
    return () => {
      EVENTS.forEach(ev => window.removeEventListener(ev, handleActivity))
      clearAll()
    }
  }, [timeoutSeconds, startTimers, clearAll])  // warning PAS dans les deps

  return { warning, countdown, extend }
}
