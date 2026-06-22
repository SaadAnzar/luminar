import { createContext } from "react"

export interface AuthUser {
  id: string
  email: string
  name: string
  avatar_url?: string | null
  onboarded?: boolean
  interests?: string[] | null
  goals?: string[] | null
  skill_level?: string | null
  learning_style?: string | null
}

export interface AuthState {
  user: AuthUser | null
  token: string | null
  isLoading: boolean
  isAuthenticated: boolean
  setToken: (token: string, user: AuthUser) => void
  updateUser: (user: AuthUser) => void
  logout: () => void
}

export const AuthContext = createContext<AuthState | undefined>(undefined)

export const TOKEN_KEY = "luminar_token"
export const USER_KEY = "luminar_user"
