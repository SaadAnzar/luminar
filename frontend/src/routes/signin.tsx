import { createFileRoute, Link } from "@tanstack/react-router"
import { motion } from "framer-motion"
import { HugeiconsIcon } from "@hugeicons/react"
import { CheckmarkCircle02Icon } from "@hugeicons/core-free-icons"
import { Button } from "@/components/ui/button"
import { Logo } from "@/components/layout/Logo"
import { FadeIn } from "@/components/motion/FadeIn"
import { authApi } from "@/lib/api"
import { toast } from "sonner"

export const Route = createFileRoute("/signin")({
  component: SignInPage,
})

function SignInPage() {
  async function signInWithGoogle() {
    try {
      const { url } = await authApi.signIn()
      window.location.href = url
    } catch {
      toast.error("Could not initiate Google sign-in")
    }
  }

  return (
    <div className="grid min-h-svh lg:grid-cols-2">
      <BrandPanel />

      <div className="flex items-center justify-center p-6 lg:p-10">
        <FadeIn className="w-full max-w-sm">
          <div className="mb-10 lg:hidden">
            <Logo />
          </div>

          <h1 className="font-heading text-3xl font-semibold tracking-tight">
            Welcome
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Sign in with Google to start learning.
          </p>

          <div className="mt-8">
            <Button
              size="lg"
              variant="outline"
              className="w-full gap-3"
              onClick={signInWithGoogle}
            >
              <GoogleIcon size={18} />
              Continue with Google
            </Button>
          </div>

          <p className="mt-8 text-center text-xs text-muted-foreground">
            By continuing, you agree to Luminar's terms of service.
          </p>
        </FadeIn>
      </div>
    </div>
  )
}

function BrandPanel() {
  const points = [
    "Script-first — review before anything renders",
    "Animated, narrated scenes from any source",
    "Quiz checkpoints that adapt to you",
  ]
  return (
    <div className="relative hidden overflow-hidden border-r border-border/60 bg-card lg:block">
      <div className="bg-grid mask-fade-b absolute inset-0 opacity-[0.3]" />
      <div className="glow-primary absolute inset-x-0 top-0 h-[420px]" />
      <div className="absolute -left-24 top-40 size-80 rounded-full bg-primary/20 blur-[110px]" />
      <div className="absolute -right-16 bottom-10 size-72 rounded-full bg-violet-500/15 blur-[110px]" />

      <div className="relative flex h-full flex-col p-10">
        <Link to="/"><Logo /></Link>
        <div className="flex flex-1 flex-col justify-center">
          <motion.h2
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.05, ease: [0.22, 1, 0.36, 1] }}
            className="max-w-md font-heading text-4xl font-semibold leading-tight tracking-tight"
          >
            Learn anything,
            <span className="from-primary to-violet-500 bg-gradient-to-r bg-clip-text text-transparent"> beautifully</span>.
          </motion.h2>
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.12, ease: [0.22, 1, 0.36, 1] }}
            className="mt-7 space-y-3"
          >
            {points.map((p) => (
              <div key={p} className="flex items-center gap-3 text-sm text-muted-foreground">
                <span className="bg-primary/10 text-primary flex size-6 items-center justify-center rounded-full">
                  <HugeiconsIcon icon={CheckmarkCircle02Icon} size={14} />
                </span>
                {p}
              </div>
            ))}
          </motion.div>
        </div>
        <div className="text-xs text-muted-foreground">© 2026 Luminar · AI-powered learning</div>
      </div>
    </div>
  )
}

const GoogleIcon = ({ size = 20 }) => (
  <svg width={size} height={size} viewBox="0 0 48 48">
    <path
      fill="#EA4335"
      d="M24 9.5c3.54 0 6.73 1.22 9.24 3.6l6.9-6.9C35.82 2.38 30.34 0 24 0 14.62 0 6.56 5.48 2.44 13.44l8.04 6.24C12.52 13.26 17.76 9.5 24 9.5z"
    />
    <path
      fill="#4285F4"
      d="M46.1 24.5c0-1.6-.14-3.14-.4-4.62H24v9.02h12.5c-.54 2.92-2.2 5.4-4.68 7.08l7.2 5.6c4.2-3.88 6.64-9.6 6.64-17.08z"
    />
    <path
      fill="#FBBC05"
      d="M10.48 28.32a14.5 14.5 0 010-8.64l-8.04-6.24A24.02 24.02 0 000 24c0 3.86.92 7.5 2.44 10.56l8.04-6.24z"
    />
    <path
      fill="#34A853"
      d="M24 48c6.34 0 11.66-2.1 15.54-5.72l-7.2-5.6c-2 1.34-4.56 2.12-8.34 2.12-6.24 0-11.48-3.76-13.52-9.18l-8.04 6.24C6.56 42.52 14.62 48 24 48z"
    />
  </svg>
)
