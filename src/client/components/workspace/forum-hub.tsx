"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { formatDistanceToNow } from "date-fns"
import { es } from "date-fns/locale"
import { ForoActivo, type ForumAssetType } from "@/client/components/dashboard/foro-activo"
import type { TickerFocus } from "@/lib/ticker-nav"

type FeedPost = { id: string; assetType: ForumAssetType; assetTicker: string; authorName: string; content: string; parentId: string | null; createdAt: string }
type ThreadRef = { assetType: ForumAssetType; tag: string }
type DisplayThread = { id: string; initial: string; kind: string; tag: string; assetType: ForumAssetType; title: string; summary: string; replies: number; views?: number; time: string; author: string }
type TrendingTopic = { assetType: ForumAssetType; ticker: string; posts: number }

const approvedThreads: DisplayThread[] = [
  { id: "al35", initial: "M", kind: "Pregunta", tag: "AL35", assetType: "bono", title: "¿Cómo comparan el rendimiento real?", summary: "¿Qué variables miran para evaluar este bono?", replies: 3, views: 124, time: "hace 18 min", author: "Marina P." },
  { id: "emae", initial: "J", kind: "Análisis", tag: "EMAE", assetType: "variable", title: "Señales de actividad para esta semana", summary: "Datos de actividad y sectores que conviene seguir.", replies: 5, views: 212, time: "hace 2 h", author: "Julián R." },
  { id: "ipc", initial: "L", kind: "Debate", tag: "IPC", assetType: "variable", title: "Expectativas de inflación y precios", summary: "Fuentes y criterios para leer la serie.", replies: 2, views: 98, time: "ayer", author: "Lucía G." },
  { id: "agro", initial: "T", kind: "Idea", tag: "AGRO", assetType: "variable", title: "Rendimientos de la campaña agrícola", summary: "¿Cómo comparar zonas y campañas?", replies: 0, views: 76, time: "hace 2 días", author: "Tomás V." },
  { id: "dolar", initial: "S", kind: "Señal", tag: "DÓLAR", assetType: "variable", title: "Qué mirar cuando cambia la brecha", summary: "Una conversación sobre referencias, volumen y contexto.", replies: 4, views: 180, time: "hace 3 días", author: "Sofía A." },
]

const topics = [
  ["Dólar", "DOLAR", "topic-block--lead topic-block--dollar", "market", "dolar.mp4", "58%", "48%", "Cotizaciones, brecha y expectativas"],
  ["Inflación", "IPC", "topic-block--inflation", "macro", "inflacion.mp4", "56%", "48%", "IPC y precios"],
  ["Bonos", "AL35", "topic-block--bonds", "market", "bonos.mp4", "68%", "48%", "Curvas y rendimientos"],
  ["Agro", "AGRO", "topic-block--agro", "production", "agro.mp4", "52%", "50%", "Campañas y mercados"],
  ["BCRA", "BCRA", "topic-block--bcra", "macro", "bcra.mp4", "69%", "46%", "Tasas y reservas"],
  ["Acciones", "ACCIONES", "topic-block--wide topic-block--stocks", "market", "acciones.mp4", "72%", "48%", "Empresas, precios y señales"],
  ["Mercados", "MERCADOS", "topic-block--global", "market", "mercados.mp4", "68%", "50%", "Índices y contexto"],
  ["Cripto", "CRIPTO", "topic-block--quiet topic-block--crypto", "market", "cripto.mp4", "70%", "47%", "Precios y adopción"],
] as const

const MessageIcon = () => <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 5h14v10H9l-4 3V5Z" /></svg>
const EyeIcon = () => <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M2.5 12s3.4-5.5 9.5-5.5 9.5 5.5 9.5 5.5-3.4 5.5-9.5 5.5S2.5 12 2.5 12Z" /><circle cx="12" cy="12" r="2.4" /></svg>
const ArrowIcon = () => <svg viewBox="0 0 24 16" aria-hidden="true"><path d="M1 8h20M15 2l6 6-6 6" /></svg>
const ChatIcon = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true"><path d="M20 11.5a7.5 7.5 0 0 1-8 7.5 9 9 0 0 1-3.8-.9L4 20l1.3-3.7A7.4 7.4 0 0 1 4 12a7.5 7.5 0 0 1 8-7.5 7.5 7.5 0 0 1 8 7Z" /></svg>

