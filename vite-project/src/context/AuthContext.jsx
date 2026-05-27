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

  const login = async ({ email, password, acceptTerms }) => {
    try {
      const data = await authApi.login({ email, password, acceptTerms: Boolean(acceptTerms) })
      persist({ user: data.user, token: data.token })
      return { ok: true, user: data.user }
    } catch (e) {
      return { ok: false, message: e.message }
    }
  }

  const register = async ({ name, email, password, role, profileFile, licenseFile, acceptTerms }) => {
    try {
      const formData = new FormData()
      formData.append('name', name)
      formData.append('email', email)
      formData.append('password', password)
      formData.append('role', role)
      formData.append('acceptTerms', acceptTerms ? 'true' : 'false')
      if (profileFile) formData.append('profileImage', profileFile)
      if (licenseFile) formData.append('licenseImage', licenseFile)
      const data = await authApi.register(formData)
      persist({ user: data.user, token: data.token })
      return { ok: true, user: data.user }
    } catch (e) {
      return { ok: false, message: e.message }
    }
  }

  const updateProfile = async ({ name, profileFile, location, locationLat, locationLng, accountNumber }) => {
    try {
      if (!session?.token) return { ok: false, message: 'Please login again.' }
      const formData = new FormData()
      formData.append('name', name)
      if (location != null) formData.append('location', location)
      if (locationLat != null) formData.append('locationLat', String(locationLat))
      if (locationLng != null) formData.append('locationLng', String(locationLng))
      if (accountNumber != null) formData.append('accountNumber', accountNumber)
      if (profileFile) formData.append('profileImage', profileFile)
      const data = await authApi.updateProfile(formData, session.token)
      persist({ ...session, user: data.user })
      return { ok: true, user: data.user }
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

  const updatePharmacyLicense = async (licenseFile) => {
    try {
      if (!session?.token) return { ok: false, message: 'Please login again.' }
      const formData = new FormData()
      formData.append('licenseImage', licenseFile)
      const data = await authApi.updatePharmacyLicense(formData, session.token)
      persist({ ...session, user: data.user })
      return { ok: true, message: data.message }
    } catch (e) {
      return { ok: false, message: e.message }
    }
  }

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
    updatePharmacyLicense,
    logout,
  }), [session, authLoading, logout])

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export const useAuth = () => useContext(AuthContext)
