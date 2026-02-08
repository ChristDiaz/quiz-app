import { useEffect, useState } from 'react';
import PageHeader from '../components/PageHeader';
import { apiClient, useAuth } from '../context/AuthContext';

function Settings() {
  const { user, refreshUser } = useAuth();

  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [profileError, setProfileError] = useState('');
  const [profileSuccess, setProfileSuccess] = useState('');
  const [profileLoading, setProfileLoading] = useState(false);

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [passwordSuccess, setPasswordSuccess] = useState('');
  const [passwordLoading, setPasswordLoading] = useState(false);

  useEffect(() => {
    if (user) {
      setUsername(user.username || '');
      setEmail(user.email || '');
    }
  }, [user]);

  const inputClasses = "border border-gray-300 rounded w-full p-2 focus:outline-none focus:ring-2 focus:ring-[#2980b9] focus:border-transparent disabled:bg-gray-100";
  const primaryButtonClasses = "text-white px-4 py-2 rounded hover:bg-[#2573a6] transition-colors duration-150 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#2573a6] disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2";

  const handleProfileSubmit = async (e) => {
    e.preventDefault();
    setProfileError('');
    setProfileSuccess('');

    const trimmedUsername = username.trim();
    const trimmedEmail = email.trim().toLowerCase();

    if (!trimmedUsername || !trimmedEmail) {
      setProfileError('Username and email are required.');
      return;
    }

    const payload = {};
    if (!user || trimmedUsername !== user.username) {
      payload.username = trimmedUsername;
    }
    if (!user || trimmedEmail !== user.email) {
      payload.email = trimmedEmail;
    }

    if (Object.keys(payload).length === 0) {
      setProfileSuccess('No changes to save.');
      return;
    }

    setProfileLoading(true);
    try {
      await apiClient.patch('/users/me', payload);
      const updatedUser = await refreshUser();
      setUsername(updatedUser.username || '');
      setEmail(updatedUser.email || '');
      setProfileSuccess('Profile updated successfully.');
    } catch (err) {
      setProfileError(err.response?.data?.message || 'Failed to update profile.');
    } finally {
      setProfileLoading(false);
    }
  };

  const handlePasswordSubmit = async (e) => {
    e.preventDefault();
    setPasswordError('');
    setPasswordSuccess('');

    if (!currentPassword || !newPassword || !confirmNewPassword) {
      setPasswordError('Please fill in all password fields.');
      return;
    }

    if (newPassword !== confirmNewPassword) {
      setPasswordError('New passwords do not match.');
      return;
    }

    setPasswordLoading(true);
    try {
      await apiClient.patch('/auth/password', {
        currentPassword,
        newPassword,
      });
      setPasswordSuccess('Password updated successfully.');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmNewPassword('');
    } catch (err) {
      setPasswordError(err.response?.data?.message || 'Failed to update password.');
    } finally {
      setPasswordLoading(false);
    }
  };

  return (
    <div className="p-8">
      <PageHeader title="Settings" />

      <div className="max-w-3xl space-y-6">
        <section className="bg-white border border-gray-200 rounded-lg shadow-sm p-6">
          <h2 className="text-xl font-semibold text-gray-700 mb-1">Personal Details</h2>
          <p className="text-sm text-gray-500 mb-6">
            Update the name and email associated with your account.
          </p>

          <form onSubmit={handleProfileSubmit} className="space-y-4">
            {profileError && (
              <div className="p-3 rounded bg-red-100 text-red-700 border border-red-300 text-sm">
                {profileError}
              </div>
            )}
            {profileSuccess && (
              <div className="p-3 rounded bg-green-100 text-green-700 border border-green-300 text-sm">
                {profileSuccess}
              </div>
            )}

            <div>
              <label htmlFor="settings-username" className="block text-sm font-medium text-gray-700 mb-1">Username</label>
              <input
                id="settings-username"
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className={inputClasses}
                disabled={profileLoading}
                required
              />
            </div>

            <div>
              <label htmlFor="settings-email" className="block text-sm font-medium text-gray-700 mb-1">Email</label>
              <input
                id="settings-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className={inputClasses}
                disabled={profileLoading}
                required
              />
            </div>

            <button
              type="submit"
              className={`${primaryButtonClasses} bg-[#2980b9]`}
              disabled={profileLoading}
            >
              {profileLoading ? 'Saving...' : 'Save Changes'}
            </button>
          </form>
        </section>

        <section className="bg-white border border-gray-200 rounded-lg shadow-sm p-6">
          <h2 className="text-xl font-semibold text-gray-700 mb-1">Password</h2>
          <p className="text-sm text-gray-500 mb-6">
            Use a strong password with at least 8 characters, including uppercase, lowercase, a number, and a special character.
          </p>

          <form onSubmit={handlePasswordSubmit} className="space-y-4">
            {passwordError && (
              <div className="p-3 rounded bg-red-100 text-red-700 border border-red-300 text-sm">
                {passwordError}
              </div>
            )}
            {passwordSuccess && (
              <div className="p-3 rounded bg-green-100 text-green-700 border border-green-300 text-sm">
                {passwordSuccess}
              </div>
            )}

            <div>
              <label htmlFor="current-password" className="block text-sm font-medium text-gray-700 mb-1">Current Password</label>
              <input
                id="current-password"
                type="password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                className={inputClasses}
                disabled={passwordLoading}
                required
              />
            </div>

            <div>
              <label htmlFor="new-password" className="block text-sm font-medium text-gray-700 mb-1">New Password</label>
              <input
                id="new-password"
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className={inputClasses}
                disabled={passwordLoading}
                required
              />
            </div>

            <div>
              <label htmlFor="confirm-new-password" className="block text-sm font-medium text-gray-700 mb-1">Confirm New Password</label>
              <input
                id="confirm-new-password"
                type="password"
                value={confirmNewPassword}
                onChange={(e) => setConfirmNewPassword(e.target.value)}
                className={inputClasses}
                disabled={passwordLoading}
                required
              />
            </div>

            <button
              type="submit"
              className={`${primaryButtonClasses} bg-[#2980b9]`}
              disabled={passwordLoading}
            >
              {passwordLoading ? 'Updating...' : 'Update Password'}
            </button>
          </form>
        </section>
      </div>
    </div>
  );
}

export default Settings;
