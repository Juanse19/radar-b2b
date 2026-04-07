-- CreateTable
CREATE TABLE "prospeccion_logs" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "empresa_nombre" TEXT NOT NULL,
    "linea" TEXT NOT NULL,
    "n8n_execution_id" TEXT,
    "estado" TEXT NOT NULL DEFAULT 'running',
    "contactos_encontrados" INTEGER NOT NULL DEFAULT 0,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finished_at" DATETIME
);

-- CreateIndex
CREATE INDEX "prospeccion_logs_linea_idx" ON "prospeccion_logs"("linea");

-- CreateIndex
CREATE INDEX "prospeccion_logs_estado_idx" ON "prospeccion_logs"("estado");

-- CreateIndex
CREATE INDEX "prospeccion_logs_created_at_idx" ON "prospeccion_logs"("created_at");
