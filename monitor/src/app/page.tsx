'use client';

import { useState, useEffect } from 'react';
import { io, Socket } from 'socket.io-client';
import { useAuth0 } from '@auth0/auth0-react';
import ContainerWindow from '@/components/ContainerWindow';
import { 
  ContainerName, 
  LogData, 
  ContainerStat, 
  CommandResult, 
  ExecuteCommand, 
  ConnectionStatus,
  RestartResponse,
  ErrorData 
} from '@/types/monitor';

export default function Monitor() {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>({ connected: false });
  const [logs, setLogs] = useState<Record<ContainerName, LogData[]>>({
    'agent-1': [],
    'agent-2': [],
    'agent-3': [],
    'nats': []
  });
  const [stats, setStats] = useState<ContainerStat[]>([]);
  const [commandResults, setCommandResults] = useState<Record<ContainerName, CommandResult[]>>({
    'agent-1': [],
    'agent-2': [],
    'agent-3': [],
    'nats': []
  });
  const { user, isAuthenticated, loginWithRedirect, logout } = useAuth0();

  useEffect(() => {
    if (!isAuthenticated) return;

    const socketUrl = process.env.NEXT_PUBLIC_WEBSOCKET_URL || 'http://localhost:3101';
    const newSocket = io(socketUrl, {
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000
    });
    setSocket(newSocket);

    newSocket.on('connect', () => {
      setConnectionStatus({ connected: true, lastSeen: new Date() });
    });

    newSocket.on('disconnect', () => {
      setConnectionStatus({ connected: false });
    });

    newSocket.on('log', (logData: LogData) => {
      const containerName = logData.container as ContainerName;
      if (containerName in logs) {
        setLogs(prev => ({
          ...prev,
          [containerName]: [...prev[containerName].slice(-999), logData]
        }));
      }
    });

    newSocket.on('stats', (statsData: ContainerStat[]) => {
      setStats(statsData);
    });

    newSocket.on('command-result', (result: CommandResult) => {
      const containerName = result.target as ContainerName;
      if (containerName in commandResults) {
        setCommandResults(prev => ({
          ...prev,
          [containerName]: [...prev[containerName].slice(-49), result]
        }));
      }
    });

    newSocket.on('container-restarted', (data: RestartResponse) => {
      console.log('Container restart result:', data);
    });

    newSocket.on('error', (errorData: ErrorData) => {
      console.error('Container error:', errorData);
    });

    return () => {
      newSocket.close();
      setSocket(null);
    };
  }, [isAuthenticated]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleCommand = (command: string, containerName: ContainerName) => {
    if (!socket) return;

    const executeCommand: ExecuteCommand = {
      command,
      target: containerName,
      timestamp: new Date().toISOString()
    };

    socket.emit('execute-command', executeCommand);
  };

  const handleRestart = (containerName: ContainerName) => {
    if (!socket) return;
    socket.emit('restart-container', containerName);
  };

  const handleClearLogs = (containerName: ContainerName) => {
    setLogs(prev => ({
      ...prev,
      [containerName]: []
    }));
  };

  const getStatForContainer = (containerName: ContainerName): ContainerStat | undefined => {
    return stats.find(stat => stat.Name === containerName);
  };

  const getTotalStats = () => {
    if (stats.length === 0) return { containers: 0, cpu: 0, memory: 0 };

    const cpu = stats.reduce((sum, stat) => {
      return sum + parseFloat(stat.CPUPerc?.replace('%', '') || '0');
    }, 0);

    const memory = stats.reduce((sum, stat) => {
      const memStr = stat.MemUsage?.split(' / ')[0]?.replace(/[^\d.]/g, '') || '0';
      return sum + parseFloat(memStr);
    }, 0);

    return {
      containers: stats.length,
      cpu: cpu.toFixed(1),
      memory: memory.toFixed(0)
    };
  };

  const totalStats = getTotalStats();
  if (!isAuthenticated) {
    return (
      <div className="h-screen flex items-center justify-center bg-gray-900 text-white">
        <button onClick={() => loginWithRedirect()} className="text-blue-400">
          Login to continue
        </button>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col bg-gray-900 text-white overflow-hidden">
      {/* Connection Status */}
      <div className="fixed top-3 right-4 z-50">
        <div className={`px-2 py-1 rounded text-xs font-bold ${
          connectionStatus.connected 
            ? 'bg-green-600 text-white' 
            : 'bg-red-600 text-white'
        }`}>
          {connectionStatus.connected ? 'Connected' : 'Disconnected'}
        </div>
      </div>

      {/* Header */}
      <header className="bg-gray-800 px-5 py-3 border-b border-gray-600 flex justify-between items-center">
        <h1 className="text-lg font-bold text-green-400">AI Flock Monitor</h1>
        <div className="flex items-center space-x-6 text-xs">
          <div className="flex space-x-6">
            <div className="text-center">
              <div className="text-gray-400">Containers</div>
              <div className="text-green-400 font-bold">{totalStats.containers}</div>
            </div>
            <div className="text-center">
              <div className="text-gray-400">CPU</div>
              <div className="text-green-400 font-bold">{totalStats.cpu}%</div>
            </div>
            <div className="text-center">
              <div className="text-gray-400">Memory</div>
              <div className="text-green-400 font-bold">{totalStats.memory}MB</div>
            </div>
          </div>
          <span className="text-green-400">{user?.name}</span>
          <button
            onClick={() => logout({ logoutParams: { returnTo: window.location.origin } })}
            className="text-blue-400"
          >
            Logout
          </button>
        </div>
      </header>

      {/* Main Content - Container Grid */}
      <div className="grid grid-cols-2 grid-rows-2 gap-px bg-gray-600 flex-1 overflow-hidden">
        <ContainerWindow
          name="agent-1"
          displayName="Agent 1"
          logs={logs['agent-1']}
          commandResults={commandResults['agent-1']}
          stats={getStatForContainer('agent-1')}
          onRestart={handleRestart}
          onClearLogs={handleClearLogs}
          onCommand={handleCommand}
          className="relative"
        />
        <ContainerWindow
          name="agent-2"
          displayName="Agent 2"
          logs={logs['agent-2']}
          commandResults={commandResults['agent-2']}
          stats={getStatForContainer('agent-2')}
          onRestart={handleRestart}
          onClearLogs={handleClearLogs}
          onCommand={handleCommand}
          className="relative"
        />
        <ContainerWindow
          name="agent-3"
          displayName="Agent 3"
          logs={logs['agent-3']}
          commandResults={commandResults['agent-3']}
          stats={getStatForContainer('agent-3')}
          onRestart={handleRestart}
          onClearLogs={handleClearLogs}
          onCommand={handleCommand}
          className="relative"
        />
        <ContainerWindow
          name="nats"
          displayName="NATS Server"
          logs={logs.nats}
          commandResults={commandResults.nats}
          stats={getStatForContainer('nats')}
          onRestart={handleRestart}
          onClearLogs={handleClearLogs}
          onCommand={handleCommand}
          className="relative"
        />
      </div>
    </div>
  );
}
