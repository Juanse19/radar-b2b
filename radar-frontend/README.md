# Radar Frontend — Next.js App

Interfaz web del sistema Matec Radar B2B. Permite disparar los 3 agentes N8N,
visualizar señales de inversión y gestionar la base de datos de empresas.

## Inicio Rápido

```bash
npm install
cp ../.env.example .env       # Completar N8N_API_KEY y DATABASE_URL
npx prisma db push             # Crear base de datos SQLite
npm run dev                    # http://localhost:3000
```

## Comandos

```bash
npm run dev          # Dev server con hot reload
npm run build        # Build de producción
npm run lint         # ESLint
npm run test         # Vitest (unitarios)
npm run test:watch   # Tests en modo watch
```

## Variables de Entorno

Ver [`.env.example`](../.env.example) en la raíz. Mínimo necesario:

```env
N8N_HOST=https://n8n.event2flow.com
N8N_API_KEY=...
N8N_WORKFLOW_ID=jDtdafuyYt8TXISl
DATABASE_URL="file:./prisma/dev.db"
```

## Estructura

```
app/
  api/            # REST endpoints -> N8N webhooks + Prisma
  empresas/       # Lista y gestion de empresas
  scan/           # Trigger manual de escaneo
  results/        # Señales detectadas
  contactos/      # Contactos Apollo.io
  schedule/       # Programacion de escaneos
lib/
  n8n.ts          # Cliente webhooks WF01/WF02/WF03
  db.ts           # Cliente Prisma
  types.ts        # Tipos del dominio
  sheets.ts       # Lectura Google Sheets (BD Matec)
prisma/
  schema.prisma   # Modelos: Empresa, Ejecucion, Senal, Contacto
```

## Arquitectura API -> N8N

```
POST /api/trigger    -> WF01 Calificador  (webhook/calificador)
GET  /api/results    -> Prisma DB (señales guardadas)
POST /api/prospect   -> WF03 Prospector   (webhook/prospector)
GET  /api/contacts   -> Prisma DB (contactos Apollo)
GET  /api/executions -> N8N API (/api/v1/executions)
```

Ver [docs/arquitectura.md](../docs/arquitectura.md) para el flujo completo.