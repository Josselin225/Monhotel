import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react'
import { User } from '../types'
import { authApi } from '../api/auth'

interface AuthContextType {
  user: User | null
  loading: boolean
  login: (username: string, password: string, otp_code?: string, backup_code?: string) => Promise<{ twoFactorRequired: boolean }>
  logout: () => Promise<void>
  refreshUser: () => Promise<void>
  setUser: (u: User) => void
}

const AuthContext = createContext<AuthContextType | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Vérifie si un cookie de session valide existe en appelant /me/
    // Si oui, retourne les données utilisateur ; si non, retourne 401
    authApi.me()
      .then(setUser)
      .catch(() => {/* Cookie absent ou expiré — utilisateur non connecté */})
      .finally(() => setLoading(false))
  }, [])

  const login = async (username: string, password: string, otp_code?: string, backup_code?: string) => {
    const result = await authApi.login(username, password, otp_code, backup_code)
    if (result.two_factor_required) return { twoFactorRequired: true }
    setUser(result.user!)
    return { twoFactorRequired: false }
  }

  const logout = async () => {
    try {
      await authApi.logout()
    } finally {
      setUser(null)
    }
  }

  const refreshUser = async () => {
    const me = await authApi.me()
    setUser(me)
  }

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, refreshUser, setUser }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
