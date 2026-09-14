-- Perfiles de usuario, predicciones e informes — traducción manual a Postgres
-- de los modelos Profile/Prediction/Report de prisma/schema.prisma.
--
-- Se escribe a mano, igual que asset_forum_posts y las demás migraciones de
-- esta carpeta: `prisma/migrations/` quedó fósil de una era SQLite (ver
-- migration_lock.toml, sigue en "sqlite") y ya no coincide con el
-- datasource actual del schema ("postgresql"); la producción real se
-- administra corriendo estos .sql a mano contra Supabase, no con
-- `prisma migrate`. Verificado en vivo: ninguna de las dos carpetas tenía
-- hasta ahora las tablas de usuario — Profile/Prediction/Report existían
-- sólo como definición en el schema, nunca se crearon en ninguna base real.
--
-- `id` de "profiles" es el UUID de auth.users.id de Supabase: no lleva
-- default acá, lo pone la app al crear el perfil (ver
-- src/server/auth/get-or-create-profile.ts). Los `id` de predictions/reports
-- tampoco llevan default de base: Prisma Client genera el cuid() del lado
-- de la aplicación antes del insert, igual que en el resto de las tablas
-- (confirmado contra prisma/migrations/20260127161531_init).
--
-- `updated_at` es NOT NULL sin default: @updatedAt en Prisma es un
-- comportamiento de Prisma Client (pone now() en cada create/update), no un
-- default de la base. Un INSERT manual por fuera de Prisma Client (SQL
-- directo, un trigger de Supabase) tiene que proveerlo a mano o falla —
-- verificado contra el SQL que genera el propio motor de esquemas de
-- Prisma (`prisma migrate diff` esquema-a-esquema, sin tocar ninguna base
-- real) para no adivinar el comportamiento.
--
-- Igual con ON DELETE RESTRICT en las FK hacia profiles: es el default de
-- Prisma cuando el schema no declara onDelete explícito. CASCADE borraría
-- en silencio todas las predicciones e informes de alguien al borrar su
-- perfil — RESTRICT obliga a hacerlo a propósito.

CREATE TABLE IF NOT EXISTS "profiles" (
    "id"                        TEXT NOT NULL PRIMARY KEY,
    "username"                  TEXT NOT NULL,
    "display_name"              TEXT,
    "avatar_url"                TEXT,
    "avatar_bg"                 TEXT NOT NULL DEFAULT '#1B2A4A',

    "can_publish"               BOOLEAN NOT NULL DEFAULT FALSE,

    "bio"                       TEXT NOT NULL DEFAULT '',
    "linkedin"                  TEXT,
    "nivel"                     TEXT NOT NULL DEFAULT 'Novato',
    "puntos"                    INTEGER NOT NULL DEFAULT 0,
    "streak"                    INTEGER NOT NULL DEFAULT 0,
    "posts"                     INTEGER NOT NULL DEFAULT 0,
    "seguidores"                INTEGER NOT NULL DEFAULT 0,
    "aciertos"                  INTEGER NOT NULL DEFAULT 0,
    "total_prediciones"         INTEGER NOT NULL DEFAULT 0,
    "fecha_alta"                TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    "intereses"                 TEXT[] NOT NULL DEFAULT '{}',
    "intereses_renta_fija"      TEXT[] NOT NULL DEFAULT '{}',
    "intereses_renta_variable"  TEXT[] NOT NULL DEFAULT '{}',
    "perfil_riesgo"             TEXT,
    "top_acciones"              JSONB NOT NULL DEFAULT '[]'::jsonb,

    "created_at"                TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at"                TIMESTAMPTZ NOT NULL,

    CONSTRAINT "profiles_username_key" UNIQUE ("username")
);

CREATE TABLE IF NOT EXISTS "predictions" (
    "id"                TEXT NOT NULL PRIMARY KEY,
    "autor_id"          TEXT NOT NULL,
    "activo"            TEXT NOT NULL,
    "tipo_activo"       TEXT NOT NULL,
    "tesis"             TEXT NOT NULL,
    "metrica"           TEXT NOT NULL,
    "operador"          TEXT NOT NULL,
    "objetivo"          DOUBLE PRECISION,
    "objetivo_max"      DOUBLE PRECISION,
    "valor_entrada"     DOUBLE PRECISION NOT NULL,
    "fecha_entrada"     TIMESTAMPTZ NOT NULL,
    "horizonte"         TEXT NOT NULL,
    "fecha_resolucion"  TIMESTAMPTZ NOT NULL,
    "estado"            TEXT NOT NULL DEFAULT 'abierta',
    "valor_resolucion"  DOUBLE PRECISION,
    "fecha_resuelta"    TIMESTAMPTZ,
    "fuente"            TEXT,
    "created_at"        TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at"        TIMESTAMPTZ NOT NULL,

    CONSTRAINT "predictions_autor_id_fkey"
      FOREIGN KEY ("autor_id") REFERENCES "profiles"("id")
      ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "predictions_autor_id_idx" ON "predictions"("autor_id");
CREATE INDEX IF NOT EXISTS "predictions_estado_fecha_resolucion_idx" ON "predictions"("estado", "fecha_resolucion");

CREATE TABLE IF NOT EXISTS "reports" (
    "id"          TEXT NOT NULL PRIMARY KEY,
    "title"       TEXT NOT NULL,
    "body"        TEXT NOT NULL,
    "author_id"   TEXT NOT NULL,
    "created_at"  TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at"  TIMESTAMPTZ NOT NULL,

    CONSTRAINT "reports_author_id_fkey"
      FOREIGN KEY ("author_id") REFERENCES "profiles"("id")
      ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "reports_created_at_idx" ON "reports"("created_at");
