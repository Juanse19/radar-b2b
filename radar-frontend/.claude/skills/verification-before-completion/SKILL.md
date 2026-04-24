# Verification Before Completion

## Core Rule
**Evidence before claims, always.** Never assert work is done without running the verification command and reading its output.

## The Gate (run before saying "done")

1. Identify the command that proves the claim
2. Execute it freshly (don't trust cached output)
3. Read the complete output including exit code
4. Verify the output actually confirms the claim
5. Only then state completion — with the evidence

## For this project

| Claim | Verification command |
|-------|---------------------|
| "Build passes" | `npm run build` — must end with `✓ Compiled successfully` |
| "No TypeScript errors" | `npm run build` or `tsc --noEmit` |
| "Tests pass" | `npm run test` — all green |
| "Lint clean" | `npm run lint` — 0 errors |
| "Component works" | Check browser at `localhost:3001` |
| "API returns data" | `curl` the endpoint or check network tab |

## Red flags — stop and verify before proceeding

- Saying "should work" / "probably" / "seems to" about code you just wrote
- Being about to commit without running build
- Trusting an agent's report without checking the output yourself
- Passing lint but not checking build (they catch different things)
- Changed one file but didn't verify dependent files still compile

## Key principle

Confidence ≠ evidence. The compiler is the source of truth, not your reasoning.
