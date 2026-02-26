-- CreateTable
CREATE TABLE "sovereign_bonds" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "ticker" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "moneda" TEXT NOT NULL,
    "ley" TEXT NOT NULL,
    "cupon" REAL NOT NULL,
    "amortizacion" TEXT NOT NULL,
    "emision" DATETIME,
    "vencimiento" DATETIME NOT NULL,
    "precio" REAL,
    "tir" REAL,
    "paridad" REAL,
    "current_yield" REAL,
    "duration_mod" REAL,
    "updated_at" DATETIME NOT NULL,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "bond_prices" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "bond_id" TEXT NOT NULL,
    "date" DATETIME NOT NULL,
    "price_usd" REAL,
    "price_ars" REAL,
    "volume" REAL,
    "source" TEXT NOT NULL DEFAULT 'rava',
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "bond_prices_bond_id_fkey" FOREIGN KEY ("bond_id") REFERENCES "sovereign_bonds" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "bond_cashflows" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "bond_id" TEXT NOT NULL,
    "fecha_pago" DATETIME NOT NULL,
    "cupon" REAL NOT NULL DEFAULT 0,
    "amortizacion" REAL NOT NULL DEFAULT 0,
    "flujo_total" REAL NOT NULL,
    CONSTRAINT "bond_cashflows_bond_id_fkey" FOREIGN KEY ("bond_id") REFERENCES "sovereign_bonds" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "cap_instruments" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "ticker" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "vencimiento" DATETIME NOT NULL,
    "precio" REAL,
    "tir" REAL,
    "tea" REAL,
    "tem" REAL,
    "precio_tecnico" REAL,
    "updated_at" DATETIME NOT NULL,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "cap_prices" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "instrument_id" TEXT NOT NULL,
    "date" DATETIME NOT NULL,
    "precio" REAL,
    "tem" REAL,
    "volume" REAL,
    "source" TEXT NOT NULL DEFAULT 'byma',
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "cap_prices_instrument_id_fkey" FOREIGN KEY ("instrument_id") REFERENCES "cap_instruments" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "sovereign_bonds_ticker_key" ON "sovereign_bonds"("ticker");

-- CreateIndex
CREATE UNIQUE INDEX "bond_prices_bond_id_date_key" ON "bond_prices"("bond_id", "date");

-- CreateIndex
CREATE UNIQUE INDEX "cap_instruments_ticker_key" ON "cap_instruments"("ticker");

-- CreateIndex
CREATE UNIQUE INDEX "cap_prices_instrument_id_date_key" ON "cap_prices"("instrument_id", "date");
