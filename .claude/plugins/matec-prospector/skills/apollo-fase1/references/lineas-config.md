# Configuración de Líneas de Negocio — Matec LATAM

Referencia completa para todas las líneas de negocio soportadas.

## Estructura de directorios

```
ApolloProspectos/
├── apollo/
│   ├── solumat_scan_results.json
│   ├── aeropuertos_scan_results.json
│   ├── motos_scan_results.json
│   ├── cargo_scan_results.json
│   ├── carton_papel_scan_results.json
│   └── final_linea_scan_results.json
├── resultados/
│   ├── SOLUMAT_Prospectos_MASTER.xlsx
│   ├── AEROPUERTOS_Prospectos_MASTER.xlsx
│   ├── MOTOS_Prospectos_MASTER.xlsx
│   ├── CARGO_Prospectos_MASTER.xlsx
│   ├── CARTON_PAPEL_Prospectos_MASTER.xlsx
│   └── FINAL_LINEA_Prospectos_MASTER.xlsx
└── [linea]_empresas.json   ← lista de empresas objetivo por línea
```

## Tabla de líneas

| Código       | Nombre completo           | Empresas est. | Países principales                                     |
|--------------|---------------------------|---------------|--------------------------------------------------------|
| SOLUMAT      | Soluciones de Materiales  | ~286          | Mexico, Colombia, Chile, Perú, Argentina               |
| AEROPUERTOS  | Sistemas BHS / Aeropuertos| ~175          | Mexico, Colombia, Chile, Perú, Argentina, Brasil       |
| MOTOS        | Motocicletas              | ~60           | Mexico, Colombia, Chile                                |
| CARGO        | Logística / Carga         | ~120          | Mexico, Colombia, Chile, Perú, Argentina               |
| CARTON_PAPEL | Cartón Corrugado / Papel  | ~150          | Mexico, Colombia, Chile, Brasil, Argentina             |
| FINAL_LINEA  | Alimentos & Bebidas       | ~186          | Mexico, Colombia, Chile, Perú, Argentina, Brasil, Guatemala |

## Formato del archivo de empresas (JSON)

```json
[
  {
    "empresa": "Nombre completo de la empresa",
    "pais": "Mexico",
    "dominio": "empresa.com.mx"
  }
]
```

O bien en formato objeto con clave `empresas`:

```json
{
  "empresas": [
    { "empresa": "...", "pais": "...", "dominio": "..." }
  ]
}
```

## Formato del acumulador JSON

```json
{
  "linea": "FINAL_LINEA",
  "fecha_inicio": "2026-04-01",
  "fecha_update": "2026-04-07",
  "contacts": [
    {
      "persona_id":   "60f1ac8bbb54130001d7a392",
      "nombre":       "Adolfo",
      "apellido":     "Castro",
      "cargo":        "CEO",
      "empresa":      "ASUR",
      "pais":         "Mexico",
      "linkedin":     "http://www.linkedin.com/in/adolfo-castro-35998011",
      "has_email":    true,
      "has_phone":    false,
      "batch":        1,
      "email":        "acastro@asur.com.mx",
      "email_status": "verified",
      "tel_empresa":  "+525552840400",
      "tel_directo":  "",
      "tel_movil":    "",
      "fase2_done":   true
    }
  ]
}
```

## Notas de deduplicación

- Usar `persona_id` como clave primaria de deduplicación.
- Nunca sobreescribir un contacto que ya tenga `fase2_done: true`.
- Si un contacto existe y `fase2_done: false`, puede re-procesarse en Fase 2.
- Los apellidos ofuscados (e.g. `"Tr***o"`) se revelan en Fase 2.
- El campo `linkedin` se captura en Fase 1 y se verifica/enriquece en Fase 2.
