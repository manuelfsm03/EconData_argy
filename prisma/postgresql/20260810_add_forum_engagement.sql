-- Social features for the hardened asset-scoped forum.
-- Idempotent PostgreSQL migration: no raw IPs and no plaintext delete tokens.
BEGIN;

ALTER TABLE "asset_forum_posts"
  ADD COLUMN IF NOT EXISTS "delete_token_hash" TEXT;

CREATE TABLE IF NOT EXISTS "asset_forum_reactions" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "post_id" TEXT NOT NULL,
  "emoji" TEXT NOT NULL,
  "identity_token" TEXT NOT NULL,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "asset_forum_reactions_post_id_fkey"
    FOREIGN KEY ("post_id") REFERENCES "asset_forum_posts"("id")
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "asset_forum_reactions_post_identity_key"
    UNIQUE ("post_id", "identity_token")
);

CREATE INDEX IF NOT EXISTS "asset_forum_reactions_post_id_idx"
  ON "asset_forum_reactions"("post_id");

COMMIT;
