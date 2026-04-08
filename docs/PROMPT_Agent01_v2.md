# PROMPT — Agent 01 Calificador v2.0 (Ejecución directa via n8n MCP)

## Para Claude Code — Instrucciones de ejecución

Tienes acceso al MCP de n8n conectado a `https://n8n.event2flow.com`.
Lee el workflow actual, modifica los nodos, guarda via API n8n, y prueba.
No generes scripts manuales ni pidas pasos manuales al usuario.

---

## Paso 1 — Leer el workflow actual

Usa `get_workflow_details` con `workflowId: "jDtdafuyYt8TXISl"`.

Lee el JSON completo. Localiza estos nodos:
1. `Buscar Perfil Empresa` — tiene API key de Tavily hardcodeada en headerParameters
2. `Webhook Calificador` — puede no tener responseMode configurado
3. Flujo después del Webhook — no hay nodo `Respond to Webhook`
4. `HTTP: Trigger Radar WF02` — timeout 5000, no envía `paises[]`
5. `Switch Linea Cal.` — verificar que tiene los 6 outputs

---

## Paso 2 — Aplicar los 6 fixes

### Fix 1 — API key Tavily → credencial n8n

En el nodo `Buscar Perfil Empresa`, mover la key:

```json
"authentication": "genericCredentialType",
"genericAuthType": "httpHeaderAuth",
"genericCredentialType": {
  "value": "Tavily API Key"
}
```

Eliminar el bloque `headerParameters` con el `Authorization: Bearer tvly-dev-...`.

Si la credencial aún no existe, crearla antes:
```bash
curl -X POST "https://n8n.event2flow.com/api/v1/credentials" \
  -H "X-N8N-API-KEY: $N8N_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Tavily API Key",
    "type": "httpHeaderAuth",
    "data": {
      "name": "Authorization",
      "value": "Bearer <KEY_ACTUAL_DEL_NODO>"
    }
  }'
```

### Fix 2 — Respuesta inmediata al webhook

Cambiar el nodo `Webhook Calificador` a `responseMode: "responseNode"`:
```json
"parameters": {
  "httpMethod": "POST",
  "path": "calificador",
  "responseMode": "responseNode",
  "options": {}
}
```

Agregar un nuevo nodo `Respond to Webhook` con configuración:
```json
{
  "name": "Respond to Webhook",
  "type": "n8n-nodes-base.respondToWebhook",
  "typeVersion": 1,
  "parameters": {
    "respondWith": "json",
    "responseBody": "={{ JSON.stringify({ status: 'processing', message: 'Calificación iniciada', empresas_count: $input.all().length, timestamp: $now.toISO() }) }}"
  }
}
```

Conectarlo en PARALELO al nodo `Code: Parse Companies` — ambos reciben el output del Webhook.
El `Respond to Webhook` no bloquea el flujo principal.

### Fix 3 — Manejo de error Tavily

En el nodo `Buscar Perfil Empresa`, activar `continueOnFail: true`:
```json
"onError": "continueRegularOutput"
```

Agregar nodo `IF: Tavily OK?` después del nodo HTTP Tavily:
```json
{
  "name": "IF: Tavily OK?",
  "type": "n8n-nodes-base.if",
  "typeVersion": 2.3,
  "parameters": {
    "conditions": [{
      "leftValue": "={{ ($json.results || []).length }}",
      "rightValue": 0,
      "operator": { "type": "number", "operation": "gt" }
    }],
    "options": { "version": 3 }
  }
}
```

- True branch → `Code: Format Profile` (flujo normal)
- False branch → nuevo nodo `Code: Set Perfil Vacío`:

```javascript
// Code: Set Perfil Vacío — cuando Tavily falla
const empresa = $('Loop Over Items1').item.json;
return [{
  json: {
    empresa:        empresa.empresa || '',
    pais:           empresa.pais || '',
    linea_negocio:  empresa.linea_negocio || '',
    tier:           empresa.tier || 'Tier B',
    company_domain: empresa.company_domain || '',
    perfil_results: 'Sin información pública disponible. Clasificar conservadoramente.',
    _tavily_error:  true,
  }
}];
```

Después de `Code: Set Perfil Vacío`, conectar a `AI Agent Segmentación Cualitativa`
(mismo destino que el path exitoso).

Actualizar las conexiones del workflow para reflejar esta bifurcación.

### Fix 4 — Timeout HTTP trigger WF02 + neverError

