# AI Flock

A TypeScript project set up with modern development tools and best practices.

## Getting Started

### Prerequisites

- Node.js (v16 or higher)
- npm or yarn

### Installation

```bash
npm install
```

### Development

Run the project in development mode with hot reloading:

```bash
npm run dev
```

### Building

Compile TypeScript to JavaScript:

```bash
npm run build
```

### Running

Run the compiled JavaScript:

```bash
npm start
```

### Scripts

- `npm run dev` - Run with ts-node for development
- `npm run build` - Compile TypeScript to JavaScript
- `npm run start` - Run the compiled JavaScript
- `npm run watch` - Compile in watch mode
- `npm run clean` - Remove the dist directory

#### Docker Scripts

- `npm run docker:build` - Build Docker image
- `npm run docker:run` - Run Docker container
- `npm run docker:up` - Start services with docker-compose
- `npm run docker:down` - Stop services with docker-compose
- `npm run docker:logs` - View container logs

Aliases:

- `npm run dbuild` → `docker build -t ai-flock .`
- `npm run drun` → `docker run -p 3000:3000 ai-flock`
- `npm run dup` → `docker-compose up -d`
- `npm run ddown` → `docker-compose down`
- `npm run dlogs` → `docker-compose logs -f`

## Docker

This project includes Docker support for easy deployment and development.

### Running with Docker

#### Option 1: Using Docker directly

Build and run the Docker image:

```bash
# Build the image
npm run docker:build

# Run the container
npm run docker:run
```

Or manually:

```bash
# Build the image
docker build -t ai-flock .

# Run the container
docker run -p 3000:3000 ai-flock
```

#### Option 2: Using Docker Compose

```bash
# Start the application
npm run docker:up

# View logs
npm run docker:logs

# Stop the application
npm run docker:down
```

Note: This project is a console application. When the container runs, it prints a greeting and exits. There is no web server listening on a port.

### Docker Configuration

- **Dockerfile**: Multi-stage build with Node.js 18 Alpine
- **docker-compose.yml**: Service orchestration
- **.dockerignore**: Excludes unnecessary files from build context

### Development with Docker

For development with live reloading, uncomment the `ai-flock-dev` service in `docker-compose.yml` and run:

```bash
docker-compose up ai-flock-dev
```

## Project Structure

```
ai-flock/
├── src/              # TypeScript source files
│   └── index.ts      # Main entry point
├── dist/             # Compiled JavaScript (generated)
├── Dockerfile        # Docker image configuration
├── docker-compose.yml # Docker Compose configuration
├── .dockerignore     # Docker ignore file
├── package.json      # Project dependencies and scripts
├── tsconfig.json     # TypeScript configuration
└── README.md         # This file
```

## Features

- TypeScript with strict mode enabled
- Modern ES2020 target
- Source maps for debugging
- Declaration files generation
- Clean project structure
