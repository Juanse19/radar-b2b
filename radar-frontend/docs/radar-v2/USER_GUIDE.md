# Radar v2 — Guía de Usuario

Esta guía está dirigida al equipo comercial (Paola, Mariana, Natalia) para que puedan usar el Radar v2 de manera autónoma.

## ¿Qué hace Radar v2?

Detecta **señales de inversión futura** (2026-2028) en LATAM para las líneas de negocio de Matec: BHS (aeropuertos), Intralogística (CEDI/WMS), Cartón Corrugado, Final de Línea, Motos y Solumat. Usa inteligencia artificial con búsqueda web en tiempo real.

## Flujo típico: escaneo en 3 clics

### Opción rápida — preset

1. Abre **Radar v2** en el sidebar.
2. Elige uno de los **escaneos rápidos** (BHS Colombia, Intra LATAM, Cartón Colombia, Cartón México).
3. Revisa el costo estimado y pulsa **🚀 Ejecutar escaneo**.

El sistema te lleva automáticamente a la vista **En vivo** para que sigas el progreso en tiempo real.

### Opción personalizada — wizard 3 pasos

1. Abre **Radar v2** → elige **Automático** o **Manual**.
2. **Paso 1** — selecciona la línea de negocio y confirma el modo.  El wizard avanza automáticamente cuando tienes ambos seleccionados.
3. **Paso 2** — configura:
   - **Automático**: mueve el slider para elegir la cantidad de empresas (1-20).
   - **Manual**: selecciona específicamente las empresas que quieres escanear.
   - Revisa las fuentes y palabras clave (opcional, ya están configuradas por defecto).
4. **Paso 3** — revisa el resumen + costo estimado, ajusta el budget si quieres y pulsa **Ejecutar**.

## Vistas disponibles

| Vista | Qué ves |
|---|---|
| **Escanear** | Wizard para iniciar un nuevo escaneo |
| **En vivo** | Timeline de eventos mientras corre el scan (búsquedas, fuentes leídas, señales detectadas) |
| **Resultados** | Tabla de todos los resultados históricos. Filtra por línea, activas/descartadas, ventana de compra. |
| **Métricas** | KPIs: total scans, ratio de activas, costo, breakdown por línea. |
| **Informes** | Lista de sesiones con resumen. Descarga Excel con 4 hojas. |

## Interpretar los resultados

Cada empresa escaneada tiene:

- **Radar activo: Sí / No** — ¿hay señal de inversión futura?
- **Tipo de señal** — Licitación, Expansión, CAPEX, etc.
- **Ventana de compra** — cuándo se prevé el gasto (0-6 meses, 6-12, 12-18, etc.)
- **Monto** — cifra de inversión si aparece en la fuente
- **Fuente** — URL pública verificable
- **Fuente verificada** — badge:
  - 🟢 **Verificada** — URL responde y monto/fecha coinciden
  - 🟡 **No verificable** — URL no accesible o datos no confirmados
  - ⏱️ **Pendiente** — aún no se verificó
- **Criterios cumplidos** — badge X/6 que indica cuántos criterios de inclusión cumple
- **Motivo de descarte** — si es "No", explica por qué

## Descargar Excel

Desde **Resultados** o **Informes**, haz clic en **Descargar Excel**. El archivo tiene 4 hojas:

1. **Resumen** — metadata de la sesión
2. **Señales Activas** — todas las empresas con `radar_activo = Sí`
3. **Descartadas** — las "No" con motivo de descarte
4. **Fuentes Verificadas** — URLs + status de verificación

## Control de costos

El equipo admin configura un **budget mensual**. Durante un scan:
- Al 80% del budget verás una alerta.
- Al 100% el sistema bloquea nuevos scans hasta que se libere budget.

Consulta **Admin → Tokens** para ver uso histórico.

## Empresas de prueba canónicas

Para validar que el sistema funciona:
- **DHL Supply Chain México** (Intralogística) → debería detectar señal activa
- **FedEx México** (Intralogística) → señal activa
- **UPS México** (Intralogística) → descartada sin señal reciente

