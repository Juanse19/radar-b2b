# Análisis del Sistema — Matec Radar B2B v2

**Fecha:** Abril 2026
**Autor:** Revisión técnica completa de los 3 agentes

---

## Arquitectura real confirmada

```
Frontend Next.js
    │
    └── POST /calificador ────────────────────────────────────┐
                                                              ▼
                                               [WF01 — Calificador]
                                               Tavily: perfil empresa
                                               GPT-4.1-mini: 7 dimensiones
                                               Score 0-10 / Tier ORO·MON·ARC
                                               6 Excel SharePoint
                                               GSheets Cal_Log
                                                    │ score ≥ 5
                                                    ▼
                                           [WF02 — Radar de Inversión]
                                           Tavily: señales CAPEX/licitación
                                           AI Agent RADAR1: detección señal
                                           Validador determinístico + IA
                                           Score 0-100
                                           6 Excel SharePoint
                                           Pinecone vectorial
                                           Gmail alerta ORO (score ≥ 80)
                                                    │ tier_compuesto ≠ ARCHIVO
                                                    ▼
                                           [WF03 — Prospector]
                                           Apollo.io: búsqueda contactos
                                           GSheets Prospection_Log
```

**Cadena:** WF01 → WF02 → WF03 está completamente conectada en producción.

---

## Estado por agente

### WF01 — Agent 01 - Calificador v1.0 ✅ (funcional con gaps)

**Lo que funciona:**
- Loop por empresa correcto (splitInBatches v3)
- Tavily profile search con query inteligente (empresa + país + keywords presencia)
- AI segmentación cualitativa con system message completo (7 dimensiones)
- Scoring ponderado (fórmula 7 factores, suma a 100%)
- Tier assignment: ORO ≥8, MONITOREO 5–7, ARCHIVO <5
- Switch a 6 Excels de SharePoint + GSheets log
- IF Score ≥ 5 → trigger WF02 ✅

**Gaps identificados (v1.0):**
| # | Problema | Impacto |
|---|---------|---------|
| 1 | API key Tavily hardcodeada | Seguridad — se expone al exportar/versionar |
| 2 | Sin respuesta inmediata al webhook | Frontend no recibe feedback de inicio |
| 3 | Sin manejo de error Tavily (429/5xx) | Loop se rompe silenciosamente |
| 4 | HTTP trigger WF02 timeout 5s | Falsos fallos bajo carga |
| 5 | No envía `paises[]` para multinacionales | WF03 no puede buscar por país separado |
| 6 | Verificar Solumat en Switch | Puede estar sin mapeo |

---

### WF02 — Agent 02 - Radar de Inversión v1.0 ✅ (funcional con bugs)

**Lo que funciona:**
- Webhook `/radar-scan` recibe de WF01 correctamente (`Code: Parse WF01 Input`)
- Dual Tavily search: fuentes primarias (gov, bolsas) + general
- `Filtro Menciones Empresa` previene falsos positivos (empresa debe aparecer en resultados)
- AI Agent RADAR1 con system message completo (reglas temporales, 12 campos de salida)
- Validador de Fuentes determinístico (PREMIUM_DOMAINS, convergencia)
- Validador IA para casos borderline
- Pinecone para memoria vectorial de señales
- Switch 6 Excels + GSheets logs
- Gmail alerta para score_radar ≥ 80
- `IF: Tier ORO para WF03` → HTTP trigger WF03 ✅

**Bugs identificados (v1.0):**
| # | Problema | Impacto |
|---|---------|---------|
| 1 | `Construir Query Tavily` vacío (solo pasa JSON) | La búsqueda de señales usa query genérica sin keywords de línea |
| 2 | `SCORE CAL` no está en `Format Final Columns1` | composite_score en WF03 siempre usa score_cal=0 |
| 3 | `IF: Tier ORO para WF03` solo pasa ORO | MONITOREO nunca se prospecta (composite 40-69 ignorado) |
| 4 | API keys Tavily hardcodeadas (2 nodos) | Seguridad |
| 5 | `Fusionar Resultado Validación1` referencia AI Agent RADAR1 que puede no haber corrido | Error silencioso en path sin menciones |
| 6 | composite_score calculado en expression del HTTP body, no en nodo | Opaco, irrepetible, difícil de debuggear |

---

### WF03 — Agent 03 - Prospector ✅ (v2.0 disponible)

