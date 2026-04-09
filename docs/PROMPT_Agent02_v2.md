# PROMPT — Agent 02 Radar v2.0 (Ejecución directa via n8n MCP)

## Para Claude Code — Instrucciones de ejecución

Tienes acceso al MCP de n8n conectado a `https://n8n.event2flow.com`.
Úsalo para leer el workflow actual, modificar los nodos defectuosos, guardar via API,
y probar la ejecución. No generes scripts manuales ni pidas al usuario tocar n8n.

---

## Paso 1 — Leer el workflow actual

Usa `get_workflow_details` con `workflowId: "fko0zXYYl5X4PtHz"`.

Lee el JSON completo. Localiza estos nodos defectuosos:
1. `Construir Query Tavily` — debe tener código JS que construye la query con keywords
2. `Format Final Columns1` — debe incluir campos `SCORE CAL` y `SCORE RADAR`
3. `IF: Tier ORO para WF03` — condición que solo pasa ORO (debe pasar ORO+MONITOREO)
4. `HTTP: Trigger Prospector WF03` — body incompleto (falta composite_score, paises[])
5. Nodos HTTP Tavily — tienen API key hardcodeada en headerParameters

---

## Paso 2 — Aplicar los 6 fixes

Modifica el JSON del workflow en memoria, nodo por nodo.

### Fix 1 — Nodo "Construir Query Tavily"

Reemplazar el código actual (`return { json: { ...$input.item.json } }`) con:

```javascript
// Construir Query Tavily v2 — keywords específicas por línea
const item = $input.item.json;
const empresa = item.empresa || '';
const pais = item.pais || '';
const linea = (item.linea_negocio || '').toLowerCase()
  .normalize('NFD').replace(/[\u0300-\u036f]/g, '');

const KEYWORDS = {
  bhs:          'ampliacion terminal aeropuerto CAPEX concesion pista nueva inversion licitacion',
  aeropuerto:   'ampliacion terminal aeropuerto CAPEX concesion pista nueva inversion licitacion',
  cargo:        'bodega aerocarga cargo CAPEX expansion logistica aerea inversion licitacion',
  carton:       'planta carton corrugado CAPEX expansion capacidad produccion inversion nueva',
  papel:        'planta carton corrugado CAPEX expansion capacidad produccion inversion nueva',
  intra:        'CEDI bodega almacen automatizacion CAPEX expansion logistica WMS inversion',
  logist:       'CEDI bodega almacen automatizacion CAPEX expansion logistica WMS inversion',
  final:        'planta embalaje packaging CAPEX expansion linea produccion palletizado etiquetado',
  alimento:     'planta embalaje packaging CAPEX expansion linea produccion palletizado etiquetado',
  bebida:       'planta embalaje packaging CAPEX expansion linea produccion palletizado etiquetado',
  moto:         'ensambladora motocicleta planta CAPEX expansion produccion nueva instalacion',
  solumat:      'planta plastico material industrial CAPEX expansion capacidad produccion nueva',
};

let keywords = 'CAPEX inversion expansion planta nueva 2026 2027';
for (const [key, kw] of Object.entries(KEYWORDS)) {
  if (linea.includes(key)) { keywords = kw; break; }
}

const tavily_query = `"${empresa}" ${pais} ${keywords}`;

return [{
  json: {
    ...item,
    tavily_query,
    keywords_usadas: keywords,
  }
}];
```

### Fix 2 — Nodo Set "Format Final Columns1"

Agregar estos campos al nodo Set (buscar el nodo con `"type": "n8n-nodes-base.set"`
cuyo nombre es `Format Final Columns1` y agregar a sus `assignments.assignments`):

```json
{
  "id": "col-score-cal-01",
  "name": "SCORE CAL",
  "value": "={{ $('Loop Over Items1').item.json.score_calificacion || 0 }}",
  "type": "number"
},
{
  "id": "col-pais-fix-01",
  "name": "PAIS",
  "value": "={{ $('Loop Over Items1').item.json.pais || '' }}",
  "type": "string"
},
{
  "id": "col-paises-01",
  "name": "paises",
  "value": "={{ $('Loop Over Items1').item.json.paises || [$('Loop Over Items1').item.json.pais || 'Colombia'] }}",
  "type": "array"
}
```

Verificar que ya existe `SCORE RADAR` — si no, también agregar:
```json
{
  "id": "col-score-radar-01",
  "name": "SCORE RADAR",
  "value": "={{ ($json.output?.score_relevancia ?? $json.score_relevancia) || 0 }}",
  "type": "number"
}
```

### Fix 3 — Nuevo nodo "Code: Calcular Composite"

Insertar un nodo Code DESPUÉS de `Format Final Columns1` y ANTES del `IF: Tier ORO para WF03`.

Código del nodo:
```javascript
// Code: Calcular Composite v1
const item = $input.item.json;

const score_cal   = Number(item['SCORE CAL']   || item.score_calificacion || 0);
const score_radar = Number(item['SCORE RADAR'] || item.score_relevancia   || 0);

// Fórmula: docs/scoring-system.md
const composite = Math.round((score_cal / 10) * 40 + (score_radar / 100) * 60);

let tier_compuesto;
if (composite >= 70)      tier_compuesto = 'ORO';
else if (composite >= 40) tier_compuesto = 'MONITOREO';
else                      tier_compuesto = 'ARCHIVO';

const CONTACTS = { 'ORO': 5, 'MONITOREO': 3, 'ARCHIVO': 0 };

return [{
  json: {
    ...item,
    composite_score: composite,
    tier_compuesto,
    max_contacts: CONTACTS[tier_compuesto] || 0,
    TIER: tier_compuesto,   // sobreescribe el TIER original con el compuesto
  }
}];
```

