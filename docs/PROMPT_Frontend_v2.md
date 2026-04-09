# PROMPT — Implementar Frontend v2.0 (Next.js + Supabase)

## Contexto del proyecto

Estás trabajando en **Matec Radar B2B** — frontend Next.js 14 (App Router) que sirve como panel de control para el equipo comercial. El frontend dispara 3 agentes n8n y visualiza sus resultados. Lee primero `CLAUDE.md` y `docs/arquitectura.md`.

**Stack:** Next.js 14 · TypeScript · Tailwind · Shadcn/ui · TanStack Query · Supabase · Prisma (fallback SQLite)

---

## PARTE 1 — Conexión Supabase (URGENTE)

El problema central es que `DB_DRIVER=prisma` en `.env.local`, lo que significa que el frontend usa SQLite local (solo dev). La migración a Supabase está preparada pero sin ejecutar.

### Paso 1.1 — Confirmar schema a usar

El proyecto tiene dos opciones de schema:
- `supabase/migrations/20260408_000_init_matec_radar.sql` → schema `matec_radar` (recomendado si tenés acceso admin)
- `supabase/migrations/20260408_001_public_schema.sql` → schema `public` (fallback para instancias sin acceso admin)

**Problema identificado:** El Supabase self-hosted en `supabase.valparaiso.cafe` puede tener restricciones para exponer schemas custom. Si es así, usar el script `_001_public_schema.sql`.

**Acción:**
1. Abrir `supabase.valparaiso.cafe` → SQL Editor
2. Ejecutar `20260408_001_public_schema.sql` (schema `public`)
3. Verificar que las 5 tablas existan: `empresas`, `ejecuciones`, `senales`, `contactos`, `prospeccion_logs`

### Paso 1.2 — Completar `.env.local`

El archivo `.env.local` necesita estas variables para que Supabase funcione:

```bash
# ── Supabase ──────────────────────────────────────────────
SUPABASE_URL=https://supabase.valparaiso.cafe
SUPABASE_SERVICE_ROLE_KEY=<tu-service-role-key>
SUPABASE_DB_SCHEMA=public

NEXT_PUBLIC_SUPABASE_URL=https://supabase.valparaiso.cafe
NEXT_PUBLIC_SUPABASE_ANON_KEY=<tu-anon-key>

# ── Cambiar driver a Supabase ──────────────────────────────
DB_DRIVER=supabase

# ── N8N ───────────────────────────────────────────────────
N8N_HOST=https://n8n.event2flow.com
N8N_API_KEY=<tu-n8n-api-key>

N8N_WORKFLOW_ID=jDtdafuyYt8TXISl
N8N_WEBHOOK_PATH=calificador

N8N_RADAR_WORKFLOW_ID=fko0zXYYl5X4PtHz
N8N_RADAR_WEBHOOK_PATH=radar-scan

N8N_PROSPECT_WORKFLOW_ID=RLUDpi3O5Rb6WEYJ
N8N_PROSPECT_WEBHOOK_PATH=prospector
```

> Para obtener las keys: Supabase Dashboard → Settings → API → service_role y anon keys.

### Paso 1.3 — Verificar conectividad

```bash
npx tsx scripts/verify_supabase.ts
```

Si las 5 tablas responden ✅, continuar. Si hay errores:
- Error "schema not found" → ejecutar el SQL del paso 1.1
- Error "invalid API key" → verificar SUPABASE_SERVICE_ROLE_KEY
- Error "relation does not exist" → la migración no se ejecutó

### Paso 1.4 — Migrar datos de SQLite a Supabase

```bash
npx tsx scripts/migrate_sqlite_to_supabase.ts
```

Esto migra las empresas, señales, y contactos existentes del SQLite local a Supabase.

### Paso 1.5 — Cargar base de datos de empresas

La base de datos de empresas objetivo (829 empresas, 6 líneas) está en los archivos Excel de `docs/PROSPECCIÓN/`. Usar el script de importación:

```bash
node scripts/import_empresas.js
```

Si el script no existe o necesita actualización, crearlo/actualizarlo para leer los 6 Excel de bases de datos y hacer upsert en Supabase usando el campo único `(company_name, linea_negocio)`.

---

## PARTE 2 — Problemas identificados en el código

### Bug 1 — Scan page solo tiene 4 líneas de las 6