## Uso del módulo Radar v2 — Guía paso a paso

### Paso 1 — Configurar API Key (primera vez)

1. Abre **Administración** → **API Keys** en el sidebar
2. Haz clic en **Agregar nueva API Key**
3. Pega tu API Key de Anthropic (Claude)
4. Selecciona como **predeterminada** si es tu proveedor principal
5. Guarda los cambios

Los siguientes módulos (Escanear, Resultados, Métricas) usarán esta API Key automáticamente.

### Paso 2 — Escanear empresas

1. Abre **Radar v2** → selecciona **Escanear**
2. Elige la(s) **línea(s) de negocio**:
   - BHS (Aeropuertos)
   - Cartón Corrugado
   - Intralogística (CEDI/WMS)
   - Final de Línea
   - Motos (Ensambladoras)
   - Solumat (Plásticos)
3. Selecciona el **modo**:
   - **Automático**: el sistema elige las N empresas de mayor relevancia (1-20)
   - **Manual**: tú seleccionas las empresas específicas
4. El wizard avanza automáticamente cuando línea + modo están configurados

### Paso 3 — Revisar configuración y costo

En el **Paso 3** del wizard:
- Se muestra un resumen de las empresas a escanear
- El **costo estimado** aparece al lado (típicamente $0.005–$0.02 USD por empresa)
- Opcionalmente, ajusta el **presupuesto máximo** con el slider si quieres poner un tope
- Revisa fuentes y palabras clave (ya están optimizadas por defecto)

Luego haz clic en **🚀 Ejecutar escaneo**.

### Paso 4 — Ver resultados en vivo

La pantalla **/radar-v2/vivo** muestra el escaneo en tiempo real:

- **Indicadores de estado** por empresa:
  - 🟡 **Escaneando** — búsqueda web en curso
  - 🟢 **Señal activa** — encontró oportunidad de inversión
  - ⚪ **Sin señal** — no hay indicios de gasto próximo
  - 🔴 **Error** — algo falló (red, API, timeout)

- **Expandir detalles**: haz clic en cualquier empresa para ver el log completo con búsquedas realizadas, fuentes leídas y criterios evaluados
- **Botón "Detener"**: cancela el escaneo si cambias de opinión (útil para large batches)
- **Panel "Historial"**: colapsable, muestra los últimos 10 escaneos con estado, costo total y duración

### Paso 5 — Revisar y filtrar resultados históricos

Abre **Radar v2** → **Resultados** para ver todas las señales detectadas:

- **Filtros disponibles**:
  - Por **línea de negocio**
  - Por **estado** (Activas / Descartadas)
  - Por **ventana de compra** (0-6 meses, 6-12, 12-18, etc.)
- **Columnas**:
  - Empresa, País, Tipo de señal, Ventana, Monto, Criterios (X/6), Fuente verificada
- **Descargar Excel**: botón en la barra superior para exportar con 4 hojas (Resumen, Señales Activas, Descartadas, Verificación de fuentes)

## Consideraciones de costo

- El **presupuesto mensual** es establecido por Admin (ver **Admin → Tokens**)
- **Consumo por scan**:
  - 1 empresa = ~$0.005–$0.02 USD (depende del proveedor de búsqueda)
  - Un scan de 20 empresas ≈ $0.10–$0.40 USD
- **Alertas de presupuesto**:
  - Al 80% aparece una alerta visual
  - Al 100%, nuevos scans se bloquean hasta que se libere budget
- Consulta **Admin → Tokens** para un breakdown histórico detallado por línea, sesión y costo

## Problemas frecuentes

| Problema | Solución |
|---|---|
| "Métricas dashboard vacío" | Ejecuta al menos un scan desde `/radar-v2/escanear` |
| "La selección no se ve" | Refresca la página — puede ser caché del navegador |
| "El scan no avanza" | Ve a **En vivo** — si no hay eventos, cancela y reintenta |
| "URL de fuente no abre" | La fuente puede estar temporalmente caída; el badge lo refleja |

## Contacto

Si encuentras un problema, avisa al equipo técnico (Juan Camilo Velez / Juan Sebastián Losada).
