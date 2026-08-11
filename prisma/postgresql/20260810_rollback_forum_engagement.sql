-- Manual rollback for 20260810_add_forum_engagement.sql.
-- Safe for the pre-engagement application: the previous release does not read either object.
BEGIN;

DROP TABLE IF EXISTS "asset_forum_reactions";

ALTER TABLE "asset_forum_posts"
  DROP COLUMN IF EXISTS "delete_token_hash";

COMMIT;
