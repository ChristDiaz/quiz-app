# Client AGENTS

Frontend implementation guide for `/Users/christiandiaz/Code/quiz-app/client`.

## Stack

- React 19
- React Router 7
- Vite 7
- Tailwind CSS 4
- Vitest + Testing Library

## Commands

```bash
cd /Users/christiandiaz/Code/quiz-app/client
npm run dev
npm test
npm run build
```

## Architecture Rules

- App entry: `src/main.jsx`
- Routing and shell layout: `src/App.jsx`
- Auth state and API client: `src/context/AuthContext.jsx`
- Pages in `src/pages/`
- Shared UI in `src/components/`

## Routing and Auth Rules

- Logged-out state should only expose `login` and `signup` flows.
- Logged-in state should render the app shell and protected routes.
- New authenticated pages must be added to routing and sidebar navigation consistently.

## API Usage Rules

- Prefer the shared `apiClient` from `AuthContext` so auth headers and 401 behavior stay consistent.
- Keep request payloads consistent with backend `validateFields` allowlists.
- Handle loading and error states explicitly in forms and async page actions.

## Styling Rules

- Keep design tokens centralized in `src/index.css` (`@theme` variables).
- Prefer Tailwind utility classes and existing visual conventions.
- Validate layouts in desktop and mobile viewports.

## Testing Rules

- Use Vitest + Testing Library for component behavior.
- Wrap router-dependent components with `MemoryRouter` in tests.
- Mock auth context where route state/auth state is not under test.

## Done Criteria for Frontend Changes

- `npm test` passes.
- `npm run build` passes.
- No obvious visual regression on login and authenticated shell pages.
