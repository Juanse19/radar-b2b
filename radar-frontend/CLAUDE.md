@AGENTS.md

# Frontend — Matec Radar B2B

## Stack

Next.js 14 (App Router) · TypeScript · Tailwind CSS · Shadcn/ui · TanStack Query · Supabase · Playwright (e2e) · Vitest (unit/integration)

---

## Propósito

Panel de control para el equipo comercial de Matec. Permite:
- Disparar los 3 agentes n8n manualmente por línea de negocio
- Ver señales de inversión detectadas por WF02 (Radar) y su score radar v2
- Ver contactos encontrados por WF03 (Prospector) y su tier
- Ver resultados de calificación de WF01 (Calificador)
- Programar escaneos automáticos

**NO es el backend de los agentes** — el backend son los workflows de n8n. El frontend solo los dispara y visualiza.

---

## Variables de entorno requeridas (.env.local)

```bash
# ── N8N ───────────────────────────────────────────────────
N8N_HOST=https://n8n.event2flow.com
N8N_API_KEY=<n8n-api-key>

# V2: WF01 (Calificador) was removed from n8n — qualification runs in-process
# via /api/comercial/calificar (SSE) + Supabase. No env vars needed for it.

# WF02 — Radar de Inversión
N8N_RADAR_WORKFLOW_ID=fko0zXYYl5X4PtHz
N8N_RADAR_WEBHOOK_PATH=radar-scan

# WF03 — Prospector
N8N_PROSPECT_WORKFLOW_ID=RLUDpi3O5Rb6WEYJ
N8N_PROSPECT_WEBHOOK_PATH=prospector

# ── Supabase ── (self-hosted)
SUPABASE_URL=<supabase-url>
SUPABASE_SERVICE_ROLE_KEY=<service-role-key>
SUPABASE_DB_SCHEMA=matec_radar

NEXT_PUBLIC_SUPABASE_URL=<supabase-url>
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon-key>

# ── Google Sheets (lectura) ───────────────────────────────
BASE_DE_DATOS_SHEET_ID=13C6RJPORu6CPqr1iL0zXU-gUi3eTV-eYo8i-IV9K818
LOG_SHEET_ID=1rtFoTi3ZwNHi9RBidFGcxOHtK6lOvCuhebUB1eS-MGo
```

**Para configurar Supabase:**
1. Ejecutar `supabase/migrations/20260408_001_public_schema.sql` en el SQL Editor de Supabase
2. Copiar `service_role` y `anon` keys desde Settings → API
3. Llenar las variables `SUPABASE_SERVICE_ROLE_KEY` y `NEXT_PUBLIC_SUPABASE_ANON_KEY`
4. Correr: `npx tsx scripts/verify_supabase.ts`

---

## Arquitectura del código

```
app/
├── page.tsx               ← Dashboard (KPIs, señales ORO, charts)
├── scan/page.tsx          ← Disparar WF01 manual (6 líneas, batch)
├── results/page.tsx       ← Señales de inversión (tabla filtrable)
├── empresas/              ← Gestión de base de datos de empresas
├── contactos/page.tsx     ← Contactos de Apollo (WF03)
├── calificacion/page.tsx  ← [PENDIENTE] Resultados WF01 con scores
├── schedule/page.tsx      ← Programar escaneos automáticos
└── api/
    ├── trigger/route.ts   ← POST → WF01 Calificador
    ├── radar/route.ts     ← POST → WF02 Radar (manual)
    ├── prospect/route.ts  ← POST → WF03 Prospector (manual)
    ├── signals/route.ts   ← GET/POST señales de WF02
    ├── companies/route.ts ← CRUD empresas
    └── contacts/route.ts  ← CRUD contactos

lib/
├── db/
│   ├── index.ts           ← Facade: llama directamente a Supabase
│   ├── supabase/          ← Implementación con Supabase (PostgreSQL)
│   └── types.ts           ← Tipos compartidos EmpresaRow, SenalRow, etc.
├── n8n.ts                 ← Helpers para llamar los webhooks de n8n
└── types.ts               ← Tipos globales (LineaNegocio, ResultadoRadar, etc.)
```

---

## Bugs históricos (v1.0)

| Bug | Estado |
|-----|--------|
| F1 (LINEA_OPTIONS incompleta en scan) | Obsoleto — `app/scan/*` migra a `/calificador/wizard` |
| F2 (lib/n8n.ts campo `nombre` vs `empresa`) | Obsoleto — `triggerScan` removido junto con WF01 |
| F3 (`/api/prospect` no envía tier/paises[]) | Resuelto |
| F4 (`LineaNegocio` incompleto) | Resuelto |

