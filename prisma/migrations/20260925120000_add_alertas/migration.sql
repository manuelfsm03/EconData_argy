-- CreateTable
CREATE TABLE "alertas" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "user_id" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "config" JSONB NOT NULL,
    "canal" TEXT NOT NULL DEFAULT 'email',
    "email_destino" TEXT NOT NULL,
    "estado" TEXT NOT NULL DEFAULT 'activa',
    "ultimo_disparo" DATETIME,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "alertas_user_id_fkey"
      FOREIGN KEY ("user_id") REFERENCES "profiles"("id")
      ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "alertas_user_id_estado_idx" ON "alertas"("user_id", "estado");
