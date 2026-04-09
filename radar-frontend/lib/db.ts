// lib/db.ts — SHIM
// Re-exports everything from the new db/ dispatcher.
// Kept for backwards compat with existing imports across API routes.
// Remove `export { prisma }` at end of Phase D once all routes are migrated.

export * from './db/index';

// Direct Prisma client export — used by legacy `import { prisma } from '@/lib/db'`
// in routes that haven't been migrated yet. Remove after Phase D.
export { prisma } from './db/prisma/client';

// Legacy type aliases — kept so existing routes that import `EmpresaDB` from here still compile.
export type { EmpresaRow as EmpresaDB, EjecucionRow as EjecucionDB } from './db/types';
