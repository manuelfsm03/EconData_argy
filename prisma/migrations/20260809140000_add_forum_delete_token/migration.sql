-- AlterTable: token secreto para que el autor pueda borrar su propio post (sin cuenta)
ALTER TABLE "forum_posts" ADD COLUMN "delete_token" TEXT;
