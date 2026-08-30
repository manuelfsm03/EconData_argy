import { spawnSync } from "node:child_process"
import { PrismaClient } from "@prisma/client"
import path from "node:path"

const databaseUrl = process.env.DATABASE_URL
// Production deploys must remain read-only unless an operator explicitly opts
// into this migration. Users/Community are outside the MVP release scope.
const migrationEnabled = process.env.APPLY_FORUM_MIGRATION === "1"

if (!databaseUrl || !migrationEnabled) {
  const reason = !databaseUrl ? "DATABASE_URL absent" : "explicit opt-in absent"
  console.log(`forum-engagement migration: ${reason}; skipping database step`)
  process.exit(0)
}

const root = process.cwd()
const prismaBin = path.join(
  root,
  "node_modules",
  ".bin",
  process.platform === "win32" ? "prisma.cmd" : "prisma",
)
const migrationFile = path.join(
  root,
  "prisma",
  "postgresql",
  "20260810_add_forum_engagement.sql",
)

const migration = spawnSync(
  prismaBin,
  ["db", "execute", "--schema", "prisma/schema.prisma", "--file", migrationFile],
  { cwd: root, env: process.env, stdio: "inherit" },
)

if (migration.error) throw migration.error
if (migration.status !== 0) {
  throw new Error(`forum-engagement migration failed with exit ${migration.status}`)
}

const prisma = new PrismaClient()
try {
  const rows = await prisma.$queryRawUnsafe(`
    SELECT
      EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = current_schema()
          AND table_name = 'asset_forum_posts'
          AND column_name = 'delete_token_hash'
      ) AS delete_token_hash,
      to_regclass(current_schema() || '.asset_forum_reactions') IS NOT NULL AS reactions_table
  `)
  const verified = Array.isArray(rows) ? rows[0] : null
  if (!verified?.delete_token_hash || !verified?.reactions_table) {
    throw new Error("forum-engagement migration verification failed")
  }
  console.log("forum-engagement migration: schema verified")
} finally {
  await prisma.$disconnect()
}
