# AI Flock Monitor - Next.js

A modern Next.js-based monitoring interface for AI Flock containers with real-time terminal capabilities.

## Features

- **Real-time Container Monitoring**: Monitor 4 containers (Agent 1, Agent 2, Agent 3, NATS) simultaneously
- **Professional Terminal**: Built with xterm.js for full terminal emulation
- **Responsive Grid Layout**: Equal-sized container windows with proper scrolling
- **TypeScript**: Full type safety throughout the application
- **Modern UI**: Built with Tailwind CSS and modern React patterns

## Setup

1. Install dependencies:
```bash
npm install
```

2. Start the development server:
```bash
npm run dev
```

3. Make sure the backend monitor server is running on port 3001:
```bash
cd ../monitor
npm run dev
```

## Usage

The monitor provides:
- Real-time log streaming from all containers
- Container statistics (CPU, Memory usage)
- Terminal interface for executing commands
- Container restart functionality
- Log clearing and management

## Architecture

- **Frontend**: Next.js 15 with TypeScript and Tailwind CSS
- **Terminal**: xterm.js with FitAddon for responsive terminals
- **Real-time**: Socket.IO client connecting to backend server
- **Styling**: Tailwind CSS with custom scrollbar styling

## Development

```bash
# Development server
npm run dev

# Build for production
npm run build

# Start production server
npm start
```