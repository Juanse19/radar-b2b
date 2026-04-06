-- CreateTable
CREATE TABLE "empresas" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "company_name" TEXT NOT NULL,
    "company_domain" TEXT,
    "company_url" TEXT,
    "pais" TEXT,
    "ciudad" TEXT,
    "linea_negocio" TEXT NOT NULL,
    "linea_raw" TEXT,
    "tier" TEXT NOT NULL DEFAULT 'Tier B',
    "status" TEXT NOT NULL DEFAULT 'pending',
    "last_run_at" DATETIME,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "ejecuciones" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "n8n_execution_id" TEXT,
    "linea_negocio" TEXT,
    "batch_size" INTEGER,
    "estado" TEXT NOT NULL DEFAULT 'running',
    "trigger_type" TEXT NOT NULL DEFAULT 'manual',
    "parametros" TEXT,
    "error_msg" TEXT,
    "started_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finished_at" DATETIME
);

-- CreateIndex
CREATE INDEX "empresas_linea_negocio_idx" ON "empresas"("linea_negocio");

-- CreateIndex
CREATE INDEX "empresas_last_run_at_idx" ON "empresas"("last_run_at");

-- CreateIndex
CREATE INDEX "ejecuciones_linea_negocio_idx" ON "ejecuciones"("linea_negocio");

-- CreateIndex
CREATE INDEX "ejecuciones_estado_idx" ON "ejecuciones"("estado");

-- CreateIndex
CREATE INDEX "ejecuciones_started_at_idx" ON "ejecuciones"("started_at");
