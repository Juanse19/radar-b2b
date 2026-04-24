# Estándar Excel MASTER — Matec LATAM v2

Colores, estilos y código de referencia para el Excel MASTER.

## Colores por nivel

| Nivel    | Fondo       | Texto       |
|----------|-------------|-------------|
| C-LEVEL  | `FFD6E4F0`  | `FF1A3C6E`  |
| DIRECTOR | `FFD6F0DA`  | `FF1E6B2E`  |
| GERENTE  | `FFFFF3CD`  | `FF7B3F00`  |
| JEFE     | `FFEDE0F5`  | `FF4A0072`  |
| ANALISTA | `FFF0F0F0`  | `FF333333`  |

## Colores de banners

| Pestaña            | Color banner   |
|--------------------|----------------|
| Prospectos {LÍNEA} | `FF0D2137`     |
| Emails Verificados | `FF1E6B2E`     |
| Sin Contactos      | `FF4A4A4A`     |
| Resumen            | `FF1A3C6E`     |
| Leyenda            | `FF1A3C6E`     |

## Fuente: Arial en todo el archivo

- Header columnas: Arial Bold 10pt blanco sobre `FF1A3C6E`
- Banners: Arial Bold 11pt blanco
- Datos: Arial Regular 9pt
- Nivel en columna Nivel: Arial Bold 9pt (color del nivel)

## Freeze panes y filtros

- Freeze en `A3` (debajo del banner + header)
- Auto-filtro en la fila de headers (fila 2) de pestañas 1 y 2

## Anchos de columna (Pestaña 1)

```
ID            : 5   | Empresa       : 26 | País          : 14
Nombre        : 14  | Apellido      : 16 | Cargo         : 32
Nivel         : 10  | Email Verif.  : 34 | Estado Email  : 12
LinkedIn      : 40  | Tel. Empresa  : 16 | Tel. Directo  : 16
Tel. Móvil    : 16  | Persona ID    : 28
```

## Fuzzy matcher (para Sin Contactos)

```python
import unicodedata, re

STOPWORDS = {'de','del','la','el','los','las','y','e','sa','sab','cv','sac',
             'spa','ltda','inc','corp','international','mexico','colombia',
             'chile','peru','argentina','brasil','brazil','cia','compania',
             'co','group','grupo','industries'}

def normalize(s):
    s = unicodedata.normalize('NFKD', s.lower())
    s = ''.join(c for c in s if not unicodedata.combining(c))
    s = re.sub(r'[^a-z0-9\s]', ' ', s)
    return set(w for w in s.split() if w not in STOPWORDS and len(w) > 2)

def similar(a, b, threshold=0.5):
    na, nb = normalize(a), normalize(b)
    if not na or not nb: return False
    return len(na & nb) / min(len(na), len(nb)) >= threshold
```

## Código completo de generación (plantilla)

```python
import json, shutil, unicodedata, re
from openpyxl import Workbook
from openpyxl.styles import Font, PatternFill, Alignment, Border, Side
from openpyxl.utils import get_column_letter
from datetime import datetime
from collections import defaultdict

# Configurar para la línea que se procesa
LINEA       = "FINAL_LINEA"  # cambiar según línea
ACCUM_PATH  = "ApolloProspectos/apollo/final_linea_scan_results.json"
EMPRES_PATH = "final_linea_empresas.json"
OUT_PATH    = "ApolloProspectos/resultados/FINAL_LINEA_Prospectos_MASTER.xlsx"
TMP_PATH    = f"/tmp/{LINEA}_temp.xlsx"

NIVEL_BG = {'C-LEVEL':'FFD6E4F0','DIRECTOR':'FFD6F0DA','GERENTE':'FFFFF3CD',
            'JEFE':'FFEDE0F5','ANALISTA':'FFF0F0F0'}
NIVEL_FG = {'C-LEVEL':'FF1A3C6E','DIRECTOR':'FF1E6B2E','GERENTE':'FF7B3F00',
            'JEFE':'FF4A0072','ANALISTA':'FF333333'}

def thin():
    s = Side(border_style="thin", color="FFD0D0D0")
    return Border(left=s, right=s, top=s, bottom=s)

def banner(ws, cols, row, text, color):
    ws.merge_cells(f"A{row}:{get_column_letter(cols)}{row}")
    c = ws[f"A{row}"]
    c.value = text
    c.fill = PatternFill("solid", fgColor=color)
    c.font = Font(name="Arial", bold=True, color="FFFFFFFF", size=11)
    c.alignment = Alignment(horizontal="center", vertical="center")
    ws.row_dimensions[row].height = 22

def set_hdrs(ws, row, cols):
    hf = PatternFill("solid", fgColor="FF1A3C6E")
    hfont = Font(name="Arial", bold=True, color="FFFFFFFF", size=10)
    for i, h in enumerate(cols, 1):
        c = ws.cell(row=row, column=i, value=h)
        c.fill = hf; c.font = hfont
        c.alignment = Alignment(horizontal="center", vertical="center", wrap_text=True)
        c.border = thin()
    ws.row_dimensions[row].height = 20

def dcell(ws, row, col, val, nivel=None, bold=False, center=False):
    c = ws.cell(row=row, column=col, value=val)
    if nivel:
        c.fill = PatternFill("solid", fgColor=NIVEL_BG.get(nivel,'FFFFFFFF'))
        c.font = Font(name="Arial", size=9, bold=bold,
                      color=NIVEL_FG.get(nivel,'FF000000') if bold else 'FF000000')
    else:
        c.font = Font(name="Arial", size=9, bold=bold)
    c.alignment = Alignment(vertical="center", horizontal="center" if center else "left")
    c.border = thin()
    ws.row_dimensions[row].height = 15

def classify_nivel(t):
    t = (t or '').lower()
    if any(x in t for x in ['chief executive','chief operations','gerente general',
        'director general','managing director','country manager']): return 'C-LEVEL'
    if t.startswith('ceo') or ' ceo' in t or t.startswith('coo') or ' coo' in t: return 'C-LEVEL'
    if any(x in t for x in ['director','vice president',' vp ','vp ']): return 'DIRECTOR'
    if any(x in t for x in ['gerente','manager','head of']): return 'GERENTE'
    if any(x in t for x in ['analista','analyst','specialist']): return 'ANALISTA'
    return 'JEFE'

# [Cargar acumulador y empresas, filtrar, crear las 5 pestañas...]
# Ver el script completo generado durante el scan de FINAL_LINEA.
```

## Razones comunes en Sin Contactos

| Razón                                                                  | Re-escanear |
|------------------------------------------------------------------------|-------------|
| Sin dominio web — Apollo requiere dominio para búsqueda                | No          |
| Sin resultados Apollo con los job titles configurados                  | Sí          |
| Empresa muy pequeña (sin presencia en LinkedIn)                        | No          |
| Nombre diferente en Apollo (filial, división, nombre local)            | Sí          |
