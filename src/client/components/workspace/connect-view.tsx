"use client"

import { useState } from "react"
import { Cable, Check, Clipboard, Database, ExternalLink, MessageCircle, ShieldCheck, Sparkles, Terminal } from "lucide-react"
import { Button } from "@/client/components/ui/button"
import { DATA_CARD_CATALOG } from "@/lib/card-catalog"

const MCP_URL = "https://www.lapizarra.ar/api/mcp"
const CODEX_COMMAND = `codex mcp add lapizarra --url ${MCP_URL}`
const TOML_CONFIG = `[mcp_servers.lapizarra]\nurl = "${MCP_URL}"`

function CopyButton({ value, label = "Copiar" }: { value: string; label?: string }) {
  const [copied, setCopied] = useState(false)

  async function copy() {
    await navigator.clipboard.writeText(value)
    setCopied(true)
    window.setTimeout(() => setCopied(false), 1800)
  }

  return (
    <Button type="button" variant="outline" size="sm" onClick={copy} className="h-8 shrink-0 border-[var(--border)] text-[10px]">
      {copied ? <Check size={12} className="mr-1.5 text-[var(--positive)]" /> : <Clipboard size={12} className="mr-1.5" />}
      {copied ? "Copiado" : label}
    </Button>
  )
}

function CodeBlock({ value }: { value: string }) {
  return (
    <div className="flex items-start gap-2 rounded-md border border-[var(--border)] bg-[var(--bg)] p-3">
      <code className="min-w-0 flex-1 overflow-x-auto whitespace-pre font-mono text-[10px] leading-5 text-[var(--text-dim)]">{value}</code>
      <CopyButton value={value} />
    </div>
  )
}

