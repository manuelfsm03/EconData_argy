"use client"

import * as React from "react"
import { PanelLeft } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "./button"

interface SidebarContextValue {
  open: boolean
  setOpen: (open: boolean) => void
  toggle: () => void
}

const SidebarContext = React.createContext<SidebarContextValue | null>(null)

export function useSidebar() {
  const context = React.useContext(SidebarContext)
  if (!context) throw new Error("useSidebar must be used inside SidebarProvider")
  return context
}

export function SidebarProvider({ children, defaultOpen = true }: { children: React.ReactNode; defaultOpen?: boolean }) {
  const [open, setOpen] = React.useState(defaultOpen)
  const toggle = React.useCallback(() => setOpen((value) => !value), [])

  React.useEffect(() => {
    if (window.matchMedia("(max-width: 767px)").matches) setOpen(false)
  }, [])

  return (
    <SidebarContext.Provider value={{ open, setOpen, toggle }}>
      <div className="flex min-h-screen w-full bg-[var(--bg)]">{children}</div>
    </SidebarContext.Provider>
  )
}

export function Sidebar({ className, children }: React.HTMLAttributes<HTMLElement>) {
  const { open } = useSidebar()
  return (
    <aside
      data-open={open}
      className={cn(
        "sticky top-0 z-[80] h-screen shrink-0 overflow-hidden border-r border-[var(--border)] bg-[var(--bg-elev)] transition-[width] duration-200 max-md:fixed max-md:left-0 max-md:shadow-2xl",
        open ? "w-60" : "w-0 border-r-0",
        className
      )}
    >
      <div className="flex h-full w-60 flex-col">{children}</div>
    </aside>
  )
}

export const SidebarHeader = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={cn("border-b border-[var(--border)] p-4", className)} {...props} />
)

export const SidebarContent = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={cn("flex min-h-0 flex-1 flex-col gap-1 overflow-auto p-3", className)} {...props} />
)

export const SidebarFooter = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={cn("border-t border-[var(--border)] p-3", className)} {...props} />
)

export const SidebarMenu = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={cn("flex flex-col gap-1", className)} {...props} />
)

interface SidebarMenuButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  active?: boolean
}

export const SidebarMenuButton = React.forwardRef<HTMLButtonElement, SidebarMenuButtonProps>(
  ({ className, active, ...props }, ref) => (
    <button
      ref={ref}
      data-active={active}
      className={cn(
        "flex h-10 w-full items-center gap-3 rounded-md px-3 text-left text-sm font-medium text-[var(--text-dim)] transition-colors",
        "hover:bg-[var(--bg-elev-2)] hover:text-[var(--text)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--amber-soft)]",
        active && "bg-[var(--amber-soft)] text-[var(--amber)]",
        className
      )}
      {...props}
    />
  )
)
SidebarMenuButton.displayName = "SidebarMenuButton"

export function SidebarInset({ className, ...props }: React.HTMLAttributes<HTMLElement>) {
  return <main className={cn("min-w-0 flex-1", className)} {...props} />
}

export function SidebarTrigger({ className }: { className?: string }) {
  const { toggle } = useSidebar()
  return (
    <Button variant="ghost" size="icon" onClick={toggle} className={cn("h-8 w-8 text-[var(--text-dim)]", className)} aria-label="Mostrar u ocultar menú">
      <PanelLeft size={17} />
    </Button>
  )
}
