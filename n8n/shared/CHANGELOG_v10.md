# Subagente 300 Monitor VIP — Changelog v10.x
**Fecha:** 27-Mar-2026
**Workflow ID:** `cB6VI7ZPS4fFVi-dAk4RG`
**Nodos tras cambios:** 73

---

## Resumen Ejecutivo

Se corrigieron los tres problemas principales reportados por el equipo comercial:

1. **URLs repetidas entre empresas** → resuelto con filtro determinístico pre-AI
2. **IA alucina señales de artículos sectoriales genéricos** → resuelto con validación de menciones antes de llamar a OpenAI
3. **Descripciones irrelevantes sin contexto de la empresa** → resuelto combinando pre-filtro + REGLA 5 en el prompt

Adicionalmente se completó la implementación de **Segmentación Cualitativa y Estratégica** con 7 columnas nuevas.

---

## Cambios Implementados

### 1. AI Agent RADAR1 → HTTP Request directo (fix_radar1_http_v2.js)

**Problema:** El nodo LangChain AI Agent + Structured Output Parser devolvía `{output: {}}` silenciosamente cuando el SOP no coincidía con los nombres de campo del modelo. La memoria Postgres causaba contaminación entre empresas.

**Fix:** Se reemplazó el AI Agent + SOP + Postgres Memory con:
- Nodo `httpRequest` directo a `https://api.openai.com/v1/chat/completions`
- `response_format: { type: 'json_object' }` → JSON garantizado con 9 campos fijos
- Nodo nuevo `Parse RADAR1 Output` (Code, runOnceForEachItem) que convierte `choices[0].message.content` → `{output: {...}}`

**Nodos eliminados:** `OpenAI Chat Model`, `Structured Output Parser1`, `Postgres Chat Memory1`
**Nodo añadido:** `Parse RADAR1 Output`

**Campos de salida estandarizados (9 campos fijos):**
```
radar_activo, tipo_senal, descripcion_senal, fuente_link, fuente_nombre,
fecha_senal, ventana_compra, score_relevancia, motivo_descarte
```

---

### 2. System Message limpio para RADAR1 (fix_radar1_jsonbody.js)

**Problema:** El `options.systemMessage` del RADAR1 contenía expresiones `{{ $('Loop Over Items1').item.json.empresa }}` que al ser embebidas dentro del `jsonBody` (`={{ ... }}`) causaban conflicto de sintaxis → error de parseo en ejecución.

**Fix:** Se creó `RADAR_SYSTEM_CLEAN` — un system message estático (sin `{{ }}`, sin `=` inicial) con todas las reglas incluyendo REGLA 5. Los datos dinámicos de la empresa se pasan únicamente en el `user` message como expresiones N8N.

**Longitud system message:** 6,004 caracteres
**REGLA 5 incluida:** "Si NINGÚN resultado menciona explícitamente la empresa → `radar_activo='No'`"

---

### 3. Filtro Menciones Empresa + IF routing (fix_filtro_menciones_v3.js)

**Problema:** La IA ignoraba REGLA 5 y fabricaba señales de artículos sectoriales (ej: "Plan de Inversión Nacional de México 2026-2030" → reportado como señal de Cervecería Minerva).

**Fix determinístico:** Se añadió `Filtro Menciones Empresa` (Code node, `runOnceForEachItem`) ANTES de la llamada a OpenAI. Si ninguno de los 10 resultados de búsqueda menciona el nombre de la empresa (o sus primeras 2 palabras normalizadas), se retorna "Sin Señal" **sin llamar a OpenAI**.

**Lógica de matching:**
- Normaliza nombre de empresa (NFD lowercase, sin tildes)
- Extrae: nombre completo, primeras 2 palabras, primera palabra
- Verifica cada `r.title + r.snippet` de los resultados orgánicos
- Umbral: solo coincide si la cadena tiene más de 5 caracteres

