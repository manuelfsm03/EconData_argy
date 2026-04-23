-- ============================================================
-- Schema Agente Monitor — La Pizarra
-- Pegar en SQL Editor de Supabase
-- ============================================================

CREATE TABLE IF NOT EXISTS monitor_runs (
  id                BIGSERIAL PRIMARY KEY,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  healthy           BOOLEAN NOT NULL,
  nivel             TEXT NOT NULL CHECK (nivel IN ('ok', 'bajo', 'medio', 'alto', 'critico')),

  checks_total      INTEGER NOT NULL,
  degradados_count  INTEGER NOT NULL DEFAULT 0,

  summary           JSONB DEFAULT '{}'::jsonb,
  degradados        JSONB DEFAULT '[]'::jsonb,

  elapsed_ms        INTEGER
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_monitor_runs_created_at ON monitor_runs (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_monitor_runs_nivel       ON monitor_runs (nivel, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_monitor_runs_healthy     ON monitor_runs (healthy, created_at DESC);

-- RLS
ALTER TABLE monitor_runs ENABLE ROW LEVEL SECURITY;

SELECT 'monitor schema ok' AS status;
