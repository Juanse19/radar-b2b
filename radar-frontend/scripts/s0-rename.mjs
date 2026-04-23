/**
 * s0-rename.mjs — Sesión 0 find-replace pass
 *
 * 7 passes over all .ts/.tsx/.mjs/.json/.md files under radar-frontend/:
 *   1. @/lib/radar-v2 → @/lib/comercial (TS alias imports)
 *   2. @/components/radar-v2 → @/components/comercial (TS alias imports)
 *   3. /api/radar-v2 → /api/comercial (fetch() calls, route references)
 *   4. /radar-v2/ in href/Link/redirect strings → / (route group removes prefix)
 *   5. "radar-v2" env var keys → "comercial" (NEXT_PUBLIC_* etc, NOT DB table names)
 *   6. RadarV2 type/class prefix → Comercial (TypeScript identifiers)
 *   7. radar-v2 in comments and test descriptions (cosmetic)
 *
 * EXCLUDED: supabase/migrations/** — never touch migration files
 * EXCLUDED: SQL strings inside lib/comercial/db*.ts (verified manually after)
 *
 * Run: node scripts/s0-rename.mjs [--dry-run]
 */

import { readFileSync, writeFileSync, readdirSync } from 'fs';
import { join, relative, extname, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const ROOT = dirname(dirname(__filename)); // scripts/../ = radar-frontend root
const DRY = process.argv.includes('--dry-run');

const EXTENSIONS = new Set(['.ts', '.tsx', '.mjs', '.cjs', '.json', '.md', '.css']);

const EXCLUDED_DIRS = new Set([
  'node_modules',
  '.next',
  '.git',
  'migrations', // never touch supabase migrations
  '.claude',    // skills, rules — not part of the bounded context rename
]);

// Specific files that must not be rewritten
const EXCLUDED_FILES = new Set([
  'ADR-001-rename-radar-v2-to-comercial.md', // ADR preserves historical "radar-v2" terms
]);

/** @type {[RegExp, string, string][]} — [pattern, replacement, description] */
const PASSES = [
  // Pass 1: TS alias imports lib
  [/from ['"]@\/lib\/radar-v2\//g, "from '@/lib/comercial/", 'TS alias @/lib/radar-v2'],
  [/import\(['"]@\/lib\/radar-v2\//g, "import('@/lib/comercial/", 'dynamic import @/lib/radar-v2'],
  [/(["'])@\/lib\/radar-v2\//g, "$1@/lib/comercial/", 'string literal @/lib/radar-v2'],

  // Pass 2: TS alias imports components
  [/from ['"]@\/components\/radar-v2\//g, "from '@/components/comercial/", 'TS alias @/components/radar-v2'],
  [/(["'])@\/components\/radar-v2\//g, "$1@/components/comercial/", 'string literal @/components/radar-v2'],

  // Pass 3: API route paths in fetch/axios/Route Handler references
  [/\/api\/radar-v2\//g, '/api/comercial/', 'API route path /api/radar-v2/'],

  // Pass 4: URL paths in href, Link, router.push, redirect (but NOT DB table names)
  // "/radar-v2/" in JS string/JSX context → "/" — catches navigation hrefs
  [/(['"\`])\/radar-v2\/([a-z])/g, "$1/$2", 'URL path /radar-v2/ in strings'],
  // "href="/radar-v2"" exact (without trailing slash — the landing)
  [/(['"\`])\/radar-v2(['"\`])/g, "$1/comercial$2", 'URL /radar-v2 landing → /comercial'],

  // Pass 5: Env var namespaces (PINECONE_NAMESPACE, etc.) — NOT Supabase table names
  [/PINECONE_NAMESPACE_V2/g, 'PINECONE_NAMESPACE_COMERCIAL', 'env PINECONE_NAMESPACE_V2'],
  [/'radar-v2'(\s*\/\/\s*namespace)/g, "'comercial'$1", 'namespace string literal radar-v2'],

  // Pass 6: TypeScript identifier prefixes RadarV2 → Comercial
  [/\bRadarV2([A-Z])/g, 'Comercial$1', 'TS type prefix RadarV2'],
  [/\bRadarV2\b/g, 'Comercial', 'TS type RadarV2 standalone'],

  // Pass 7: Comments and test descriptions — only the hyphenated form "radar-v2"
  // radar_v2 (underscored) is SKIPPED here — DB table names must stay as radar_v2_*
  // Remaining radar-v2 occurrences after passes 1-6 are in comments, test strings, and docs
  [/radar-v2/g, 'comercial', 'remaining radar-v2 string (comments/tests)'],
];

function shouldSkip(filePath) {
  const rel = relative(ROOT, filePath);
  const parts = rel.split(/[\\/]/);
  for (const part of parts) {
    if (EXCLUDED_DIRS.has(part)) return true;
  }
  // Never touch migration files
  if (rel.includes('migrations') && rel.endsWith('.sql')) return true;
  // Never touch this script itself
  if (rel.includes('s0-rename.mjs')) return true;
  // Specific excluded files
  const basename = parts[parts.length - 1];
  if (EXCLUDED_FILES.has(basename)) return true;
  return false;
}

let totalFiles = 0;
let modifiedFiles = 0;

function processFile(filePath) {
  if (shouldSkip(filePath)) return;
  const ext = extname(filePath);
  if (!EXTENSIONS.has(ext)) return;

  const original = readFileSync(filePath, 'utf8');
  let content = original;

  for (const [pattern, replacement] of PASSES) {
    content = content.replace(pattern, replacement);
  }

  totalFiles++;
  if (content !== original) {
    modifiedFiles++;
    const rel = relative(ROOT, filePath);
    console.log(`  MODIFIED: ${rel}`);
    if (!DRY) {
      writeFileSync(filePath, content, 'utf8');
    }
  }
}

function walk(dir) {
  const entries = readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      if (!EXCLUDED_DIRS.has(entry.name)) walk(full);
    } else {
      processFile(full);
    }
  }
}

console.log(`\n=== s0-rename.mjs ${DRY ? '(DRY RUN)' : '(LIVE)'} ===`);
console.log(`Root: ${ROOT}\n`);

walk(ROOT);

console.log(`\nDone. Scanned ${totalFiles} files, modified ${modifiedFiles}.`);
if (DRY) console.log('No files written (--dry-run).');
