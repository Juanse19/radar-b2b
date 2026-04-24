# INFORME: Análisis Arquitectónico MAOA vs. Prompt RADAR v5

## Diagnóstico: ¿El Prompt v5 fusiona dos agentes?

**Respuesta corta: Sí.** El prompt v5 unificado está combinando el Agente 1 (Radar de Inversiones) y parte del Agente 2 (Scoring Automático) dentro de un mismo prompt. Esto es una desviación de la arquitectura MAOA, donde estos son dos agentes separados con funciones distintas.

### Evidencia concreta de la fusión

El prompt v5 incluye estas funciones que pertenecen a **dos agentes diferentes** en MAOA:

**Funciones del Agente 1 (Radar)** que SÍ están en el prompt v5:
- Metodología de investigación multi-paso (Secciones 1-4)
- Evaluación temporal 🔴🟡🟢 (Sección 3)
- Reglas de inclusión/descarte (Sección 4)
- Criterios de validación ≥3 de 6 (Sección 5)
- Anti-alucinación (Sección 6)
- Empresa debe aparecer en fuente (Sección 7)

**Funciones del Agente 2 (Scoring)** que TAMBIÉN están en el prompt v5:
- Score de relevancia 0-100 con tabla de puntos (Sección 9)
- Multiplicador por Tier de cliente A/B/C (Sección 9)
- Taxonomía de tipos de señal cerrada (Sección 10)
- Campo `ventana_compra` con clasificación temporal (Sección 3)
- Campo `confianza` Alta/Media/Baja
- Campo `radar_6_12m` como filtro de priorización

### ¿Por qué es un problema?

Según el blueprint MAOA (diapositiva 3): *"El sistema funciona como una línea de producción industrial. El Radar y el Scoring son la materia prima; si entra ruido, todo el sistema falla."*

Al fusionar ambos agentes en un solo prompt:

1. **Se pierde la independencia de juicio.** El mismo LLM que detecta la señal es el que la califica. Esto viola el principio MAOA de que "el vendedor no decide, el sistema califica" — aquí el mismo "vendedor" (prompt) detecta Y califica simultáneamente.

2. **Se pierde la clasificación dual TIER+TIR.** El Agente 2 de MAOA evalúa dos dimensiones separadas: TIER (la cuenta: industria, tamaño, CAPEX histórica) y TIR (la oportunidad: probabilidad, presupuesto, competencia). El prompt v5 solo tiene un score único de 0-100 que mezcla ambas dimensiones.

3. **Se dificulta la iteración.** Si quieres mejorar cómo se detectan señales, tienes que modificar el mismo prompt que también controla el scoring. En MAOA separado, puedes ajustar el Radar sin tocar el Scoring y viceversa.

---

## Recomendación: Dividir en 2 prompts

### Prompt A — Agente RADAR (Detección pura)

**Misión:** Detectar señales de inversión. Solo responde: ¿hay señal o no? ¿Qué encontró?

**Qué conserva del v5:**
- Secciones 1-8 completas (metodología, líneas de negocio, evaluación temporal, reglas, criterios, anti-alucinación, empresa en fuente, paywall)
- Taxonomía de tipos de señal (Sección 10)

**Qué elimina:**
- Sección 9 completa (scoring 0-100, multiplicadores Tier)
- Campo `score_relevancia`
- Campo `confianza` (esto lo decide el Agente 2)
- Multiplicadores por Tier

**Output JSON simplificado:**
```json
{
  "empresa_evaluada": "string",
  "radar_activo": "Sí | No",
  "linea_negocio": "BHS | Intralogística | Cartón Corrugado | null",
  "tipo_senal": "uno de los tipos válidos",
  "pais": "string",
  "empresa_o_proyecto": "string",
  "descripcion_resumen": "mín 80 palabras si Sí",
  "criterios_cumplidos": ["array"],
  "total_criterios": 0,
  "ventana_compra": "0-6 Meses | 6-12 Meses | etc.",
  "fuente_link": "URL o No disponible",
  "fuente_nombre": "tipo de fuente",
  "fecha_senal": "DD/MM/AAAA o No disponible",
  "observaciones": "string | null",
  "motivo_descarte": "obligatorio si No"
}
```

### Prompt B — Agente SCORING (Clasificación TIER + TIR)

**Misión:** Recibe el output del Agente RADAR y lo clasifica en dos dimensiones: TIER (la cuenta) y TIR (la oportunidad).

**Input:** El JSON producido por el Agente RADAR.

