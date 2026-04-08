# PROMPT — Agent 03 Prospector v2.0 (Ejecución directa via n8n MCP)

## Para Claude Code — Instrucciones de ejecución

Tienes acceso al MCP de n8n conectado a `https://n8n.event2flow.com`.
Úsalo para leer, modificar y probar el workflow directamente. No generes scripts manuales.

---

## Paso 1 — Leer el workflow actual

Usa la herramienta `get_workflow_details` con:
```
workflowId: "RLUDpi3O5Rb6WEYJ"
```

Lee el JSON completo. Identifica los siguientes nodos y su estado actual:
- `Code: Parse Input` — debe manejar 3 formatos de input
- `Code: Build Apollo Query` — debe cubrir 6 líneas con job titles
- `Code: Filter & Format` — debe usar `classifyNivel()` con jerarquía correcta
- `IF: Rate Limited?` — debe existir y conectar al `Wait 30s`
- Nodo de escritura en GSheets — debe deduplicar por `Persona_ID`

Si el workflow no existe o está en v1.0 (sin esos nodos), usar el JSON de referencia en
`docs/docs_contactos/Agent03_Prospector_v2.0.json` como base.

---

## Paso 2 — Verificar y aplicar los 6 cambios

Para cada cambio, verificar si ya está aplicado. Si no, modificar el nodo en el JSON del workflow.

### Cambio 1 — Parse Input (3 formatos)

El nodo `Code: Parse Input` debe manejar:

```javascript
const raw = $input.all()[0]?.json || {};
const body = raw.body || raw;

// Formato A: WF02 uppercase (COMPANY NAME, PAÍS, LINEA DE NEGOCIO, TIER)
// Formato B: WF02 camelCase (empresa, pais, linea_negocio, tier)  
// Formato C: Frontend (linea + empresas[])

let items = [];

if (body.linea && Array.isArray(body.empresas)) {
  // Formato C — frontend batch
  items = body.empresas.map(e => ({
    empresa:        e.empresa || e.company_name || e.nombre || '',
    pais:           e.pais || 'Colombia',
    linea_negocio:  e.linea_negocio || body.linea,
    tier:           e.tier || 'MONITOREO',
    company_domain: e.company_domain || '',
    paises:         e.paises || [e.pais || 'Colombia'],
    es_multinacional: (e.paises && e.paises.length > 1) || false,
    max_contacts:   e.tier === 'ORO' ? 5 : e.tier === 'PLATA' ? 4 : 3,
  }));
} else {
  // Formato A o B — single empresa
  const empresa =
    body.empresa || body['COMPANY NAME'] || body['COMPANY_NAME'] || '';
  const pais =
    body.pais || body['PAÍS'] || body['PAIS'] || 'Colombia';
  const linea =
    body.linea_negocio || body['LÍNEA DE NEGOCIO'] || body['LINEA DE NEGOCIO'] || '';
  const tier =
    body.tier || body['TIER'] || 'MONITOREO';
  const paises =
    body.paises || [pais];

  const CONTACTS = { 'ORO': 5, 'PLATA': 4, 'MONITOREO': 3 };

  items = [{
    empresa, pais, linea_negocio: linea, tier,
    company_domain: body.company_domain || body['DOMINIO'] || '',
    score_calificacion: body.score_calificacion || body['SCORE CAL'] || 0,
    score_radar:        body.score_radar || body['SCORE RADAR'] || 0,
    composite_score:    body.composite_score || 0,
    paises,
    es_multinacional: paises.length > 1,
    max_contacts: body.max_contacts || CONTACTS[tier] || 3,
  }];
}

return items.map(i => ({ json: i }));
```

### Cambio 2 — Build Apollo Query (6 líneas con job titles)

El nodo `Code: Build Apollo Query` debe generar la query de Apollo con job titles correctos por línea:

