import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import Signup from '../src/pages/Signup';

const mockPost = vi.fn();
const mockNavigate = vi.fn();

vi.mock('axios', () => ({
  default: {
    post: (...args) => mockPost(...args),
  },
}));

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

describe('Signup page', () => {
  beforeEach(() => {
    mockPost.mockReset();
    mockNavigate.mockReset();
  });

  it('shows password requirements checklist', () => {
    render(
      <MemoryRouter>
        <Signup />
      </MemoryRouter>
    );

    expect(screen.getByText('Password requirements')).toBeTruthy();
    expect(screen.getByText('At least 8 characters')).toBeTruthy();
    expect(screen.getByText('At least one uppercase letter')).toBeTruthy();
    expect(screen.getByText('At least one lowercase letter')).toBeTruthy();
    expect(screen.getByText('At least one number')).toBeTruthy();
    expect(screen.getByText('At least one special character')).toBeTruthy();
  });

  it('blocks submit for weak passwords and shows missing requirements', async () => {
    render(
      <MemoryRouter>
        <Signup />
      </MemoryRouter>
    );

    fireEvent.change(screen.getByLabelText('Username'), {
      target: { value: 'newuser' },
    });
    fireEvent.change(screen.getByLabelText('Email'), {
      target: { value: 'newuser@example.com' },
    });
    fireEvent.change(screen.getByLabelText('Password'), {
      target: { value: 'short' },
    });
    fireEvent.change(screen.getByLabelText('Confirm Password'), {
      target: { value: 'short' },
    });

    fireEvent.click(screen.getByRole('button', { name: 'Sign Up' }));

    expect(mockPost).not.toHaveBeenCalled();
    const errorMessage = await screen.findByText('Password is missing required items.');
    const errorBox = errorMessage.closest('div');
    expect(errorBox).toBeTruthy();
    expect(within(errorBox).getByText('Missing requirements:')).toBeTruthy();
    expect(within(errorBox).getByText('At least 8 characters')).toBeTruthy();
  });

  it('submits signup when password meets requirements', async () => {
    mockPost.mockResolvedValueOnce({
      data: { message: 'User created successfully.' },
    });

    render(
      <MemoryRouter>
        <Signup />
      </MemoryRouter>
    );

    fireEvent.change(screen.getByLabelText('Username'), {
      target: { value: 'newuser' },
    });
    fireEvent.change(screen.getByLabelText('Email'), {
      target: { value: 'newuser@example.com' },
    });
    fireEvent.change(screen.getByLabelText('Password'), {
      target: { value: 'StrongPass1!' },
    });
    fireEvent.change(screen.getByLabelText('Confirm Password'), {
      target: { value: 'StrongPass1!' },
    });

    fireEvent.click(screen.getByRole('button', { name: 'Sign Up' }));

    await waitFor(() => {
      expect(mockPost).toHaveBeenCalledWith('/api/auth/signup', {
        username: 'newuser',
        email: 'newuser@example.com',
        password: 'StrongPass1!',
      });
    });
  });
});
