import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import Settings from '../src/pages/Settings';

const mockPatch = vi.fn();
const mockRefreshUser = vi.fn();
const mockUseAuth = vi.fn();

vi.mock('../src/context/AuthContext', () => ({
  apiClient: {
    patch: (...args) => mockPatch(...args),
  },
  useAuth: () => mockUseAuth(),
}));

describe('Settings page', () => {
  beforeEach(() => {
    mockPatch.mockReset();
    mockRefreshUser.mockReset();
    mockUseAuth.mockReset();

    mockUseAuth.mockReturnValue({
      user: {
        username: 'existing-user',
        email: 'existing@example.com',
      },
      refreshUser: mockRefreshUser,
    });
  });

  it('renders existing user details', () => {
    render(<Settings />);

    expect(screen.getByLabelText('Username').value).toBe('existing-user');
    expect(screen.getByLabelText('Email').value).toBe('existing@example.com');
  });

  it('saves updated profile details and refreshes user context', async () => {
    mockPatch.mockResolvedValueOnce({ data: { message: 'Profile updated successfully.' } });
    mockRefreshUser.mockResolvedValueOnce({
      username: 'updated-user',
      email: 'updated@example.com',
    });

    render(<Settings />);

    fireEvent.change(screen.getByLabelText('Username'), {
      target: { value: 'updated-user' },
    });
    fireEvent.change(screen.getByLabelText('Email'), {
      target: { value: 'updated@example.com' },
    });

    fireEvent.click(screen.getByRole('button', { name: 'Save Changes' }));

    await waitFor(() => {
      expect(mockPatch).toHaveBeenCalledWith('/users/me', {
        username: 'updated-user',
        email: 'updated@example.com',
      });
    });
    expect(mockRefreshUser).toHaveBeenCalledTimes(1);
    expect(await screen.findByText('Profile updated successfully.')).toBeTruthy();
  });

  it('does not call profile API when no profile values changed', async () => {
    render(<Settings />);

    fireEvent.click(screen.getByRole('button', { name: 'Save Changes' }));

    expect(mockPatch).not.toHaveBeenCalled();
    expect(await screen.findByText('No changes to save.')).toBeTruthy();
  });

  it('shows password mismatch validation without calling API', async () => {
    render(<Settings />);

    fireEvent.change(screen.getByLabelText('Current Password'), {
      target: { value: 'OldPass1!' },
    });
    fireEvent.change(screen.getByLabelText('New Password'), {
      target: { value: 'NewPass1!' },
    });
    fireEvent.change(screen.getByLabelText('Confirm New Password'), {
      target: { value: 'Different1!' },
    });

    fireEvent.click(screen.getByRole('button', { name: 'Update Password' }));

    expect(mockPatch).not.toHaveBeenCalled();
    expect(await screen.findByText('New passwords do not match.')).toBeTruthy();
  });

  it('shows missing password requirements without calling API', async () => {
    render(<Settings />);

    fireEvent.change(screen.getByLabelText('Current Password'), {
      target: { value: 'OldPass1!' },
    });
    fireEvent.change(screen.getByLabelText('New Password'), {
      target: { value: 'short' },
    });
    fireEvent.change(screen.getByLabelText('Confirm New Password'), {
      target: { value: 'short' },
    });

    fireEvent.click(screen.getByRole('button', { name: 'Update Password' }));

    expect(mockPatch).not.toHaveBeenCalled();
    const errorMessage = await screen.findByText('New password is missing required items.');
    const errorBox = errorMessage.closest('div');
    expect(errorBox).toBeTruthy();
    expect(within(errorBox).getByText('Missing requirements:')).toBeTruthy();
    expect(within(errorBox).getByText('At least 8 characters')).toBeTruthy();
  });

  it('updates password and clears password inputs on success', async () => {
    mockPatch.mockResolvedValueOnce({ data: { message: 'Password updated successfully.' } });

    render(<Settings />);

    const currentPasswordInput = screen.getByLabelText('Current Password');
    const newPasswordInput = screen.getByLabelText('New Password');
    const confirmNewPasswordInput = screen.getByLabelText('Confirm New Password');

    fireEvent.change(currentPasswordInput, {
      target: { value: 'OldPass1!' },
    });
    fireEvent.change(newPasswordInput, {
      target: { value: 'NewPass1!' },
    });
    fireEvent.change(confirmNewPasswordInput, {
      target: { value: 'NewPass1!' },
    });

    fireEvent.click(screen.getByRole('button', { name: 'Update Password' }));

    await waitFor(() => {
      expect(mockPatch).toHaveBeenCalledWith('/auth/password', {
        currentPassword: 'OldPass1!',
        newPassword: 'NewPass1!',
      });
    });

    expect(await screen.findByText('Password updated successfully.')).toBeTruthy();
    expect(currentPasswordInput.value).toBe('');
    expect(newPasswordInput.value).toBe('');
    expect(confirmNewPasswordInput.value).toBe('');
  });

  it('shows backend missing requirements when API rejects password', async () => {
    mockPatch.mockRejectedValueOnce({
      response: {
        data: {
          message: 'Password does not meet policy requirements.',
          missingRequirements: ['At least one uppercase letter', 'At least one number'],
        },
      },
    });

    render(<Settings />);

    fireEvent.change(screen.getByLabelText('Current Password'), {
      target: { value: 'OldPass1!' },
    });
    fireEvent.change(screen.getByLabelText('New Password'), {
      target: { value: 'NewPass1!' },
    });
    fireEvent.change(screen.getByLabelText('Confirm New Password'), {
      target: { value: 'NewPass1!' },
    });

    fireEvent.click(screen.getByRole('button', { name: 'Update Password' }));

    const errorMessage = await screen.findByText('Password does not meet policy requirements.');
    const errorBox = errorMessage.closest('div');
    expect(errorBox).toBeTruthy();
    expect(within(errorBox).getByText('At least one uppercase letter')).toBeTruthy();
    expect(within(errorBox).getByText('At least one number')).toBeTruthy();
  });
});
