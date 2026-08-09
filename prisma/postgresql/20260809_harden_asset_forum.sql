-- Harden the asset forum for PostgreSQL: remove per-post identity metadata
-- and add an atomic pseudonymous rate-limit ledger scoped by asset thread.
BEGIN;

DROP INDEX IF EXISTS "asset_forum_posts_rate_limit_key";
ALTER TABLE "asset_forum_posts" DROP COLUMN IF EXISTS "author_ip";
ALTER TABLE "asset_forum_posts" DROP COLUMN IF EXISTS "rate_bucket";

CREATE TABLE IF NOT EXISTS "asset_forum_rate_limits" (
    "identity_token" TEXT NOT NULL,
    "asset_type" TEXT NOT NULL,
    "asset_ticker" TEXT NOT NULL,
    "next_allowed_at_ms" BIGINT NOT NULL,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY ("identity_token", "asset_type", "asset_ticker")
);

CREATE INDEX IF NOT EXISTS "asset_forum_rate_limits_next_allowed_idx"
  ON "asset_forum_rate_limits"("next_allowed_at_ms");

COMMIT;
