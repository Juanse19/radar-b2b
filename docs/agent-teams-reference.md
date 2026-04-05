# Agent Teams — Guía de Referencia Maestra

> Fuente oficial: https://code.claude.com/docs/en/agent-teams
> Versión mínima requerida: Claude Code v2.1.32+
> Estado: Experimental (habilitado con flag)

---

## ¿Qué son los Agent Teams?

Un **Agent Team** es un conjunto de sesiones Claude Code coordinadas, donde:
- Una sesión actúa como **Team Lead** (coordinador)
- El resto son **Teammates** (trabajadores independientes)
- Se comunican via **buzón de mensajes** y **lista de tareas compartida**

A diferencia de los subagentes (que solo reportan resultados al agente principal), los teammates pueden **comunicarse directamente entre sí**, desafiar hipótesis, y auto-asignarse trabajo.

---

## Cuándo Usar Agent Teams vs. Subagentes

| Criterio | Subagentes | Agent Teams |
|---|---|---|
| Contexto | Ventana propia; resultados vuelven al llamador | Ventana propia; totalmente independientes |
| Comunicación | Solo reportan al agente principal | Los teammates se mensajean directamente |
| Coordinación | El agente principal gestiona todo | Lista de tareas compartida con auto-coordinación |
| Mejor para | Tareas enfocadas donde solo importa el resultado | Trabajo complejo que requiere debate y colaboración |
| Costo en tokens | Menor: resultados resumidos al contexto principal | Mayor: cada teammate es una instancia Claude separada |

### Usar Subagentes cuando:
- Las tareas son secuenciales
- Se edita el mismo archivo
- Hay muchas dependencias entre pasos
- Solo importa el resultado final, no el proceso

### Usar Agent Teams cuando:
- Las tareas son **genuinamente paralelas e independientes**
- Los trabajadores necesitan debatir y compartir hallazgos
- Se trabaja en módulos/capas diferentes (frontend, backend, tests)
- Se investigan hipótesis competidoras
- Se necesita revisión multidimensional simultánea

---

## Habilitación

### Opción 1: settings.json (permanente)
```json
{
  "env": {
    "CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS": "1"
  }
}
```

### Opción 2: Variable de entorno (sesión)
```bash
export CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1
```

---

## Cómo Iniciar un Team

Describe la tarea y la estructura del equipo en lenguaje natural:

```text
Estoy diseñando una herramienta CLI para rastrear comentarios TODO.
Crea un agent team para explorar esto desde distintos ángulos:
un teammate en UX, uno en arquitectura técnica, uno de abogado del diablo.
```

Claude crea el equipo, spawnea los teammates, y coordina el trabajo automáticamente.

---

## Controles del Team Lead

### Especificar teammates y modelos
```text
Crea un equipo con 4 teammates para refactorizar estos módulos en paralelo.
Usa Sonnet para cada teammate.
```

### Requerir aprobación de plan antes de implementar
```text
Spawnea un teammate arquitecto para refactorizar el módulo de autenticación.
Requiere aprobación del plan antes de que hagan cambios.
```
Flujo: Teammate planea → Lead revisa → Aprueba o rechaza con feedback → Teammate implementa.

### Asignación de tareas
- **Lead asigna**: dile al lead qué tarea darle a cuál teammate
- **Auto-claim**: los teammates toman la siguiente tarea disponible al terminar la anterior
- **Dependencias**: las tareas bloqueadas se desbloquean automáticamente cuando sus dependencias se completan

### Comunicación directa con teammates
- **In-process mode**: `Shift+Down` para ciclar entre teammates → escribe para enviar mensaje → `Escape` para interrumpir
- **Split-pane mode**: click directo en el panel del teammate
- `Ctrl+T` para mostrar/ocultar la lista de tareas

### Apagar teammates
```text
Pídele al teammate investigador que se apague
```

### Limpiar el team
```text
Limpia el equipo
```
**IMPORTANTE**: Siempre usar el Lead para hacer cleanup. Nunca un teammate.

