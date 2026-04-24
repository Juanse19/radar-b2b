#!/usr/bin/env bash
# stop-push-pr.sh — On Stop: push unpushed commits and open draft PR for feature branches.
# Never force-pushes. Skips main/master. Requires `gh` CLI for PR creation.

set -euo pipefail

if ! git rev-parse --git-dir > /dev/null 2>&1; then
  exit 0
fi

BRANCH="$(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo '')"

# Never push main/master automatically
case "$BRANCH" in
  main|master|HEAD) exit 0 ;;
esac

# Only proceed on feature/claude branches
case "$BRANCH" in
  feature/*|claude/*|fix/*) ;;
  *) exit 0 ;;
esac

# Check for unpushed commits
UPSTREAM=$(git rev-parse --abbrev-ref --symbolic-full-name '@{u}' 2>/dev/null || echo '')

if [[ -z "$UPSTREAM" ]]; then
  # No upstream — push with -u
  git push -u origin "$BRANCH" 2>&1 | tail -3 >&2 || {
    echo "[git-flow] push failed — manual push required" >&2
    exit 0
  }
  echo "[git-flow] pushed new branch '$BRANCH' to origin" >&2
else
  AHEAD=$(git rev-list --count "${UPSTREAM}..HEAD" 2>/dev/null || echo 0)
  if [[ "$AHEAD" -eq 0 ]]; then
    exit 0
  fi
  git push 2>&1 | tail -3 >&2 || {
    echo "[git-flow] push failed — manual push required" >&2
    exit 0
  }
  echo "[git-flow] pushed $AHEAD commit(s) to $UPSTREAM" >&2
fi

# Try to open a draft PR via gh CLI — skip gracefully if gh not installed
if ! command -v gh > /dev/null 2>&1; then
  exit 0
fi

# Check if PR already exists for this branch
EXISTING_PR=$(gh pr list --head "$BRANCH" --json number --jq '.[0].number' 2>/dev/null || echo '')
if [[ -n "$EXISTING_PR" ]]; then
  echo "[git-flow] PR #${EXISTING_PR} already exists for '$BRANCH'" >&2
  exit 0
fi

# Derive title from branch name (replace - with spaces, capitalize)
TITLE=$(echo "$BRANCH" | sed 's|^[^/]*/||' | tr '-' ' ' | sed 's/\b\(.\)/\u\1/g')

gh pr create \
  --draft \
  --title "$TITLE" \
  --body "Draft PR auto-created by git-flow skill.

Summary pending — edit before marking ready for review.

🤖 Generated with [Claude Code](https://claude.com/claude-code)" \
  2>&1 | tail -3 >&2 || {
  echo "[git-flow] PR creation failed — run 'gh pr create --draft' manually" >&2
}

exit 0
