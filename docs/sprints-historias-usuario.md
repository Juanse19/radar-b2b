# Sprints — Historias de Usuario y Tareas
**Proyecto:** T154000 - Soluciones Internas Team  
**Developer:** Juan Sebastián Losada  
**Última actualización:** 09-Abr-2026

---

## Leyenda de Estado

| Símbolo | Significado |
|---------|-------------|
| ✅ | Completado / Closed |
| 🔄 | En progreso / Active |
| ⏳ | Pendiente / New |
| 🔴 | Urgente / Bloqueante |

---

## SPRINT 01 — "Subagente RADAR IA Matec"
**Período:** Feb 10 – Mar 17, 2026 · 26 días hábiles · ~166 horas  
**Estado general:** ✅ Cerrado

---

### HU-08: Construir pipeline base del Subagente 300 Monitor VIP ✅
> Como equipo comercial, quiero un agente automatizado que monitoree empresas en Google Sheets y detecte señales de inversión, para identificar oportunidades ORO sin revisión manual.

| # | Tarea | Estado | Horas |
|---|-------|--------|-------|
| T01 | Diseño de arquitectura workflow N8N: triggers (Schedule + Webhook), fuente Google Sheets (829 empresas), estructura del loop | ✅ Closed | 8h |
| T02 | Configuración nodo Loop Over Items1 (splitInBatches v3) + integración dual búsqueda Tavily | ✅ Closed | 8h |
| T03 | Implementación AI Agent RADAR1 (GPT-4.1-mini) con 9 campos fijos de salida estandarizados | ✅ Closed | 8h |
| T04 | Integración Pinecone (índice matec-radar, namespace proyectos_2026) para memoria vectorial | ✅ Closed | 6h |

**Total HU-08:** 30h

---

### HU-09: Implementar routing por línea de negocio y escritura en Excel SharePoint ✅
> Como equipo comercial, quiero que los resultados se organicen automáticamente por línea de negocio en archivos Excel de SharePoint, para consultar resultados segmentados sin cruzar datos.

| # | Tarea | Estado | Horas |
|---|-------|--------|-------|
| T01 | Implementar nodo Normalizar Linea (Code, normalización NFD lowercase sin tildes) | ✅ Closed | 4h |
| T02 | Configurar nodo Switch con 6 ramas por línea de negocio (BHS, Cargo, Cartón, Intralogística, Motos, SOLUMAT) | ✅ Closed | 6h |
| T03 | Configurar 6 nodos Microsoft Excel (v2.2, dataMode: autoMap) conectados a SharePoint | ✅ Closed | 8h |
| T04 | Fix routing: reemplazar cadena IF nodes por Switch limpio (fix_router_if_chain → fix_router_v3) | ✅ Closed | 4h |
| T05 | Debug y validación de escritura en Excel (fix_sheets_automap, debug_sheets_node) | ✅ Closed | 6h |

**Total HU-09:** 28h

---

### HU-10: Integración Tavily como fuente primaria de búsqueda ✅
> Como sistema de radar, quiero buscar en fuentes especializadas (BNAmericas, SECOP, Aerocivil) además de búsqueda general, para mejorar la cobertura de señales por línea de negocio.

| # | Tarea | Estado | Horas |
|---|-------|--------|-------|
| T01 | Configurar nodo Buscar Fuentes Primarias1: query especializado por línea de negocio | ✅ Closed | 4h |
| T02 | Fix Tavily API body: parámetros search_depth, max_results, include_domains | ✅ Closed | 4h |
| T03 | Implementar nodo Fusionar Búsquedas1 (Merge) + Code JS5: normalización y priorización | ✅ Closed | 6h |
| T04 | Análisis comparativo Serper vs Tavily: evaluación cobertura LATAM, decisión técnica | ✅ Closed | 4h |
| T05 | Implementar Construir Query Tavily (Code): empresa + palabras_clave + línea + país | ✅ Closed | 4h |

**Total HU-10:** 22h

---

### HU-11: Estabilización y corrección iterativa del monolito (v4 → v9) ✅
> Como developer, quiero identificar y corregir todos los bugs del workflow en producción, para alcanzar ejecuciones sin errores bloqueantes.

