"use client"

import { useState, useEffect, useCallback, useRef, type ReactNode } from "react"
import { formatDistanceToNow } from "date-fns"
import { es } from "date-fns/locale"

interface ForumPost {
  id: string
  authorName: string
  content: string
  parentId: string | null
  parent: { authorName: string; content: string } | null
  createdAt: string
  reacciones: Record<string, number>
  miReaccion: string | null
}

export type ForumAssetType = "accion" | "bono" | "cap" | "variable"

interface ForoActivoProps {
  assetType: ForumAssetType
  ticker: string
  compact?: boolean
  onPost?: () => void
  onTickerClick?: (ticker: string) => void
}

const PAGE_SIZE = 20
const EMOJIS = ["👍", "🔥", "🤔"] as const
const AUTHOR_KEY = "foro_author_name"
const MY_POSTS_KEY = "foro_my_posts" // { [postId]: deleteToken } — para borrar los propios
const POLL_MS = 20000               // cada cuánto chequeamos si hay posts nuevos

// Lee el mapa de posts propios (id → token) desde localStorage
function readMyPosts(): Record<string, string> {
  try {
    return JSON.parse(localStorage.getItem(MY_POSTS_KEY) || "{}")
  } catch {
    return {}
  }
}

// Renderiza el contenido de un post con formato ligero:
//  - $TICKER  → chip clicable
//  - **texto** → negrita, *texto* → itálica
//  - URLs (http/https) → link clicable
// Tokeniza en una sola pasada respetando el orden de aparición.
const INLINE_RE = /(https?:\/\/[^\s]+)|(\$[A-Z0-9]{2,10})|(\*\*[^*]+\*\*)|(\*[^*]+\*)/g

function PostContent({ content, onTickerClick }: { content: string; onTickerClick?: (t: string) => void }) {
  const nodes: ReactNode[] = []
  let lastIndex = 0
  let match: RegExpExecArray | null
  INLINE_RE.lastIndex = 0

  while ((match = INLINE_RE.exec(content)) !== null) {
    // Texto plano previo al token
    if (match.index > lastIndex) {
      nodes.push(content.slice(lastIndex, match.index))
    }
    const [full, url, ticker, bold, italic] = match
    const key = match.index

    if (url) {
      nodes.push(
        <a key={key} href={url} target="_blank" rel="noopener noreferrer"
          style={{ color: "var(--amber)", textDecoration: "underline", wordBreak: "break-all" }}>
          {url}
        </a>
      )
    } else if (ticker) {
      const tk = ticker.slice(1)
      nodes.push(
        <button key={key} onClick={() => onTickerClick?.(tk)} style={{
          background: "rgba(255,160,40,0.1)", border: "1px solid rgba(255,160,40,0.35)",
          borderRadius: 3, color: "var(--amber)", fontFamily: "var(--font-data)",
          fontSize: 10, fontWeight: 700, padding: "0 4px",
          cursor: onTickerClick ? "pointer" : "default", margin: "0 1px",
        }}>
          {ticker}
        </button>
      )
    } else if (bold) {
      nodes.push(<strong key={key} style={{ fontWeight: 700 }}>{bold.slice(2, -2)}</strong>)
    } else if (italic) {
      nodes.push(<em key={key} style={{ fontStyle: "italic" }}>{italic.slice(1, -1)}</em>)
    }

    lastIndex = match.index + full.length
  }
  // Cola de texto plano restante
  if (lastIndex < content.length) {
    nodes.push(content.slice(lastIndex))
  }

  return (
    <span style={{ fontSize: 11, color: "var(--text)", fontFamily: "var(--font-ui)", whiteSpace: "pre-wrap", lineHeight: 1.4 }}>
      {nodes}
    </span>
  )
}

