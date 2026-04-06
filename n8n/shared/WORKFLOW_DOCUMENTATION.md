# Workflow Documentation: Subagente 300 Monitor VIP v9.0

---

## Summary

| Field | Value |
|---|---|
| **Workflow Name** | Subagente 300 Monitor VIP v9.0 (PRODUCCIÓN — Sheets Fix + Rotación) |
| **Workflow ID** | `cB6VI7ZPS4fFVi-dAk4RG` |
| **Total Nodes** | 67 |
| **Status** | Active |
| **Last Updated** | 2026-03-24 |

### High-Level Flow Description

This workflow is Matec's automated B2B investment radar. It monitors a database of target companies for future investment signals (CAPEX announcements, expansions, tenders, etc.) relevant to Matec's three business lines: BHS (airport baggage handling), Cartón (corrugated cardboard), and Intralogística (intralogistics/warehousing).

The workflow has **two entry points**:
1. **Scheduled run**: fires automatically via `Schedule Trigger1` to process all clients from the `BASE_DE_DATOS` Google Sheet.
2. **Webhook run**: `Webhook Radar B2B` accepts an HTTP POST to scan a single company on demand.

Once triggered, the workflow loops over each company, performs dual Tavily web searches (general + primary sources), feeds results to a GPT-4.1-mini AI Agent (`AI Agent RADAR1`) that scores the opportunity and returns structured JSON. A secondary `AI Agente Validador1` then validates borderline scores. Approved results are formatted and written to:
- A central log Google Sheet (`Log Cliente1`)
- Line-specific Google Sheets tabs (BHS / Cartón / Intralogística)
- Multiple Microsoft Excel files segmented by sub-product (Aeropuertos, Cargo, Cartón y Papel, Intralogística, Motos, Final de Línea, SOLUMAT)
- Source-log Excel files per line of business
- Pinecone vector store for RAG memory
- Gmail alert for gold-tier opportunities

### Known Bugs and Fixes Applied (v3 → v9)

| # | Issue | Fix Applied |
|---|---|---|
| 1 | Temporal filter evaluated news date instead of project date | AI prompt now explicitly instructs: "Evalúa FECHA DEL PROYECTO (no de la noticia)" |
| 2 | Tavily was disconnected / secondary | Tavily is now PRIMARY search via `Buscar Tavily General1` + `Buscar Fuentes Primarias1` |
| 3 | Testing Agent present in production | Eliminated; production flow goes directly to `AI Agent RADAR1` |
| 4 | `Replace Me` node broke the loop | Removed; Wait node connects directly to Loop |
| 5 | `Es Oportunidad ORO?1` was disconnected | Now connected from the `¿Aprobado IA?1` YES branch |
| 6 | `Formatear para Vector1` was disconnected | Now connected from `Format Final Columns1` |
| 7 | `Log QA Failures` was disabled | Enabled with proper Google Sheets credentials |
| 8 | Google Sheets append used wrong sheet ID | Fixed in `Sheets Fix` revision (v9.0) |
| 9 | Single Tavily search missed specialist sources | Added `Buscar Fuentes Primarias1` node for BNAmericas/SECOP/Aerocivil queries |
| 10 | Line routing used chained IF nodes | Replaced with `Switch` node + `Normalizar Linea` for clean tri-branch routing |

---

## Group 1: Trigger & Entry

### Schedule Trigger1
- **Type**: `n8n-nodes-base.scheduleTrigger`
- **Purpose**: Fires the workflow on a recurring schedule to process the full client database automatically. Serves as the primary production trigger.
- **Inputs**: None (time-based trigger).
- **Outputs**: Passes a trigger event to `Read BASE_DE_DATOS Clientes1`, initiating the scheduled scan.
- **Key configuration**: Schedule interval (exact cron/interval not exposed in node list; typical configuration is daily or weekly during business hours).
- **Notes**: This trigger runs the full loop over all clients. For single-company on-demand scans, use `Webhook Radar B2B` instead.

---

### Webhook Radar B2B
- **Type**: `n8n-nodes-base.webhook`
- **Node ID**: `webhook-radar-b2b-scan`
- **Purpose**: Accepts an HTTP POST request to trigger a scan for a single company on demand, bypassing the full scheduled loop.
- **Inputs**: HTTP POST body containing company data (empresa, pais, sector, linea_negocio, tier, etc.).
- **Outputs**: Routes to `Read BASE_DE_DATOS Clientes` (the secondary read node) or directly into the loop with the single item.
- **Key configuration**: Webhook path set to a unique URL slug. Responds immediately or after processing depending on response mode setting.
- **Notes**: Used for real-time B2B scanning from external triggers (e.g., CRM events, manual Slack commands). Ensure the webhook URL is kept private as it contains no authentication by default.

---

## Group 2: Data Preparation

### Read BASE_DE_DATOS Clientes1
- **Type**: `n8n-nodes-base.googleSheets`
- **Node ID**: `61edcfa0-c60a-4e68-9219-c897221e6ded`
- **Purpose**: Reads the full client/prospect database from Google Sheets. This is the master data source for the scheduled run.
- **Inputs**: Trigger from `Schedule Trigger1`.
- **Outputs**: Array of rows (one per company) passed to `Loop Over Items1`.
- **Key configuration**: Sheet ID `13C6RJPORu6CPqr1iL0zXU-gUi3eTV-eYo8i-IV9K818` (BASE_DE_DATOS). Operation: `getAll`. Reads columns: empresa, pais, sector, linea_negocio, tier, palabras_clave, and others.
- **Notes**: This is the scheduled-run version. The webhook-run version uses `Read BASE_DE_DATOS Clientes` (no suffix "1"). Both read the same sheet.

---

### Read BASE_DE_DATOS Clientes
- **Type**: `n8n-nodes-base.googleSheets`
- **Node ID**: `5f069df8-346d-42d9-a6fa-41aa43120829`
- **Purpose**: Secondary client database reader, used in the webhook-triggered path.
- **Inputs**: Trigger from `Webhook Radar B2B`.
- **Outputs**: Company data passed into the processing loop.
- **Key configuration**: Same sheet ID as `Read BASE_DE_DATOS Clientes1`. Identical operation settings.
- **Notes**: Kept as a separate node to allow independent configuration of the webhook path (e.g., filtering to a single company by webhook body parameters).

---

### Read BASE_DE_DATOS Clientes2
- **Type**: `n8n-nodes-base.googleSheets`
- **Node ID**: `eec1982a-e460-402a-93dc-8c3484c57dd9`
- **Purpose**: Third instance of the client database reader, used in a secondary branch or fallback path within the workflow.
- **Inputs**: Upstream branch (likely post-loop or error recovery path).
- **Outputs**: Additional company rows for processing.
- **Key configuration**: Same sheet configuration as the other two reader nodes.
- **Notes**: Verify this node is still actively used in v9.0. It may be a legacy node from an older flow structure.

---

### Loop Over Items1
- **Type**: `n8n-nodes-base.splitInBatches`
- **Node ID**: `fc236dca-9a5d-4005-ba4f-134d9e507088`
- **Purpose**: Iterates over each company from the database one at a time, processing them sequentially through the radar pipeline.
- **Inputs**: Array of company rows from `Read BASE_DE_DATOS Clientes1` or `Read BASE_DE_DATOS Clientes`.
- **Outputs**: Two outputs — (1) current item passed downstream to `Buscar Tavily General1`, (2) loop-done signal when all items are processed.
- **Key configuration**: Batch size = 1 (processes one company per iteration). Loop-done output typically triggers a summary or simply ends the workflow.
- **Notes**: All downstream nodes reference `$('Loop Over Items1').item.json` to access the current company's data. This is the critical context reference throughout the pipeline.