| # | Tarea | Estado | Horas |
|---|-------|--------|-------|
| T01 | Fix webhook body wrapping: `raw.body \|\| raw` en Code JS4 para compatibilidad N8N v2 | ✅ Closed | 4h |
| T02 | Fix Code JS1 keywords: corrección lectura palabras_clave por empresa desde GSheets | ✅ Closed | 4h |
| T03 | Fix determinación sub-línea: reemplazar IF chain por Switch por sub-línea | ✅ Closed | 6h |
| T04 | Fix AI Auditor Validador: corrección LangChain SOP y silent `{output: {}}` | ✅ Closed | 8h |
| T05 | Fix Google Sheets: corrección Sheet ID incorrecto en Log Cliente1 (v9 Sheets Fix) | ✅ Closed | 4h |
| T06 | Implementar rotación de empresas con filtro por fecha | ✅ Closed | 10h |
| T07 | Fix data flow: corrección parámetro empresas en Code node | ✅ Closed | 4h |
| T08 | Fix normalización de línea y re-conexión nodos desconectados (Formatear para Vector1) | ✅ Closed | 6h |
| T09 | Fix headerRow en nodos Excel: first-row-as-header en lectura de fuentes | ✅ Closed | 3h |
| T10 | Actualización y activación Tavily API key v9 | ✅ Closed | 3h |
| T11 | Verificación final v9: validación pipeline completo con 3 empresas test | ✅ Closed | 4h |
| T12 | Escaneo completo línea Intralogística: ejecución batch y análisis de resultados | ✅ Closed | 4h |

**Total HU-11:** 60h

---

### HU-12: Implementar sistema de alertas Gmail para señales ORO ✅
> Como Paola Vaquero, quiero recibir un email automático cuando se detecte una señal ORO, para priorizar contacto inmediato sin revisar el sistema.

| # | Tarea | Estado | Horas |
|---|-------|--------|-------|
| T01 | Configurar nodo Gmail (OAuth): plantilla de alerta con empresa, señal, score, fuente | ✅ Closed | 4h |
| T02 | Configurar nodo IF "Es Oportunidad ORO?1" y conexión al flujo de alertas | ✅ Closed | 4h |

**Total HU-12:** 8h

---

### HU-13: Documentar arquitectura y flujo del workflow v9 ✅
> Como equipo de desarrollo, quiero documentación técnica completa del workflow de 67 nodos, para facilitar mantenimiento y onboarding.

| # | Tarea | Estado | Horas |
|---|-------|--------|-------|
| T01 | Redactar WORKFLOW_DOCUMENTATION.md: 8 grupos funcionales, 67 nodos documentados | ✅ Closed | 10h |
| T02 | Documentar bugs conocidos y fixes aplicados (v3 → v9): 10 issues con solución | ✅ Closed | 4h |
| T03 | Redactar guía de usuario (guia-usuario.md): scan manual, interpretar resultados, tiers | ✅ Closed | 4h |

**Total HU-13:** 18h

---

**TOTAL SPRINT 01: 166 horas**

---

## SPRINT 02 — "Reestructuración + Frontend Radar B2B"
**Período:** Mar 18 – Abr 4, 2026 · 14 días hábiles · ~229 horas  
**Estado general:** ✅ Cerrado

---

### HU-14: Optimización de calidad de señales IA — Versión v10 ✅
> Como equipo comercial, quiero eliminar señales falsas donde la IA inventa menciones de empresas en artículos genéricos, para que el equipo confíe en cada señal ORO reportada.

