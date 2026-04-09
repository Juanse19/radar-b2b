# Matec Radar B2B — Sistema de Inteligencia Comercial IA

Plataforma de 3 agentes N8N + frontend Next.js para la detección automática de oportunidades de inversión industrial en LATAM. Reemplaza suscripciones a BNAmericas ($15,000/año) con una solución propia ($200–400/mes).

---

## ¿Qué es Matec Radar B2B?

Matec Radar B2B califica empresas industriales, detecta señales de inversión en fuentes públicas y prospecta contactos clave — de forma automática y encadenada.

**Empresas objetivo:** Terminales aeroportuarias, plantas de cartón y corrugado, centros de distribución (CEDI) en Colombia y LATAM.

**Líneas de negocio cubiertas:**

| Línea | Segmento |
|-------|---------|
| BHS | Baggage Handling Systems — terminales de pasajeros y carga |
| Cartón y Papel | Corrugadoras, líneas de empaque, plantas cartón ondulado |
| Intralogística | CEDI, WMS, ASRS, conveyor, picking automatizado |
| Cargo LATAM | Carga aérea, ULD, ground handling |
| Final de Línea | Líneas de paletizado y embalaje |
| SOLUMAT | Soluciones de automatización a medida |

---

## Arquitectura del Sistema

```
FRONTEND (Next.js)          BASE DE DATOS MATEC
http://localhost:3000        Google Sheets + SharePoint Excel
        │                              │
        ▼                              ▼
┌─────────────────────────────────────────────┐
│           AGENTE 01 — Calificador           │
│   POST /webhook/calificador                 │
│   Evalúa cada empresa: score 0-10, tier     │
│   Escribe en 6 archivos Excel SharePoint    │
└─────────────┬───────────────────────────────┘
              │ score ≥ 5
              ▼
┌─────────────────────────────────────────────┐
│           AGENTE 02 — Radar                 │
│   POST /webhook/radar-scan                  │
│   Busca señales de inversión (Tavily)       │
│   Guarda en Pinecone + alerta Gmail ORO     │
└─────────────┬───────────────────────────────┘
              │ tier_compuesto ≠ ARCHIVO
              ▼
┌─────────────────────────────────────────────┐
│           AGENTE 03 — Prospector            │
│   POST /webhook/prospector                  │
│   Busca contactos en Apollo.io              │
│   Guarda en Google Sheets Prospection_Log   │
└─────────────────────────────────────────────┘
```

---

## Stack Tecnológico

| Capa | Tecnología |
|------|-----------|
| Frontend | Next.js 16.2 (App Router), React 19, TypeScript |
| Estilos | Tailwind CSS v4 (CSS-first, sin tailwind.config.js), shadcn/ui |
| Backend API | Next.js Route Handlers (`/app/api/`) |
| Base de datos | Prisma ORM + SQLite (dev) / Supabase (matec_radar schema) via `DB_DRIVER` switcher |
| Supabase | Self-hosted `https://supabase.valparaiso.cafe` — schema `matec_radar` |
| Orquestación IA | N8N (n8n.event2flow.com) — 3 workflows |
| Modelo IA | OpenAI gpt-4.1-mini |
| Búsqueda web | Tavily API |
| Prospección | Apollo.io (People Search + Organizations Enrich) |
| Memoria vectorial | Pinecone (índice matec-radar) |
| Almacenamiento | SharePoint Excel (6 archivos) + Google Sheets |
| Alertas | Gmail |
| Testing | Playwright (E2E), Vitest (unitarios) |

---

## Supabase

Base de datos self-hosted en `https://supabase.valparaiso.cafe` bajo el schema `matec_radar`.

**Tablas:** `empresas`, `senales`, `contactos`, `ejecuciones`, `prospecciones`

**Estado (Abril 2026):** scaffolding listo. Para activar:
1. Ejecutar el SQL de migración en Supabase Studio
2. Agregar `matec_radar` a `PGRST_DB_SCHEMAS` en el docker-compose
3. Configurar `DB_DRIVER=supabase` + claves en `.env.local`

