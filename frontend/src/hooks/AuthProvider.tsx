import { useCallback, useMemo, useState, type ReactNode } from "react"
import {
  AuthContext,
  TOKEN_KEY,
  USER_KEY,
  type AuthState,
  type AuthUser,
} from "./AuthContext"

function readUser(): AuthUser | null {
  try {
    const raw = localStorage.getItem(USER_KEY)
    return raw ? (JSON.parse(raw) as AuthUser) : null
  } catch {
    return null
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setTokenState] = useState<string | null>(() =>
    localStorage.getItem(TOKEN_KEY)
  )
  const [user, setUser] = useState<AuthUser | null>(readUser)

  const setToken = useCallback((t: string, u: AuthUser) => {
    localStorage.setItem(TOKEN_KEY, t)
    localStorage.setItem(USER_KEY, JSON.stringify(u))
    setTokenState(t)
    setUser(u)
  }, [])

  const updateUser = useCallback((u: AuthUser) => {
    localStorage.setItem(USER_KEY, JSON.stringify(u))
    setUser(u)
  }, [])

  const logout = useCallback(() => {
    localStorage.removeItem(TOKEN_KEY)
    localStorage.removeItem(USER_KEY)
    setTokenState(null)
    setUser(null)
    window.location.href = "/signin"
  }, [])

  const value = useMemo<AuthState>(
    () => ({
      user,
      token,
      isLoading: false,
      isAuthenticated: !!token && !!user,
      setToken,
      updateUser,
      logout,
    }),
    [user, token, setToken, updateUser, logout]
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
