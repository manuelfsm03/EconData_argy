-- CreateTable
CREATE TABLE "exchange_rates" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "date" DATETIME NOT NULL,
    "blue" REAL,
    "ccl_libre" REAL,
    "ccl_controlado" REAL,
    "mep_libre" REAL,
    "mep_controlado" REAL,
    "oficial" REAL,
    "mayorista" REAL,
    "a3500" REAL,
    "solidario" REAL,
    "cripto" REAL,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "exchange_gaps" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "date" DATETIME NOT NULL,
    "brecha_mep_blue" REAL,
    "brecha_ccl_blue" REAL,
    "brecha_mep_oficial" REAL,
    "brecha_ccl_oficial" REAL,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "inflation" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "date" DATETIME NOT NULL,
    "monthly" REAL,
    "year_to_date" REAL,
    "interannual" REAL,
    "accumulated" REAL,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "rofex_futures" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "date" DATETIME NOT NULL,
    "position" TEXT NOT NULL,
    "maturity" DATETIME NOT NULL,
    "maturity_label" TEXT,
    "price" REAL,
    "devaluation" REAL,
    "monthly_devaluation" REAL,
    "tna" REAL,
    "cft" REAL,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "us_treasury" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "date" DATETIME NOT NULL,
    "yield_10y" REAL,
    "tips_10y" REAL,
    "expected_inflation" REAL,
    "fed_funds_rate" REAL,
    "us_inflation" REAL,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "badlar_rates" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "date" DATETIME NOT NULL,
    "rate" REAL,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "merval_index" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "date" DATETIME NOT NULL,
    "value" REAL,
    "volume" REAL,
    "change" REAL,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "crypto_rates" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "date" DATETIME NOT NULL,
    "exchange" TEXT NOT NULL,
    "usdt_ars" REAL,
    "btc_ars" REAL,
    "usdc_ars" REAL,
    "dai_ars" REAL,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "news_items" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "link" TEXT NOT NULL,
    "description" TEXT,
    "source" TEXT NOT NULL,
    "pub_date" DATETIME NOT NULL,
    "category" TEXT,
    "is_read" BOOLEAN NOT NULL DEFAULT false,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "scrape_logs" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "source" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "message" TEXT,
    "records_added" INTEGER,
    "duration" INTEGER,
    "started_at" DATETIME NOT NULL,
    "completed_at" DATETIME,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "data_sources" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "last_run" DATETIME,
    "last_status" TEXT,
    "cron_schedule" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "exchange_rates_date_key" ON "exchange_rates"("date");

-- CreateIndex
CREATE UNIQUE INDEX "exchange_gaps_date_key" ON "exchange_gaps"("date");

-- CreateIndex
CREATE UNIQUE INDEX "inflation_date_key" ON "inflation"("date");

-- CreateIndex
CREATE UNIQUE INDEX "rofex_futures_date_position_key" ON "rofex_futures"("date", "position");

-- CreateIndex
CREATE UNIQUE INDEX "us_treasury_date_key" ON "us_treasury"("date");

-- CreateIndex
CREATE UNIQUE INDEX "badlar_rates_date_key" ON "badlar_rates"("date");

-- CreateIndex
CREATE UNIQUE INDEX "merval_index_date_key" ON "merval_index"("date");

-- CreateIndex
CREATE UNIQUE INDEX "crypto_rates_date_exchange_key" ON "crypto_rates"("date", "exchange");

-- CreateIndex
CREATE UNIQUE INDEX "news_items_link_key" ON "news_items"("link");

-- CreateIndex
CREATE UNIQUE INDEX "data_sources_name_key" ON "data_sources"("name");
