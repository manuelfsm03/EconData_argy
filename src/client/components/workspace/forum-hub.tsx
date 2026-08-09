"use client"

import { FormEvent, useState } from "react"
import { MessageSquareText, Search } from "lucide-react"
import { ForoActivo } from "@/client/components/dashboard/foro-activo"
import { Button } from "@/client/components/ui/button"
import { Input } from "@/client/components/ui/input"
import { cn } from "@/lib/utils"

type AssetType = "accion" | "bono" | "cap"

const ASSET_TYPES: Array<{ id: AssetType; label: string }> = [
  { id: "accion", label: "Acción" },
  { id: "bono", label: "Bono" },
  { id: "cap", label: "LECAP" },
]

export function ForumHub() {
  const [assetType, setAssetType] = useState<AssetType>("bono")
  const [draftTicker, setDraftTicker] = useState("AL29")
  const [ticker, setTicker] = useState("AL29")

  function submit(event: FormEvent) {
    event.preventDefault()
    const normalized = draftTicker.trim().toUpperCase()
    if (normalized) setTicker(normalized)
  }

  return (
    <div className="min-h-[calc(100vh-49px)] bg-[var(--bg)] p-4 md:p-6">
      <div className="mx-auto max-w-5xl">
        <div className="mb-5 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[var(--amber-soft)] text-[var(--amber)]"><MessageSquareText size={20} /></div>
          <div><h1 className="text-lg font-semibold text-[var(--text)]">Foro de activos</h1><p className="text-xs text-[var(--text-dim)]">Conversaciones por ticker, con respuestas y paginación.</p></div>
        </div>

        <form onSubmit={submit} className="mb-4 rounded-lg border border-[var(--border)] bg-[var(--bg-elev)] p-3">
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex gap-1">
              {ASSET_TYPES.map((item) => <button type="button" key={item.id} onClick={() => setAssetType(item.id)} className={cn("h-9 rounded-md border px-3 text-xs", assetType === item.id ? "border-[var(--amber)] bg-[var(--amber-soft)] text-[var(--amber)]" : "border-[var(--border)] text-[var(--text-dim)] hover:bg-[var(--bg-elev-2)]")}>{item.label}</button>)}
            </div>
            <div className="relative min-w-48 flex-1">
              <Search size={14} className="pointer-events-none absolute left-3 top-2.5 text-[var(--text-mute)]" />
              <Input value={draftTicker} onChange={(event) => setDraftTicker(event.target.value.toUpperCase())} placeholder="Ticker, por ejemplo AL29" className="pl-9 font-mono uppercase" maxLength={12} />
            </div>
            <Button type="submit" className="h-9 bg-[var(--amber)] text-[var(--bg)] hover:bg-[var(--amber)]/90">Abrir foro</Button>
          </div>
        </form>

        <ForoActivo key={`${assetType}-${ticker}`} assetType={assetType} ticker={ticker} />
      </div>
    </div>
  )
}
