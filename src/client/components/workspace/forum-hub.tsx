"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { formatDistanceToNow } from "date-fns"
import { es } from "date-fns/locale"
import { Flame, Hash, MessageSquareText, Search, X } from "lucide-react"
import { ForoActivo, type ForumAssetType } from "@/client/components/dashboard/foro-activo"
import { Button } from "@/client/components/ui/button"
import { Input } from "@/client/components/ui/input"
import { DATA_CARD_BY_ID, searchDataCards } from "@/lib/card-catalog"
import type { TickerFocus } from "@/lib/ticker-nav"
import { cn } from "@/lib/utils"

interface FeedPost {
  id: string
  assetType: ForumAssetType
  assetTicker: string
  authorName: string
  content: string
  parentId: string | null
  createdAt: string
}

interface Conversation {
  assetType: ForumAssetType
  tag: string
  messages: number
  lastActivity: string
}

interface ThreadRef {
  assetType: ForumAssetType
  tag: string
}

interface TrendingTopic {
  assetType: ForumAssetType
  ticker: string
  posts: number
}

function variableTitle(tag: string) {
  return DATA_CARD_BY_ID.get(tag.toLocaleLowerCase("es"))?.title ?? tag
}

function tagLabel(assetType: ForumAssetType, tag: string) {
  return assetType === "variable" ? variableTitle(tag) : tag
}

