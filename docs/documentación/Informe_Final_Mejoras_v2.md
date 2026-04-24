# Informe Final — MAOA Radar v2 Mejorado
## Resumen ejecutivo del plan completo

---

## Estado actual vs estado objetivo

### Lo que ya tienes funcionando
- Módulo Radar v2 integrado en tu aplicación
- Módulo Resultados v2 funcionando
- API de Claude conectada
- Escaneo básico de empresas
- Base de datos en Supabase

### Lo que necesita escalarse
- No hay control de costos (tokens consumidos sin visibilidad)
- No hay flexibilidad de modelo (atado solo a Claude)
- Falta el panel de fuentes y keywords en frontend
- La ejecución es opaca (no ves qué hace el agente en vivo)
- No hay wizard guiado para el equipo comercial
- Módulo cronograma sigue sin funcionar
- No hay optimizaciones de costo activas

### Lo que te entrega este plan
Una plataforma escalable, multi-modelo, con control financiero granular,
experiencia de usuario premium, y optimizaciones que pueden bajar el costo
de $70/mes a $15/mes manteniendo la calidad.

---

## 7 mejoras propuestas en orden de prioridad

| # | Mejora | Impacto | Esfuerzo | ROI |
|---|--------|---------|----------|-----|
| 1 | Sistema de tokens + preview | Crítico | Medio | Muy Alto |
| 2 | Fuentes y keywords en frontend | Alto | Bajo | Alto |
| 3 | Wizard 3 pasos guiado | Alto | Bajo | Alto |
| 4 | Streaming tipo Perplexity | Medio-Alto | Alto | Alto |
| 5 | Unificación con tabs | Medio | Medio | Medio |
| 6 | Multi-modelo (Claude/GPT/Gemini) | Medio | Alto | Medio |
| 7 | Optimizaciones de costo | Alto | Medio | Muy Alto |

---

## Puntos clave que pediste

### Sistema de tokens (tu preocupación principal)

Tres niveles de control:

**Nivel 1 — Preview antes de ejecutar**
Cuando el usuario configura un escaneo, ve EXACTAMENTE cuánto costará:
- 1 empresa → costo específico
- Varias empresas → suma proyectada
- Lote completo → total con desglose
- Comparativa con el presupuesto restante

**Nivel 2 — Tracking durante ejecución**
Cada llamada a la API registra tokens reales (no estimados).
Se guarda en `token_usage_log` con: operación, modelo, tokens in/out, cached, costo.

**Nivel 3 — Dashboard de administración**
- KPIs: consumo mes actual, proyección fin de mes, empresas escaneadas
- Gráficos: consumo diario, desglose por operación, desglose por modelo
- Alertas automáticas al 50%, 80%, 95%, 100% del presupuesto
- Bloqueo automático si se supera el límite

### Matriz configurable de consumo

Tabla en Supabase donde el admin define:
- Cuánto consume en promedio un scan de radar (ej: 6500 in + 800 out)
- Cuánto consume un scoring (ej: 2300 in + 500 out)
- Cuánto consume búsqueda de contactos (ej: 4000 in + 1000 out)
- Cuánto consume calificación (ej: 3000 in + 600 out)

Cuando el usuario va a ejecutar, el sistema multiplica por la cantidad de empresas
y muestra el costo estimado. Si el admin ajusta la matriz (porque cambian los
costos de la API), todos los cálculos se actualizan automáticamente.

### Multi-modelo (Claude, OpenAI, Gemini)

Provider pattern: una interfaz común (`AIProvider`) con implementaciones
específicas para cada API. El usuario puede:
- Cambiar el modelo por defecto del sistema
- Elegir modelo específico en cada escaneo
- Ver costos comparativos antes de decidir
- Testear conectividad desde admin

Opciones disponibles:
- Claude Sonnet 4.6 (default, balance calidad/precio)
- Claude Opus 4.6 (máxima calidad, más caro)
- Claude Haiku 4.5 (rápido, para pre-filtros)
- GPT-5 (alternativa OpenAI)
- GPT-4o (alternativa OpenAI barata)
- Gemini 3 Pro (alternativa Google)

### Fuentes y keywords en frontend

