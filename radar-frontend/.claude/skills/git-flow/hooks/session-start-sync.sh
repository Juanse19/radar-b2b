#!/usr/bin/env bash
# session-start-sync.sh — On SessionStart: status + fetch, warn on divergence.
# Read-only: never modifies the working tree.

set -euo pipefail

if ! git rev-parse --git-dir > /dev/null 2>&1; then
  exit 0
fi

BRANCH="$(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo '')"
REMOTE="$(git config --get "branch.${BRANCH}.remote" 2>/dev/null || echo '')"

# Show status summary
DIRTY_COUNT=$(git status --porcelain | wc -l | tr -d ' ')
if [[ "$DIRTY_COUNT" -gt 0 ]]; then
  echo "[git-flow] branch '$BRANCH' has $DIRTY_COUNT uncommitted change(s)" >&2
fi

# Fetch (best-effort, don't fail the hook)
if [[ -n "$REMOTE" ]]; then
  git fetch --quiet "$REMOTE" 2>/dev/null || true

  # Check divergence
  AHEAD=$(git rev-list --count "${REMOTE}/${BRANCH}..HEAD" 2>/dev/null || echo 0)
  BEHIND=$(git rev-list --count "HEAD..${REMOTE}/${BRANCH}" 2>/dev/null || echo 0)

  if [[ "$BEHIND" -gt 0 ]]; then
    echo "[git-flow] ⚠ branch '$BRANCH' is $BEHIND commit(s) behind ${REMOTE}/${BRANCH}" >&2
  fi
  if [[ "$AHEAD" -gt 0 ]]; then
    echo "[git-flow] ↑ branch '$BRANCH' has $AHEAD unpushed commit(s)" >&2
  fi
fi

exit 0
