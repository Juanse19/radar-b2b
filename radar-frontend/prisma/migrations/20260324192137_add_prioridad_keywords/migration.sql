-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_empresas" (
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
    "prioridad" INTEGER NOT NULL DEFAULT 0,
    "keywords" TEXT,
    "last_run_at" DATETIME,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL
);
INSERT INTO "new_empresas" ("ciudad", "company_domain", "company_name", "company_url", "created_at", "id", "last_run_at", "linea_negocio", "linea_raw", "pais", "status", "tier", "updated_at") SELECT "ciudad", "company_domain", "company_name", "company_url", "created_at", "id", "last_run_at", "linea_negocio", "linea_raw", "pais", "status", "tier", "updated_at" FROM "empresas";
DROP TABLE "empresas";
ALTER TABLE "new_empresas" RENAME TO "empresas";
CREATE INDEX "empresas_linea_negocio_idx" ON "empresas"("linea_negocio");
CREATE INDEX "empresas_last_run_at_idx" ON "empresas"("last_run_at");
CREATE INDEX "empresas_prioridad_idx" ON "empresas"("prioridad");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