// Fila de reacciones de un post
function ReactionBar({
  postId,
  reacciones,
  miReaccion,
  onReact,
}: {
  postId: string
  reacciones: Record<string, number>
  miReaccion: string | null
  onReact: (postId: string, emoji: string, newReacciones: Record<string, number>, newMia: string | null) => void
}) {
  const [loading, setLoading] = useState(false)

  async function handleReact(emoji: string) {
    if (loading) return
    setLoading(true)
    try {
      const res = await fetch("/api/foro/react", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ postId, emoji }),
      })
      if (res.ok) {
        const j = await res.json()
        onReact(postId, emoji, j.reacciones, j.miReaccion)
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ display: "flex", gap: 4, marginTop: 4 }}>
      {EMOJIS.map(emoji => {
        const count = reacciones[emoji] ?? 0
        const active = miReaccion === emoji
        return (
          <button
            key={emoji}
            onClick={() => handleReact(emoji)}
            disabled={loading}
            style={{
              display: "flex", alignItems: "center", gap: 3,
              background: active ? "rgba(255,160,40,0.12)" : "transparent",
              border: active ? "1px solid rgba(255,160,40,0.4)" : "1px solid var(--border)",
              borderRadius: 20, padding: "1px 6px", cursor: "pointer",
              fontSize: 10, fontFamily: "var(--font-data)",
              color: active ? "var(--amber)" : "var(--text-dim)",
              opacity: loading ? 0.5 : 1,
              transition: "all 0.15s",
            }}
          >
            <span style={{ fontSize: 11 }}>{emoji}</span>
            {count > 0 && <span>{count}</span>}
          </button>
        )
      })}
    </div>
  )
}

