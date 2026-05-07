# Plan de Prueba — Calificador V2 (manual + E2E Playwright)

> **Objetivo:** validar end-to-end la V2 calificando una empresa real con
> el proveedor OpenAI (único con API key activa) y verificar que la salida
> respeta el contrato categórico de 9 dimensiones, persiste en Supabase y
> se renderiza correctamente en la UI.

---

## 0. Pre-requisitos

| Item | Cómo verificar |
|------|---------------|
| Dev server en `localhost:3002` | `curl http://localhost:3002` debe responder 200 |
| `OPENAI_API_KEY` configurada | Visible en `.env.local` o en `matec_radar.ai_provider_configs` (provider='openai', is_active=true) |
| Migración 20260506_001 aplicada a Supabase | `SELECT column_name FROM information_schema.columns WHERE table_schema='matec_radar' AND table_name='calificaciones' AND column_name IN ('dimensiones','score_cuenta_estrategica','score_tier')` debe devolver 3 filas |
| Sesión iniciada en el navegador | Visitar `/login`, ingresar como Juan Sebastián (rol DEVELOPER) |

---

## 1. Smoke Test Manual (5–10 min)

### Paso 1 — Acceder al módulo Calificador
- URL: `http://localhost:3002/calificador`
- Visualmente: header "Calificador V2", tabs `Empresa | Señales | Histórico | Chat`.
- Tab activo por defecto: **Empresa**.

### Paso 2 — Step 1: Seleccionar línea + sub-línea + modo
- Línea: **BHS**
- Sub-línea: **Aeropuertos** (o la única que aparezca)
- Modo: **Manual**
- Click "Siguiente"

### Paso 3 — Step 2: Elegir empresa (modo manual)
- Buscar / agregar empresa: `Grupo Bimbo`
- País: `Mexico`
- Dominio (opcional): `grupobimbo.com`
- (En modo Auto este paso usa un slider para count y la lista viene de la BD)

### Paso 4 — Step 3: Provider IA + ejecutar
- Provider IA: **OpenAI** (recomendado por badge — único con API key activa)
- Modelo: `gpt-4o-mini` (default)
- RAG: ON
- Click "Calificar"

### Paso 5 — Live SSE durante el escaneo
Verificar en el panel en vivo:
1. Status pasa de `pending` → `running` (loader spin)
2. Chunks de `thinking` aparecen abajo del nombre
3. Las **9 barras de dimensiones** se llenan progresivamente:
   - `impacto_presupuesto` → "Muy Alto"
   - `multiplanta` → "Presencia internacional"
   - `recurrencia` → "Alto" / "Muy Alto"
   - `referente_mercado` → "Referente internacional"
   - `anio_objetivo` → "2026"
   - `ticket_estimado` → "> 5M USD"
   - `prioridad_comercial` → "Muy Alta"
   - `cuenta_estrategica` → "Sí"
   - `tier` → "A"
4. Contador de progreso muestra `9/9` al final
5. Tier compuesto asignado: **A (ORO)** con icono Star ámbar
6. Score total: ≥ 8.0
7. `tier_assigned` evento dispara automáticamente el modal "¿Lanzar Radar?" para empresas tier A/B/C

### Paso 6 — Verificar persistencia en Supabase
Ejecutar en SQL editor:
```sql
SELECT
  id,
  empresa_id,
  provider,
  score_total,
  tier_calculado,
  score_cuenta_estrategica,
  score_tier,
  jsonb_array_length(dimensiones) AS n_dims,
  is_v2,
  created_at
FROM matec_radar.calificaciones
WHERE is_v2 = TRUE
ORDER BY created_at DESC
LIMIT 3;
```
Esperado:
- 1 fila nueva para Grupo Bimbo
- `provider = 'openai'`
- `is_v2 = true`
- `n_dims = 9`
- `score_total >= 8.0`
- `tier_calculado = 'A'`
- `score_cuenta_estrategica = 10`, `score_tier = 10`

