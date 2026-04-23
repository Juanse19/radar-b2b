# ADR-001: Rename `radar-v2` → `comercial`

**Date:** 2026-04-21  
**Status:** Accepted  
**Deciders:** Juan Camilo Velez, Juan Sebastian Losada

---

## Context

The codebase uses `radar-v2` as the directory and URL prefix for the commercial intelligence module. This is a technical version label that:

- Leaks implementation details into production URLs (`/radar-v2/escanear`)
- Conflicts with the product vision of a B2B "comercial" intelligence suite
- Suggests temporality ("v2") rather than a stable bounded context
- Makes onboarding harder — "radar-v2" does not communicate the business domain

The module covers scanning, live results, investigations, reports, metrics, and scheduling — all within the **comercial** intelligence domain of Matec S.A.S.

---

## Decision

Rename the `radar-v2` bounded context to `comercial` at all layers:

| Layer | Before | After |
|-------|--------|-------|
| App directory | `app/radar-v2/` | `app/(comercial)/` |
| API routes | `app/api/radar-v2/` | `app/api/comercial/` |
| Lib | `lib/radar-v2/` | `lib/comercial/` |
| Tests | `tests/unit/radar-v2/` | `tests/unit/comercial/` |
| Nav label | "Radar v2" | "Comercial" |
| URLs | `/radar-v2/*` | `/*` (via route group — no URL prefix) |
| DB | `matec_radar.radar_v2_*` | keep physical tables; add `comercial_*` views |
| Env namespace | `radar-v2` | `comercial_dev` / `comercial_prod` |

### What does NOT change

- Physical Supabase tables (`matec_radar.radar_v2_sessions`, etc.) — renaming them would break RLS policies, foreign keys, and existing indices
- N8N workflow IDs (`jDtdafuyYt8TXISl`, `fko0zXYYl5X4PtHz`, `RLUDpi3O5Rb6WEYJ`)
- The session cookie name (`matec_session`)
- Existing migrations (untouched)
- Pinecone index name (`matec-radar`) and physical namespace (`proyectos_2026`)

---

## Rationale

### Route group `(comercial)` pattern

Next.js App Router route groups `(name)` create logical directory groupings **without** adding the group name to the URL. This means:

```
app/(comercial)/escanear/page.tsx  →  /escanear
app/(comercial)/resultados/page.tsx  →  /resultados
```

This eliminates the `/radar-v2/` URL prefix while keeping the bounded context explicit in the source tree.

### Views over physical table rename

Creating Postgres views (`comercial_sesiones`, `comercial_resultados`, etc.) over the existing physical tables provides:

- Zero-migration-risk rename at the application layer
- Backward compatibility with existing data and RLS policies
- A clean `comercial_*` namespace for future queries
- No downtime (views are created without locks)

### 301 redirects for existing bookmarks

`/radar-v2/:path*` → `/:path*` added to `next.config.mjs` ensures bookmarked URLs continue to work without 404s.

---

## Consequences

### Positive

- URLs become clean and domain-meaningful (`/escanear`, `/resultados`, `/informes`)
- Source tree communicates bounded context (`lib/comercial/`, `app/(comercial)/`)
- DB layer has a stable `comercial_*` view namespace for S1-S5 feature work
- Onboarding new developers is simpler — directory names match the business domain

### Negative / Mitigations

- Large rename touches 40+ files → mitigated by automated 7-pass find-replace script + `git mv`
- Physical tables keep `radar_v2_` prefix → acceptable; views abstract this for new code
- Existing monitoring/logging tied to `radar-v2` strings may need updating → tracked in S1

---

## Implementation

Executed in Sesión 0 (Bloque B) via:

1. `scripts/s0-rename.mjs` — 7 find-replace passes (import paths, string literals, env vars, CSS classes, comments, test descriptions, type names)
2. `git mv` for all directory renames
3. Manual review of `lib/comercial/db*.ts` files (SQL string risk)
4. Migration `supabase/migrations/20260421_100_comercial_views.sql` — 6 views
5. `next.config.mjs` redirect: `/radar-v2/:path*` → `/:path*`
