"use client"

import { useState, useEffect, useRef } from "react"
import { ChatAgente } from "./chat-agente"

export function FloatingAgent() {
  const [open, setOpen] = useState(false)
  const panelRef = useRef<HTMLDivElement>(null)

  // Cerrar con Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false) }
    window.addEventListener("keydown", handler)
    return () => window.removeEventListener("keydown", handler)
  }, [])

  return (
    <>
      {/* Panel del chat */}
      {open && (
        <div
          ref={panelRef}
          style={{
            position:     "fixed",
            bottom:       76,
            right:        20,
            width:        340,
            zIndex:       1000,
            boxShadow:    "0 8px 32px rgba(0,0,0,0.6)",
            borderRadius: 4,
            overflow:     "hidden",
          }}
        >
          {/* Header del panel */}
          <div style={{
            display:        "flex",
            justifyContent: "space-between",
            alignItems:     "center",
            padding:        "6px 12px",
            background:     "#050505",
            borderBottom:   "1px solid #1a1a1a",
          }}>
            <span style={{ fontSize: 9, color: "#555", letterSpacing: 1.5, textTransform: "uppercase" }}>
              PIZI · ASISTENTE DE DATOS
            </span>
            <button
              onClick={() => setOpen(false)}
              style={{
                background: "none",
                border:     "none",
                color:      "#444",
                cursor:     "pointer",
                fontSize:   14,
                lineHeight: 1,
                padding:    "0 2px",
              }}
            >
              ×
            </button>
          </div>
          <ChatAgente />
        </div>
      )}

      {/* Animaciones */}
      <style>{`
        @keyframes pizi-pulse {
          0%, 100% { box-shadow: 0 0 0 4px rgba(255,160,40,0.15), 0 4px 20px rgba(255,140,20,0.5); }
          50%       { box-shadow: 0 0 0 8px rgba(255,160,40,0.08), 0 4px 28px rgba(255,140,20,0.7); }
        }
        @keyframes pizi-bounce {
          0%, 100% { transform: translateY(0);  }
          40%       { transform: translateY(-5px); }
          60%       { transform: translateY(-2px); }
        }
        @keyframes pizi-dot {
          0%, 80%, 100% { transform: scale(0.6); opacity: 0.4; }
          40%            { transform: scale(1.2); opacity: 1;   }
        }
        .pizi-btn:hover { transform: scale(1.08); }
        .pizi-btn       { animation: pizi-pulse 2.5s ease-in-out infinite, pizi-bounce 4s ease-in-out infinite; }
        .pizi-btn.open  { animation: none; }
        .pizi-d1 { animation: pizi-dot 1.4s 0s    infinite; }
        .pizi-d2 { animation: pizi-dot 1.4s 0.2s  infinite; }
        .pizi-d3 { animation: pizi-dot 1.4s 0.4s  infinite; }
      `}</style>

      {/* Botón flotante circular */}
      <button
        onClick={() => setOpen((v) => !v)}
        title="Pizi — Asistente de datos"
        className={`pizi-btn${open ? " open" : ""}`}
        style={{
          position:     "fixed",
          bottom:       20,
          right:        20,
          width:        56,
          height:       56,
          borderRadius: "50%",
          background:   open ? "#111" : "radial-gradient(circle at 35% 35%, #FFB84D, #E8870A)",
          border:       open ? "1px solid #333" : "2px solid #FFA028",
          cursor:       "pointer",
          zIndex:       1001,
          display:      "flex",
          flexDirection: "column",
          alignItems:   "center",
          justifyContent: "center",
          gap:          2,
          boxShadow:    open ? "0 2px 12px rgba(0,0,0,0.6)" : undefined,
          transition:   "all 0.2s",
        }}
      >
        {open ? (
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <line x1="2" y1="2" x2="12" y2="12" stroke="#666" strokeWidth="2" strokeLinecap="round"/>
            <line x1="12" y1="2" x2="2" y2="12" stroke="#666" strokeWidth="2" strokeLinecap="round"/>
          </svg>
        ) : (
          <>
            {/* Burbuja de chat */}
            <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
              <path
                d="M11 2C6.03 2 2 5.69 2 10.2c0 2.3 1.04 4.38 2.72 5.87L3.5 19.5l4.2-1.58C8.5 18.3 9.72 18.5 11 18.5c4.97 0 9-3.69 9-8.3C20 5.69 15.97 2 11 2z"
                fill="#000"
                opacity="0.85"
              />
              <circle cx="7.5"  cy="10.5" r="1.2" fill="#FFA028" className="pizi-d1"/>
              <circle cx="11"   cy="10.5" r="1.2" fill="#FFA028" className="pizi-d2"/>
              <circle cx="14.5" cy="10.5" r="1.2" fill="#FFA028" className="pizi-d3"/>
            </svg>
            <span style={{
              fontSize:      7,
              fontWeight:    700,
              color:         "#000",
              letterSpacing: 1,
              fontFamily:    "monospace",
              lineHeight:    1,
            }}>
              PIZI
            </span>
          </>
        )}
      </button>
    </>
  )
}
