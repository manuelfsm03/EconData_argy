-- Asset-scoped public forum for PostgreSQL production.
-- Uses distinct names because production already owns `forum_posts` for the
-- authenticated general forum.
CREATE TABLE IF NOT EXISTS "asset_forum_posts" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "asset_type" TEXT NOT NULL,
    "asset_ticker" TEXT NOT NULL,
    "author_name" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "parent_id" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "asset_forum_posts_parent_id_fkey"
      FOREIGN KEY ("parent_id") REFERENCES "asset_forum_posts"("id")
      ON DELETE SET NULL ON UPDATE CASCADE
);

-- Reconcile the abandoned bucket-based draft if it was applied during QA.
DROP INDEX IF EXISTS "asset_forum_posts_rate_limit_key";
ALTER TABLE "asset_forum_posts" DROP COLUMN IF EXISTS "author_ip";
ALTER TABLE "asset_forum_posts" DROP COLUMN IF EXISTS "rate_bucket";

CREATE INDEX IF NOT EXISTS "asset_forum_posts_asset_created_idx"
  ON "asset_forum_posts"("asset_type", "asset_ticker", "created_at", "id");

CREATE TABLE IF NOT EXISTS "asset_forum_rate_limits" (
    "identity_token" TEXT NOT NULL,
    "asset_type" TEXT NOT NULL,
    "asset_ticker" TEXT NOT NULL,
    "next_allowed_at_ms" BIGINT NOT NULL,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY ("identity_token", "asset_type", "asset_ticker")
);
