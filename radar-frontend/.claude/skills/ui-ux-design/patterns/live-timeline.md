# Live Timeline (SSE) — patrón tipo Perplexity

## Estructura visual

```
🔴 Escaneando — DHL Supply Chain México
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 ✓  Descomponiendo la pregunta en sub-preguntas
    ↓ ¿Hay proyectos de expansión?
    ↓ ¿Licitaciones activas?
    ↓ ¿CAPEX declarado?
 ✓  Buscando: "DHL CEDI LATAM 2026"
    → 8 resultados
 ⏳ Leyendo: mexicoindustry.com/dhl-guadalajara
    "Nueva bodega USD 45M..."
 🧠 Evaluando criterios (4/6 cumplidos)
    ✓ CAPEX confirmado
    ✓ Horizonte ≤18 meses
    ✗ Licitación abierta
 ✨ Señal detectada
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Tokens: 6,234 · Tiempo: 23s · Costo: $0.064
```

## Event types → icon mapping

| Event | Icon | Color |
|---|---|---|
| `thinking` | 🧠 Brain | muted-foreground |
| `search_query` | 🌐 Search | primary |
| `reading_source` | 📄 FileText | primary |
| `criteria_eval` | ✓ / ✗ CheckCircle / XCircle | green-500 / red-400 |
| `signal_detected` | ✨ Sparkles | green-500 (bold) |
| `signal_discarded` | 🚫 Ban | red-400 |
| `company_done` | ✅ CheckCircle2 | green-500 |
| `session_done` | 🏁 Flag | primary |
| `token_tick` | — | (invisible, alimenta BudgetBadge) |

## Event cards

- Card con border-left colorido según tipo
- Timestamp relativo ("hace 2s")
- Truncado a 1-2 líneas con botón "Ver más" si es evento `reading_source` con texto largo
- Scroll auto-sticky al último evento (pero pausa si user scrollea manualmente arriba)

## Reconnect

- `EventSource` nativo del browser maneja reconnect automático
- Server emite `id:` header con cada evento → browser envía `Last-Event-ID` al reconectar
- Server debe poder "resumir" desde ese ID (en-memoria durante la sesión, no persistencia)

## Estados

- **Conectando**: Skeleton de 3 cards
- **Live**: eventos streaming en tiempo real con fade-in animation
- **Completado**: "🏁 Escaneo finalizado en X segundos — ver resultados" con link a `/radar-v2/resultados`
- **Error**: card de error con botón "Reintentar"

## Anti-patrones

- ❌ Polling cada N segundos (defeats SSE — no tiene sentido)
- ❌ Todos los eventos con el mismo estilo (pierde jerarquía visual)
- ❌ Timeline que crece infinito sin límite (>100 eventos degrada performance)
- ❌ Auto-scroll sin detección de scroll manual (frustra al user que quiere leer arriba)
