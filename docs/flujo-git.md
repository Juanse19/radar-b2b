# Flujo Git — Matec Radar B2B

## Repositorio

**Nombre:** `matec-radar-b2b`
**Organización/Owner:** [configurar al crear en GitHub]

---

## Estrategia de Ramas

```
main          ← producción estable. Solo recibe PRs desde develop o hotfix/
develop       ← integración. Base para todas las features.
feature/*     ← nueva funcionalidad (desde develop, PR a develop)
fix/*         ← corrección de bugs (desde develop, PR a develop)
hotfix/*      ← urgente en producción (desde main, PR a main + develop)
```

**Ejemplos de nombres de rama:**
```
feature/wf04-market-discovery
feature/frontend-dashboard-kpis
fix/wf03-linea-negocio-vacia
fix/frontend-results-page-loading
hotfix/n8n-api-key-renewal
```

---

## Convención de Commits

Formato: `tipo(scope): descripción corta`

| Tipo | Cuándo usarlo |
|------|--------------|
| `feat` | Nueva funcionalidad |
| `fix` | Corrección de bug |
| `docs` | Solo documentación |
| `refactor` | Refactoring sin cambio de comportamiento |
| `test` | Agregar o corregir tests |
| `chore` | Cambios de configuración, dependencias |

**Scopes útiles para este proyecto:**
- `wf01`, `wf02`, `wf03` — workflows N8N
- `frontend` — Next.js app
- `api` — Route Handlers
- `db` — schema Prisma
- `docs` — documentación

**Ejemplos:**
```
feat(wf03): agregar filtro de contactos por seniority
fix(wf01): corregir routing Switch para línea Intralogística
fix(frontend): mostrar error cuando N8N webhook no responde
docs(scoring): documentar fórmula composite score
chore(deps): actualizar next a 14.x
```

---

## Pull Requests

**Título:** igual que el commit principal.

**Template de descripción:**
```markdown
## Qué cambia
- [bullet 1]
- [bullet 2]

## Por qué
[motivación — bug, feature request, mejora de calidad]

## Cómo probarlo
1. [paso 1]
2. [paso 2]
3. Verificar en N8N: [URL ejecutución de prueba]

## Checklist
- [ ] Tests pasan (npm run test)
- [ ] Lint pasa (npm run lint)
- [ ] Variables de entorno documentadas en .env.example si aplica
- [ ] Workflow N8N probado en staging antes del merge
```

---

## Checklist Antes de Hacer PR

```bash
cd radar-frontend
npm run lint         # Sin errores ESLint
npm run test         # Tests unitarios pasan
npm run build        # Build exitoso
```

Para cambios en N8N:
- Probar el workflow manualmente con empresa de prueba
- Verificar la ejecución via API N8N antes de mergear
- Si el cambio rompe el formato de datos, verificar la cadena completa WF01→WF02→WF03

---

## Versionado de Workflows N8N

Los workflows N8N **no se exportan como JSON** al repo (contienen credenciales embebidas).

En cambio, se versionan los **scripts de creación y fix** en `n8n/`:

```
n8n/wf01-calificador/create_workflow01_calificador.js   # Estado inicial
n8n/wf01-calificador/fix_excel_nodes_wf01.js            # Parche específico
```

Cada script de fix tiene un comentario al inicio explicando qué corrige y por qué.

**Convención de nombres:**
- `create_wf0X_*.js` — crea el workflow desde cero
- `fix_wf0X_*.js` — corrige algo específico
- `add_*_to_wf0X.js` — agrega funcionalidad a un workflow existente

---

## Releases

No hay CI/CD automático aún. El proceso de release es manual:

1. Merge feature/fix → develop
2. Probar en local (npm run dev)
3. Merge develop → main
4. Tag de versión: `git tag v1.x.y`
5. Push: `git push origin main --tags`

Formato de versión: `v{mayor}.{menor}.{patch}`
- **Mayor:** cambio de arquitectura (nuevo agente, nuevo modelo de datos)
- **Menor:** nueva funcionalidad visible para usuarios
- **Patch:** bug fix o mejora menor
