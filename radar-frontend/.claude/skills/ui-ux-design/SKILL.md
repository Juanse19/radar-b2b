---
name: ui-ux-design
description: Matec Radar-specific UI patterns. Use when designing or modifying navigation sidebar, wizards, budget badges, live streaming timelines, preset cards, or any Radar v2 enterprise component. Complements `interface-design` with project-specific decisions. Keywords — Matec Radar UI, sidebar anidado, wizard step, budget badge, live timeline, preset card.
---

# UI/UX Design — Matec Radar v2 Enterprise

Specific design patterns for the Matec Radar B2B investment detection product. This skill applies **after** you've internalized `interface-design`'s fight against generic defaults. Here we encode the decisions already made for this product so you don't re-litigate them.

## Product voice

**Who uses it**: Paola Vaquero (lead comercial), Mariana, Natalia. Non-technical. They want to detect investment signals before competitors, trust the source, act fast, and see cost.

**Signature**: precise, calm, source-of-truth feel. Not playful, not minimalist-to-the-point-of-empty. Think _Bloomberg Terminal lite_ rather than _SaaS dashboard_.

**Tokens** (already in `tailwind.config` and CSS variables — use semantic names, never raw hex):
- `--foreground`, `--background`, `--muted`, `--muted-foreground`
- `--primary` (Matec blue), `--primary-foreground`
- `--destructive` (alerts), `--destructive-foreground`
- `--border`, `--ring`
- `--green-500` (señal activa), `--red-500` (descarte), `--yellow-500` (ambiguo)

## Core patterns

### Sidebar anidado → `patterns/sidebar.md`
Grupos colapsables con chevron. State persistido en localStorage. Auto-expand cuando la ruta actual es hija del grupo.

### Wizard 3 pasos → `patterns/wizard.md`
Stepper visible con números 1→2→3. Validación por paso. URL-driven (`?step=N`). Back preserva estado.

### Budget badge + alert modals → `patterns/budget-badge.md`
Top-right del layout. Color por status. Modales en 50/80/95/100%. El 100% bloquea.

### Live timeline (SSE) → `patterns/live-timeline.md`
Timeline vertical tipo Perplexity. Cards con icono por tipo de evento. Scroll sticky al último.

### Preset cards (landing) → `patterns/preset-card.md`
Grid 2×2 de tarjetas con icono, país-flag badge, conteo empresas. Clic = fire directo con preset cargado.

## Invariants (no negociables)

1. **Español primero**: labels, botones, mensajes. Fechas en formato `DD/MM/AAAA`. Números con separador `,` de miles.
2. **Estados vacíos con propósito**: si la API falla o no hay datos, explicar qué se esperaba, no "Sin resultados". Ejemplo: "Sin scans en el período seleccionado — ejecuta uno desde Escanear".
3. **Loading states específicos**: skeleton con forma del contenido esperado, no spinner genérico.
4. **Errores accionables**: mostrar causa + botón "Reintentar" cuando aplique. Nunca mostrar stack traces al user.
5. **Costos siempre visibles** en flujos que los consumen (wizard paso 3, vivo, resultados). Formato `$X.XXXX USD`.
6. **Accesibilidad mínima**: `aria-label` en botones icon-only, `aria-expanded` en Collapsibles, focus visible, keyboard nav.
7. **Mobile OK, no mobile-first**: el equipo usa desktop (1280+). Mobile debe funcionar pero no es prioridad.

## Componentes shadcn ya disponibles

`Card`, `Button`, `Badge`, `Dialog`, `Select`, `Table`, `Tooltip`, `Skeleton`, `Input`, `Label`. **Reusa siempre antes de crear**. Solo crea componente nuevo si el patrón no existe.

## Proceso de diseño para un nuevo componente

1. **Lee** `patterns/<patrón-relevante>.md` si existe.
2. **Busca** en `components/` y `app/` si ya hay un componente similar. Reusa si está cerca del 80% de match.
3. **Construye** en capas: layout → contenido → estados (loading/empty/error/success) → accesibilidad.
4. **Valida** contra los invariants de arriba.
5. **No inventes** color/tipografía — usa los tokens existentes.

## Señales de alerta (pídete un rewrite)

- Usar `text-gray-500` en vez de `text-muted-foreground`
- Usar `bg-white` en vez de `bg-background`
- Titulares en inglés en una UI española
- Número sin unidad (siempre `USD`, `min`, `%`, `tokens`)
- "Button variant=outline" cuando el CTA principal amerita `default`
- `w-full` + `max-w-lg` + `mx-auto` en un contenedor que ya vive dentro de un layout con `max-w` — doble centrado rompe visual
