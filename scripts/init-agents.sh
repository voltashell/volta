#!/bin/bash

set -e

for i in {1..3}; do
  AGENT_DIR="shared/agents/agent-$i"
  INIT_DIR="$AGENT_DIR/init"
  CLAUDE_DIR="$AGENT_DIR/.claude"
  mkdir -p "$INIT_DIR" "$CLAUDE_DIR"
  touch "$INIT_DIR/scratchpad.txt"
  touch "$INIT_DIR/tasks.txt"
  touch "$CLAUDE_DIR/.gitkeep"
done

echo "Agent directories initialized."
