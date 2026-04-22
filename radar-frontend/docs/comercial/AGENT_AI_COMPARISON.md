# Comparativa: agent.ai Company Research vs Radar v2 MAOA

Source fetched: https://agent.ai/agent/company-research (2026-04-18)

---

## Hallazgos de agent.ai

### UX del flujo

The agent.ai Company Research agent follows a **wizard-then-results** pattern:

1. **Input**: single company name field (minimal friction — one text input to start)
2. **Configuration layer**: optional section toggle panel — users enable/disable which report sections they want (funding, hiring, technology stack, news, competitive positioning). Sections can be reordered.
3. **Custom questions**: free-text field to append domain-specific questions that run on every company.
4. **Execution**: runs in approximately 1 minute ("Manual 1m" stated on page). Progress is not visible beyond a loading state.
5. **Output**: structured report with named sections, coaching cues, and talking points for sales conversations.
6. **History**: past research is saved and browsable — each company creates a record linked to the session.

The visual design is a polished SaaS panel: white background, card sections, a timeline component (noted as buggy in reviews — "doesn't render correctly all the time"), and a rating of 4.3/5 from 6 reviews.

### Characteristics

- Pulls from **premium data sources in parallel**: Crunchbase, Similarweb, public records — cross-referenced for accuracy.
- **Customizable report sections**: user controls what appears and in what order.
- **Custom questions**: persistent questions appended to every company scan.
- **Coaching layer**: surfaces hiring trends, funding signals, technology investments, competitive dynamics.
- **Meeting prep focus**: output is framed for sales conversations, not raw CAPEX detection.
- **Saved history**: research records persist per account for re-use.
- **Rating system**: agents rated by users (4.3/5), with public reviews visible.

### Known weaknesses (from reviews)

- Timeline component rendering is inconsistent — data and visual timeline disagree.
- Insights shallow for smaller startups ("few useful insights about viability").
- No real-time signal detection for industrial investment — designed for generic company profiles, not CAPEX/licitación tracking.

---

## What we can adopt in Radar v2

| Mejora | Prioridad | Esfuerzo | Descripcion |
|--------|-----------|----------|-------------|
| Section toggles in scan wizard | Alta | Medio | Let user enable/disable which output sections to request: descripcion_resumen, criterios, monto, fuente, ventana_compra. Reduces prompt tokens and focuses output. |
| Persistent custom questions | Alta | Medio | Add a "preguntas adicionales" text field in wizard Step 1. Appended to the user message per company. Useful for line-specific queries (e.g. "busca licitaciones SECOP II"). |
| Saved research history with re-run | Alta | Bajo | Already partially implemented in sessions. Expose a "Re-escanear" button per saved result with the same config. |
| Configuration profiles ("presets") | Media | Alto | Save wizard configurations (provider + line + section set + custom questions) as named presets. One-click to re-use. |
| Per-company coaching layer | Media | Medio | After scan, add a "Recomendaciones" block: suggested talking points for Matec's sales team based on the signal type (e.g. for Licitacion → suggest contacting the procurement office). |
| Parallel multi-source indicator | Media | Bajo | Show in results which data sources were consulted per company (already tracked via SSE search_query events). Display as source chips on the result card. |
| Public confidence score | Baja | Bajo | Show the evaluacion_temporal field prominently as a color badge (Valido / Ambiguo / Descarte) instead of buried in the JSON. |
| User ratings on scan results | Baja | Medio | Let commercial team rate each signal (thumbs up/down + comment). Feed back into RAG context for future scans. |

---

## Propuesta de mejora para el wizard de Escanear

### Current wizard (3 steps)

```
Step 1: Seleccionar línea de negocio + empresas
Step 2: Revisar lista + configurar batch size
Step 3: Elegir proveedor AI + estimar costo → Ejecutar
```

### Proposed wizard (4 steps, inspired by agent.ai)

