---
name: apollo-fase2
description: >
  Skill de enriquecimiento Fase 2 para Matec LATAM usando Apollo.io. Úsalo cuando
  el usuario diga: "corre Fase 2", "desbloquea emails", "revela emails", "enriquece
  contactos", "revela teléfonos", "desbloquea C-Level", "emails para [línea]",
  "cuántos créditos necesito para Fase 2", o cuando pida obtener emails verificados
  y/o teléfonos móviles de contactos ya escaneados en Fase 1.
metadata:
  version: "0.2.0"
---

# Apollo Fase 2 — Reveal de Emails y Teléfonos (Consume Créditos)

Enriquecer los contactos del acumulador usando `apollo_people_bulk_match` para
obtener emails verificados, LinkedIn URLs completas y teléfonos.

> ⚠️ **Esta fase consume créditos Apollo.** Siempre mostrar estimado al usuario
> y esperar confirmación antes de proceder.

## Qué revela Fase 2

| Campo          | Costo       | Notas                                      |
|----------------|-------------|--------------------------------------------|
| Email          | ~1 crédito  | Solo si `email_status = "verified"`        |
| LinkedIn URL   | incluido    | Se confirma/enriquece en esta fase         |
| Tel. empresa   | incluido    | Teléfono de la empresa (no personal)       |
| Tel. móvil     | ~9 créditos | Solo si el usuario lo pide explícitamente  |
| Apellido completo | incluido | Desofusca apellidos parciales de Fase 1    |

## Estimado de créditos (mostrar ANTES de proceder)

```
Contactos C-LEVEL sin email  : N × 1 crédito = N
Contactos DIRECTOR sin email : N × 1 crédito = N
Contactos GERENTE sin email  : N × 1 crédito = N
Contactos JEFE sin email     : N × 1 crédito = N
─────────────────────────────────────────────────
Total estimado (solo email)  : N créditos

Con teléfono móvil (C-Level + Director únicamente):
  N contactos × 9 créditos = N créditos adicionales
```

## Priorización

Procesar en este orden (mayor valor comercial primero):

1. C-LEVEL sin `fase2_done`
2. DIRECTOR sin `fase2_done`
3. GERENTE sin `fase2_done`
4. JEFE sin `fase2_done`

## Llamada a apollo_people_bulk_match

Máximo 10 contactos por llamada:

```json
{
  "details": [
    {
      "id":                "persona_id del acumulador",
      "first_name":        "nombre del contacto",
      "organization_name": "nombre de la empresa",
      "domain":            "dominio.com"
    }
  ],
  "reveal_personal_emails": true
}
```

Disparar hasta 5 batches de 10 en paralelo para velocidad máxima.

## Procesamiento de la respuesta

```json
{
  "matches": [
    {
      "id":           "persona_id",
      "first_name":   "nombre",
      "last_name":    "apellido COMPLETO (desofuscado)",
      "email":        "email@empresa.com",
      "email_status": "verified | probable | invalid | null",
      "linkedin_url": "https://linkedin.com/in/...",
      "account": {
        "phone": "+52 55 1234 5678"
      }
    }
  ]
}
```

Para cada match no nulo, actualizar el contacto en el acumulador:
- `apellido` ← `last_name` (si mejora el actual)
- `email` ← `email`
- `email_status` ← `email_status`
- `linkedin` ← `linkedin_url`
- `tel_empresa` ← `account.phone`
- `fase2_done` ← `true`

Si el match es `null`: marcar `fase2_done: true` igualmente (no reintentar).

## Resultados grandes (>100k chars)

Cuando Apollo guarda el resultado en archivo en lugar de devolverlo inline,
leer el archivo desde la ruta indicada en el mensaje de error y procesar igual.

## Corrección de dominios

Si un batch retorna todos `null`, verificar primero los dominios en el acumulador.
Ver `references/domains-map.md` para la lista de dominios corregidos conocidos.

## Reporte al terminar

```
✅ FASE 2 COMPLETA — [LÍNEA]
   Contactos procesados   : N
   Emails verificados     : N  (+N nuevos)
   Emails probables       : N
   Sin email encontrado   : N
   Con teléfono empresa   : N
   Créditos consumidos    : ~N

📋 SIGUIENTE PASO:
   Regenerar Excel MASTER → "actualiza el MASTER de [LÍNEA]"
```
