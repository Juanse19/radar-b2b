# Matec Radar B2B — Instrucciones para Claude Code

## Qué es este proyecto

Sistema de inteligencia comercial B2B para **Matec S.A.S.** (Colombia). Automatiza la detección de señales de inversión y la prospección de contactos clave en 6 líneas de negocio industriales para LATAM.

**El problema que resuelve:** Matec dependía de BNAmericas ($15.000/año) para detectar proyectos en aeropuertos. Este sistema reemplaza eso con 3 agentes IA encadenados que cubren las 6 líneas a < $400/mes.

**Usuarios finales:** Paola Vaquero (prospección), Mariana/Natalia (equipo comercial), Felipe Gaviria (supervisión).

---

## Arquitectura — 3 Agentes N8N + Frontend

```
Frontend Next.js (radar-frontend/)
    │
    └── POST /webhook/calificador
                │
    ┌───────────▼───────────────────────────────────────────────┐
    │  WF01 — Agent 01 - Calificador v1.0                       │
    │  Webhook: /calificador  │  ID: jDtdafuyYt8TXISl           │
    │  • Tavily: perfil empresa (empleados, sedes, presencia)    │
    │  • GPT-4.1-mini: evalúa 7 dimensiones → score 0-10        │
    │  • Tier: ORO(≥8) / MONITOREO(5-7) / ARCHIVO(<5)           │
    │  • 6 Excel SharePoint + GSheets Cal_Log                    │
    │  • score ≥ 5 → dispara WF02                                │
    └──────────────────────────│────────────────────────────────┘
                               │ POST /radar-scan
    ┌──────────────────────────▼────────────────────────────────┐
    │  WF02 — Agent 02 - Radar de Inversión v1.0                │
    │  Webhook: /radar-scan   │  ID: fko0zXYYl5X4PtHz           │
    │  • Tavily dual: fuentes gov/bolsas + general               │
    │  • Filtro Menciones: verifica que la empresa aparece       │
    │  • AI Agent RADAR1 (GPT-4o): detecta señal CAPEX/licita.  │
    │  • Validador determinístico + AI Agente Validador          │
    │  • Score radar 0-100 (PROM: fuente+CAPEX+horizonte+monto) │
    │  • Pinecone vectorial + 6 Excel SharePoint                 │
    │  • Gmail alerta score_radar ≥ 80                           │
    │  • Tier compuesto (composite ≥ 70 → ORO) → dispara WF03   │
    └──────────────────────────│────────────────────────────────┘
                               │ POST /prospector
    ┌──────────────────────────▼────────────────────────────────┐
    │  WF03 — Agent 03 - Prospector v2.0                        │
    │  Webhook: /prospector   │  ID: RLUDpi3O5Rb6WEYJ           │
    │  • Apollo.io People Search (Fase 1 gratis)                 │
    │  • Job titles por línea + jerarquía C-LEVEL/DIR/GER/JEFE  │
    │  • ORO=5 contactos / MONITOREO=3 / PLATA=4 por empresa    │
    │  • Multi-país: busca por país separado para multinacional  │
    │  • Rate limit: 429 → espera 30s → reintenta               │
    │  • GSheets: tab Prospectos + tab Sin Contactos             │
    └───────────────────────────────────────────────────────────┘
```

---

## Scoring System

### Score Calificación — WF01 (0–10)

| Factor | Peso | Valores |
|--------|------|---------|
| Impacto presupuesto | 25% | Muy Alto=10, Alto=8, Medio=5, Bajo=3, Muy Bajo=1 |
| Año objetivo | 15% | 2026=10, 2027=7, 2028=4, Sin año=2 |
| Recurrencia | 15% | Muy Alto=10, Alto=8, Medio=5, Bajo=3, Muy Bajo=1 |
| Multiplanta | 15% | Internacional=10, Regional=7, Única=3 |
| Ticket estimado | 10% | >5M USD=10, 1-5M=8, 500K-1M=5, <500K=3, Sin=1 |
| Referente mercado | 10% | Internacional=10, País=7, Baja=3 |
| Prioridad comercial | 10% | Muy Alta=10, Alta=8, Media=5, Baja=3, Muy Baja=1 |