**Nodo IF añadido:** `IF: Tiene Menciones`
- `TRUE` (tiene menciones) → AI Agent RADAR1 → Parse RADAR1 Output
- `FALSE` (sin menciones) → Parse RADAR1 Output directamente (pre-popula `output` con no-signal)

**Resultado:** Cero llamadas a OpenAI para empresas sin cobertura específica en los resultados de búsqueda. Cero URLs duplicadas entre empresas.

**Conexiones actualizadas:**
```
Code JS5 → Filtro Menciones Empresa → IF: Tiene Menciones
  TRUE  → AI Agent RADAR1 → Parse RADAR1 Output
  FALSE → Parse RADAR1 Output (no-signal directo)
```

---

### 4. Parse RADAR1 Output — manejo dual de rutas

**Código v2:** El nodo `Parse RADAR1 Output` maneja dos rutas:
- **Ruta A** (desde AI RADAR1): Parsea `choices[0].message.content` → `{output: {...}}`
- **Ruta B** (desde Filtro, sin menciones): El item ya tiene `output.radar_activo` → pass-through

---

### 5. Segmentación Cualitativa — HTTP Request (fix_segm_code_node.js)

**Problema:** `AI Agent Segmentación Cualitativa` (LangChain + SOP) devolvía `{output: {}}` silenciosamente. Los 7 campos de segmentación llegaban vacíos al Excel.

**Fix:** Se reemplazó con nodo `httpRequest` a OpenAI con `response_format: {type: 'json_object'}`.

**7 campos de segmentación producidos:**
| Campo | Valores |
|---|---|
| `impacto_presupuesto` | Muy Alto / Alto / Medio / Bajo / Muy Bajo |
| `multiplanta` | Presencia internacional / Varias sedes regionales / Única sede |
| `recurrencia` | Muy Alto / Alto / Medio / Bajo / Muy Bajo |
| `referente_mercado` | Referente internacional / Referente país / Baja visibilidad |
| `anio_objetivo` | 2026 / 2027 / 2028 / Sin año |
| `ticket_estimado` | USD X millones / Sin ticket |
| `prioridad_comercial` | Muy Alta / Alta / Media / Baja / Muy Baja |

**Nodos eliminados:** `OpenAI Chat Model Segm.`, `Structured Output Parser Segm.`

---

### 6. Fix Excel write — dataMode: autoMap (inline fix)

**Problema:** Nodos `Append or update CARTON Y PAPEL` y `Append or update CARGO LATAM` escribían 0 filas en Excel. El nodo `FINAL DE LINEA` (que sí funcionaba) tenía `dataMode: 'autoMap'` pero estos no.

**Fix:** Se añadió `dataMode: 'autoMap'` a los nodos sin esta propiedad. Con `autoMap`, N8N mapea automáticamente todos los campos del item a columnas del Excel por nombre.

**Nodos corregidos:** `CARTON Y PAPEL`, `CARGO LATAM`

---

### 7. Logs_Fuentes — continueOnFail (inline fix)

**Problema:** Los nodos `Logs_Fuentes_X` fallaban con "No data found" porque las pestañas `Logs_Fuentes` en los Excel de SharePoint no tienen fila de encabezados. Este error detenía la ejecución del loop.

**Fix:** Se habilitó `continueOnFail: true` en todos los nodos `Logs_Fuentes_X` para que el error sea no-bloqueante.

**Nodos afectados:** `Logs_Fuentes_BHS`, `Logs_Fuentes_Int`, `Logs_Fuentes_Cargo`, `Logs_Fuentes_Carton`, `Logs_Fuentes_Motos`, `Logs_Fuentes_SOLUMAT`

**Acción manual pendiente (usuario):** Agregar fila de encabezados en cada pestaña `Logs_Fuentes` de los Excel en SharePoint para que los logs funcionen correctamente.

---

## Pipeline Final

