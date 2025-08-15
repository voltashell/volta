#!/bin/bash

# PTY Manager for Gemini CLI Interactive Sessions
# This script manages pseudo-terminal allocation for interactive tools

# Function to setup PTY for Gemini
setup_gemini_pty() {
    local GEMINI_PTY="/tmp/gemini-pty-${AGENT_ID}"
    
    # Clean up any existing PTY
    rm -f "$GEMINI_PTY" 2>/dev/null
    
    # Create a named pipe for PTY communication
    mkfifo "$GEMINI_PTY" 2>/dev/null
    
    # Start a background process that maintains PTY
    (
        while true; do
            # Create a PTY session for Gemini
            script -q -c "bash -c 'cat $GEMINI_PTY | gemini chat'" /dev/null 2>/dev/null
            sleep 1
        done
    ) &
    
    echo $! > /tmp/gemini-pty.pid
    echo "✅ PTY manager started for Gemini CLI (PID: $(cat /tmp/gemini-pty.pid))"
}

# Function to send input to Gemini PTY
send_to_gemini() {
    local GEMINI_PTY="/tmp/gemini-pty-${AGENT_ID}"
    if [ -p "$GEMINI_PTY" ]; then
        echo "$1" > "$GEMINI_PTY"
    else
        echo "❌ Gemini PTY not available. Starting it now..."
        setup_gemini_pty
        sleep 2
        echo "$1" > "$GEMINI_PTY"
    fi
}

# Function to start interactive Gemini session
start_gemini_interactive() {
    echo "🔮 Starting Gemini interactive session..."
    echo "📝 Type your messages and press Enter. Type 'exit' to quit."
    
    # Ensure PTY is setup
    setup_gemini_pty
    sleep 1
    
    # Interactive loop
    while true; do
        read -p "You: " input
        if [ "$input" = "exit" ]; then
            echo "👋 Exiting Gemini interactive session..."
            break
        fi
        send_to_gemini "$input"
        sleep 0.5
    done
    
    # Cleanup
    if [ -f /tmp/gemini-pty.pid ]; then
        kill $(cat /tmp/gemini-pty.pid) 2>/dev/null
        rm -f /tmp/gemini-pty.pid
    fi
}

# Main execution
case "$1" in
    setup)
        setup_gemini_pty
        ;;
    send)
        shift
        send_to_gemini "$@"
        ;;
    interactive)
        start_gemini_interactive
        ;;
    *)
        echo "Usage: $0 {setup|send <message>|interactive}"
        echo "  setup       - Setup PTY for Gemini"
        echo "  send        - Send a message to Gemini PTY"
        echo "  interactive - Start interactive Gemini session"
        exit 1
        ;;
esac