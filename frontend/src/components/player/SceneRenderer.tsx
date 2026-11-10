import { motion, AnimatePresence } from "framer-motion"
import { useEffect, useState } from "react"
import type { Scene } from "@/lib/schemas"
import { makeInlineSvg } from "@/lib/svg"

interface Props {
  scene: Scene | null
  sceneIndex: number
}

export function SceneRenderer({ scene, sceneIndex }: Props) {
  const url = scene?.svg_url ?? null
  const [markup, setMarkup] = useState<string | null>(null)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    // reset render state when the scene's SVG url changes, then fetch+inline it
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMarkup(null)
    setFailed(false)
    if (!url) return
    let cancelled = false
    const ctrl = new AbortController()
    fetch(url, { signal: ctrl.signal })
      .then((r) => {
        if (!r.ok) throw new Error(`svg ${r.status}`)
        return r.text()
      })
      .then((text) => {
        if (!cancelled) setMarkup(makeInlineSvg(text))
      })
      .catch((e) => {
        if (!cancelled && e?.name !== "AbortError") setFailed(true)
      })
    return () => {
      cancelled = true
      ctrl.abort()
    }
  }, [url])

  return (
    <div className="from-primary/5 to-chart-3/5 relative aspect-video w-full overflow-hidden rounded-xl bg-gradient-to-br">
      <AnimatePresence mode="wait">
        <motion.div
          key={sceneIndex}
          initial={{ opacity: 0, filter: "blur(16px)", scale: 1.02 }}
          animate={{ opacity: 1, filter: "blur(0px)", scale: 1 }}
          exit={{ opacity: 0, filter: "blur(12px)", scale: 0.98 }}
          transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
          className="absolute inset-0 flex items-center justify-center"
        >
          {url && markup && !failed ? (
            <div
              className="h-full w-full"
              // markup is sanitized (script/handlers stripped) above
              dangerouslySetInnerHTML={{ __html: markup }}
            />
          ) : (
            <PlaceholderScene title={scene?.title ?? "Scene"} />
          )}
        </motion.div>
      </AnimatePresence>

      {scene?.title && (
        <motion.div
          key={`title-${sceneIndex}`}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2, duration: 0.3 }}
          className="absolute left-4 top-4 rounded-full bg-black/70 px-3 py-1 text-xs text-white backdrop-blur"
        >
          Scene {sceneIndex + 1} · {scene.title}
        </motion.div>
      )}
    </div>
  )
}

function PlaceholderScene({ title }: { title: string }) {
  return (
    <svg viewBox="0 0 800 450" className="h-full w-full">
      <defs>
        <linearGradient id="ph" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="var(--primary)" stopOpacity="0.25" />
          <stop offset="100%" stopColor="var(--chart-3)" stopOpacity="0.1" />
        </linearGradient>
      </defs>
      <rect width="800" height="450" fill="url(#ph)" />
      {[...Array(4)].map((_, i) => (
        <motion.circle
          key={i}
          cx={200 + i * 150}
          cy={225}
          r={40}
          fill="var(--primary)"
          fillOpacity={0.35}
          animate={{ scale: [0.8, 1.15, 0.8], y: [0, -10, 0] }}
          transition={{ duration: 2.6, delay: i * 0.2, repeat: Infinity, ease: "easeInOut" }}
        />
      ))}
      <text
        x="400"
        y="400"
        textAnchor="middle"
        className="fill-foreground/70 font-sans text-[16px]"
      >
        {title}
      </text>
    </svg>
  )
}
