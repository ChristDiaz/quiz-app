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

## Quick Start

```bash
cd /Users/christiandiaz/Code/quiz-app
./start-dev.sh
```

Default endpoints:

- Frontend: `http://127.0.0.1:5173`
- Backend: `http://127.0.0.1:5001`
