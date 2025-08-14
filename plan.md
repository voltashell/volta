We are creating a flock of AI agents inside of a virtual machine. 
We want to create a virtual machine with strict isolation between each instance of the ai agent. 
We want to create a system for them to communicate with each other and access a shared directory

### Step-by-step plan

- **Define isolation level**
  - Decide baseline: Docker containers per agent (namespaces/cgroups).
  - Optional hardening: gVisor (runsc) or Kata Containers for VM-like isolation.

- **VM provisioning**
  - Extend Vagrant provisioning to install: Docker Engine, Docker Compose plugin, and add `vagrant` to `docker` group.
  - Keep Node.js 18 for build tooling inside the VM.

- **Shared directory layout**
  - Create `shared/` at repo root; Vagrant syncs it to `/vagrant/shared` in the VM.
  - Set permissions for `vagrant:vagrant`; use `770` or ACLs if per-agent subdirs are needed.

- **Messaging bus**
  - Use NATS (lightweight pub/sub) as a Docker service inside the VM.
  - Subjects: `tasks.*`, `agent.<id>.events`, `broadcast`.

- **Agent contract**
  - Env config: `AGENT_ID`, `NATS_URL`, `SHARED_DIR=/shared`.
  - Lifecycle: subscribe → process → write outputs/logs to `/shared/<agent-id>/...`.

- **Agent image**
  - Base: `node:18-alpine`, non-root user, read-only rootfs, healthcheck.
  - Build once; parameterize behavior via env vars.

- **Orchestration (inside VM)**
  - Create `vm/docker-compose.yml` with:
    - `nats` service.
    - `agent-N` services (N instances) using the same image with unique `AGENT_ID`.
    - Bind mount shared volume: `src=/vagrant/shared`, `dst=/shared`.
    - Resource limits: `cpus`, `memory`, `pids_limit`.
    - Security: `read_only: true`, `tmpfs: [/tmp, /run]`, `cap_drop: [ALL]`, `security_opt: [no-new-privileges:true]`, plus seccomp/AppArmor profiles.
  - Networking:
    - Create a user-defined bridge `bus` for NATS and agents.
    - Do not publish agent ports; only NATS is reachable internally.

- **Strict isolation options (as needed)**
  - gVisor: install `runsc` in VM, run agents with `--runtime=runsc`.
  - Kata Containers: install in VM and configure Docker to use `kata-runtime` for agents.
  - User namespaces: enable Docker userns-remap; align volume ownership.

- **Developer UX**
  - Scripts:
    - `npm run vm:up` → `vagrant up`
    - `npm run vm:agents` → SSH and `docker compose up -d --scale agent=N`
    - `npm run vm:down` → stop/clean
  - Logs: aggregate into `/shared/logs/<agent-id>.log`; also use `docker logs`.

- **Access controls on shared storage**
  - Per-agent subdirs: `/shared/agents/<id>` + a common `/shared/common`.
  - Optionally enforce POSIX ACLs; mount subdirs read-only into other agents.

- **Testing and validation**
  - Isolation tests: ensure containers cannot connect to each other except to NATS; prevent cross-container file access outside `/shared`.
  - Functionality tests: publish tasks to NATS; verify outputs in `/shared/<id>/...`.
  - Performance: stress an agent and confirm cgroup limits are respected.

- **Observability**
  - Optional `prometheus-node-exporter` in VM and NATS monitoring endpoint.
  - Simple metrics: agent heartbeats to `agent.<id>.events`.

- **Documentation**
  - Update `README.md` with VM workflow, agent scaling, task publishing, and shared dir semantics.
  - Note threat model and isolation trade-offs (baseline vs. gVisor/Kata).

- **Rollout**
  - Start with 3 agents + NATS in VM.
  - Add gVisor/Kata if stricter isolation is required after baseline validation.

- **Deliverables**
  - `vm/docker-compose.yml` (NATS + agents).
  - `agents/` code and Dockerfile.
  - Updated `scripts/provision.sh` to install Docker (and optional gVisor/Kata).
  - `shared/` directory with `.gitkeep` and permissions setup.
  - Integration tests to validate isolation and communications.