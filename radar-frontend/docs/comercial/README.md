# Radar v2 — Overview

Segundo motor de detección de señales de inversión B2B en LATAM. Usa **Claude Sonnet 4.6** con `web_search_20250305` en lugar de GPT-4.1-mini + Tavily (Radar v1).

## Rutas

| Ruta | Función |
|---|---|
| `/comercial` | Landing con presets + CTAs Automático/Manual |
| `/escanear` | Wizard 3 pasos (línea → configurar → revisar y ejecutar) |
| `/vivo` | Timeline live SSE de un scan en curso |
| `/resultados` | Tabla de todos los resultados históricos con filtros |
| `/metricas` | Dashboard de KPIs (día / semana / mes) |
| `/informes` | Informes por sesión con descarga Excel |
| `/cronograma` | Placeholder — programación automática (v5+) |
| `/admin/tokens` | Dashboard admin de consumo de tokens |
| `/admin/fuentes` | CRUD de fuentes institucionales (consumido por Wizard Step 2) |
| `/admin/keywords` | CRUD de palabras clave por línea |

## Arquitectura

```
/comercial/escanear  →  POST /api/comercial  →  scanner.scanCompany()
                                                ↓
                                          getProvider(name)
                                                ↓
                                          Claude Sonnet 4.6 + web_search
                                                ↓
                                          parseAgente1Response()
                                                ↓
                                          INSERT radar_v2_results
                                                ↓
                                          INSERT radar_v2_reports (Markdown)
                                                ↓
                              ┌─────────────────┼─────────────────┐
                              ↓                 ↓                 ↓
                      /comercial/vivo   /comercial/resultados  /comercial/metricas
                      (SSE timeline)   (tabla filtrable)     (KPIs)
                                              ↓
                                       POST /api/comercial/export
                                              ↓
                                       .xlsx 4 hojas
```

## Provider pattern multi-modelo

`lib/comercial/providers/` contiene:
- `claude.ts` — implementación real
- `openai.stub.ts`, `gemini.stub.ts` — estimación de costo + scan lanza `NotImplementedError`
- `index.ts` — `getProvider(name?)` con default `RADAR_V2_DEFAULT_PROVIDER` env var

Cambiar el modelo por defecto: `RADAR_V2_DEFAULT_PROVIDER=claude` en `.env.local`.

## Tablas SQL nuevas (v2-v4)

| Migración | Tabla(s) | Propósito |
|---|---|---|
| `20260416_100` | `radar_v2_sessions`, `radar_v2_results` | Base v1 |
| `20260416_101` | (RLS) | Policies de lectura |
| `20260416_102` | `radar_v2_reports`, `radar_v2_rag_ingest_log` + flags verificación | Producción v2 |
| `20260416_200` | `radar_v2_budgets`, `radar_v2_token_events` | Token tracking granular |

## Documentos

- `USER_GUIDE.md` — guía para el equipo comercial (Paola, Mariana, Natalia)
- `CHANGELOG.md` — versiones v1 → v4

## Comandos útiles

```bash
npm run dev              # dev server en puerto 3001
npm run build            # build de producción
npm run lint             # ESLint
npx playwright test      # E2E tests (ver tests/e2e/)
```
