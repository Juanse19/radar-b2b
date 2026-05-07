# PROMPT — Agregar filtro Tier al wizard de Calificador y Escanear

> Copia y pega este prompt en una sesión nueva de Claude Code (o agente equivalente)
> apuntando al worktree del proyecto. Reproduce el patrón ya implementado en
> Apollo Prospector v2 (commit `35f37fd` de la rama `claude/admiring-herschel-8f6488`).

---

## Contexto

El módulo **Apollo Prospector v2** (`/contactos`) ya tiene un filtro multi-select de
**Tier** (A · B · C · D · sin_calificar) en el wizard, paso 2 del modo Manual:

- Permite al usuario filtrar el catálogo de empresas elegibles antes de seleccionarlas.
- Si el usuario marca uno o varios chips → solo aparecen empresas de esos tiers.
- Si no marca ninguno → aparecen todas las empresas.
- Tier A se renderiza con gradiente dorado (mayor jerarquía visual).
- El backend (`empresas-search` endpoint) ya recibe `tiers: string[]` y filtra por
  `e.tier_actual::TEXT IN (...)`.

**Necesito el mismo filtro en los wizards de Calificador y Escanear** porque ambos
seleccionan empresas y deberían beneficiarse del mismo control.

---

## Archivos de referencia (patrón a copiar)

Mira primero estos archivos del módulo Contactos (commit `35f37fd`):

1. **UI del filtro** — `radar-frontend/app/(comercial)/contactos/components/wizard/Step2ConfigureManual.tsx`
   - Sección "Filtro por Tier — chips multi-select"
   - Mapping de colores por tier (A dorado con `linear-gradient`, B rosa, C violeta, D gris)
   - State lives in `state.tiers: Tier[]` del wizard padre
   - Se pasa al endpoint vía body JSON

2. **State del wizard** — `radar-frontend/app/(comercial)/contactos/components/wizard/state.ts`
   - `Tier = 'A' | 'B' | 'C' | 'D' | 'sin_calificar'`
   - `tiers: Tier[]` en `ProspectorWizardState`

3. **Endpoint backend** — `radar-frontend/app/api/prospector/v2/empresas-search/route.ts`
   - Body schema con `tiers: z.array(z.string()).optional()`
   - SQL filter: `AND e.tier_actual::TEXT IN ('A','B',...)`

---

## Tareas para Calificador

**Working dir:** `radar-frontend/app/(comercial)/calificador/`

1. Revisa el wizard del Calificador. Probable ubicación:
   `app/(comercial)/calificador/wizard/` o `components/wizard/`.

2. Identifica el step donde el usuario selecciona empresas (no donde define
   "qué calificar"). Si el wizard hace un `fetch` para cargar la lista de
   empresas elegibles, ahí va el filtro.

3. Agrega:
   - **State**: `tiers: ('A'|'B'|'C'|'D'|'sin_calificar')[]` en el shared
     state del wizard (con default `[]` = todas).
   - **Toggle handler**: como `toggleTier` de Step2ConfigureManual.
   - **UI chips**: copia el bloque `<div className="mb-3 flex flex-wrap...">` de
     Step2ConfigureManual líneas ~131-180 (busca `Filtro por Tier — chips`).
   - **Endpoint call**: incluye `tiers: state.tiers.length > 0 ? state.tiers : undefined`
     en el body.
   - **Re-fetch dep**: agrega `tiersKey = state.tiers.join(',')` y mételo en el
     `useEffect` dependency array que dispara el fetch.

4. Si el endpoint del Calificador no soporta `tiers`, modifica el route handler
   y agrega:
   ```typescript
   const tiersFilter = body.tiers?.length
     ? `AND e.tier_actual::TEXT IN (${body.tiers.map(t => `'${t.replace(/'/g, "''")}'`).join(',')})`
     : '';
   ```

5. Valida con un test mínimo: navega `/calificador/wizard`, selecciona Tier A,
   confirma que la tabla de empresas solo muestra las Tier A.

## Tareas para Escanear

**Working dir:** `radar-frontend/app/(comercial)/escanear/`

Mismo patrón. Archivos típicos:
- `escanear/components/Wizard.tsx`
- `escanear/components/Step2Configure.tsx` (donde se ven empresas)
- `lib/comercial/wizard-state.ts` (state compartido)

El módulo Escanear es más complejo porque tiene 3 modos:
- **Auto mode** — ya usa `auto-select` con count slider; agregar tier filter
  ahí también.
- **Manual mode** — copiar el patrón Manual de Contactos.
- **Signals mode** — no aplica (no selecciona empresas).

Ojo:
- Escanear ya tiene su propio `state.line` (singular `line`, no `lineas: []`)
  y `state.sublineas: string[]`. El filtro tier debe extender ese state sin
  romperlo.
- Si el endpoint de Escanear no es `empresas-search`, copia el SQL filter del
  patrón Contactos al endpoint que use Escanear.

---

## Reglas comunes

1. **No reescribas el wizard entero** — solo agrega el filtro y su wiring.
2. **Copy del patrón visual exacto** del Prospector — mismos colores, mismas
   clases Tailwind, mismo gradiente para Tier A. Consistencia entre módulos.
3. **NO agregues filtros en el modo Auto si ya existen** — verifica primero.
4. **Re-fetch debounced** — si la consulta es server-side, usa `setTimeout`
   con 350ms para evitar request por keystroke.
5. **El estado vacío `tiers: []` significa "todos los tiers"** — no se pasa
   al endpoint.

---

## Test de aceptación por módulo

| Módulo | Test |
|--------|------|
| Calificador | Navegar al wizard, llegar al step de empresas, marcar Tier A → solo aparecen empresas A en la tabla. Marcar también Tier B → aparecen A+B. Click "Mostrar todas" → todas. |
| Escanear (Auto) | Auto count slider sigue funcionando + filtro tier aplica en el `auto-select` endpoint. |
| Escanear (Manual) | Igual al Calificador. |

---

## Entregables

1. PR con los cambios separados por módulo (Calificador / Escanear) — facilita
   review.
2. Screenshot/video de la UI del filtro funcionando en cada módulo.
3. Commit messages siguiendo el formato existente del proyecto:
   `feat(calificador): tier filter en wizard step empresas`
   `feat(escanear): tier filter en wizard manual + auto`
