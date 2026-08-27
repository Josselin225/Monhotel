import { useState, useEffect } from 'react'

type Theme = 'light' | 'dark'

export function useTheme() {
  const [theme, setTheme] = useState<Theme>(() => {
    const saved = localStorage.getItem('theme') as Theme | null
    if (saved) return saved
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
  })

  useEffect(() => {
    const root = document.documentElement
    if (theme === 'dark') {
      root.classList.add('dark')
    } else {
      root.classList.remove('dark')
    }
    localStorage.setItem('theme', theme)
  }, [theme])

  // Impression toujours sur fond clair, même en mode sombre : le mode sombre
  // est retiré juste pour la durée de l'impression puis restauré ensuite.
  // Sécurité supplémentaire sur `focus` : si `afterprint` ne se déclenche pas
  // de façon fiable partout (aperçu PDF, certains navigateurs), le retour au
  // premier plan après la boîte de dialogue d'impression resynchronise l'état.
  useEffect(() => {
    const root = document.documentElement
    const resync = () => {
      if (theme === 'dark') root.classList.add('dark')
      else root.classList.remove('dark')
    }
    const handleBeforePrint = () => root.classList.remove('dark')
    window.addEventListener('beforeprint', handleBeforePrint)
    window.addEventListener('afterprint', resync)
    window.addEventListener('focus', resync)
    return () => {
      window.removeEventListener('beforeprint', handleBeforePrint)
      window.removeEventListener('afterprint', resync)
      window.removeEventListener('focus', resync)
    }
  }, [theme])

  const toggle = () => setTheme(t => t === 'dark' ? 'light' : 'dark')

  return { theme, toggle }
}
