# Análisis del proyecto — Radar v2 (Agente 1 RADAR)

## Stack del MVP

| Componente | Versión / Detalle |
|-----------|------------------|
| Next.js   | 16.2.0 App Router |
| React     | 19.2.4 |
| TypeScript | 5 strict |
| Tailwind CSS | 4 (postcss plugin) |
| UI Library | shadcn/ui v4.1.0 |
| Supabase  | JS 2.100.0 + SSR |
| TanStack Query | 5.91.2 |
| Testing   | Vitest + Playwright |

## Estructura relevante

```
app/
├── scan/           ← Radar existente (WF01/WF02/WF03 n8n) — NO TOCAR
├── results/        ← Señales radar existente — NO TOCAR
├── schedule/       ← Cronograma existente — NO TOCAR
├── radar-v2/       ← NUEVO: Radar v2 (Claude) — este módulo
└── resultados-v2/  ← NUEVO: Historial v2 — este módulo

components/
└── Navigation.tsx  ← Modificado MÍNIMAMENTE (2 items agregados al array navItems)

lib/
├── db/supabase/    ← Existente — NO TOCAR
└── radar-v2/       ← NUEVO: tipos + db para Radar v2

supabase/
├── migrations/     ← 2 nuevas: 20260416_100 y 20260416_101
└── functions/
    └── radar-scan-v2/ ← NUEVA Edge Function
```

## Sistema de diseño

- Paleta: `--primary: #142e47` (azul institucional Matec)
- Sidebar: `bg-sidebar text-sidebar-foreground`
- Componentes: `Button`, `Card`, `Input`, `Badge`, `Select`, `Dialog`, `Sheet` (shadcn)
- Iconos: lucide-react

## Sidebar — patrón de integración

El array `navItems` en `components/Navigation.tsx` (líneas 22-32) define el menú lateral.
Para agregar items se inserta al final del array — sin modificar items existentes.

Items agregados:
```typescript
{ href: '/radar-v2',      label: 'Radar v2',      icon: Zap },
{ href: '/resultados-v2', label: 'Resultados v2',  icon: TrendingUp },
```

## Schema Supabase

Schema activo: `matec_radar` (variable `SUPABASE_DB_SCHEMA=matec_radar`)

Tablas existentes NO modificadas:
- `empresas` — 918 filas, 40 columnas
- `radar_scans` — señales del WF02 n8n
- `sub_lineas_negocio`, `empresa_sub_lineas` — pivot de líneas

Tablas NUEVAS creadas por este módulo:
- `radar_v2_sessions` — agrupa un escaneo de N empresas
- `radar_v2_results` — resultado del Agente 1 por empresa (FK → empresas)

## Convivencia con radar existente

| Aspecto | Radar v1 (n8n) | Radar v2 (Claude) |
|---------|---------------|-------------------|
| Trigger | `/api/trigger`, `/api/radar` | `/api/radar-v2` |
| Motor IA | GPT-4.1-mini + Tavily | Claude Sonnet 4.6 + web_search |
| Tabla resultados | `radar_scans` | `radar_v2_results` |
| UI | `/scan`, `/results` | `/radar-v2`, `/resultados-v2` |

Ambos radars pueden correr en paralelo. Las tablas son independientes.
