import { useRef, useState } from "react"
import { toast } from "sonner"
import { HugeiconsIcon } from "@hugeicons/react"
import { Download04Icon } from "@hugeicons/core-free-icons"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { Switch } from "@/components/ui/switch"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import type { ExportProgress } from "@/lib/exportMp4"
import { exportSupported } from "@/lib/exportSupport"
import type { Scene } from "@/lib/schemas"

function fileName(title: string) {
  const slug = title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60)
  return `${slug || "luminar"}.mp4`
}

const PHASE_LABEL: Record<ExportProgress["phase"], string> = {
  preparing: "Fetching narration and visuals…",
  rendering: "Rendering frames…",
  finishing: "Finishing the file…",
}

/** "Download MP4": renders the luminar to a video file entirely in the browser. */
export function ExportVideoButton({ title, scenes }: { title: string; scenes: Scene[] }) {
  const [open, setOpen] = useState(false)
  const [captions, setCaptions] = useState(true)
  const [progress, setProgress] = useState<ExportProgress | null>(null)
  const abortRef = useRef<AbortController | null>(null)
  const running = progress !== null

  async function start() {
    const ctrl = new AbortController()
    abortRef.current = ctrl
    setProgress({ phase: "preparing", done: 0, total: scenes.length })
    try {
      // Loaded on demand: the encoder/muxer is only needed when someone exports.
      const { exportLuminarMp4 } = await import("@/lib/exportMp4")
      const blob = await exportLuminarMp4(scenes, { captions, signal: ctrl.signal, onProgress: setProgress })
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = fileName(title)
      document.body.appendChild(a)
      a.click()
      a.remove()
      setTimeout(() => URL.revokeObjectURL(url), 60_000)
      toast.success("Video downloaded")
      setOpen(false)
    } catch (e) {
      if ((e as Error).name === "AbortError") toast("Export cancelled")
      else if ((e as Error).name === "ExportUnsupportedError") toast.error((e as Error).message)
      else toast.error("Couldn't export this luminar — please try again")
    } finally {
      abortRef.current = null
      setProgress(null)
    }
  }

  const pct = progress && progress.total ? Math.round((progress.done / progress.total) * 100) : 0

  return (
    <Dialog open={open} onOpenChange={(o) => !running && setOpen(o)}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-1.5 rounded-full" disabled={!scenes.length}>
          <HugeiconsIcon icon={Download04Icon} size={14} />
          <span className="hidden sm:inline">Download</span>
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Download as MP4</DialogTitle>
          <DialogDescription>
            We render every scene with its narration into a 1280×720 video, right here in your browser.
          </DialogDescription>
        </DialogHeader>

        {!exportSupported() ? (
          <p className="text-sm text-red-600">This browser can't encode video. Try a recent Chrome, Edge or Safari.</p>
        ) : running ? (
          <div className="space-y-2">
            <Progress value={progress.phase === "preparing" ? 3 : pct} />
            <div className="text-muted-foreground flex justify-between text-xs">
              <span>{PHASE_LABEL[progress.phase]}</span>
              {progress.phase === "rendering" && <span>{pct}%</span>}
            </div>
            <p className="text-muted-foreground text-xs">Keep this tab open until the download starts.</p>
          </div>
        ) : (
          <label className="flex items-center justify-between gap-3 rounded-xl border border-border/60 px-3 py-2.5">
            <span className="text-sm">Burn in captions</span>
            <Switch checked={captions} onCheckedChange={setCaptions} aria-label="Burn in captions" />
          </label>
        )}

        <DialogFooter>
          {running ? (
            <Button variant="outline" onClick={() => abortRef.current?.abort()}>Cancel</Button>
          ) : (
            <Button onClick={start} disabled={!exportSupported()} className="gap-1.5">
              <HugeiconsIcon icon={Download04Icon} size={14} /> Export video
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
