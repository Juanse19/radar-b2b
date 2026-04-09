# Plan de Pruebas — Matec Radar B2B

## Nivel 0: Tests Automatizados — Frontend (Vitest + Playwright)

### Vitest — Tests unitarios e integración

```bash
cd radar-frontend
npx vitest run     # Corre los 101 tests (unit + integration)
```

Ubicación: `tests/unit/` y `tests/integration/`. Los tests de `tests/e2e/` están excluidos del runner Vitest via `vitest.config.ts` y se corren por separado con Playwright.

### Playwright — Tests E2E

```bash
cd radar-frontend
npx playwright test   # tests/e2e/
```

---

## Nivel 1: Pruebas por Nodo (Unitarias N8N)

Verificar el output de nodos específicos vía API N8N después de una ejecución.

**Herramienta:** API N8N `GET /api/v1/executions/{id}?includeData=true`

**Cómo ejecutar:**
```bash
node n8n/shared/test_batch_real.js --linea BHS
```

**Checklist por nodo:**

| Nodo | Campo a verificar | Valor esperado |
|------|------------------|---------------|
| Code: Parse Companies (WF01) | `empresa` | nombre de empresa, no undefined |
| Code: Calcular Score + Tier | `score_calificacion` | 0–10, `tier_calculado` ORO/MONITOREO/ARCHIVO |
| Merge Cal. Results | `score_calificacion` | mismo que Score+Tier (no perdido) |
| IF: Score >= 5 | branch ejecutado | true para score ≥ 5 |
| Code: Parse WF01 Input (WF02) | `empresa` | no undefined, `tier` correcto |
| Format Final Columns1 (WF02) | `COMPANY NAME` | empresa correcta |
| Code: Parse Input (WF03) | `linea_negocio` | "Carton y Papel" (no vacío) |
| HTTP: Apollo People Search | `total_entries` | > 0 para empresas conocidas |
| Log Prospeccion GSheets | `NOMBRE_CONTACTO` | nombre obfuscado Apollo |

---

## Nivel 2: Pruebas por Agente (Integración)

### WF01 — Casos de prueba

| Empresa | Línea | Score esperado | Tier esperado | WF02 disparado? |
|---------|-------|---------------|--------------|----------------|
| Smurfit Kappa | Cartón y Papel | ≥ 8 | ORO | Sí |
| OPAIN | BHS | 5–7 | MONITOREO | Sí |
| Empresa genérica pequeña | BHS | < 5 | ARCHIVO | No |
| Carton de Colombia | Cartón | ≥ 8 | ORO | Sí |

**Comando:**
```bash
curl -X POST https://n8n.event2flow.com/webhook/calificador \
  -H "Content-Type: application/json" \
  -d '{"empresas":[{"empresa":"OPAIN","pais":"Colombia","linea_negocio":"BHS","company_domain":"opain.com.co"}],"trigger_type":"manual"}'
```

### WF02 — Casos de prueba

| Empresa | Resultado esperado |
|---------|-------------------|
| Empresa con señal activa | score_radar > 0, Excel SharePoint escrito |
| Empresa sin señal (ARCHIVO) | score_radar bajo, tier_compuesto < 40, NO dispara WF03 |
| Empresa ORO | tier_compuesto ≥ 70, WF03 disparado |
| Empresa MONITOREO | tier_compuesto 40–69, WF03 disparado (fix Bug B aplicado) |

### WF03 — Casos de prueba

| Input | Contactos esperados | GSheets escrito? |
|-------|--------------------|-----------------:|
| Empresa ORO (max_contacts=5) | 5 | Sí |
| Empresa MONITOREO (max_contacts=3) | 3 | Sí |
| Empresa ARCHIVO (max_contacts=0) | 0 | No |

---

## Nivel 3: Cadena Completa E2E

**Objetivo:** Verificar que WF01 → WF02 → WF03 funciona de punta a punta.

**Empresa de prueba:** Smurfit Kappa (históricamente score=9, ORO, Cartón)

**Pasos:**
1. Trigger desde frontend (`/scan`) con Smurfit Kappa, línea Cartón y Papel
2. Verificar WF01 completa (< 30s): score=9, tier=ORO, Excel Carton escrito
3. Verificar WF02 se dispara automáticamente (< 60s desde WF01)
4. Verificar WF03 se dispara (tier_compuesto ≠ ARCHIVO): 5 contactos en Prospection_Log para ORO
5. Verificar que los resultados aparecen en frontend `/results`

**Verificación API:**
```bash
# Ver últimas ejecuciones de cada workflow
curl "https://n8n.event2flow.com/api/v1/executions?workflowId=jDtdafuyYt8TXISl&limit=1" \
  -H "X-N8N-API-KEY: $N8N_API_KEY"
```

---

## Pruebas de Líneas de Negocio Pendientes

Switch routing WF01 — líneas no confirmadas aún:

| Línea | Excel destino | Estado |
|-------|--------------|--------|
| BHS | BASE DE DATOS AEROPUERTOS FINAL | ✅ Confirmado |
| Cartón y Papel | BASE DE DATOS CARTON Y PAPEL | ✅ Confirmado |
| Intralogística | BASE DE DATOS AEROPUERTOS FINAL | ⚠️ Pendiente |
| Cargo LATAM | BASE DE DATOS CARGO LATAM | ⚠️ Pendiente |
| Motos | BASE DE DATOS ENSAMBLADORAS MOTOS | ⚠️ Pendiente |
| Final de Línea | BASE DE DATOS FINAL DE LINEA | ⚠️ Pendiente |

---

## Pruebas de Frontend (Playwright E2E)

Config: `radar-frontend/playwright.config.ts` — port 3004

```bash
cd radar-frontend
npx playwright test   # tests/e2e/ (excluidos de Vitest via vitest.config.ts)
npm run test:e2e      # Alias si está configurado en package.json
```

**Pantallas a cubrir:**
- [ ] `/` — Home carga sin error
- [ ] `/empresas` — Lista de empresas, filtros por línea funcionan
- [ ] `/scan` — Trigger manual, respuesta 200 en < 12s
- [ ] `/results` — Resultados aparecen después del scan
- [ ] `/contactos` — Contactos Apollo visibles

---

## Errores Conocidos y Mitigaciones

| Error | Causa | Fix aplicado |
|-------|-------|-------------|
| `empresa: undefined` en WF01 | N8N v2 wraps body | `raw.body || raw` |
| Loop no ejecuta cuerpo (WF01) | splitInBatches v3 main[0]=done | Conectar a main[1] |
| `linea_negocio` vacío en WF03 | WF02 usa campos uppercase | Parse Input acepta ambos formatos |
| GSheets "Could not get parameter" | autoMap necesita schema | schema explícito en columns |
| Excel "Cannot read execute" | resource: 'table' incorrecto | resource: 'worksheet', typeVersion: 2.2 |
