import { createFileRoute, useNavigate } from "@tanstack/react-router"
import { useEffect } from "react"
import { toast } from "sonner"
import { useAuth } from "@/hooks/useAuth"
import { authApi } from "@/lib/api"

export const Route = createFileRoute("/auth/callback")({
  component: AuthCallback,
})

/**
 * Google OAuth redirect lands here with ?code=... in the query string.
 * We exchange the code via the backend and store the resulting JWT.
 */
function AuthCallback() {
  const nav = useNavigate()
  const { setToken } = useAuth()

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const code = params.get("code")

    if (!code) {
      toast.error("Authentication failed — no code received.")
      nav({ to: "/signin" })
      return
    }

    authApi
      .googleCallback(code)
      .then(({ access_token, user }) => {
        setToken(access_token, user)
        toast.success("Signed in with Google!")
        nav({ to: "/" })
      })
      .catch(() => {
        toast.error("Could not complete sign-in. Please try again.")
        nav({ to: "/signin" })
      })
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="flex min-h-svh items-center justify-center">
      <div className="text-sm text-muted-foreground">Completing sign-in…</div>
    </div>
  )
}
