/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useEffect, useState, type ReactNode } from "react"
import { useNavigate } from "@tanstack/react-router"
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  Home09Icon,
  MagicWand01Icon,
  BrainIcon,
  CompassIcon,
  PlayListIcon,
  SparklesIcon,
} from "@hugeicons/core-free-icons"

interface Ctx {
  open: boolean
  setOpen: (v: boolean) => void
  toggle: () => void
}

const CommandPaletteContext = createContext<Ctx | undefined>(undefined)

export function CommandPaletteProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false)
  const navigate = useNavigate()

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault()
        setOpen((v) => !v)
      }
    }
    window.addEventListener("keydown", handler)
    return () => window.removeEventListener("keydown", handler)
  }, [])

  const go = (to: string) => {
    setOpen(false)
    navigate({ to })
  }

  return (
    <CommandPaletteContext.Provider
      value={{ open, setOpen, toggle: () => setOpen((v) => !v) }}
    >
      {children}
      <CommandDialog open={open} onOpenChange={setOpen}>
        <CommandInput placeholder="Search or jump to…" />
        <CommandList>
          <CommandEmpty>No results.</CommandEmpty>
          <CommandGroup heading="Actions">
            <CommandItem onSelect={() => go("/create")}>
              <HugeiconsIcon icon={SparklesIcon} size={16} />
              <span>Create a new luminar</span>
            </CommandItem>
          </CommandGroup>
          <CommandSeparator />
          <CommandGroup heading="Navigate">
            <CommandItem onSelect={() => go("/")}>
              <HugeiconsIcon icon={Home09Icon} size={16} />
              <span>Home</span>
            </CommandItem>
            <CommandItem onSelect={() => go("/create")}>
              <HugeiconsIcon icon={MagicWand01Icon} size={16} />
              <span>Create</span>
            </CommandItem>
            <CommandItem onSelect={() => go("/social")}>
              <HugeiconsIcon icon={CompassIcon} size={16} />
              <span>Explore</span>
            </CommandItem>
            <CommandItem onSelect={() => go("/knowledge")}>
              <HugeiconsIcon icon={BrainIcon} size={16} />
              <span>Knowledge graph</span>
            </CommandItem>
            <CommandItem onSelect={() => go("/library")}>
              <HugeiconsIcon icon={PlayListIcon} size={16} />
              <span>Library</span>
            </CommandItem>
          </CommandGroup>
        </CommandList>
      </CommandDialog>
    </CommandPaletteContext.Provider>
  )
}

export function useCommandPalette() {
  const ctx = useContext(CommandPaletteContext)
  if (!ctx) throw new Error("useCommandPalette must be used within CommandPaletteProvider")
  return ctx
}