| # | Tarea | Estado | Horas |
|---|-------|--------|-------|
| T01 | Reemplazar AI Agent RADAR1 (LangChain + SOP + Postgres Memory) con HTTP Request directo a OpenAI | ✅ Closed | 8h |
| T02 | Implementar nodo Parse RADAR1 Output (Code, runOnceForEachItem): manejo dual ruta A/B | ✅ Closed | 4h |
| T03 | Crear RADAR_SYSTEM_CLEAN (6.004 chars): sin doble llave, con REGLA 5 anti-alucinación | ✅ Closed | 6h |
| T04 | Implementar Filtro Menciones Empresa (Code): verifica mención empresa en snippets Tavily | ✅ Closed | 8h |
| T05 | Agregar IF Tiene Menciones → TRUE: AI RADAR1 / FALSE: Parse directo sin llamar OpenAI | ✅ Closed | 4h |
| T06 | Reemplazar AI Agent Segmentación Cualitativa con HTTP Request OpenAI (7 campos nuevos) | ✅ Closed | 8h |
| T07 | Fix Excel dataMode autoMap en CARTON Y PAPEL y CARGO LATAM (escribían 0 filas) | ✅ Closed | 3h |
| T08 | Fix Logs_Fuentes: habilitar continueOnFail en 6 nodos para error no-bloqueante | ✅ Closed | 2h |
| T09 | Validación final v10: Bimbo (3 menciones), Minerva (0), Smurfit (0) — 0 URLs duplicadas | ✅ Closed | 4h |
| T10 | Redactar CHANGELOG_v10.md: pipeline 73 nodos, tabla resultados ejecución 228355 | ✅ Closed | 3h |

**Total HU-14:** 50h

---

### HU-15: Reestructurar monolito en arquitectura de 3 agentes independientes ✅
> Como equipo técnico, quiero separar el monolito de 75 nodos en 3 workflows N8N independientes conectados via webhook, para que un fallo en Tavily o Apollo no detenga toda la cadena.

| # | Tarea | Estado | Horas |
|---|-------|--------|-------|
| T01 | Análisis y diseño de arquitectura 3 agentes: contratos de datos, webhooks, arquitectura.md | ✅ Closed | 6h |
| T02 | Crear WF01 Calificador: scoring 7 factores (0–10), tier ORO/MONITOREO/ARCHIVO, Excel SharePoint | ✅ Closed | 10h |
| T03 | Fix Excel nodes WF01: corrección 6 nodos Excel con dataMode autoMap | ✅ Closed | 4h |
| T04 | Agregar SharePoint a WF01: integración Microsoft SharePoint por línea de negocio | ✅ Closed | 4h |
| T05 | Crear WF02 Radar: Tavily + AI RADAR1 + Segmentación + Excel + GSheets + Pinecone + Gmail | ✅ Closed | 10h |
| T06 | Crear WF03 Prospector: Apollo People Search, 5 contactos ORO / 2 MONITOREO | ✅ Closed | 8h |
| T07 | Fix WF03: corrección GSheets node y parse input compatible UPPERCASE/lowercase | ✅ Closed | 4h |
| T08 | Documentar scoring-system.md: fórmulas WF01/WF02, composite score, ejemplos prod | ✅ Closed | 4h |

**Total HU-15:** 50h

---

### HU-16: Desarrollar Frontend — Dashboard y Layout principal (Next.js) ✅
> Como usuario del Radar, quiero un dashboard web con métricas clave del sistema, para monitorear el estado del radar sin acceder directamente a N8N o Google Sheets.

| # | Tarea | Estado | Horas |
|---|-------|--------|-------|
| T01 | Setup Next.js 15 App Router + TypeScript + Tailwind + shadcn/ui + Prisma + SQLite | ✅ Closed | 6h |
| T02 | Implementar layout principal (layout.tsx, providers.tsx): Navigation sidebar, tema oscuro | ✅ Closed | 4h |
| T03 | Desarrollar página Dashboard (page.tsx): KPIGrid (4 métricas clave) + SystemStatus | ✅ Closed | 6h |
| T04 | Desarrollar charts (ScoreDistributionChart, SignalsByLineChart) con Recharts | ✅ Closed | 6h |
| T05 | Desarrollar componente RecentGoldSignals: tabla últimas señales ORO | ✅ Closed | 4h |
| T06 | Desarrollar componentes reutilizables: TierBadge, ScoreBadge, LineaBadge, PageHeader, EmptyState | ✅ Closed | 4h |

**Total HU-16:** 30h

---

