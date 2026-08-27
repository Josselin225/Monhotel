import { useState, useEffect } from 'react'
import { useAuth } from '../context/AuthContext'
import { loadSettings, Settings } from '../pages/SettingsPage'

export function useAppSettings(): Settings {
  const { user } = useAuth()
  const [settings, setSettings] = useState<Settings>(
    () => loadSettings(user?.username ?? 'guest')
  )
  useEffect(() => {
    const handler = (e: Event) => setSettings((e as CustomEvent<Settings>).detail)
    window.addEventListener('mh-settings-changed', handler)
    return () => window.removeEventListener('mh-settings-changed', handler)
  }, [])
  return settings
}
