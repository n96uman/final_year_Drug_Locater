import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { authApi } from '../api/client'

const AuthContext = createContext(null)

function readSession() {
  try {
    return JSON.parse(localStorage.getItem('dl_session'))
  } catch {
    return null
  }
}

export function AuthProvider({ children }) {
  const [session, setSession] = useState(readSession)
  const [authLoading, setAuthLoading] = useState(Boolean(readSession()?.token))

  const persist = (next) => {
    setSession(next)
    localStorage.setItem('dl_session', JSON.stringify(next))
  }

  const login = async ({ email, password }) => {
    try {
      const data = await authApi.login({ email, password })
      persist({ user: data.user, token: data.token })
      return { ok: true, user: data.user }
    } catch (e) {
      return { ok: false, message: e.message }
    }
  }

  const register = async ({ name, email, password, role, profileFile, licenseFile }) => {
    try {
      const formData = new FormData()
      formData.append('name', name)
      formData.append('email', email)
      formData.append('password', password)
      formData.append('role', role)
      if (profileFile) formData.append('profileImage', profileFile)
      if (licenseFile) formData.append('licenseImage', licenseFile)
      const data = await authApi.register(formData)
      persist({ user: data.user, token: data.token })
      return { ok: true, user: data.user }
    } catch (e) {
      return { ok: false, message: e.message }
    }
  }

  const updateProfile = async ({ name, profileFile }) => {
    try {
      if (!session?.token) return { ok: false, message: 'Please login again.' }
      const formData = new FormData()
      formData.append('name', name)
      if (profileFile) formData.append('profileImage', profileFile)
      const data = await authApi.updateProfile(formData, session.token)
      persist({ ...session, user: data.user })
      return { ok: true }
    } catch (e) {
      return { ok: false, message: e.message }
    }
  }

  const logout = useCallback(async () => {
    const tok = session?.token
    const user = session?.user
    if (tok && user?.role === 'pharmacy' && user?.pharmacyApprovalStatus === 'pending') {
      try {
        await authApi.abandonPendingPharmacy(tok)
      } catch {
        /* still clear local session */
      }
    }
    setSession(null)
    localStorage.removeItem('dl_session')
  }, [session])

  const refreshProfile = async () => {
    if (!session?.token) return { ok: false, message: 'No active session' }
    try {
      const data = await authApi.me(session.token)
      const nextSession = { ...session, user: data.user }
      persist(nextSession)
      return { ok: true, user: data.user }
    } catch (e) {
      return { ok: false, message: e.message }
    }
  }

  useEffect(() => {
    let active = true
    const hydrate = async () => {
      if (!session?.token) {
        setAuthLoading(false)
        return
      }
      try {
        const data = await authApi.me(session.token)
        if (!active) return
        const nextSession = { ...session, user: data.user }
        setSession(nextSession)
        localStorage.setItem('dl_session', JSON.stringify(nextSession))
      } catch {
        if (!active) return
        setSession(null)
        localStorage.removeItem('dl_session')
      } finally {
        if (active) setAuthLoading(false)
      }
    }
    hydrate()
    return () => { active = false }
  }, [])

  const value = useMemo(() => ({
    currentUser: session?.user || null,
    token: session?.token || null,
    authLoading,
    login,
    register,
    refreshProfile,
    updateProfile,
    logout,
  }), [session, authLoading, logout])

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export const useAuth = () => useContext(AuthContext)
