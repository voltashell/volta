'use client';

import { useState, useEffect } from 'react';
import { ContainerName, ContainerStat } from '@/types/monitor';
import dynamic from 'next/dynamic';

const Terminal = dynamic(() => import('./Terminal'), { 
  ssr: false,
  loading: () => <div className="flex items-center justify-center h-full">Loading terminal...</div>
});

interface ContainerWindowProps {
  name: ContainerName;
  displayName: string;
  stats?: ContainerStat;
  className?: string;
}


export default function ContainerWindow({
  name,
  displayName,
  stats,
  className
}: ContainerWindowProps) {


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
        return { label: 'Running', detail, color: 'text-primary' };
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
    <div className={`bg-background flex flex-col overflow-hidden ${className}`}>
      {/* Header */}
      <div className="bg-secondary px-3 py-2 border-b border-gray-700 flex justify-between items-center">
        <div className={`font-bold text-sm text-gray-400`}>
          {displayName}
        </div>
        {/* <div className="flex space-x-2">
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
        </div> */}
      </div>


      {/* Status */}
      <div className="px-3 py-1 border-b border-gray-700 text-xs">
        <div className="text-gray-400">
          Status: <span className={statusInfo.color}>{statusInfo.label}</span>
          {statusInfo.detail ? ` (${statusInfo.detail})` : ''}
          {' | '}CPU: {cpuDisplay}
          {' | '}Memory: {memoryDisplay}
        </div>
      </div>

      {/* Terminal Content */}
      <div className="flex-1 overflow-hidden">
        <Terminal containerName={name} />
      </div>

    </div>
  );
}
