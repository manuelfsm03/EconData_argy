"use client"

import { useEffect, useState } from "react"
import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"
import { FileText, Plus, X } from "lucide-react"

interface ReportListItem {
  id: string
  title: string
  body: string
  createdAt: string
  author: { username: string; displayName: string | null }
}

function fechaCorta(iso: string): string {
  return new Intl.DateTimeFormat("es-AR", { day: "2-digit", month: "short", year: "numeric" }).format(new Date(iso))
}

function extracto(markdown: string, maxChars = 180): string {
  const sinFormato = markdown.replace(/[#*_`>[\]()-]/g, " ").replace(/\s+/g, " ").trim()
  return sinFormato.length > maxChars ? `${sinFormato.slice(0, maxChars)}…` : sinFormato
}

function ComposeForm({ onPublished, onCancel }: { onPublished: () => void; onCancel: () => void }) {
  const [title, setTitle] = useState("")
  const [body, setBody] = useState("")
  const [preview, setPreview] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function publicar(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    try {
      const response = await fetch("/api/informes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, body }),
      })
      const payload = await response.json().catch(() => null)
      if (!response.ok) throw new Error(payload?.error?.message ?? "No se pudo publicar")
      onPublished()
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo publicar")
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={publicar} className="mb-4 rounded-lg border border-[var(--border)] bg-[var(--bg-elev)] p-4">
      <div className="mb-3 flex items-center justify-between">
        <span className="text-xs font-semibold text-[var(--text)]">Nuevo informe</span>
        <button type="button" onClick={onCancel} className="text-[var(--text-mute)] hover:text-[var(--text)]"><X size={15} /></button>
      </div>
      <input
        value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Título"
        className="mb-2 h-9 w-full rounded-md border border-[var(--border)] bg-[var(--bg)] px-3 text-sm text-[var(--text)] outline-none focus:border-[var(--amber)]"
        required maxLength={200}
      />
      <div className="mb-2 flex gap-1">
        <button type="button" onClick={() => setPreview(false)} className={`rounded px-2 py-1 text-[10px] ${!preview ? "bg-[var(--amber-soft)] text-[var(--amber)]" : "text-[var(--text-dim)]"}`}>Escribir</button>
        <button type="button" onClick={() => setPreview(true)} className={`rounded px-2 py-1 text-[10px] ${preview ? "bg-[var(--amber-soft)] text-[var(--amber)]" : "text-[var(--text-dim)]"}`}>Vista previa</button>
      </div>
      {preview ? (
        <div className="prose prose-invert prose-sm mb-2 min-h-[220px] max-w-none rounded-md border border-[var(--border)] bg-[var(--bg)] p-3 text-[var(--text)]">
          <ReactMarkdown remarkPlugins={[remarkGfm]}>{body || "*(sin contenido todavía)*"}</ReactMarkdown>
        </div>
      ) : (
        <textarea
          value={body} onChange={(e) => setBody(e.target.value)}
          placeholder="Cómo vemos la coyuntura… (admite Markdown: **negrita**, [links](url), listas con -)"
          rows={10} maxLength={20000}
          className="mb-2 w-full rounded-md border border-[var(--border)] bg-[var(--bg)] p-3 text-sm text-[var(--text)] outline-none focus:border-[var(--amber)]"
          required
        />
      )}
      {error && <p className="mb-2 text-xs text-[var(--negative)]">{error}</p>}
      <button type="submit" disabled={loading} className="h-9 rounded-md bg-[var(--amber)] px-4 text-xs font-semibold text-black disabled:opacity-50">
        {loading ? "Publicando…" : "Publicar"}
      </button>
    </form>
  )
}

export function ReportsWorkspace() {
  const [reports, setReports] = useState<ReportListItem[] | null>(null)
  const [selected, setSelected] = useState<ReportListItem | null>(null)
  const [canPublish, setCanPublish] = useState(false)
  const [composing, setComposing] = useState(false)

  function cargarInformes() {
    fetch("/api/informes").then((r) => r.json()).then((j) => setReports(j.data ?? []))
  }

  useEffect(() => {
    cargarInformes()
    fetch("/api/auth/me").then((r) => r.json()).then((j) => setCanPublish(Boolean(j.data?.canPublish)))
  }, [])

  return (
    <div className="min-h-[calc(100vh-49px)] bg-[var(--bg)] p-4 md:p-6">
      <div className="mx-auto max-w-3xl">
        <div className="mb-5 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[var(--amber-soft)] text-[var(--amber)]"><FileText size={20} /></div>
          <div className="flex-1">
            <h1 className="text-lg font-semibold text-[var(--text)]">Informes</h1>
            <p className="text-xs text-[var(--text-dim)]">Cómo vemos la coyuntura.</p>
          </div>
          {canPublish && !composing && (
            <button onClick={() => setComposing(true)} className="flex h-9 items-center gap-1.5 rounded-md bg-[var(--amber)] px-3 text-xs font-semibold text-black">
              <Plus size={14} /> Nuevo informe
            </button>
          )}
        </div>

        {composing && (
          <ComposeForm
            onCancel={() => setComposing(false)}
            onPublished={() => { setComposing(false); cargarInformes() }}
          />
        )}

        {selected ? (
          <article className="rounded-lg border border-[var(--border)] bg-[var(--bg-elev)] p-5">
            <button onClick={() => setSelected(null)} className="mb-3 text-[10px] text-[var(--text-mute)] hover:text-[var(--amber)]">← Volver</button>
            <h2 className="mb-1 text-base font-semibold text-[var(--text)]">{selected.title}</h2>
            <p className="mb-4 text-[10px] text-[var(--text-mute)]">
              {selected.author.displayName ?? `@${selected.author.username}`} · {fechaCorta(selected.createdAt)}
            </p>
            <div className="prose prose-invert prose-sm max-w-none text-[var(--text)]">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>{selected.body}</ReactMarkdown>
            </div>
          </article>
        ) : reports === null ? (
          <div className="p-10 text-center text-xs text-[var(--text-dim)]">Cargando…</div>
        ) : reports.length === 0 ? (
          <div className="p-10 text-center text-xs text-[var(--text-dim)]">
            Todavía no hay informes publicados{canPublish ? " — arrancá con el primero." : "."}
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {reports.map((report) => (
              <button
                key={report.id} onClick={() => setSelected(report)}
                className="rounded-lg border border-[var(--border)] bg-[var(--bg-elev)] p-4 text-left transition hover:border-[var(--amber)]/50"
              >
                <div className="mb-1 flex items-center justify-between gap-2">
                  <h3 className="text-sm font-semibold text-[var(--text)]">{report.title}</h3>
                  <span className="shrink-0 text-[9px] text-[var(--text-mute)]">{fechaCorta(report.createdAt)}</span>
                </div>
                <p className="mb-2 text-xs text-[var(--text-dim)]">{extracto(report.body)}</p>
                <p className="text-[9px] text-[var(--text-mute)]">{report.author.displayName ?? `@${report.author.username}`}</p>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
