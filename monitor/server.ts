import { createServer } from 'http'
import { parse } from 'url'
import next from 'next'
import { Server as SocketIOServer, Socket } from 'socket.io'
import { spawn, ChildProcess } from 'child_process'
import { ContainerStat, ExecuteCommand } from './src/types/monitor'

const dev = process.env.NODE_ENV !== 'production'
const hostname = process.env.HOSTNAME || 'localhost'
const port = parseInt(process.env.PORT || '3000', 10)

// Create Next.js app
const app = next({ dev, hostname, port })
const handle = app.getRequestHandler()

const logStreams = new Map<string, ChildProcess>()

app.prepare().then(() => {
  const server = createServer(async (req, res) => {
    try {
      const parsedUrl = parse(req.url!, true)
      await handle(req, res, parsedUrl)
    } catch (err) {
      console.error('Error occurred handling', req.url, err)
      res.statusCode = 500
      res.end('internal server error')
    }
  })

  // Add Socket.IO to the same server
  const io = new SocketIOServer(server, {
    cors: {
      origin: "*",
      methods: ["GET", "POST"]
    }
  })

  io.on('connection', (socket) => {
    console.log('Client connected:', socket.id)

    // Start log streams for all containers
    const containers = ['agent-1', 'agent-2', 'agent-3', 'nats']
    containers.forEach(container => {
      startLogStream(container, socket)
    })

    // Send periodic stats updates
    const statsInterval = setInterval(async () => {
      try {
        const stats = await getContainerStats()
        socket.emit('stats', stats)
      } catch (error) {
        console.error('Error getting stats:', error)
      }
    }, 2000)

    socket.on('disconnect', () => {
      console.log('Client disconnected:', socket.id)
      clearInterval(statsInterval)
      
      // Clean up log streams for this client
      logStreams.forEach((stream) => {
        stream.kill()
      })
      logStreams.clear()
    })

    socket.on('restart-container', (containerName: string) => {
      restartContainer(containerName, socket)
    })

    socket.on('execute-command', (commandData: ExecuteCommand) => {
      executeCommand(commandData, socket)
    })
  })

  server.listen(port, (err?: Error) => {
    if (err) throw err
    console.log(`> Ready on http://${hostname}:${port}`)
    console.log(`> Socket.IO server also running on same port`)
  })
})

function startLogStream(containerName: string, socket: Socket) {
  if (logStreams.has(containerName)) {
    const existingStream = logStreams.get(containerName)
    existingStream?.kill()
  }

  const dockerLogs = spawn('docker', ['logs', '-f', '--tail', '100', containerName])
  logStreams.set(containerName, dockerLogs)

  dockerLogs.stdout?.on('data', (data) => {
    socket.emit('log', {
      container: containerName,
      data: data.toString(),
      timestamp: new Date().toISOString(),
      isError: false
    })
  })

  dockerLogs.stderr?.on('data', (data) => {
    socket.emit('log', {
      container: containerName,
      data: data.toString(),
      timestamp: new Date().toISOString(),
      isError: true
    })
  })

  dockerLogs.on('close', (code) => {
    console.log(`Log stream for ${containerName} closed with code ${code}`)
    logStreams.delete(containerName)
  })

  dockerLogs.on('error', (err) => {
    console.error(`Error streaming logs for ${containerName}:`, err)
    socket.emit('error', {
      container: containerName,
      message: err.message
    })
  })
}

async function getContainerStats(): Promise<ContainerStat[]> {
  return new Promise((resolve) => {
    const statsProcess = spawn('docker', [
      'stats',
      '--no-stream',
      '--format',
      'json',
      'agent-1',
      'agent-2',
      'agent-3',
      'nats'
    ])
    
    let output = ''

    statsProcess.stdout?.on('data', (data) => {
      output += data.toString()
    })

    statsProcess.on('close', () => {
      try {
        const lines = output.trim().split('\n').filter(line => line.trim())
        const stats = lines.map(line => JSON.parse(line))
        resolve(stats)
      } catch (err) {
        console.error('Error parsing stats:', err)
        resolve([])
      }
    })

    statsProcess.on('error', (err) => {
      console.error('Error getting stats:', err)
      resolve([])
    })
  })
}

function restartContainer(containerName: string, socket: Socket) {
  console.log(`Restarting container: ${containerName}`)
  const restart = spawn('docker', ['restart', containerName])
  
  restart.on('close', (code) => {
    socket.emit('container-restarted', {
      container: containerName,
      success: code === 0
    })
    
    if (code === 0) {
      setTimeout(() => {
        startLogStream(containerName, socket)
      }, 2000)
    }
  })

  restart.on('error', (err) => {
    console.error(`Error restarting container ${containerName}:`, err)
    socket.emit('container-restarted', {
      container: containerName,
      success: false
    })
  })
}

function executeCommand(commandData: ExecuteCommand, socket: Socket) {
  const { command, target, timestamp } = commandData
  console.log(`Executing command "${command}" on target "${target}"`)

  let cmdProcess
  let cmdArgs: string[]

  if (target === 'host') {
    cmdArgs = ['sh', '-c', command]
    cmdProcess = spawn(cmdArgs[0], cmdArgs.slice(1))
  } else if (target === 'all') {
    const containers = ['agent-1', 'agent-2', 'agent-3']
    containers.forEach(container => {
      const individualCommand = {
        command,
        target: container,
        timestamp
      }
      executeCommand(individualCommand, socket)
    })
    return
  } else {
    const shell = target.startsWith('agent-') ? '/bin/bash' : 'sh'
    cmdArgs = ['docker', 'exec', target, shell, '-c', command]
    cmdProcess = spawn(cmdArgs[0], cmdArgs.slice(1))
  }

  let output = ''
  let errorOutput = ''

  cmdProcess.stdout?.on('data', (data) => {
    output += data.toString()
  })

  cmdProcess.stderr?.on('data', (data) => {
    errorOutput += data.toString()
  })

  cmdProcess.on('close', (code) => {
    const result = {
      command,
      target,
      output: output || 'No output',
      timestamp: new Date().toISOString(),
      exitCode: code || 0,
      error: errorOutput || undefined
    }

    socket.emit('command-result', result)
  })

  cmdProcess.on('error', (err) => {
    const result = {
      command,
      target,
      output: '',
      timestamp: new Date().toISOString(),
      exitCode: 1,
      error: err.message
    }

    socket.emit('command-result', result)
  })
}