**Estado:** `Agent03_Prospector_v2.0.json` disponible en `docs/docs_contactos/`. Este workflow ya tiene todas las mejoras aplicadas.

**Mejoras en v2.0 vs v1.0:**
- Input parser maneja 3 formatos (Frontend, WF02, WF02-uppercase)
- `paises[]` expansion para multinacionales
- 6 líneas de negocio → job titles específicos por línea
- Tier-based contact count (ORO=5, PLATA=4, MONITOREO=3)
- IF Rate Limited + Wait 30s para manejar 429 de Apollo
- Deduplicación por Persona_ID antes de escribir en GSheets
- Columna `Es_Multinacional` en output
- API key Apollo via credencial n8n (no hardcoded)

---

## Plan de implementación recomendado

### Orden correcto (empezar por WF03, ya funcional)

**Día 1 — WF03 v2.0 (Prospector)**
1. Importar `Agent03_Prospector_v2.0.json` en n8n
2. Conectar credenciales (Apollo API Key, Google Sheets account 3)
3. Validar con payload de prueba (ver `PROMPT_Agent03_v2.md`)
4. Confirmar que escribe en GSheets correctamente

**Día 2 — WF02 v2.0 (Radar)**
1. Aplicar 6 cambios del `PROMPT_Agent02_v2.md`
2. Prioridad: Bug 3 (IF MONITOREO) + Bug 2 (SCORE CAL) + Bug 1 (query Tavily)
3. Validar cadena WF02 → WF03 con empresa de prueba

**Día 3 — WF01 v2.0 (Calificador)**
1. Aplicar 6 cambios del `PROMPT_Agent01_v2.md`
2. Prioridad: Bug 5 (paises[]) + Bug 2 (webhook response) + Bug 1 (Tavily credential)
3. Validar cadena completa WF01 → WF02 → WF03

---

## Inconsistencias de datos entre agentes

### TIER naming
- WF01 asigna: `ORO`, `MONITOREO`, `ARCHIVO`
- WF02 recibe: `tier` de WF01 → pasa como `TIER` uppercase a WF03
- WF03 espera: `ORO`, `PLATA`, `MONITOREO` (el tier PLATA no existe en WF01/WF02)
- **Fix:** Con la introducción del `tier_compuesto` en WF02 v2.0, el tier que llega a WF03 siempre será ORO/MONITOREO/ARCHIVO, y WF03 maneja correctamente los 3.

### composite_score
- Fórmula: `(score_cal/10)*40 + (score_radar/100)*60`
- WF01 score_cal: 0–10
- WF02 score_radar: 0–100 (score_relevancia del AI)
- WF02 v2.0 debe calcular esto ANTES del IF para tomar decisión de prospección

### paises[] para multinacionales
- WF01 detecta multinacionales vía `MULTIPLANTA = "Presencia internacional"`
- WF01 v2.0 debe enviar `paises[]` en payload a WF02
- WF02 debe pasar `paises[]` a WF03
- WF03 v2.0 ya maneja la expansión multi-país

---

## Archivos generados

| Archivo | Descripción |
|---------|-------------|
| `docs/PROMPT_Agent01_v2.md` | Instrucciones para Claude Code — mejoras WF01 |
| `docs/PROMPT_Agent02_v2.md` | Instrucciones para Claude Code — mejoras WF02 |
| `docs/PROMPT_Agent03_v2.md` | (ya existe) Instrucciones para Claude Code — mejoras WF03 |
| `docs/ANALISIS_Sistema_v2.md` | Este archivo — análisis consolidado |
| `docs/docs_contactos/Agent03_Prospector_v2.0.json` | WF03 v2.0 listo para importar |

---

## Pasos siguientes — Frontend

Después de validar los 3 agentes en producción, revisar el frontend Next.js (`radar-frontend/`) para verificar:

1. **Endpoint de calificación**: ¿El frontend envía `paises_extra[]` para multinacionales?
2. **Respuesta del webhook**: ¿Consume el `{ status: "processing" }` que WF01 v2.0 devuelve?
3. **Visualización de señales ORO/MONITOREO**: ¿El dashboard refleja el `tier_compuesto` de WF02?
4. **Estado de prospección**: ¿Muestra cuántos contactos se encontraron en Apollo?
5. **Filtros por línea de negocio**: ¿Los 6 Excel de SharePoint están correctamente linkeados?