```javascript
const item = $input.item.json;
const linea = (item.linea_negocio || '').toLowerCase()
  .normalize('NFD').replace(/[\u0300-\u036f]/g, '');
const pais = item.pais || 'Colombia';

const COUNTRY_MAP = {
  'colombia': 'Colombia', 'mexico': 'Mexico', 'méxico': 'Mexico',
  'chile': 'Chile', 'peru': 'Peru', 'perú': 'Peru',
  'argentina': 'Argentina', 'brasil': 'Brazil', 'brazil': 'Brazil',
};
const countryNorm = COUNTRY_MAP[pais.toLowerCase()] || pais;

const JOB_TITLES = {
  bhs: [
    'Airport Operations Director','Director de Operaciones Aeroportuarias',
    'Terminal Manager','Gerente de Terminal','Airport CEO','Country Manager',
    'VP Airport Operations','Director de Infraestructura',
    'COO Airport','Gerente General Aeropuerto','Chief Operations Officer',
  ],
  carton: [
    'Plant Manager','Gerente de Planta','Director de Operaciones',
    'VP Manufacturing','Gerente de Manufactura','Director de Producción',
    'COO','CEO','Gerente General','Director General',
    'Director de Ingeniería','Gerente de Ingeniería Industrial',
  ],
  intralogistica: [
    'Director de Logística','Gerente de Logística','VP Supply Chain',
    'Director de Supply Chain','CEDI Manager','Gerente de CEDI',
    'Director de Operaciones','COO','Gerente de Almacén',
    'Head of Logistics','Director de Distribución',
  ],
  final_linea: [
    'Director de Manufactura','Gerente de Planta','VP Operations',
    'Director de Operaciones','Plant Manager','Gerente de Producción',
    'COO','CEO','Gerente General','Director de Empaque',
    'Gerente de Envasado','Head of Packaging',
  ],
  motos: [
    'Gerente de Planta','Director de Manufactura','Plant Manager',
    'VP Manufacturing','Director de Producción','COO','CEO',
    'Gerente General','Director de Ensamble','Gerente de Operaciones',
  ],
  solumat: [
    'Gerente de Planta','Director de Operaciones','Plant Manager',
    'Director de Manufactura','COO','Gerente General',
    'Director de Producción','VP Operations','Head of Operations',
  ],
};

let linea_key = 'intralogistica';
if (linea.includes('bhs') || linea.includes('aeropuerto') || linea.includes('cargo') || linea.includes('uld')) linea_key = 'bhs';
else if (linea.includes('carton') || linea.includes('papel') || linea.includes('corrugado')) linea_key = 'carton';
else if (linea.includes('final') || linea.includes('alimento') || linea.includes('bebida') || linea.includes('empaque')) linea_key = 'final_linea';
else if (linea.includes('moto')) linea_key = 'motos';
else if (linea.includes('solumat') || linea.includes('plastico') || linea.includes('material')) linea_key = 'solumat';

const titles = JOB_TITLES[linea_key];
const maxContacts = item.max_contacts || 5;

return [{
  json: {
    ...item,
    _apollo_params: {
      q_organization_names: [item.empresa],
      person_titles: titles,
      person_seniorities: ['c_suite', 'vp', 'director', 'manager'],
      person_locations: [countryNorm],
      per_page: Math.min(25, maxContacts * 4),
      page: 1,
    },
    _linea_key: linea_key,
    _country_norm: countryNorm,
  }
}];
```

### Cambio 3 — Filter & Format con classifyNivel()

El nodo `Code: Filter & Format` debe clasificar por nivel y tomar solo los mejores:

