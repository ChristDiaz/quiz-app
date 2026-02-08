# Production Migration Guide

This guide explains how to move this project from local development to a production server, and how to keep production updated safely after each stable change.

## Target Production Setup

- Docker Compose stack: `docker-compose.prod.yml`
- Reverse proxy and HTTPS: Caddy (`Caddyfile`)
- Database: MongoDB with auth + persistent volume
- Images: built in GitHub Actions and pushed to GHCR
- Deployment: GitHub Actions deploys to your server over SSH

Why this setup:

- Easy to operate on one server
- Reproducible deployments using immutable image tags (`sha-...`)
- Safer rollbacks
- Minimal manual work after initial setup

## 1. Prepare Your Domain and DNS

1. Buy or choose a domain/subdomain for the app (example: `quiz.example.com`).
2. Create an `A` record pointing to your production server IP.
3. Wait for DNS propagation.

Explanation:

- Caddy uses this domain to automatically issue and renew TLS certificates.

## 2. Prepare the Production Server

Run these on the production server (Ubuntu example):

```bash
sudo apt update
sudo apt install -y ca-certificates curl git
curl -fsSL https://get.docker.com | sudo sh
sudo usermod -aG docker "$USER"
newgrp docker
```

Optional but strongly recommended firewall setup:

```bash
sudo ufw allow OpenSSH
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw enable
```

Explanation:

- Only ports `80` and `443` should be public for the app.
- MongoDB and app internal ports remain private inside Docker networks.

## 3. Bootstrap the Project on the Server

```bash
mkdir -p /opt/quiz-app
cd /opt/quiz-app
git clone <YOUR_REPO_URL> .
cp .env.production.example .env.production
chmod +x scripts/deploy-production.sh scripts/backup-mongo.sh
```

Now edit `/opt/quiz-app/.env.production` and set real values:

- `APP_DOMAIN`: your domain (example `quiz.example.com`)
- `ACME_EMAIL`: email for cert registration
- `GHCR_NAMESPACE`: lowercase GitHub username/org (example `christdiaz`)
- `JWT_SECRET`: long random secret
- `MONGO_ROOT_USERNAME`, `MONGO_ROOT_PASSWORD`
- `MONGO_APP_USER`, `MONGO_APP_PASSWORD`

Explanation:

- `.env.production` is the single source of production runtime config.
- `GHCR_NAMESPACE` tells Compose where to pull built images from.

## 4. Configure GitHub for Automated Deployments

Create repository secrets (Settings -> Secrets and variables -> Actions):

- `PROD_SSH_HOST`: production server IP or hostname
- `PROD_SSH_USER`: SSH user used for deploy
- `PROD_SSH_PORT`: optional, default is `22`
- `PROD_SSH_KEY`: private key for that SSH user
- `PROD_APP_DIR`: deployment folder on server (example `/opt/quiz-app`)
- `GHCR_PAT`: optional if GHCR images are private (`read:packages` scope)
- `GHCR_USERNAME`: optional GHCR username (defaults to repository owner)

Create a GitHub Environment:

- Name: `production`
- Add required reviewer(s) for safer gated deploys

Explanation:

- Workflow `release-and-deploy.yml` uses these secrets to copy deploy files and run the deployment script remotely.
- Environment approvals add a controlled checkpoint before production changes.

## 5. First Production Deployment

Option A: Automatic

1. Push/merge to `main`.
2. Workflow `.github/workflows/release-and-deploy.yml` runs:
- tests client + server
- builds/pushes `client` and `server` images to GHCR
- deploys `sha-<commit>` to server

Option B: Manual

1. Open GitHub Actions.
2. Run `Release and Deploy` with `workflow_dispatch`.
3. Leave `image_tag` empty to deploy current commit tag.

Server-side verification:

```bash
cd /opt/quiz-app
docker compose --env-file .env.production -f docker-compose.prod.yml ps
docker compose --env-file .env.production -f docker-compose.prod.yml logs --tail=100 caddy server client
```

## 6. Normal Update Flow (Every Time You Modify the App)

1. Develop locally and test:
```bash
./start-dev.sh
cd client && npm test && npm run build
cd ../server && npm test
```
2. Push branch and open PR.
3. CI (`.github/workflows/ci.yml`) validates tests/build.
4. Merge PR into `main`.
5. Production deploy runs automatically from `release-and-deploy.yml`.

Explanation:

- Production always runs built images, never local bind-mounted code.
- Deploying commit-based image tags creates a traceable release history.

## 7. Rollback Procedure

Fast rollback from GitHub Actions:

1. Open `Release and Deploy` workflow.
2. Run manually with `image_tag=sha-<previous-commit-sha>`.

Or from server:

```bash
cd /opt/quiz-app
IMAGE_TAG=sha-<previous-commit-sha> ./scripts/deploy-production.sh
```

Explanation:

- Rollback is immediate because old images are still available in GHCR.

## 8. Backups and Restore

Create nightly backup cron (server):

```bash
crontab -e
```

Add:

```cron
0 3 * * * cd /opt/quiz-app && ./scripts/backup-mongo.sh >> /var/log/quiz-backup.log 2>&1
```

Restore example:

```bash
cd /opt/quiz-app
set -a; source .env.production; set +a
gunzip -c backups/mongo-YYYY-MM-DD-HHMMSS.archive.gz | \
docker compose --env-file .env.production -f docker-compose.prod.yml exec -T mongo \
  mongorestore --username "$MONGO_ROOT_USERNAME" --password "$MONGO_ROOT_PASSWORD" \
  --authenticationDatabase admin --archive --drop
```

## 9. Ongoing Maintenance

- Dependabot config is included in `.github/dependabot.yml` for npm and GitHub Actions updates.
- Review and merge dependency PRs after CI passes.
- Rotate `JWT_SECRET` and database passwords periodically.
- Keep OS and Docker patched on the production server.

## Files Added for Production in This Repo

- `docker-compose.prod.yml`
- `Caddyfile`
- `.env.production.example`
- `mongo/init-user.js`
- `scripts/deploy-production.sh`
- `scripts/backup-mongo.sh`
- `.github/workflows/ci.yml`
- `.github/workflows/release-and-deploy.yml`
- `.github/dependabot.yml`

## References

- Docker Compose startup ordering and health checks: https://docs.docker.com/compose/how-tos/startup-order/
- Docker Compose `up`: https://docs.docker.com/reference/cli/docker/compose/up/
- Caddy `reverse_proxy`: https://caddyserver.com/docs/caddyfile/directives/reverse_proxy
- Caddy automatic HTTPS: https://caddyserver.com/docs/automatic-https
- GitHub environments and deployment protection: https://docs.github.com/en/actions/reference/workflows-and-actions/deployments-and-environments
- GitHub Container Registry: https://docs.github.com/en/packages/working-with-a-github-packages-registry/working-with-the-container-registry

