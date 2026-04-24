---
name: git-flow
description: Automated git workflow for Matec Radar project. Creates commits after significant edits, pushes on session end, and opens draft PRs for feature branches. Use when committing/pushing work. Keywords — git commit, auto commit, push, pull request, PR, git-flow, worktree commit.
---

# Git Flow — Matec Radar

Automates the git lifecycle inside Claude Code sessions: **commit after edits, sync on start, push + PR on end**. Worktree-aware and safety-first.

## Why this skill exists

Juan (project owner) wants commits to happen **without asking** every time. The manual overhead of saying "ok, commit this" is the biggest source of friction. This skill encodes the policy so Claude can act autonomously.

## Safety rules (non-negotiable)

1. **Never touch `main` or `master`** without explicit `--explicit-main` flag from the user
2. **Never use `--no-verify`, `--no-gpg-sign`, or `--amend`** unless the user explicitly asks
3. **Worktree-scoped only** — operations run with `$(git rev-parse --git-dir)` as cwd; never cross-worktree
4. **Never `git add -A`** — stage specific paths; never commit `.env*`, `*.pem`, credentials, `node_modules/`, `.next/`, `dist/`
5. **Never force-push** to any remote without explicit user approval
6. **Skip hooks** is forbidden — if a hook fails, surface the error, don't bypass

## Triggers (hooks in `.claude/settings.json`)

| Event | Hook | Action |
|---|---|---|
| `PostToolUse` on `Edit\|Write\|MultiEdit` | `hooks/post-edit-commit.sh` | Stage specific files + commit if non-trivial |
| `SessionStart` | `hooks/session-start-sync.sh` | `git status` + `git fetch` (warn if diverged) |
| `Stop` | `hooks/stop-push-pr.sh` | Push unpushed commits + open draft PR on `feature/*` or `claude/*` branches |

## Commit message heuristic

When the hook fires after an edit, it needs to generate a commit message. Use this heuristic (in order):

1. If **one file** changed and file path contains `test` → `test: update <test name>`
2. If files under `supabase/migrations/` → `feat(db): <migration filename summary>`
3. If files under `lib/radar-v2/` → `feat(radar-v2): <functional summary of changes>`
4. If files under `app/radar-v2/` → `feat(ui): <component/page changed>`
5. If `.md` file only → `docs: update <filename>`
6. Otherwise → `chore: sync changes in <dir>`

All commit messages end with:
```
Co-Authored-By: Claude <noreply@anthropic.com>
```

## Commit "non-trivial" threshold

Skip commit if:
- Diff is only whitespace changes (`git diff --ignore-all-space` empty)
- Diff is <3 lines total
- Only `.tmp`, `.log`, or IDE config files changed

## When to skip

The hook should **exit 0 silently** (not fail) in these cases:
- Repo has no uncommitted changes (`git status --porcelain` empty)
- Working branch is `main`/`master` (safety)
- User has run `git rebase` or merge and is mid-conflict (`.git/MERGE_HEAD` or `.git/REBASE_HEAD` exists)

## Script language

Bash for portability. On Windows, Git Bash is assumed (ships with Git for Windows).

## Invocation note

This skill is **primarily triggered by hooks** — you don't invoke it manually. However, if the user says "commit my work" or "push this", you can invoke the helper scripts directly:

```bash
bash .claude/skills/git-flow/hooks/post-edit-commit.sh
bash .claude/skills/git-flow/hooks/stop-push-pr.sh
```

## Files

- `hooks/post-edit-commit.sh` — incremental commit after Edit/Write
- `hooks/session-start-sync.sh` — fetch + warn on session start
- `hooks/stop-push-pr.sh` — push + PR on session stop
- `lib/commit-msg-from-diff.md` — full heuristic reference

## Known limitations

- No coalescing of rapid successive edits (each Edit may trigger a commit) — tolerated for traceability; user can squash later
- `gh pr create` requires `gh` CLI authenticated on the host; skip gracefully if not available
- Force-push detection is conservative: any `--force` flag is refused