function TopicCard({ topic, active, onOpen, beginVideo, endVideo }: { topic: typeof topics[number]; active: boolean; onOpen: () => void; beginVideo: (video: HTMLVideoElement) => void; endVideo: (video: HTMLVideoElement) => void }) {
  const ref = useRef<HTMLVideoElement>(null)
  const play = () => {
    const video = ref.current
    const saveData = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection?.saveData
    if (!video || window.matchMedia("(prefers-reduced-motion: reduce), (hover: none), (pointer: coarse)").matches || saveData) return
    video.currentTime = 0; beginVideo(video); void video.play().catch(() => undefined)
  }
  const reset = () => { if (ref.current) endVideo(ref.current) }
  const [name, tag, className, atmosphere, file, x, y, subtitle] = topic
  return <button className={`topic-block ${className}${active ? " is-active" : ""}`} type="button" data-atmosphere={atmosphere} data-media-ready="video" aria-pressed={active} style={{ "--media-x": x, "--media-y": y } as React.CSSProperties} onPointerEnter={play} onPointerLeave={reset} onFocus={play} onBlur={reset} onClick={onOpen}>
    <span className="topic-media" aria-hidden="true"><video ref={ref} className="topic-media-video" muted playsInline loop preload="metadata" tabIndex={-1}><source src={`/assets/media/forum/${file}`} type="video/mp4" /></video><span className="topic-media-mask" /></span>
    <span className="topic-copy"><strong>{name}</strong><small>{subtitle}</small></span><span className="topic-chat-icon" aria-hidden="true"><ChatIcon /></span>
  </button>
}

function ForumRow({ item, onOpen }: { item: DisplayThread; onOpen: () => void }) {
  return <article className={`forumrow${item.id === "agro" ? " forumrow--agro" : ""}`}><div className="avatar">{item.initial}</div><div className="forum-thread"><div className="forum-thread-meta"><span className="thread-type">{item.kind}</span><span className="forum-tag">{item.tag}</span></div><h3>{item.title}</h3><p>{item.summary}</p><div className="forum-thread-stats"><span><MessageIcon />{item.replies} respuestas</span>{item.views !== undefined && <span><EyeIcon />{item.views} visualizaciones</span>}</div></div><div className={`forum-thread-state${item.replies === 0 ? " forum-thread-state--empty" : ""}`}><time>{item.time}</time><span>{item.author}</span></div><button className="forum-open open" type="button" aria-label={`Abrir ${item.title}`} onClick={onOpen}><span>→</span></button></article>
}

