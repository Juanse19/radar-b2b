// lib/db.ts — SHIM
// Re-exports everything from the new db/ dispatcher.
// Kept for backwards compat with existing imports across API routes.

export * from './db/index';

// Legacy type aliases — kept so existing routes that import `EmpresaDB` from here still compile.
export type { EmpresaRow as EmpresaDB, EjecucionRow as EjecucionDB } from './db/types';
