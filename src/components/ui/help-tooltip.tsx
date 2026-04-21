"use client"

import { useState, useRef, useEffect } from "react"

// ── HelpTooltip ──────────────────────────────────────────────────────────────

interface HelpTooltipProps {
  text: string
  side?: "top" | "bottom" | "right"
}

export function HelpTooltip({ text, side = "top" }: HelpTooltipProps) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener("mousedown", handler)
    return () => document.removeEventListener("mousedown", handler)
  }, [open])

  const popoverStyle: React.CSSProperties = {
    position: "absolute",
    zIndex: 9999,
    maxWidth: 270,
    minWidth: 180,
    background: "var(--bg-elev)",
    border: "1px solid var(--border)",
    borderRadius: 5,
    padding: "9px 11px",
    fontSize: 10,
    color: "var(--text-dim)",
    fontFamily: "monospace",
    lineHeight: 1.65,
    letterSpacing: 0.2,
    boxShadow: "0 6px 28px rgba(0,0,0,0.75)",
    pointerEvents: "none",
    whiteSpace: "normal",
    ...(side === "top"    ? { bottom: "calc(100% + 7px)", left: "50%", transform: "translateX(-50%)" } : {}),
    ...(side === "bottom" ? { top:    "calc(100% + 7px)", left: "50%", transform: "translateX(-50%)" } : {}),
    ...(side === "right"  ? { top: "50%", left: "calc(100% + 8px)", transform: "translateY(-50%)" }   : {}),
  }

  return (
    <div
      ref={ref}
      style={{ position: "relative", display: "inline-flex", alignItems: "center", verticalAlign: "middle", flexShrink: 0 }}
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
      onClick={e => { e.stopPropagation(); setOpen(o => !o) }}
    >
      <span style={{
        display: "inline-flex", alignItems: "center", justifyContent: "center",
        width: 14, height: 14, borderRadius: "50%",
        border: `1px solid ${open ? "#FFA028" : "#333"}`,
        color: open ? "#FFA028" : "#555",
        fontSize: 8,
        fontFamily: "monospace",
        fontWeight: 700,
        cursor: "help",
        userSelect: "none",
        transition: "border-color 0.12s, color 0.12s",
        lineHeight: 1,
      }}>
        ?
      </span>

      {open && <div style={popoverStyle}>{text}</div>}
    </div>
  )
}

// ── SectionMeta — barra de descripción con tooltip ────────────────────────────

interface SectionMetaProps {
  title: string
  help: string
  source?: string
}

export function SectionMeta({ title, help, source }: SectionMetaProps) {
  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 7,
      padding: "5px 14px",
      background: "var(--bg-elev)",
      borderBottom: "1px solid #0e0e0e",
    }}>
      <span style={{
        fontSize: 9, color: "var(--text-mute)", fontFamily: "monospace",
        letterSpacing: 1.5, textTransform: "uppercase", fontWeight: 600,
      }}>
        {title}
      </span>
      <HelpTooltip text={help} side="bottom" />
      {source && (
        <span style={{
          fontSize: 8, color: "var(--text-mute)", fontFamily: "monospace",
          marginLeft: 4, letterSpacing: 0.5,
        }}>
          · {source}
        </span>
      )}
    </div>
  )
}