### Score Radar — WF02 (0–100, sistema PROM)

| Criterio | Puntos |
|---------|--------|
| Fuente oficial (gov, licitación) | +25 |
| Mención CAPEX / inversión | +20 |
| Horizonte ≤ 12 meses | +20 |
| Monto declarado | +20 |
| Múltiples fuentes | +15 |

### Composite Score → Tier final

```
composite = (score_cal / 10) × 40 + (score_radar / 100) × 60

composite ≥ 70  → ORO       → 5 contactos Apollo
composite 40-69 → MONITOREO → 3 contactos Apollo
composite < 40  → ARCHIVO   → sin prospección
```

---

## Líneas de Negocio (6)

| Key interna | Strings del frontend |
|-------------|---------------------|
| BHS | BHS, Aeropuertos, Terminal, Cargo, ULD |
| CARTON_PAPEL | Cartón, Corrugado, Papel |
| INTRALOGISTICA | Intralogística, CEDI, WMS, Supply Chain |
| FINAL_LINEA | Final de Línea, Alimentos, Bebidas |
| MOTOS | Motos, Motocicletas, Ensambladoras |
| SOLUMAT | Solumat, Plásticos, Materiales |

---

## IDs de Producción (NO cambiar sin avisar)

| Componente | ID / Valor |
|-----------|-----------|
| WF01 ID N8N | `jDtdafuyYt8TXISl` |
| WF02 ID N8N | `fko0zXYYl5X4PtHz` |
| WF03 ID N8N | `RLUDpi3O5Rb6WEYJ` |
| N8N Host | `https://n8n.event2flow.com` |
| GSheets Prospectos | `1rtFoTi3ZwNHi9RBidFGcxOHtK6lOvCuhebUB1eS-MGo` |
| GSheets Base Datos | `13C6RJPORu6CPqr1iL0zXU-gUi3eTV-eYo8i-IV9K818` |
| Supabase URL | `https://supabase.valparaiso.cafe` |
| Pinecone índice | `matec-radar` (namespace: `proyectos_2026`) |
| OpenAI credential n8n | `OpenAi account 3` |
| Excel credential n8n | `Microsoft Excel account 2` |
| GSheets credential n8n | `Google Sheets account 3` |
| Apollo credential n8n | `Apollo API Key` (Header: `x-api-key`) |
| Tavily credential n8n | `Tavily API Key` (Header: `Authorization: Bearer ...`) |

---

## Estado actual por componente (Abril 2026)

| Componente | Estado | Versión activa | Pendiente |
|-----------|--------|---------------|-----------|
| WF01 Calificador | ✅ Producción | v1.0 | v2.0 (6 mejoras) |
| WF02 Radar | ✅ Producción | v1.0 | v2.0 (6 bugs críticos) |
| WF03 Prospector | 📦 Listo para deploy | v2.0 JSON en docs/ | Solo importar en n8n |
| Frontend Next.js | ✅ Funcional | v1.0 | v2.0 (Supabase + 6 líneas) |
| Supabase | ⚠️ No conectado | — | Ejecutar SQL + agregar keys |
| Base datos empresas | ✅ Local SQLite | 829 empresas | Migrar a Supabase |

---

## Bugs críticos conocidos (no tocar sin fix)

### WF02 — 3 bugs que afectan producción

**Bug A — SCORE CAL no se calcula en composite_score**
`Format Final Columns1` no tiene campo `SCORE CAL`. El composite_score en WF03 siempre usa `score_cal=0`.
Fix en `docs/PROMPT_Agent02_v2.md`.

**Bug B — Solo ORO dispara prospección**
`IF: Tier ORO para WF03` usa string equals "ORO" (case-sensitive). MONITOREO nunca prospecta.
Fix: cambiar a `tier_compuesto !== "ARCHIVO"`.

