Eres un experto en los **3 agentes N8N** del sistema Matec Radar B2B (arquitectura reestructurada Abril 2026).

## Credenciales N8N
- **Host**: `https://n8n.event2flow.com`
- **API Key**: en `.env` como `N8N_API_KEY`

## Los 3 Agentes

### WF01 — Calificador
- **ID**: `jDtdafuyYt8TXISl`
- **Webhook**: `POST /webhook/calificador`
- **Nodos**: 20 (todos activos)
- **Input**: `{ empresas: [{empresa, pais, linea_negocio, company_domain}], trigger_type }`
- **Output**: score 0-10, tier ORO/MONITOREO/ARCHIVO, 7 campos segmentación, escribe 6 Excel SharePoint

**Flujo:**
```
Webhook → Code:Parse Companies → Loop → Buscar Perfil (Tavily)
→ Code:Format Profile → AI Agent Segmentación (gpt-4.1-mini)
→ Code:Calcular Score+Tier → Log Calificacion (GSheets)
→ IF Score>=5 → HTTP:Trigger WF02
→ Code:Prepare Excel Row → Switch Linea → 6x MicrosoftExcel upsert → Merge Results
```

### WF02 — Radar de Inversión
- **ID**: `fko0zXYYl5X4PtHz`
- **Webhook**: `POST /webhook/radar-scan`
- **Nodos**: 63 (2 disabled: Pinecone Vector Store, Append Resultados Intralogística)
- **Input**: payload de WF01 con score, tier, empresa
- **Output**: 12 campos radar, score 0-100, escribe 6 Excel SharePoint + GSheets + Pinecone

**Flujo:**
```
Webhook → Code:Parse WF01 Input → Loop
→ Determinar Sub-Línea → Construir Query Tavily → Buscar Fuentes Primarias
→ Buscar Tavily General1 → Fusionar Búsquedas
→ Filtro Menciones → IF:Tiene Menciones
→ AI Agent RADAR1 (gpt-4.1-mini) → Parse Output → Format Final Columns
→ Validador de Fuentes → AI Agente Validador → Fusionar Validación
→ Normalizar Linea → Switch → 6x Excel (append) + GSheets Logs
→ Formatear para Vector → Pinecone
→ IF:Tier ORO → HTTP:Trigger WF03
```

### WF03 — Prospector
- **ID**: `RLUDpi3O5Rb6WEYJ`
- **Webhook**: `POST /webhook/prospector`
- **Nodos**: 11 (todos activos)
- **Input**: payload de WF02 con COMPANY NAME, LÍNEA DE NEGOCIO, TIER (o formato snake_case)
- **Output**: 5 contactos Apollo (ORO) / 2 (MONITOREO), escribe GSheets Prospection_Log

**Flujo:**
```
Webhook → Respond 200 → Code:Parse Input → Loop
→ Code:Build Apollo Query → HTTP:Apollo People Search
→ Code:Merge Apollo Response → Code:Filter&Format
→ Code:Expand to Rows → Log Prospeccion GSheets → Wait
```

## Payloads

### WF01 (desde frontend o manual)
```json
{
  "empresas": [{"empresa": "OPAIN", "pais": "Colombia", "linea_negocio": "BHS", "company_domain": "opain.com.co"}],
  "trigger_type": "manual"
}
```

### WF02 (disparado por WF01, también puede ser manual)
```json
{
  "empresa": "OPAIN", "pais": "Colombia", "linea_negocio": "BHS",
  "tier": "MONITOREO", "score_calificacion": 6, "company_domain": "opain.com.co"
}
```

### WF03 (disparado por WF02, también puede ser manual con formato WF02)
```json
{
  "COMPANY NAME": "Smurfit Kappa", "PAÍS": "Colombia",
  "LÍNEA DE NEGOCIO": "Carton y Papel", "TIER": "ORO",
  "company_domain": "smurfitkappa.com", "score_calificacion": 9
}
```

## Scripts disponibles en `n8n/`
- `n8n/wf01-calificador/create_workflow01_calificador.js` — crea WF01 desde cero
- `n8n/wf01-calificador/add_sharepoint_to_wf01.js` — agrega 6 Excel SharePoint a WF01
- `n8n/wf01-calificador/fix_excel_nodes_wf01.js` — corrige typeVersion Excel a 2.2
- `n8n/wf02-radar/create_workflow02_radar.js` — crea WF02 desde cero
- `n8n/wf03-prospector/create_workflow03_prospector.js` — crea WF03 desde cero
- `n8n/wf03-prospector/fix_wf03_parse_input.js` — maneja formato WF02 uppercase
- `n8n/wf03-prospector/fix_wf03_gsheets_node.js` — schema explícito GSheets

## Bugs conocidos y fixes aplicados
| Bug | Fix |
|-----|-----|
| Webhook N8N v2 wraps body | `const body = raw.body \|\| raw` |
| splitInBatches v3: main[0]=done, main[1]=loop | conectar a main[1] |
| IF v2.3 requiere `options.version:3` | estructura exacta del nodo |
| MicrosoftExcel: resource:'worksheet' no 'table' | typeVersion 2.2, dataMode:'autoMap' |
| GSheets autoMap sin schema en runtime | usar `columns.schema` explícito |
| WF03 recibe campos uppercase de WF02 | Parse Input acepta ambos formatos |

## Para modificar un workflow
```javascript
const wf = await fetch('https://n8n.event2flow.com/api/v1/workflows/{ID}', {
  headers: { 'X-N8N-API-KEY': process.env.N8N_API_KEY }
}).then(r => r.json());
const node = wf.nodes.find(n => n.name === 'NombreNodo');
node.parameters.jsCode = nuevoCode;
await fetch('https://n8n.event2flow.com/api/v1/workflows/{ID}', {
  method: 'PUT', headers: { 'X-N8N-API-KEY': process.env.N8N_API_KEY, 'Content-Type': 'application/json' },
  body: JSON.stringify({ name: wf.name, nodes: wf.nodes, connections: wf.connections, settings: wf.settings || {} })
});
```

Ahora analiza/implementa la tarea solicitada sobre los agentes N8N.
