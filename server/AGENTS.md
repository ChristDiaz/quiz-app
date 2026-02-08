# Server AGENTS

Backend implementation guide for `/Users/christiandiaz/Code/quiz-app/server`.

## Stack

- Node.js + Express 5
- MongoDB + Mongoose 9
- Jest + Supertest for tests

## Commands

```bash
cd /Users/christiandiaz/Code/quiz-app/server
npm start
npm test
```

## Required Environment

- `JWT_SECRET`: required for auth token signing/verification
- `PORT`: defaults to `5000` in code, set by startup scripts as needed
- `MONGO_URI`: defaults to local Mongo
- `FRONTEND_URL`: optional CORS origin extension

## Architecture Rules

- Entry point: `index.js`
- Route modules live in `routes/`
- Middleware lives in `middleware/`
- Persistence models live in `models/`
- Keep route handlers focused and move reusable logic to middleware/helpers when needed.

## API and Security Rules

- Keep all API routes under `/api/*`.
- Preserve Helmet and CORS protections in `index.js`.
- Keep auth routes rate-limited.
- Use field allowlists (`validateFields`) for request body validation.
- Validate and sanitize inputs before writes.
- Do not log secrets, tokens, or password hashes.
- Keep Express 5 compatible route patterns (avoid legacy wildcard patterns that break path parsing).

## Testing Rules

- Add/adjust Jest tests for behavior changes.
- Prefer isolated tests with model mocking when DB is not required.
- Use integration-style tests with Supertest for route behavior and HTTP contracts.

## Done Criteria for Backend Changes

- `npm test` passes.
- No new `npm audit` vulnerabilities introduced without mitigation notes.
- Routes, middleware, and models remain consistent with existing API contracts.
