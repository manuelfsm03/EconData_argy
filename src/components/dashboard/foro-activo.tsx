"use client"

import { useState, useEffect, useCallback } from "react"
import { formatDistanceToNow } from "date-fns"
import { es } from "date-fns/locale"

interface ForumPost {
  id: string
  authorName: string
  content: string
  parentId: string | null
  createdAt: string
}

interface ForoActivoProps {
  assetType: "accion" | "bono" | "cap"
  ticker: string
}

const PAGE_SIZE = 20

export function ForoActivo({ assetType, ticker }: ForoActivoProps) {
  const [posts, setPosts] = useState<ForumPost[]>([])
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [loading, setLoading] = useState(true)
  const [authorName, setAuthorName] = useState("")
  const [content, setContent] = useState("")
  const [replyTo, setReplyTo] = useState<ForumPost | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback((p: number) => {
    setLoading(true)
    fetch(`/api/foro/${assetType}/${ticker}?page=${p}&pageSize=${PAGE_SIZE}`)
      .then(r => r.json())
      .then(j => {
        setPosts(Array.isArray(j.data) ? j.data : [])
        setTotalPages(j.totalPages ?? 1)
      })
      .catch(() => setPosts([]))
      .finally(() => setLoading(false))
  }, [assetType, ticker])

  useEffect(() => {
    setPage(1)
    setReplyTo(null)
  }, [assetType, ticker])

  useEffect(() => { load(page) }, [load, page])

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
      setContent("")
      setReplyTo(null)
      const lastPage = Math.max(1, totalPages)
      if (page === lastPage) {
        load(page)
      } else {
        setPage(lastPage)
      }
    } catch {
      setError("No se pudo publicar el mensaje")
    } finally {
      setSubmitting(false)
    }
  }

  const findParent = (id: string | null) => posts.find(p => p.id === id) ?? null

  return (
    <div className="bbg-panel" style={{ marginTop: 1 }}>
      <div className="bbg-panel-header">Foro · {ticker}</div>

      <div style={{ padding: "10px 14px" }}>
        {loading ? (
          <div style={{ padding: 20, textAlign: "center", color: "var(--text-dim)", fontFamily: "var(--font-data)", fontSize: 10 }}>
            Cargando…
          </div>
        ) : posts.length === 0 ? (
          <div style={{ padding: 20, textAlign: "center", color: "var(--text-dim)", fontFamily: "var(--font-data)", fontSize: 10 }}>
            Sin posts todavía. Sé el primero en comentar {ticker}.
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 12 }}>
            {posts.map(post => {
              const parent = findParent(post.parentId)
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
                      {parent ? (
                        <>
                          <span style={{ color: "var(--amber)", fontWeight: 600 }}>{parent.authorName}</span>
                          {": "}
                          {parent.content.length > 80 ? `${parent.content.slice(0, 80)}…` : parent.content}
                        </>
                      ) : (
                        "Respuesta a un post anterior"
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
                  <div style={{ fontSize: 11, color: "var(--text)", fontFamily: "var(--font-ui)", whiteSpace: "pre-wrap", lineHeight: 1.4 }}>
                    {post.content}
                  </div>
                  <button
                    onClick={() => setReplyTo(post)}
                    style={{
                      marginTop: 3, background: "none", border: "none", cursor: "pointer",
                      fontSize: 9, color: "var(--text-mute)", fontFamily: "var(--font-data)", padding: 0,
                    }}
                  >
                    ↩ Responder
                  </button>
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
            placeholder={`Escribí un mensaje sobre ${ticker}...`}
            value={content}
            maxLength={2000}
            onChange={e => setContent(e.target.value)}
            style={{
              width: "100%", background: "var(--bg-elev-2)", border: "1px solid var(--border-hi)",
              color: "var(--text)", padding: "4px 8px", fontSize: 11, outline: "none",
              fontFamily: "var(--font-ui)", resize: "vertical", minHeight: 60, borderRadius: 2,
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
