"use client"

import { useState, useCallback } from "react"
import { Plus, X, Save, Loader2 } from "lucide-react"
import type { UserProfile, PerfilRiesgo } from "./mock-profiles"
import { INTEREST_CATEGORIES } from "./mock-profiles"

// ── Types ─────────────────────────────────────────────────────────────────────

interface EditState {
  nombre: string
  bio: string
  linkedin: string
  foto: string
  topAcciones: { ticker: string; conviccion: number }[]
  interesesRentaFija: string[]
  interesesRentaVariable: string[]
  interesesMacro: string[]
  interesesOtros: string[]
  perfilRiesgo: PerfilRiesgo | ""
}

function profileToEditState(p: UserProfile): EditState {
  // Derivar categorías legacy desde intereses plano si no están seteadas
  const flat = new Set(p.intereses)
  return {
    nombre:              p.nombre,
    bio:                 p.bio,
    linkedin:            p.linkedin ?? "",
    foto:                p.foto ?? "",
    topAcciones:         p.topAcciones.map((a) => ({ ...a })),
    interesesRentaFija:  p.interesesRentaFija
                           ?? INTEREST_CATEGORIES.rentaFija.filter((t) => flat.has(t)),
    interesesRentaVariable: p.interesesRentaVariable
                           ?? INTEREST_CATEGORIES.rentaVariable.filter((t) => flat.has(t)),
    interesesMacro:      INTEREST_CATEGORIES.macro.filter((t) => flat.has(t)),
    interesesOtros:      INTEREST_CATEGORIES.otros.filter((t) => flat.has(t)),
    perfilRiesgo:        p.perfilRiesgo ?? "",
  }
}

function editStateToProfilePatch(s: EditState) {
  // Reconstruye intereses plano (legacy) para display en cards
  const intereses = [
    ...s.interesesRentaFija,
    ...s.interesesRentaVariable,
    ...s.interesesMacro,
    ...s.interesesOtros,
  ]

  return {
    nombre:               s.nombre.trim(),
    bio:                  s.bio.trim(),
    linkedin:             s.linkedin.trim() || undefined,
    foto:                 s.foto.trim() || undefined,
    topAcciones:          s.topAcciones,
    intereses,
    interesesRentaFija:   s.interesesRentaFija,
    interesesRentaVariable: s.interesesRentaVariable,
    perfilRiesgo:         s.perfilRiesgo || undefined,
  }
}

// ── Subcomponents ─────────────────────────────────────────────────────────────

const inputStyle: React.CSSProperties = {
  width: "100%",
  background: "var(--bg)",
  border: "1px solid var(--border-hi)",
  borderRadius: 4,
  color: "var(--text)",
  fontSize: 12,
  padding: "7px 10px",
  outline: "none",
  fontFamily: "var(--font-ui)",
  boxSizing: "border-box",
}

const labelStyle: React.CSSProperties = {
  fontSize: 9,
  color: "var(--text-mute)",
  textTransform: "uppercase",
  letterSpacing: 0.8,
  display: "block",
  marginBottom: 4,
}

function FormSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ borderTop: "1px solid var(--border)", padding: "14px 16px" }}>
      <div style={{
        fontSize: 9, color: "var(--amber)", textTransform: "uppercase",
        letterSpacing: 1.2, fontWeight: 700, marginBottom: 12,
      }}>
        {title}
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {children}
      </div>
    </div>
  )
}

function TagChip({
  tag,
  selected,
  onToggle,
}: {
  tag: string
  selected: boolean
  onToggle: () => void
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      style={{
        fontSize: 10,
        padding: "3px 10px",
        borderRadius: 99,
        border: `1px solid ${selected ? "var(--amber)" : "var(--border-hi)"}`,
        background: selected ? "rgba(232,148,74,0.15)" : "var(--bg-elev-2)",
        color: selected ? "var(--amber)" : "var(--text-dim)",
        cursor: "pointer",
        fontFamily: "var(--font-ui)",
        transition: "all 0.12s",
      }}
    >
      {tag}
    </button>
  )
}