---

## Tipo LineaNegocio (6 valores correctos)

```typescript
export type LineaNegocio =
  | 'BHS'
  | 'Cartón'
  | 'Intralogística'
  //  | 'Cargo'
  //| 'Motos'
  //| 'Final de Línea'
  //| 'Solumat'
  | 'ALL';
```

---

## Formato de payload correcto para cada webhook

### GET /api/comercial/calificar → Calificador V2 (SSE)
Reemplaza WF01. Stream SSE con eventos `empresa_started`, `dim_scored`, `tier_assigned`, `empresa_done`, `session_done`. Ejemplo de query:
```
?sessionId=<uuid>&linea=Final%20de%20Línea&provider=claude&ragEnabled=true
 &empresas=[{"name":"Grupo Bimbo","country":"Mexico","domain":"grupobimbo.com"}]
```
Persistencia en `matec_radar.calificaciones` con `is_v2=true` + `dimensiones jsonb`.

### POST /api/radar → WF02 Radar (disparo manual)
```json
{
  "empresa": "Grupo Bimbo",
  "pais": "Mexico",
  "linea_negocio": "Final de Línea",
  "tier": "ORO",
  "company_domain": "grupobimbo.com",
  "score_calificacion": 9
}
```

### POST /api/prospect → WF03 Prospector (disparo manual)
```json
{
  "linea": "Final de Línea",
  "batchSize": 5,
  "contactosPorEmpresa": 5,
  "empresas": [
    {
      "empresa": "Grupo Bimbo",
      "company_domain": "grupobimbo.com",
      "pais": "Mexico",
      "linea_negocio": "Final de Línea",
      "tier": "ORO",
      "paises": ["Mexico", "Colombia"]
    }
  ]
}
```

---

## Comandos de desarrollo

```bash
# Instalar dependencias
npm install

# Dev server
npm run dev

# Verificar Supabase
npx tsx scripts/verify_supabase.ts

# Importar empresas desde Excel
node scripts/import_empresas.js

# Tests unitarios e integración
npm run test

# Tests e2e (Playwright)
npx playwright test

# Tests e2e con UI visual
npx playwright test --ui

# Build (verifica TypeScript sin errores)
npm run build

# Lint
npm run lint
```

---

## Reglas de desarrollo

1. Leer el archivo del módulo antes de editar — no asumir lo que hay
2. No hardcodear URLs de n8n — usar las variables de entorno
3. No acceder a Supabase directamente en componentes — siempre a través de `lib/db/index.ts`
4. No exponer `SUPABASE_SERVICE_ROLE_KEY` al cliente — solo a routes server-side
5. Todo nuevo componente UI: usar Shadcn/ui existente antes de crear uno nuevo
6. Antes de cualquier PR: `npm run lint && npm run test && npm run build`

---

## Skills disponibles para Claude Code

El proyecto tiene skills instalados en `.claude/skills/`:

| Skill | Usar cuando |
|-------|-------------|
| `code-reviewer` | Revisar código antes de PR |
| `senior-backend` | Diseñar API routes o queries |
| `senior-frontend` | Crear/optimizar componentes React |
| `senior-qa` | Escribir tests (Vitest + Playwright) |
| `senior-devops` | CI/CD, deployment |
| `senior-security` | Auditoría de seguridad |

**Para activar una skill:** leer `SKILL.md` del directorio correspondiente antes de trabajar en esa área.

| Skill | Usar cuando |
|-------|-------------|
| `uiuxpro` | Cualquier cambio visual — layout, color, tipografía, animación |
| `verification-before-completion` | Antes de declarar cualquier tarea terminada |
| `systematic-debugging` | Antes de proponer un fix a un bug |
| `dispatching-parallel-agents` | Cuando hay ≥2 tareas independientes |

---

## Reglas de eficiencia (token-efficient)

- Pensar antes de actuar. Leer archivos existentes antes de escribir código.
- Output conciso; razonamiento detallado internamente.
- Preferir ediciones dirigidas sobre reescribir archivos completos.
- No releer archivos ya leídos a menos que hayan cambiado.
- Omitir archivos > 100 KB salvo necesidad explícita.
- Sin openers/closers aduladores. Sin relleno.
- Soluciones simples y directas. No sobre-ingenierizar.
- Probar el código antes de declarar terminado.
- Las instrucciones del usuario siempre anulan este archivo.
