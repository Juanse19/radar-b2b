# PRD — Matec Radar B2B

**Versión:** 1.0 · **Fecha:** Abril 2026 · **Estado:** En producción (MVP)

---

## Problema

MATEC depende de BNAmericas ($15,000/año) para detectar proyectos de inversión en aeropuertos, plantas de cartón y centros logísticos. La cobertura es limitada a aeropuertos y no incluye las otras 5 líneas de negocio. No hay prospección automática de contactos.

## Solución

Plataforma propia de inteligencia comercial con 3 agentes IA encadenados:
1. **Calificador** — evalúa el potencial de cada empresa antes de buscar señales
2. **Radar** — detecta señales de inversión en fuentes públicas (licitaciones, expansiones, CAPEX)
3. **Prospector** — encuentra y registra contactos clave en Apollo.io

## Usuarios

| Usuario | Rol | Necesidad principal |
|---------|-----|-------------------|
| Paola Vaquero | Prospección comercial | Ver empresas ORO con contactos listos |
| Mariana / Natalia | Equipo comercial | Lista de señales por línea de negocio |
| Felipe Gaviria | Supervisión | Dashboard de cobertura y calidad |
| Juan Sebastián Losada | Developer | Administración técnica |

## Métricas de Éxito

- **Cobertura:** 829 empresas calificadas (6 líneas de negocio)
- **Velocidad:** Calificación de empresa en < 30s
- **Precisión:** Señales ORO con composite score ≥ 70
- **Prospección:** 5 contactos por empresa ORO (Apollo.io)
- **Costo:** < $400/mes vs $15,000/año BNAmericas

## Alcance MVP (Fase 1 — Completado Abril 2026)

- [x] WF01 Calificador funcional (scoring 7 factores, tier ORO/MONITOREO/ARCHIVO)
- [x] WF02 Radar funcional (Tavily, Pinecone, 6 Excel SharePoint)
- [x] WF03 Prospector funcional (Apollo.io people search, Prospection_Log GSheets)
- [x] Frontend Next.js con trigger manual y visualización de resultados
- [x] Cadena completa WF01 → WF02 → WF03 validada en producción

## Fuera de Alcance (Fase 2+)

- Integración HubSpot (pendiente acceso API)
- Migración SQLite → PostgreSQL
- Agente 04: descubrimiento de nuevas empresas
- Schedule automático diario/semanal
- Dashboard de KPIs operativos