---

## Modos de Visualización

| Modo | Descripción | Requisito |
|---|---|---|
| `in-process` (default) | Todos los teammates corren en tu terminal principal | Ninguno |
| `split-pane / tmux` | Cada teammate tiene su propio panel | tmux o iTerm2 |
| `auto` | Split panes si ya estás en tmux, in-process si no | — |

Configurar en settings.json:
```json
{
  "teammateMode": "in-process"
}
```

O pasar como flag para una sesión:
```bash
claude --teammate-mode in-process
```

**Nota**: Split-pane NO funciona en VS Code integrated terminal, Windows Terminal, ni Ghostty.

---

## Arquitectura Interna

```
Team Lead (sesión principal)
├── Teammates (sesiones Claude independientes)
├── Task List (~/. claude/tasks/{team-name}/)
│   ├── pending
│   ├── in-progress
│   └── completed (con dependencias resueltas automáticamente)
└── Mailbox (mensajería inter-agentes)

Config: ~/.claude/teams/{team-name}/config.json
```

### Contexto de los Teammates
- Cada teammate carga: `CLAUDE.md`, MCP servers, skills del proyecto
- **NO** hereda el historial de conversación del lead
- Solo recibe el **spawn prompt** que el lead le envía
- El contexto específico de la tarea debe incluirse en ese prompt

### Permisos
- Los teammates heredan los permisos del lead al ser spawneados
- Si el lead usa `--dangerously-skip-permissions`, todos los teammates también
- Se pueden cambiar permisos individuales después del spawn, no antes

---

## Hooks de Control de Calidad

| Hook | Cuándo se ejecuta | Efecto con exit code 2 |
|---|---|---|
| `TeammateIdle` | Cuando un teammate está por ponerse idle | Envía feedback y mantiene al teammate trabajando |
| `TaskCreated` | Cuando se está creando una tarea | Previene la creación y envía feedback |
| `TaskCompleted` | Cuando se va a marcar una tarea como completada | Previene la compleción y envía feedback |

Usar hooks para gates de calidad automáticos (ej: tests deben pasar antes de marcar completo).

---

## Mejores Prácticas

### 1. Dale contexto suficiente al spawn prompt
Los teammates NO heredan la conversación del lead. Include todo lo necesario:
```text
Spawnea un teammate revisor de seguridad con el prompt:
"Revisa el módulo de autenticación en src/auth/ por vulnerabilidades.
Foco en manejo de tokens, gestión de sesiones, y validación de inputs.
La app usa JWT tokens en cookies httpOnly. Reporta issues con severidad."
```

### 2. Tamaño de equipo óptimo
- **Empezar con 3-5 teammates** para la mayoría de workflows
- **5-6 tareas por teammate** para mantener productividad sin context switching excesivo
- Más teammates = más coordinación overhead + más tokens
- 3 teammates enfocados > 5 teammates dispersos

### 3. Tamaño correcto de tareas
- **Muy pequeñas**: el overhead de coordinación supera el beneficio
- **Muy grandes**: los teammates trabajan demasiado tiempo sin check-ins
- **Correcto**: unidades auto-contenidas con un deliverable claro (una función, un archivo de tests, una revisión)

### 4. Evitar conflictos de archivos
Nunca asignar el mismo archivo a dos teammates. Diseñar el trabajo para que cada teammate posea un conjunto diferente de archivos.

### 5. Monitorear y dirigir activamente
No dejar el equipo correr sin supervisión. Check-ins regulares, redirigir enfoques que no funcionan, sintetizar hallazgos a medida que llegan.

### 6. Esperar que los teammates terminen
Si el lead empieza a implementar en lugar de delegar:
```text
Espera a que tus teammates completen sus tareas antes de proceder
```

### 7. Empezar con research y review
Para equipos nuevos con agent teams, empezar con tareas sin código: revisar un PR, investigar una librería, depurar un bug. Menos riesgo de conflictos.