El frontend selecciona la implementación de DB en tiempo de ejecución via `lib/db/index.ts` según la variable `DB_DRIVER`.

---

## Inicio Rápido

```bash
cd radar-frontend
npm install
cp ../.env.example .env          # Completar variables reales
# DB_DRIVER=prisma usa SQLite local; DB_DRIVER=supabase usa Supabase matec_radar
npm run dev                       # http://localhost:3000
```

Sin variables de N8N configuradas, la app funciona en modo solo lectura.

---

## Variables de Entorno

Ver [`.env.example`](.env.example). Variables principales:

```bash
# N8N
N8N_HOST=https://n8n.event2flow.com
N8N_API_KEY=...
N8N_WORKFLOW_ID=jDtdafuyYt8TXISl         # WF01 Calificador
N8N_RADAR_WORKFLOW_ID=fko0zXYYl5X4PtHz   # WF02 Radar
N8N_PROSPECT_WORKFLOW_ID=RLUDpi3O5Rb6WEYJ # WF03 Prospector

# Base de datos
DATABASE_URL="file:./prisma/dev.db"
DB_DRIVER=prisma                             # prisma (SQLite dev) | supabase

# Supabase (requerido si DB_DRIVER=supabase)
SUPABASE_URL=https://supabase.valparaiso.cafe
SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...
```

---

## Comandos

Desde `radar-frontend/`:

```bash
npm run dev          # Dev server (http://localhost:3000)
npm run build        # Build de producción
npm run lint         # ESLint
npm run test         # Tests unitarios (Vitest)
npx vitest run       # Vitest una sola vez (101 tests)
npx playwright test  # Tests E2E (tests/e2e/, excluidos de Vitest)
```

Prisma:

```bash
npx prisma db push   # Aplicar schema a la DB
npx prisma studio    # GUI de la base de datos
npx prisma generate  # Regenerar cliente
```

---

## Estructura del Proyecto

```
matec-radar-b2b/
├── radar-frontend/              # Aplicación Next.js
│   ├── app/
│   │   ├── api/                 # REST endpoints
│   │   │   ├── companies/       # GET/POST empresas
│   │   │   ├── trigger/         # POST → WF01 Calificador
│   │   │   ├── results/         # GET resultados
│   │   │   ├── prospect/        # POST → WF03 Prospector
│   │   │   ├── contacts/        # GET contactos Apollo
│   │   │   ├── executions/      # GET historial ejecuciones
│   │   │   ├── signals/         # GET señales detectadas
│   │   │   └── schedule/        # POST programación
│   │   ├── empresas/            # Lista y gestión de empresas
│   │   ├── scan/                # Trigger manual de escaneo
│   │   ├── results/             # Resultados y señales
│   │   ├── contactos/           # Contactos prospectados
│   │   └── schedule/            # Programación de escaneos
│   ├── lib/
│   │   ├── n8n.ts               # Cliente N8N (webhooks + API)
│   │   ├── db/
│   │   │   ├── index.ts         # DB_DRIVER switcher (prisma | supabase)
│   │   │   ├── prisma/          # Implementación Prisma
│   │   │   └── supabase/        # Implementación Supabase (client.ts, admin.ts)
│   │   ├── types.ts             # Tipos TypeScript del dominio
│   │   ├── sheets.ts            # Google Sheets (lectura BD Matec)
│   │   └── utils.ts             # Utilidades
│   ├── prisma/
│   │   └── schema.prisma        # Modelos: Empresa, Ejecucion, Senal, Contacto
│   └── tests/
│       ├── unit/                # Tests unitarios Vitest
│       ├── integration/         # Tests de integración Vitest
│       └── e2e/                 # Tests E2E Playwright (excluidos de Vitest)
│
├── n8n/                         # Agentes N8N — scripts de creación y fixes
│   ├── wf01-calificador/        # Agente 01: Calificador
│   ├── wf02-radar/              # Agente 02: Radar de Inversión
│   ├── wf03-prospector/         # Agente 03: Prospector Apollo
│   └── shared/                  # Documentación y scripts de test
│
├── docs/                        # Documentación del proyecto
│   ├── PRD.md
│   ├── arquitectura.md
│   ├── guia-usuario.md
│   ├── scoring-system.md
│   ├── plan-pruebas.md
│   └── flujo-git.md
│
├── tools/                       # Scripts WAT framework
├── workflows/                   # SOPs markdown WAT
├── .env.example                 # Template de variables
├── .gitignore
└── README.md
```

