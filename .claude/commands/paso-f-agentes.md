# Paso F — Mejoras de los 3 agentes n8n vía MCP

## Contexto
Eres Claude Code con acceso al MCP de n8n en `https://n8n.event2flow.com`.
Debes aplicar mejoras críticas a los 3 workflows. Trabaja en la carpeta `clients/`.

## Orden de ejecución (de más a menos crítico)
1. WF02 Radar → WF01 Calificador → WF03 Prospector

## Git: una rama por agente
```bash
# Antes de cada sección:
git checkout develop
git checkout -b fix/wf0X-v2
# Después de cada sección:
git add -A && git commit -m "fix(wf0X): ..." && git push origin fix/wf0X-v2
```

---

## F.1 — WF02 Radar de Inversión (45 min)

**Workflow ID:** `fko0zXYYl5X4PtHz`

### Paso 1: Leer el workflow actual
```
get_workflow_details("fko0zXYYl5X4PtHz")
```
Guardar el JSON completo en memoria. Identificar los nodos por nombre.

### Paso 2: Aplicar Fix 1 — Construir Query Tavily
Nodo a modificar: `"Construir Query Tavily"` (tipo: Code)

Reemplazar su código con:
```javascript
const input = $input.item.json;
const empresa = input.empresa || input['COMPANY NAME'] || '';
const linea = input.linea_negocio || input['LÍNEA DE NEGOCIO'] || '';

const KEYWORDS = {
  BHS: 'aeropuerto terminal baggage handling CAPEX licitación expansión',
  CARTON_PAPEL: 'cartón corrugado empaque planta CAPEX inversión ampliación',
  INTRALOGISTICA: 'CEDI bodega intralogística WMS automatización CAPEX',
  'Final de Línea': 'palletizado embalaje final línea producción CAPEX',
  Motos: 'motocicleta ensambladora planta producción CAPEX inversión',
  SOLUMAT: 'plástico polímero material industrial planta CAPEX'
};

const kw = KEYWORDS[linea] || KEYWORDS[Object.keys(KEYWORDS).find(k => linea.includes(k)) || ''] || 'CAPEX inversión expansión';
const query = `${empresa} ${kw} 2025 2026`;

return [{ json: { ...input, tavily_query: query } }];
```

### Paso 3: Aplicar Fix 2 — SCORE CAL faltante
Nodo a modificar: `"Format Final Columns1"` (tipo: Set, setType: manual)

Agregar estos campos al array `values`:
```json
{ "name": "SCORE CAL",  "type": "expression", "value": "={{ $json.score_calificacion || $json['SCORE CAL'] || 0 }}" },
{ "name": "PAIS",       "type": "expression", "value": "={{ $json.pais || $json['PAÍS'] || '' }}" },
{ "name": "paises",     "type": "expression", "value": "={{ $json.paises || [] }}" }
```

### Paso 4: Aplicar Fix 3 — Nodo Code: Calcular Composite
Crear un nuevo nodo Code entre `"Format Final Columns1"` y el nodo `IF`:

```javascript
const d = $input.item.json;
const scoreCal   = Number(d['SCORE CAL']   || d.score_calificacion || 0);
const scoreRadar = Number(d['SCORE RADAR'] || d.score_radar || 0);

// Fórmula oficial: CAL tiene peso 40%, RADAR peso 60%
const composite = (scoreCal / 10) * 40 + (scoreRadar / 100) * 60;

let tier_compuesto = 'ARCHIVO';
let max_contacts   = 0;

if (composite >= 70) {
  tier_compuesto = 'ORO';
  max_contacts   = 5;
} else if (composite >= 40) {
  tier_compuesto = 'MONITOREO';
  max_contacts   = 3;
}

return [{ json: { ...d, composite_score: Math.round(composite), tier_compuesto, max_contacts } }];
```

### Paso 5: Aplicar Fix 4 — Condición del IF
Nodo a modificar: `"IF: Tier ORO para WF03"` (tipo: If)

Cambiar condición de:
`{{ $json.tier === "ORO" }}` o `string equals "ORO"`

A:
`{{ $json.tier_compuesto !== "ARCHIVO" }}`

### Paso 6: Aplicar Fix 5 — HTTP Trigger WF03
Nodo a modificar: `"HTTP: Trigger Prospector WF03"` (tipo: HttpRequest)

Actualizar el jsonBody a:
```json
{
  "empresa":         "={{ $json['COMPANY NAME'] || $json.empresa }}",
  "pais":            "={{ $json['PAÍS'] || $json.pais }}",
  "linea_negocio":   "={{ $json['LÍNEA DE NEGOCIO'] || $json.linea_negocio }}",
  "tier":            "={{ $json.tier_compuesto }}",
  "composite_score": "={{ $json.composite_score }}",
  "score_calificacion": "={{ $json['SCORE CAL'] || 0 }}",
  "score_radar":     "={{ $json['SCORE RADAR'] || 0 }}",
  "max_contacts":    "={{ $json.max_contacts }}",
  "company_domain":  "={{ $json['DOMINIO'] || $json.company_domain || '' }}",
  "paises":          "={{ $json.paises || [] }}"
}
```

### Paso 7: Guardar y probar
```
PUT /api/v1/workflows/fko0zXYYl5X4PtHz  (settings: {})
execute_workflow("fko0zXYYl5X4PtHz", {
  "empresa": "Grupo Bimbo",
  "pais": "Mexico",
  "linea_negocio": "Final de Línea",
  "score_calificacion": 9
})
```
Verificar que `tier_compuesto` sea "ORO" y que WF03 sea disparado.

**Git:**
```bash
git commit -m "fix(wf02): SCORE CAL, query Tavily, composite score, MONITOREO dispara WF03"
```

---

