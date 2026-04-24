# Preset Cards (landing) — patrón

## Estructura del grid

```
┌─────────────────────────────────────────────┐
│  Radar de Inversiones                        │
│  Detecta señales en LATAM antes             │
│  que la competencia                          │
├─────────────────────────────────────────────┤
│  ESCANEOS RÁPIDOS                            │
│  ┌──────────────┐  ┌──────────────┐         │
│  │ ✈️ 🇨🇴        │  │ 📦🌎         │         │
│  │ BHS Colombia │  │ Intra LATAM  │         │
│  │ 2 empresas → │  │ 3 empresas → │         │
│  └──────────────┘  └──────────────┘         │
│  ┌──────────────┐  ┌──────────────┐         │
│  │ 🏭🇨🇴         │  │ 🏭🇲🇽        │         │
│  │ Cartón CO    │  │ Cartón MX    │         │
│  │ 3 empresas → │  │ 2 empresas → │         │
│  └──────────────┘  └──────────────┘         │
├─────────────────────────────────────────────┤
│  ESCANEO PERSONALIZADO                       │
│  ┌──────────────┐  ┌──────────────┐         │
│  │     ⚡        │  │     🎯       │         │
│  │ Automático   │  │  Manual      │         │
│  │ Línea+cant.  │  │ Empresas     │         │
│  └──────────────┘  └──────────────┘         │
└─────────────────────────────────────────────┘
```

## Preset card

Props: `{ icon, countryFlag, label, description, companyCount, href }`

- Card shadcn con `hover:border-primary` + `hover:shadow-md`
- Icono grande (24px) arriba-izquierda
- Flag país (20px) arriba-derecha como emoji o lucide-icon `Flag`
- Label en `text-base font-semibold`
- Description en `text-xs text-muted-foreground`
- Conteo con "→" al final: `<CountLink>2 empresas →</CountLink>`
- Clic → `/radar-v2/escanear?preset=<id>&step=3` (salta a revisión con datos pre-cargados)

## Mode CTA (Auto/Manual)

Card más grande (col-span-1 en grid 2x1). Icono centrado grande (32px+). Label centrado.

- Automático: `Zap` icon, color `primary`
- Manual: `Target` icon, color `foreground`
- Clic → `/radar-v2/escanear?step=1&mode=auto|manual`

## Regla de oro

El usuario debe poder disparar un scan en **máximo 3 clicks** desde landing:
- Click preset → review step 3 → Ejecutar (3 clicks)

No agregar pasos intermedios "innecesarios".

## Anti-patrones

- ❌ Presets sin conteo (user no sabe cuántas empresas tocará)
- ❌ Presets sin bandera país (confunde)
- ❌ Más de 6 presets (rompe el "quick-scan" mental model)
- ❌ CTAs Auto/Manual sin ícono grande (pierde jerarquía vs presets)