---

## Casos de Uso con Prompts de Ejemplo

### Revisión de código paralela
```text
Crea un agent team para revisar el PR #142. Spawnea tres revisores:
- Uno enfocado en implicaciones de seguridad
- Uno verificando impacto en performance
- Uno validando cobertura de tests
Que cada uno revise y reporte sus hallazgos.
```

### Debugging con hipótesis competidoras
```text
Los usuarios reportan que la app se cierra después de un mensaje.
Spawnea 5 teammates para investigar hipótesis distintas.
Que se debatan entre sí para intentar refutar las teorías de los otros,
como un debate científico. Actualiza el doc de hallazgos con el consenso.
```

### Desarrollo de nuevas funcionalidades
```text
Necesito implementar el sistema de autenticación.
Crea un equipo con 3 teammates:
- Uno para el módulo backend (src/auth/)
- Uno para el middleware de API (src/middleware/)
- Uno para los tests de integración (tests/auth/)
```

### Investigación multi-perspectiva
```text
Estoy evaluando si adoptar [tecnología X].
Crea un team de 3 teammates:
- Uno investiga ventajas técnicas y casos de éxito
- Uno investiga desventajas, limitaciones y casos de falla
- Uno analiza el fit con nuestra arquitectura actual
Que compartan hallazgos y lleguen a una recomendación consensuada.
```

---

## Limitaciones Conocidas (Experimental)

| Limitación | Impacto | Workaround |
|---|---|---|
| Sin reanudación de sesión con teammates in-process | `/resume` no restaura teammates | Spawnear nuevos teammates tras resumir |
| Estado de tareas puede retrasarse | Tareas bloqueadas por falta de marcado | Actualizar manualmente o pedirle al lead que recuerde al teammate |
| Apagado lento | Los teammates terminan su request actual | Esperar o monitorear |
| Un solo team por sesión | No se pueden manejar múltiples equipos | Limpiar antes de crear uno nuevo |
| Sin equipos anidados | Teammates no pueden spawnear sub-teammates | Solo el Lead puede gestionar el equipo |
| Lead fijo | No se puede transferir el liderazgo | El creador del team es Lead de por vida |
| Split panes limitado | No funciona en VS Code/Windows Terminal/Ghostty | Usar in-process mode |

---

## Troubleshooting Rápido

**Teammates no aparecen**
→ Presionar `Shift+Down` (pueden estar corriendo pero no visibles)
→ Verificar que tmux esté instalado: `which tmux`

**Demasiadas solicitudes de permisos**
→ Pre-aprobar operaciones comunes en permission settings antes de spawnear

**Teammates se detienen por errores**
→ Usar `Shift+Down` para ver su output → dar instrucciones adicionales directamente

**Lead termina antes de que el trabajo esté completo**
→ Decirle explícitamente que continúe o que espere a sus teammates

**Sesiones tmux huérfanas**
```bash
tmux ls
tmux kill-session -t <session-name>
```

---

## Costos y Token Management

- Cada teammate = una instancia Claude separada = tokens propios
- Los costos escalan **linealmente** con el número de teammates activos
- `broadcast` (mensaje a todos) multiplica el costo por número de teammates — usar con moderación
- Para tareas de rutina: sesión única más costo-efectiva
- Para research/review/features paralelas: el costo extra generalmente vale la pena

---

## Relacionado

- [Subagentes](https://code.claude.com/docs/en/sub-agents) — delegación ligera dentro de una sesión
- [Git Worktrees](https://code.claude.com/docs/en/common-workflows#run-parallel-claude-code-sessions-with-git-worktrees) — sesiones paralelas manuales sin coordinación automatizada
- [Hooks](https://code.claude.com/docs/en/hooks) — automatización de gates de calidad
- [Costos de Agent Teams](https://code.claude.com/docs/en/costs#agent-team-token-costs) — guía de uso de tokens
