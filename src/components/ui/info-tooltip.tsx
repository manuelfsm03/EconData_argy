"use client"

import { useState } from "react"

interface InfoTooltipProps {
  text: string
  source?: string
  url?: string
  position?: "top" | "bottom" | "right"
}

export function InfoTooltip({ text, source, url, position = "top" }: InfoTooltipProps) {
  const [visible, setVisible] = useState(false)

  const posStyle: React.CSSProperties =
    position === "top"
      ? { bottom: "calc(100% + 6px)", left: "50%", transform: "translateX(-50%)" }
      : position === "bottom"
      ? { top: "calc(100% + 6px)", left: "50%", transform: "translateX(-50%)" }
      : { left: "calc(100% + 6px)", top: "50%", transform: "translateY(-50%)" }

  return (
    <span
      style={{ position: "relative", display: "inline-flex", alignItems: "center", flexShrink: 0 }}
      onMouseEnter={() => setVisible(true)}
      onMouseLeave={() => setVisible(false)}
    >
      <span
        onClick={url ? (e) => { e.stopPropagation(); window.open(url, "_blank", "noopener,noreferrer") } : undefined}
        style={{
          width: 13,
          height: 13,
          borderRadius: "50%",
          background: "transparent",
          border: "1px solid #2a2a2a",
          color: "#888",
          fontSize: 8,
          cursor: url ? "pointer" : "default",
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          marginLeft: 4,
          fontWeight: 700,
          userSelect: "none",
          flexShrink: 0,
          transition: "border-color 0.15s, color 0.15s",
          ...(visible ? { borderColor: "#FFA028", color: "#FFA028" } : {}),
        }}
      >
        ?
      </span>

      {visible && (
        <div
          style={{
            position: "absolute",
            ...posStyle,
            width: 260,
            background: "#0d0d0d",
            border: "1px solid #2a2a2a",
            padding: "9px 11px",
            zIndex: 9999,
            boxShadow: "0 6px 24px rgba(0,0,0,0.9)",
            pointerEvents: "none",
          }}
        >
          <p style={{ fontSize: 10, color: "#cccccc", lineHeight: 1.6, margin: 0 }}>{text}</p>
          {source && (
            <p style={{ fontSize: 9, color: "#888", margin: "5px 0 0", fontStyle: "italic" }}>
              Fuente: {source}
            </p>
          )}
          {url && (
            <p style={{ fontSize: 9, color: "#FFA028", margin: "4px 0 0" }}>
              Click para abrir fuente ↗
            </p>
          )}
        </div>
      )}
    </span>
  )
}
