# Matec Prospector — Plugin B2B LATAM v0.2

Plugin de prospección autónoma para Matec LATAM usando Apollo.io.
Cubre el ciclo completo para cualquier línea de negocio:

**Fase 1** (sin costo) → **Fase 2** (emails/teléfonos) → **Excel MASTER**

## Líneas de negocio soportadas

| Código       | Nombre                     | Empresas est. |
|--------------|----------------------------|---------------|
| SOLUMAT      | Soluciones de Materiales   | ~286          |
| AEROPUERTOS  | Sistemas BHS / Aeropuertos | ~175          |
| MOTOS        | Motocicletas               | ~60           |
| CARGO        | Logística / Carga          | ~120          |
| CARTON_PAPEL | Cartón Corrugado / Papel   | ~150          |
| FINAL_LINEA  | Alimentos & Bebidas        | ~186          |

## Skills

### `apollo-fase1` — Búsqueda de Contactos (Gratuita)
Activa con: *"procesa [LÍNEA]"*, *"corre Fase 1"*, *"escanea empresas"*,
*"arranca la prospección"*, *"corre el scan de [LÍNEA]"*

- Busca contactos en Apollo por empresa + job titles
- Captura: nombre, apellido (parcial), cargo, empresa, país, **LinkedIn URL**
- Procesa en lotes de 10, guarda acumulador JSON incremental
- No consume créditos Apollo

### `apollo-fase2` — Reveal de Emails y Teléfonos (Créditos)
Activa con: *"corre Fase 2"*, *"desbloquea emails"*, *"revela emails de [LÍNEA]"*,
*"cuántos créditos necesito"*

- Enriquece contactos con emails verificados (1 crédito/contacto)
- Opcional: teléfono móvil C-Level/Director (~9 créditos/contacto)
- Desofusca apellidos de Fase 1
- Siempre muestra estimado de créditos antes de proceder

### `cobertura-empresas` — Análisis de Cobertura
Activa con: *"¿cuántas empresas faltan?"*, *"cobertura de empresas"*,
*"empresas sin contactos"*, *"gap de empresas"*

- Compara lista objetivo vs acumulador con matching fuzzy
- Muestra % de cobertura, empresas sin datos, razones
- Sugiere scan de recuperación para empresas faltantes

### `excel-master` — Generación del Excel MASTER
Activa con: *"genera el Excel"*, *"actualiza el MASTER"*, *"crea el reporte"*,
*"regenera el MASTER de [LÍNEA]"*

Genera `{LÍNEA}_Prospectos_MASTER.xlsx` con 5 pestañas:

| Pestaña              | Contenido                                               |
|----------------------|---------------------------------------------------------|
| `Prospectos {LÍNEA}` | Todos los contactos con email, LinkedIn o teléfono      |
| `Emails Verificados` | Solo contactos con email verificado (para el CRM)       |
| `Sin Contactos`      | Empresas objetivo sin ningún contacto en Apollo         |
| `Resumen`            | Stats globales + detalle por empresa                    |
| `Leyenda`            | Guía de colores, campos y KPIs del escaneo              |

## Flujo de trabajo recomendado

```
1. Fase 1     → "procesa FINAL_LINEA"
2. Cobertura  → "¿cuántas empresas faltan?"
3. Gap fill   → "escanea las empresas faltantes"   (si aplica)
4. Fase 2     → "desbloquea emails de FINAL_LINEA"
5. Excel      → "genera el MASTER de FINAL_LINEA"
```

## Requisitos

- **Apollo.io MCP** conectado en Cowork
- **Python 3.10+** con openpyxl: `pip install openpyxl --break-system-packages`
- **Carpeta de trabajo** `ApolloProspectos/` con:
  - `apollo/` — acumuladores JSON por línea
  - `resultados/` — Excel MASTER por línea
  - `[linea]_empresas.json` — listas de empresas objetivo

## Deduplicación automática

Cada vez que se corre Fase 1 o Fase 2, el plugin verifica los `persona_id`
existentes en el acumulador. Los contactos ya procesados NO se vuelven a
escanear ni se gastan créditos en ellos.
