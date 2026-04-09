---
name: excel-master
description: >
  Skill para generar o regenerar el Excel MASTER de prospectos de Matec LATAM.
  Úsalo cuando el usuario diga: "genera el Excel", "actualiza el MASTER",
  "crea el reporte", "regenera el MASTER", "exporta los contactos a Excel",
  "actualiza el Excel de [línea]", "genera el MASTER de FINAL_LINEA",
  o cuando termine una Fase 1 o Fase 2 y haya que actualizar el archivo de entrega.
metadata:
  version: "0.2.0"
---

# Excel MASTER — Generación y Actualización

Generar el archivo `{LÍNEA}_Prospectos_MASTER.xlsx` con el estándar Matec.
Leer `references/excel-standard.md` para el código completo y los colores exactos.

## Prerequisito

```bash
pip install openpyxl --break-system-packages
```

## Estructura del Excel (5 pestañas)

### Pestaña 1 — `Prospectos {LÍNEA}`

**SOLO** contactos con al menos uno de: email, LinkedIn URL, o teléfono.
Contactos sin ninguno de los tres → omitir de esta pestaña.

Columnas (mismo orden que AEROPUERTOS):
`ID | Empresa | País | Nombre | Apellido | Cargo | Nivel | Email Verificado |
Estado Email | LinkedIn | Tel. Empresa | Tel. Directo | Tel. Móvil | Persona ID`

Banner: `"PROSPECTOS — {LÍNEA} | N Empresas | N Contactos | N Emails Verificados |
N LinkedIn | C-Level: N | Directors: N | Gerentes: N | Jefes: N"`

### Pestaña 2 — `Emails Verificados`

Solo contactos con `email_status = "verified"` o `"probable"`.

Columnas: `Empresa | País | Nombre | Apellido | Cargo | Nivel | Email |
LinkedIn | Tel. Empresa | Tel. Directo | Tel. Móvil`

Banner: `"EMAILS VERIFICADOS — {LÍNEA} | N contactos | N C-Level | N Directores"`

### Pestaña 3 — `Sin Contactos`

Empresas de la lista objetivo que NO tienen ningún contacto en el acumulador
(comparación fuzzy — ver cobertura-empresas skill).

Columnas: `ID | Empresa/Dominio | País | Dominio | Razón | Re-escanear?`

Banner: `"EMPRESAS SIN CONTACTOS — {LÍNEA} | N empresas | N sin dominio | N sin resultados Apollo"`

### Pestaña 4 — `Resumen`

Dos secciones:

**A — Estadísticas globales:**
- Empresas objetivo totales
- Empresas con contactos encontrados
- Empresas sin contactos
- Total contactos con datos útiles
- Con email verificado / Con LinkedIn / Con teléfono
- Desglose por nivel (C-LEVEL, DIRECTOR, GERENTE, JEFE)
- Cobertura email % / Cobertura teléfono %

**B — Detalle por empresa:**
Tabla: `Empresa | País | Total Contactos | Con Email | Con Teléfono | % Email`

### Pestaña 5 — `Leyenda`

- Resumen de KPIs del escaneo
- Descripción de campos
- Tabla de colores por nivel

## Clasificación de niveles

```python
def classify_nivel(cargo):
    t = (cargo or '').lower()
    cl = ['chief executive','chief operations','chief operating','gerente general',
          'director general','managing director','country general manager','country manager']
    if any(x in t for x in cl): return 'C-LEVEL'
    if t.startswith('ceo') or ' ceo' in t or 'ceo ' in t: return 'C-LEVEL'
    if t.startswith('coo') or ' coo' in t or 'coo ' in t: return 'C-LEVEL'
    if any(x in t for x in ['director','vice president',' vp ','vp ']): return 'DIRECTOR'
    if any(x in t for x in ['gerente','manager','head of']): return 'GERENTE'
    if any(x in t for x in ['analista','analyst','specialist','especialista']): return 'ANALISTA'
    return 'JEFE'
```

## Permiso de escritura

Si el archivo destino tiene permisos bloqueados (Windows/Mac con archivo abierto):
1. Guardar primero en `/tmp/{LINEA}_temp.xlsx`
2. Copiar con `shutil.copy2(tmp_path, out_path)`

## Matching fuzzy para Sin Contactos

Para identificar empresas objetivo sin cobertura, usar el algoritmo de
word-overlap con normalización unicode. Ver `references/excel-standard.md`
para el código completo del fuzzy matcher.

## Reporte al terminar

```
✅ Excel MASTER actualizado — [LÍNEA]
   Pestaña 1 (Prospectos)  : N contactos con datos útiles
   Pestaña 2 (Emails)      : N emails verificados
   Pestaña 3 (Sin contactos): N empresas sin datos
   Pestaña 4 (Resumen)     : N empresas cubiertas
   Pestaña 5 (Leyenda)     : guía de referencia

   C-LEVEL  : N | DIRECTOR: N | GERENTE: N | JEFE: N
```

Proporcionar enlace directo al archivo generado.
