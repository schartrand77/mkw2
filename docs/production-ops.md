# MakerWorks Suite Production Ops

This guide describes how Codex should integrate with production MakerWorks suite containers without becoming part of the production runtime.

## Operating Model

Codex should act from a trusted operator machine, CI runner, or controlled management shell. Production app containers should remain normal runtime containers.

Preferred production access path:

```text
Codex on dev PC or ops runner
  -> SSH / Docker Context
  -> production Docker host
  -> Docker Compose status, logs, deploys, and health checks
  -> GitHub, CI, registry, and tagged releases
```

Avoid putting Codex, repo checkouts, shell agents, or broad host credentials inside production app containers.

## Access Levels

### Read-only inspection

Codex may inspect production state when the user asks for status, diagnosis, or monitoring:

```bash
docker ps
docker compose ps
docker compose logs --tail 200
docker inspect <container>
curl -fsS http://127.0.0.1:3000/api/health
```

Read-only inspection is suitable for:

- container status
- image tags
- restart loops
- recent logs
- disk and backup presence
- MakerWorks health
- StockWorks reachability
- PrintLab reachability
- OrderWorks reachability

### Require explicit approval

Codex must ask before production operations that mutate state, interrupt services, or affect real-world hardware:

- `docker compose up -d`, `pull`, `restart`, or `down`
- database migrations
- backup restore
- deleting backups or storage
- Docker prune commands
- editing production environment files
- changing image tags
- Printer controls
- print job submission
- rollback

Printer controls include pause, resume, stop, light, fan, temperature, upload, and print commands.

## SSH / Docker Context

Recommended simple setup:

```bash
ssh makerworks-prod "docker ps"
ssh makerworks-prod "cd /opt/makerworks && docker compose ps"
```

Recommended Docker context setup:

```bash
docker context create makerworks-prod --docker "host=ssh://makerworks-prod"
docker --context makerworks-prod ps
```

Use SSH config aliases so production host details do not need to be repeated in commands.

## GitOps Deployment

GitOps deployment is the preferred production path for MakerWorks suite changes.

Production should be deployed from reviewed Git state and pinned image tags.

Recommended branch roles:

```text
main  -> production stable
dev   -> normal integration
alpha -> vNext and unstable major-version work
beta  -> release candidate and staging validation
```

Recommended flow:

```text
feature/fix branch
  -> tests and build
  -> merge to dev
  -> promote to beta
  -> tag release
  -> deploy tagged image to production
```

Avoid relying on mutable `latest` tags for production unless rollback tags are also kept.

## Deployment Runbook

1. Confirm current production state:

```bash
docker ps
cd /opt/makerworks && docker compose ps
```

2. Confirm backups are current before migrations or deploys.

3. Pull the intended image tag or checked-out release.

4. Recreate services:

```bash
cd /opt/makerworks
docker compose pull
docker compose up -d
```

5. Verify health:

```bash
curl -fsS http://127.0.0.1:3000/api/health
docker compose ps
docker compose logs --tail 100 web
```

6. Check related suite services:

```bash
curl -fsS http://127.0.0.1:8000/
curl -i http://127.0.0.1:8289/health
curl -fsS http://127.0.0.1:3001/
```

PrintLab may return `401 Unauthorized` when auth is enabled. That means the service is reachable and protected.

## Rollback

Rollback should be tag-based and documented in the production compose file or deployment notes.

Basic rollback pattern:

```bash
cd /opt/makerworks
docker compose pull
docker compose up -d
docker compose ps
```

Before rollback, Codex should identify:

- current image tag
- target rollback tag
- whether a migration ran
- whether the migration is reversible
- backup timestamp

Do not roll back a database-backed release blindly after migrations.

## Suite Status Script

Use the local script from this repo:

```powershell
.\scripts\suite-status.ps1
.\scripts\suite-status.ps1 -Target production -SshHost makerworks-prod
.\scripts\suite-status.ps1 -Target production -SshHost makerworks-prod -ProductionComposePath /mnt/cache/appdata/makerworks
npm run suite:status:prod
```

The script performs status checks without embedding credentials. It can run locally or through SSH.

Current production SSH and Docker context:

```text
SSH alias: makerworks-prod
Docker context: makerworks-prod
Host: 192.168.1.170
User: root
Compose/appdata path: /mnt/cache/appdata/makerworks
```

Current production suite containers and ports:

```text
MakerWorks-dev -> ghcr.io/schartrand77/mkw2:dev          -> http://localhost:3997
stockworks     -> ghcr.io/schartrand77/stockworks:latest -> http://localhost:8256
PrintLab       -> ghcr.io/schartrand77/printlab:latest   -> http://localhost:8983
orderworks     -> ghcr.io/schartrand77/orderworks:latest -> http://localhost:3202
postgres       -> postgres:15                            -> localhost:5432
```

The production host currently does not expose Docker Compose on `PATH`. Use `docker --context makerworks-prod ps` for read-only container inspection unless a Compose installation or Unraid template workflow is added.

## Production Details To Record

When available, record the real values in a private ops note, not in public docs:

- production SSH alias
- compose root paths
- service names
- health URLs
- backup root
- registry/image tags
- restore command
- rollback tag policy
- external DNS names

Do not commit secrets, tokens, printer access codes, private database URLs, or production credentials.
