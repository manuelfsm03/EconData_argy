"use client"

import { useEffect, useState } from "react"
import Image from "next/image"
import { CalendarDays, Database, Landmark, LayoutDashboard, MessageSquareText } from "lucide-react"
import { ThemeToggle } from "@/client/components/ui/theme-toggle"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarProvider,
  SidebarTrigger,
} from "@/client/components/ui/sidebar"
import { CanvasWorkspace } from "./canvas-workspace"
import { DataLibrary } from "./data-library"
import { ForumHub } from "./forum-hub"
import { MarketCalendar } from "./market-calendar"
import { BondsWorkspace } from "./bonds-workspace"
import { DATA_CARD_CATALOG } from "@/lib/card-catalog"

type WorkspaceSection = "canvas" | "library" | "calendar" | "bonds" | "forum"

const SECTION_KEY = "lapizarra.workspace.section.v1"

const SECTIONS = [
  { id: "canvas" as const, label: "Mi Pizarra", description: "Canvas personal", Icon: LayoutDashboard },
  { id: "library" as const, label: "Biblioteca de datos", description: `${DATA_CARD_CATALOG.length} tarjetas`, Icon: Database },
  { id: "calendar" as const, label: "Calendario", description: "Pagos y vencimientos", Icon: CalendarDays },
  { id: "bonds" as const, label: "Bonos", description: "Calculadora y herramientas", Icon: Landmark },
  { id: "forum" as const, label: "Foro", description: "Conversaciones", Icon: MessageSquareText },
]

export function AppShell() {
  const [section, setSection] = useState<WorkspaceSection>("canvas")

  useEffect(() => {
    const stored = localStorage.getItem(SECTION_KEY)
    if (stored === "canvas" || stored === "library" || stored === "calendar" || stored === "bonds" || stored === "forum") setSection(stored)
  }, [])

  useEffect(() => {
    localStorage.setItem(SECTION_KEY, section)
  }, [section])

  const active = SECTIONS.find((item) => item.id === section) ?? SECTIONS[0]

  return (
    <SidebarProvider>
      <Sidebar>
        <SidebarHeader>
          <div className="flex items-center gap-3">
            <Image src="/logo.png" alt="" width={44} height={36} className="h-9 w-11 shrink-0 object-contain" />
            <div><div className="text-sm font-semibold text-[var(--text)]">La Pizarra</div><div className="font-mono text-[9px] uppercase tracking-widest text-[var(--text-mute)]">Canvas de datos</div></div>
          </div>
        </SidebarHeader>
        <SidebarContent>
          <div className="mb-2 px-3 pt-1 text-[9px] font-semibold uppercase tracking-[0.16em] text-[var(--text-mute)]">Espacio de trabajo</div>
          <SidebarMenu>
            {SECTIONS.map(({ id, label, description, Icon }) => (
              <SidebarMenuButton key={id} closeOnMobile active={section === id} onClick={() => setSection(id)} className="h-12">
                <Icon size={17} strokeWidth={section === id ? 2.2 : 1.7} />
                <span className="min-w-0"><span className="block truncate">{label}</span><span className="block truncate text-[9px] font-normal text-[var(--text-mute)]">{description}</span></span>
              </SidebarMenuButton>
            ))}
          </SidebarMenu>
        </SidebarContent>
        <SidebarFooter>
          <div className="rounded-md border border-[var(--border)] bg-[var(--bg)] px-3 py-2 font-mono text-[9px] leading-4 text-[var(--text-mute)]">
            Los cambios del Canvas se guardan en este dispositivo.
          </div>
        </SidebarFooter>
      </Sidebar>

      <SidebarInset>
        <header className="sticky top-0 z-[75] flex h-12 items-center gap-2 border-b border-[var(--border)] bg-[color:var(--bg-elev)]/95 px-3 backdrop-blur">
          <SidebarTrigger />
          <div className="h-5 w-px bg-[var(--border)]" />
          <active.Icon size={15} className="text-[var(--amber)]" />
          <span className="text-xs font-semibold text-[var(--text)]">{active.label}</span>
          <div className="flex-1" />
          <ThemeToggle />
        </header>
        {section === "canvas" && <CanvasWorkspace />}
        {section === "library" && <DataLibrary />}
        {section === "calendar" && <MarketCalendar />}
        {section === "bonds" && <BondsWorkspace />}
        {section === "forum" && <ForumHub />}
      </SidebarInset>
    </SidebarProvider>
  )
}