## F.2 — WF01 Calificador (45 min)

**Workflow ID:** `jDtdafuyYt8TXISl`

### Paso 1: Leer
```
get_workflow_details("jDtdafuyYt8TXISl")
```

### Paso 2: Fix 1 — Webhook respuesta inmediata
Nodo: `"Webhook Calificador"` (tipo: Webhook)
Cambiar: `responseMode` de `"lastNode"` a `"responseNode"`

Agregar nodo nuevo `"Respond to Webhook"` (tipo: RespondToWebhook) conectado directamente al Webhook (rama paralela):
```json
{ "respondWith": "json", "responseBody": "={ \"status\": \"processing\", \"message\": \"Calificación iniciada\" }" }
```

### Paso 3: Fix 2 — Error handling Tavily
Nodo Tavily (HTTP Request a Tavily):
- `continueOnFail: true`

Agregar nodo `"IF: Tavily OK?"` después del nodo Tavily:
- TRUE: `{{ $json.results !== undefined }}`
- FALSE path: nodo `"Code: Set Perfil Vacío"`:
```javascript
return [{ json: { ...($input.item.json), perfil_empresa: {}, tavily_error: true } }];
```

### Paso 4: Fix 3 — Timeout HTTP a WF02
Nodo: `"HTTP: Trigger Radar WF02"`
- `timeout: 10000`
- `continueOnFail: true`

### Paso 5: Fix 4 — paises[] para multinacionales
Nodo que construye el payload a WF02 (buscar el nodo Set o Code que hace el body):

Agregar lógica de `paises[]`:
```javascript
const d = $input.item.json;
const segm = d.segmentacion || {};
const esInternacional = segm.multiplanta === 'Presencia internacional' || 
                        segm.multiplanta === 'Internacional';
const paisBase = d.pais || 'Colombia';

const paises = esInternacional
  ? [paisBase, 'Mexico', 'Chile', 'Peru'].filter((v, i, a) => a.indexOf(v) === i)
  : [paisBase];

return [{ json: { ...d, paises } }];
```

### Paso 6: Guardar y probar
```
PUT /api/v1/workflows/jDtdafuyYt8TXISl  (settings: {})
execute_workflow("jDtdafuyYt8TXISl", {
  "empresas": [{ "empresa": "Smurfit Kappa Colombia", "pais": "Colombia",
    "linea_negocio": "Cartón y Papel", "company_domain": "smurfitkappa.com" }]
})
```
Verificar: respuesta inmediata + cadena WF01→WF02 ejecutada.

**Git:**
```bash
git commit -m "fix(wf01): webhook inmediato, paises[] multinacional, Tavily error handling"
```

---

## F.3 — WF03 Prospector (20 min)

**Workflow ID:** `RLUDpi3O5Rb6WEYJ`

### Paso 1: Leer
```
get_workflow_details("RLUDpi3O5Rb6WEYJ")
```

### Paso 2: Fix 1 — Code: Parse Input (3 formatos)
Buscar el nodo de parsing inicial. Reemplazar con:
```javascript
const raw = $input.item.json;
const body = raw.body || raw;

// Formato 1 — Frontend batch: { linea, empresas[], paises[], tier }
if (Array.isArray(body.empresas)) {
  const tier = body.tier || 'ORO';
  const maxContacts = tier === 'ORO' ? 5 : tier === 'PLATA' ? 4 : 3;
  return body.empresas.map(emp => ({
    json: {
      empresa: typeof emp === 'string' ? emp : (emp.empresa || emp.nombre),
      pais: typeof emp === 'string' ? (body.pais || 'Colombia') : (emp.pais || body.pais || 'Colombia'),
      linea_negocio: body.linea || body.linea_negocio || '',
      tier, max_contacts: maxContacts,
      paises: body.paises || [],
      company_domain: typeof emp === 'object' ? (emp.dominio || emp.company_domain || '') : '',
    }
  }));
}

// Formato 2 — WF02 camelCase
if (body.empresa) {
  const tier = body.tier || body.tier_compuesto || 'ORO';
  const maxContacts = body.max_contacts || (tier === 'ORO' ? 5 : tier === 'PLATA' ? 4 : 3);
  return [{ json: { ...body, tier, max_contacts: maxContacts, paises: body.paises || [] } }];
}

// Formato 3 — WF02 uppercase legacy
if (body['COMPANY NAME']) {
  const tier = body['TIER'] || body.tier || 'ORO';
  const maxContacts = tier === 'ORO' ? 5 : tier === 'PLATA' ? 4 : 3;
  return [{ json: {
    empresa: body['COMPANY NAME'], pais: body['PAÍS'] || 'Colombia',
    linea_negocio: body['LÍNEA DE NEGOCIO'] || '', tier, max_contacts: maxContacts,
    company_domain: body['DOMINIO'] || '', paises: body.paises || [],
  }}];
}

return [{ json: { error: 'Formato de input no reconocido', raw: body } }];
```

### Paso 3: Fix 2 — Code: Build Apollo Query
Verificar que el nodo use job titles correctos por línea y el campo `max_contacts`. Si necesita ajuste, reemplazar con la versión del `docs/PROMPT_Agent03_v2.md`.

### Paso 4: Guardar y probar
```
PUT /api/v1/workflows/RLUDpi3O5Rb6WEYJ  (settings: {})
execute_workflow("RLUDpi3O5Rb6WEYJ", {
  "empresa": "Smurfit Kappa", "pais": "Colombia",
  "linea_negocio": "Cartón y Papel", "tier": "ORO"
})
```
Verificar ≥ 3 contactos en GSheets tab `Prospectos`.

**Git:**
```bash
git commit -m "feat(wf03): parse 3 formatos, tier → max_contacts, paises[] multi-país"
```
