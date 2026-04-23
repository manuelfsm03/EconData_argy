-- ============================================================
-- Schema de observabilidad — Agente EconData_argy
-- Pegar en SQL Editor de Supabase (una sola vez)
-- ============================================================

CREATE TABLE IF NOT EXISTS chat_events (
  id              BIGSERIAL PRIMARY KEY,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  ip_hash         TEXT NOT NULL,
  session_id      TEXT,

  message_text    TEXT NOT NULL,
  message_hash    TEXT NOT NULL,
  message_len     INTEGER NOT NULL,

  model_id        TEXT NOT NULL,
  model_version   TEXT,

  tool_calls      JSONB DEFAULT '[]'::jsonb,
  iterations      INTEGER NOT NULL DEFAULT 1,

  latency_ms_total  INTEGER NOT NULL,
  latency_ms_llm    INTEGER,
  latency_ms_tools  INTEGER,

  tokens_input    INTEGER,
  tokens_output   INTEGER,
  cost_usd        NUMERIC(10, 6),

  status          TEXT NOT NULL CHECK (status IN ('ok', 'error', 'rate_limited', 'timeout')),
  error_message   TEXT,
  answer_len      INTEGER
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_chat_events_created_at ON chat_events (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_chat_events_ip_hash    ON chat_events (ip_hash, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_chat_events_model      ON chat_events (model_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_chat_events_status     ON chat_events (status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_chat_events_msg_hash   ON chat_events (message_hash);

-- RLS
ALTER TABLE chat_events ENABLE ROW LEVEL SECURITY;
-- Sin políticas = solo service_role (usado por el backend) puede acceder

-- Verificación
SELECT 'schema creado ok' AS status;
