# Dispatching Parallel Agents

## When to use
Multiple independent problems exist that can be solved without shared state between investigations.

**Good candidates:**
- UI fixes in separate components (Escanear, Resultados, Métricas, Informes)
- Backend + frontend work that don't share files
- Multiple new features that are additive and don't conflict

**Don't parallelize:**
- Problems that share the same file (race condition on edits)
- Tasks where agent 2 depends on agent 1's output
- When you need full system context to solve each piece

## Process

1. **Group by domain** — identify which files each task touches
2. **Write focused prompts** — each agent gets: context, scope, goal, expected output
3. **Launch in one message** — use multiple Agent tool calls simultaneously
4. **Review integration** — check for conflicts before merging

## Prompt template for an agent

```
You are fixing [SPECIFIC ISSUE] in [FILE PATH].

Context:
- [What the file does]
- [What the bug/feature is]
- [Current code snippet if relevant]

Task:
- [Exact change to make]
- [What to verify after]

Constraints:
- Do NOT modify [files outside scope]
- Run `npm run build` after changes and confirm it passes
```

## For this project (Matec Radar B2B)

Standard parallel groups:
- **G1 Backend**: API routes, SQL queries, lib/ files
- **G2 Frontend components**: Individual page components
- **G3 Admin**: Admin pages (independent of Radar v2 components)
- **G4 Tests**: Unit + E2E (no production code changes)

Each group can run simultaneously since they rarely touch the same files.
