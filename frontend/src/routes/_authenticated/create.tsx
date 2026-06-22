import { createFileRoute, useNavigate } from "@tanstack/react-router"
import { useRef, useState } from "react"
import { toast } from "sonner"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  SparklesIcon,
  File01Icon,
  FileAddIcon,
  PresentationBarChart01Icon,
  GlobalIcon,
  Clock01Icon,
  VoiceIcon,
  ConversationIcon,
  UploadIcon,
  Cancel01Icon,
  Add01Icon,
  ArrowRight02Icon,
  PlayListIcon,
  CheckmarkCircle02Icon,
} from "@hugeicons/core-free-icons"
import { Textarea } from "@/components/ui/textarea"
import { Input } from "@/components/ui/input"
import { Switch } from "@/components/ui/switch"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { FadeIn } from "@/components/motion/FadeIn"
import { luminarApi } from "@/lib/api"
import { cn } from "@/lib/utils"

export const Route = createFileRoute("/_authenticated/create")({
  component: CreatePage,
})

type SourceType = "none" | "pdf" | "txt" | "ppt" | "docx" | "blog" | "website" | "youtube"
const FILE_SOURCE_TYPES: SourceType[] = ["pdf", "txt", "ppt", "docx"]
const URL_SOURCE_TYPES: SourceType[] = ["blog", "website", "youtube"]
const URL_PLACEHOLDERS: Partial<Record<SourceType, string>> = {
  blog: "https://example.com/article",
  website: "https://example.com/page",
  youtube: "https://www.youtube.com/watch?v=…",
}
const SOURCE_OPTIONS: { value: SourceType; label: string; icon: Parameters<typeof HugeiconsIcon>[0]["icon"]; accept: string }[] = [
  { value: "pdf", label: "PDF", icon: File01Icon, accept: ".pdf,application/pdf" },
  { value: "docx", label: "Word", icon: File01Icon, accept: ".docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document" },
  { value: "txt", label: "Text", icon: FileAddIcon, accept: ".txt,text/plain" },
  { value: "ppt", label: "Slides", icon: PresentationBarChart01Icon, accept: ".ppt,.pptx,application/vnd.ms-powerpoint,application/vnd.openxmlformats-officedocument.presentationml.presentation" },
  { value: "blog", label: "Blog URL", icon: GlobalIcon, accept: "" },
  { value: "website", label: "Website", icon: GlobalIcon, accept: "" },
  { value: "youtube", label: "YouTube", icon: GlobalIcon, accept: "" },
]
// Mirrors backend app/core/luminar_spec.py
const SPEC: Record<string, { scenes: string; quiz: number; length: string }> = {
  "2": { scenes: "3–4", quiz: 3, length: "2:00–2:30" },
  "3": { scenes: "4–5", quiz: 5, length: "3:00–3:40" },
  "5": { scenes: "7–8", quiz: 8, length: "5:00–5:50" },
}