export function ForoActivo({ assetType, ticker, compact = false, onPost, onTickerClick }: ForoActivoProps) {
  const [posts, setPosts] = useState<ForumPost[]>([])
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [loading, setLoading] = useState(true)
  const [authorName, setAuthorName] = useState("")
  const [content, setContent] = useState("")
  const [replyTo, setReplyTo] = useState<ForumPost | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  // Búsqueda (input inmediato + valor con debounce que dispara el fetch) y orden
  const [searchInput, setSearchInput] = useState("")
  const [query, setQuery] = useState("")
  const [sort, setSort] = useState<"cron" | "votados">("cron")
  // Posts propios (id→token) para el botón de borrar
  const [myPosts, setMyPosts] = useState<Record<string, string>>({})
  // Auto-refresh: total conocido + cuántos posts nuevos hay sin ver
  const [newCount, setNewCount] = useState(0)
  const totalRef = useRef(0)        // total según la última carga que vio el usuario
  const pendingTotalRef = useRef(0) // total según el último poll (para saltar a la última página)

  // Persistir nombre en localStorage
  useEffect(() => {
    const saved = localStorage.getItem(AUTHOR_KEY)
    if (saved) setAuthorName(saved)
    setMyPosts(readMyPosts())
  }, [])

  useEffect(() => {
    if (authorName) localStorage.setItem(AUTHOR_KEY, authorName)
  }, [authorName])

  // Debounce del texto de búsqueda (300ms) para no pegarle a la API en cada tecla
  useEffect(() => {
    const t = setTimeout(() => setQuery(searchInput.trim()), 300)
    return () => clearTimeout(t)
  }, [searchInput])

  const load = useCallback(async (p: number) => {
    setLoading(true)
    setError(null)
    const params = new URLSearchParams({ page: String(p), pageSize: String(PAGE_SIZE), sort })
    if (query) params.set("q", query)
    try {
      const response = await fetch(`/api/foro/${assetType}/${ticker}?${params.toString()}`)
      const payload = await response.json().catch(() => null)
      if (!response.ok || !payload || !Array.isArray(payload.data)) {
        throw new Error(payload?.error ?? "No se pudo cargar el foro")
      }
      setPosts(payload.data)
      setTotalPages(payload.totalPages ?? 1)
      totalRef.current = payload.total ?? 0
      pendingTotalRef.current = payload.total ?? 0
      setNewCount(0)
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "No se pudo cargar el foro")
    } finally {
      setLoading(false)
    }
  }, [assetType, ticker, query, sort])

  useEffect(() => {
    setPage(1)
    setReplyTo(null)
    setSearchInput("")
    setQuery("")
    setSort("cron")
  }, [assetType, ticker])

  // Al cambiar búsqueda u orden, volvemos a la primera página
  useEffect(() => { setPage(1) }, [query, sort])

  useEffect(() => { load(page) }, [load, page])

  // Auto-refresh: chequeamos el total cada POLL_MS solo en la vista "viva"
  // (orden cronológico y sin búsqueda). Si crece, mostramos "Ver nuevos (N)".
  useEffect(() => {
    if (query || sort !== "cron") return
    const id = setInterval(async () => {
      try {
        const res = await fetch(`/api/foro/${assetType}/${ticker}?page=1&pageSize=1&sort=cron`)
        const j = await res.json()
        const serverTotal = j.total ?? 0
        if (serverTotal > totalRef.current) {
          pendingTotalRef.current = serverTotal
          setNewCount(serverTotal - totalRef.current)
        }
      } catch {
        /* silencioso: es un chequeo en background */
      }
    }, POLL_MS)
    return () => clearInterval(id)
  }, [assetType, ticker, query, sort])

  // Al tocar "Ver nuevos": vamos a la última página (los nuevos entran al final en orden cronológico)
  function handleVerNuevos() {
    const lastPage = Math.max(1, Math.ceil(pendingTotalRef.current / PAGE_SIZE))
    setNewCount(0)
    if (page === lastPage) load(page)
    else setPage(lastPage)
  }

  // Actualiza reacciones de un post en el estado local sin refetch
  function handleReact(postId: string, _emoji: string, newReacciones: Record<string, number>, newMia: string | null) {
    setPosts(prev => prev.map(p => p.id === postId ? { ...p, reacciones: newReacciones, miReaccion: newMia } : p))
  }

  async function handleSubmit() {
    if (submitting) return
    setError(null)
    setSubmitting(true)
    try {
      const res = await fetch(`/api/foro/${assetType}/${ticker}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ authorName, content, parentId: replyTo?.id }),
      })
      const j = await res.json()
      if (!res.ok) {
        setError(j.error ?? "No se pudo publicar el mensaje")
        return
      }
      // Guardamos el token del post recién creado para poder borrarlo luego
      if (j.data?.id && j.deleteToken) {
        const next = { ...readMyPosts(), [j.data.id]: j.deleteToken }
        localStorage.setItem(MY_POSTS_KEY, JSON.stringify(next))
        setMyPosts(next)
      }
      setContent("")
      setReplyTo(null)
      const createdPage = Number.isInteger(j.page) && j.page > 0 ? j.page : 1
      setTotalPages(Number.isInteger(j.totalPages) && j.totalPages > 0 ? j.totalPages : createdPage)
      if (page === createdPage) await load(createdPage)
      else setPage(createdPage)
      onPost?.()
    } catch {
      setError("No se pudo publicar el mensaje")
    } finally {
      setSubmitting(false)
    }
  }

  // Borra un post propio usando el token guardado en localStorage
  async function handleDelete(postId: string) {
    const token = myPosts[postId]
    if (!token) return
    if (!confirm("¿Borrar este post? No se puede deshacer.")) return
    try {
      const res = await fetch(`/api/foro/${assetType}/${ticker}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ postId, token }),
      })
      if (!res.ok) {
        const j = await res.json().catch(() => ({}))
        setError(j.error ?? "No se pudo borrar el post")
        return
      }
      // Sacamos el post del localStorage y recargamos
      const next = readMyPosts()
      delete next[postId]
      localStorage.setItem(MY_POSTS_KEY, JSON.stringify(next))
      setMyPosts(next)
      load(page)
    } catch {
      setError("No se pudo borrar el post")
    }
  }

  return (
    <div className="bbg-panel" style={{ marginTop: compact ? 0 : 1, border: compact ? "none" : undefined }}>
      <div className="bbg-panel-header">Foro · {ticker}</div>

      <div style={{ padding: "10px 14px" }}>
        {/* Barra de búsqueda + orden */}
        <div style={{ display: "flex", gap: 6, alignItems: "center", marginBottom: 10, flexWrap: "wrap" }}>
          <input
            type="text"
            placeholder="Buscar en el foro…"
            value={searchInput}
            onChange={e => setSearchInput(e.target.value)}
            style={{
              flex: "1 1 140px", background: "var(--bg-elev-2)", border: "1px solid var(--border)",
              color: "var(--text)", padding: "3px 8px", fontSize: 10, outline: "none",
              fontFamily: "var(--font-ui)", borderRadius: 2,
            }}
          />
          {searchInput && (
            <button onClick={() => setSearchInput("")} style={{
              background: "none", border: "none", color: "var(--text-dim)", cursor: "pointer", fontSize: 11, padding: "0 2px",
            }}>✕</button>
          )}
          <div style={{ display: "flex", gap: 0, border: "1px solid var(--border)", borderRadius: 20, overflow: "hidden" }}>
            {([["cron", "Reciente"], ["votados", "Más votados"]] as const).map(([key, label]) => (
              <button key={key} onClick={() => setSort(key)} style={{
                fontSize: 9, fontFamily: "var(--font-data)", padding: "3px 10px", cursor: "pointer", border: "none",
                background: sort === key ? "rgba(255,160,40,0.12)" : "transparent",
                color: sort === key ? "var(--amber)" : "var(--text-dim)",
              }}>{label}</button>
            ))}
          </div>
        </div>

        {/* Aviso de posts nuevos (auto-refresh) */}
        {newCount > 0 && (
          <button onClick={handleVerNuevos} style={{
            width: "100%", marginBottom: 10, padding: "5px 0", cursor: "pointer",
            background: "rgba(255,160,40,0.12)", border: "1px solid rgba(255,160,40,0.4)", borderRadius: 2,
            color: "var(--amber)", fontFamily: "var(--font-data)", fontSize: 10,
          }}>
            🔄 Ver {newCount} {newCount === 1 ? "post nuevo" : "posts nuevos"}
          </button>
        )}

        {loading ? (
          <div style={{ padding: 20, textAlign: "center", color: "var(--text-dim)", fontFamily: "var(--font-data)", fontSize: 10 }}>
            Cargando…
          </div>
        ) : posts.length === 0 ? (
          <div style={{ padding: 20, textAlign: "center", color: "var(--text-dim)", fontFamily: "var(--font-data)", fontSize: 10 }}>
            {query
              ? `Sin resultados para "${query}".`
              : `Sin posts todavía. Sé el primero en comentar ${ticker}.`}
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 12 }}>
            {posts.map(post => {
              return (
                <div key={post.id} style={{ borderBottom: "1px solid var(--bg-elev-2)", paddingBottom: 8 }}>
                  {post.parentId && (
                    <div style={{
                      borderLeft: "2px solid var(--border-hi)",
                      padding: "3px 8px",
                      marginBottom: 4,
                      fontSize: 9,
                      color: "var(--text-dim)",

                      fontFamily: "var(--font-ui)",
                    }}>
                      {post.parent ? (
                        <>
                          <span style={{ color: "var(--amber)", fontWeight: 600 }}>{post.parent.authorName}</span>
                          {": "}
                          {post.parent.content.length >= 100 ? `${post.parent.content.slice(0, 80)}…` : post.parent.content}
                        </>

                      ) : (
                        "Respuesta a un post eliminado"
                      )}
                    </div>
                  )}
                  <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginBottom: 2 }}>
                    <span style={{ fontSize: 11, fontWeight: 700, color: "var(--amber)", fontFamily: "var(--font-ui)" }}>
                      {post.authorName}
                    </span>
                    <span style={{ fontSize: 9, color: "var(--text-dim)", fontFamily: "var(--font-data)" }}>
                      hace {formatDistanceToNow(new Date(post.createdAt), { locale: es })}
                    </span>
                  </div>
                  <PostContent content={post.content} onTickerClick={onTickerClick} />
                  <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 4 }}>
                    <ReactionBar
                      postId={post.id}
                      reacciones={post.reacciones}
                      miReaccion={post.miReaccion}
                      onReact={handleReact}
                    />
                    <button
                      onClick={() => setReplyTo(post)}
                      style={{
                        background: "none", border: "none", cursor: "pointer",
                        fontSize: 9, color: "var(--text-mute)", fontFamily: "var(--font-data)", padding: 0,
                      }}
                    >
                      ↩ Responder
                    </button>
                    {myPosts[post.id] && (
                      <button
                        onClick={() => handleDelete(post.id)}
                        style={{
                          background: "none", border: "none", cursor: "pointer",
                          fontSize: 9, color: "var(--negative)", fontFamily: "var(--font-data)", padding: 0,
                        }}
                      >
                        🗑 Borrar
                      </button>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {totalPages > 1 && (
          <div style={{ display: "flex", gap: 4, flexWrap: "wrap", marginBottom: 12 }}>
            {Array.from({ length: totalPages }, (_, i) => i + 1).map(p => (
              <button key={p} onClick={() => setPage(p)} style={{
                fontSize: 9, fontFamily: "var(--font-data)", padding: "2px 8px", borderRadius: 20, cursor: "pointer",
                background: page === p ? "rgba(255,160,40,0.12)" : "transparent",
                border: page === p ? "1px solid rgba(255,160,40,0.4)" : "1px solid var(--border)",
                color: page === p ? "var(--amber)" : "var(--text-dim)",
              }}>{p}</button>
            ))}
          </div>
        )}

        <div style={{ background: "var(--bg-row-alt)", border: "1px solid var(--bg-elev-2)", padding: 10 }}>
          {replyTo && (
            <div style={{
              display: "flex", justifyContent: "space-between", alignItems: "center",
              fontSize: 9, color: "var(--text-dim)", marginBottom: 6, fontFamily: "var(--font-data)",
            }}>
              <span>Respondiendo a <span style={{ color: "var(--amber)" }}>{replyTo.authorName}</span></span>
              <button onClick={() => setReplyTo(null)} style={{ background: "none", border: "none", color: "var(--text-dim)", cursor: "pointer", fontSize: 11 }}>✕</button>
            </div>
          )}
          <input
            type="text"
            placeholder="Tu nombre"
            value={authorName}
            maxLength={40}
            onChange={e => setAuthorName(e.target.value)}
            style={{
              width: "100%", background: "var(--bg-elev-2)", border: "1px solid var(--border-hi)",
              color: "var(--text)", padding: "4px 8px", fontSize: 11, outline: "none",
              fontFamily: "var(--font-ui)", marginBottom: 6, borderRadius: 2,
            }}
          />
          <textarea
            placeholder={`Escribí un mensaje sobre ${ticker}… Podés mencionar otros activos con $TICKER`}
            value={content}
            maxLength={2000}
            onChange={e => setContent(e.target.value)}
            style={{
              width: "100%", background: "var(--bg-elev-2)", border: "1px solid var(--border-hi)",
              color: "var(--text)", padding: "4px 8px", fontSize: 11, outline: "none",
              fontFamily: "var(--font-ui)", resize: "vertical", minHeight: compact ? 48 : 60, borderRadius: 2,
            }}
          />
          {error && (
            <div style={{ fontSize: 9, color: "var(--negative)", marginTop: 4, fontFamily: "var(--font-data)" }}>{error}</div>
          )}
          <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 6 }}>
            <button
              onClick={handleSubmit}
              disabled={submitting || authorName.trim().length < 2 || content.trim().length < 1}
              style={{
                fontSize: 10, fontFamily: "var(--font-data)", padding: "5px 16px", borderRadius: 2, cursor: "pointer",
                background: "rgba(255,160,40,0.12)", border: "1px solid rgba(255,160,40,0.4)",
                color: "var(--amber)", opacity: submitting ? 0.5 : 1,
              }}
            >
              {submitting ? "Publicando…" : "Publicar"}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