Secciones colapsables en la vista de configuración:

**Fuentes institucionales (25 precargadas):**
- 🇨🇴 Colombia: SECOP, ANI, Aerocivil, ANDI, DNP
- 🇲🇽 México: AFAC, CompraNet, ASUR/GAP/OMA, CANAINPA, SE
- 🇨🇱 Chile: Mercado Público, DGAC, MOP, CORFO, ChileCompra
- 🇧🇷 Brasil: ANAC, BNDES, Klabin/Suzano, Infraestrutura, Transparência
- 🌍 Generales: BNAmericas, T21, Logistec, LinkedIn

Cada fuente muestra su peso (P2 a P5) y puede habilitarse/deshabilitarse.
Auto-configuración por línea (BHS activa solo fuentes aeroportuarias, etc.).

**Keywords (25+ precargadas):**
Por línea de negocio, editables, agregables. Ejemplo BHS: terminal pasajeros,
sistema BHS, carrusel equipaje, CUTE CUSS CBIS, ampliación aeropuerto, etc.

**CRUD admin:**
En el módulo administración, CRUD completo para agregar/editar/eliminar
fuentes y keywords. Import masivo desde CSV.

### Streaming tipo Perplexity

En lugar de una barra de progreso estática, el usuario ve en vivo:
- Las sub-preguntas que formula el agente
- Las queries de búsqueda que ejecuta
- Las fuentes que va leyendo (con URL visible)
- La evaluación de cada criterio
- El momento exacto donde detecta o descarta la señal

Implementación: streaming de la API de Claude + Supabase Realtime para emitir
eventos al frontend. Experiencia visual tipo "el agente está pensando".

### Wizard 3 pasos

Para el equipo comercial que no es técnico:

**Paso 1: ¿Qué quieres escanear?**
- Presets rápidos (1 clic)
- O configuración personalizada (auto/manual)

**Paso 2: Configura los detalles**
- Línea de negocio
- Empresas
- Opciones avanzadas colapsadas (fuentes, keywords, modelo)

**Paso 3: Revisa y ejecuta**
- Resumen claro
- Costo estimado
- Tiempo estimado
- Budget restante después

Un usuario nuevo llega al paso 3 en menos de 1 minuto sin tocar configuraciones
avanzadas. Un usuario experto puede expandir las opciones y personalizar todo.

### Tabs dentro de Radar v2

5 tabs en un solo módulo:

1. **Escanear** → nueva ejecución (wizard 3 pasos)
2. **En vivo** → ver escaneo en progreso (streaming)
3. **Resultados** → histórico de señales (tabla + detalle)
4. **Cronograma** → programación automática (reemplaza el módulo roto)
5. **Análisis** → tendencias y comparativas

Todo centralizado. El usuario no tiene que saltar entre módulos.

### Optimizaciones de costo

5 estrategias apiladas que bajan el costo de $70 a $15/mes:

1. **Prompt Caching** — el system prompt se cachea, 30% ahorro
2. **Batch API** — para cron nocturno, 50% ahorro adicional
3. **Routing por Tier** — TIER C usa Haiku (más barato), mix ahorra 30%
4. **Pre-filtro Haiku** — evita scan completo si no hay indicios
5. **Cache 7 días** — no re-escanea la misma empresa dentro del período

Proyección con TODAS las optimizaciones activas: $15/mes para 300 empresas.
Sobra $45 de presupuesto para pruebas, experimentación y picos.

---

## Equipo de 10 agentes para ejecutar el plan

1. **Arquitecto (coordinador)** — valida cada entrega, coordina agentes
2. **Arquitecto Backend** — capa multi-modelo, schema tokens, streaming
3. **Arquitecto Frontend** — estructura tabs, wizard, componentes
4. **Arquitecto UI/UX** — adaptación al design system, microinteracciones
5. **Senior Backend** — implementación Edge Functions, providers
6. **Senior Frontend** — componentes, streaming view, dashboard
7. **Senior Full Stack** — integración, Realtime, performance
8. **n8n Experto** — cronograma funcional, workflows automáticos
9. **QA / Testing** — unit, integration, E2E con Playwright
10. **Code Reviewer + Documentación** — revisa PRs, documenta

