-- CreateTable
CREATE TABLE "forum_reactions" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "post_id" TEXT NOT NULL,
    "emoji" TEXT NOT NULL,
    "author_ip" TEXT NOT NULL,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "forum_reactions_post_id_fkey" FOREIGN KEY ("post_id") REFERENCES "forum_posts" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "forum_reactions_post_id_author_ip_emoji_key" ON "forum_reactions"("post_id", "author_ip", "emoji");
