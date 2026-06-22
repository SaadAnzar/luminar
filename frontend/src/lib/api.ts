import axios, { type AxiosInstance } from "axios"
import { z } from "zod"
import * as schemas from "./schemas"

export * from "./schemas"

export const API_BASE_URL =
  (import.meta.env.VITE_API_BASE_URL as string | undefined) ??
  "http://localhost:8000"

export const WS_BASE_URL =
  (import.meta.env.VITE_WS_BASE_URL as string | undefined) ??
  API_BASE_URL.replace(/^http/, "ws")

export const api: AxiosInstance = axios.create({
  baseURL: `${API_BASE_URL}/api/v1`,
})

api.interceptors.request.use((config) => {
  const token = localStorage.getItem("luminar_token")
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

// On 401 the JWT is missing/expired/invalid — drop the dead session and bounce
// to sign-in (a full reload resets all in-memory auth state). Guard against loops.
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error?.response?.status === 401) {
      localStorage.removeItem("luminar_token")
      localStorage.removeItem("luminar_user")
      if (!window.location.pathname.startsWith("/signin")) {
        window.location.href = "/signin"
      }
    }
    return Promise.reject(error)
  }
)

/** Client-side JWT expiry check (no signature verification — the backend still
 *  validates every request; this just avoids showing authed UI for a dead token). */
export function isTokenExpired(token: string): boolean {
  try {
    const part = token.split(".")[1]
    const b64 = part.replace(/-/g, "+").replace(/_/g, "/")
    const payload = JSON.parse(atob(b64)) as { exp?: number }
    if (!payload.exp) return false
    return Date.now() >= payload.exp * 1000
  } catch {
    return true
  }
}

async function parse<T extends z.ZodTypeAny>(schema: T, data: unknown): Promise<z.infer<T>> {
  const result = schema.safeParse(data)
  if (!result.success) {
    console.warn("[api] schema mismatch", result.error.issues)
    return data as z.infer<T>
  }
  return result.data
}

export const luminarApi = {
  generate: (data: FormData) =>
    api.post("/luminars/generate", data).then((r) => r.data as { luminar_id: string; status: string }),

  approveScript: (luminarId: string) =>
    api.post(`/luminars/${luminarId}/approve`).then((r) => r.data as { luminar_id: string; status: string }),

  retry: (luminarId: string) =>
    api.post(`/luminars/${luminarId}/retry`).then((r) => r.data as { luminar_id: string; status: string }),

  setPublished: (luminarId: string, published: boolean) =>
    api.post(`/luminars/${luminarId}/publish`, { published }).then((r) => r.data as { luminar_id: string; published: boolean }),

  chat: (luminarId: string, message: string, history: { role: string; content: string }[]) =>
    api.post(`/luminars/${luminarId}/chat`, { message, history }).then((r) => r.data as { answer: string }),

  myLuminars: () =>
    api.get("/luminars/me").then((r) => parse(z.array(schemas.LuminarSchema), r.data)),

  get: (id: string) =>
    api.get(`/luminars/${id}`).then((r) => parse(schemas.LuminarSchema, r.data)),

  getScenes: (id: string) =>
    api.get(`/luminars/${id}/scenes`).then((r) => parse(z.array(schemas.SceneSchema), r.data)),
}

export const discoverApi = {
  feed: () =>
    api.get("/discover/feed").then((r) => parse(z.array(schemas.DiscoverItemSchema), r.data)),
}

export const quizApi = {
  getCards: (luminarId: string) =>
    api.get(`/quiz/${luminarId}/cards`).then((r) => parse(z.array(schemas.QuizCardSchema), r.data)),

  attempt: (quizCardId: string, selectedIndex: number, hintUsed = false, timeMs?: number) =>
    api
      .post(`/quiz/${quizCardId}/attempt`, {
        selected_index: selectedIndex,
        hint_used: hintUsed,
        time_to_answer_ms: timeMs,
      })
      .then((r) => r.data as { is_correct: boolean; correct_index: number; explanation: string | null }),
}

export const favoritesApi = {
  add: (luminarId: string) => api.post(`/favorites/${luminarId}`).then((r) => r.data),
  remove: (luminarId: string) => api.delete(`/favorites/${luminarId}`).then((r) => r.data),
  list: () => api.get("/favorites/").then((r) => parse(z.array(schemas.LuminarSchema), r.data)),
}

export const portfolioApi = {
  get: () => api.get("/portfolio/").then((r) => parse(schemas.PortfolioSchema, r.data)),
}

export interface ProfileUpdate {
  interests?: string[]
  goals?: string[]
  skill_level?: string
  learning_style?: string
  onboarded?: boolean
}

export const authApi = {
  me: () => api.get("/auth/me").then((r) => r.data),
  updateProfile: (body: ProfileUpdate) => api.patch("/auth/me", body).then((r) => r.data),
  signIn: () => api.get("/auth/signin").then((r) => r.data as { url: string }),
  googleCallback: (code: string) =>
    api
      .post("/auth/google/callback", { code })
      .then((r) => r.data as { access_token: string; user: schemas.Profile }),
  profile: (userId: string) =>
    api.get(`/profiles/${userId}`).then((r) => parse(schemas.ProfileSchema, r.data)),
}
