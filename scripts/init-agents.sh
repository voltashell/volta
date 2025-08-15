#!/bin/bash

set -e

for i in {1..3}; do
  AGENT_DIR="shared/agents/agent-$i"
  INIT_DIR="$AGENT_DIR/init"
  mkdir -p "$INIT_DIR"
  touch "$INIT_DIR/scratchpad.txt"
  touch "$INIT_DIR/tasks.txt"
done

echo "Agent directories initialized."