function AccionesEditor({
  acciones,
  onChange,
}: {
  acciones: { ticker: string; conviccion: number }[]
  onChange: (next: { ticker: string; conviccion: number }[]) => void
}) {
  const [newTicker, setNewTicker] = useState("")

  const add = () => {
    const t = newTicker.trim().toUpperCase()
    if (!t || acciones.find((a) => a.ticker === t)) { setNewTicker(""); return }
    onChange([...acciones, { ticker: t, conviccion: 50 }])
    setNewTicker("")
  }

  const remove = (ticker: string) => {
    onChange(acciones.filter((a) => a.ticker !== ticker))
  }

  const setConviccion = (ticker: string, v: number) => {
    onChange(acciones.map((a) => a.ticker === ticker ? { ...a, conviccion: v } : a))
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      {acciones.map((a) => (
        <div key={a.ticker} style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{
            fontSize: 11, fontWeight: 700, color: "var(--amber)",
            fontFamily: "var(--font-data)", minWidth: 48,
          }}>
            {a.ticker}
          </span>
          <input
            type="range"
            min={10} max={100} step={5}
            value={a.conviccion}
            onChange={(e) => setConviccion(a.ticker, Number(e.target.value))}
            style={{ flex: 1, accentColor: "var(--amber)" }}
          />
          <span style={{
            fontSize: 10, color: "var(--text-mute)",
            fontFamily: "var(--font-data)", minWidth: 32, textAlign: "right",
          }}>
            {a.conviccion}%
          </span>
          <button
            type="button"
            onClick={() => remove(a.ticker)}
            style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-mute)", padding: 2 }}
          >
            <X size={12} />
          </button>
        </div>
      ))}
      <div style={{ display: "flex", gap: 6 }}>
        <input
          value={newTicker}
          onChange={(e) => setNewTicker(e.target.value.toUpperCase())}
          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); add() } }}
          placeholder="GGAL, AL30, MELI…"
          maxLength={8}
          style={{ ...inputStyle, flex: 1, textTransform: "uppercase" }}
        />
        <button
          type="button"
          onClick={add}
          style={{
            background: "var(--bg-elev-2)", border: "1px solid var(--border-hi)",
            color: "var(--amber)", borderRadius: 4, padding: "7px 10px",
            cursor: "pointer", display: "flex", alignItems: "center", gap: 4,
            fontSize: 10,
          }}
        >
          <Plus size={12} /> Agregar
        </button>
      </div>
      <div style={{ fontSize: 9, color: "var(--text-mute)" }}>
        Máx 10 activos · La convicción es declarativa, no asesoramiento.
      </div>
    </div>
  )
}

function InterestSection({
  title,
  tags,
  selected,
  onChange,
}: {
  title: string
  tags: readonly string[]
  selected: string[]
  onChange: (next: string[]) => void
}) {
  const toggle = (tag: string) => {
    onChange(
      selected.includes(tag)
        ? selected.filter((t) => t !== tag)
        : [...selected, tag],
    )
  }

  return (
    <div>
      <div style={{ fontSize: 9, color: "var(--text-mute)", marginBottom: 6, textTransform: "uppercase", letterSpacing: 0.8 }}>
        {title}
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
        {tags.map((tag) => (
          <TagChip
            key={tag}
            tag={tag}
            selected={selected.includes(tag)}
            onToggle={() => toggle(tag)}
          />
        ))}
      </div>
    </div>
  )
}

// ── ProfileEditForm ───────────────────────────────────────────────────────────

export interface ProfileEditFormProps {
  profile: UserProfile
  onUpdated: (updated: UserProfile) => void
  onCancel: () => void
}

