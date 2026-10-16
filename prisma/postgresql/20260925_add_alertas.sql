-- ─── ALERTAS (MVP freemium) ─────────────────────────────────────────────────
-- Tabla nueva para el MVP de alertas por email:
--   • 3 tipos: "dolar" | "tasa_bcra" | "publicacion_ipc"
--   • un solo canal: "email" (Telegram/push llegan después)
--   • free = 3 alertas activas por usuario (gate en la API)
--   • ownership por userId = profiles.id (UUID Supabase auth.users.id)

CREATE TABLE IF NOT EXISTS "alertas" (
    "id"             TEXT NOT NULL PRIMARY KEY,
    "user_id"        TEXT NOT NULL,
    "tipo"           TEXT NOT NULL,                       -- dolar | tasa_bcra | publicacion_ipc
    "config"         JSONB NOT NULL,                      -- p.ej. {"variedad":"blue","operador":">","umbral":1500}
    "canal"          TEXT NOT NULL DEFAULT 'email',
    "email_destino"  TEXT NOT NULL,
    "estado"         TEXT NOT NULL DEFAULT 'activa',      -- activa | pausada | disparada
    "ultimo_disparo" TIMESTAMPTZ,
    "created_at"     TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at"     TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "alertas_user_id_fkey"
      FOREIGN KEY ("user_id") REFERENCES "profiles"("id")
      ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "alertas_user_id_estado_idx"
  ON "alertas"("user_id", "estado");
