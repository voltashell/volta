# Repository Guidelines

## Project Structure & Module Organization
- `agents/`: TypeScript agents (NATS client, task utils). Build with `tsc`.
- `monitor/`: Next.js dashboard + Socket.IO terminals. Build via `next build`.
- `electron/`: Launcher that starts the monitor (dev).
- `shared/`: Volumes for agent data (`agents/<id>/`, `logs/`, `common/`).
- `scripts/`: Utilities (`init-agents.sh`, `clear-shared.sh`).
- `docker-compose.local.yml`: NATS + three agents + monitor orchestration.

## Build, Test, and Development Commands
- `npm run flock:up`: Init dirs and start NATS, agents, monitor.
- `npm run flock:down`: Stop all containers; re-init agent dirs.
- `npm run flock:status` / `flock:logs`: Show container state and logs.
- `npm run flock:restart`: Down, clean shared artifacts, then up.
- `npm run agents:dev` | `agents:build` | `agents:type-check`: Work on agents.
- `cd monitor && npm run dev`: Monitor in dev (hot reload). `npm run electron:dev` to open in Electron.
- `npm run flock:scale`: Example: `--scale agent-1=2 --scale agent-2=2`.

## Coding Style & Naming Conventions
- TypeScript, 2-space indent, semicolons, ES modules where applicable.
- Filenames: multi-word TS/JS `kebab-case` (e.g., `mcp-client.ts`); React components `PascalCase` (e.g., `ContainerWindow.tsx`).
- Variables/functions `camelCase`; constants `UPPER_SNAKE_CASE`.
- Lint: `cd monitor && npm run lint`. Prefer Prettier-compatible formatting.

## Testing Guidelines
- No formal test suite yet. Use `npm run agents:type-check` and `cd monitor && npm run build` to catch type/build errors.
- If adding tests, prefer Vitest/Jest with `*.test.ts` colocated near sources; keep fast, isolated, and deterministic.

## Commit & Pull Request Guidelines
- History mixes styles; prefer Conventional Commits: `feat:`, `fix:`, `chore:`, `docs:`, `refactor:`, `perf:`, `test:`.
- PRs: concise title, description, and scope; link issues. For UI changes, add screenshots/GIFs. For agent/runtime changes, include `docker-compose.local.yml` commands used and relevant logs.
- Update docs when behavior changes (`README.md`, this file, or `NATS_ARCHITECTURE.md`).

## Security & Configuration Tips
- Never commit secrets. Use `.env` (see `.env.example`). Key vars: `ANTHROPIC_API_KEY`, `AUTH0_*`, `CUSTOM_REPO_PATH`.
- Shared data under `shared/` may contain logs and artifacts; sanitize before sharing. Use `scripts/clear-shared.sh` to clean safely.
- Agents communicate only via NATS; avoid adding ad-hoc network paths.
