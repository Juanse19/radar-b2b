-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_ejecuciones" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "n8n_execution_id" TEXT,
    "linea_negocio" TEXT,
    "batch_size" INTEGER,
    "estado" TEXT NOT NULL DEFAULT 'running',
    "trigger_type" TEXT NOT NULL DEFAULT 'manual',
    "parametros" TEXT,
    "error_msg" TEXT,
    "started_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finished_at" DATETIME,
    "agent_type" TEXT NOT NULL DEFAULT 'calificador',
    "pipeline_id" TEXT,
    "parent_execution_id" INTEGER,
    "current_step" TEXT,
    CONSTRAINT "ejecuciones_parent_execution_id_fkey" FOREIGN KEY ("parent_execution_id") REFERENCES "ejecuciones" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_ejecuciones" ("batch_size", "error_msg", "estado", "finished_at", "id", "linea_negocio", "n8n_execution_id", "parametros", "started_at", "trigger_type") SELECT "batch_size", "error_msg", "estado", "finished_at", "id", "linea_negocio", "n8n_execution_id", "parametros", "started_at", "trigger_type" FROM "ejecuciones";
DROP TABLE "ejecuciones";
ALTER TABLE "new_ejecuciones" RENAME TO "ejecuciones";
CREATE INDEX "ejecuciones_linea_negocio_idx" ON "ejecuciones"("linea_negocio");
CREATE INDEX "ejecuciones_estado_idx" ON "ejecuciones"("estado");
CREATE INDEX "ejecuciones_started_at_idx" ON "ejecuciones"("started_at");
CREATE INDEX "ejecuciones_pipeline_id_idx" ON "ejecuciones"("pipeline_id");
CREATE INDEX "ejecuciones_agent_type_idx" ON "ejecuciones"("agent_type");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
