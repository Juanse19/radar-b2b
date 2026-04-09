// lib/db/supabase/admin.ts
// SERVER ONLY — service-role database access.
// Uses pg/query HTTP API (bypasses PostgREST schema-exposure restrictions).

import 'server-only';

export { pgQuery, pgFirst, pgLit, sql, SCHEMA, tbl } from './pg_client';