```javascript
function classifyNivel(title, seniority) {
  const t = (title || '').toLowerCase();
  const s = (seniority || '').toLowerCase();
  const clevel = ['chief executive','chief operations','gerente general',
    'director general','managing director','country manager'];
  if (clevel.some(x => t.includes(x))) return 'C-LEVEL';
  if (t.startsWith('ceo') || t.includes(' ceo') || t.startsWith('coo') || t.includes(' coo')) return 'C-LEVEL';
  if (s === 'c_suite') return 'C-LEVEL';
  if (t.includes('director') || t.includes('vice president') || t.includes(' vp ') || s === 'vp') return 'DIRECTOR';
  if (t.includes('gerente') || t.includes('manager') || t.includes('head of') || s === 'manager') return 'GERENTE';
  return 'JEFE';
}

const NIVEL_ORDER = { 'C-LEVEL': 0, 'DIRECTOR': 1, 'GERENTE': 2, 'JEFE': 3 };

const apolloResp = $input.item.json;
const context = $('Loop Over Items1').item.json;
const people = apolloResp.people || [];
const maxContacts = context.max_contacts || 5;
const empresa = context.empresa || '';
const pais = context._country_norm || context.pais || '';
const fecha = new Date().toISOString().split('T')[0];

const truncate = (s, n) => (s || '').substring(0, n).replace(/[^A-Za-z0-9]/g, '').toUpperCase();
const empresaCode = truncate(empresa, 20);
const paisCode = truncate(pais, 3);

const contactos = people
  .map((p, idx) => {
    const nivel = classifyNivel(p.title, p.seniority);
    const personaId = `${empresaCode}-${paisCode}-${String(idx + 1).padStart(3, '0')}`;
    return {
      Persona_ID:       personaId,
      Empresa:          empresa,
      Pais:             pais,
      Nombre:           p.first_name || '',
      Apellido:         p.last_name || '',
      Cargo:            p.title || '',
      Nivel:            nivel,
      Email_Verificado: p.email || '',
      Estado_Email:     p.email_status || '',
      LinkedIn:         p.linkedin_url || '',
      Tel_Empresa:      p.organization?.primary_phone?.number || '',
      Tel_Directo:      p.phone_numbers?.[0]?.raw_number || '',
      Tel_Movil:        p.mobile_phone || '',
      Ciudad:           p.city || '',
      Grupo:            p.organization?.name || empresa,
      Fecha:            fecha,
      Linea_Negocio:    context.linea_negocio || '',
      Tier:             context.tier || '',
      Es_Multinacional: context.es_multinacional ? 'Sí' : 'No',
      _nivel_order:     NIVEL_ORDER[nivel],
      _apollo_id:       p.id || '',
    };
  })
  .sort((a, b) => a._nivel_order - b._nivel_order)
  .slice(0, maxContacts);

if (contactos.length === 0) {
  return [{
    json: {
      _sin_contactos: true,
      empresa, pais,
      Razon: 'Apollo no retornó resultados para esta empresa/país',
      Fecha: fecha,
      Tier: context.tier || '',
      Linea_Negocio: context.linea_negocio || '',
    }
  }];
}

return contactos.map(c => ({ json: c }));
```

### Cambio 4 — IF Rate Limited + Wait 30s

Verificar que existe el nodo `IF: Rate Limited?` después del nodo HTTP de Apollo:
- Condición: `$json.error || $json.statusCode === 429`
- True branch → nodo `Wait 30s` → vuelve al nodo HTTP Apollo (retry)
- False branch → continúa a `Code: Filter & Format`

Si no existe, agregar ambos nodos.

### Cambio 5 — Deduplicación por Persona_ID antes de GSheets

En el nodo de escritura a GSheets (`Log Prospectos GSheets`), antes de append verificar que no existe ya ese `Persona_ID` en la hoja.

Si el nodo actual hace append directo sin verificar, agregar un nodo `Code: Deduplicar` antes:

```javascript
// Lee los Persona_ID ya existentes en GSheets
// (esta verificación puede hacerse vía la tabla Read de GSheets que ya existe en el flujo)
const existingIds = $('Read Existing GSheets').all().map(i => i.json.Persona_ID).filter(Boolean);
const contacto = $input.item.json;

if (contacto._sin_contactos) return [{ json: contacto }]; // pasar sin contactos
if (existingIds.includes(contacto.Persona_ID)) {
  console.log(`[Dedup] Saltando ${contacto.Persona_ID} — ya existe`);
  return []; // no escribir duplicado
}
return [{ json: contacto }];
```

### Cambio 6 — columna Es_Multinacional en GSheets

Verificar que el nodo de append a GSheets incluye el campo `Es_Multinacional` en su schema de columnas. Si no, agregarlo.

---

## Paso 3 — Actualizar el workflow via n8n API

Después de modificar todos los nodos en el JSON del workflow, guardarlo via:

```bash
curl -X PUT "https://n8n.event2flow.com/api/v1/workflows/RLUDpi3O5Rb6WEYJ" \
  -H "X-N8N-API-KEY: $N8N_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{...JSON completo del workflow modificado...}'
```

Si `N8N_API_KEY` no está en el entorno, pedirla al usuario antes de continuar.

---

## Paso 4 — Probar con execute_workflow

Usa la herramienta `execute_workflow` con:
```
workflowId: "RLUDpi3O5Rb6WEYJ"
inputs: {
  type: "webhook",
  webhookData: {
    method: "POST",
    body: {
      "empresa": "Smurfit Kappa Colombia",
      "pais": "Colombia",
      "linea_negocio": "Cartón y Papel",
      "tier": "ORO",
      "company_domain": "smurfitkappa.com",
      "max_contacts": 5
    }
  }
}
```

**Criterio de éxito:**
- La ejecución completa sin error
- Se encuentran ≥ 3 contactos
- Los contactos tienen `Nivel` clasificado (C-LEVEL, DIRECTOR, etc.)
- Se escriben en GSheets tab `Prospectos`

Si hay error, analizar el log de ejecución y corregir.