function CreatePage() {
  const nav = useNavigate()
  const [topic, setTopic] = useState("")
  const [title, setTitle] = useState("")
  const [description, setDesc] = useState("")
  const [duration, setDuration] = useState("3")
  const [voice, setVoice] = useState("alloy")
  const [dialogue, setDialogue] = useState(false)
  const [sourceType, setSourceType] = useState<SourceType>("none")
  const [sourceFile, setSourceFile] = useState<File | null>(null)
  const [sourceUrl, setSourceUrl] = useState("")
  const [showSource, setShowSource] = useState(false)
  const [showDetails, setShowDetails] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  function applyFile(file: File) {
    const ext = file.name.split(".").pop()?.toLowerCase()
    const typeMap: Record<string, SourceType> = { pdf: "pdf", txt: "txt", ppt: "ppt", pptx: "ppt", docx: "docx" }
    setSourceType(typeMap[ext ?? ""] ?? "txt")
    setSourceFile(file)
    if (!title) setTitle(file.name.replace(/\.[^.]+$/, ""))
  }

  async function submit() {
    if (!topic.trim()) { toast.error("Tell us what to teach"); return }
    if (URL_SOURCE_TYPES.includes(sourceType) && !sourceUrl.trim()) { toast.error("Enter a URL"); return }
    if (FILE_SOURCE_TYPES.includes(sourceType) && !sourceFile) { toast.error("Please attach a file"); return }

    setSubmitting(true)
    const fd = new FormData()
    fd.append("topic", topic)
    fd.append("title", title.trim() || topic.slice(0, 80))
    fd.append("description", description)
    fd.append("source_type", sourceType)
    fd.append("duration_minutes", duration)
    fd.append("voice_style", voice)
    fd.append("dialogue_mode", dialogue ? "true" : "false")
    if (sourceFile) fd.append("source_file", sourceFile)
    if (URL_SOURCE_TYPES.includes(sourceType)) fd.append("source_url", sourceUrl)
    try {
      const { luminar_id } = await luminarApi.generate(fd)
      nav({ to: "/generating/$jobId", params: { jobId: luminar_id } })
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to start")
      setSubmitting(false)
    }
  }

  const spec = SPEC[duration]
  const sourceActive = sourceType !== "none"

  return (
    <div className="relative">
      <div className="glow-primary absolute inset-x-0 top-0 -z-10 h-72" />
      <div className="mx-auto max-w-2xl px-6 py-12 md:py-16">
        <FadeIn className="mb-7 text-center">
          <div className="bg-primary/10 text-primary mx-auto mb-4 flex size-11 items-center justify-center rounded-2xl">
            <HugeiconsIcon icon={SparklesIcon} size={22} />
          </div>
          <h1 className="font-heading text-3xl font-bold tracking-tight md:text-4xl">What do you want to learn?</h1>
          <p className="text-muted-foreground mx-auto mt-2 max-w-md text-sm">
            Describe a topic. Our agents write the script first — you review it, then we build the full luminar.
          </p>
        </FadeIn>

        {/* Prompt card */}
        <FadeIn delay={0.05}>
          <div className="edge-light rounded-2xl border border-border/70 bg-card p-3 shadow-sm focus-within:border-primary/50 focus-within:ring-2 focus-within:ring-primary/15">
            <Textarea
              autoFocus
              rows={3}
              placeholder="e.g. How transformers work, explained for a first-year CS student"
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              className="resize-none border-0 bg-transparent px-2 text-base shadow-none focus-visible:ring-0"
            />

            {/* Control bar */}
            <div className="flex flex-wrap items-center gap-2 border-t border-border/60 px-1 pt-3">
              <button
                type="button"
                onClick={() => setShowSource((s) => !s)}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
                  sourceActive ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:text-foreground",
                )}
              >
                <HugeiconsIcon icon={sourceActive ? CheckmarkCircle02Icon : Add01Icon} size={13} />
                {sourceActive ? SOURCE_OPTIONS.find((o) => o.value === sourceType)?.label : "Add source"}
              </button>

              <div className="bg-border mx-0.5 h-5 w-px" />

              <ToggleGroup type="single" value={duration} onValueChange={(v) => v && setDuration(v)} className="gap-1">
                {["2", "3", "5"].map((d) => (
                  <ToggleGroupItem key={d} value={d} className="h-8 rounded-full px-3 text-xs data-[state=on]:bg-primary data-[state=on]:text-primary-foreground">
                    {d}m
                  </ToggleGroupItem>
                ))}
              </ToggleGroup>

              <Select value={voice} onValueChange={setVoice}>
                <SelectTrigger className="h-8 w-auto gap-1.5 rounded-full text-xs"><HugeiconsIcon icon={VoiceIcon} size={13} /><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="alloy">Alloy</SelectItem>
                  <SelectItem value="nova">Nova</SelectItem>
                  <SelectItem value="echo">Echo</SelectItem>
                  <SelectItem value="onyx">Onyx</SelectItem>
                </SelectContent>
              </Select>

              <label className="text-muted-foreground inline-flex cursor-pointer items-center gap-1.5 text-xs">
                <HugeiconsIcon icon={ConversationIcon} size={13} />
                Dialogue
                <Switch checked={dialogue} onCheckedChange={setDialogue} className="scale-90" />
              </label>
            </div>

            {/* Source disclosure */}
            {showSource && (
              <div className="mt-3 space-y-3 border-t border-border/60 px-1 pt-3">
                <div className="grid grid-cols-4 gap-2 sm:grid-cols-7">
                  {SOURCE_OPTIONS.map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => { setSourceType(sourceType === opt.value ? "none" : opt.value); setSourceFile(null); setSourceUrl("") }}
                      className={cn(
                        "flex flex-col items-center gap-1 rounded-xl border p-2.5 text-[10px] font-medium transition-all",
                        sourceType === opt.value ? "border-primary bg-primary/5 text-primary" : "border-border text-muted-foreground hover:border-primary/40 hover:text-foreground",
                      )}
                    >
                      <HugeiconsIcon icon={opt.icon} size={16} />
                      {opt.label}
                    </button>
                  ))}
                </div>

                {FILE_SOURCE_TYPES.includes(sourceType) && (
                  <div
                    onDrop={(e) => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) applyFile(f) }}
                    onDragOver={(e) => e.preventDefault()}
                    onClick={() => fileInputRef.current?.click()}
                    className={cn(
                      "cursor-pointer rounded-xl border-2 border-dashed p-5 text-center transition-colors",
                      sourceFile ? "border-primary/50 bg-primary/5" : "border-border hover:border-primary/40",
                    )}
                  >
                    {sourceFile ? (
                      <div className="flex items-center justify-center gap-2">
                        <HugeiconsIcon icon={File01Icon} size={16} className="text-primary" />
                        <span className="text-primary text-sm font-medium">{sourceFile.name}</span>
                        <button type="button" onClick={(e) => { e.stopPropagation(); setSourceFile(null) }} className="text-muted-foreground hover:text-foreground">
                          <HugeiconsIcon icon={Cancel01Icon} size={14} />
                        </button>
                      </div>
                    ) : (
                      <div className="text-muted-foreground">
                        <HugeiconsIcon icon={UploadIcon} size={22} className="mx-auto mb-1.5" />
                        <p className="text-sm">Drop a file or click to browse</p>
                      </div>
                    )}
                    <input ref={fileInputRef} type="file" className="hidden" accept={SOURCE_OPTIONS.find((o) => o.value === sourceType)?.accept}
                      onChange={(e) => { const f = e.target.files?.[0]; if (f) applyFile(f) }} />
                  </div>
                )}

                {URL_SOURCE_TYPES.includes(sourceType) && (
                  <Input placeholder={URL_PLACEHOLDERS[sourceType] ?? "https://…"} value={sourceUrl} onChange={(e) => setSourceUrl(e.target.value)} type="url" />
                )}
              </div>
            )}

            {/* Details disclosure */}
            <div className="mt-3 border-t border-border/60 px-1 pt-3">
              {!showDetails ? (
                <button type="button" onClick={() => setShowDetails(true)} className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1.5 text-xs">
                  <HugeiconsIcon icon={Add01Icon} size={13} /> Add a title & description
                </button>
              ) : (
                <div className="grid gap-2 sm:grid-cols-2">
                  <Input placeholder="Title (optional)" value={title} onChange={(e) => setTitle(e.target.value)} className="h-9" />
                  <Input placeholder="Short description (optional)" value={description} onChange={(e) => setDesc(e.target.value)} className="h-9" />
                </div>
              )}
            </div>
          </div>
        </FadeIn>

        {/* Live preview + generate */}
        <FadeIn delay={0.1} className="mt-4 flex flex-col items-center gap-4 sm:flex-row sm:justify-between">
          <div className="text-muted-foreground flex items-center gap-4 text-xs">
            <span className="inline-flex items-center gap-1.5"><HugeiconsIcon icon={PlayListIcon} size={13} className="text-primary" />{spec?.scenes} scenes</span>
            <span className="inline-flex items-center gap-1.5"><HugeiconsIcon icon={SparklesIcon} size={13} className="text-primary" />{spec?.quiz} questions</span>
            <span className="inline-flex items-center gap-1.5"><HugeiconsIcon icon={Clock01Icon} size={13} className="text-primary" />{spec?.length}</span>
          </div>
          <Button onClick={submit} disabled={submitting} size="lg" className="w-full gap-2 rounded-full px-7 shadow-lg shadow-primary/20 sm:w-auto">
            <HugeiconsIcon icon={SparklesIcon} size={16} />
            {submitting ? "Writing script…" : "Generate script"}
            {!submitting && <HugeiconsIcon icon={ArrowRight02Icon} size={16} />}
          </Button>
        </FadeIn>
      </div>
    </div>
  )
}
