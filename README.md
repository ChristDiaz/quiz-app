# Quiz App

Monorepo for the Quiz App frontend and backend.

## Project Structure

- `client/` - React + Vite frontend
- `server/` - Express + MongoDB backend
- `start-dev.sh` - starts Mongo, backend, and frontend for local dev

## Documentation

- Project-wide rules: [AGENTS.md](./AGENTS.md)
- Frontend rules: [client/AGENTS.md](./client/AGENTS.md)
- Backend rules: [server/AGENTS.md](./server/AGENTS.md)
- Production migration guide: [PRODUCTION_MIGRATION.md](./PRODUCTION_MIGRATION.md)

## Quick Start

```bash
cd /Users/christiandiaz/Code/quiz-app
./start-dev.sh
```

Default endpoints:

- Frontend: `http://127.0.0.1:5173`
- Backend: `http://127.0.0.1:5001`

## Production Quick Checklist

Use this as the fast path after each stable change. Full details are in [PRODUCTION_MIGRATION.md](./PRODUCTION_MIGRATION.md).

1. Validate locally:
```bash
./start-dev.sh
cd client && npm test && npm run build
cd ../server && npm test
```
2. Push branch, open PR, merge to `main` after CI passes.
3. Confirm `Release and Deploy` workflow is green in GitHub Actions.
4. On server, verify containers and logs:
```bash
cd /opt/quiz-app
docker compose --env-file .env.production -f docker-compose.prod.yml ps
docker compose --env-file .env.production -f docker-compose.prod.yml logs --tail=100 caddy server client
```
5. Validate public access:
```bash
curl -I http://quizcraft.elatron.net
curl -vkI https://quizcraft.elatron.net
```
6. Validate LAN access (split DNS):
```bash
nslookup quizcraft.elatron.net
openssl s_client -connect quizcraft.elatron.net:443 -servername quizcraft.elatron.net </dev/null 2>/dev/null | openssl x509 -noout -subject -issuer -dates -ext subjectAltName
```
7. If any check fails, rollback to previous image tag (`sha-...`) and investigate using the full runbook.
