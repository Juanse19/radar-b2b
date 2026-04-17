# Informe de entrega — Radar v2 (Agente 1 RADAR)

> Actualizar este documento tras ejecutar la prueba canónica DHL / FedEx / UPS.

## Qué se agregó

### Backend
- `supabase/migrations/20260416_100_radar_v2_tables.sql` — tablas `radar_v2_sessions` y `radar_v2_results`
- `supabase/migrations/20260416_101_radar_v2_rls.sql` — políticas RLS
- `supabase/functions/radar-scan-v2/` — Edge Function Deno que llama Claude Sonnet 4.6 con `web_search_20250305`
- `lib/radar-v2/types.ts` — tipos TypeScript del módulo
- `lib/radar-v2/db.ts` — funciones de base de datos usando pgQuery/pgLit

### API routes
- `app/api/radar-v2/route.ts` — POST: crea sesión y dispara Edge Function por empresa
- `app/api/radar-v2/results/route.ts` — GET: historial con filtros
- `app/api/radar-v2/companies/route.ts` — GET: empresas filtradas por línea

### Frontend
- `app/radar-v2/page.tsx` — página de escaneo manual
- `app/radar-v2/components/CompanySelector.tsx` — selector multi-empresa
- `app/radar-v2/components/ScanProgress.tsx` — progreso por empresa
- `app/radar-v2/components/ResultCard.tsx` — tarjeta expandible de resultado
- `app/resultados-v2/page.tsx` — historial con filtros
- `app/resultados-v2/components/ResultadosTable.tsx` — tabla filtrable

### Navegación
- `components/Navigation.tsx` — 2 items agregados al final del array `navItems` (`Radar v2`, `Resultados v2`)

### Tests
- `tests/unit/radar-v2/response-parser.test.ts` — 7 tests del parser JSON
- `tests/unit/radar-v2/types.test.ts` — 2 tests de tipos
- `tests/integration/radar-v2-api.test.ts` — 4 tests del contrato de API

---

## Qué NO se modificó (confirmación)

- [ ] `app/scan/page.tsx` — sin cambios
- [ ] `app/results/page.tsx` — sin cambios
- [ ] `app/schedule/page.tsx` — sin cambios
- [ ] `app/agente-resultados/page.tsx` — sin cambios
- [ ] `lib/n8n.ts` — sin cambios
- [ ] `app/api/trigger/route.ts` — sin cambios
- [ ] `app/api/radar/route.ts` — sin cambios
- [ ] `app/api/prospect/route.ts` — sin cambios
- [ ] `matec_radar.radar_scans` — sin filas nuevas desde Radar v2
- [ ] `matec_radar.empresas` — sin columnas ni filas modificadas
- [ ] Migraciones existentes `20260408_*` — sin cambios

---

## Resultado prueba canónica DHL / FedEx / UPS

> Completar tras ejecutar el escaneo desde /radar-v2

| Empresa | radar_activo | tipo_senal | ventana_compra | fuente_link válido | cost_usd |
|---------|-------------|-----------|----------------|-------------------|----------|
| DHL Supply Chain | — | — | — | — | — |
| FedEx Express    | — | — | — | — | — |
| UPS              | — | — | — | — | — |

**Costo total 3 empresas:** $____ USD

---

## Pasos de deploy

```bash
# 1. Aplicar migraciones en Supabase producción
# Abrir SQL Editor en supabase.valparaiso.cafe y ejecutar:
#   supabase/migrations/20260416_100_radar_v2_tables.sql
#   supabase/migrations/20260416_101_radar_v2_rls.sql

# 2. Set secret CLAUDE_API_KEY
npx supabase secrets set CLAUDE_API_KEY=sk-ant-... --project-ref <ref>

# 3. Deploy Edge Function
npx supabase functions deploy radar-scan-v2 --project-ref <ref>

# 4. Agregar feature flag al .env.local
echo "NEXT_PUBLIC_RADAR_V2_ENABLED=true" >> .env.local

# 5. Verificar build
cd radar-frontend
npm run lint && npm run test && npm run build

# 6. Probar en local
npm run dev
# Ir a http://localhost:3000/radar-v2
```

---

## Lo que falta para fase 2

- Agente 2 SCORING (TIER/TIR) — pendiente
- Integración HubSpot (webhook automático cuando score ≥ 8)
- Alertas Slack/email
- n8n cron diario para escaneos automáticos
- Tests E2E Playwright con `tests/e2e/radar-v2-flow.spec.ts`
- Validación anti-alucinación automatizada (HEAD requests a fuente_link)