export function ConnectView() {
  return (
    <main className="min-h-[calc(100vh-49px)] bg-[var(--bg)] p-4 md:p-6">
      <div className="mx-auto max-w-5xl">
        <div className="mb-6 flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[var(--amber-soft)] text-[var(--amber)]"><Cable size={20} /></div>
          <div>
            <h1 className="text-lg font-semibold text-[var(--text)]">Conectar La Pizarra</h1>
            <p className="mt-1 max-w-2xl text-xs leading-5 text-[var(--text-dim)]">Usá los datos económicos de La Pizarra directamente desde Claude, Codex o cualquier cliente compatible con MCP. El acceso es público, de solo lectura y no requiere una API key.</p>
          </div>
        </div>

        <section className="mb-4 overflow-hidden rounded-lg border border-[var(--amber)]/35 bg-[var(--bg-elev)]">
          <div className="border-b border-[var(--border)] px-4 py-3">
            <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--amber)]">URL del servidor MCP</div>
          </div>
          <div className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center">
            <code className="min-w-0 flex-1 overflow-x-auto whitespace-nowrap font-mono text-xs text-[var(--text)]">{MCP_URL}</code>
            <CopyButton value={MCP_URL} label="Copiar URL" />
          </div>
        </section>

        <section className="mb-4 overflow-hidden rounded-lg border border-[var(--amber)]/50 bg-[var(--bg-elev)]">
          <div className="flex flex-wrap items-center gap-2 border-b border-[var(--border)] bg-[var(--amber-soft)] px-4 py-3">
            <MessageCircle size={17} className="text-[var(--amber)]" />
            <h2 className="text-sm font-semibold text-[var(--text)]">Conectar en Claude</h2>
            <span className="rounded-full border border-[var(--amber)]/40 bg-[var(--bg-elev)] px-2 py-0.5 text-[8px] font-semibold uppercase tracking-wider text-[var(--amber)]">Principal</span>
          </div>
          <div className="grid gap-5 p-4 lg:grid-cols-[minmax(0,1.45fr)_minmax(240px,0.75fr)]">
            <div>
              <div className="mb-3 text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--text-mute)]">Claude Free, Pro o Max</div>
              <ol className="space-y-3 text-xs leading-5 text-[var(--text-dim)]">
                <li><span className="mr-2 font-mono text-[var(--amber)]">1.</span>En Claude, abrí <strong className="text-[var(--text)]">Customize → Connectors</strong>.</li>
                <li><span className="mr-2 font-mono text-[var(--amber)]">2.</span>Presioná <strong className="text-[var(--text)]">+</strong> y elegí <strong className="text-[var(--text)]">Add custom connector</strong>.</li>
                <li><span className="mr-2 font-mono text-[var(--amber)]">3.</span>Escribí <code className="font-mono text-[var(--text)]">La Pizarra</code> como nombre y pegá la URL MCP de arriba.</li>
                <li><span className="mr-2 font-mono text-[var(--amber)]">4.</span>Confirmá con <strong className="text-[var(--text)]">Add</strong>. No hace falta configurar OAuth, token ni cabeceras.</li>
                <li><span className="mr-2 font-mono text-[var(--amber)]">5.</span>En una conversación, abrí <strong className="text-[var(--text)]">+ → Connectors</strong> y activá <strong className="text-[var(--text)]">La Pizarra</strong>.</li>
              </ol>
            </div>
            <div className="rounded-md border border-[var(--border)] bg-[var(--bg)] p-3">
              <div className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--text-mute)]">Team y Enterprise</div>
              <p className="mt-2 text-[10px] leading-4 text-[var(--text-dim)]">Un owner debe agregarlo desde <strong className="text-[var(--text)]">Organization settings → Connectors → Add → Custom → Web</strong>. Después, cada miembro lo habilita desde <strong className="text-[var(--text)]">Customize → Connectors</strong>.</p>
              <a href="https://support.claude.com/en/articles/11175166-get-started-with-custom-connectors-using-remote-mcp" target="_blank" rel="noreferrer" className="mt-3 inline-flex items-center gap-1.5 text-[10px] font-medium text-[var(--amber)] hover:underline">
                Ver guía oficial de Claude <ExternalLink size={11} />
              </a>
            </div>
          </div>
        </section>

        <div className="grid gap-4 lg:grid-cols-2">
          <section className="min-w-0 rounded-lg border border-[var(--border)] bg-[var(--bg-elev)] p-4">
            <div className="mb-4 flex items-center gap-2"><Terminal size={16} className="text-[var(--amber)]" /><h2 className="text-sm font-semibold text-[var(--text)]">Conectar en Codex</h2></div>
            <ol className="mb-4 space-y-3 text-xs leading-5 text-[var(--text-dim)]">
              <li><span className="mr-2 font-mono text-[var(--amber)]">1.</span>Abrí una terminal y ejecutá:</li>
            </ol>
            <CodeBlock value={CODEX_COMMAND} />
            <p className="my-3 text-[10px] text-[var(--text-mute)]">También podés agregarlo manualmente en <code className="font-mono">~/.codex/config.toml</code>:</p>
            <CodeBlock value={TOML_CONFIG} />
            <p className="mt-3 text-[10px] leading-4 text-[var(--text-mute)]">Reiniciá la sesión o abrí una nueva. El servidor aparecerá como <strong className="text-[var(--text-dim)]">lapizarra</strong>.</p>
          </section>

          <section className="min-w-0 rounded-lg border border-[var(--border)] bg-[var(--bg-elev)] p-4">
            <div className="mb-4 flex items-center gap-2"><Sparkles size={16} className="text-[var(--amber)]" /><h2 className="text-sm font-semibold text-[var(--text)]">Otros clientes MCP</h2></div>
            <ol className="space-y-3 text-xs leading-5 text-[var(--text-dim)]">
              <li><span className="mr-2 font-mono text-[var(--amber)]">1.</span>Abrí la configuración de conectores o servidores MCP.</li>
              <li><span className="mr-2 font-mono text-[var(--amber)]">2.</span>Elegí <strong className="text-[var(--text)]">HTTP remoto</strong> o <strong className="text-[var(--text)]">Streamable HTTP</strong>.</li>
              <li><span className="mr-2 font-mono text-[var(--amber)]">3.</span>Usá el nombre <code className="font-mono text-[var(--text)]">lapizarra</code> y pegá la URL indicada arriba.</li>
              <li><span className="mr-2 font-mono text-[var(--amber)]">4.</span>No configures token, OAuth ni cabeceras adicionales.</li>
            </ol>
          </section>
        </div>

        <section className="mt-4 rounded-lg border border-[var(--border)] bg-[var(--bg-elev)] p-4">
          <div className="mb-4 flex items-center gap-2"><Database size={16} className="text-[var(--amber)]" /><h2 className="text-sm font-semibold text-[var(--text)]">Qué podés consultar</h2></div>
          <div className="grid gap-3 sm:grid-cols-3">
            {[
              ["buscar_indicadores", `${DATA_CARD_CATALOG.length} tarjetas económicas por tema o categoría.`],
              ["consultar_indicador", "Datos actuales de una fuente registrada, con fecha y procedencia."],
              ["estado_fuentes", "Disponibilidad del monitor público de proveedores."],
            ].map(([name, description]) => (
              <div key={name} className="rounded-md border border-[var(--border)] bg-[var(--bg)] p-3">
                <code className="font-mono text-[10px] font-semibold text-[var(--amber)]">{name}</code>
                <p className="mt-2 text-[10px] leading-4 text-[var(--text-dim)]">{description}</p>
              </div>
            ))}
          </div>
          <div className="mt-4 rounded-md bg-[var(--amber-soft)] px-3 py-2 text-[10px] leading-4 text-[var(--text-dim)]">
            Probá: “Buscá el IPC de Argentina en La Pizarra, consultá su fuente y decime la fecha de actualización”.
          </div>
        </section>

        <div className="mt-4 flex items-start gap-2 rounded-lg border border-[var(--border)] px-4 py-3 text-[10px] leading-4 text-[var(--text-mute)]">
          <ShieldCheck size={15} className="mt-0.5 shrink-0 text-[var(--positive)]" />
          <p>El MCP solo expone consultas de lectura incluidas en el catálogo público. No publica en el foro, no modifica tu Canvas y no recibe credenciales.</p>
        </div>
      </div>
    </main>
  )
}
