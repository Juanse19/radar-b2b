# Changelog — Radar v2

## v4 — Ultra-review & Fix Sprint (2026-04-17)

### Fixes
- **FIX1** `/metricas` — query SQL agrega desde `radar_v2_results` (source of truth) en lugar de columnas `activas_count`/`descartadas_count` que pueden ser NULL en scans viejos. Empty state con CTA y error state con reintentar.
- **FIX2** `/resultados` — ResultadosTable sin dependencia legacy de `/resultados-v2`. Copiado completo + 2 columnas nuevas: **Criterios** (badge X/6) y **Descripción** (tooltip).
- **FIX4** `Step1Target` contraste alto: `bg-primary/20` + `shadow` + `ring-2`. Accesible con `aria-pressed` y keyboard (Enter/Space).
- **FIX5** Step2 consume fuentes y keywords desde `/api/admin/fuentes` y `/api/admin/keywords` (con fallback graceful). Links "Editar en admin →".
- **FIX6** Auto-advance del paso 1 al paso 2 (400ms) cuando línea + modo están seteados. Ref evita re-trigger.
- **FIX7** Step3 `handleFire()` ahora hace `router.push('/radar-v2/vivo?sessionId=X&line=Y')` para ver el streaming live.

### New
- **NEW-B** `/admin/tokens` — dashboard con KPIs, serie diaria de costo y tabla de últimos 50 scans. Endpoint `/api/admin/tokens?days=7|30|90`.
- Docs — `README.md`, `USER_GUIDE.md`, `CHANGELOG.md` bajo `docs/radar-v2/`.

### Deferred a v5
- **NEW-A** `/admin/api-keys` CRUD (tabla `ai_provider_configs` + encryption) — por scope.
- **FIX3** Informes DataTable — card grid actual funciona, UI polish queda para v5.
- Multi-línea selection en Step1 — mantener single-line por simplicidad.
- Batch API + Haiku pre-filter.

## v3 — Sidebar anidado + Wizard + Streaming (2026-04-16)

- `ce54f4d` — Grupo 1: sidebar anidado (`NavGroup`/`NavItem`), provider pattern multi-modelo, skills `ui-ux-design` + `git-flow`.
- `3570e94` — Grupo 2: rutas unificadas bajo `/radar-v2/{submodulo}`, APIs `estimate`/`auto-select`/`export` Excel.
- `bdd91a7` — Fase C: landing con 4 presets + CTAs Auto/Manual.
- `89d18b5` — Fase G: streaming SSE tipo Perplexity con eventos (thinking, search_query, reading_source, criteria_eval).
- `a7d087a` — Fix sidebar: restaurados items originales (Resultados Agente, Calificación, Contactos, etc.).
- `8553fe0` — Fase D: Wizard 3 pasos URL-driven con presets, deep-link y preview de costos.

## v2 — Producción (verificación + informe + métricas) (2026-04-16)

- `6be9641` — `verifier.ts` (SSRF-safe HEAD + validación fecha/monto), `metrics.ts`, `report.ts` (Markdown descargable), prompt hardening con 6 reglas + few-shot examples. Dialog `InformeEjecucion`, `FuenteBadge`, `/radar-v2/metricas`.

## v1 — Integración base

- Tablas `radar_v2_sessions` + `radar_v2_results` en schema `matec_radar`.
- Rutas `/radar-v2` y `/resultados-v2` + Navigation.
- Scanner directo a Claude Sonnet 4.6 + `web_search_20250305` con multi-turn loop.

## RAG (tarea spawneada separada)

- `68bf0ea` — Capa Pinecone + Voyage AI embeddings, corpus semilla, integración en scanner.
