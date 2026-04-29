# Auditoria de Empresas — Radar Matec
**Fecha:** 2026-04-28  
**Alcance:** Comparación Excel (archivos fuente) vs Supabase producción (`matec_radar` schema)  
**Modo:** Solo lectura — sin modificaciones a datos

---

## Tabla 1: Archivos Excel — Conteo de filas por archivo

Los archivos se encuentran en `docs/PROSPECCIÓN/`. El conteo refleja filas de datos de empresa
en la hoja principal (excluyendo cabeceras y filas en blanco).

| Archivo Excel | Carpeta | Hoja principal | Fila cabecera | Fila datos inicio | Columna empresa | Filas empresa |
|--------------|---------|----------------|:-------------:|:-----------------:|:---------------:|:-------------:|
| BASE DE DATOS AEROPUERTOS FINAL.xlsx | `Linea Aeropuertos/` | `Base de Datos` | 1 | 2 | COMPANY NAME (col 3) | **102** |
| BASE DE DATOS CARGO LATAM.xlsx | `Línea Cargo/` | `CRM_Cargo_ULD_LATAM` | 2 | 3 | Empresa (col 3) | **87** |
| BASE DE DATOS CARTON Y PAPEL.xlsx | `Linea Carton y Papel/` | `Base de Datos` | 4 | 5 | COMPANY NAME (col 3) | **170** |
| BASE DE DATOS FINAL DE LINEA.xlsx | `Final de Línea/` | `Base de Datos` | 5 | 6 | COMPANY NAME (col 3) | **186** |
| BASE DE DATOS LOGÍSTICA 2026.xlsx | `Línea Logistica/` | `Base de Datos` | 4 | 5 | COMPANY NAME (col 3) | **165** |
| BASE DE DATOS ENSAMBLADORAS MOTOS LATAM.xlsx | `Ensambladora de Motos/` | `Base de Datos` | 1 | 2 | COMPANY NAME (col 2) | **30** |
| BASE DE DATOS SOLUMAT.xlsx | `Línea Solumat/` | `Base de Datos` | 4 | 5 | COMPANY NAME (col 3) | **290** |
| Base de Datos Solumat TIER.xlsx | `Línea Solumat/` | `Empresas Solumat` | 1 | 2 | Company name (col 1) | **162** |
| empresas_colombia_2026.csv | `Líneas Colombianas/` | (CSV) | 1 | 2 | COMPANY NAME (col 1) | **235** |

**Notas sobre Cargo:** El archivo tiene 87 filas totales con 62 empresas únicas (algunas empresas
como FedEx y UPS aparecen varias veces, una por país de operación).

**Notas sobre Solumat:** Existen dos archivos. El archivo `BASE DE DATOS SOLUMAT.xlsx` es la base
maestra con 290 empresas. `Base de Datos Solumat TIER.xlsx` es un archivo complementario con 162
entradas que puede tener solapamiento con la base principal.

**Total filas bruto Excel (sin deduplicar entre archivos):** 1,427 filas de empresa
(102 + 87 + 170 + 186 + 165 + 30 + 290 + 162 + 235)

---

## Tabla 2: Supabase — Conteo de empresas por línea y sub-línea

Conteo de `empresa_id` distintos en la tabla `empresa_sub_lineas`, agrupado por `sub_linea_id`.

| Línea de Negocio | Sub-línea | Código | Sub-linea ID | Empresas en DB |
|-----------------|-----------|--------|:------------:|:--------------:|
| BHS | Aeropuertos | `aeropuertos` | 1 | **101** |
| BHS | Cargo / ULD | `cargo_uld` | 2 | **97** |
| Cartón | Cartón Corrugado | `carton_corrugado` | 3 | **186** |
| Intralogística | Final de Línea | `final_linea` | 4 | **513** |
| Intralogística | Ensambladoras de Motos | `ensambladoras_motos` | 5 | **43** |
| Intralogística | Solumat | `solumat` | 6 | **394** |
| Intralogística | Logística | `logistica` | 9 | **162** |
| **TOTAL (suma, con multi-sublinea)** | | | | **1,496** |

**Nota:** La suma (1,496) supera el total de empresas distintas (1,252) porque 227 empresas tienen
asignación a 2 o más sub-líneas simultáneamente.

### Desglose por archivo fuente dentro de cada sub-línea