---

## Módulos del Frontend

### Empresas (`/empresas`)
Tabla de las 1026+ empresas de la base de datos Matec con filtros por línea de negocio, tier y estado. Permite seleccionar empresas para el escaneo.

### Scan (`/scan`)
Trigger manual del Agente 01 (Calificador). Selección de empresas y línea de negocio, con estado de ejecución en tiempo real.

### Resultados (`/results`)
Historial de señales detectadas por el Agente 02. Filtros por tier, línea y fecha. Visualización de score radar, tipo de señal y descripción.

### Contactos (`/contactos`)
Contactos prospectados por el Agente 03 via Apollo.io: nombre, título, empresa, score y estado.

---

## Sistema de Scoring

### Score Calificación — Agente 01 (0–10)

| Factor | Peso |
|--------|------|
| Impacto en el presupuesto | 25% |
| Año objetivo | 15% |
| Recurrencia | 15% |
| Multiplanta | 15% |
| Ticket estimado | 10% |
| Referente del mercado | 10% |
| Prioridad comercial | 10% |

**Tiers:** ORO ≥ 8 · MONITOREO 5–7 · ARCHIVO < 5

### Score Radar — Agente 02 (0–100)
Sistema PROM: fuente oficial (+25), CAPEX (+20), horizonte 12m (+20), monto declarado (+20), múltiples fuentes (+15).

### Score Compuesto (decisión final)
```
composite = (score_cal / 10 × 40) + (score_radar / 100 × 60)
```
- composite ≥ 70 → **ORO** → 5 contactos Apollo
- composite 40–69 → **MONITOREO** → 3 contactos Apollo
- composite < 40 → **ARCHIVO** → sin prospección

---

## Automatización N8N

Tres workflows en producción:

| Workflow | ID | Webhook | Trigger |
|----------|----|---------|---------|
| WF01 Calificador | `jDtdafuyYt8TXISl` | `/webhook/calificador` | Manual / Frontend |
| WF02 Radar | `fko0zXYYl5X4PtHz` | `/webhook/radar-scan` | WF01 (score ≥ 5) |
| WF03 Prospector | `RLUDpi3O5Rb6WEYJ` | `/webhook/prospector` | WF02 (tier_compuesto ≠ ARCHIVO) |

Los scripts en `n8n/` permiten recrear o modificar los workflows via API N8N. Los JSON exportados (con credenciales) **no se versionan**.

---

## Flujo Git

```
main          ← producción estable
develop       ← integración
feature/*     ← nuevas funcionalidades (desde develop)
fix/*         ← correcciones (desde develop)
hotfix/*      ← urgentes (desde main → merge a main + develop)
```

Ver [docs/flujo-git.md](docs/flujo-git.md) para convenciones de commits y PRs.

---

## Documentación

- [PRD del producto](docs/PRD.md)
- [Arquitectura del sistema](docs/arquitectura.md)
- [Sistema de scoring](docs/scoring-system.md)
- [Plan de pruebas](docs/plan-pruebas.md)
- [Guía de usuario](docs/guia-usuario.md)
- [Flujo Git](docs/flujo-git.md)
- [Documentación de workflows N8N](n8n/shared/WORKFLOW_DOCUMENTATION.md)

---

## Equipo

| Rol | Persona |
|-----|---------|
| Lead del proyecto | Juan Camilo Vélez |
| Developer | Juan Sebastián Losada |
| Supervisión / Criterios | Felipe Gaviria |
| Prospección comercial | Paola Vaquero |
| Equipo comercial | Mariana · Natalia |