En el nodo `HTTP: Trigger Radar WF02`, actualizar `parameters.options`:
```json
"options": {
  "timeout": 10000,
  "response": {
    "response": {
      "neverError": true
    }
  }
}
```

### Fix 5 — paises[] para empresas multinacionales

En el nodo `HTTP: Trigger Radar WF02`, actualizar el `jsonBody` completo:

```
={{ JSON.stringify({
  empresa:            $json.empresa,
  pais:               $json.pais,
  linea_negocio:      $json.linea_negocio,
  tier:               $json.tier_calculado,
  company_domain:     $json.company_domain || '',
  score_calificacion: $json.score_calificacion,
  keywords:           $json['PRIORIDAD COMERCIAL'],
  paises: (
    $json['MULTIPLANTA'] === 'Presencia internacional'
      ? ($json.paises_extra || [$json.pais, 'Mexico', 'Chile', 'Peru'])
      : ($json['MULTIPLANTA'] === 'Varias sedes regionales'
          ? [$json.pais, 'Colombia']
          : [$json.pais])
  ).filter((v, i, a) => a.indexOf(v) === i),
  segmentacion: {
    impacto_presupuesto: $json['IMPACTO EN EL PRESUPUESTO'],
    multiplanta:         $json['MULTIPLANTA'],
    recurrencia:         $json['RECURRENCIA'],
    referente_mercado:   $json['REFERENTE DEL MERCADO'],
    anio_objetivo:       $json['ANIO OBJETIVO'],
    ticket_estimado:     $json['TICKET ESTIMADO'],
    prioridad_comercial: $json['PRIORIDAD COMERCIAL']
  }
}) }}
```

### Fix 6 — Verificar Switch Linea Cal. con 6 outputs

Leer el nodo `Switch Linea Cal.` del JSON. Verificar que tiene exactamente 6 reglas de output.

Si falta alguna, agregar la regla faltante. La configuración correcta del Switch:

```json
{
  "rules": {
    "values": [
      { "outputKey": "BHS",         "value": "BHS",           "type": "string" },
      { "outputKey": "CARTON",      "value": "CARTON",         "type": "string" },
      { "outputKey": "INTRA",       "value": "INTRA",          "type": "string" },
      { "outputKey": "CARGO",       "value": "CARGO",          "type": "string" },
      { "outputKey": "MOTOS",       "value": "MOTOS",          "type": "string" },
      { "outputKey": "FINAL_LINEA", "value": "FINAL_LINEA",    "type": "string" }
    ]
  },
  "fallbackOutput": "INTRA"
}
```

El campo de entrada del Switch debe ser `={{ $json._linea_key }}` (valor calculado por `Code: Prepare Excel Row`).

---

## Paso 3 — Guardar el workflow via API

```bash
curl -X PUT "https://n8n.event2flow.com/api/v1/workflows/jDtdafuyYt8TXISl" \
  -H "X-N8N-API-KEY: $N8N_API_KEY" \
  -H "Content-Type: application/json" \
  -d @/tmp/wf01_updated.json
```

---

## Paso 4 — Probar con execute_workflow

Prueba 1 — empresa multinacional ORO:
```
workflowId: "jDtdafuyYt8TXISl"
inputs: {
  type: "webhook",
  webhookData: {
    method: "POST",
    body: {
      "empresas": [{
        "empresa": "Smurfit Kappa Colombia",
        "pais": "Colombia",
        "linea_negocio": "Cartón y Papel",
        "company_domain": "smurfitkappa.com"
      }]
    }
  }
}
```

Verificar en la ejecución:
- El webhook responde INMEDIATAMENTE con `{ status: "processing" }`
- Tavily busca el perfil de Smurfit Kappa
- AI Agent asigna `MULTIPLANTA = "Presencia internacional"`
- Score calculado ≥ 8 → `tier_calculado = "ORO"`
- `HTTP: Trigger Radar WF02` dispara con `paises: ["Colombia","Mexico","Chile","Peru"]`

Prueba 2 — empresa con score bajo (no debe disparar WF02):
```
body: {
  "empresas": [{
    "empresa": "Taller Mecánico López",
    "pais": "Colombia",
    "linea_negocio": "Intralogística"
  }]
}
```

Verificar: score < 5 → `tier_calculado = "ARCHIVO"` → NO dispara WF02.

**Criterio de éxito:** Ambas pruebas correctas. Cadena WF01→WF02 funcional.
