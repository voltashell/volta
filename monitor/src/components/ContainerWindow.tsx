'use client';

import { useState, useEffect, useRef } from 'react';
import { ContainerName, LogData, ContainerStat, CommandResult } from '@/types/monitor';
import dynamic from 'next/dynamic';

const Terminal = dynamic(() => import('./Terminal'), { 
  ssr: false,
  loading: () => <div className="flex items-center justify-center h-full">Loading terminal...</div>
});

interface ContainerWindowProps {
  name: ContainerName;
  displayName: string;
  logs: LogData[];
  commandResults: CommandResult[];
  stats?: ContainerStat;
  onRestart: (containerName: ContainerName) => void;
  onClearLogs: (containerName: ContainerName) => void;
  onCommand: (command: string, containerName: ContainerName) => void;
  className?: string;
}

const containerColors: Record<ContainerName, string> = {
  'agent-1': 'text-red-400',
  'agent-2': 'text-teal-400', 
  'agent-3': 'text-blue-400',
  'nats': 'text-yellow-400',
};

export default function ContainerWindow({
  name,
  displayName,
  logs,
  commandResults,
  stats,
  onRestart,
  onClearLogs,
  onCommand,
  className
}: ContainerWindowProps) {
  const [isScrolledToBottom, setIsScrolledToBottom] = useState(true);
  const [command, setCommand] = useState('');
  const [activeTab, setActiveTab] = useState<'logs' | 'terminal'>('terminal');
  const logWindowRef = useRef<HTMLDivElement>(null);

  // Combine logs and command results into a single timeline
  type LogEntry = LogData & { isCommand?: boolean };
  
  const allEntries: LogEntry[] = [...logs, ...commandResults.map(result => ({
    container: name,
    timestamp: result.timestamp,
    data: `$ ${result.command}\n${result.output || ''}${result.error ? `\nError: ${result.error}` : ''}`,
    isError: !!result.error,
    isCommand: true
  }))].sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

  useEffect(() => {
    if (isScrolledToBottom && logWindowRef.current) {
      logWindowRef.current.scrollTop = logWindowRef.current.scrollHeight;
    }
  }, [allEntries, isScrolledToBottom]);

  const handleScroll = () => {
    if (!logWindowRef.current) return;
    
    const { scrollTop, scrollHeight, clientHeight } = logWindowRef.current;
    const isAtBottom = scrollTop + clientHeight >= scrollHeight - 5;
    setIsScrolledToBottom(isAtBottom);
  };

  const getLogClass = (logText: string, isError: boolean): string => {
    if (isError) return 'text-red-400';
    
    const text = logText.toLowerCase();
    if (text.includes('error') || text.includes('failed')) return 'text-red-400';
    if (text.includes('warn')) return 'text-yellow-400';
    if (text.includes('connected') || text.includes('started') || text.includes('ready')) return 'text-green-400';
    return 'text-white';
  };

  const formatTimestamp = (timestamp: string): string => {
    return new Date(timestamp).toLocaleTimeString();
  };

  const handleRestartClick = () => {
    if (confirm(`Restart ${displayName}?`)) {
      onRestart(name);
    }
  };

  const handleCommandSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (command.trim()) {
      onCommand(command.trim(), name);
      setCommand('');
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleCommandSubmit(e);
    }
  };

  const getStatusInfo = (stat?: ContainerStat) => {
    if (!stat) {
      return {
        label: 'Offline',
        detail: '',
        color: 'text-red-400'
      };
    }

    const state = stat.State?.toLowerCase();
    const detail = stat.StatusText?.trim() ?? '';

    switch (state) {
      case 'running':
        return { label: 'Running', detail, color: 'text-green-400' };
      case 'restarting':
        return { label: 'Restarting', detail, color: 'text-yellow-400' };
      case 'paused':
        return { label: 'Paused', detail, color: 'text-yellow-400' };
      case 'exited':
      case 'dead':
      case 'removing':
        return { label: 'Stopped', detail, color: 'text-red-400' };
      default: {
        if (!state) {
          return { label: 'Unknown', detail, color: 'text-yellow-400' };
        }
        const formatted = state.charAt(0).toUpperCase() + state.slice(1);
        return { label: formatted, detail, color: 'text-yellow-400' };
      }
    }
  };

  const formatCpu = (stat?: ContainerStat) => {
    const value = stat?.CPUPerc?.trim();
    return value && value.length > 0 ? value : '--';
  };

  const formatMemory = (stat?: ContainerStat) => {
    const value = stat?.MemUsage?.trim();
    return value && value.length > 0 ? value.replace(/\s+/g, ' ') : '--';
  };

  const statusInfo = getStatusInfo(stats);
  const cpuDisplay = formatCpu(stats);
  const memoryDisplay = formatMemory(stats);

  return (
    <div className={`bg-gray-900 flex flex-col overflow-hidden ${className}`}>
      {/* Header */}
      <div className="bg-gray-800 px-3 py-2 border-b border-gray-600 flex justify-between items-center">
        <div className={`font-bold text-sm ${containerColors[name]}`}>
          {displayName}
        </div>
        <div className="flex space-x-2">
          <button
            onClick={handleRestartClick}
            className="bg-red-600 hover:bg-red-500 text-white text-xs px-2 py-1 rounded"
          >
            Restart
          </button>
          <button
            onClick={() => onClearLogs(name)}
            className="bg-gray-600 hover:bg-gray-500 text-white text-xs px-2 py-1 rounded"
          >
            Clear
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-gray-600">
        <button
          onClick={() => setActiveTab('logs')}
          className={`px-4 py-2 text-sm font-medium ${
            activeTab === 'logs'
              ? 'bg-gray-800 text-white border-b-2 border-blue-500'
              : 'bg-gray-900 text-gray-400 hover:text-white'
          }`}
        >
          Logs
        </button>
        <button
          onClick={() => setActiveTab('terminal')}
          className={`px-4 py-2 text-sm font-medium ${
            activeTab === 'terminal'
              ? 'bg-gray-800 text-white border-b-2 border-blue-500'
              : 'bg-gray-900 text-gray-400 hover:text-white'
          }`}
        >
          Terminal
        </button>
      </div>

      {/* Status */}
      <div className="px-3 py-1 border-b border-gray-600 text-xs">
        <div className="text-gray-400">
          Status: <span className={statusInfo.color}>{statusInfo.label}</span>
          {statusInfo.detail ? ` (${statusInfo.detail})` : ''}
          {' | '}CPU: {cpuDisplay}
          {' | '}Memory: {memoryDisplay}
        </div>
      </div>

      {/* Content Area */}
      {activeTab === 'logs' ? (
        <>
          {/* Log Window */}
          <div 
            ref={logWindowRef}
            onScroll={handleScroll}
            className="flex-1 p-2 overflow-y-auto text-xs font-mono bg-gray-950 scrollbar-thin scrollbar-track-gray-800 scrollbar-thumb-gray-600"
            style={{ minHeight: 0 }}
          >
            {allEntries.length === 0 ? (
              <div className="text-gray-500 italic">No logs available</div>
            ) : (
              allEntries.map((entry, index) => (
                <div key={index} className={`mb-1 break-words ${entry.isCommand ? 'bg-gray-900 px-1 py-0.5 rounded' : ''}`}>
                  <span className="text-gray-500 mr-2">
                    {formatTimestamp(entry.timestamp)}
                  </span>
                  <span className={`${entry.isCommand ? 'text-cyan-400' : getLogClass(entry.data, entry.isError)}`}>
                    {entry.data.trim()}
                  </span>
                </div>
              ))
            )}
          </div>

          {/* Command Input */}
          <form onSubmit={handleCommandSubmit} className="border-t border-gray-600 bg-gray-800">
            <div className="flex items-center px-2 py-2 space-x-2">
              <span className="text-green-400 font-bold text-xs min-w-fit">$</span>
              <input
                type="text"
                value={command}
                onChange={(e) => setCommand(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={`Command for ${displayName}...`}
                className="flex-1 bg-transparent text-white text-xs font-mono border-none outline-none placeholder-gray-500"
              />
              <button
                type="submit"
                disabled={!command.trim()}
                className="bg-green-600 hover:bg-green-500 disabled:bg-gray-600 disabled:cursor-not-allowed text-white text-xs px-2 py-1 rounded"
              >
                Send
              </button>
            </div>
          </form>
        </>
      ) : (
        /* Terminal Tab */
        <div className="flex-1 overflow-hidden">
          <Terminal containerName={name} />
        </div>
      )}

      {/* Scroll indicator */}
      {activeTab === 'logs' && !isScrolledToBottom && (
        <div className="absolute bottom-12 right-2">
          <button
            onClick={() => {
              if (logWindowRef.current) {
                logWindowRef.current.scrollTop = logWindowRef.current.scrollHeight;
                setIsScrolledToBottom(true);
              }
            }}
            className="bg-blue-600 hover:bg-blue-500 text-white text-xs px-2 py-1 rounded shadow-lg"
          >
            ↓ New logs
          </button>
        </div>
      )}
    </div>
  );
}
