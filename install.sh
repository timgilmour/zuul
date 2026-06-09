#!/usr/bin/env bash
# Install Zuul (the Gatekeeper) — bare slash commands + standalone skill.
#
#   skill    -> ~/.claude/skills/zuul      (the skill the commands drive)
#   commands -> ~/.claude/commands/         (/zuul, /zuul-prompt, /zuul-ingest,
#                                            /zuul-new, /zuul-vocab, /zuul-validate)
#   deps     -> bun install for the generator's one dependency (@google/genai)
#
# Usage:  bash install.sh
# Undo:   rm ~/.claude/commands/zuul*.md && rm -rf ~/.claude/skills/zuul
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SKILL_SRC="$ROOT/skills/zuul"
CMD_SRC="$ROOT/commands"
CMD_DEST="${CLAUDE_COMMANDS_DIR:-$HOME/.claude/commands}"
SKILL_DEST="${CLAUDE_SKILLS_DIR:-$HOME/.claude/skills}/zuul"

[ -f "$SKILL_SRC/SKILL.md" ] || { echo "error: $SKILL_SRC/SKILL.md not found" >&2; exit 1; }

mkdir -p "$CMD_DEST"
shopt -s nullglob
cmds=0
for f in "$CMD_SRC"/zuul*.md; do
  cp "$f" "$CMD_DEST/$(basename "$f")"
  echo "  command  /$(basename "$f" .md)"
  cmds=$((cmds + 1))
done
[ "$cmds" -gt 0 ] || { echo "error: no zuul*.md command files in $CMD_SRC" >&2; exit 1; }

mkdir -p "$(dirname "$SKILL_DEST")"
if command -v rsync >/dev/null 2>&1; then
  rsync -a --delete --exclude node_modules --exclude '.env' "$SKILL_SRC"/ "$SKILL_DEST"/
else
  mkdir -p "$SKILL_DEST"
  ( cd "$SKILL_SRC" && tar --exclude='node_modules' --exclude='.env' -cf - . ) | ( cd "$SKILL_DEST" && tar -xf - )
fi
echo "  skill    $SKILL_DEST"

if command -v bun >/dev/null 2>&1; then
  if ( cd "$SKILL_DEST/tools" && bun install >/dev/null 2>&1 ); then
    echo "  deps     bun install (tools/) ok"
  else
    echo "  deps     bun install failed — run it manually in $SKILL_DEST/tools"
  fi
else
  echo "  deps     bun not found — run 'bun install' in $SKILL_DEST/tools before rendering"
fi

echo
echo "Installed $cmds bare Zuul commands + the standalone zuul skill."
echo "Reload Claude Code, then use: /zuul  /zuul-prompt  /zuul-ingest  /zuul-new  /zuul-vocab  /zuul-validate"
echo "Set a provider key (GOOGLE_API_KEY / Vertex / OPENROUTER_KEY) in ~/.claude/.env."
echo "Undo: rm $CMD_DEST/zuul*.md && rm -rf $SKILL_DEST"
