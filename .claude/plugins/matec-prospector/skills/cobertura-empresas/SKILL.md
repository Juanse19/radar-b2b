---
name: cobertura-empresas
description: >
  Skill de análisis de cobertura de empresas para Matec LATAM. Úsalo cuando
  el usuario pregunte: "¿cuántas empresas faltan?", "cobertura de empresas",
  "empresas sin contactos", "gap de empresas", "¿qué empresas no tienen
  prospectos?", "cuántas empresas cubrimos", "empresas que faltan de escanear",
  o cuando quiera saber qué porcentaje de la lista objetivo tiene al menos un
  contacto en el acumulador.
metadata:
  version: "0.1.0"
---

# Análisis de Cobertura de Empresas

Comparar la lista de empresas objetivo de una línea contra el acumulador de
contactos para identificar cuáles empresas tienen cobertura y cuáles no.

## Pasos

1. Leer el archivo de empresas objetivo de la línea (ver `references/lineas-config.md`
   en la skill `apollo-fase1`).
2. Leer el acumulador de contactos de la línea.
3. Construir el conjunto de empresas cubiertas usando **matching fuzzy** (no exacto).
4. Calcular la brecha y presentar el reporte.

## Algoritmo de matching fuzzy

El nombre de empresa en el acumulador (campo `empresa`) puede diferir del nombre
en la lista objetivo. Usar este algoritmo de word-overlap:

```python
import unicodedata, re

STOPWORDS = {'de','del','la','el','los','las','y','e','grupo','grupo','sa','sab','cv',
             'sac','spa','ltda','inc','corp','international','mexico','colombia',
             'chile','peru','argentina','brasil','brazil','cia','compania','co'}

def normalize(s):
    s = unicodedata.normalize('NFKD', s.lower())
    s = ''.join(c for c in s if not unicodedata.combining(c))
    s = re.sub(r'[^a-z0-9\s]', ' ', s)
    words = [w for w in s.split() if w not in STOPWORDS and len(w) > 2]
    return set(words)

def similar(a, b):
    na, nb = normalize(a), normalize(b)
    if not na or not nb:
        return False
    overlap = len(na & nb) / min(len(na), len(nb))
    return overlap >= 0.5  # 50% de palabras en común = match
```

Una empresa de la lista objetivo se considera **cubierta** si al menos un
contacto del acumulador tiene una empresa que hace match fuzzy con ella.

## Reporte de cobertura

Mostrar siempre este formato:

```
📊 COBERTURA DE EMPRESAS — [LÍNEA]

   Empresas objetivo      : N
   Empresas con contactos : N (X%)
   Empresas sin contactos : N (X%)

   Distribución de contactos por empresa cubierta:
   ├─ Más de 5 contactos  : N empresas
   ├─ 2-5 contactos       : N empresas
   └─ Solo 1 contacto     : N empresas

   Empresas SIN contactos (N total):
   [lista de empresas, país, dominio]
```

## Scan de recuperación (gap fill)

Cuando el usuario quiera cubrir las empresas sin contactos, usar la skill
`apollo-fase1` con solo esas empresas como lista objetivo. Sugerirlo así:

```
📋 PARA CUBRIR LAS EMPRESAS FALTANTES:
   → Apollo tiene registros de estas N empresas:
     [lista de las que probablemente tienen datos]
   → Estas N empresas probablemente no están en Apollo:
     [empresas de nicho, regionales pequeñas, etc.]

   ¿Quieres que intente un scan de recuperación para las N empresas faltantes?
```

## Empresas que Apollo no cubre (de referencia)

Basado en scans previos de FINAL_LINEA, estas categorías de empresas
frecuentemente no aparecen en Apollo con los job titles de Matec:

- Cervecerías internacionales con presencia local mínima (ej: Quilmes, AB InBev regional)
- Filiales de P&G, Danone, Unilever con pocos empleados registrados en LATAM
- Distribuidoras y embotelladoras regionales pequeñas
- Empresas familiares sin presencia en LinkedIn

Para estas, anotar como "No disponible en Apollo" y no gastar créditos.
