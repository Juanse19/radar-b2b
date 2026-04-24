# Fuentes Institucionales LATAM — Registro Oficial

**Sprint A.1 — Radar v1.1**
**Fecha:** Abril 2026
**Estado:** Activo — baseline inicial. Ampliar vía panel admin `/admin/keywords`.

---

## Resumen

El WF02 Radar ejecuta **2 queries Tavily por empresa**:
1. **Query GOV** → `include_domains[]` con los dominios de esta tabla
2. **Query GEN** → keywords por línea sin restricción de dominio

Las fuentes gov producen `peso_fuente = 4–5` y son el principal indicador
de convergencia (`convergencia = true`).

---

## Colombia 🇨🇴

| Organismo | Dominio (`include_domains`) | Cobertura | Líneas |
|---|---|---|---|
| SECOP II | `secop.gov.co` | Licitaciones públicas federales | Todas |
| Colombia Compra | `colombiacompra.gov.co` | Portal central compras gov | Todas |
| ANI | `ani.gov.co` | Infraestructura, concesiones viales y aeroportuarias | BHS |
| Aerocivil | `aerocivil.gov.co` | Aeropuertos, terminales, BHS, carga | BHS / Cargo |
| ANDI | `andi.com.co` | Gremio industrial (todas las líneas) | Todas |
| DNP | `dnp.gov.co` | Planeación nacional, CONPES de inversión | Todas |

**peso_fuente asignado:** SECOP=5 · ANI=5 · Aerocivil=5 · ANDI=3 · DNP=4

---

## México 🇲🇽

| Organismo | Dominio | Cobertura | Líneas |
|---|---|---|---|
| AFAC | `afac.gob.mx` | Aviación civil, terminales, BHS | BHS / Cargo |
| CompraNet | `compranet.hacienda.gob.mx` | Licitaciones federales | Todas |
| ASUR | `asur.com.mx` | Operador aeroportuario sureste (IR) | BHS |
| GAP | `aeropuertosgap.com.mx` | Operador aeroportuario pacífico (IR) | BHS |
| OMA | `oma.aero` | Operador aeroportuario norte (IR) | BHS |
| CANAINPA | `canainpa.com.mx` | Cámara industria papel y cartón | Cartón |
| Sec. Economía | `economia.gob.mx` | Inversión extranjera, nearshoring | Intralogística |

**peso_fuente asignado:** AFAC=5 · CompraNet=5 · ASUR/GAP/OMA=4 · CANAINPA=3 · Economía=4

---

## Chile 🇨🇱

| Organismo | Dominio | Cobertura | Líneas |
|---|---|---|---|
| Mercado Público | `mercadopublico.cl` | Licitaciones estatales | Todas |
| ChileCompra | `chilecompra.cl` | Portal central compras gov | Todas |
| DGAC | `dgac.gob.cl` | Dirección aeronáutica civil | BHS / Cargo |
| MOP | `mop.gob.cl` | Ministerio obras públicas e infraestructura | BHS |
| CORFO | `corfo.cl` | Fomento industrial, CAPEX privado | Todas |

**peso_fuente asignado:** MercPúblico=5 · ChileCompra=5 · DGAC=5 · MOP=5 · CORFO=4

---

## Brasil 🇧🇷

| Organismo | Dominio | Cobertura | Líneas |
|---|---|---|---|
| ANAC | `anac.gov.br` | Aeronáutica civil, regulación aeropuertos | BHS / Cargo |
| BNDES | `bndes.gov.br` | Banco desarrollo — financiación CAPEX | Todas |
| Portal Transparência | `portaltransparencia.gov.br` | Licitaciones federales | Todas |
| Gov.br Infraestrutura | `gov.br` | Ministerio infraestructura | BHS |
| Klabin IR | `klabin.com.br` | Informes inversores — Cartón/Papel | Cartón |
| Suzano IR | `suzano.com.br` | Informes inversores — Papel | Cartón |

**peso_fuente asignado:** ANAC=5 · BNDES=4 · Transparência=5 · Gov.br=5 · Klabin/Suzano=4

---

## Perú 🇵🇪 (baseline mínimo)

| Organismo | Dominio | Cobertura |
|---|---|---|
| SEACE | `seace.gob.pe` | Sistema electrónico contrataciones estado |
| OSITRAN | `ositran.gob.pe` | Regulación infraestructura transporte |
| ProInversión | `proinversion.gob.pe` | Concesiones e inversión privada |

---

## Argentina 🇦🇷 (baseline mínimo)

| Organismo | Dominio | Cobertura |
|---|---|---|
| ArgentinaCompra | `argentinacompra.gov.ar` | Licitaciones públicas |
| Aeropuertos Argentina | `aeropuertos-argentina.gob.ar` | Operador aeroportuario estatal |

---

## Jerarquía de `peso_fuente` (nodo `Code: Clasificar Fuente`)

```
peso 5 — Gov / Licitación oficial
  Todos los dominios .gov.*, .gob.*, secop, mercadopublico, chilecompra,
  portaltransparencia, compranet, argentinacompra, seace

peso 4 — Operador público / IR corporativo blue-chip
  BNDES, CORFO, Aeropuertos Argentina, ASUR, GAP, OMA, Klabin, Suzano,
  DNP, OSITRAN, ProInversión, Secretaría Economía MX

peso 3 — Gremio / Asociación industrial
  ANDI, CANAINPA, FIAB, Fedecarton, CPC Chile, CNI Brasil

peso 2 — Prensa especializada
  aviacionline.com, aerolatinnews.com, aircargonews.net,
  packagingnews.co.uk, revista-logistica.com

peso 1 — Prensa general / blog
  Todo lo demás
```

---

## Cómo agregar nuevas fuentes

### Opción 1: Panel admin web (recomendado)
1. Ir a `/admin/keywords`
2. Seleccionar sub-línea
3. Agregar keyword con `tipo=senal`, `peso=2`
4. Los dominios se agregan en `fix_a1_fuentes_institucionales.js` y se reaplicar

### Opción 2: Editar el script directamente
En `n8n/wf02-radar/fix_a1_fuentes_institucionales.js`, sección `DOMINIOS_GOV`,
agregar el dominio al array del país correspondiente y re-ejecutar el script.

### Opción 3: Actualizar `Code: Clasificar Fuente` en n8n
En el nodo `Code: Clasificar Fuente` de WF02, agregar el dominio al Set correcto
(`GOV_DOMAINS`, `IR_DOMAINS`, o `GREMIO_DOMAINS`).

---

## Historial de cambios

| Fecha | Versión | Cambio |
|---|---|---|
| 2026-04-14 | v1.0 | Baseline inicial — 20 dominios CO/MX/CL/BR + 5 PE/AR |
