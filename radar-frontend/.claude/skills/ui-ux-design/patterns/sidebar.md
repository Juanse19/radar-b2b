# Sidebar anidado — patrón

## Estructura

```
[Logo]
─────────────────
▾ Dashboard
▸ Catálogos          ← Grupo (Collapsible)
▾ Radar v2           ← Grupo abierto (ruta activa dentro)
  · Escanear
  · En vivo
  · [✓] Resultados   ← item activo resalta
  · Métricas
  · Cronograma
  · Informes
▸ Administración
─────────────────
[User / Logout]
```

## Componentes

### `NavGroup`
- Trigger = `button` con: icono padre (16px) + label + chevron (12px rotando 90° cuando abierto)
- `aria-expanded` siempre sincronizado
- State persistido en `localStorage` con key `nav-group-{label}`
- Auto-expand si `pathname` incluye alguna ruta hija
- Animación: `max-height` transition 200ms (no usar `display:none` — rompe transition)

### `NavItem`
- `href` obligatorio
- `indent` cuando es subitem (pl-8, el padre es pl-4)
- Activo: `bg-muted text-foreground font-medium`
- Inactivo: `text-muted-foreground hover:text-foreground hover:bg-muted/50`
- Badge opcional ("Nuevo", "Beta") en la derecha, tamaño xs

## Regla de oro

Si el grupo tiene 1 solo hijo, **no** se convierte en grupo — se muestra como `NavItem` directo. No hagas grupos falsos por simetría.

## Anti-patrones

- ❌ Items sin agrupar repartidos por toda la sidebar (caos visual)
- ❌ Grupos con 5+ items (mejor abrir submódulo)
- ❌ Indentación >2 niveles (hard a parsear visualmente)
- ❌ Iconos en items hijos iguales al padre (redundante)
- ❌ Transición con `display:none` o `hidden` — no anima
