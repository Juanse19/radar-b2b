# Radar Frontend — Next.js App

Interfaz web del sistema Matec Radar B2B. Permite disparar los 3 agentes N8N,
visualizar señales de inversión y gestionar la base de datos de empresas.

## Inicio Rápido

```bash
npm install
cp ../.env.example .env       # Completar N8N_API_KEY, DATABASE_URL y DB_DRIVER
# DB_DRIVER=prisma usa SQLite local (no requiere Supabase)
npm run dev                    # http://localhost:3000
```

## Comandos

```bash
npm run dev          # Dev server con hot reload
npm run build        # Build de producción
npm run lint         # ESLint
npm run test         # Vitest (unitarios)
npm run test:watch   # Tests en modo watch
npx vitest run       # Vitest una sola vez (101 tests)
npx playwright test  # Tests E2E (tests/e2e/, excluidos de Vitest via vitest.config.ts)
```

## Variables de Entorno

Ver [`.env.example`](../.env.example) en la raíz. Mínimo necesario:

```env
N8N_HOST=https://n8n.event2flow.com
N8N_API_KEY=...
N8N_WORKFLOW_ID=jDtdafuyYt8TXISl
DATABASE_URL="file:./prisma/dev.db"
DB_DRIVER=prisma

# Supabase (requerido si DB_DRIVER=supabase)
SUPABASE_URL=https://supabase.valparaiso.cafe
SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...
```

## Estructura

```
app/
  api/            # REST endpoints -> N8N webhooks + DB
  empresas/       # Lista y gestion de empresas
  scan/           # Trigger manual de escaneo
  results/        # Señales detectadas
  contactos/      # Contactos Apollo.io
  schedule/       # Programacion de escaneos
lib/
  n8n.ts          # Cliente webhooks WF01/WF02/WF03
  db/
    index.ts      # DB_DRIVER switcher (prisma | supabase)
    prisma/       # Implementación Prisma
    supabase/     # client.ts + admin.ts
  types.ts        # Tipos del dominio
  sheets.ts       # Lectura Google Sheets (BD Matec)
prisma/
  schema.prisma   # Modelos: Empresa, Ejecucion, Senal, Contacto
tests/
  unit/           # Tests unitarios Vitest
  integration/    # Tests de integración Vitest
  e2e/            # Tests E2E Playwright (excluidos de Vitest)
```

## Arquitectura API -> N8N

```
POST /api/trigger         -> WF01 Calificador  (webhook/calificador)
POST /api/radar           -> WF02 Radar        (webhook/radar-scan)  [directo, sin WF01]
GET  /api/results         -> DB via DB_DRIVER (señales guardadas)
POST /api/prospect        -> WF03 Prospector   (webhook/prospector)
GET  /api/prospect/logs   -> DB via DB_DRIVER (log de prospecciones)
GET  /api/prospect/logs/[id] -> detalle de una ejecución
GET  /api/contacts        -> DB via DB_DRIVER (contactos Apollo)
GET  /api/executions      -> N8N API (/api/v1/executions)
```

Todas las llamadas a base de datos pasan por `lib/db/index.ts`, que despacha a Prisma o Supabase según `DB_DRIVER`.

Ver [docs/arquitectura.md](../docs/arquitectura.md) para el flujo completo.