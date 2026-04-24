# Budget Badge + alertas — patrón

## Ubicación

Top-right del layout `app/radar-v2/layout.tsx`. Siempre visible en todos los submódulos de Radar v2.

## Estados

```
┌─ ok ─────────────────┐  ┌─ warning (80%) ──────┐  ┌─ blocked (100%) ────┐
│ 💰 $0.08 / $0.50     │  │ ⚠ $0.42 / $0.50     │  │ 🛑 $0.50 / $0.50    │
│    16%               │  │    84%               │  │    100% — bloqueado │
└──────────────────────┘  └──────────────────────┘  └──────────────────────┘
 bg-muted/50              bg-yellow-500/15          bg-destructive/15
 text-muted-foreground    text-yellow-700           text-destructive
```

## Alert modals

Disparan UNA SOLA VEZ por sesión en los thresholds:
- **50%**: info — "Has usado el 50% del budget. Restan $X.XX"
- **80%**: warning — "80% del budget consumido. Considera pausar para revisar resultados"
- **95%**: warning alta — "A punto de agotar el budget"
- **100%**: destructive + bloqueo — "Budget agotado. No se procesarán más empresas. Aumenta el budget desde el wizard si quieres continuar."

El array `alerts_fired` en DB evita duplicados de modal.

## Rules

- El badge se alimenta del SSE event `token_tick` (tiempo real) + consulta a `radar_v2_budgets` al mount.
- Tooltip al hover muestra breakdown: "Scan: $0.06 · Prefilter: $0.01 · Report: $0.01"
- Link del badge → `/radar-v2/metricas` para ver histórico
- En `blocked`, cualquier botón "Ejecutar" del wizard queda disabled con tooltip explicativo.

## Anti-patrones

- ❌ Spinner sin número ($0.00 / $??)
- ❌ Modal que se dispara cada re-render (usar `alerts_fired`)
- ❌ Bloqueo silencioso (siempre explicar por qué)
- ❌ Color rojo en <80% (confunde al user)