export function ForumHub({ initialFocus = null }: { initialFocus?: TickerFocus | null } = {}) {
  const [query, setQuery] = useState("")
  const [debouncedQuery, setDebouncedQuery] = useState("")
  const [activeTag, setActiveTag] = useState<string | null>(null)
  const [thread, setThread] = useState<ThreadRef | null>(null)
  const [posts, setPosts] = useState<FeedPost[]>([])
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [trending, setTrending] = useState<TrendingTopic[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [reloadKey, setReloadKey] = useState(0)
  const [showVariablePicker, setShowVariablePicker] = useState(false)
  const searchRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const timeout = window.setTimeout(() => setDebouncedQuery(query.trim()), 250)
    return () => window.clearTimeout(timeout)
  }, [query])

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams({ pageSize: "50" })
      if (debouncedQuery) params.set("q", debouncedQuery)
      if (activeTag) params.set("tag", activeTag)
      const response = await fetch(`/api/foro?${params.toString()}`, { cache: "no-store" })
      const payload = await response.json().catch(() => null)
      if (!response.ok || !payload || !Array.isArray(payload.data)) {
        throw new Error(payload?.error ?? "No se pudieron cargar las conversaciones")
      }
      setPosts(payload.data)
      setConversations(Array.isArray(payload.conversations) ? payload.conversations : [])
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "No se pudieron cargar las conversaciones")
    } finally {
      setLoading(false)
    }
  }, [activeTag, debouncedQuery, reloadKey])

  useEffect(() => { void load() }, [load])

  useEffect(() => {
    let cancelled = false
    fetch("/api/foro/trending?hours=24&limit=6", { cache: "no-store" })
      .then((response) => response.json())
      .then((payload) => {
        if (!cancelled && Array.isArray(payload?.data)) setTrending(payload.data)
      })
      .catch(() => { /* trending es un extra, no bloquea el resto del foro */ })
    return () => { cancelled = true }
  }, [reloadKey])

  const variableResults = useMemo(() => debouncedQuery || showVariablePicker ? searchDataCards(debouncedQuery).slice(0, 8) : [], [debouncedQuery, showVariablePicker])

  function openThread(assetType: ForumAssetType, tag: string) {
    setThread({ assetType, tag })
    setShowVariablePicker(false)
  }

  useEffect(() => {
    if (initialFocus) {
      setActiveTag(initialFocus.ticker)
      openThread(initialFocus.kind, initialFocus.ticker)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialFocus?.kind, initialFocus?.ticker])

  return (
    <div className="min-h-[calc(100vh-49px)] bg-[var(--bg)] p-4 md:p-6">
      <div className="mx-auto max-w-7xl">
        <div className="mb-5 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[var(--amber-soft)] text-[var(--amber)]"><MessageSquareText size={20} /></div>
          <div><h1 className="text-lg font-semibold text-[var(--text)]">Foro</h1><p className="text-xs text-[var(--text-dim)]">Todos los mensajes, organizados por la variable o tarjeta relacionada.</p></div>
        </div>

        <div className="mb-4 rounded-lg border border-[var(--border)] bg-[var(--bg-elev)] p-3">
          <div className="relative">
            <Search size={15} className="pointer-events-none absolute left-3 top-2.5 text-[var(--text-mute)]" />
            <Input ref={searchRef} value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar conversaciones, mensajes, autores o variables…" className="pl-9 pr-9" />
            {query && <button type="button" onClick={() => { setQuery(""); setActiveTag(null) }} className="absolute right-3 top-2.5 text-[var(--text-mute)] hover:text-[var(--text)]"><X size={14} /></button>}
          </div>

          {variableResults.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              <span className="mr-1 self-center text-[9px] uppercase tracking-wider text-[var(--text-mute)]">Abrir variable</span>
              {variableResults.map((card) => (
                <button key={card.id} onClick={() => openThread("variable", card.id.toUpperCase())} className="rounded-full border border-[var(--border)] px-2.5 py-1 text-[10px] text-[var(--text-dim)] hover:border-[var(--amber)] hover:text-[var(--amber)]">
                  {card.title}
                </button>
              ))}
            </div>
          )}

          {trending.length > 0 && (
            <div className="mt-3 flex items-center gap-1.5 overflow-x-auto pb-1">
              <span className="flex shrink-0 items-center gap-1 text-[9px] uppercase tracking-wider text-[var(--text-mute)]"><Flame size={10} className="text-[var(--amber)]" />Trending 24h</span>
              {trending.map((topic) => (
                <button
                  key={`${topic.assetType}-${topic.ticker}`}
                  onClick={() => { setActiveTag(topic.ticker); openThread(topic.assetType, topic.ticker) }}
                  className="flex shrink-0 items-center gap-1 rounded-full border border-[var(--border)] px-2.5 py-1 text-[10px] text-[var(--text-dim)] hover:border-[var(--amber)] hover:text-[var(--amber)]"
                >
                  <Hash size={10} />{tagLabel(topic.assetType, topic.ticker)} <span className="text-[var(--text-mute)]">{topic.posts}</span>
                </button>
              ))}
            </div>
          )}

          {conversations.length > 0 && (
            <div className="mt-3 flex gap-1.5 overflow-x-auto pb-1">
              <button onClick={() => setActiveTag(null)} className={cn("shrink-0 rounded-full border px-2.5 py-1 text-[10px]", !activeTag ? "border-[var(--amber)] bg-[var(--amber-soft)] text-[var(--amber)]" : "border-[var(--border)] text-[var(--text-dim)]")}>Todas</button>
              {conversations.map((conversation) => (
                <button key={`${conversation.assetType}-${conversation.tag}`} onClick={() => setActiveTag(activeTag === conversation.tag ? null : conversation.tag)} className={cn("flex shrink-0 items-center gap-1 rounded-full border px-2.5 py-1 text-[10px]", activeTag === conversation.tag ? "border-[var(--amber)] bg-[var(--amber-soft)] text-[var(--amber)]" : "border-[var(--border)] text-[var(--text-dim)] hover:text-[var(--text)]")}>
                  <Hash size={10} />{tagLabel(conversation.assetType, conversation.tag)} <span className="text-[var(--text-mute)]">{conversation.messages}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        <div className={cn("grid gap-4", thread ? "lg:grid-cols-[minmax(0,1fr)_minmax(340px,0.8fr)]" : "grid-cols-1")}>
          <section className="overflow-hidden rounded-lg border border-[var(--border)] bg-[var(--bg-elev)]">
            <div className="flex items-center justify-between border-b border-[var(--border)] px-4 py-3">
              <div><div className="text-xs font-semibold uppercase tracking-wider text-[var(--text)]">Mensajes recientes</div><div className="mt-0.5 text-[10px] text-[var(--text-mute)]">{activeTag ? `Filtrando por ${variableTitle(activeTag)}` : "Todas las conversaciones"}</div></div>
              <Button variant="outline" size="sm" onClick={() => { setQuery(""); setShowVariablePicker(true); searchRef.current?.focus() }} className="h-8 border-[var(--border)] text-[10px]">Nueva conversación</Button>
            </div>

            {loading ? <div className="p-10 text-center font-mono text-xs text-[var(--text-dim)]">Cargando…</div> : error ? <div className="p-10 text-center text-xs text-[var(--negative)]">{error}</div> : posts.length === 0 ? (
              <div className="p-10 text-center text-xs text-[var(--text-dim)]">No hay mensajes para esta búsqueda. Podés abrir una variable y empezar la conversación.</div>
            ) : (
              <div>
                {posts.map((post) => (
                  <article key={post.id} className="border-b border-[var(--border)] p-4 last:border-b-0 hover:bg-[var(--bg-elev-2)]/40">
                    <div className="mb-2 flex flex-wrap items-center gap-2">
                      <button onClick={() => { setActiveTag(post.assetTicker); openThread(post.assetType, post.assetTicker) }} className="flex items-center gap-1 rounded-full border border-[var(--amber)]/35 bg-[var(--amber-soft)] px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-[var(--amber)]"><Hash size={9} />{tagLabel(post.assetType, post.assetTicker)}</button>
                      <span className="text-[11px] font-semibold text-[var(--text)]">{post.authorName}</span>
                      <span className="font-mono text-[9px] text-[var(--text-mute)]">hace {formatDistanceToNow(new Date(post.createdAt), { locale: es })}</span>
                    </div>
                    <p className="whitespace-pre-wrap text-xs leading-5 text-[var(--text-dim)]">{post.content}</p>
                    <button onClick={() => openThread(post.assetType, post.assetTicker)} className="mt-2 text-[9px] font-medium uppercase tracking-wider text-[var(--text-mute)] hover:text-[var(--amber)]">Abrir conversación →</button>
                  </article>
                ))}
              </div>
            )}
          </section>

          {thread && (
            <aside className="relative overflow-hidden rounded-lg border border-[var(--border)] bg-[var(--bg-elev)] lg:sticky lg:top-28 lg:max-h-[calc(100vh-8rem)] lg:overflow-y-auto">
              <button onClick={() => setThread(null)} className="absolute right-3 top-3 z-10 text-[var(--text-mute)] hover:text-[var(--text)]" title="Cerrar conversación"><X size={15} /></button>
              <ForoActivo key={`${thread.assetType}-${thread.tag}`} assetType={thread.assetType} ticker={thread.tag} compact onPost={() => setReloadKey((value) => value + 1)} />
            </aside>
          )}
        </div>
      </div>
    </div>
  )
}