### HU-17: Desarrollar Frontend — Módulo Scan (Trigger Manual) ✅
> Como Paola Vaquero, quiero lanzar un scan manual de empresas desde el navegador, para obtener resultados en tiempo real sin acceso a N8N.

| # | Tarea | Estado | Horas |
|---|-------|--------|-------|
| T01 | Implementar API route POST `/api/trigger`: llama webhook WF01, registra ejecución en SQLite | ✅ Closed | 4h |
| T02 | Desarrollar página Scan (scan/page.tsx): selector empresas, filtro línea/tier/país | ✅ Closed | 6h |
| T03 | Implementar PipelineStatus: progreso en tiempo real WF01→WF02→WF03 con polling | ✅ Closed | 6h |
| T04 | Implementar API routes GET `/api/executions` y `/api/executions/[id]` | ✅ Closed | 4h |
| T05 | Desarrollar componente ExecutionStatus: badge estado + timestamp + duración | ✅ Closed | 3h |

**Total HU-17:** 23h

---

### HU-18: Desarrollar Frontend — Módulo Results (Señales detectadas) ✅
> Como equipo comercial, quiero ver todas las señales de inversión detectadas con filtros, para priorizar qué empresas contactar esta semana.

| # | Tarea | Estado | Horas |
|---|-------|--------|-------|
| T01 | Implementar API routes GET `/api/signals` y `/api/signals/stats` | ✅ Closed | 4h |
| T02 | Desarrollar página Results (results/page.tsx): tabla paginada de señales | ✅ Closed | 6h |
| T03 | Implementar columnas tabla con filtro por tier, sort por score, export CSV | ✅ Closed | 4h |
| T04 | Desarrollar SignalDetailSheet: panel lateral deslizable con detalle completo de señal | ✅ Closed | 6h |
| T05 | Implementar loading y error states (loading.tsx, error.tsx): skeletons y UX de error | ✅ Closed | 2h |

**Total HU-18:** 22h

---

### HU-19: Desarrollar Frontend — Módulo Empresas y Contactos ✅
> Como Paola Vaquero, quiero ver el directorio de 829 empresas con su calificación y los contactos Apollo, para gestionar la prospección desde una sola pantalla.

| # | Tarea | Estado | Horas |
|---|-------|--------|-------|
| T01 | Implementar API routes CRUD `/api/companies` (GET, POST) y `/api/companies/import` | ✅ Closed | 6h |
| T02 | Desarrollar página Empresas (empresas/page.tsx): tabla filtrable por línea/tier/país | ✅ Closed | 6h |
| T03 | Desarrollar página detalle empresa ([id]/page.tsx): score breakdown 7 factores, historial | ✅ Closed | 6h |
| T04 | Implementar script importación masiva (import_empresas.js): GSheets → SQLite 829 empresas | ✅ Closed | 4h |
| T05 | Implementar API routes `/api/contacts`, `/api/contacts/sync`, `/api/prospect` | ✅ Closed | 6h |
| T06 | Desarrollar página Contactos (contactos/page.tsx + columns.tsx): tabla Apollo | ✅ Closed | 6h |

**Total HU-19:** 34h

---

### HU-20: Desarrollar Frontend — Módulo Schedule y API de resultados ✅
> Como developer, quiero configurar ejecuciones programadas del radar y consultar resultados históricos via API, para automatizar el ciclo semanal sin intervención manual.

| # | Tarea | Estado | Horas |
|---|-------|--------|-------|
| T01 | Implementar API route `/api/schedule` (GET estado, POST configurar) | ✅ Closed | 4h |
| T02 | Implementar API route `/api/results`: consolidación GSheets + SQLite para dashboard | ✅ Closed | 4h |
| T03 | Desarrollar página Schedule (schedule/page.tsx): toggle activar/desactivar, historial | ✅ Closed | 6h |

**Total HU-20:** 14h

---

### HU-21: Testing y calidad del Frontend ✅
> Como developer, quiero cobertura de tests E2E, integración y unitarios en el frontend, para detectar regresiones al hacer cambios en el pipeline.

