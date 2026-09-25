"use client"

/**
 * InfoTooltip — cosito de pregunta educativo (?).
 *
 * Dos formas de uso:
 *  1) <InfoTooltip termId="LECAP" />          →  lee del glossary (recomendado)
 *  2) <InfoTooltip text="..." source="..." /> →  compat: texto libre (deprecado)
 *
 * La forma con `termId` evita duplicar definiciones y linkea a /glosario.
 */

import { useEffect, useId, useRef, useState } from "react"
import { GLOSSARY, buscarTermino, slugTermino } from "@/lib/glossary"

interface InfoTooltipProps {
  /** ID de término en el glossary (recomendado). Case-insensitive. */
  termId?: string
  /** Texto libre — compat. Preferir `termId` cuando el término esté en el glossary. */
  text?: string
  source?: string
  url?: string
  position?: "top" | "bottom" | "right"
  /** Muestra o no el link "Aprender más" al /glosario. Default: true si hay termId. */
  aprenderMas?: boolean
}

export function InfoTooltip({
  termId,
  text,
  source,
  url,
  position = "top",
  aprenderMas,
}: InfoTooltipProps) {
  const [visible, setVisible] = useState(false)
  const tooltipId = useId()
  const rootRef = useRef<HTMLSpanElement | null>(null)

  // Resolver el término si vino por termId
  const resolved = termId ? buscarTermino(termId) : null
  const entry = resolved?.entry ?? null
  const finalText = entry?.text ?? text ?? ""
  const finalSource = entry?.source ?? source
  const finalUrl = entry?.url ?? url
  const finalSlug = resolved ? slugTermino(resolved.id) : undefined
  const showAprenderMas = aprenderMas ?? Boolean(finalSlug)

  // Cerrar en Escape o click afuera (accesibilidad tap-friendly)
  useEffect(() => {
    if (!visible) return
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setVisible(false)
    }
    function onClick(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setVisible(false)
    }
    document.addEventListener("keydown", onKey)
    document.addEventListener("mousedown", onClick)
    return () => {
      document.removeEventListener("keydown", onKey)
      document.removeEventListener("mousedown", onClick)
    }
  }, [visible])

  if (!finalText) {
    // Fallback silencioso: si el termId no existe y no hay text, no renderizamos nada
    // (evita crashes al llamar con IDs viejos o mal escritos).
    if (process.env.NODE_ENV !== "production" && termId) {
      console.warn(`[InfoTooltip] termId "${termId}" no encontrado en GLOSSARY.`)
    }
    return null
  }

  const posStyle: React.CSSProperties =
    position === "top"
      ? { bottom: "calc(100% + 6px)", left: "50%", transform: "translateX(-50%)" }
      : position === "bottom"
      ? { top: "calc(100% + 6px)", left: "50%", transform: "translateX(-50%)" }
      : { left: "calc(100% + 6px)", top: "50%", transform: "translateY(-50%)" }

  return (
    <span
      ref={rootRef}
      style={{ position: "relative", display: "inline-flex", alignItems: "center", flexShrink: 0 }}
      onMouseEnter={() => setVisible(true)}
      onMouseLeave={() => setVisible(false)}
    >
      <button
        type="button"
        aria-label={entry?.nombre ? `Más información sobre ${entry.nombre}` : "Más información"}
        aria-describedby={visible ? tooltipId : undefined}
        aria-expanded={visible}
        onClick={(e) => {
          e.stopPropagation()
          setVisible((v) => !v)
        }}
        onFocus={() => setVisible(true)}
        onBlur={() => setVisible(false)}
        style={{
          width: 13,
          height: 13,
          borderRadius: "50%",
          background: "transparent",
          border: "1px solid var(--border)",
          color: "var(--text-dim)",
          fontSize: 8,
          cursor: "pointer",
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          marginLeft: 4,
          padding: 0,
          fontWeight: 700,
          userSelect: "none",
          flexShrink: 0,
          transition: "border-color 0.15s, color 0.15s",
          fontFamily: "var(--font-data, 'IBM Plex Mono', monospace)",
          ...(visible ? { borderColor: "#FFA028", color: "#FFA028" } : {}),
        }}
      >
        ?
      </button>

      {visible && (
        <div
          id={tooltipId}
          role="tooltip"
          style={{
            position: "absolute",
            ...posStyle,
            width: 280,
            background: "var(--bg-elev)",
            border: "1px solid var(--border)",
            padding: "10px 12px",
            zIndex: 9999,
            boxShadow: "0 6px 24px rgba(0,0,0,0.9)",
            fontFamily: "var(--font-data, 'IBM Plex Mono', monospace)",
          }}
        >
          {entry?.nombre && (
            <p
              style={{
                fontSize: 10,
                color: "var(--amber, #FFA028)",
                margin: "0 0 4px",
                fontWeight: 600,
                textTransform: "uppercase",
                letterSpacing: 0.5,
              }}
            >
              {entry.nombre}
              {entry.sigla && entry.sigla !== entry.nombre ? ` · ${entry.sigla}` : ""}
            </p>
          )}
          <p style={{ fontSize: 10, color: "var(--text)", lineHeight: 1.6, margin: 0 }}>{finalText}</p>
          {entry?.ejemplo && (
            <p
              style={{
                fontSize: 9.5,
                color: "var(--text-dim)",
                margin: "6px 0 0",
                lineHeight: 1.5,
                borderLeft: "2px solid var(--border)",
                paddingLeft: 6,
              }}
            >
              <span style={{ color: "var(--amber, #FFA028)", fontWeight: 600 }}>Ej. </span>
              {entry.ejemplo}
            </p>
          )}
          {finalSource && (
            <p style={{ fontSize: 9, color: "var(--text-dim)", margin: "5px 0 0", fontStyle: "italic" }}>
              Fuente: {finalSource}
              {finalUrl && (
                <>
                  {" "}
                  <a
                    href={finalUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ color: "#FFA028", textDecoration: "none" }}
                    onClick={(e) => e.stopPropagation()}
                  >
                    ↗
                  </a>
                </>
              )}
            </p>
          )}
          {showAprenderMas && finalSlug && (
            <p style={{ margin: "6px 0 0" }}>
              <a
                href={`/glosario#${finalSlug}`}
                style={{
                  fontSize: 9.5,
                  color: "#FFA028",
                  textDecoration: "none",
                  fontWeight: 600,
                }}
                onClick={(e) => e.stopPropagation()}
              >
                Aprender más →
              </a>
            </p>
          )}
        </div>
      )}
    </span>
  )
}

// Re-export para permitir <InfoTooltip termId="LECAP" /> sin importar GLOSSARY directo.
export { GLOSSARY }
