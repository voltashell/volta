'use client'

import React, { useEffect, useRef } from 'react'
import { Terminal } from 'xterm'
import { FitAddon } from 'xterm-addon-fit'
import { WebLinksAddon } from 'xterm-addon-web-links'
import 'xterm/css/xterm.css'
import io from 'socket.io-client'

interface TerminalProps {
  containerName: string
}

export default function WebTerminal({ containerName }: TerminalProps) {
  const terminalRef = useRef<HTMLDivElement>(null)
  const xtermRef = useRef<Terminal | null>(null)
  const socketRef = useRef<any>(null)
  const fitAddonRef = useRef<FitAddon | null>(null)

  useEffect(() => {
    if (!terminalRef.current) return

    // Create terminal instance
    const term = new Terminal({
      cursorBlink: true,
      fontSize: 14,
      fontFamily: 'Menlo, Monaco, "Courier New", monospace',
      theme: {
        background: '#1a1a1a',
        foreground: '#ffffff',
        cursor: '#ffffff',
        black: '#000000',
        red: '#ff5555',
        green: '#50fa7b',
        yellow: '#f1fa8c',
        blue: '#6272a4',
        magenta: '#ff79c6',
        cyan: '#8be9fd',
        white: '#bfbfbf',
        brightBlack: '#4d4d4d',
        brightRed: '#ff6e67',
        brightGreen: '#5af78e',
        brightYellow: '#f4f99d',
        brightBlue: '#caa9fa',
        brightMagenta: '#ff92d0',
        brightCyan: '#9aedfe',
        brightWhite: '#e6e6e6',
      }
    })

    // Add addons
    const fitAddon = new FitAddon()
    const webLinksAddon = new WebLinksAddon()
    term.loadAddon(fitAddon)
    term.loadAddon(webLinksAddon)

    // Open terminal in DOM
    term.open(terminalRef.current)
    fitAddon.fit()

    // Store refs
    xtermRef.current = term
    fitAddonRef.current = fitAddon

    // Connect to socket
    const socket = io('/', {
      transports: ['websocket']
    })
    socketRef.current = socket

    // Request terminal session
    socket.emit('terminal-start', { container: containerName })

    // Handle terminal output
    socket.on('terminal-output', (data: { container: string; data: string }) => {
      if (data.container === containerName) {
        term.write(data.data)
      }
    })

    // Send input to server
    term.onData((data) => {
      socket.emit('terminal-input', { container: containerName, data })
    })

    // Handle resize
    const handleResize = () => {
      if (fitAddonRef.current) {
        fitAddonRef.current.fit()
        socket.emit('terminal-resize', {
          container: containerName,
          cols: term.cols,
          rows: term.rows
        })
      }
    }

    window.addEventListener('resize', handleResize)
    term.onResize(({ cols, rows }) => {
      socket.emit('terminal-resize', { container: containerName, cols, rows })
    })

    // Initial size
    handleResize()

    // Cleanup
    return () => {
      window.removeEventListener('resize', handleResize)
      socket.emit('terminal-stop', { container: containerName })
      socket.disconnect()
      term.dispose()
    }
  }, [containerName])

  return (
    <div className="h-full w-full bg-gray-900 p-2">
      <div ref={terminalRef} className="h-full w-full" />
    </div>
  )
}