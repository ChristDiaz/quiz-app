import { render } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import App from '../src/App';

vi.mock('../src/context/AuthContext', () => ({
  useAuth: () => ({
    isLoggedIn: false,
    logout: vi.fn(),
    authLoading: false,
  }),
}));

describe('App', () => {
  it('renders without crashing', () => {
    render(
      <MemoryRouter>
        <App />
      </MemoryRouter>
    );
  });
});