| # | Tarea | Estado | Horas |
|---|-------|--------|-------|
| T01 | Configurar Vitest + Playwright + setup.ts con mocks de DB y N8N | ✅ Closed | 4h |
| T02 | Escribir tests unitarios: companyFilter, dateFilter, rotation, db-data | ✅ Closed | 4h |
| T03 | Escribir tests de integración: api-companies, db, schedule, trigger | ✅ Closed | 6h |
| T04 | Escribir tests E2E Playwright: home, scan, results, api | ✅ Closed | 6h |

**Total HU-21:** 20h

---

### HU-22: Documentación técnica del proyecto completo ✅
> Como equipo, quiero documentación completa del sistema para facilitar mantenimiento y onboarding futuro.

| # | Tarea | Estado | Horas |
|---|-------|--------|-------|
| T01 | Redactar PRD.md: problema, solución, usuarios, métricas de éxito, alcance MVP | ✅ Closed | 4h |
| T02 | Redactar arquitectura.md: decisiones técnicas N8N, IDs de producción, formatos de datos | ✅ Closed | 4h |
| T03 | Redactar flujo-git.md: ramas, commits, convención de PRs | ✅ Closed | 2h |
| T04 | Redactar plan-pruebas.md: estrategia testing por capa, criterios de aceptación | ✅ Closed | 3h |
| T05 | Configurar repo git, .gitignore, .env.example, README.md principal | ✅ Closed | 3h |
| T06 | Generar documento de Historias de Usuario y tareas para Azure DevOps (este sprint) | ✅ Closed | 3h |
| T07 | Crear CSV de importación masiva a Azure DevOps (azure_devops_import_HUs.csv) | ✅ Closed | 2h |

**Total HU-22:** 21h

---

**TOTAL SPRINT 02: 264 horas**

---

## SPRINT 03 — "Estabilización + Fase 2"
**Período:** Abr 7 – Abr 18, 2026 · En planificación  
**Estado general:** 🔄 En curso

---

### HU-23: Tareas pendientes críticas de sprints anteriores 🔄
> Como developer, quiero cerrar los pendientes técnicos antes de avanzar a Fase 2, para asegurar que el MVP en producción funciona de punta a punta sin intervención manual.

| # | Tarea | Estado | Urgencia |
|---|-------|--------|----------|
| T01 | 🔴 Renovar N8N API Key en n8n.event2flow.com — **expira el 10 de abril** | 🔄 En progreso | CRÍTICA |
| T02 | Renovar plan Tavily (~$30/mes) — key agotada, búsquedas detenidas | ⏳ Pendiente | Alta |
| T03 | Agregar fila de encabezados en pestaña `Logs_Fuentes` de los 6 Excel SharePoint | ⏳ Pendiente | Alta |
| T04 | Verificar que columnas de segmentación cualitativa existen en los 6 Excel SharePoint (`PRIORIDAD COMERCIAL`, `MULTIPLANTA`, `RECURRENCIA`, `REFERENTE DEL MERCADO`, `AÑO OBJETIVO`, `TICKET ESTIMADO`) | ⏳ Pendiente | Alta |
| T05 | Prueba E2E cadena completa: Smurfit Kappa → WF01 → WF02 → WF03 → frontend `/results` | ⏳ Pendiente | Media |
| T06 | Validar routing 4 líneas pendientes: Intralogística, Cargo LATAM, Motos, Final de Línea | ⏳ Pendiente | Media |
| T07 | Importar las 15 HUs al Azure DevOps usando el CSV generado | 🔄 En progreso (hoy) | Alta |

**Total HU-23 estimado:** ~20h

---

### HU-28: Gestión de proyecto y trazabilidad — Semana 1 Sprint 03 🔄
> Como developer, quiero registrar diariamente el trabajo realizado en un documento de trazabilidad, para justificar horas ante el equipo y mantener visibilidad del avance del proyecto.

#### Lunes 7 de abril