### Paso 7 — Verificar página de detalle
- Click en la card de Grupo Bimbo en el panel live → navega a `/calificador/cuentas/<id>`
- Verificar:
  - Score total grande en ámbar
  - Badge tier "ORO"
  - **9 barras** de dimensiones con badges categóricos
  - Tooltip al hacer hover sobre cada dimensión muestra `justificacion`
  - Sección "Razonamiento" en markdown
  - Sección "Perfil web" con summary + sources

---

## 2. E2E Playwright (automatizado)

### Script: `tests/e2e/calificador-v2-smoke.spec.ts`

Cubre los pasos 1–5 sin invocar al LLM real (mock SSE para no quemar tokens):

```ts
test('Calificador V2 wizard — flujo completo manual con OpenAI', async ({ page }) => {
  await login(page);
  await page.goto('/calificador/wizard');

  // Step 1
  await page.getByRole('button', { name: /BHS/i }).click();
  await page.getByRole('button', { name: /Aeropuertos/i }).click();
  await page.getByRole('button', { name: /Manual/i }).click();
  await page.getByRole('button', { name: /Siguiente/i }).click();

  // Step 2 — agregar empresa
  await page.getByRole('button', { name: /Agregar empresa/i }).click();
  await page.getByLabel(/Nombre/i).fill('Grupo Bimbo');
  await page.getByLabel(/País/i).selectOption('Mexico');
  await page.getByLabel(/Dominio/i).fill('grupobimbo.com');
  await page.getByRole('button', { name: /Confirmar/i }).click();
  await page.getByRole('button', { name: /Siguiente/i }).click();

  // Step 3 — provider
  await page.getByRole('button', { name: /OpenAI/i }).click();
  await page.getByRole('button', { name: /Calificar/i }).click();

  // Live SSE — esperar 9 dimensiones
  await expect(page.locator('text=/9\\/9/')).toBeVisible({ timeout: 90_000 });
  await expect(page.locator('text=/ORO|MONITOREO|ARCHIVO/')).toBeVisible();

  // Verificar que las 9 dimensiones aparecen
  const dimensions = [
    'Impacto presupuesto', 'Multiplanta', 'Recurrencia',
    'Referente mercado', 'Año objetivo', 'Ticket estimado',
    'Prioridad comercial', 'Cuenta estratégica', 'Tier',
  ];
  for (const dim of dimensions) {
    await expect(page.locator(`text=${dim}`)).toBeVisible();
  }
});
```

### Comando para correr
```bash
cd radar-frontend
npx playwright test tests/e2e/calificador-v2-smoke.spec.ts --project=chromium --headed
```

---

## 3. Criterios de aceptación

✅ El wizard navega 3 pasos sin errores
✅ La SSE emite `dim_scored` 9 veces y `tier_assigned` 1 vez
✅ JSON LLM pasa Zod validation (sin retry)
✅ Fila persiste en `matec_radar.calificaciones` con `is_v2=true` y `dimensiones jsonb` poblado
✅ UI renderiza 9 barras + 9 badges categóricos + 9 tooltips justificación
✅ Modal "Lanzar Radar" aparece automáticamente para tier A/B/C
✅ Costo total < $0.05 USD (gpt-4o-mini, 1 empresa)

## 4. Rollback en caso de bug

Si la calificación falla:
1. Capturar el evento SSE `error` o `company_error`
2. Revisar `radar_v2_raw_llm_audit` (tabla de auditoría) para ver el JSON crudo del LLM
3. Si el JSON falla Zod por enum (LLM devolvió valor fuera del set):
   - Anotar el valor inválido y la dimensión
   - Ajustar el system prompt en `prompts.ts` para reforzar la enumeración
4. Si falla por timeout: aumentar `INTER_COMPANY_DELAY_MS` o el `maxDuration` en la route SSE