**Evaluación TIER (la cuenta):**
- Industria y tamaño de la empresa
- Capacidad CAPEX histórica
- Complejidad técnica de los proyectos
- País foco (Colombia, México, Chile = +1 punto)
- Resultado: Tier A, B o C

**Evaluación TIR (la oportunidad):**
- Probabilidad y timing (¿cuándo compran?)
- Presupuesto asignado (¿hay CAPEX declarado?)
- Nivel de competencia (¿quién más compite?)
- Resultado: TIR A, B o C

**Score final:** Combinación de TIER + TIR → Score 0-10 como indica MAOA.

**Output JSON:**
```json
{
  "empresa_evaluada": "string",
  "signal_id": "CO-INTRA-DHL-2026 (formato estandarizado)",
  "tier_clasificacion": "A | B | C",
  "tier_justificacion": "string",
  "tir_clasificacion": "A | B | C",
  "tir_justificacion": "string",
  "score_final": 8.5,
  "accion_recomendada": "ABM Activado | Monitoreo | Archivar",
  "radar_6_12m": "Sí | No",
  "convergencia": "Verificada | Pendiente | Sin convergencia"
}
```

---

## Los 7 Agentes MAOA: Mapa de implementación

### Agente 1: Radar de Inversiones
- **Función:** Detectar señales de inversión en LATAM.
- **Herramientas actuales:** Claude (prompt RADAR separado) + búsqueda web.
- **Implementación en Claude:** Prompt dedicado como agente en Claude Projects o via API.
- **Implementación en n8n:** Workflow que ejecuta búsquedas via Serper API → pasa resultados al prompt RADAR via API de Anthropic → guarda output en Google Sheets.
- **Estado actual:** Funcional (prompt v5, separando la parte de scoring).

### Agente 2: Scoring Automático (TIER + TIR)
- **Función:** Clasificar cada señal en dos dimensiones.
- **Herramientas:** Claude (prompt SCORING separado) que recibe el output del Agente 1.
- **Implementación en Claude:** Segundo prompt que lee el JSON del Agente 1.
- **Implementación en n8n:** Nodo que toma el output del workflow del Agente 1 → llama a Claude con prompt SCORING → escribe resultado en Google Sheets con score TIER+TIR.
- **Compuerta CRM:** Si score ≥ 8 + convergencia → crea Deal en HubSpot automáticamente.
- **Estado actual:** Parcialmente integrado en v5 (debe separarse).

### Agente 3: ABM y Prospección Quirúrgica
- **Función:** Para señales con score ≥ 8, investigar decisores en la cuenta.
- **Herramientas:** Apollo.io (búsqueda de contactos) + Claude (generación de fichas ejecutivas y secuencias de mensajes).
- **Implementación en n8n:** Trigger cuando score ≥ 8 en Google Sheets → Apollo API para buscar contactos → Claude genera secuencia de mensajes → inyecta en HubSpot como tasks/sequences.
- **Estado actual:** No implementado. Requiere cuenta Apollo.io y conexión HubSpot.

### Agente 4: Ofertas Inteligentes y Triage Técnico
- **Función:** Automatizar 70-80% de cotizaciones estándar.
- **Herramientas:** Claude (lectura de RFPs/correos → clasificación en Oferta Rápida, Media o Detallada) + templates de cotización.
- **Implementación en n8n:** Trigger desde correo/HubSpot → Claude lee el RFP → clasifica complejidad → genera borrador de oferta (Rápida: 24-48h automática / Media: IA + supervisor / Detallada: 100% humana).
- **Implementación en Claude:** Prompt dedicado con knowledge base de productos Matec (BHS, Intralogística, Cartón).
- **Estado actual:** No implementado. Requiere knowledge base de productos y precios.

### Agente 5: Pipeline y Forecast Automatizado
- **Función:** Monitorear pipeline CRM, detectar estancamientos, calibrar probabilidades.
- **Herramientas:** HubSpot API + Claude (análisis semanal).
- **Implementación en n8n:** Cron semanal → lee deals de HubSpot → Claude analiza tiempos de ciclo, detecta estancamientos (>30 días), ajusta probabilidades → genera 3 forecasts (optimista, base, conservador) → alerta por Slack/email.
- **Estado actual:** No implementado. Requiere HubSpot con deals activos.

### Agente 6: Rentabilidad y Control de Riesgo
- **Función:** Proteger el margen antes de emitir oferta final.
- **Herramientas:** Claude + datos financieros (TRM, costos logísticos, presupuestos).
- **Implementación en n8n:** Antes de enviar oferta → Claude verifica margen bruto, fluctuación TRM, desviación de costos, penalidades logísticas → alerta si margen < umbral.
- **Estado actual:** No implementado. Requiere datos de costos internos.