| Sub-línea | Fuente | Empresas |
|-----------|--------|:--------:|
| Aeropuertos | BASE DE DATOS AEROPUERTOS FINAL.xlsx | 101 |
| Cargo / ULD | BASE DE DATOS CARGO LATAM.xlsx | 97 |
| Cartón Corrugado | BASE DE DATOS CARTON Y PAPEL.xlsx | 178 |
| Cartón Corrugado | BASE DE DATOS FINAL DE LINEA.xlsx | 4 |
| Cartón Corrugado | BASE DE DATOS SOLUMAT.xlsx | 2 |
| Cartón Corrugado | BASE DE DATOS LOGÍSTICA 2026.xlsx | 2 |
| Final de Línea | empresas_colombia_2026.csv | 235 |
| Final de Línea | BASE DE DATOS FINAL DE LINEA.xlsx | 258 |
| Final de Línea | BASE DE DATOS SOLUMAT.xlsx | 9 |
| Final de Línea | BASE DE DATOS LOGÍSTICA 2026.xlsx | 11 |
| Ensambladoras de Motos | BASE DE DATOS ENSAMBLADORAS MOTOS LATAM.xlsx | 43 |
| Solumat | BASE DE DATOS SOLUMAT.xlsx | 190 |
| Solumat | empresas_colombia_2026.csv | 115 |
| Solumat | BASE DE DATOS LOGÍSTICA 2026.xlsx | 84 |
| Solumat | BASE DE DATOS CARGO LATAM.xlsx | 5 |
| Logística | BASE DE DATOS LOGÍSTICA 2026.xlsx | 162 |

---

## Tabla 3: Total de empresas en la base de datos

| Métrica | Valor |
|---------|:-----:|
| Total empresas distintas (`empresas.id`) | **1,252** |
| Empresas con solo 1 sub-línea asignada | **1,025** |
| Empresas con 2+ sub-líneas asignadas | **227** |
| Total asignaciones empresa-sublinea (filas en `empresa_sub_lineas`) | **1,496** |
| Empresas SIN ninguna asignación de sub-línea | **0** |

### Distribución por país (top 10)

| País | Empresas |
|------|:--------:|
| Colombia (CO) | 467 |
| México (MX) | 387 |
| Brasil (BR) | 109 |
| Argentina (AR) | 54 |
| Chile (CL) | 53 |
| Otro | 49 |
| Perú (PE) | 43 |
| Guatemala (GT) | 17 |
| Costa Rica (CR) | 15 |
| Ecuador (EC) | 14 |
| Otros países | 40 |
| Sin país (NULL) | 6 |

### Distribución por archivo fuente importado

| Archivo fuente | Empresas en DB |
|---------------|:--------------:|
| BASE DE DATOS FINAL DE LINEA.xlsx | 258 |
| empresas_colombia_2026.csv | 235 |
| BASE DE DATOS SOLUMAT.xlsx | 190 |
| BASE DE DATOS CARTON Y PAPEL.xlsx | 178 |
| BASE DE DATOS LOGÍSTICA 2026.xlsx | 153 |
| BASE DE DATOS AEROPUERTOS FINAL.xlsx | 99 |
| BASE DE DATOS CARGO LATAM.xlsx | 97 |
| BASE DE DATOS ENSAMBLADORAS MOTOS LATAM.xlsx | 42 |
| **TOTAL** | **1,252** |

---

## Tabla 4: Comparación directa Excel vs Supabase (filas importadas)

Esta tabla compara las filas de empresa en cada Excel con lo que fue efectivamente importado a la DB
(columna `source_file` en la tabla `empresas`).

| Archivo Excel | Filas en Excel | Importadas a DB | Diferencia | % Importado |
|--------------|:--------------:|:---------------:|:----------:|:-----------:|
| BASE DE DATOS AEROPUERTOS FINAL.xlsx | 102 | 99 | **-3** | 97% |
| BASE DE DATOS CARGO LATAM.xlsx | 87 (62 únicas) | 97 | **+10** (vs únicas: +35) | 157% |
| BASE DE DATOS CARTON Y PAPEL.xlsx | 170 | 178 | **+8** | 105% |
| BASE DE DATOS FINAL DE LINEA.xlsx | 186 | 258 | **+72** | 139% |
| BASE DE DATOS LOGÍSTICA 2026.xlsx | 165 | 153 | **-12** | 93% |
| BASE DE DATOS ENSAMBLADORAS MOTOS LATAM.xlsx | 30 | 42 | **+12** | 140% |
| BASE DE DATOS SOLUMAT.xlsx | 290 | 190 | **-100** | 66% |
| empresas_colombia_2026.csv | 235 | 235 | 0 | 100% |

---

## Resumen y Discrepancias Notables

### 1. Solumat: 100 empresas faltantes en DB (-34%)