---

### Read Existing1
- **Type**: `n8n-nodes-base.googleSheets`
- **Node ID**: `5aedf615-a272-4453-bcf3-9a06557718a5`
- **Purpose**: Reads the existing results log before writing, used to check for duplicate entries or to retrieve the current state of a company's record.
- **Inputs**: Triggered from the loop or a pre-write preparation step.
- **Outputs**: Existing row data passed to a merge/deduplication node.
- **Key configuration**: Sheet ID `1rtFoTi3ZwNHi9RBidFGcxOHtK6lOvCuhebUB1eS-MGo` (Log_Radar_Clients_db). Lookup by empresa name.
- **Notes**: Used to implement upsert logic — update if the company already has a row, append if new.

---

### Formatear Contexto1
- **Type**: `n8n-nodes-base.code`
- **Node ID**: `5a0a0dcb-5c82-4f70-b2fb-8a61eeafd7b8`
- **Purpose**: Prepares and formats the company context object before passing it to the AI Agent. Cleans field names, sets defaults for missing values, and structures the data for the prompt.
- **Inputs**: Current company item from the loop.
- **Outputs**: Formatted context object with normalized fields (empresa, pais, sector, linea_negocio, tier, palabras_clave, etc.).
- **Key configuration**: JavaScript code that maps raw sheet columns to standardized field names. Sets `sector = 'No especificado'` when blank.
- **Notes**: Failing to normalize here causes the AI prompt expressions (e.g., `{{ $('Loop Over Items1').item.json.sector || 'No especificado' }}`) to produce undefined values.

---

### Code in JavaScript1
- **Type**: `n8n-nodes-base.code`
- **Node ID**: `c00a5cfb-c3c3-4ccd-bf01-260efbecd0e3`
- **Purpose**: General-purpose JavaScript transformation node. Likely used for data reshaping or intermediate processing in a specific branch of the workflow.
- **Inputs**: Data from an upstream node in the main processing chain.
- **Outputs**: Transformed data array passed to the next step.
- **Key configuration**: JavaScript code (specific logic depends on position in flow; likely handles JSON parsing, field extraction, or array manipulation).
- **Notes**: Review exact code in n8n editor to confirm current purpose — generic node name makes tracking harder.

---

