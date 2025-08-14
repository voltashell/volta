#!/usr/bin/env bash
set -euo pipefail

# Navigate to the VM directory
cd /vagrant/vm

# Parse command
COMMAND=${1:-help}
AGENT_COUNT=${2:-3}

case "$COMMAND" in
  build)
    echo "Building agent image..."
    docker compose build agent
    ;;
    
  up)
    echo "Starting NATS and $AGENT_COUNT agents..."
    docker compose up -d nats
    
    # Wait for NATS to be healthy
    echo "Waiting for NATS to be ready..."
    sleep 5
    while ! docker exec nats wget --no-verbose --tries=1 --spider http://localhost:8222/healthz 2>/dev/null; do
      echo "Waiting for NATS..."
      sleep 2
    done
    
    echo "NATS is ready. Starting agents..."
    
    # Start agents with unique IDs using scale
    for i in $(seq 1 $AGENT_COUNT); do
      AGENT_NUMBER=$i docker compose run -d \
        --name agent-$i \
        -e AGENT_ID=agent-$i \
        agent
    done
    
    echo "Started $AGENT_COUNT agents"
    docker ps --filter "name=agent-" --filter "name=nats"
    ;;
    
  down)
    echo "Stopping all services..."
    docker compose down
    ;;
    
  logs)
    if [ -z "${2:-}" ]; then
      docker compose logs -f
    else
      docker compose logs -f $2
    fi
    ;;
    
  status)
    docker compose ps
    ;;
    
  scale)
    if [ -z "${2:-}" ]; then
      echo "Usage: $0 scale <number>"
      exit 1
    fi
    echo "Scaling to $2 agents..."
    docker compose up -d --scale agent=$2 agent
    ;;
    
  test)
    echo "Publishing a test task to NATS..."
    docker run --rm --network vm_bus natsio/nats-box:latest \
      nats pub tasks.test '{"id":"test-001","type":"test","data":"Hello agents!"}' \
      --server nats://nats:4222
    ;;
    
  *)
    echo "Usage: $0 {build|up|down|logs|status|scale|test} [agent_count]"
    echo ""
    echo "Commands:"
    echo "  build         - Build the agent Docker image"
    echo "  up [count]    - Start NATS and specified number of agents (default: 3)"
    echo "  down          - Stop all services"
    echo "  logs [service]- View logs (optionally for specific service)"
    echo "  status        - Show status of all services"
    echo "  scale <count> - Scale agents to specified number"
    echo "  test          - Publish a test task to NATS"
    ;;
esac