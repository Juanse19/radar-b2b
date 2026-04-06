# Guía de Usuario — Matec Radar B2B

**Para:** Paola Vaquero, Mariana, Natalia (equipo comercial Matec)

---

## ¿Qué hace el sistema?

El Radar B2B monitorea automáticamente las 829 empresas de la base de datos Matec en busca de señales de inversión (licitaciones, expansiones de planta, proyectos CAPEX). Cuando detecta una oportunidad, también encuentra los contactos clave para contactar.

**Sin intervención manual:**
- Califica cada empresa con un score 0-10
- Busca señales de inversión en internet
- Encuentra directores y gerentes en Apollo.io

---

## Acceso a la Aplicación

URL: `http://[servidor]:3000`

No requiere login en la versión actual.

---

## Páginas Principales

### 📋 Empresas (`/empresas`)
Lista completa de las 829 empresas. Usa los filtros para ver solo las de tu línea:
- **Línea de negocio:** BHS, Cartón, Intralogística, etc.
- **Tier:** ORO (alta prioridad), MONITOREO, ARCHIVO

### 🔍 Escanear (`/scan`)
Disparar el análisis para una o varias empresas:
1. Seleccionar empresas de la lista
2. Elegir línea de negocio
3. Hacer clic en **Iniciar Escaneo**
4. Esperar 30–90 segundos
5. Ver resultados en `/results`

### 📊 Resultados (`/results`)
Señales detectadas por el Radar. Cada señal muestra:
- **Empresa** y **línea de negocio**
- **Tier** (ORO / MONITOREO / ARCHIVO)
- **Tipo de señal** (expansión, licitación, CAPEX, etc.)
- **Descripción** de lo que encontró
- **Score** (0–100, mayor = más relevante)

### 👥 Contactos (`/contactos`)
Contactos encontrados en Apollo.io para empresas ORO:
- Nombre y cargo del contacto
- Empresa
- Email (disponible en Apollo directamente)
- LinkedIn

---

## Tiers: ¿Qué significa cada uno?

| Tier | Score | Qué hacer |
|------|-------|-----------|
| **ORO** ≥ 8 | Alta prioridad — señal fuerte de inversión | Contactar esta semana |
| **MONITOREO** 5–7 | Potencial medio — monitorear cada 30 días | Seguimiento mensual |
| **ARCHIVO** < 5 | Baja prioridad — sin señal activa | Sin acción inmediata |

---

## Frecuencia Recomendada

- **Empresas ORO:** Revisión semanal de señales nuevas
- **Empresas MONITOREO:** Escaneo mensual
- **Base completa:** Recalificación trimestral (el sistema la lanza automáticamente)

---

## Preguntas Frecuentes

**¿Cuánto tarda el análisis?**
Una empresa tarda ~30 segundos. Para 10 empresas, ~5 minutos.

**¿Por qué no veo señales para mi empresa?**
Si el score radar es 0, el sistema no encontró menciones de inversión en fuentes públicas esta semana. No significa que no haya oportunidad — solo que no hay información disponible en internet.

**¿Cómo contacto a los contactos de Apollo?**
Los contactos aparecen en `/contactos`. El email completo y teléfono está disponible directamente en Apollo.io con las credenciales de Matec.

**¿Puedo añadir empresas nuevas?**
Sí, pídele al developer que las agregue a la base de datos. Se pueden cargar desde el Google Sheets de la Base de Datos.
