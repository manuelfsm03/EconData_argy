"use client"

import { useEffect, useRef, useState } from "react"
import { ArrowRight } from "lucide-react"

const CHAPTERS = [
  { id: "canvas", eyebrow: "Tu espacio", title: "Mi Pizarra", before: "Armá un ", accent: "tablero propio", after: ".", detail: "Elegí los indicadores y ordenalos a tu manera." },
  { id: "library", eyebrow: "Todo disponible", title: "Biblioteca de datos", before: "Encontrá ", accent: "series económicas y financieras", after: ".", detail: "Ordenadas por tema, fuente y categoría." },
  { id: "calendar", eyebrow: "Lo que viene", title: "Calendario", before: "Seguí ", accent: "publicaciones, pagos y vencimientos", after: ".", detail: "Todo dentro de una misma línea temporal." },
  { id: "bonds", eyebrow: "Analizar", title: "Bonos", before: "Compará ", accent: "instrumentos", after: ".", detail: "Herramientas concretas para renta fija argentina." },
  { id: "agro", eyebrow: "Territorio", title: "Agro", before: "Leé ", accent: "producción, rendimientos y clima", after: ".", detail: "Cada dato conserva su fuente y su contexto regional." },
  { id: "connect", eyebrow: "Con inteligencia", title: "Conectar", before: "Consultá ", accent: "los mismos datos", after: " desde tu agente de IA.", detail: "Compatible con Claude, Codex y otros clientes MCP." },
] as const

export function HeroProductStory() {
  const [active, setActive] = useState(0)
  const [previous, setPrevious] = useState<number | null>(null)
  const [leaving, setLeaving] = useState(false)
  const [inView, setInView] = useState(false)
  const rootRef = useRef<HTMLElement | null>(null)
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const transitionRef = useRef<number | null>(null)
  const chapter = CHAPTERS[active]
  const previousChapter = previous === null ? null : CHAPTERS[previous]

  useEffect(() => {
    const root = rootRef.current
    if (!root) return
    const observer = new IntersectionObserver(([entry]) => setInView(entry.isIntersecting), { threshold: 0.08 })
    observer.observe(root)
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    const saveData = Boolean((navigator as Navigator & { connection?: { saveData?: boolean } }).connection?.saveData)
    if (saveData) return
    const warmers: HTMLVideoElement[] = []
    const timer = window.setTimeout(() => {
      CHAPTERS.forEach(({ id }) => {
        const video = document.createElement("video")
        video.muted = true
        video.playsInline = true
        video.preload = "auto"
        video.src = `/demos/${id}.mp4`
        video.load()
        warmers.push(video)
      })
    }, 650)
    return () => {
      window.clearTimeout(timer)
      warmers.forEach((video) => {
        video.pause()
        video.removeAttribute("src")
        video.load()
      })
    }
  }, [])

  useEffect(() => {
    const video = videoRef.current
    if (!video) return
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches
    const saveData = Boolean((navigator as Navigator & { connection?: { saveData?: boolean } }).connection?.saveData)
    const sync = () => {
      if (inView && !reduceMotion && !saveData && document.visibilityState === "visible") video.play().catch(() => {})
      else video.pause()
    }
    sync()
    document.addEventListener("visibilitychange", sync)
    return () => {
      document.removeEventListener("visibilitychange", sync)
      video.pause()
    }
  }, [active, inView])

  useEffect(() => () => {
    if (transitionRef.current) window.clearTimeout(transitionRef.current)
  }, [])

  const showChapter = (next: number) => {
    if (leaving || next === active) return
    setPrevious(active)
    setActive(next)
    setLeaving(true)
    transitionRef.current = window.setTimeout(() => {
      setPrevious(null)
      setLeaving(false)
    }, 360)
  }

  const showNext = () => showChapter((active + 1) % CHAPTERS.length)

  return (
    <section
      ref={rootRef}
      className={`landing-product ${inView ? "is-in-view" : ""}`}
      id="producto"
      aria-labelledby="landing-product-title"
      onKeyDown={(event) => {
        if (event.key === "ArrowRight") showNext()
        if (event.key === "ArrowLeft") showChapter((active - 1 + CHAPTERS.length) % CHAPTERS.length)
      }}
    >
      <div className="landing-product-heading">
        <h2 id="landing-product-title">¿Qué podés hacer en La Pizarra?</h2>
      </div>

      <div className={`landing-product-scene ${leaving ? "is-leaving" : ""}`} aria-live="polite">
        {previousChapter ? (
          <div className="landing-product-widget-stage is-exiting" aria-hidden="true">
            <article className="landing-product-widget">
              <div className="landing-product-widget-media">
                <video poster={`/demos/${previousChapter.id}.jpg`} muted loop playsInline autoPlay preload="auto">
                  <source src={`/demos/${previousChapter.id}.mp4`} type="video/mp4" />
                </video>
              </div>
              <div className="landing-product-widget-title">
                <span>{String((previous ?? 0) + 1).padStart(2, "0")}</span>
                <strong>{previousChapter.title}</strong>
              </div>
            </article>
          </div>
        ) : null}

        <div key={`widget-${chapter.id}`} className="landing-product-widget-stage">
          <article className="landing-product-widget">
            <div className="landing-product-widget-media">
              <video
                ref={videoRef}
                poster={`/demos/${chapter.id}.jpg`}
                muted
                loop
                playsInline
                autoPlay
                preload="auto"
                aria-label={`Demostración de ${chapter.title}`}
                onCanPlay={(event) => {
                  if (inView && document.visibilityState === "visible") event.currentTarget.play().catch(() => {})
                }}
              >
                <source src={`/demos/${chapter.id}.mp4`} type="video/mp4" />
              </video>
            </div>
            <div className="landing-product-widget-title">
              <span>{String(active + 1).padStart(2, "0")}</span>
              <strong>{chapter.title}</strong>
            </div>
          </article>
        </div>

        {previousChapter ? (
          <div className="landing-product-copy is-exiting" aria-hidden="true">
            <span>{previousChapter.eyebrow}</span>
            <p className="landing-product-copy-lead">{previousChapter.before}<em>{previousChapter.accent}</em>{previousChapter.after}</p>
            <p className="landing-product-copy-detail">{previousChapter.detail}</p>
          </div>
        ) : null}

        <div key={`copy-${chapter.id}`} className="landing-product-copy">
          <span>{chapter.eyebrow}</span>
          <p className="landing-product-copy-lead">{chapter.before}<em>{chapter.accent}</em>{chapter.after}</p>
          <p className="landing-product-copy-detail">{chapter.detail}</p>
        </div>

        <div className="landing-product-progress" aria-label={`Recorrido ${active + 1} de ${CHAPTERS.length}`}>
          {CHAPTERS.map((item, index) => (
            <button key={item.id} type="button" className={index === active ? "is-active" : ""} onClick={() => showChapter(index)} aria-label={`Ver ${item.title}`} aria-current={index === active ? "step" : undefined} />
          ))}
        </div>

        <button type="button" className="landing-product-next" onClick={showNext} disabled={leaving}>
          <span>¿Qué más?</span>
          <i aria-hidden="true"><ArrowRight size={25} /></i>
        </button>
      </div>
    </section>
  )
}
