#!/bin/bash

# Start the agent in background
node dist/index.js &
AGENT_PID=$!

# Start SSH daemon if requested
if [ "$ENABLE_SSH" = "true" ]; then
    # Generate host keys if they don't exist
    if [ ! -f /etc/ssh/ssh_host_rsa_key ]; then
        ssh-keygen -f /etc/ssh/ssh_host_rsa_key -N '' -t rsa
    fi
    
    # Start SSH daemon
    /usr/sbin/sshd -D &
    SSH_PID=$!
fi

# Keep container running and handle signals
cleanup() {
    echo "Shutting down..."
    kill $AGENT_PID 2>/dev/null
    if [ ! -z "$SSH_PID" ]; then
        kill $SSH_PID 2>/dev/null
    fi
    exit 0
}

trap cleanup SIGTERM SIGINT

# Wait for agent process
wait $AGENT_PID