**Bug C — Construir Query Tavily está vacío**
El nodo no construye ninguna query, solo pasa el JSON. Búsqueda usa query genérica sin keywords.
Fix: código completo en `docs/PROMPT_Agent02_v2.md` → Cambio 1.

### WF01 — 2 bugs que afectan la cadena

**Bug D — No envía paises[] para multinacionales**
WF03 no puede hacer búsqueda multi-país porque WF01 no pasa el array.
Fix en `docs/PROMPT_Agent01_v2.md` → Cambio 5.

**Bug E — API keys Tavily hardcodeadas en WF01 y WF02**
Seguridad. Crear credencial n8n y referenciarla en ambos workflows.

### Frontend — 2 bugs que afectan UX

**Bug F — Solo 4 de 6 líneas en la página Scan**
`LINEA_OPTIONS` no tiene Cargo, Motos, Final de Línea, Solumat.
Fix en `docs/PROMPT_Frontend_v2.md` → Bug 1.

**Bug G — Campo `empresa` enviado como `nombre` al webhook**
`lib/n8n.ts` mapea `company_name → nombre` en vez de `empresa`. WF01 no lo reconoce.
Fix en `docs/PROMPT_Frontend_v2.md` → Bug 2.

---

## Estructura del repositorio

```
clients/                          ← raíz del proyecto (este CLAUDE.md)
├── CLAUDE.md                     ← este archivo
├── docs/
│   ├── arquitectura.md           ← IDs, credenciales, decisiones técnicas
│   ├── scoring-system.md         ← fórmulas de score completas
│   ├── flujo-git.md              ← convenciones de Git
│   ├── ANALISIS_Sistema_v2.md    ← análisis técnico de los 3 agentes
│   ├── PLAN_EJECUCION.md         ← plan paso a paso con Git integrado
│   ├── PROMPT_Agent01_v2.md      ← instrucciones mejora WF01
│   ├── PROMPT_Agent02_v2.md      ← instrucciones mejora WF02
│   ├── PROMPT_Agent03_v2.md      ← instrucciones mejora WF03
│   ├── PROMPT_Frontend_v2.md     ← instrucciones mejora frontend + Supabase
│   ├── PROMPT_MASTER_AgentTeams.md ← prompt para Agent Teams paralelo
│   └── PROSPECCIÓN/              ← bases de datos objetivo por línea (6 Excel)
├── n8n/
│   ├── wf01-calificador/         ← scripts de creación/fix del WF01
│   ├── wf02-radar/               ← scripts de creación/fix del WF02
│   └── wf03-prospector/          ← scripts + JSON v2.0 del WF03
├── radar-frontend/               ← Next.js app (tiene su propio CLAUDE.md)
├── tools/                        ← Python scripts de procesamiento
└── workflows/                    ← SOPs en Markdown (WAT framework)
```

---

## Reglas de trabajo (OBLIGATORIO leer antes de tocar código)

### Reglas absolutas
1. **No tocar el frontend** sin leer `radar-frontend/CLAUDE.md` primero
2. **No hardcodear API keys** — siempre usar credenciales n8n o variables de entorno
3. **No modificar WF01/WF02 directamente en n8n** sin crear primero el script de fix en `n8n/wfXX-*/`
4. **No exportar JSONs de n8n** al repo — contienen credenciales embebidas
5. **No cambiar los IDs de producción** de la tabla de IDs arriba
6. **Deduplicar por persona_id** antes de escribir en GSheets (WF03)

### Flujo Git (resumen — ver flujo-git.md para detalle)
```
main ← develop ← feature/* o fix/*
```
- Cada mejora de agente o frontend → rama `feature/` o `fix/`
- Commits: `feat(wf02): agregar Score CAL a Format Final Columns`
- PR con checklist: lint + test + build + prueba en n8n staging

### Antes de hacer cualquier cambio en n8n
1. Exportar el workflow actual desde n8n (como backup personal, NO commitear)
2. Probar en staging si está disponible
3. Documentar el cambio en el script `n8n/wfXX-*/fix_*.js`
4. Probar la cadena completa WF01→WF02→WF03 después del cambio

