# Criterios del Agente 1 RADAR — Evaluación de Señales

## Criterios de Inclusión (radar_activo: "Sí")

- Inversión futura con horizonte 6–36 meses documentada en fuente verificable
- Licitación pública abierta o convocatoria oficial publicada (SECOP, CompraNet, portal estatal)
- CAPEX declarado por la empresa en comunicado oficial, reporte anual o presentación a inversores
- Construcción en curso con fases futuras aún no iniciadas (expansión de terminal, nueva planta, nuevo CEDI)
- RFP o proceso de contratación activo con plazo de adjudicación pendiente
- Anuncio corporativo de inversión con monto específico y fecha estimada de inicio
- Proyecto de infraestructura aprobado y financiado con inicio previsto en 2026–2028
- Noticia de adjudicación reciente donde el proveedor aún no ha entregado el sistema

## Criterios de Descarte (radar_activo: "No")

- Obra inaugurada, cortada la cinta o declarada en operación — proyecto ya ejecutado
- Noticia publicada antes del 1 de enero de 2025 sin actualización posterior
- Nota de prensa genérica sin proyecto concreto identificado (e.g., "la empresa planea crecer")
- Evento ya realizado: feria, conferencia, expansión ya ejecutada, inauguración pasada
- Rumor de analista sin confirmación oficial de la empresa o entidad pública
- Noticia de expansión de capacidad ya operativa (nueva línea que ya está produciendo)
- Proyectos cancelados, pausados o sin financiamiento confirmado

## Criterios Anti-Alucinación (validación de datos)

- **fuente_link**: debe ser una URL absoluta pública (http:// o https://) accesible en internet. Si la fuente es paywall total, intranet corporativa o PDF no indexado → radar_activo="No".
- **monto_inversion**: solo reportar si el valor aparece textualmente en la fuente consultada. Estimaciones de analistas sin cita directa → "No reportado".
- **fecha_senal**: formato DD/MM/AAAA obligatorio. Nunca posterior a la fecha actual. Si solo se conoce el año → "No disponible".
- **descripcion_resumen**: mínimo 80 palabras si radar_activo="Sí"; mínimo 60 palabras si radar_activo="No". Nunca dejar vacío.
- No inventar nombres de proyectos, montos, fechas ni URLs. Solo datos que aparecen explícitamente en las fuentes consultadas.

## Score PROM — Factores que suman puntos

- Fuente oficial (gobierno, licitación, bolsa de valores): +25 puntos
- Mención de CAPEX o inversión de capital: +20 puntos
- Horizonte temporal ≤ 12 meses: +20 puntos
- Monto de inversión declarado: +20 puntos
- Múltiples fuentes independientes confirmando el mismo proyecto: +15 puntos
