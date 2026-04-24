---
name: apollo-fase1
description: >
  Skill de prospección Fase 1 para Matec LATAM usando Apollo.io. Úsalo cuando
  el usuario diga: "corre Fase 1", "escanea empresas", "busca contactos para
  [línea]", "arranca la prospección", "procesa [línea]", "corre el scan",
  "scan de SOLUMAT / AEROPUERTOS / MOTOS / CARGO / CARTON_PAPEL / FINAL_LINEA",
  o cualquier combinación de línea de negocio + búsqueda de contactos.
metadata:
  version: "0.2.0"
---

# Apollo Fase 1 — Búsqueda de Contactos (Gratuita)

Ejecutar el scan de Fase 1 para una línea de negocio usando la herramienta MCP
`apollo_mixed_people_api_search`. Esta fase NO consume créditos Apollo.

## Qué captura Fase 1 (sin costo)

Por cada contacto encontrado, Apollo devuelve:

| Campo           | Disponible en Fase 1 | Notas                                    |
|-----------------|----------------------|------------------------------------------|
| `first_name`    | ✅ completo          | Nombre siempre visible                   |
| `last_name`     | ⚠️ parcial           | A veces ofuscado (e.g. `"Tr***o"`)       |
| `title`         | ✅                   | Cargo / puesto                           |
| `linkedin_url`  | ✅ completo          | **Siempre capturar en Fase 1**           |
| `organization`  | ✅                   | Empresa, dominio                         |
| `country`       | ✅                   | País                                     |
| `email`         | ❌                   | Solo con Fase 2 (consume créditos)       |
| `phone_numbers` | ❌                   | Solo con Fase 2 con `--con-movil`        |

> ⚠️ **IMPORTANTE**: Al guardar contactos de Fase 1, siempre capturar el campo
> `linkedin_url` del resultado de Apollo. No requiere crédito adicional y es útil
> para outreach directo vía LinkedIn.

## Antes de empezar

1. Leer `references/lineas-config.md` para obtener:
   - Lista de empresas objetivo de la línea (`empresas_obj`)
   - Job titles exactos para esa línea
   - Ruta del acumulador JSON y del Excel MASTER

2. Leer el acumulador existente (si existe) para conocer los `persona_id` ya
   guardados — nunca duplicar.

3. Confirmar con el usuario cuántas empresas tiene la lista y si quiere procesar
   todas o solo un subconjunto.

## Parámetros de búsqueda por empresa

Para cada empresa en la lista objetivo:

```
apollo_mixed_people_api_search({
  q_organization_domains: [dominio_empresa],
  person_titles:          [job_titles de la línea],
  person_locations:       [países LATAM de la línea],
  per_page: 10,
  page: 1
})
```

Ver `references/job-titles.md` para los títulos exactos de cada línea.
Ver `references/lineas-config.md` para países y configuración por línea.

**Si la empresa no tiene dominio:** registrar en lista "sin dominio", continuar.
**Si Apollo devuelve 0 resultados:** registrar en lista "sin contactos", continuar.

## Estructura del contacto a guardar

```json
{
  "persona_id":   "id de Apollo (campo id del resultado)",
  "nombre":       "first_name",
  "apellido":     "last_name (puede estar parcialmente ofuscado)",
  "cargo":        "title",
  "empresa":      "organization.name",
  "pais":         "country (de person o de organization)",
  "linkedin":     "linkedin_url  ← SIEMPRE capturar aquí",
  "has_email":    false,
  "has_phone":    false,
  "batch":        número_de_lote,
  "email":        "",
  "email_status": "",
  "tel_empresa":  "",
  "tel_directo":  "",
  "tel_movil":    "",
  "fase2_done":   false
}
```

## Gestión de batches

- Procesar empresas en rondas de 10 empresas.
- Después de cada ronda, actualizar el acumulador JSON en disco.
- Deduplicar por `persona_id` antes de guardar.
- Registrar empresas sin contactos en una lista separada para el tab `Sin Contactos`.
- Procesar hasta 5 rondas en paralelo para mayor velocidad cuando el contexto lo permita.

## Reporte al terminar

```
✅ FASE 1 COMPLETA — [LÍNEA]
   Empresas escaneadas    : N
   Con contactos          : N (X%)
   Sin contactos          : N
   Total contactos nuevos : N
   C-Level                : N
   Director               : N
   Gerente                : N
   Jefe                   : N
   LinkedIn capturados    : N
   Acumulador             : ruta/linea_scan_results.json

📋 SIGUIENTE PASO RECOMENDADO:
   Fase 2 para C-Level + Director: ~N contactos → ~N créditos (solo email)
   Con teléfono móvil: ~N contactos × 9 créditos = ~N créditos adicionales
```

## Clasificación de niveles

| Nivel    | Palabras clave en el cargo                                        |
|----------|-------------------------------------------------------------------|
| C-LEVEL  | gerente general, director general, CEO, COO, managing director,  |
|          | country manager, chief executive, chief operations               |
| DIRECTOR | director (cualquier área), vice president, VP                    |
| GERENTE  | gerente (cualquier área), manager, head of                       |
| JEFE     | jefe, coordinador, supervisor, lead                              |
| ANALISTA | analista, analyst, specialist, especialista                      |

## Manejo de errores comunes

- **Rate limit (429):** Esperar 30 segundos y reintentar automáticamente.
- **Sin dominio:** Registrar empresa como "Sin dominio web" y continuar.
- **0 resultados:** Registrar empresa como "Sin resultados Apollo" y continuar.
- **Proceso interrumpido:** Al reanudar, saltar `persona_id` ya presentes en el acumulador.