`app/scan/page.tsx` → `LINEA_OPTIONS` tiene solo BHS, Cartón, Intralogística, ALL.
**Faltan: Cargo, Motos, Final de Línea, Solumat.**

Agregar las líneas faltantes al array `LINEA_OPTIONS`:

```typescript
{
  value: 'Cargo' as LineaNegocio,
  label: 'Cargo — ULD/Aerocarga',
  shortLabel: 'Cargo',
  desc: 'Logística aérea, ULD, aerocarga',
  Icon: Package2, // importar de lucide-react
  color: 'text-sky-400',
  activeBg: 'bg-sky-950/60',
  activeBorder: 'border-sky-500',
  badge: 'bg-sky-900 text-sky-300',
},
{
  value: 'Motos' as LineaNegocio,
  label: 'Motos — Ensambladoras',
  shortLabel: 'Motos',
  desc: 'Plantas de ensamble de motocicletas',
  Icon: Zap, // importar de lucide-react
  color: 'text-orange-400',
  activeBg: 'bg-orange-950/60',
  activeBorder: 'border-orange-500',
  badge: 'bg-orange-900 text-orange-300',
},
{
  value: 'Final de Línea' as LineaNegocio,
  label: 'Final de Línea — Alimentos/Bebidas',
  shortLabel: 'Final Línea',
  desc: 'Empaques, etiquetado, palletizado',
  Icon: Factory, // importar de lucide-react
  color: 'text-green-400',
  activeBg: 'bg-green-950/60',
  activeBorder: 'border-green-500',
  badge: 'bg-green-900 text-green-300',
},
{
  value: 'Solumat' as LineaNegocio,
  label: 'Solumat — Plásticos/Materiales',
  shortLabel: 'Solumat',
  desc: 'Soluciones en materiales industriales',
  Icon: Layers, // importar de lucide-react
  color: 'text-violet-400',
  activeBg: 'bg-violet-950/60',
  activeBorder: 'border-violet-500',
  badge: 'bg-violet-900 text-violet-300',
},
```

Actualizar también `lib/types.ts` para que `LineaNegocio` incluya los 6 valores:
```typescript
export type LineaNegocio = 'BHS' | 'Cartón' | 'Intralogística' | 'Cargo' | 'Motos' | 'Final de Línea' | 'Solumat' | 'ALL';
```

### Bug 2 — `api/trigger` no envía `empresa` y `pais` en formato que WF01 espera

`api/trigger/route.ts` envía:
```json
{ "empresas": [{ "nombre": "X", "dominio": "x.com", "pais": "Colombia", "linea": "BHS" }] }
```

Pero WF01 (`Code: Parse Companies`) espera:
```json
{ "empresas": [{ "empresa": "X", "company_domain": "x.com", "pais": "Colombia", "linea_negocio": "BHS" }] }
```

**Fix en `lib/n8n.ts`** — en la función `triggerScan`, mapear los campos correctamente:

```typescript
empresasParaN8N = dbEmpresas.map(e => ({
  empresa:        e.company_name,         // ← campo que WF01 espera
  company_domain: e.company_domain ?? '',
  pais:           e.pais ?? 'Colombia',
  linea_negocio:  e.linea_negocio,        // ← campo que WF01 espera
}));
```

### Bug 3 — `api/prospect/route.ts` no envía `tier` ni `score_calificacion` a WF03

WF03 necesita `tier` para saber cuántos contactos buscar. El endpoint actual no lo envía. Actualizar:

```typescript
// En api/prospect/route.ts — obtener empresa con tier de la DB:
const dbRows = await getEmpresasParaEscaneo(linea, batchSize);
empresasParaN8N = dbRows.map(e => ({
  empresa:           e.company_name,
  company_domain:    e.company_domain ?? '',
  pais:              e.pais ?? 'Colombia',
  linea_negocio:     e.linea_negocio,
  tier:              e.tier ?? 'MONITOREO',
}));
```

### Bug 4 — No hay página de Calificación (resultados de WF01)

El flujo WF01 → Calificación → Tier no tiene página en el frontend. El equipo comercial no puede ver qué tier asignó el Calificador a cada empresa. Crear:

**`app/calificacion/page.tsx`** — tabla de empresas con su score_calificacion, tier_calculado y fecha de última calificación. Filtros por línea y tier.