```
Webhook / Schedule
  → Code JS4 / Code JS1 (detecta empresas)
  → Loop Over Items1 (batch)
    → Construir Query Tavily → Buscar Fuentes Primarias + Buscar Tavily General1
    → Fusionar Búsquedas1
    → Code JS5 (normaliza + prioriza resultados empresa-primero)
    → [NUEVO] Filtro Menciones Empresa (verifica menciones de empresa en snippets)
    → [NUEVO] IF: Tiene Menciones?
        TRUE  → AI Agent RADAR1 (HTTP OpenAI) → Parse RADAR1 Output
        FALSE → Parse RADAR1 Output (no-signal sin llamada API)
    → Validador de Fuentes1 / Format Final Columns1 / Wait1
    → [NUEVO] Buscar Perfil Empresa (Tavily, búsqueda de perfil)
    → [NUEVO] AI Agent Segmentación Cualitativa (HTTP OpenAI, 7 campos)
    → [NUEVO] Set: Merge Segmentación (combina radar + segmentación)
    → Normalizar Linea → Determinar Sub-Línea → Switch
    → Append or update [AEROPUERTOS/CARGO/CARTON/FINAL/MOTOS/SOLUMAT]
    → Loop (Wait1)
```

---

## Resultados de Validación (Ejecución 228355)

| Empresa | Filtro | Ruta | Radar | Excel escrito |
|---|---|---|---|---|
| Grupo Bimbo | 3 menciones ✓ | → AI RADAR1 | No (planta ya inaugurada) | ✅ |
| Cervecería Minerva | 0 menciones | → directo | Sin Señal | ✅ |
| Smurfit Kappa | 0 menciones | → directo | Sin Señal | ✅ |

- URLs duplicadas entre empresas: **0** ✅
- Ejecución status: **success** ✅
- Errores bloqueantes: **0** ✅
- Errores no-bloqueantes (Logs_Fuentes): 1 ⚠️ (requiere fix manual en Excel)

---

## Acciones Manuales Pendientes (Usuario)

1. **Agregar fila de encabezados en pestaña `Logs_Fuentes`** en cada Excel de SharePoint:
   - `BASE DE DATOS AEROPUERTOS FINAL.xlsx` → tab `Logs_Fuentes`
   - `BASE DE DATOS CARTON Y PAPEL.xlsx` → tab `Logs_Fuentes`
   - Igual para FINAL DE LINEA, CARGO LATAM, MOTOS LATAM, SOLUMAT

2. **Verificar columnas nuevas en Excel** — Si columnas como `PRIORIDAD COMERCIAL`, `MULTIPLANTA`, `RECURRENCIA`, `REFERENTE DEL MERCADO`, `AÑO OBJETIVO`, `TICKET ESTIMADO` no existen en los Excel, agregarlas como nuevas columnas. El nodo `autoMap` escribe automáticamente a columnas existentes.

3. **Prueba con empresa con señal real** — Buscar una empresa target con inversión confirmada (ej: via BNAmericas) y verificar que:
   - Filtro la detecta (`has_menciones=true`)
   - AI retorna `radar_activo='Sí'` con fuente válida
   - Campos `ventana_compra`, `tipo_senal`, `score_relevancia` son correctos

---

## Scripts Generados

| Script | Descripción |
|---|---|
| `fix_radar1_http_v2.js` | Reemplaza AI Agent RADAR1 con HTTP Request |
| `fix_radar1_jsonbody.js` | Actualiza jsonBody con system message limpio (REGLA 5) |
| `fix_segm_code_node.js` | Reemplaza AI Agent Segmentación con HTTP Request |
| `fix_add_prefilter_menciones.js` | Agrega nodo Filtro Menciones (versión inicial, buggy) |
| `fix_filtro_menciones_v2.js` | Fix modo runOnceForAllItems (versión con bug bash $input) |
| `fix_filtro_menciones_v3.js` | Fix final: runOnceForEachItem + IF node routing ✅ |
| `fix_radar_quality_v1.js` | Agrega REGLA 5 al system message + mejora Code JS5 |
