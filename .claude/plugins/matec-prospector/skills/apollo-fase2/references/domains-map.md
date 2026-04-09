# Mapa de Dominios Conocidos — Empresas LATAM

Usar estos dominios en el campo `domain` de `apollo_people_bulk_match` cuando
el dominio en el acumulador esté incorrecto o vacío.

## Correcciones conocidas (errores frecuentes en Fase 1)

| Empresa                         | Dominio CORRECTO       | Dominio INCORRECTO (evitar) |
|---------------------------------|------------------------|-----------------------------|
| Grupo Bimbo                     | grupobimbo.com         | jumex.com                   |
| Grupo Arcor                     | arcor.com              | jumex.com                   |
| Grupo AJE                       | grupoaje.com           | jumex.com                   |
| Industrias San Miguel (Perú)    | sanmiguel.com.pe       | jumex.com                   |
| Compañía Nacional de Chocolates | cnch.com.co            | jumex.com                   |
| Plastilene                      | plastilene.com         | jumex.com                   |
| Mondelēz International          | mdlz.com               | mondelez.com (secundario)   |
| Coca-Cola Andina                | koandina.com           | cokeandina.com (alternativo)|
| Grupo Lala                      | lala.com.mx / grupolala.com | —                      |
| Tetra Pak                       | tetrapak.com           | —                           |
| HEINEKEN México                 | heineken.com           | —                           |
| Coca-Cola FEMSA                 | coca-colafemsa.com     | —                           |
| Agrosuper                       | agrosuper.com          | —                           |
| Arauco                          | arauco.com             | —                           |

## Nota operativa

Si un batch de Fase 2 devuelve todos `null` con matches_found = 0, la primera
causa a revisar es que el `domain` en el acumulador esté incorrecto. Corregir
el dominio y volver a disparar ese batch.
