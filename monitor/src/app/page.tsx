'use client';

import { useState, useEffect, useMemo } from 'react';
import { io, Socket } from 'socket.io-client';
// import { useUser } from "@auth0/nextjs-auth0"
import { useRouter } from 'next/navigation';
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

const TRACKED_CONTAINERS: ContainerName[] = ['agent-1', 'agent-2', 'agent-3', 'nats'];

const parseCpuPercentage = (value?: string): number => {
	if (!value) return 0;
	const normalized = value.replace('%', '').trim();
	const parsed = Number.parseFloat(normalized);
	return Number.isFinite(parsed) ? parsed : 0;
};

const parseDockerMemoryToMB = (value?: string): number => {
	if (!value) return 0;
	const [usedPart] = value.split('/') as [string?, ...string[]];
	if (!usedPart) return 0;
	const match = usedPart.trim().match(/([\d.]+)\s*([a-zA-Z]+)/);
	if (!match) return 0;
	const amount = Number.parseFloat(match[1]);
	if (!Number.isFinite(amount)) return 0;
	const unit = match[2].toUpperCase();
	const unitMultipliers: Record<string, number> = {
		B: 1 / (1024 * 1024),
		KB: 1 / 1024,
		KIB: 1 / 1024,
		MB: 1,
		MIB: 1,
		GB: 1024,
		GIB: 1024,
		TB: 1024 * 1024,
		TIB: 1024 * 1024
	};

	return amount * (unitMultipliers[unit] ?? 1);
};

const formatMemoryFromMB = (valueInMb: number): string => {
	if (!Number.isFinite(valueInMb) || valueInMb <= 0) {
		return '0 MB';
	}
	if (valueInMb >= 1024) {
		return `${(valueInMb / 1024).toFixed(1)} GB`;
	}
	return valueInMb >= 10
		? `${valueInMb.toFixed(0)} MB`
		: `${valueInMb.toFixed(1)} MB`;
};

export default function Monitor() {
	const router = useRouter();
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
	// const { user, isLoading } = useUser();

	useEffect(() => {
		// if (!user) return;

		const socketUrl = process.env.NEXT_PUBLIC_WEBSOCKET_URL || 'http://localhost:4000';
		const newSocket = io(socketUrl, {
			transports: ['websocket', 'polling'],
			reconnection: true,
			reconnectionAttempts: 5,
			reconnectionDelay: 1000
		});
		setSocket(newSocket);

		newSocket.on('connect', () => {
			setConnectionStatus({ connected: true, lastSeen: new Date() });
			// Request initial data
			newSocket.emit('get-agents');
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

		// NATS-specific events
		newSocket.on('agent-announce', (announcement: any) => {
			console.log('Agent announced:', announcement);
		});

		newSocket.on('agent-status', (status: any) => {
			console.log('Agent status:', status);
		});

		newSocket.on('agent-message', (message: any) => {
			console.log('Agent message:', message);
		});

		newSocket.on('agent-broadcast', (message: any) => {
			console.log('Agent broadcast:', message);
		});

		newSocket.on('agents-list', (agents: any[]) => {
			console.log('Available agents:', agents);
		});

		return () => {
			newSocket.close();
			setSocket(null);
		};
	}, []); 

	// }, [user]); 

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

	const statsByName = useMemo(() => {
		const map: Record<string, ContainerStat> = {};
		stats.forEach(stat => {
			map[stat.Name] = stat;
		});
		return map;
	}, [stats]);

	const getStatForContainer = (containerName: ContainerName): ContainerStat | undefined => {
		return statsByName[containerName];
	};

	const totalStats = useMemo(() => {
		let running = 0;
		let cpuTotal = 0;
		let memoryTotalMb = 0;

		TRACKED_CONTAINERS.forEach(name => {
			const stat = statsByName[name];
			if (!stat) return;

			if (stat.State?.toLowerCase() === 'running') {
				running += 1;
			}

			cpuTotal += parseCpuPercentage(stat.CPUPerc);
			memoryTotalMb += parseDockerMemoryToMB(stat.MemUsage);
		});

		return {
			running,
			total: TRACKED_CONTAINERS.length,
			cpu: Number.parseFloat(cpuTotal.toFixed(1)),
			memoryMb: memoryTotalMb
		};
	}, [statsByName]);


	return (
		<>
			{/* {isLoading && <p>Loading...</p>} */}
			{/* {user && ( */}
			{true && (

				<div className="h-screen flex flex-col bg-gray-900 text-white overflow-hidden">
					{/* Connection Status */}
					<div className="fixed top-3 right-4 z-50">
						<div className={`px-2 py-1 rounded text-xs font-bold ${connectionStatus.connected
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
									<div className="text-green-400 font-bold">{`${totalStats.running}/${totalStats.total}`}</div>
								</div>
								<div className="text-center">
									<div className="text-gray-400">CPU</div>
									<div className="text-green-400 font-bold">{`${totalStats.cpu.toFixed(1)}%`}</div>
								</div>
								<div className="text-center">
									<div className="text-gray-400">Memory</div>
									<div className="text-green-400 font-bold">{formatMemoryFromMB(totalStats.memoryMb)}</div>
								</div>
							</div>
							{/* <span className="text-green-400">{user?.name}</span>
							<a
								href="/auth/logout"
								className="text-blue-400"
							>
								Logout
							</a> */}
						</div>
					</header>

					{/* Main Content - Container Grid */}
					<div className="grid grid-cols-2 grid-rows-2 gap-px bg-gray-600 flex-1 overflow-hidden">
						<ContainerWindow
							name="agent-1"
							displayName="Richard"
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
							displayName="Dinesh"
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
							displayName="Gilfoyle"
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
			)}
			{/* {!user && <a href="/auth/login">Login</a>
			} */}
		</>
	);
}
