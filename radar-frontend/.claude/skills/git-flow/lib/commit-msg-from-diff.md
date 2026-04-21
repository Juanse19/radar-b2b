# Commit message heuristic

Derives a conventional commit message from a staged diff without LLM calls (runs in shell).

## Rules (in priority order)

1. **Top path determines scope**. If files span multiple top-level dirs, the first one (alphabetical) wins.

| Top path | Scope | Default summary |
|---|---|---|
| `supabase/migrations/` | `db` | "migration changes" |
| `lib/radar-v2/` | `radar-v2` | "update radar-v2 lib" |
| `app/radar-v2/*` or `app/resultados-v2/*` | `ui` | "update radar-v2 UI" |
| `components/` | `ui` | "update components" |
| `tests/` | `test` | "update tests" |
| `docs/` or `*.md` | `docs` | "update docs" |
| `.claude/skills/` | `skills` | "update claude skills" |
| other | `chore` | "sync changes" |

2. **Type prefix**: default `feat:` for `radar-v2`, `ui`, `db`, `skills`. `docs:` for documentation. `test:` for tests. `chore:` for miscellaneous.

3. **Body** (optional): include list of changed files if > 3 files:
   ```
   feat(radar-v2): update provider pattern

   - lib/radar-v2/providers/types.ts
   - lib/radar-v2/providers/claude.ts
   - lib/radar-v2/scanner.ts
   ```

4. **Footer**: always end with
   ```
   Co-Authored-By: Claude <noreply@anthropic.com>
   ```

## Never include

- Emoji in the commit subject (keeps git log grep-friendly)
- `skip ci` or similar meta flags unless user requested
- Ticket/issue refs unless branch name has `#<id>` pattern

## When unsure

Fall back to `chore: sync changes` — this is always safe. The user can rewrite history later if needed.
