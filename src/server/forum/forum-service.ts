import type { Prisma, PrismaClient } from "@prisma/client"
import { FORUM_PAGE_SIZE, FORUM_RATE_LIMIT_SECONDS } from "@/server/forum/forum-policy"

const PUBLIC_POST_SELECT = {
  id: true,
  authorName: true,
  content: true,
  parentId: true,
  createdAt: true,
} satisfies Prisma.ForumPostSelect

export class ForumRateLimitError extends Error {
  constructor() {
    super("forum rate limit exceeded")
    this.name = "ForumRateLimitError"
  }
}

export class ForumParentScopeError extends Error {
  constructor() {
    super("forum parent is outside the requested thread")
    this.name = "ForumParentScopeError"
  }
}

interface CreateForumPostInput {
  assetType: string
  assetTicker: string
  authorName: string
  content: string
  parentId: string | null
  identityToken: string
  deleteTokenHash: string
  nowMs?: number
}

export async function createForumPostAtomic(prisma: PrismaClient, input: CreateForumPostInput) {
  const nowMs = BigInt(input.nowMs ?? Date.now())
  const nextAllowedAtMs = nowMs + BigInt(FORUM_RATE_LIMIT_SECONDS * 1000)

  return prisma.$transaction(async tx => {
    const claimed = await tx.$executeRaw`
      INSERT INTO "asset_forum_rate_limits"
        ("identity_token", "asset_type", "asset_ticker", "next_allowed_at_ms", "updated_at")
      VALUES
        (${input.identityToken}, ${input.assetType}, ${input.assetTicker}, ${nextAllowedAtMs}, CURRENT_TIMESTAMP)
      ON CONFLICT ("identity_token", "asset_type", "asset_ticker") DO UPDATE SET
        "next_allowed_at_ms" = EXCLUDED."next_allowed_at_ms",
        "updated_at" = CURRENT_TIMESTAMP
      WHERE "asset_forum_rate_limits"."next_allowed_at_ms" <= ${nowMs}
    `

    if (claimed !== 1) throw new ForumRateLimitError()

    if (input.parentId) {
      const parent = await tx.forumPost.findFirst({
        where: {
          id: input.parentId,
          assetType: input.assetType,
          assetTicker: input.assetTicker,
        },
        select: { id: true },
      })
      if (!parent) throw new ForumParentScopeError()
    }

    const post = await tx.forumPost.create({
      data: {
        assetType: input.assetType,
        assetTicker: input.assetTicker,
        authorName: input.authorName,
        content: input.content,
        parentId: input.parentId,
        deleteTokenHash: input.deleteTokenHash,
      },
      select: PUBLIC_POST_SELECT,
    })
    const total = await tx.forumPost.count({
      where: { assetType: input.assetType, assetTicker: input.assetTicker },
    })

    return {
      post,
      total,
      totalPages: Math.max(1, Math.ceil(total / FORUM_PAGE_SIZE)),
    }
  }, { maxWait: 5_000, timeout: 10_000 })
}
