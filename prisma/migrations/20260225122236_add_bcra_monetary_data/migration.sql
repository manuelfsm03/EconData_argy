-- CreateTable
CREATE TABLE "bcra_monetary_data" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "date" DATETIME NOT NULL,
    "reservas" REAL,
    "base_monetaria" REAL,
    "circulacion" REAL,
    "prestamos_privado" REAL,
    "tc_minorista" REAL,
    "tc_mayorista" REAL,
    "badlar" REAL,
    "tm20" REAL,
    "depositos_30d" REAL,
    "cer" REAL,
    "uva" REAL,
    "uvi" REAL,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "bcra_monetary_data_date_key" ON "bcra_monetary_data"("date");
