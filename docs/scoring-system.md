# Sistema de Scoring — Matec Radar B2B

## Score Calificación — Agente 01 (0–10)

Calculado por GPT-4.1-mini evaluando 7 dimensiones del perfil de la empresa:

| Factor | Peso | Valores posibles |
|--------|------|-----------------|
| Impacto en el presupuesto | 25% | Muy Alto=10, Alto=8, Medio=5, Bajo=3, Muy Bajo=1 |
| Año objetivo | 15% | 2026=10, 2027=7, 2028=4, Sin año=2 |
| Recurrencia | 15% | Muy Alto=10, Alto=8, Medio=5, Bajo=3, Muy Bajo=1 |
| Multiplanta | 15% | Internacional=10, Regional=7, Única=3 |
| Ticket estimado | 10% | >5M USD=10, 1-5M=8, 500K-1M=5, <500K=3, Sin dato=1 |
| Referente del mercado | 10% | Internacional=10, País=7, Baja visibilidad=3 |
| Prioridad comercial | 10% | Muy Alta=10, Alta=8, Media=5, Baja=3, Muy Baja=1 |

**Fórmula:**
```
score = (impacto×0.25) + (año×0.15) + (recurrencia×0.15) + (multiplanta×0.15)
      + (ticket×0.10) + (referente×0.10) + (prioridad×0.10)
```

**Asignación de Tier:**
- **ORO:** score ≥ 8 → prospección completa (5 contactos Apollo)
- **MONITOREO:** score 5–7 → seguimiento (2 contactos Apollo)
- **ARCHIVO:** score < 5 → sin prospección activa

---

## Score Radar — Agente 02 (0–100)

Sistema PROM — puntos por características de la señal detectada:

| Criterio | Puntos |
|---------|--------|
| Fuente oficial (gobierno, licitación) | +25 |
| Mención de CAPEX / inversión | +20 |
| Horizonte ≤ 12 meses | +20 |
| Monto declarado en la señal | +20 |
| Múltiples fuentes confirmando | +15 |

---

## Score Compuesto (Decisión Final)

Combina calificación de empresa + señal detectada:

```
composite = (score_calificacion / 10 × 40) + (score_radar / 100 × 60)
```

| Composite | Acción |
|-----------|--------|
| ≥ 70 | **ORO** → Prospección Apollo 5 contactos |
| 40–69 | **MONITOREO** → Prospección Apollo 2 contactos |
| < 40 | **ARCHIVO** → Sin prospección, solo email automático |

---

## Ejemplos Reales (Validados en Producción)

| Empresa | Línea | Score Cal | Score Radar | Composite | Tier |
|---------|-------|-----------|------------|-----------|------|
| Smurfit Kappa | Cartón | 9 | 75 | 81 | ORO |
| OPAIN | BHS | 6 | — | — | MONITOREO |
| Carton de Colombia | Cartón | 9 | — | — | ORO |