### Agente 7: Knowledge & Learning
- **Función:** Registrar lecciones aprendidas de cada proyecto (ganado o perdido).
- **Herramientas:** NotebookLM (como se indica en la presentación) o Claude Projects con knowledge base persistente.
- **Implementación:** Después de cada cierre → formulario que captura datos → se alimenta una base de conocimiento que informa al Agente 4 (precios, tiempos, riesgos).
- **Estado actual:** No implementado. Es el agente de más largo plazo (2028).

---

## Plan de implementación por fases (alineado con Roadmap MAOA 360 días)

### Fase 1 (0-90 días): Control y Foco
**Objetivo:** Tener el Agente 1 y Agente 2 funcionando por separado.

Acciones:
1. Separar el prompt v5 en dos prompts (RADAR y SCORING).
2. Crear ambos como agentes en Claude Projects (si se usa manualmente) o como workflows en n8n (si se automatiza).
3. Conectar salida del Agente 1 → entrada del Agente 2 via Google Sheets o directamente via n8n.
4. Establecer la compuerta: score ≥ 8 + convergencia = Deal en HubSpot.

Herramientas necesarias: Claude API (Sonnet), Google Sheets, HubSpot (básico).

### Fase 2 (91-180 días): Velocidad
**Objetivo:** Agregar Agente 3 (ABM) y Agente 4 (Ofertas).

Acciones:
1. Integrar Apollo.io para búsqueda automática de decisores.
2. Crear prompt del Agente 4 con knowledge base de productos Matec.
3. Automatizar generación de ofertas rápidas (70-80% del volumen).

Herramientas adicionales: Apollo.io, templates de cotización.

### Fase 3 (181-360 días): Escalabilidad
**Objetivo:** Completar con Agentes 5, 6 y 7.

Acciones:
1. Pipeline automatizado con HubSpot API.
2. Control de riesgo financiero (TRM, márgenes).
3. Knowledge base persistente con NotebookLM.

---

## Opciones de plataforma: Claude vs. n8n vs. Híbrido

### Opción A: Todo en Claude (manual, rápido de implementar)
- Crear cada agente como un Claude Project separado.
- El operador humano ejecuta manualmente: corre Agente 1 → copia output → pega en Agente 2.
- Ventaja: se puede empezar hoy mismo, sin infraestructura.
- Desventaja: no es automático, depende de ejecución humana.

### Opción B: n8n + Claude API (automatizado)
- n8n orquesta los workflows: triggers → búsqueda web → Claude API (Agente 1) → Claude API (Agente 2) → Google Sheets → HubSpot.
- Ventaja: ejecución 24/7 sin intervención, escalable.
- Desventaja: requiere setup técnico, servidor n8n, API keys.

### Opción C: Híbrido (recomendado para Fase 1)
- Agente 1 (RADAR) en Claude manualmente o como agente en Claude Projects.
- Agente 2 (SCORING) como segundo paso manual en Claude.
- Resultados en Google Sheets como Source of Truth.
- En Fase 2, migrar a n8n para automatización.

### Sobre los agentes nativos de Claude
Claude ahora ofrece agentes con herramientas integradas (búsqueda web, ejecución de código) que pueden funcionar como Agente 1 directamente. La limitación es que Claude no se conecta nativamente a HubSpot, Apollo o Google Sheets — para eso se necesita n8n u otra herramienta de orquestación.

---

## Conclusión

El prompt v5 es sólido como herramienta, pero viola la arquitectura MAOA al fusionar detección y clasificación. La recomendación es:

1. **Inmediato:** Dividir el v5 en Prompt RADAR (detección pura) y Prompt SCORING (clasificación TIER+TIR).
2. **Corto plazo (Fase 1):** Usar ambos prompts en Claude Projects como dos agentes manuales, con Google Sheets como base de datos intermedia.
3. **Mediano plazo (Fase 2):** Migrar a n8n + Claude API para ejecución automatizada 24/7.
4. **Largo plazo (Fase 3):** Completar los 7 agentes MAOA con integración HubSpot, Apollo, y Knowledge base.

El prompt v5 no se descarta — se divide y se fortalece. La parte de RADAR queda más limpia (solo detecta), y la parte de SCORING se enriquece con la clasificación dual TIER+TIR que MAOA requiere.