```
┌─────────────────────────────────────────────────────────────────────────┐
│  Nuevo Escaneo                                          Paso 1 de 4     │
│─────────────────────────────────────────────────────────────────────────│
│                                                                         │
│  Línea de negocio                                                       │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │  [ BHS ] [ Intralogística ] [ Cartón ] [ Final de Línea ] ...   │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                                                                         │
│  Empresas a escanear                                                    │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │  Buscar empresa...                              [+ Agregar]     │   │
│  │  ┌──────────────────────────────────────────────────────────┐  │   │
│  │  │ DHL Express · Colombia                         [x]       │  │   │
│  │  │ LATAM Cargo · Chile                            [x]       │  │   │
│  │  └──────────────────────────────────────────────────────────┘  │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                                                                         │
│                                             [Siguiente →]               │
└─────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────┐
│  Nuevo Escaneo                                          Paso 2 de 4     │
│─────────────────────────────────────────────────────────────────────────│
│                                                                         │
│  Secciones del reporte                              (all on by default) │
│                                                                         │
│  [x] Descripcion de la señal        [x] Criterios cumplidos            │
│  [x] Ventana de compra              [x] Monto de inversion             │
│  [x] Fuente y enlace                [ ] Evaluacion temporal            │
│                                                                         │
│  Preguntas adicionales (opcional)                                       │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │  ej. "Busca también en SECOP II y portal de licitaciones..."    │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                                                                         │
│  [← Atrás]                                         [Siguiente →]       │
└─────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────┐
│  Nuevo Escaneo                                          Paso 3 de 4     │
│─────────────────────────────────────────────────────────────────────────│
│                                                                         │
│  Proveedor de IA                                                        │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐                 │
│  │  Claude      │  │  OpenAI      │  │  Gemini      │                 │
│  │  Sonnet 4.6  │  │  GPT-4o      │  │  2.0 Flash   │                 │
│  │  Web search  │  │  Training    │  │  Training    │                 │
│  │  $3/$15 /M   │  │  $2.5/$10 /M │  │  $0.075 /M  │                 │
│  │  [Selec.]    │  │  [ ]         │  │  [ ]         │                 │
│  └──────────────┘  └──────────────┘  └──────────────┘                 │
│                                                                         │
│  Costo estimado: $0.84 para 2 empresas con Claude                      │
│                                                                         │
│  [← Atrás]                                         [Siguiente →]       │
└─────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────┐
│  Nuevo Escaneo                                          Paso 4 de 4     │
│─────────────────────────────────────────────────────────────────────────│
│                                                                         │
│  Resumen de configuracion                                               │
│                                                                         │
│  Línea          Intralogística                                          │
│  Empresas       2 seleccionadas                                         │
│  Proveedor      Claude Sonnet 4.6  (web search activada)               │
│  Secciones      6 de 7 activas                                         │
│  Preg. extra    1 pregunta personalizada                               │
│  Costo est.     $0.84                                                  │
│                                                                         │
│  [Guardar como preset...]           [← Atrás]   [Iniciar escaneo]     │
└─────────────────────────────────────────────────────────────────────────┘
```

### Nuevos componentes propuestos

1. **SectionToggleGrid** — grid de checkboxes para activar/desactivar secciones del reporte. Props: `sections: string[]`, `enabled: string[]`, `onChange`. Reutilizable en wizard Step 2 y en la config de presets.

2. **CustomQuestionsTextarea** — textarea con contador de caracteres y placeholder instructivo. Appends text to user message template. Max 500 chars enforced client-side.

3. **ProviderCompareCards** — tarjetas side-by-side para seleccionar proveedor en Step 3. Muestra modelo, precio, capacidades (web search / caching) y costo estimado dinámico. Ya existe parcialmente en el wizard actual pero podría adoptar el layout de agent.ai con comparación visual directa.

4. **ScanPresetManager** — panel en Admin para crear, nombrar y aplicar configuraciones guardadas (line + provider + sections + custom questions). Persiste en Supabase tabla `radar_v2_presets`.

5. **SignalCoachingCard** — bloque colapsable en la tarjeta de resultado con recomendaciones de accion para el equipo comercial, basado en `tipo_senal`. Ejemplo: si `tipo_senal === 'Licitacion'` → "Contactar jefe de compras antes del cierre de la licitacion. Preparar propuesta tecnica con plazo de 15 dias."

6. **SourceChips** — fila de chips mostrando las URLs consultadas durante el scan (disponibles desde los eventos SSE `reading_source`). Reemplaza el enlace individual `fuente_link` con una lista completa de fuentes visitadas.

---

## Conclusion

agent.ai Company Research is a strong general-purpose B2B research tool focused on sales meeting prep. Its key differentiators are section customization, persistent history, and parallel data source aggregation.

Radar v2 MAOA already surpasses it in domain specificity: real web search via Claude's native tool, CAPEX/licitacion signal detection, composite scoring, and direct integration with the Matec commercial pipeline. The gaps are UX-level: agent.ai's wizard feels more configurable and the output is more actionable for sales teams.

The three highest-ROI improvements to adopt are: (1) section toggles to reduce prompt tokens and focus output, (2) custom questions per scan to allow line-specific instructions without changing the code, and (3) a coaching layer that translates raw signals into talking points for Paola and the commercial team. All three can be implemented within the existing wizard architecture with moderate effort.
