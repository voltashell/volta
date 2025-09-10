# AI Flock

AI Flock runs multiple instances of Claude in isolated Docker containers. Each agent connects to a shared NATS message bus and uses a shared directory for exchanging data.

## Usage

1. Set the required environment variables:
   ```bash
   export ANTHROPIC_API_KEY="your_api_key"
   ```
2. Build and start the containers:
   ```bash
   npm run flock:up
   ```
3. View container status or logs:
   ```bash
   npm run flock:status
   npm run flock:logs
   ```
4. Stop the system:
   ```bash
   npm run flock:down
   ```

## Scripts
- `flock:up` – initialize directories and start NATS plus three Claude agents.
- `flock:down` – stop all containers and reset directories.
- `flock:status` – show running containers.
- `flock:shell:agent1/2/3` – open a shell in an agent container.

## Project Structure
- `agents/` – Claude agent implementation and Dockerfile.
- `scripts/` – helper scripts for initializing volumes.
- `docker-compose.local.yml` – defines agent and NATS containers.
- `shared/` – mounted volumes for agent data.

The repository is focused solely on Docker-based deployment; no virtual machines or monitoring front-ends are included.
