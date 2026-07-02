# ACHILLES queue-runner host wiring

The device-side half of the cloud-clock / local-runner ops automation
(validated 2026-07-02 — `validate_ops-agent-automation-architecture`). The
hosted n8n clock inserts due rows into the service-role-only `ops_task_queue`;
this wiring makes the device claim and run them automatically — no user, no
Claude session, no push channel that an offline device would miss.

## Install

**Containerized /studio (the normal ACHILLES setup): the split is HOST owns the
clock, CONTAINER owns the execution.** The runner must execute inside the
container (agents + local state live there), but the container has no
init/systemd — so install the `-docker@` template units on the HOST:

```sh
# on the HOST (not in the container); <name> = the dev container's docker name
sudo install -m 0644 achilles-queue-runner-docker@.service achilles-queue-runner-docker@.timer /etc/systemd/system/
sudo mkdir -p /etc/achilles && sudo install -m 0600 queue-runner.env.example /etc/achilles/queue-runner.env
sudo vi /etc/achilles/queue-runner.env        # fill SUPABASE_URL / SERVICE key / OPS_DEVICE_ID
sudo systemctl daemon-reload
sudo systemctl enable --now achilles-queue-runner-docker@<name>.timer
```

Creds are injected per-run via `docker exec --env-file` — they live host-side
(0600) and never persist in the container. A stopped container just means
overdue rows wait in the queue; `ExecStartPre=-docker start` retries the
container each tick.

**Bare-metal / VM device** (no container): run the installer on the device:

```sh
sudo ~/packages/studio-ops/bin/studio-runner-install
sudo vi /etc/achilles/queue-runner.env
```

Idempotent. Prefers systemd (`achilles-queue-runner.timer`: boot +2min, every
15min, `Persistent=true`); falls back to a cron line; prints the manual
one-liner when neither exists.

## Hardening checklist (validation action item 3)

- [x] dedicated non-root system user (`achilles-runner`, nologin) — installer
- [x] creds in root-owned 0600 `/etc/achilles/queue-runner.env`, read by
      reference, never logged — installer + runner contract
- [x] systemd sandbox: `NoNewPrivileges`, `ProtectSystem=strict`,
      `ProtectHome=read-only`, empty capability set — service unit
- [ ] scope the Supabase credential to the queue + heartbeat tables only
      (custom PostgREST role) — OPEN: service_role for now; revisit if the
      ops store ever shares a project with client data
- [x] queue rows carry only `agent_key` (no payload column exists to inject);
      the runner maps keys through a fixed in-code allow-list and the
      `agent-remote-enum` evaluator manifest machine-checks that property

## What this deliberately does NOT do

- Never passes `--apply` — armed remediation plans stay with the main session.
- No scheduler code in any repo: the clock is the hosted n8n
  `schedule-dispatcher`; liveness is the hosted `dead-mans-switch` workflow
  reading `device_heartbeats` (an n8n outage delays alerts, never the queue).
