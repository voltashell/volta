'use client'

import React, { useEffect, useRef } from 'react'
import { Terminal } from 'xterm'
import { FitAddon } from 'xterm-addon-fit'
import { WebLinksAddon } from 'xterm-addon-web-links'
import 'xterm/css/xterm.css'
import io, { Socket } from 'socket.io-client'

interface TerminalProps {
  containerName: string
}

export default function WebTerminal({ containerName }: TerminalProps) {
  const terminalRef = useRef<HTMLDivElement>(null)
  const xtermRef = useRef<Terminal | null>(null)
  const socketRef = useRef<Socket | null>(null)
  const fitAddonRef = useRef<FitAddon | null>(null)
  const isExitedRef = useRef<boolean>(false)
  const hasInitializedRef = useRef<boolean>(false)
  const inputDisabledRef = useRef<boolean>(true)

  useEffect(() => {
    if (!terminalRef.current) return

    // Create terminal instance with enhanced configuration
    const term = new Terminal({
      cursorBlink: true,
      fontSize: 14,
      fontFamily: 'Menlo, Monaco, "Courier New", monospace',
      convertEol: true,  // Properly handle line endings
      scrollback: 10000,  // Keep more history
      allowProposedApi: true,  // Enable proposed APIs for better compatibility
      macOptionIsMeta: true,  // Better Mac keyboard support
      disableStdin: false,  // Allow input
      theme: {
        background: 'var(--background)',
        foreground: 'var(--foreground)',
        cursor: 'var(--primary)',
        black: 'var(--terminal-black)',
        red: 'var(--terminal-red)',
        green: 'var(--terminal-green)',
        yellow: 'var(--terminal-yellow)',
        blue: 'var(--terminal-blue)',
        magenta: 'var(--terminal-magenta)',
        cyan: 'var(--terminal-cyan)',
        white: 'var(--terminal-white)',
        brightBlack: 'var(--terminal-bright-black)',
        brightRed: 'var(--terminal-bright-red)',
        brightGreen: 'var(--terminal-bright-green)',
        brightYellow: 'var(--terminal-bright-yellow)',
        brightBlue: 'var(--terminal-bright-blue)',
        brightMagenta: 'var(--terminal-bright-magenta)',
        brightCyan: 'var(--terminal-bright-cyan)',
        brightWhite: 'var(--terminal-bright-white)',
      }
    })

    // Add addons
    const fitAddon = new FitAddon()
    const webLinksAddon = new WebLinksAddon()
    term.loadAddon(fitAddon)
    term.loadAddon(webLinksAddon)

    // Open terminal in DOM
    term.open(terminalRef.current)
    
    // Hide scrollbar but keep scroll functionality
    if (terminalRef.current) {
      const terminalElement = terminalRef.current.querySelector('.xterm-viewport') as HTMLElement
      if (terminalElement) {
        // Hide scrollbar using CSS
        terminalElement.style.scrollbarWidth = 'none' // Firefox
        ;(terminalElement.style as any).msOverflowStyle = 'none' // IE/Edge
        // For Webkit browsers (Chrome, Safari)
        const style = document.createElement('style')
        style.textContent = `
          .xterm-viewport::-webkit-scrollbar {
            display: none;
          }
        `
        document.head.appendChild(style)
      }
    }
    
    // Store refs first
    xtermRef.current = term
    fitAddonRef.current = fitAddon
    
    // Fit after a small delay to ensure DOM is ready
    setTimeout(() => {
      if (fitAddonRef.current && terminalRef.current) {
        try {
          fitAddonRef.current.fit()
        } catch (error) {
          console.warn('Failed to fit terminal:', error)
        }
      }
    }, 50)

    // Connect to socket; prefer configured URL, fallback to same-origin
    const wsUrl = process.env.NEXT_PUBLIC_WEBSOCKET_URL || undefined
    const socket = wsUrl ? io(wsUrl, {
      transports: ['websocket', 'polling']
    }) : io('/', {
      transports: ['websocket', 'polling']
    })
    socketRef.current = socket

    // Request terminal session with a slight delay to ensure proper initialization
    setTimeout(() => {
      socket.emit('create-terminal', containerName)
    }, 100)

    // Handle terminal output with auto-scroll to bottom
    socket.on('terminal-output', (data: { container: string; data: string }) => {
      if (data.container === containerName) {
        term.write(data.data)
        // Auto-scroll to bottom after writing new data
        setTimeout(() => {
          term.scrollToBottom()
        }, 0)
      }
    })

    // Handle terminal closed
    socket.on('terminal-closed', (data: { container: string }) => {
      if (data.container === containerName) {
        isExitedRef.current = true
        term.write(`\r\n[Terminal session closed]\r\n`)
        term.write('\r\n[Press Enter to restart the terminal]\r\n')
        // Auto-scroll to bottom after writing status messages
        setTimeout(() => {
          term.scrollToBottom()
        }, 0)
      }
    })

    // Handle terminal errors
    socket.on('error', (data: { container: string; message: string }) => {
      if (data.container === containerName) {
        term.write(`\r\n[Error: ${data.message}]\r\n`)
        // Auto-scroll to bottom after writing error messages
        setTimeout(() => {
          term.scrollToBottom()
        }, 0)
      }
    })
    
    // Handle terminal created successfully
    socket.on('terminal-created', (data: { container: string; message: string }) => {
      if (data.container === containerName) {
        console.log(`Terminal created for ${containerName}: ${data.message}`)
        
        // Auto-send Enter key for agent containers to bypass Gemini startup screen
        if (containerName.startsWith('agent-') && !hasInitializedRef.current) {
          setTimeout(() => {
            socket.emit('terminal-input', { container: containerName, input: '\r' })
            hasInitializedRef.current = true
            inputDisabledRef.current = false
            console.log(`Auto-sent Enter key to ${containerName} to bypass startup screen`)
          }, 2000) // Wait 2 seconds for startup screen to fully load
        } else if (!containerName.startsWith('agent-')) {
          // For non-agent containers (like NATS), enable input immediately
          inputDisabledRef.current = false
        }
      }
    })

    // Send input to server
    term.onData((data) => {
      // Block input if disabled (waiting for initial Enter)
      if (inputDisabledRef.current && !isExitedRef.current) {
        return
      }
      
      // Check if terminal has exited and user pressed Enter to restart
      if (isExitedRef.current && data === '\r') {
        isExitedRef.current = false
        hasInitializedRef.current = false
        inputDisabledRef.current = true
        term.clear()
        socket.emit('create-terminal', containerName)
        // Auto-scroll to bottom after clearing
        setTimeout(() => {
          term.scrollToBottom()
        }, 0)
      } else if (!isExitedRef.current) {
        socket.emit('terminal-input', { container: containerName, input: data })
      }
    })

    // Handle resize
    const handleResize = () => {
      if (fitAddonRef.current && xtermRef.current && terminalRef.current) {
        try {
          fitAddonRef.current.fit()
          socket.emit('terminal-resize', {
            container: containerName,
            cols: xtermRef.current.cols,
            rows: xtermRef.current.rows
          })
        } catch (error) {
          console.warn('Failed to resize terminal:', error)
        }
      }
    }

    window.addEventListener('resize', handleResize)
    term.onResize(({ cols, rows }) => {
      if (socket && socket.connected) {
        socket.emit('terminal-resize', { container: containerName, cols, rows })
      }
    })

    // Initial size with delay
    setTimeout(() => {
      handleResize()
    }, 100)

    // Cleanup
    return () => {
      window.removeEventListener('resize', handleResize)
      socket.emit('terminal-stop', { container: containerName })
      socket.disconnect()
      term.dispose()
    }
  }, [containerName])

  return (
    <div className="h-full w-full bg-background p-2">
      <div ref={terminalRef} className="h-full w-full" />
    </div>
  )
}