### Antes de hacer cualquier cambio en el frontend
```bash
cd radar-frontend
npm run lint    # debe pasar
npm run test    # debe pasar
npm run build   # debe pasar
```

---

## Skills y plugins disponibles

Este proyecto tiene instalado el plugin `matec-prospector` con las skills:
- `matec-prospector:apollo-fase1` — búsqueda de contactos por empresa y línea
- `matec-prospector:apollo-fase2` — enriquecimiento con emails (bulk_match)
- `matec-prospector:cobertura-empresas` — análisis de cobertura vs lista objetivo
- `matec-prospector:excel-master` — generación del Excel MASTER de entrega

Además el frontend tiene skills en `radar-frontend/.claude/skills/`:
- `code-reviewer` — auditoría de seguridad y calidad
- `senior-backend` — patterns de API y base de datos
- `senior-frontend` — best practices React/Next.js
- `senior-qa` — generación de tests (Vitest + Playwright)
- `senior-devops` — CI/CD y deployment
- `senior-security` — seguridad y pentesting

---

## Formato de datos entre agentes

### WF01 → WF02 (POST a /radar-scan)
```json
{
  "empresa": "Grupo Bimbo",
  "pais": "Mexico",
  "linea_negocio": "Final de Línea",
  "tier": "ORO",
  "tier_calculado": "ORO",
  "company_domain": "grupobimbo.com",
  "score_calificacion": 9,
  "paises": ["Mexico", "Colombia", "Chile"],
  "keywords": "Muy Alta",
  "segmentacion": {
    "impacto_presupuesto": "Muy Alto",
    "multiplanta": "Presencia internacional",
    "recurrencia": "Alto",
    "referente_mercado": "Referente internacional",
    "anio_objetivo": "2026",
    "ticket_estimado": "> 5M USD",
    "prioridad_comercial": "Muy Alta"
  }
}
```

### WF02 → WF03 (POST a /prospector)
```json
{
  "empresa": "Grupo Bimbo",
  "pais": "Mexico",
  "linea_negocio": "Final de Línea",
  "tier": "ORO",
  "company_domain": "grupobimbo.com",
  "score_calificacion": 9,
  "score_radar": 78,
  "composite_score": 83,
  "max_contacts": 5,
  "paises": ["Mexico", "Colombia", "Chile"]
}
```

### WF03 → GSheets (columnas tab Prospectos)
`ID | Empresa | Pais | Nombre | Apellido | Cargo | Nivel | Email_Verificado | Estado_Email | LinkedIn | Tel_Empresa | Tel_Directo | Tel_Movil | Grupo | Ciudad | Persona_ID | Fecha | Linea_Negocio | Tier | Es_Multinacional`

---

## Jerarquía de contactos por Nivel (WF03)

El sistema prioriza contactos en este orden (C-LEVEL primero):

| Nivel | Títulos incluidos |
|-------|------------------|
| C-LEVEL | CEO, COO, Gerente General, Director General, Managing Director, Country Manager |
| DIRECTOR | Director de área, Vice President, VP |
| GERENTE | Gerente, Manager, Head of |
| JEFE | Jefe, Coordinador, Supervisor |

---

## Contexto adicional útil

- **Base de datos objetivo:** 829 empresas en 6 líneas, 7 países LATAM (Colombia, México, Chile, Perú, Argentina, Brasil, Centroamérica)
- **Apollo.io créditos:** usar solo Fase 1 (gratis) en scans masivos. Fase 2 (emails) solo para contactos ORO priorizados.
- **Rate limits:** Apollo 429 → esperar 30s y reintentar. Tavily raramente tiene rate limit.
- **n8n versión:** v2. Webhook body viene envuelto en `.body` → siempre usar `raw.body || raw`.
- **typeVersion críticos:** Webhook=2.1, splitInBatches=3 (`main[0]`=done, `main[1]`=loop body), IF=2.3 (con `options.version: 3`).
- **Google Sheets:** usar `columns.schema` explícito en nodos append v4.4.
