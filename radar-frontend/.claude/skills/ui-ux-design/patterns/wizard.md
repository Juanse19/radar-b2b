# Wizard 3 pasos — patrón

## Estructura

```
┌─────────────────────────────────────────────┐
│  ●━━━━━○─────────○                          │  ← Stepper
│  1      2         3                          │
│  Qué    Configurar Revisar                  │
├─────────────────────────────────────────────┤
│                                              │
│   [Contenido del paso actual]                │
│                                              │
├─────────────────────────────────────────────┤
│  [← Atrás]                [Siguiente →]      │  ← o [🚀 Ejecutar]
└─────────────────────────────────────────────┘
```

## URL-driven state

El wizard reemplaza estado local por parámetros URL:
- `?step=1` o `?step=2` o `?step=3`
- `?mode=auto|manual`
- `?preset=<id>` (opcional — salta a step 3 pre-lleno)
- `?line=BHS|Intralogística|...`

**Razones**: back del browser preserva estado; deep-link funciona; refresh no pierde contexto.

Hook `useWizardState`:
```typescript
const { step, mode, line, goto, next, prev, canNext } = useWizardState();
```

## Validación por paso

**Paso 1** — requiere `line` y `mode` seleccionados → `canNext = !!line && !!mode`

**Paso 2**:
- Modo `auto`: requiere `count >= 1` → `canNext = count >= 1 && count <= 20`
- Modo `manual`: requiere `selected.length >= 1`

**Paso 3** — siempre puede ejecutar (botón cambia de "Siguiente" a "🚀 Ejecutar")

## Botón "Atrás" preserva estado

El usuario puede ir a paso 2, volver a 1, cambiar línea, volver a 2 — el estado NO se resetea salvo cambios incompatibles (ej: cambiar línea invalida empresas seleccionadas de la línea anterior).

## Stepper visual

- Paso completado: círculo lleno `bg-primary` con check ✓
- Paso actual: círculo lleno `bg-primary`, número visible
- Paso pendiente: círculo outline `border-muted-foreground`
- Línea entre pasos: `bg-primary` para completados, `bg-muted` para pendientes

## Anti-patrones

- ❌ Estado en `useState` local sin URL sync (refresh pierde progreso)
- ❌ "Next" siempre habilitado (permite avanzar con campos inválidos)
- ❌ Guardar en localStorage en vez de URL (no soporta share/deep-link)
- ❌ Reseteo agresivo al volver atrás (frustra al user)
- ❌ Stepper sin labels (solo números es confuso)