Para insertar el nodo en el flujo de n8n, actualizar el array `connections` del workflow:
- Eliminar la conexión directa: `Format Final Columns1` → `IF: Tier ORO para WF03`
- Agregar: `Format Final Columns1` → `Code: Calcular Composite` → `IF: Tier ORO para WF03`

### Fix 4 — Nodo "IF: Tier ORO para WF03"

Cambiar la condición del nodo. Buscar el nodo con nombre `IF: Tier ORO para WF03` y reemplazar su `parameters.conditions`:

```json
{
  "options": {
    "caseSensitive": true,
    "leftValue": "",
    "typeValidation": "strict",
    "version": 3
  },
  "conditions": [
    {
      "id": "cond-tier-no-archivo",
      "leftValue": "={{ $json.tier_compuesto }}",
      "rightValue": "ARCHIVO",
      "operator": {
        "type": "string",
        "operation": "notEquals"
      }
    }
  ],
  "combinator": "and"
}
```

### Fix 5 — Nodo "HTTP: Trigger Prospector WF03"

Reemplazar el `jsonBody` del nodo HTTP con:

```
={{ JSON.stringify({
  empresa:            $json["COMPANY NAME"],
  pais:               $json["PAIS"] || $json["PAÍS"],
  linea_negocio:      $json["LÍNEA DE NEGOCIO"] || $json["LINEA DE NEGOCIO"],
  tier:               $json.tier_compuesto,
  company_domain:     $json.company_domain || "",
  score_calificacion: $json["SCORE CAL"] || 0,
  score_radar:        $json["SCORE RADAR"] || 0,
  composite_score:    $json.composite_score || 0,
  max_contacts:       $json.max_contacts || 5,
  paises:             $json.paises || [$json["PAIS"] || $json["PAÍS"] || "Colombia"]
}) }}
```

### Fix 6 — API keys Tavily (hardcoded → credencial)

En los nodos `Buscar Fuentes Primarias` y `Buscar Tavily General1`, mover la autenticación:

Cambiar de `sendHeaders: true` con `headerParameters` explícitos a usar credencial n8n.

En el JSON del nodo, reemplazar el bloque de headers hardcodeados:
```json
"authentication": "genericCredentialType",
"genericAuthType": "httpHeaderAuth",
"genericCredentialType": {
  "value": "Tavily API Key"
}
```

Y eliminar el bloque `headerParameters` con el token Bearer.

**Nota:** Si la credencial `Tavily API Key` no existe aún en n8n, crearla via API:
```bash
curl -X POST "https://n8n.event2flow.com/api/v1/credentials" \
  -H "X-N8N-API-KEY: $N8N_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Tavily API Key",
    "type": "httpHeaderAuth",
    "data": {
      "name": "Authorization",
      "value": "Bearer <TAVILY_KEY_ACTUAL>"
    }
  }'
```
Usar la key actual que está hardcodeada en el nodo como valor.

---

## Paso 3 — Guardar el workflow modificado via API

```bash
curl -X PUT "https://n8n.event2flow.com/api/v1/workflows/fko0zXYYl5X4PtHz" \
  -H "X-N8N-API-KEY: $N8N_API_KEY" \
  -H "Content-Type: application/json" \
  -d @/tmp/wf02_updated.json
```

Donde `/tmp/wf02_updated.json` es el JSON completo del workflow con todos los fixes aplicados.

---

## Paso 4 — Probar con execute_workflow

Prueba 1 — empresa ORO (debe disparar WF03 con 5 contactos):
```
workflowId: "fko0zXYYl5X4PtHz"
inputs: {
  type: "webhook",
  webhookData: {
    method: "POST",
    body: {
      "empresa": "Grupo Bimbo",
      "pais": "Mexico",
      "linea_negocio": "Final de Línea",
      "tier": "ORO",
      "score_calificacion": 9,
      "company_domain": "grupobimbo.com"
    }
  }
}
```

Verificar en la ejecución:
- `Construir Query Tavily` tiene query con keywords de Final de Línea
- `Format Final Columns1` tiene campo `SCORE CAL = 9`
- `Code: Calcular Composite` produce `composite_score ≥ 70`, `tier_compuesto = "ORO"`
- `IF: Tier ORO para WF03` → true branch → dispara `HTTP: Trigger Prospector WF03`

Prueba 2 — empresa MONITOREO (también debe disparar WF03 con 3 contactos):
```
body: {
  "empresa": "Terminal de Carga Bogotá",
  "pais": "Colombia",
  "linea_negocio": "BHS",
  "tier": "MONITOREO",
  "score_calificacion": 6
}
```

Verificar: `tier_compuesto = "MONITOREO"`, IF pasa (no es ARCHIVO), WF03 recibe `max_contacts = 3`.

**Criterio de éxito:** Ambas pruebas completan sin error y WF03 se dispara.