export function ForumHub({ initialFocus = null }: { initialFocus?: TickerFocus | null } = {}) {
  const [query, setQuery] = useState("")
  const [debouncedQuery, setDebouncedQuery] = useState("")
  const [activeTag, setActiveTag] = useState<string | null>(null)
  const [sort, setSort] = useState("recent")
  const [thread, setThread] = useState<ThreadRef | null>(null)
  const [posts, setPosts] = useState<FeedPost[]>([])
  const [trending, setTrending] = useState<TrendingTopic[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [reloadKey, setReloadKey] = useState(0)
  const searchRef = useRef<HTMLInputElement>(null)
  const currentVideo = useRef<HTMLVideoElement | null>(null)

  useEffect(() => { const timeout = window.setTimeout(() => setDebouncedQuery(query.trim()), 250); return () => window.clearTimeout(timeout) }, [query])
  const load = useCallback(async () => {
    setLoading(true); setError(null)
    try {
      const params = new URLSearchParams({ pageSize: "50" }); if (debouncedQuery) params.set("q", debouncedQuery); if (activeTag) params.set("tag", activeTag)
      const response = await fetch(`/api/foro?${params}`, { cache: "no-store" }); const payload = await response.json().catch(() => null)
      if (!response.ok || !payload || !Array.isArray(payload.data)) throw new Error(payload?.error ?? "No se pudieron cargar las conversaciones")
      setPosts(payload.data)
    } catch (loadError) { setError(loadError instanceof Error ? loadError.message : "No se pudieron cargar las conversaciones") } finally { setLoading(false) }
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
  useEffect(() => { if (initialFocus) { const assetType = initialFocus.kind === "accion_usa" ? "accion" : initialFocus.kind as ForumAssetType; setActiveTag(initialFocus.ticker); setThread({ assetType, tag: initialFocus.ticker }) } }, [initialFocus])
  useEffect(() => { const pause = () => { if (document.hidden && currentVideo.current) { currentVideo.current.pause(); currentVideo.current.currentTime = 0 } }; document.addEventListener("visibilitychange", pause); return () => document.removeEventListener("visibilitychange", pause) }, [])

  const beginVideo = (video: HTMLVideoElement) => { if (currentVideo.current && currentVideo.current !== video) { currentVideo.current.pause(); currentVideo.current.currentTime = 0 } currentVideo.current = video }
  const endVideo = (video: HTMLVideoElement) => { video.pause(); video.currentTime = 0; if (currentVideo.current === video) currentVideo.current = null }
  const openThread = (assetType: ForumAssetType, tag: string) => setThread({ assetType, tag })
  const focusTag = (tag: string, assetType: ForumAssetType = "variable") => { setActiveTag(tag); openThread(assetType, tag); window.setTimeout(() => document.getElementById("forumArchiveTitle")?.scrollIntoView({ behavior: "smooth", block: "start" }), 0) }

  const liveThreads = useMemo<DisplayThread[]>(() => posts.map((post) => ({ id: post.id, initial: post.authorName.trim().charAt(0).toUpperCase() || "·", kind: post.parentId ? "Respuesta" : "Conversación", tag: post.assetTicker, assetType: post.assetType, title: post.content.split("\n")[0].slice(0, 105), summary: post.content.split("\n").slice(1).join(" ").slice(0, 150) || `Conversación sobre ${post.assetTicker}`, replies: 0, time: `hace ${formatDistanceToNow(new Date(post.createdAt), { locale: es })}`, author: post.authorName })).filter((item, index, all) => all.findIndex((other) => other.tag === item.tag && other.title === item.title) === index), [posts])
  const visibleThreads = useMemo(() => { const base = liveThreads.length ? liveThreads : approvedThreads; const filtered = base.filter((item) => !query || `${item.title} ${item.summary} ${item.author} ${item.tag}`.toLocaleLowerCase("es").includes(query.toLocaleLowerCase("es"))); if (sort === "commented") return [...filtered].sort((a, b) => b.replies - a.replies); if (sort === "unanswered") return filtered.filter((item) => item.replies === 0); return filtered }, [liveThreads, query, sort])

  return <div className="forum-page" data-forum-atmosphere="neutral" data-forum-tone="cream">
    <header className="forum-hero" data-media-ready="poster"><div className="forum-hero-media" data-media-ready="poster" aria-hidden="true" style={{ "--media-x": "50%", "--media-y": "50%" } as React.CSSProperties}><picture className="forum-media-poster"><img src="/assets/media/forum/forum-hero.webp" alt="" /></picture><span className="forum-media-mask" /></div><div className="forum-hero-main"><h1>Foro<span>.</span></h1><p>Tu comunidad de análisis.</p></div><aside className="forum-hero-note" aria-label="Formas de participar en el Foro">
      <div className="forum-hero-principle"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M5 6.5h14v9H9l-4 3v-12Z" /><path d="M9 10h6" /></svg><span><b>Preguntar</b><small>Abrí una duda.</small></span></div>
      <div className="forum-hero-principle"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="m8 7-4 5 4 5M16 7l4 5-4 5" /><path d="M5 12h14" /></svg><span><b>Contrastar</b><small>Compará miradas.</small></span></div>
      <div className="forum-hero-principle"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><circle cx="12" cy="12" r="7" /><path d="M9.5 12.2 11 13.7l3.8-4" /></svg><span><b>Entender</b><small>Ordená el pensamiento.</small></span></div>
    </aside></header>

    <div className="forum-navigation" aria-label="Buscar y filtrar conversaciones"><div className="forum-searchline"><label className="forum-search" htmlFor="forumSearch"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7"><circle cx="10.8" cy="10.8" r="6.8" /><path d="m16 16 5 5" /></svg><input ref={searchRef} id="forumSearch" type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar conversaciones, autores o variables..." autoComplete="off" /></label><button className="forum-new" type="button" onClick={() => { searchRef.current?.focus(); setQuery("") }}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"><path d="M5 5.5h14v10H9l-4 3v-13Z" /><path d="M12 8v5M9.5 10.5h5" /></svg><span>Nueva conversación</span></button></div><div className="forum-filterline"><div className="forum-filters" role="group" aria-label="Filtrar por tema">{["Todas", "AL35", "IPC", "EMAE", "Agro", "BCRA"].map((tag) => { const value = tag === "Todas" ? null : tag.toUpperCase(); return <button key={tag} className={`forum-filter${activeTag === value ? " is-active" : ""}`} type="button" aria-pressed={activeTag === value} onClick={() => setActiveTag(value)}>{tag}</button> })}</div><label className="forum-sort-label" htmlFor="forumSort"><span className="forum-sort-caption">Ordenar</span><span className="forum-sort-control"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"><circle cx="12" cy="12" r="7" /><path d="M12 8v4l2.8 1.8" /></svg><select id="forumSort" className="forum-sort" value={sort} onChange={(event) => setSort(event.target.value)}><option value="recent">Recientes</option><option value="commented">Más comentados</option><option value="featured">Destacados</option><option value="unanswered">Sin responder</option></select><svg className="forum-sort-chevron" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="m4 6 4 4 4-4" /></svg></span></label></div></div>

    <section className="forum-section forum-topics" aria-labelledby="forumTopicsTitle"><div className="forum-section-head forum-section-head--topics"><div className="forum-topics-heading"><span className="forum-section-signal">8 temas</span><h2 id="forumTopicsTitle">Explorar por tema:</h2></div></div><div className="topic-map">{topics.map((topic) => <TopicCard key={topic[0]} topic={topic} active={activeTag === topic[1]} onOpen={() => focusTag(topic[1], topic[1] === "AL35" ? "bono" : "variable")} beginVideo={beginVideo} endVideo={endVideo} />)}</div></section>

    <section className="forum-section forum-featured" aria-labelledby="forumFeaturedTitle"><div className="forum-section-head forum-section-head--featured"><div className="forum-section-title-group"><span className="forum-section-signal">Selección editorial</span><h2 id="forumFeaturedTitle">En foco</h2></div></div><div className="featured-grid featured-grid--editorial">
      <article className="featured-thread featured-thread--lead"><div className="featured-top"><span className="featured-top-copy"><span className="featured-curation">Selección editorial</span><span className="thread-type">Pregunta</span></span><span className="featured-topic-index"><span className="forum-tag">AL35</span><span className="featured-order">01</span></span></div><h3>¿Cómo comparan el rendimiento real?</h3><p>Variables, supuestos y criterios para evaluar un bono más allá de su rendimiento nominal.</p><div className="featured-endcap featured-endcap--lead"><div className="featured-context"><span className="avatar">M</span><span><b>Marina P.</b><small>actualizó la conversación hace 18 min</small></span></div><div className="featured-foot"><span className="featured-stat"><MessageIcon /><span><strong>3</strong><small>respuestas</small></span></span><span className="featured-stat"><EyeIcon /><span><strong>124</strong><small>visualizaciones</small></span></span></div><button className="featured-action open" type="button" onClick={() => openThread("bono", "AL35")}><span>Entrar a la conversación</span><ArrowIcon /></button></div></article>
      <div className="featured-secondary-list">{approvedThreads.slice(1, 3).map((item, index) => <article className="featured-thread" key={item.id}><div className="featured-top"><span className="thread-type">{item.kind}</span><span className="featured-topic-index"><span className="forum-tag">{item.tag}</span><span className="featured-order">0{index + 2}</span></span></div><h3>{item.title}</h3><p>{index === 0 ? "Qué sectores mirar y cómo ordenar las señales." : item.summary}</p><div className="featured-endcap featured-endcap--secondary"><div className="featured-foot featured-foot--secondary"><span className="featured-byline"><b>{item.author}</b><small>{item.time}</small></span><span className="featured-mini-stats"><span><MessageIcon /><strong>{item.replies}</strong> respuestas</span><span><EyeIcon /><strong>{item.views}</strong> visualizaciones</span></span></div><button className="featured-action featured-action--compact open" type="button" onClick={() => openThread(item.assetType, item.tag)}><span>Entrar</span><ArrowIcon /></button></div></article>)}</div>
    </div></section>

    <section className="forum-section forum-archive forum-messages" aria-labelledby="forumArchiveTitle"><div className="forum-section-head forum-section-head--archive"><div className="forum-section-title-group"><span className="forum-section-signal">Actividad del foro</span><h2 id="forumArchiveTitle">Conversaciones en curso:</h2></div></div><div className="forum-messages-layout"><div className="forum-message-stream"><div className="forumlist">{loading ? <div className="forum-feed-state">Cargando conversaciones…</div> : visibleThreads.length ? visibleThreads.slice(0, 5).map((item) => <ForumRow key={item.id} item={item} onOpen={() => openThread(item.assetType, item.tag)} />) : <div className="forum-empty"><span>{error ?? "No encontramos conversaciones con esos criterios."}</span><button type="button" onClick={() => { setQuery(""); setActiveTag(null) }}>Limpiar filtros</button></div>}</div></div>
      <aside className="forum-activity-rail" aria-label="Resumen de actividad del Foro"><section className="forum-activity-group forum-activity-group--recent"><header><span className="forum-activity-symbol"><svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="7" /><path d="M12 8v4l3 2" /></svg></span><h3>Actividad reciente</h3><button type="button">Ver todo <span>→</span></button></header><div className="forum-activity-list">{approvedThreads.slice(0, 3).map((item) => <button className="forum-activity-item open" type="button" key={item.id} onClick={() => openThread(item.assetType, item.tag)}><span className="avatar">{item.initial}</span><span><b>{item.title}</b><small>{item.author} respondió en <em>{item.tag}</em></small></span><time>{item.time.replace("hace ", "")}</time></button>)}</div></section><section className="forum-activity-group"><header><span className="forum-activity-symbol"><MessageIcon /></span><h3>Sin responder</h3><button type="button" onClick={() => setSort("unanswered")}>Ver todas <span>→</span></button></header><div className="forum-activity-list"><button className="forum-activity-item open" type="button" onClick={() => openThread("variable", "AGRO")}><span className="avatar">T</span><span><b>Rendimientos de la campaña agrícola</b><small>¿Cómo comparar zonas y campañas?</small></span><time>2 días</time></button></div></section><section className="forum-activity-group"><header><span className="forum-activity-symbol"><svg viewBox="0 0 24 24"><path d="M12 3c1.4 3.5-.8 4.7-.8 7.1 0 1.1.8 1.9 1.8 1.9 1.8 0 2.8-1.8 2.2-4 2.6 1.8 4.3 4.5 4.3 7.3A7.5 7.5 0 0 1 4.5 15c0-3.4 2-6.2 5.2-8.6-.2 2.2.5 3.5 1.7 3.5" /></svg></span><h3>En debate</h3><button type="button">Ver todas <span>→</span></button></header><div className="forum-activity-list"><button className="forum-activity-item open" type="button" onClick={() => openThread("variable", "EMAE")}><span className="avatar">J</span><span><b>Señales de actividad para esta semana</b><small>5 respuestas · 212 visualizaciones</small></span><time>2 h</time></button></div></section></aside>
    </div></section>

    <section className="forum-section forum-lower forum-lower--editorial" aria-labelledby="forumClosingTitle"><header className="forum-closing-head"><div><span className="forum-closing-kicker">Sin responder</span><h2 id="forumClosingTitle">Preguntas abiertas:</h2></div></header><div className="forum-closing-grid"><article className="unanswered-module"><header className="forum-closing-card-head"><span>Pendientes</span><div className="forum-closing-card-title"><h3>Esperan una respuesta</h3><p className="forum-closing-status"><strong>2</strong><small>abiertas</small></p></div></header><div className="lower-thread-list">{[approvedThreads[3], { ...approvedThreads[3], id: "bcra-open", tag: "BCRA", title: "Cómo ordenar las señales monetarias", time: "hace 4 días" }].map((item, index) => <button className="lower-thread open" type="button" key={item.id} onClick={() => openThread("variable", item.tag)}><span className="lower-thread-number">0{index + 1}</span><span className="lower-thread-copy"><b>{item.tag}</b><strong>{item.title}</strong></span><span className="lower-thread-state"><small>Sin responder</small><time>{item.time}</time></span><span className="lower-thread-arrow"><ArrowIcon /></span></button>)}</div></article><div className="forum-closing-side"><article className="weekly-module"><header className="forum-closing-card-head"><span>Actividad semanal</span><div className="forum-closing-card-title"><h3>Temas con más actividad</h3><p className="forum-closing-status"><strong>{trending.length}</strong><small>temas</small></p></div></header>{trending.length ? <ol>{trending.slice(0, 3).map((topic, index) => <li key={`${topic.assetType}-${topic.ticker}`}><button type="button" onClick={() => openThread(topic.assetType, topic.ticker)}><b>0{index + 1}</b><span>{topic.ticker}</span><small>{topic.posts} posts</small></button></li>)}</ol> : <p className="forum-feed-state">Sin actividad reciente.</p>}</article><aside className="forum-principle"><div className="forum-principle-media"><video className="forum-principle-video" muted playsInline loop preload="metadata" tabIndex={-1} aria-hidden="true" onPointerEnter={(event) => { beginVideo(event.currentTarget); void event.currentTarget.play().catch(() => undefined) }} onPointerLeave={(event) => endVideo(event.currentTarget)}><source src="/assets/media/forum/proponer-conversacion.mp4" type="video/mp4" /></video><span className="forum-principle-video-mask" /><button className="forum-principle-action thread-link" type="button" onClick={() => { searchRef.current?.focus(); window.scrollTo({ top: 300, behavior: "smooth" }) }}><span className="forum-principle-action-label">Proponer una conversación</span><span className="forum-principle-action-arrow"><svg viewBox="0 0 38 38"><path d="M8 27c8 0 14-5 20-16" /><path d="M19 11h9v9" /></svg></span></button></div></aside></div></div></section>

    {thread && <div className="forum-thread-panel" role="dialog" aria-modal="true" aria-label={`Conversación ${thread.tag}`}><button className="forum-thread-panel-close" type="button" onClick={() => setThread(null)} aria-label="Cerrar conversación">×</button><ForoActivo key={`${thread.assetType}-${thread.tag}`} assetType={thread.assetType} ticker={thread.tag} compact onPost={() => setReloadKey((value) => value + 1)} /></div>}
  </div>
}
