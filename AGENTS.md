# AGENTS

This file defines project-wide engineering rules for humans and AI agents working in this repository.

## Scope

- Applies to the full repo: `/Users/christiandiaz/Code/quiz-app`
- Subproject-specific rules are in:
- `/Users/christiandiaz/Code/quiz-app/client/AGENTS.md`
- `/Users/christiandiaz/Code/quiz-app/server/AGENTS.md`

## Repository Map

- `client/`: React + Vite frontend
- `server/`: Express + MongoDB API
- `docker-compose.yml`: MongoDB service and containerized app setup
- `start-dev.sh`: preferred local startup script

## Local Development

- Preferred startup:
```bash
cd /Users/christiandiaz/Code/quiz-app
./start-dev.sh
```
- Default local endpoints:
- Frontend: `http://127.0.0.1:5173`
- Backend: `http://127.0.0.1:5001`
- MongoDB: Docker container `quiz-app-mongo-1`

## Baseline Standards

- Keep changes scoped and production-safe.
- Do not commit secrets or `.env` values.
- Keep lockfiles in sync with dependency changes.
- Do not bypass failing tests without documenting the reason.

## Security Baseline

- Treat `JWT_SECRET` as required in all non-test environments.
- Preserve auth route rate limiting and security headers.
- Keep CORS strict to known frontend origins.
- Validate request payloads before persistence.
- Run dependency checks regularly:
```bash
cd client && npm audit
cd ../server && npm audit
```

## Verification Before Merge

Run all relevant checks for touched areas.

- Frontend:
```bash
cd /Users/christiandiaz/Code/quiz-app/client
npm test
npm run build
```
- Backend:
```bash
cd /Users/christiandiaz/Code/quiz-app/server
npm test
```

## Dependency Update Policy

- Prefer non-breaking updates first.
- Major upgrades require:
- explicit compatibility review
- test pass confirmation
- migration notes in PR description
- Use `overrides` only when needed for vulnerable transitive dependencies.

## Change Checklist

- Code matches existing architecture and style.
- Security-sensitive paths reviewed (auth, validation, headers, CORS).
- Tests updated or added when behavior changes.
- Startup and build commands still work.
- Docs updated if workflows or commands changed.