| # | Tarea | Estado | Horas |
|---|-------|--------|-------|
| T01 | Análisis del archivo AGENTS.md: evaluación de su utilidad como guía operativa para construir y modificar workflows N8N (Abr 7) | ✅ Closed | 1h |
| T02 | Documentación de utilidad del AGENTS.md: mapeo a casos de uso del proyecto Matec (fixes WF01/WF02/WF03, validación post-deploy, ciclo build→validate→deploy) (Abr 7) | ✅ Closed | 1h |
| T03 | Planificación y diseño del esquema de Historias de Usuario para Azure DevOps: estructura HU + Task + horas, mapeo a sprint existente (Abr 7) | ✅ Closed | 2h |
| T04 | Generación de 15 Historias de Usuario con 66 tareas desglosadas y horas estimadas por tarea para Sprint 01 y Sprint 02 (Abr 7) | ✅ Closed | 3h |
| T05 | Creación del CSV de importación masiva `azure_devops_import_HUs.csv` con formato nativo Azure DevOps (Work Item Type, State, Effort, Iteration Path, Tags) (Abr 7) | ✅ Closed | 1h |

**Subtotal Abr 7:** 8h

#### Martes 8 de abril

| # | Tarea | Estado | Horas |
|---|-------|--------|-------|
| T06 | Análisis del estado real de cada HU del proyecto: clasificación Closed / Active / New basada en archivos existentes en el repo (Abr 8) | ✅ Closed | 1h |
| T07 | Identificación de tareas pendientes críticas dentro de HUs cerradas: Logs_Fuentes headers, columnas segmentación Excel, renovación N8N API key, Tavily (Abr 8) | ✅ Closed | 1h |
| T08 | Generación del documento `sprints-historias-usuario.md` con trazabilidad completa de Sprint 01, 02 y 03 con leyenda de estados (Abr 8) | ✅ Closed | 2h |
| T09 | Generación del Daily Standup template (ayer/hoy) para comunicación con el equipo (Abr 8) | ✅ Closed | 0.5h |

**Subtotal Abr 8:** 4.5h

#### Miércoles 9 de abril

| # | Tarea | Estado | Horas |
|---|-------|--------|-------|
| T10 | Actualización del documento `sprints-historias-usuario.md` con trazabilidad de días anteriores (Abr 7 y Abr 8) (Abr 9) | ✅ Closed | 1h |
| T11 | Creación del skill `/daily-tracker`: agente de trazabilidad diaria que actualiza automáticamente el documento con las tareas del día y genera el daily standup (Abr 9) | ✅ Closed | 1.5h |

**Subtotal Abr 9:** 2.5h

**Total HU-28 acumulado:** 15h

---

### HU-24: Integración HubSpot ⏳
> Como Paola Vaquero, quiero que los contactos Apollo se sincronicen automáticamente a HubSpot, para gestionar el seguimiento comercial desde una sola herramienta.

| # | Tarea | Estado | Horas est. |
|---|-------|--------|------------|
| T01 | Obtener acceso API HubSpot (pendiente gestión con Felipe) | ⏳ Pendiente | — |
| T02 | Implementar nodo HubSpot en WF03: crear/actualizar contacto por empresa ORO | ⏳ Pendiente | 8h |
| T03 | Actualizar HubSpotStatusBadge en frontend con estado real desde API | ⏳ Pendiente | 4h |
| T04 | Tests de integración HubSpot: crear contacto, actualizar, no duplicar | ⏳ Pendiente | 4h |

**Total HU-24 estimado:** 16h+

---

### HU-25: Migración SQLite → PostgreSQL ⏳
> Como developer, quiero migrar la base de datos local a PostgreSQL, para soportar múltiples usuarios simultáneos y deploy en producción.

| # | Tarea | Estado | Horas est. |
|---|-------|--------|------------|
| T01 | Provisionar instancia PostgreSQL (Supabase o Railway) | ⏳ Pendiente | 2h |
| T02 | Migrar schema Prisma de SQLite a PostgreSQL | ⏳ Pendiente | 4h |
| T03 | Ejecutar migraciones y seed en PostgreSQL | ⏳ Pendiente | 3h |
| T04 | Actualizar variables de entorno y validar conexión en producción | ⏳ Pendiente | 2h |

**Total HU-25 estimado:** 11h

---

### HU-26: Schedule automático diario/semanal activado ⏳
> Como Felipe Gaviria, quiero que el radar corra automáticamente cada semana sin intervención manual, para recibir señales frescas cada lunes a primera hora.