export function ProfileEditForm({ profile, onUpdated, onCancel }: ProfileEditFormProps) {
  const [form, setForm] = useState<EditState>(() => profileToEditState(profile))
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const set = useCallback(<K extends keyof EditState>(key: K, value: EditState[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }))
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setSaving(true)
    try {
      const patch = editStateToProfilePatch(form)
      const res = await fetch(`/api/profiles/${profile.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      })
      if (!res.ok) {
        const json = (await res.json()) as { error?: string }
        throw new Error(json.error ?? `Error ${res.status}`)
      }
      const json = (await res.json()) as { data: UserProfile }
      const updated = { ...json.data, isCurrentUser: profile.isCurrentUser }

      // Persistir en localStorage para sobrevivir hot-reload hasta que Gonza conecte la DB
      try {
        localStorage.setItem(`pizarra_profile_${profile.id}`, JSON.stringify(updated))
      } catch { /* cuotas o SSR */ }

      onUpdated(updated)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error desconocido")
    } finally {
      setSaving(false)
    }
  }

  const bioLen = form.bio.length

  return (
    <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", paddingBottom: 32 }}>

      {/* Info básica */}
      <FormSection title="Información básica">
        <div>
          <label style={labelStyle}>Nombre completo</label>
          <input
            style={inputStyle}
            value={form.nombre}
            onChange={(e) => set("nombre", e.target.value)}
            maxLength={80}
            required
          />
        </div>
        <div>
          <label style={labelStyle}>Bio <span style={{ color: "var(--text-mute)" }}>({bioLen}/280)</span></label>
          <textarea
            value={form.bio}
            onChange={(e) => set("bio", e.target.value)}
            maxLength={280}
            rows={3}
            style={{ ...inputStyle, resize: "vertical", lineHeight: 1.5 }}
          />
        </div>
        <div>
          <label style={labelStyle}>LinkedIn URL</label>
          <input
            style={inputStyle}
            type="url"
            value={form.linkedin}
            onChange={(e) => set("linkedin", e.target.value)}
            placeholder="https://linkedin.com/in/tu-perfil"
          />
        </div>
        <div>
          <label style={labelStyle}>Foto de perfil (URL)</label>
          <input
            style={inputStyle}
            type="url"
            value={form.foto}
            onChange={(e) => set("foto", e.target.value)}
            placeholder="https://... (próximamente: subida directa)"
          />
          {form.foto && (
            <div style={{ marginTop: 6, display: "flex", alignItems: "center", gap: 8 }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={form.foto}
                alt="preview"
                onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none" }}
                style={{ width: 36, height: 36, borderRadius: "50%", objectFit: "cover", border: "1px solid var(--border-hi)" }}
              />
              <span style={{ fontSize: 9, color: "var(--text-mute)" }}>Preview</span>
            </div>
          )}
        </div>
      </FormSection>

      {/* Perfil de riesgo */}
      <FormSection title="Perfil de riesgo">
        <div style={{ display: "flex", gap: 8 }}>
          {(["conservador", "moderado", "agresivo"] as PerfilRiesgo[]).map((r) => (
            <button
              key={r}
              type="button"
              onClick={() => set("perfilRiesgo", r)}
              style={{
                flex: 1, padding: "8px 0",
                border: `1px solid ${form.perfilRiesgo === r ? "var(--amber)" : "var(--border-hi)"}`,
                borderRadius: 4,
                background: form.perfilRiesgo === r ? "rgba(232,148,74,0.15)" : "var(--bg-elev-2)",
                color: form.perfilRiesgo === r ? "var(--amber)" : "var(--text-dim)",
                cursor: "pointer", fontSize: 11, fontFamily: "var(--font-ui)",
                transition: "all 0.12s",
                textTransform: "capitalize",
              }}
            >
              {r}
            </button>
          ))}
        </div>
      </FormSection>

      {/* Cartera declarada */}
      <FormSection title="Cartera declarada">
        <AccionesEditor
          acciones={form.topAcciones}
          onChange={(v) => set("topAcciones", v)}
        />
      </FormSection>

      {/* Intereses */}
      <FormSection title="Intereses">
        <InterestSection
          title="Renta fija"
          tags={INTEREST_CATEGORIES.rentaFija}
          selected={form.interesesRentaFija}
          onChange={(v) => set("interesesRentaFija", v)}
        />
        <InterestSection
          title="Renta variable"
          tags={INTEREST_CATEGORIES.rentaVariable}
          selected={form.interesesRentaVariable}
          onChange={(v) => set("interesesRentaVariable", v)}
        />
        <InterestSection
          title="Macro & FX"
          tags={INTEREST_CATEGORIES.macro}
          selected={form.interesesMacro}
          onChange={(v) => set("interesesMacro", v)}
        />
        <InterestSection
          title="Otros"
          tags={INTEREST_CATEGORIES.otros}
          selected={form.interesesOtros}
          onChange={(v) => set("interesesOtros", v)}
        />
      </FormSection>

      {/* Error */}
      {error && (
        <div style={{
          margin: "0 16px",
          padding: "8px 12px",
          background: "rgba(230,123,107,0.1)",
          border: "1px solid rgba(230,123,107,0.35)",
          borderRadius: 4,
          fontSize: 11, color: "var(--negative)",
        }}>
          {error}
        </div>
      )}

      {/* Actions */}
      <div style={{
        position: "sticky", bottom: 0,
        padding: "12px 16px",
        background: "var(--bg-elev-2)",
        borderTop: "1px solid var(--border)",
        display: "flex", gap: 8, marginTop: 8,
      }}>
        <button
          type="button"
          onClick={onCancel}
          disabled={saving}
          style={{
            flex: 1, padding: "9px 0",
            background: "var(--bg)", border: "1px solid var(--border-hi)",
            color: "var(--text-dim)", borderRadius: 4, cursor: "pointer",
            fontSize: 12, fontFamily: "var(--font-ui)",
          }}
        >
          Cancelar
        </button>
        <button
          type="submit"
          disabled={saving}
          style={{
            flex: 2, padding: "9px 0",
            background: saving ? "var(--bg-elev-2)" : "var(--amber)",
            border: `1px solid ${saving ? "var(--border-hi)" : "var(--amber)"}`,
            color: saving ? "var(--text-mute)" : "#000",
            borderRadius: 4, cursor: saving ? "not-allowed" : "pointer",
            fontSize: 12, fontWeight: 700, fontFamily: "var(--font-ui)",
            display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
          }}
        >
          {saving
            ? <><Loader2 size={14} style={{ animation: "spin 1s linear infinite" }} /> Guardando…</>
            : <><Save size={14} /> Guardar cambios</>
          }
        </button>
      </div>

      <style>{`@keyframes spin { from { transform: rotate(0deg) } to { transform: rotate(360deg) } }`}</style>
    </form>
  )
}