---

## Skills nuevas a crear automáticamente

- `streaming-sse-supabase` — streaming con Server-Sent Events
- `token-tracking-analytics` — registro y análisis de consumo
- `multi-model-abstraction` — provider pattern para múltiples APIs
- `playwright-e2e-wizards` — tests de flujos multi-paso
- `cost-optimization-ai` — caching, batching, routing inteligente
- `supabase-realtime-subscriptions` — actualizaciones en vivo desde DB

---

## Plan de sprints (3-4 semanas)

### Sprint 1: Fundamentos (3-5 días)
- Schema SQL extendido
- Provider pattern backend
- Panel tokens admin (solo lectura)
- Preview de costos

### Sprint 2: UX enriquecida (5-7 días)
- Fuentes + keywords frontend
- CRUD admin
- Wizard 3 pasos
- Tabs en Radar v2

### Sprint 3: Tiempo real (5-7 días)
- Streaming en Edge Function
- Vista Perplexity
- Cronograma funcional
- Integración n8n

### Sprint 4: Optimización (3-5 días)
- Prompt caching
- Batch API
- Pre-filtro Haiku
- Cache 7 días
- Tests E2E completos
- Documentación final

---

## Proyección de resultados

### En capacidad
- Antes: 1 empresa a la vez, configuración rígida
- Después: 50+ empresas por lote, configuración flexible, preview de costos

### En costos
- Antes: $70/mes sin optimizaciones
- Después: $15-$35/mes con optimizaciones (-78% ahorro máximo)

### En experiencia
- Antes: "¿Está funcionando? No sé qué está pasando..."
- Después: "Veo al agente pensando en vivo, con costos y tiempos claros"

### En flexibilidad
- Antes: atado a Claude, difícil cambiar
- Después: 6 modelos intercambiables sin cambiar código

### En control
- Antes: no sabes cuánto gastaste hasta que llega la factura
- Después: dashboard en vivo, alertas, bloqueos automáticos

---

## Archivos entregables de esta sesión

| Archivo | Contenido |
|---------|-----------|
| `CASO_2_Plan_Mejoras_v2.md` | Plan detallado de las 7 mejoras con código de ejemplo |
| `Informe_Final_Mejoras_v2.md` | Este resumen ejecutivo |

Para Claude Code:
1. Pasarle `CASO_2_Plan_Mejoras_v2.md` como plan principal
2. El prompt maestro está al final de ese archivo, listo para copiar
3. Claude Code asignará las tareas a tus agentes existentes
4. Ejecución en 4 sprints secuenciales

---

## Qué debes validar antes de arrancar

1. **Presupuesto mensual confirmado**: $60/mes suficiente con optimizaciones.
   Si quieres más margen, subir a $100/mes.

2. **Modelos a habilitar**: ¿Solo Claude o también OpenAI/Gemini como backup?

3. **Decisión de Supabase**: ¿Usar instancia local para desarrollar y
   producción para usuarios reales? ¿O solo producción?

4. **Cronograma por día**: Confirmar qué línea escanear cada día:
   - Lunes: ¿BHS? (50 empresas)
   - Martes: ¿Intralogística? (50 empresas)
   - Miércoles: ¿Cartón Corrugado? (50 empresas)
   - Jueves: ¿BHS continuación? (50 empresas)
   - Viernes: ¿Mix o revisión? (30 empresas)

5. **Alertas**: ¿Email, Slack, ambos? ¿A quién?

6. **Pre-filtro Haiku**: ¿Lo implementamos en Sprint 1 o después de validar
   que el scan completo funciona bien?

---

## Siguiente paso inmediato

1. Revisa este informe y el plan detallado
2. Responde las preguntas de validación
3. Pasa ambos archivos a Claude Code en tu repositorio
4. Ejecuta el prompt maestro al final de `CASO_2_Plan_Mejoras_v2.md`
5. Claude Code ejecuta Fase 0 (análisis) y te pide aprobación
6. Apruebas y arrancas con Sprint 1

Con este plan, el Radar v2 pasa de ser una herramienta básica a ser una
plataforma de inteligencia comercial escalable y controlada financieramente.
