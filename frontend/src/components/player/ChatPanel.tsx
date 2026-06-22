import { useEffect, useRef, useState } from "react"
import { HugeiconsIcon } from "@hugeicons/react"
import { SentIcon, SparklesIcon, Loading03Icon } from "@hugeicons/core-free-icons"
import { Button } from "@/components/ui/button"
import { luminarApi } from "@/lib/api"
import { cn } from "@/lib/utils"

interface Msg { role: "user" | "assistant"; content: string }

const SUGGESTIONS = [
  "Explain this more simply",
  "Give me a real-world example",
  "Why does this matter?",
]

export function ChatPanel({ luminarId, title }: { luminarId: string; title: string }) {
  const [messages, setMessages] = useState<Msg[]>([])
  const [input, setInput] = useState("")
  const [sending, setSending] = useState(false)
  const scrollRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" })
  }, [messages, sending])

  async function send(text: string) {
    const q = text.trim()
    if (!q || sending) return
    const history = messages.map((m) => ({ role: m.role, content: m.content }))
    setMessages((m) => [...m, { role: "user", content: q }])
    setInput("")
    setSending(true)
    try {
      const { answer } = await luminarApi.chat(luminarId, q, history)
      setMessages((m) => [...m, { role: "assistant", content: answer }])
    } catch {
      setMessages((m) => [...m, { role: "assistant", content: "Sorry — I couldn't answer that just now. Try again?" }])
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="flex h-full flex-col">
      {/* messages */}
      <div ref={scrollRef} className="no-scrollbar flex-1 space-y-3 overflow-y-auto p-4">
        {messages.length === 0 && !sending ? (
          <div className="flex h-full flex-col items-center justify-center px-4 text-center">
            <div className="bg-primary/10 text-primary mb-3 flex size-11 items-center justify-center rounded-2xl">
              <HugeiconsIcon icon={SparklesIcon} size={20} />
            </div>
            <p className="text-sm font-medium">Ask anything about this lesson</p>
            <p className="text-muted-foreground mt-1 text-xs">Your AI tutor knows “{title}” and can go deeper on any part.</p>
            <div className="mt-4 flex flex-col gap-1.5">
              {SUGGESTIONS.map((s) => (
                <button key={s} onClick={() => send(s)} className="border-border hover:border-primary/40 hover:bg-primary/5 rounded-full border px-3 py-1.5 text-xs transition-colors">
                  {s}
                </button>
              ))}
            </div>
          </div>
        ) : (
          messages.map((m, i) => (
            <div key={i} className={cn("flex", m.role === "user" ? "justify-end" : "justify-start")}>
              <div className={cn(
                "max-w-[85%] whitespace-pre-wrap rounded-2xl px-3.5 py-2 text-sm leading-relaxed",
                m.role === "user" ? "bg-primary text-primary-foreground rounded-br-md" : "bg-muted rounded-bl-md",
              )}>
                {m.content}
              </div>
            </div>
          ))
        )}
        {sending && (
          <div className="flex justify-start">
            <div className="bg-muted text-muted-foreground flex items-center gap-1.5 rounded-2xl rounded-bl-md px-3.5 py-2 text-sm">
              <HugeiconsIcon icon={Loading03Icon} size={14} className="animate-spin" /> Thinking…
            </div>
          </div>
        )}
      </div>

      {/* input */}
      <form
        onSubmit={(e) => { e.preventDefault(); send(input) }}
        className="border-border/60 flex items-end gap-2 border-t p-3"
      >
        <textarea
          rows={1}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(input) } }}
          placeholder="Ask your tutor…"
          className="border-input focus-visible:ring-ring/30 max-h-28 min-h-9 flex-1 resize-none rounded-xl border bg-transparent px-3 py-2 text-sm outline-none focus-visible:ring-2"
        />
        <Button type="submit" size="icon" className="size-9 shrink-0 rounded-xl" disabled={!input.trim() || sending} aria-label="Send">
          <HugeiconsIcon icon={SentIcon} size={16} />
        </Button>
      </form>
    </div>
  )
}