| # | Tarea | Estado | Horas est. |
|---|-------|--------|------------|
| T01 | Definir con Felipe el cronograma operativo (día, hora, líneas por semana) | ⏳ Pendiente | 1h |
| T02 | Activar Schedule Trigger en WF01 con cron definido | ⏳ Pendiente | 2h |
| T03 | Configurar toggle en frontend Schedule page para activar/pausar desde UI | ⏳ Pendiente | 3h |
| T04 | Verificar que primera ejecución automática completa los 3 workflows sin intervención | ⏳ Pendiente | 4h |

**Total HU-26 estimado:** 10h

---

### HU-27: Agente WF04 — Descubrimiento de nuevas empresas ⏳
> Como equipo comercial, quiero un agente que encuentre empresas nuevas no registradas en la base de datos, para expandir el universo de 829 empresas actual.

| # | Tarea | Estado | Horas est. |
|---|-------|--------|------------|
| T01 | Definir criterios de descubrimiento con Felipe y Paola (sectores, países, tamaño) | ⏳ Pendiente | 2h |
| T02 | Diseñar WF04: búsqueda Apollo + Tavily por sector/país, deduplicación vs GSheets | ⏳ Pendiente | 4h |
| T03 | Implementar WF04 en N8N | ⏳ Pendiente | 12h |
| T04 | Integrar WF04 al frontend: módulo de descubrimiento | ⏳ Pendiente | 8h |

**Total HU-27 estimado:** 26h

---

## Resumen de Horas por Sprint

| Sprint | Período | HUs | Horas reales | Estado |
|--------|---------|-----|-------------|--------|
| Sprint 01 | Feb 10 – Mar 17 | HU-08 a HU-13 (6 HUs) | 166h | ✅ Cerrado |
| Sprint 02 | Mar 18 – Abr 4 | HU-14 a HU-22 (9 HUs) | 264h | ✅ Cerrado |
| Sprint 03 | Abr 7 – Abr 18 | HU-23 a HU-28 (6 HUs) | ~98h est. (15h reales) | 🔄 En curso |
| **TOTAL** | | **21 HUs · 81 Tareas** | **~528h** | |

---

## Daily Standup — Miércoles 9 de abril de 2026

### ¿Qué hice ayer (martes 8 de abril)?
- Clasifiqué el estado real de las 15 HUs del proyecto: cuáles están Closed, cuáles tienen tareas pendientes críticas y cuáles son Fase 2.
- Generé el documento completo `sprints-historias-usuario.md` con trazabilidad de Sprint 01, 02 y 03, incluyendo leyenda de estados y daily standup.
- Identifiqué tareas pendientes críticas: encabezados `Logs_Fuentes` en Excel SharePoint, columnas de segmentación cualitativa, renovación Tavily.

### ¿Qué voy a hacer hoy (miércoles 9 de abril)?
- Actualizar el documento con el trabajo de los días anteriores (Abr 7 y Abr 8) — **completado esta mañana**.
- Crear el skill `/daily-tracker` para automatizar el registro diario — **completado esta mañana**.
- 🔴 **Renovar la N8N API Key** — expira mañana viernes 10 de abril (bloqueante crítico).
- Importar las HUs al Azure DevOps usando el CSV generado.
- Crear Sprint 03 en Azure DevOps con HU-23 a HU-28.

### ¿Hay algún bloqueo?
- 🔴 **N8N API Key expira el 10 de abril (mañana)** — si no se renueva, ningún script de modificación de workflows funcionará.
- ⚠️ **Tavily key agotada** — las búsquedas del radar están detenidas hasta renovar el plan (~$30/mes).

---

## Cómo usar `/daily-tracker`

Para actualizar este documento con el trabajo de hoy, ejecuta en Claude Code:

```
/daily-tracker
```

O con argumentos directos:

```
/daily-tracker HU-28 | T12: Renovar N8N API key en n8n.event2flow.com (1h, done), T13: Importar HUs a Azure DevOps (2h, done)
```

La skill actualizará automáticamente la tabla de tareas y el daily standup.