El Excel `BASE DE DATOS SOLUMAT.xlsx` tiene **290 empresas** pero solo **190 fueron importadas** a
Supabase — una diferencia de **-100 filas (-34%)**.

La sub-línea Solumat en la DB tiene 394 empresas en total, pero esas provienen de múltiples fuentes
(190 del Excel Solumat + 115 del CSV colombiano + 84 del Excel Logística + 5 de Cargo). El Excel
principal de Solumat no fue importado completo.

**Acción recomendada:** Revisar si las 100 filas faltantes del Excel Solumat son empresas que ya
existen en la DB bajo otro nombre (deduplicación) o si son empresas que faltan del todo.

### 2. Final de Línea: 72 empresas adicionales en DB (+39%)

El Excel tiene 186 empresas pero la DB tiene 258 registros con `source_file = BASE DE DATOS FINAL
DE LINEA.xlsx`. Esto sugiere que en el momento de la importación el Excel tenía más filas que las
actuales, o hubo duplicados que pasaron el filtro de deduplicación.

La sub-línea `final_linea` tiene 513 empresas en total porque también incluye las 235 del CSV
colombiano y 20 de otras fuentes cruzadas.

### 3. Cargo: 97 registros en DB vs 62 empresas únicas en Excel

El archivo Cargo tiene 87 filas pero solo 62 empresas únicas (el mismo operador aparece en múltiples
países). La DB tiene 97 registros con ese source_file, lo que implica que la importación contó todas
las filas incluyendo duplicados por país, y además agregó filas adicionales. El Excel de Cargo no
tiene una sub-línea separada como "Base de Datos" para operadores multinacionales — conviene
aclarar si el conteo debe ser por empresa o por presencia país-empresa.

### 4. Aeropuertos: 3 empresas faltantes (-3%)

Diferencia menor: 102 en Excel vs 99 importadas. Puede deberse a filas con datos incompletos que
no pasaron validación de importación, o a deduplicación por nombre similar.

### 5. Logística: 12 empresas faltantes (-7%)

165 en Excel vs 153 importadas. Diferencia moderada, similar causa probable a aeropuertos.

### 6. Motos: 42 en DB vs 30 en Excel (+40%)

12 empresas adicionales en DB. Puede indicar que el Excel fue actualizado después de la importación
(se quitaron filas) o que hay variantes del mismo archivo con distinto conteo.

### 7. CSV Colombiano: importación perfecta (235 = 235)

El archivo `empresas_colombia_2026.csv` fue importado al 100% sin pérdidas. Las 235 empresas
colombianas están todas asignadas a sub-líneas (235 a Final de Línea, 115 a Solumat, 9 a Logística).

### 8. Base de Datos Solumat TIER.xlsx: no fue importado independientemente

El archivo `Base de Datos Solumat TIER.xlsx` (162 empresas, hoja `Empresas Solumat`) no aparece
como `source_file` en la DB. Su contenido puede estar parcialmente cubierto por las importaciones
del CSV colombiano o del Excel principal de Solumat, pero no existe un mapeo directo.

### 9. Empresas con múltiples sub-líneas (227 empresas)

227 empresas están clasificadas en 2 o más sub-líneas simultáneamente. Esto es esperado para
conglomerados que operan en varios sectores, pero conviene validar que los cross-taggins del CSV
colombiano sean correctos (el CSV asigna automáticamente a Final de Línea, Solumat y Logística
según el campo `sector`).

---

## Métricas de Cobertura

| Línea | Excel filas | DB empresas (source) | DB sub-linea count | Nota |
|-------|:-----------:|:--------------------:|:------------------:|------|
| BHS — Aeropuertos | 102 | 99 | 101 | -3 en import, +2 por cross-tag |
| BHS — Cargo ULD | 87 (62 únicos) | 97 | 97 | Import incluye duplicados por país |
| Cartón | 170 | 178 | 186 | +8 en import; +8 más por cross-tag |
| Final de Línea | 186 | 258 | 513 | +72 en import; +255 por CSV CO y cross-tags |
| Motos | 30 | 42 | 43 | +12 en import; +1 por cross-tag |
| Solumat | 290 (main) | 190 | 394 | -100 en import; +204 por CSV CO y cross-tags |
| Logística | 165 | 153 | 162 | -12 en import; +9 por cross-tag |

---

*Generado automáticamente el 2026-04-28. Fuentes: archivos Excel en `docs/PROSPECCIÓN/`, Supabase producción `https://supabase.valparaiso.cafe` schema `matec_radar`.*
