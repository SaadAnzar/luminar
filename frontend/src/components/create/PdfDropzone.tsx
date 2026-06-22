import { useCallback, useRef, useState } from "react"
import { motion } from "framer-motion"
import { HugeiconsIcon } from "@hugeicons/react"
import { FileUploadIcon, File01Icon, Cancel01Icon } from "@hugeicons/core-free-icons"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"

interface Props {
  file: File | null
  onChange: (file: File | null) => void
  accept?: string
}

export function PdfDropzone({ file, onChange, accept = "application/pdf" }: Props) {
  const [drag, setDrag] = useState(false)
  const inputRef = useRef<HTMLInputElement | null>(null)

  const onDrop = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault()
      setDrag(false)
      const f = e.dataTransfer.files?.[0]
      if (f && f.type === "application/pdf") onChange(f)
    },
    [onChange],
  )

  if (file) {
    return (
      <div className="bg-muted/40 ring-border flex items-center gap-3 rounded-xl p-3 ring-1">
        <div className="bg-primary/10 text-primary flex size-10 items-center justify-center rounded-lg">
          <HugeiconsIcon icon={File01Icon} size={18} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-medium">{file.name}</div>
          <div className="text-muted-foreground text-xs">
            {(file.size / 1024 / 1024).toFixed(2)} MB
          </div>
        </div>
        <Button variant="ghost" size="icon" onClick={() => onChange(null)} aria-label="Remove file">
          <HugeiconsIcon icon={Cancel01Icon} size={15} />
        </Button>
      </div>
    )
  }

  return (
    <motion.div
      onDragOver={(e) => {
        e.preventDefault()
        setDrag(true)
      }}
      onDragLeave={() => setDrag(false)}
      onDrop={onDrop}
      onClick={() => inputRef.current?.click()}
      animate={{ scale: drag ? 1.015 : 1 }}
      transition={{ duration: 0.15 }}
      className={cn(
        "group cursor-pointer rounded-xl border-2 border-dashed p-8 text-center transition-colors",
        drag ? "border-primary bg-primary/5" : "border-border hover:border-foreground/30",
      )}
    >
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        className="hidden"
        onChange={(e) => onChange(e.target.files?.[0] ?? null)}
      />
      <HugeiconsIcon
        icon={FileUploadIcon}
        size={30}
        className={cn("mx-auto transition-colors", drag ? "text-primary" : "text-muted-foreground")}
      />
      <p className="mt-3 text-sm font-medium">
        Drop a PDF or <span className="text-primary">browse</span>
      </p>
      <p className="text-muted-foreground mt-1 text-xs">Up to 40MB, up to 60 pages</p>
    </motion.div>
  )
}
