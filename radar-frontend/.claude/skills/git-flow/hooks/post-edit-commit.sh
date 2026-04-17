#!/usr/bin/env bash
# post-edit-commit.sh — Stage specific files and commit after a Claude edit.
# Triggered by PostToolUse on Edit|Write|MultiEdit.
# Safety: never touches main/master, never uses --no-verify, never force-pushes.

set -euo pipefail

# Must be inside a git worktree
if ! git rev-parse --git-dir > /dev/null 2>&1; then
  exit 0
fi

BRANCH="$(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo '')"

# Never auto-commit on main/master
case "$BRANCH" in
  main|master|HEAD) exit 0 ;;
esac

# Skip if mid-merge or mid-rebase
if [[ -f "$(git rev-parse --git-dir)/MERGE_HEAD" ]]; then exit 0; fi
if [[ -d "$(git rev-parse --git-dir)/rebase-apply" ]]; then exit 0; fi
if [[ -d "$(git rev-parse --git-dir)/rebase-merge" ]]; then exit 0; fi

# Any actual changes?
if [[ -z "$(git status --porcelain)" ]]; then
  exit 0
fi

# Build a safe list of files to stage (exclude secrets, build outputs)
FILES_TO_STAGE=()
while IFS= read -r line; do
  # `git status --porcelain` format: XY path
  STATUS="${line:0:2}"
  FILE="${line:3}"

  # Skip untracked if in blocklist paths
  case "$FILE" in
    .env*|*.pem|*.key|*credentials*|node_modules/*|.next/*|dist/*|coverage/*)
      continue ;;
  esac

  # Skip deleted (don't auto-delete)
  [[ "$STATUS" == " D" || "$STATUS" == "D " ]] && continue

  FILES_TO_STAGE+=("$FILE")
done < <(git status --porcelain)

if [[ ${#FILES_TO_STAGE[@]} -eq 0 ]]; then
  exit 0
fi

# Stage them individually
for f in "${FILES_TO_STAGE[@]}"; do
  git add -- "$f" 2>/dev/null || true
done

# Abort if staged diff is trivial (< 3 lines)
STAGED_LINES=$(git diff --cached --numstat 2>/dev/null | awk '{s+=$1+$2} END {print s+0}')
if [[ "$STAGED_LINES" -lt 3 ]]; then
  # Unstage and exit silently
  git reset HEAD -- . > /dev/null 2>&1 || true
  exit 0
fi

# Build commit message heuristic based on staged paths
TOP_PATH=$(git diff --cached --name-only | head -1)
case "$TOP_PATH" in
  supabase/migrations/*)
    SCOPE="db"
    SUMMARY="migration changes"
    ;;
  lib/radar-v2/*)
    SCOPE="radar-v2"
    SUMMARY="update radar-v2 lib"
    ;;
  app/radar-v2/*|app/resultados-v2/*)
    SCOPE="ui"
    SUMMARY="update radar-v2 UI"
    ;;
  components/*)
    SCOPE="ui"
    SUMMARY="update components"
    ;;
  tests/*)
    SCOPE="test"
    SUMMARY="update tests"
    ;;
  docs/*|*.md)
    SCOPE="docs"
    SUMMARY="update docs"
    ;;
  .claude/skills/*)
    SCOPE="skills"
    SUMMARY="update claude skills"
    ;;
  *)
    SCOPE="chore"
    SUMMARY="sync changes"
    ;;
esac

MSG="feat(${SCOPE}): ${SUMMARY}

Co-Authored-By: Claude <noreply@anthropic.com>"

# Commit — never --no-verify, never --amend
git commit -m "$MSG" > /dev/null 2>&1 || {
  # If commit failed (hook error, etc), leave files staged for user to inspect
  echo "[git-flow] commit failed — files left staged for manual review" >&2
  exit 0
}

echo "[git-flow] committed: feat(${SCOPE}): ${SUMMARY}" >&2
exit 0