### Code in JavaScript4
- **Type**: `n8n-nodes-base.code`
- **Node ID**: `e976942a-14fb-4ff5-b8f3-c1d260a6a754`
- **Purpose**: Processes and restructures the AI Agent's raw JSON output before validation and formatting steps.
- **Inputs**: Raw AI Agent response (string or parsed JSON).
- **Outputs**: Structured object with all radar fields extracted and sanitized.
- **Key configuration**: Parses `output` field from AI Agent, handles both clean JSON and markdown-wrapped JSON (strips ```json fences). Sets fallback empty string for `motivo_descarte` if missing.
- **Notes**: Critical node — if AI returns malformed JSON, this node must catch and handle it gracefully to avoid breaking the loop.

---

### Code in JavaScript5
- **Type**: `n8n-nodes-base.code`
- **Node ID**: `6d9006e0-6a39-482a-8fbd-7cb99cf6e243`
- **Purpose**: Secondary JavaScript processing step, likely performing additional field calculations (e.g., score normalization, date formatting, or enrichment of output fields).
- **Inputs**: Partially processed radar output.
- **Outputs**: Enriched data passed to `Format Final Columns1`.
- **Key configuration**: May compute derived fields such as `fecha_ejecucion`, `semana_radar`, or URL-formatted source links.
- **Notes**: Check for hardcoded date formats; these can break when locale changes.

---

### Normalizar Linea
- **Type**: `n8n-nodes-base.code`
- **Node ID**: `klfkuxgrhy`
- **Purpose**: Normalizes the `linea_negocio` field value to a canonical lowercase string so the downstream `Switch` node can route correctly.
- **Inputs**: Formatted result data containing `linea_negocio`.
- **Outputs**: Same data object with `linea_negocio_normalized` field set to one of: `"bhs"`, `"carton"`, or `"intralogistica"`.
- **Key configuration**: String normalization — strips accents, lowercases, trims whitespace. Handles variants like "Cartón", "CARTON", "carton ondulado".
- **Notes**: Added in v9.0 to replace chained `if-bhs` / `if-carton` nodes with cleaner Switch routing. Ensure all possible input values from the database are mapped.

---

### Format Final Columns1
- **Type**: `n8n-nodes-base.set`
- **Node ID**: `0a562839-484f-4602-97a3-407aa88a8212`
- **Purpose**: Maps all intermediate fields to the final column names expected by the Google Sheets log schema. Sets every output column explicitly.
- **Inputs**: Processed and enriched data object from `Code in JavaScript5`.
- **Outputs**: Final structured row ready for Google Sheets append. Also branches to `Formatear para Vector1` for Pinecone storage.
- **Key configuration**: Set node with ~20+ field mappings. Key fields: empresa_evaluada, linea_negocio, tipo_senal, score_prom, ventana_compra, radar_activo, motivo_descarte, fuente_principal, url_fuente, resumen_ejecutivo, fecha_ejecucion, tier.
- **Notes**: Bug fixed in v9.0 — previously `Formatear para Vector1` was not connected here, causing Pinecone writes to be skipped entirely.

---

### Preparar Log Cero Señales1
- **Type**: `n8n-nodes-base.set`
- **Node ID**: `prep-cero-senales-node`
- **Purpose**: Prepares a minimal log row for companies where the AI found absolutely no investment signal, so that the zero-signal result is still recorded for tracking.
- **Inputs**: AI output where `tipo_senal = "Sin Señal"` or `score_prom = 0`.
- **Outputs**: Minimal row passed to `Log Cero Señales1`.
- **Key configuration**: Sets: empresa, fecha_ejecucion, radar_activo = "No", motivo_descarte (required), tipo_senal = "Sin Señal", score_prom = 0.
- **Notes**: `motivo_descarte` is MANDATORY in this path — leaving it empty violates the output schema and causes downstream sheet errors.

---

### Fusionar Búsquedas1
- **Type**: `n8n-nodes-base.code`
- **Node ID**: `fusionar-busquedas-1`
- **Purpose**: Merges the results from the two Tavily searches (`Buscar Tavily General1` and `Buscar Fuentes Primarias1`) into a single consolidated search results object.
- **Inputs**: Two branches — general Tavily results and primary-source Tavily results.
- **Outputs**: Merged `organic` array and combined `tavily_answer` passed to `AI Agent RADAR1`.
- **Key configuration**: JavaScript merge logic that deduplicates URLs, concatenates organic result arrays, and combines answer summaries. Limits total results to top 10-12 to avoid prompt overflow.
- **Notes**: Deduplication by URL is critical — the same article can appear in both searches and would waste prompt tokens if duplicated.

---

### Fusionar Resultado Validación1
- **Type**: `n8n-nodes-base.code`
- **Node ID**: `d9a20d81-5277-4b46-804e-937f80a8c327`
- **Purpose**: Merges the original AI radar analysis with the secondary validator agent's decision, producing a unified record with both the primary score and validation outcome.
- **Inputs**: Original radar result + `AI Agente Validador1` response.
- **Outputs**: Merged object with fields: all original radar fields + `validacion_ia`, `score_validador`, `notas_validacion`.
- **Key configuration**: JavaScript merge — validator fields are appended without overwriting primary analysis. If validator disagrees, both scores are preserved.
- **Notes**: Preserve the original `score_prom` — do not let the validator overwrite it, only annotate it.

---

## Group 3: Loop & Flow Control

### Wait1
- **Type**: `n8n-nodes-base.wait`
- **Node ID**: `81f3e7ba-8b5c-4616-a1fa-1a97f7d09c9a`
- **Purpose**: Introduces a configurable delay between company iterations to avoid rate-limiting on Tavily and OpenAI APIs.
- **Inputs**: End of one loop iteration (after writing outputs).
- **Outputs**: Triggers `Loop Over Items1` to advance to the next company.
- **Key configuration**: Wait duration typically set to 2–5 seconds. Configured as a fixed interval (not a webhook resume).
- **Notes**: Bug fixed in v3 — previously a `Replace Me` placeholder node existed here, which broke the loop. Now connects cleanly: end of iteration → Wait1 → Loop Over Items1.

---

### Es Oportunidad ORO?1
- **Type**: `n8n-nodes-base.if`
- **Node ID**: `c47e03b2-a47e-4c3b-9e9d-77434ba56c54`
- **Purpose**: Checks if the validated opportunity scores as "gold tier" — highest-priority opportunities that warrant an immediate email alert to the commercial team.
- **Inputs**: Approved, formatted radar result from `¿Aprobado IA?1` YES branch.
- **Outputs**: YES → `Send a message1` (Gmail alert); NO → skips alert, continues to storage.
- **Key configuration**: Condition: `score_prom >= 75` AND `radar_activo = "Sí"` (or equivalent gold-tier threshold). May also check `tier = "VIP"`.
- **Notes**: Bug fixed in v3 — this node was disconnected and never triggered. Now correctly wired from `¿Aprobado IA?1`.

---

### ¿Borderline?1
- **Type**: `n8n-nodes-base.if`
- **Node ID**: `3e3cb94f-a9bf-489e-99dd-5af05de5a8da`
- **Purpose**: Determines if the primary AI Agent's score falls in the "borderline" range that requires secondary validation by `AI Agente Validador1`.
- **Inputs**: Primary radar result from `Code in JavaScript4`.
- **Outputs**: YES (borderline) → `AI Agente Validador1`; NO (clear pass/fail) → directly to `¿Aprobado IA?1`.
- **Key configuration**: Condition: `score_prom >= 35 AND score_prom < 65` (approximate borderline range). Exact thresholds should be verified in the n8n editor.
- **Notes**: This two-agent architecture reduces false positives by having a second LLM review ambiguous cases before they are logged.

---

### ¿Aprobado IA?1
- **Type**: `n8n-nodes-base.if`
- **Node ID**: `eb99fe08-b080-4e0a-86e5-41d0c305bf18`
- **Purpose**: Final gate that decides whether the radar result meets the minimum threshold to be logged as an actionable opportunity.
- **Inputs**: Final validated result (from `Fusionar Resultado Validación1` for borderline cases, or directly from analysis for clear cases).
- **Outputs**: YES → `Es Oportunidad ORO?1` → storage pipeline; NO → `¿No Observado?1`.
- **Key configuration**: Condition: `radar_activo = "Sí"` OR `score_prom >= threshold` (e.g., 40). May use compound condition.
- **Notes**: This is the critical quality gate. Only opportunities passing this check flow into the production sheets.

---

### ¿No Observado?1
- **Type**: `n8n-nodes-base.if`
- **Node ID**: `7d0a2779-02d8-4147-ae06-68879076fd85`
- **Purpose**: Secondary branch after a rejected opportunity — distinguishes between "no signal found" (zero results) and "signal found but scored too low" (discard with reason).
- **Inputs**: Rejected result from `¿Aprobado IA?1` NO branch.
- **Outputs**: YES (truly no signal) → `Preparar Log Cero Señales1`; NO (low score) → `Log Validación1` for QA tracking.
- **Key configuration**: Condition: `tipo_senal = "Sin Señal"` or `score_prom = 0`.
- **Notes**: Ensures even rejected results are categorized properly for pipeline analytics.

---

### if-bhs
- **Type**: `n8n-nodes-base.if`
- **Node ID**: `hjzsw2x2c6`
- **Purpose**: Legacy routing node that checked if `linea_negocio = "BHS"`. Superseded by `Switch` node in v9.0 but may still exist in the flow as a fallback.
- **Inputs**: Normalized result data.
- **Outputs**: YES → BHS storage; NO → pass to `if-carton`.
- **Key configuration**: Condition: `linea_negocio` contains "BHS" (case-insensitive).
- **Notes**: Check if still active in v9.0 — if `Switch` handles all routing, this node should be disabled to avoid duplicate writes.

---

### if-carton
- **Type**: `n8n-nodes-base.if`
- **Node ID**: `8jvc6qzaou`
- **Purpose**: Legacy routing node that checked if `linea_negocio = "Cartón"`. Superseded by `Switch` node.
- **Inputs**: NO branch from `if-bhs`.
- **Outputs**: YES → Cartón storage; NO → Intralogística storage (implied default).
- **Key configuration**: Condition: `linea_negocio` contains "Cartón" or "Carton".
- **Notes**: Same as `if-bhs` — verify if still active alongside the new `Switch` node.

---

### Switch
- **Type**: `n8n-nodes-base.switch`
- **Node ID**: `5d957e0a-c28a-4a35-bef0-b7bad652fbb3`
- **Purpose**: Routes approved opportunities to the correct business-line storage nodes based on normalized `linea_negocio` value.
- **Inputs**: Normalized result data from `Normalizar Linea`.
- **Outputs**: Three branches — (1) `linea_negocio_normalized = "bhs"` → BHS storage nodes; (2) `"carton"` → Cartón storage nodes; (3) `"intralogistica"` → Intralogística storage nodes.
- **Key configuration**: Switch mode: expression-based. Three output branches with string equality conditions on `linea_negocio_normalized`.
- **Notes**: Added in v9.0 to replace chained IF nodes. Cleaner and more maintainable. Requires `Normalizar Linea` to run first.

---

## Group 4: Search & Enrichment

### Buscar Tavily General1
- **Type**: `n8n-nodes-base.httpRequest`
- **Node ID**: `2923cf11-99d1-45bd-b201-369ded8eb03a`
- **Purpose**: Performs the primary web search via Tavily API using general investment-related keywords for the current company.
- **Inputs**: Current company item from `Loop Over Items1` (empresa, pais, sector, palabras_clave).
- **Outputs**: Tavily search results (organic links + AI answer summary) passed to `Fusionar Búsquedas1`.
- **Key configuration**: POST to `https://api.tavily.com/search`. Headers: `Authorization: tvly-dev-1mwJjN-...`. Body: `{ query: "[empresa] [pais] inversión CAPEX expansión 2025 2026", search_depth: "advanced", max_results: 8, include_answer: true }`. Query dynamically built from loop context.
- **Notes**: This is the PRIMARY search — was disconnected in v2 and has been the main fix since v3. `include_answer: true` provides the `tavily_answer` summary used in the AI prompt header.

---

### Buscar Fuentes Primarias1
- **Type**: `n8n-nodes-base.httpRequest`
- **Node ID**: `buscar-fuentes-primarias-1`
- **Purpose**: Performs a second targeted Tavily search focused specifically on high-authority primary sources: BNAmericas, SECOP, Aerocivil, and official corporate portals.
- **Inputs**: Current company item from `Loop Over Items1`.
- **Outputs**: Primary-source Tavily results passed to `Fusionar Búsquedas1`.
- **Key configuration**: POST to `https://api.tavily.com/search`. Query format: `site:bnamericas.com OR site:secop.gov.co OR site:aerocivil.gov.co [empresa] inversión licitación`. `search_depth: "advanced"`, `max_results: 5`.
- **Notes**: Added to improve source quality scoring. Results from BNAmericas or SECOP automatically add +25 points (fuente oficial) to the PROM scoring. Running this in parallel with the general search maximizes recall.

---

## Group 5: AI Analysis

### AI Agent RADAR1
- **Type**: `@n8n/n8n-nodes-langchain.agent`
- **Node ID**: `273ab376-055e-463f-bd12-5a2b61a4c3ad`
- **Purpose**: The core intelligence node. Analyzes merged Tavily search results and produces a structured JSON radar assessment for the current company.
- **Inputs**: Merged search results from `Fusionar Búsquedas1`; company context from `Loop Over Items1`; system prompt from `Structured Output Parser1`.
- **Outputs**: Structured JSON output containing all PROM radar fields, passed to `Code in JavaScript4`.
- **Key configuration**:
  - `promptType: "define"` (custom prompt)
  - Model: `OpenAI Chat Model` (gpt-4.1-mini)
  - Memory: `Postgres Chat Memory1` (session RadarV6)
  - Output parser: `Structured Output Parser1`
  - Prompt includes: empresa, pais, sector, linea_negocio, tier, fecha actual, Tavily answer, Tavily organic results (top 8)
  - Explicit instruction: "Evalúa FECHA DEL PROYECTO (no de la noticia)"
  - Output schema: empresa_evaluada, linea_negocio, tipo_senal, score_prom (0-100), ventana_compra, radar_activo, motivo_descarte, fuente_principal, tipo_fuente, url_fuente, resumen_ejecutivo, monto_capex, moneda, pais_proyecto
- **Notes**: `motivo_descarte` is declared MANDATORY when `radar_activo = "No"`. The prompt enumerates all valid enum values for tipo_senal, tipo_fuente, and ventana_compra to constrain hallucination. This is the highest-cost node in the workflow (GPT-4.1-mini per call).

---

### OpenAI Chat Model
- **Type**: `@n8n/n8n-nodes-langchain.lmChatOpenAi`
- **Node ID**: `006456a5-381d-4d0f-8859-f714811d5ed5`
- **Purpose**: The LLM sub-node powering `AI Agent RADAR1`. Configures the OpenAI model, temperature, and API credentials.
- **Inputs**: Sub-node input from `AI Agent RADAR1` (langchain tool binding).
- **Outputs**: LLM completions back to `AI Agent RADAR1`.
- **Key configuration**: Model: `gpt-4.1-mini`. Temperature: `0.1` (low for deterministic structured output). Max tokens: likely 1500–2000. Credentials: OpenAI API key.
- **Notes**: Low temperature is critical for consistent JSON output. Increasing temperature causes JSON structure violations.

---

### Structured Output Parser1
- **Type**: `@n8n/n8n-nodes-langchain.outputParserStructured`
- **Node ID**: `79c9a11a-5c95-4fea-9a6c-0b3229444560`
- **Purpose**: Enforces a strict JSON schema on the AI Agent's output, ensuring all required fields are present and correctly typed.
- **Inputs**: Sub-node binding to `AI Agent RADAR1`.
- **Outputs**: Validated, schema-compliant JSON object.
- **Key configuration**: Zod/JSON schema with required fields: empresa_evaluada (string), linea_negocio (string), tipo_senal (enum), score_prom (number 0-100), ventana_compra (enum), radar_activo (enum: "Sí"/"No"), motivo_descarte (string), fuente_principal (string), tipo_fuente (enum), url_fuente (string), resumen_ejecutivo (string), monto_capex (number or null), moneda (string), pais_proyecto (string).
- **Notes**: If the AI returns malformed output, this parser throws an error and the node retries. Ensure retry count is set to at least 2.

---

### Postgres Chat Memory1
- **Type**: `@n8n/n8n-nodes-langchain.memoryPostgresChat`
- **Node ID**: `c3b227de-4986-4123-ac91-804eb0b9387e`
- **Purpose**: Provides conversational memory for the AI Agent using a Postgres database, storing and retrieving the chat history for the current session.
- **Inputs**: Sub-node binding to `AI Agent RADAR1`.
- **Outputs**: Historical context injected into each LLM call.
- **Key configuration**: Session ID: `RadarV6`. Postgres credentials configured. Stores recent N messages (likely last 10–20 exchanges).
- **Notes**: Memory session name must remain `RadarV6` to maintain continuity across workflow runs. Changing this resets all accumulated context.

---

### AI Agente Validador1
- **Type**: `@n8n/n8n-nodes-langchain.agent`
- **Node ID**: `a98e3f16-5a1d-4c87-80ad-e8d12420390f`
- **Purpose**: Secondary validation agent that independently reviews borderline-scored opportunities, providing a second opinion before they are accepted or rejected.
- **Inputs**: Company data + primary radar result from `¿Borderline?1` YES branch.
- **Outputs**: Validation decision (approve/reject + reasoning) to `Fusionar Resultado Validación1`.
- **Key configuration**: Model: `OpenAI Chat Model (Validador)1` (gpt-4.1-mini). Output parser: `Structured Output Parser (Val)1`. Prompt focuses on: "¿Tiene esta señal evidencia suficiente para justificar una acción comercial en los próximos 6-24 meses?"
- **Notes**: This double-agent architecture was introduced to reduce false positives on borderline scores (35-65 range). The validator has a stricter prompt that requires concrete evidence.

---

### OpenAI Chat Model (Validador)1
- **Type**: `@n8n/n8n-nodes-langchain.lmChatOpenAi`
- **Node ID**: `8e7a89ba-6990-4d77-8a33-d65361592c9e`
- **Purpose**: LLM sub-node powering the secondary `AI Agente Validador1`.
- **Inputs**: Sub-node binding from `AI Agente Validador1`.
- **Outputs**: LLM completions back to validator agent.
- **Key configuration**: Model: `gpt-4.1-mini`. Temperature: `0.0` (stricter than primary — deterministic validation). Same OpenAI credentials.
- **Notes**: Temperature 0.0 for maximum consistency in pass/fail decisions.

---

### Structured Output Parser (Val)1
- **Type**: `@n8n/n8n-nodes-langchain.outputParserStructured`
- **Node ID**: `c12e47ea-0bf1-4320-906a-f54e335f78d8`
- **Purpose**: Enforces JSON schema on the validator agent's output.
- **Inputs**: Sub-node binding from `AI Agente Validador1`.
- **Outputs**: Validated JSON: `{ validacion_ia: "Aprobado"|"Rechazado", score_validador: number, notas_validacion: string }`.
- **Key configuration**: Minimal schema — three fields only. Keeps validator output lightweight.
- **Notes**: `notas_validacion` should always be populated — an empty rejection note is a sign the LLM is not reasoning properly.

---

### Validador de Fuentes1
- **Type**: `n8n-nodes-base.code`
- **Node ID**: `9d83e2a2-d7a8-4e8f-98d0-4fe9c58846e0`
- **Purpose**: Rule-based pre-validation of the search results before they reach the AI Agent. Checks that at least one credible source was found; flags cases where only low-quality sources (rumors, LinkedIn only) are available.
- **Inputs**: Merged Tavily results from `Fusionar Búsquedas1`.
- **Outputs**: Enriched results object with `calidad_fuentes` score and `tiene_fuente_oficial` boolean flag.
- **Key configuration**: JavaScript rules: checks URL domains against a whitelist (bnamericas.com, secop.gov.co, aerocivil.gov.co, company official sites). Sets `calidad_fuentes = "alta" | "media" | "baja"`.
- **Notes**: This deterministic check runs before the expensive LLM call, saving tokens on clearly low-quality data batches.

---

## Group 6: Output & Storage

### HTML1
- **Type**: `n8n-nodes-base.html`
- **Node ID**: `fb5b7bb7-c3fd-47a3-b3ec-ad964bd5b21d`
- **Purpose**: Generates an HTML-formatted email body for gold-opportunity alerts, rendering the radar result data in a clean, readable format for the commercial team.
- **Inputs**: Gold-tier approved opportunity data from `Es Oportunidad ORO?1` YES branch.
- **Outputs**: HTML string passed to `Send a message1` (Gmail).
- **Key configuration**: HTML template with inline CSS. Renders: empresa, tipo_senal, score_prom, ventana_compra, resumen_ejecutivo, url_fuente, monto_capex.
- **Notes**: Keep the HTML simple and Gmail-compatible (no external CSS frameworks, no JavaScript). Test rendering across email clients.

---

### Send a message1
- **Type**: `n8n-nodes-base.gmail`
- **Node ID**: `c8d5bb9f-8eb3-4f17-a517-1ab875764fa2`
- **Purpose**: Sends the gold-opportunity HTML alert email via Gmail to the commercial team (Felipe Gaviria, Paola Vaquero, Mariana, Natalia).
- **Inputs**: HTML body from `HTML1`.
- **Outputs**: Email sent confirmation (used for logging only).
- **Key configuration**: From: `yotubegeneric@gmail.com` (DEVELOPMENT — change to production email before go-live). Subject: `🟡 Oportunidad ORO Detectada: [empresa] — PROM Score [score]`. Recipients: commercial team distribution list.
- **Notes**: EMAIL ADDRESS MUST BE UPDATED TO PRODUCTION before full deployment. Currently using a development Gmail account.

---

### Log Cliente1
- **Type**: `n8n-nodes-base.googleSheets`
- **Node ID**: `7d353aaf-2b27-469e-b145-dd43f413205b`
- **Purpose**: Appends or updates the central radar log with every processed company result, regardless of score outcome (for approved opportunities).
- **Inputs**: Final formatted row from `Format Final Columns1`.
- **Outputs**: Row written to Google Sheets log.
- **Key configuration**: Sheet ID `1rtFoTi3ZwNHi9RBidFGcxOHtK6lOvCuhebUB1eS-MGo` (Log_Radar_Clients_db). Operation: append or update by empresa + fecha. All final columns mapped.
- **Notes**: This is the master log. All other Sheet/Excel writes are line-specific subsets.

---

### Append Resultados BHS
- **Type**: `n8n-nodes-base.googleSheets`
- **Node ID**: `fa018442-9082-4f51-8f85-0d78e01c3585`
- **Purpose**: Appends BHS-line radar results to the dedicated BHS tab in Google Sheets.
- **Inputs**: Approved BHS opportunity from `Switch` BHS branch.
- **Outputs**: Row appended to BHS results sheet.
- **Key configuration**: Operation: append. Tab: "BHS" or equivalent. Same sheet ID as master log or a separate BHS-specific sheet.
- **Notes**: Runs in parallel with Excel writes for BHS. Verify sheet tab name matches exactly.

---

### Append Resultados Cartón
- **Type**: `n8n-nodes-base.googleSheets`
- **Node ID**: `carton-kfoiq0to`
- **Purpose**: Appends Cartón-line radar results to the dedicated Cartón tab in Google Sheets.
- **Inputs**: Approved Cartón opportunity from `Switch` Cartón branch.
- **Outputs**: Row appended to Cartón results sheet.
- **Key configuration**: Operation: append. Tab: "Cartón". Same sheet infrastructure as BHS.
- **Notes**: The ó character in tab names can cause encoding issues — ensure tab name is exact.

---

### Append Resultados Intralogística
- **Type**: `n8n-nodes-base.googleSheets`
- **Node ID**: `intra-8vhmdgs1`
- **Purpose**: Appends Intralogística-line radar results to the dedicated Intralogística tab in Google Sheets.
- **Inputs**: Approved Intralogística opportunity from `Switch` Intralogística branch.
- **Outputs**: Row appended to Intralogística results sheet.
- **Key configuration**: Operation: append. Tab: "Intralogística". Same sheet infrastructure.
- **Notes**: Same encoding caution as Cartón for the í character.

---

### Log Cero Señales1
- **Type**: `n8n-nodes-base.googleSheets`
- **Node ID**: `log-cero-senales-node`
- **Purpose**: Logs companies where no investment signal was found, providing a record that the company was scanned with no results (vs. never scanned).
- **Inputs**: Prepared zero-signal row from `Preparar Log Cero Señales1`.
- **Outputs**: Row appended to a "Cero Señales" tab or log sheet.
- **Key configuration**: Minimal columns: empresa, fecha_ejecucion, motivo_descarte, tipo_senal = "Sin Señal".
- **Notes**: This log is critical for pipeline health monitoring — a spike in zero-signal entries may indicate Tavily API issues or stale keyword configurations.

---

### Log Validación1
- **Type**: `n8n-nodes-base.googleSheets`
- **Node ID**: `8c9006a2-1ccb-4e5b-bf93-5d0b4d7ebac2`
- **Purpose**: Logs QA failures and rejected borderline opportunities for review, enabling manual audit of the validator's decisions.
- **Inputs**: Rejected results from `¿No Observado?1` NO branch (scored but rejected by QA threshold).
- **Outputs**: Row appended to validation log sheet.
- **Key configuration**: Columns include: empresa, score_prom, score_validador, validacion_ia, notas_validacion, tipo_senal, motivo_descarte, fecha_ejecucion.
- **Notes**: Bug fixed in v3 — this node was disabled. Now enabled with proper Google Sheets credentials. Review this log weekly to calibrate scoring thresholds.

---

### Append or update a sheet
- **Type**: `n8n-nodes-base.microsoftExcel`
- **Node ID**: `dac967aa-028a-464e-8a2d-1825f51630f0`
- **Purpose**: General Microsoft Excel append/update node — likely the base template from which the specialized Excel nodes were derived.
- **Inputs**: Formatted result data.
- **Outputs**: Row written to Excel file.
- **Key configuration**: OneDrive/SharePoint Excel file path. Sheet tab and column mapping.
- **Notes**: Check if this node is still active or if it has been replaced by the specialized named Excel nodes below.

---

### Append or update AEROPUERTOS FINAL
- **Type**: `n8n-nodes-base.microsoftExcel`
- **Node ID**: `870fc895-69b3-4346-a85f-159dfc7bf60a`
- **Purpose**: Writes BHS airport-related radar results to the "AEROPUERTOS FINAL" Excel file, the primary deliverable for the BHS commercial team.
- **Inputs**: BHS branch result (passenger terminals, cargo terminals).
- **Outputs**: Row appended/updated in AEROPUERTOS FINAL workbook.
- **Key configuration**: Excel file: AEROPUERTOS FINAL.xlsx (OneDrive). Sheet: main tab. Key columns: empresa, aeropuerto, pais, tipo_senal, score_prom, ventana_compra, monto_capex, url_fuente.
- **Notes**: This is the main deliverable file viewed by the commercial BHS team. Column order must match the agreed template exactly.

---

### Append or update CARGO LATAM
- **Type**: `n8n-nodes-base.microsoftExcel`
- **Node ID**: `7a3e9eea-6a3f-47f7-ba9d-df18d4b4c634`
- **Purpose**: Writes cargo/freight terminal BHS signals to the "CARGO LATAM" Excel tracking file.
- **Inputs**: BHS branch result filtered for cargo-type opportunities.
- **Outputs**: Row written to CARGO LATAM.xlsx.
- **Key configuration**: Similar to AEROPUERTOS FINAL but for cargo terminal sub-segment.
- **Notes**: Cargo opportunities are a subset of BHS — ensure the routing from Switch correctly separates passenger vs. cargo terminals if needed.

---

### Append or update CARTON Y PAPEL
- **Type**: `n8n-nodes-base.microsoftExcel`
- **Node ID**: `d90e18cc-9300-439e-b37b-2deb0a54313c`
- **Purpose**: Writes corrugated cardboard and paper plant investment signals to the "CARTON Y PAPEL" Excel file.
- **Inputs**: Cartón branch result from Switch.
- **Outputs**: Row written to CARTON Y PAPEL.xlsx.
- **Key configuration**: Excel file: CARTON Y PAPEL.xlsx. Columns aligned with cartón/papel industry-specific fields.
- **Notes**: Cartón line targets corrugated plants, packaging lines, and ondulado production expansions.

---

### Append or update MOTOS LATAM
- **Type**: `n8n-nodes-base.microsoftExcel`
- **Node ID**: `cbac5ea1-876e-413b-8a5e-cbb0d021a5a7`
- **Purpose**: Writes motorcycle assembly / distribution center signals to the "MOTOS LATAM" Excel file — a sub-segment within Intralogística.
- **Inputs**: Intralogística branch result filtered for automotive/motorcycle manufacturing.
- **Outputs**: Row written to MOTOS LATAM.xlsx.
- **Key configuration**: Excel file: MOTOS LATAM.xlsx.
- **Notes**: Motorcycle assembly plants are an Intralogística sub-segment (CEDI + conveyor lines for final assembly). Ensure keywords include "ensamble", "planta de motos", "distribución".

---

### Append or update FINAL DE LINEA
- **Type**: `n8n-nodes-base.microsoftExcel`
- **Node ID**: `4fbc3016-b708-417a-8420-46e05d44a8c7`
- **Purpose**: Writes end-of-line automation and packaging signals to the "FINAL DE LINEA" Excel file.
- **Inputs**: Intralogística or Cartón branch result for end-of-line automation opportunities.
- **Outputs**: Row written to FINAL DE LINEA.xlsx.
- **Key configuration**: Excel file: FINAL DE LINEA.xlsx.
- **Notes**: End-of-line refers to palletizers, stretch wrappers, case packers — crossover between Cartón and Intralogística lines.

---

### Append or update SOLUMAT
- **Type**: `n8n-nodes-base.microsoftExcel`
- **Node ID**: `c4e7d21c-c840-4f77-b54d-96323d3800b8`
- **Purpose**: Writes opportunities relevant to SOLUMAT (a specific product or sub-brand within Matec's portfolio) to a dedicated Excel file.
- **Inputs**: Filtered result matching SOLUMAT criteria.
- **Outputs**: Row written to SOLUMAT.xlsx.
- **Key configuration**: Excel file: SOLUMAT.xlsx. Specific filtering criteria for what constitutes a SOLUMAT opportunity.
- **Notes**: Clarify with the commercial team what "SOLUMAT" refers to — ensure the Switch or IF routing correctly identifies these opportunities.

---

### Guardar en Memoria (Pinecone)1
- **Type**: `@n8n/n8n-nodes-langchain.vectorStorePinecone`
- **Node ID**: `e4458729-7bc7-4a5c-825e-a7ff9c0e1ddd`
- **Purpose**: Stores the processed radar result as a vector embedding in Pinecone for long-term RAG memory, enabling future queries about past analyses.
- **Inputs**: Formatted document from `Preparar Datos (Loader)1` (connected from `Formatear para Vector1`).
- **Outputs**: Vector upsert confirmation.
- **Key configuration**: Pinecone index: `matec-radar`. Namespace: `proyectos_2026`. Embeddings via `Embeddings OpenAI1`. Document metadata: empresa, linea_negocio, score_prom, fecha_ejecucion, tipo_senal.
- **Notes**: Bug fixed in v3/v9 — `Formatear para Vector1` was disconnected, meaning nothing was stored in Pinecone. Now connected from `Format Final Columns1`. Verify namespace matches the Pinecone index configuration.

---

### Pinecone Vector Store
- **Type**: `@n8n/n8n-nodes-langchain.vectorStorePinecone`
- **Node ID**: `3b319fab-d0c4-4db3-a57a-d5e0c5f3dc5a`
- **Purpose**: Secondary Pinecone node, possibly used for retrieval (RAG query) rather than storage — fetching similar past analyses to provide context to the AI Agent.
- **Inputs**: Query embedding for similarity search.
- **Outputs**: Top-K similar past radar results returned to AI Agent context.
- **Key configuration**: Same index `matec-radar`, namespace `proyectos_2026`. Retrieval mode (not upsert). Top-K: likely 3–5 results.
- **Notes**: Distinguish clearly between `Guardar en Memoria (Pinecone)1` (write) and this node (read). Having both in the workflow enables a full RAG loop.

---

### Formatear para Vector1
- **Type**: `n8n-nodes-base.code`
- **Node ID**: `680bbb3a-226d-4e69-b4a6-12cc0fd93f95`
- **Purpose**: Converts the final formatted radar result into the document format required by Pinecone, building the text content and metadata object for vector storage.
- **Inputs**: Final formatted row from `Format Final Columns1`.
- **Outputs**: Document object `{ pageContent: string, metadata: object }` passed to `Preparar Datos (Loader)1`.
- **Key configuration**: Builds `pageContent` as a summary string: `"[empresa] | [tipo_senal] | Score: [score_prom] | [resumen_ejecutivo]"`. Metadata includes all key fields for filtering.
- **Notes**: Bug fixed in v3 — was not connected. Critical for maintaining the RAG memory system.

---

### Preparar Datos (Loader)1
- **Type**: `@n8n/n8n-nodes-langchain.documentDefaultDataLoader`
- **Node ID**: `7efd9721-f8ca-4a52-b9cb-4d915bec4b74`
- **Purpose**: Loads the formatted document into the LangChain document format required by the Pinecone vector store ingestion pipeline.
- **Inputs**: Document object from `Formatear para Vector1`.
- **Outputs**: LangChain Document passed to `Guardar en Memoria (Pinecone)1` via `Character Text Splitter1`.
- **Key configuration**: Default data loader — uses document as-is without special extraction.
- **Notes**: Works in conjunction with `Character Text Splitter1` to handle large documents if `pageContent` exceeds token limits.

---

### Character Text Splitter1
- **Type**: `@n8n/n8n-nodes-langchain.textSplitterCharacterTextSplitter`
- **Node ID**: `0a7617de-f500-4e40-b163-d1ebfc82c558`
- **Purpose**: Splits long document text into chunks before vectorization, ensuring chunks fit within the embedding model's token limit.
- **Inputs**: LangChain Document from `Preparar Datos (Loader)1`.
- **Outputs**: Split document chunks to `Guardar en Memoria (Pinecone)1`.
- **Key configuration**: Chunk size: ~500 tokens. Chunk overlap: ~50 tokens. Separator: newline or period.
- **Notes**: For typical radar summaries (under 500 tokens), no splitting occurs and the document passes through as a single chunk. Splitting only activates for unusually verbose results.

---

### Embeddings OpenAI1
- **Type**: `@n8n/n8n-nodes-langchain.embeddingsOpenAi`
- **Node ID**: `4c99ad99-bfd9-4db0-879f-b4d0c25defa8`
- **Purpose**: Generates OpenAI embeddings for document storage into Pinecone (write path).
- **Inputs**: Sub-node binding to `Guardar en Memoria (Pinecone)1`.
- **Outputs**: Embedding vectors for upsert.
- **Key configuration**: Model: `text-embedding-3-small` or `text-embedding-ada-002`. Same OpenAI credentials.
- **Notes**: Must use the same embedding model as `Embeddings RAG1` (read path) — mixing models corrupts vector similarity.

---

### Embeddings RAG1
- **Type**: `@n8n/n8n-nodes-langchain.embeddingsOpenAi`
- **Node ID**: `d74d3aee-9db8-46c9-af2e-32f5ba50412e`
- **Purpose**: Generates OpenAI embeddings for querying Pinecone (read/RAG path).
- **Inputs**: Sub-node binding to `Pinecone Vector Store` (retrieval node).
- **Outputs**: Query embedding vectors for similarity search.
- **Key configuration**: Must use identical model to `Embeddings OpenAI1`.
- **Notes**: Critical: if you ever change the embedding model in `Embeddings OpenAI1`, you must also update this node AND re-embed all existing Pinecone records.

---

## Group 7: Error Handling & Logging

### Log Validación1
*(Documented above in Group 6 — also serves as QA/error logging)*

---

### Nota Cerebro1
- **Type**: `n8n-nodes-base.stickyNote`
- **Node ID**: `404493ab-34bc-49e5-b3d8-c14948adf7f7`
- **Purpose**: Visual annotation in the n8n canvas explaining the AI Agent architecture (the "brain" of the workflow).
- **Inputs**: None (display only).
- **Outputs**: None.
- **Key configuration**: Text content describes the dual-agent design (RADAR + Validador) and memory components.
- **Notes**: Not an executable node. For documentation purposes only within the n8n editor.

---

### Nota Proceso1
- **Type**: `n8n-nodes-base.stickyNote`
- **Node ID**: `6119ea1e-556c-4731-8f3f-edb9f1603f8e`
- **Purpose**: Visual annotation explaining the main processing pipeline steps in order.
- **Inputs**: None.
- **Outputs**: None.
- **Key configuration**: Describes flow: Trigger → Read DB → Loop → Search → AI → Validate → Route → Write.
- **Notes**: Display only.

---

### Nota RAG1
- **Type**: `n8n-nodes-base.stickyNote`
- **Node ID**: `12a0873e-179a-40d7-b72f-f6e4173e60e2`
- **Purpose**: Visual annotation explaining the RAG (Retrieval-Augmented Generation) memory pipeline via Pinecone.
- **Inputs**: None.
- **Outputs**: None.
- **Key configuration**: Describes: result → Format for Vector → Loader → Splitter → Embeddings → Pinecone upsert.
- **Notes**: Display only.

---

### Nota Alerta1
- **Type**: `n8n-nodes-base.stickyNote`
- **Node ID**: `5c1d25d9-6cc9-40da-98c2-a83f59874d29`
- **Purpose**: Visual annotation explaining the gold-opportunity alert pipeline (email notification path).
- **Inputs**: None.
- **Outputs**: None.
- **Key configuration**: Describes: Approved → Gold check → HTML render → Gmail send.
- **Notes**: Display only.

---

### Nota Validador1
- **Type**: `n8n-nodes-base.stickyNote`
- **Node ID**: `873cf830-c731-4068-90c4-337a6cf69ab4`
- **Purpose**: Visual annotation explaining the secondary validation agent and its role in borderline scoring decisions.
- **Inputs**: None.
- **Outputs**: None.
- **Key configuration**: Describes borderline range, validator prompt purpose, and merge logic.
- **Notes**: Display only.

---

## Source Logging Nodes (Excel)

These six nodes write source/evidence logs per business line, creating an audit trail of exactly which URLs and sources were used for each radar decision.

### Logs_Fuentes_BHS
- **Type**: `n8n-nodes-base.microsoftExcel`
- **Node ID**: `aa0c5c81-302f-4d05-aa87-5d23546b0542`
- **Purpose**: Logs the source URLs and quality metadata for BHS-line radar runs.
- **Key configuration**: Excel file: Logs_Fuentes_BHS.xlsx. Columns: empresa, url_fuente, tipo_fuente, calidad_fuentes, fecha_ejecucion.

### Logs_Fuentes_Int
- **Type**: `n8n-nodes-base.microsoftExcel`
- **Node ID**: `5c2b3f88-922b-4b87-b5bd-453f71ffde03`
- **Purpose**: Logs source URLs for Intralogística-line radar runs.
- **Key configuration**: Excel file: Logs_Fuentes_Int.xlsx.

### Logs_Fuentes_Cargo
- **Type**: `n8n-nodes-base.microsoftExcel`
- **Node ID**: `b6ee82c9-bd2e-4336-8aee-2188a9506050`
- **Purpose**: Logs source URLs for BHS Cargo sub-segment radar runs.
- **Key configuration**: Excel file: Logs_Fuentes_Cargo.xlsx.

### Logs_Fuentes_Carton
- **Type**: `n8n-nodes-base.microsoftExcel`
- **Node ID**: `d4748146-40e0-44bf-9ae2-ad8139fed84d`
- **Purpose**: Logs source URLs for Cartón-line radar runs.
- **Key configuration**: Excel file: Logs_Fuentes_Carton.xlsx.

### Logs_Fuentes_Motos
- **Type**: `n8n-nodes-base.microsoftExcel`
- **Node ID**: `758d999b-a1ab-4db6-be84-94e830d63ad9`
- **Purpose**: Logs source URLs for MOTOS LATAM sub-segment radar runs.
- **Key configuration**: Excel file: Logs_Fuentes_Motos.xlsx.

### Logs_Fuentes_SOLUMAT
- **Type**: `n8n-nodes-base.microsoftExcel`
- **Node ID**: `ce0ea851-701a-4b28-ba27-3361c5aef5c6`
- **Purpose**: Logs source URLs for SOLUMAT-segment radar runs.
- **Key configuration**: Excel file: Logs_Fuentes_SOLUMAT.xlsx.

---

## Node Index (All 67 Nodes)

| # | Node Name | Type | Group |
|---|---|---|---|
| 0 | AI Agent RADAR1 | `@n8n/n8n-nodes-langchain.agent` | AI Analysis |
| 1 | OpenAI Chat Model | `@n8n/n8n-nodes-langchain.lmChatOpenAi` | AI Analysis |
| 2 | Loop Over Items1 | `n8n-nodes-base.splitInBatches` | Loop & Flow Control |
| 3 | Es Oportunidad ORO?1 | `n8n-nodes-base.if` | Loop & Flow Control |
| 4 | HTML1 | `n8n-nodes-base.html` | Output & Storage |
| 5 | Schedule Trigger1 | `n8n-nodes-base.scheduleTrigger` | Trigger & Entry |
| 6 | Read Existing1 | `n8n-nodes-base.googleSheets` | Data Preparation |
| 7 | Formatear Contexto1 | `n8n-nodes-base.code` | Data Preparation |
| 8 | Character Text Splitter1 | `@n8n/n8n-nodes-langchain.textSplitterCharacterTextSplitter` | Output & Storage |
| 9 | Preparar Datos (Loader)1 | `@n8n/n8n-nodes-langchain.documentDefaultDataLoader` | Output & Storage |
| 10 | Guardar en Memoria (Pinecone)1 | `@n8n/n8n-nodes-langchain.vectorStorePinecone` | Output & Storage |
| 11 | Embeddings OpenAI1 | `@n8n/n8n-nodes-langchain.embeddingsOpenAi` | Output & Storage |
| 12 | Embeddings RAG1 | `@n8n/n8n-nodes-langchain.embeddingsOpenAi` | AI Analysis |
| 13 | Pinecone Vector Store | `@n8n/n8n-nodes-langchain.vectorStorePinecone` | AI Analysis |
| 14 | Formatear para Vector1 | `n8n-nodes-base.code` | Data Preparation |
| 15 | Send a message1 | `n8n-nodes-base.gmail` | Output & Storage |
| 16 | Wait1 | `n8n-nodes-base.wait` | Loop & Flow Control |
| 17 | Nota Cerebro1 | `n8n-nodes-base.stickyNote` | Notes |
| 18 | Nota Proceso1 | `n8n-nodes-base.stickyNote` | Notes |
| 19 | Nota RAG1 | `n8n-nodes-base.stickyNote` | Notes |
| 20 | Nota Alerta1 | `n8n-nodes-base.stickyNote` | Notes |
| 21 | Structured Output Parser1 | `@n8n/n8n-nodes-langchain.outputParserStructured` | AI Analysis |
| 22 | Postgres Chat Memory1 | `@n8n/n8n-nodes-langchain.memoryPostgresChat` | AI Analysis |
| 23 | Code in JavaScript4 | `n8n-nodes-base.code` | Data Preparation |
| 24 | Buscar Tavily General1 | `n8n-nodes-base.httpRequest` | Search & Enrichment |
| 25 | Code in JavaScript5 | `n8n-nodes-base.code` | Data Preparation |
| 26 | Format Final Columns1 | `n8n-nodes-base.set` | Data Preparation |
| 27 | Log Cliente1 | `n8n-nodes-base.googleSheets` | Output & Storage |
| 28 | Read BASE_DE_DATOS Clientes1 | `n8n-nodes-base.googleSheets` | Data Preparation |
| 29 | Validador de Fuentes1 | `n8n-nodes-base.code` | Search & Enrichment |
| 30 | ¿Borderline?1 | `n8n-nodes-base.if` | Loop & Flow Control |
| 31 | AI Agente Validador1 | `@n8n/n8n-nodes-langchain.agent` | AI Analysis |
| 32 | OpenAI Chat Model (Validador)1 | `@n8n/n8n-nodes-langchain.lmChatOpenAi` | AI Analysis |
| 33 | Structured Output Parser (Val)1 | `@n8n/n8n-nodes-langchain.outputParserStructured` | AI Analysis |
| 34 | Fusionar Resultado Validación1 | `n8n-nodes-base.code` | Data Preparation |
| 35 | ¿Aprobado IA?1 | `n8n-nodes-base.if` | Loop & Flow Control |
| 36 | ¿No Observado?1 | `n8n-nodes-base.if` | Loop & Flow Control |
| 37 | Log Validación1 | `n8n-nodes-base.googleSheets` | Error Handling & Logging |
| 38 | Nota Validador1 | `n8n-nodes-base.stickyNote` | Notes |
| 39 | Buscar Fuentes Primarias1 | `n8n-nodes-base.httpRequest` | Search & Enrichment |
| 40 | Fusionar Búsquedas1 | `n8n-nodes-base.code` | Data Preparation |
| 41 | Read BASE_DE_DATOS Clientes | `n8n-nodes-base.googleSheets` | Data Preparation |
| 42 | Log Cero Señales1 | `n8n-nodes-base.googleSheets` | Error Handling & Logging |
| 43 | Preparar Log Cero Señales1 | `n8n-nodes-base.set` | Data Preparation |
| 44 | Code in JavaScript1 | `n8n-nodes-base.code` | Data Preparation |
| 45 | Append Resultados BHS | `n8n-nodes-base.googleSheets` | Output & Storage |
| 46 | Read BASE_DE_DATOS Clientes2 | `n8n-nodes-base.googleSheets` | Data Preparation |
| 47 | Append or update a sheet | `n8n-nodes-base.microsoftExcel` | Output & Storage |
| 48 | Webhook Radar B2B | `n8n-nodes-base.webhook` | Trigger & Entry |
| 49 | Append Resultados Cartón | `n8n-nodes-base.googleSheets` | Output & Storage |
| 50 | Append Resultados Intralogística | `n8n-nodes-base.googleSheets` | Output & Storage |
| 51 | Normalizar Linea | `n8n-nodes-base.code` | Data Preparation |
| 52 | if-bhs | `n8n-nodes-base.if` | Loop & Flow Control |
| 53 | if-carton | `n8n-nodes-base.if` | Loop & Flow Control |
| 54 | Switch | `n8n-nodes-base.switch` | Loop & Flow Control |
| 55 | Append or update AEROPUERTOS FINAL | `n8n-nodes-base.microsoftExcel` | Output & Storage |
| 56 | Logs_Fuentes_BHS | `n8n-nodes-base.microsoftExcel` | Error Handling & Logging |
| 57 | Logs_Fuentes_Int | `n8n-nodes-base.microsoftExcel` | Error Handling & Logging |
| 58 | Append or update CARGO LATAM | `n8n-nodes-base.microsoftExcel` | Output & Storage |
| 59 | Logs_Fuentes_Cargo | `n8n-nodes-base.microsoftExcel` | Error Handling & Logging |
| 60 | Append or update CARTON Y PAPEL | `n8n-nodes-base.microsoftExcel` | Output & Storage |
| 61 | Logs_Fuentes_Carton | `n8n-nodes-base.microsoftExcel` | Error Handling & Logging |
| 62 | Append or update MOTOS LATAM | `n8n-nodes-base.microsoftExcel` | Output & Storage |
| 63 | Append or update FINAL DE LINEA | `n8n-nodes-base.microsoftExcel` | Output & Storage |
| 64 | Logs_Fuentes_Motos | `n8n-nodes-base.microsoftExcel` | Error Handling & Logging |
| 65 | Append or update SOLUMAT | `n8n-nodes-base.microsoftExcel` | Output & Storage |
| 66 | Logs_Fuentes_SOLUMAT | `n8n-nodes-base.microsoftExcel` | Error Handling & Logging |

---

## Key External Dependencies

| Service | Purpose | Credential Location |
|---|---|---|
| Tavily API | Primary web search | `.env` → `TAVILY_API_KEY` |
| OpenAI API | LLM (gpt-4.1-mini) + Embeddings | n8n credential store |
| Pinecone | Vector memory (index: matec-radar) | n8n credential store |
| Postgres | Conversational memory (session RadarV6) | n8n credential store |
| Google Sheets | Client DB + Results log | OAuth (credentials.json) |
| Gmail | Gold opportunity alerts | OAuth (yotubegeneric@gmail.com — CHANGE FOR PROD) |
| Microsoft Excel / OneDrive | Line-specific deliverable files | n8n Microsoft credential |

---

## Critical Action Items

1. **Change Gmail account** from `yotubegeneric@gmail.com` to the production email in `Send a message1` before full deployment.
2. **Verify `if-bhs` and `if-carton` nodes** — confirm whether they are still active alongside the `Switch` node to prevent duplicate writes.
3. **Verify `Read BASE_DE_DATOS Clientes2`** — confirm it is still in use or disable if legacy.
4. **Verify `Append or update a sheet`** (generic node) — confirm if still active or superseded by named Excel nodes.
5. **Confirm embedding model consistency** — `Embeddings OpenAI1` and `Embeddings RAG1` must use identical models.
6. **Monitor `Log Cero Señales1`** weekly — spikes indicate Tavily or keyword issues.
7. **Review `Log Validación1`** weekly — use to calibrate borderline thresholds in `¿Borderline?1`.