**`app/api/companies/route.ts`** — ya existe, verificar que incluye `tier` y `score_calificacion` en los campos retornados.

---

## PARTE 3 — Nuevas features a implementar

### Feature 1 — Pipeline Status en tiempo real (WF01 → WF02 → WF03)

En la página `/scan`, el componente `PipelineStatus` existe pero necesita mostrar el estado de los 3 agentes encadenados para una ejecución específica.

Implementar polling de `/api/executions/[id]` que muestre:
```
[WF01 Calificador] ✅ Completado — 15 empresas calificadas
    ↓ 12 con score ≥ 5 dispararon WF02
[WF02 Radar] 🔄 En progreso — 8/12 empresas analizadas
    ↓ 3 señales ORO detectadas
[WF03 Prospector] ⏳ Pendiente
```

### Feature 2 — Calificador Manual desde el frontend

En `/scan`, agregar un modo "Calificador manual" donde el usuario puede:
1. Seleccionar línea de negocio
2. Elegir empresas específicas de la base de datos (tabla interactiva)
3. Seleccionar países para multinacionales (array `paises[]`)
4. Lanzar WF01 con esas empresas

**Payload que debe enviar a `/api/trigger`:**
```json
{
  "linea": "Final de Línea",
  "empresas": [
    {
      "empresa": "Grupo Nutresa",
      "company_domain": "grupnutresa.com",
      "pais": "Colombia",
      "linea_negocio": "Final de Línea",
      "paises": ["Colombia", "Mexico"]
    }
  ]
}
```

### Feature 3 — Dashboard de Scores

En el Dashboard `/`, agregar una sección "Empresas mejor calificadas" que muestre:
- Top 10 empresas por `score_calificacion` (de WF01)
- Top 10 por `score_radar` (de WF02)
- Top 10 por `composite_score` (ambos combinados)

Esto requiere que los scores se guarden en la tabla `empresas` o `senales` de Supabase.

### Feature 4 — Módulo de Contactos enriquecido

La página `/contactos` existe pero necesita:
- Filtro por `linea_negocio` (no solo por empresa)
- Filtro por `tier` del contacto (C-LEVEL, DIRECTOR, GERENTE, JEFE)
- Columna de `linkedin_url` con link directo
- Export a CSV con los campos del Excel MASTER
- Indicador de cuáles tienen email verificado vs solo LinkedIn

---

## PARTE 4 — Conexión frontend ↔ n8n (webhook response)

### Recepción de resultados de WF02 en el frontend

Cuando WF02 termina de analizar una empresa, debe notificar al frontend. Actualmente WF02 escribe en Google Sheets pero no llama de vuelta al frontend.

**Agregar en WF02:** un nodo HTTP al final que haga POST a `/api/signals` con el resultado:

```json
{
  "empresa_nombre": "Grupo Bimbo",
  "empresa_pais": "Mexico",
  "linea_negocio": "Final de Línea",
  "tier": "ORO",
  "radar_activo": true,
  "tipo_senal": "CAPEX — Nueva planta",
  "descripcion": "...",
  "fuente": "BNAmericas",
  "fuente_url": "https://...",
  "score_radar": 82,
  "ventana_compra": "6-12 Meses",
  "composite_score": 76
}
```

El endpoint `POST /api/signals` ya existe en `app/api/signals/route.ts` — verificar que acepta y guarda este formato.

### Recepción de contactos de WF03

Cuando WF03 termina de prospectar, debe hacer POST a `/api/contacts/sync` con los contactos encontrados. El endpoint `app/api/contacts/sync/route.ts` ya existe — verificar que mapea correctamente los campos de Apollo a los campos de Supabase.

---

## Verificación completa post-implementación

```bash
# 1. Supabase conectado
npx tsx scripts/verify_supabase.ts

# 2. Build sin errores TypeScript
npm run build

# 3. Tests unitarios
npm run test

# 4. Tests e2e
npx playwright test

# 5. Prueba manual del flujo completo:
# a. Ir a /scan → seleccionar Final de Línea → elegir empresa → lanzar
# b. Verificar que WF01 recibe el webhook con formato correcto
# c. Verificar que la señal aparece en /results después de WF02
# d. Verificar que los contactos aparecen en /contactos después de WF03
```
