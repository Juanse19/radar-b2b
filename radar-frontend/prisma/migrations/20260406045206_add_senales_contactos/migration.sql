-- CreateTable
CREATE TABLE "senales" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "empresa_id" INTEGER,
    "ejecucion_id" INTEGER,
    "empresa_nombre" TEXT NOT NULL,
    "empresa_pais" TEXT,
    "linea_negocio" TEXT NOT NULL,
    "tier" TEXT,
    "radar_activo" BOOLEAN NOT NULL DEFAULT false,
    "tipo_senal" TEXT,
    "descripcion" TEXT,
    "fuente" TEXT,
    "fuente_url" TEXT,
    "score_radar" REAL NOT NULL DEFAULT 0,
    "ventana_compra" TEXT,
    "prioridad_comercial" TEXT,
    "motivo_descarte" TEXT,
    "ticket_estimado" TEXT,
    "razonamiento_agente" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "senales_empresa_id_fkey" FOREIGN KEY ("empresa_id") REFERENCES "empresas" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "senales_ejecucion_id_fkey" FOREIGN KEY ("ejecucion_id") REFERENCES "ejecuciones" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "contactos" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "empresa_id" INTEGER,
    "nombre" TEXT NOT NULL,
    "cargo" TEXT,
    "email" TEXT,
    "telefono" TEXT,
    "linkedin_url" TEXT,
    "empresa_nombre" TEXT,
    "linea_negocio" TEXT,
    "fuente" TEXT NOT NULL DEFAULT 'apollo',
    "hubspot_status" TEXT NOT NULL DEFAULT 'pendiente',
    "hubspot_id" TEXT,
    "apollo_id" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "contactos_empresa_id_fkey" FOREIGN KEY ("empresa_id") REFERENCES "empresas" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "senales_empresa_id_idx" ON "senales"("empresa_id");

-- CreateIndex
CREATE INDEX "senales_linea_negocio_idx" ON "senales"("linea_negocio");

-- CreateIndex
CREATE INDEX "senales_score_radar_idx" ON "senales"("score_radar");

-- CreateIndex
CREATE INDEX "senales_created_at_idx" ON "senales"("created_at");

-- CreateIndex
CREATE INDEX "contactos_empresa_id_idx" ON "contactos"("empresa_id");

-- CreateIndex
CREATE INDEX "contactos_hubspot_status_idx" ON "contactos"("hubspot_status");

-- CreateIndex
CREATE INDEX "contactos_linea_negocio_idx" ON "contactos"("linea_negocio");
