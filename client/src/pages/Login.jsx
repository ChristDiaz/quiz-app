import { useState } from 'react';
import { Link, useNavigate, Navigate } from 'react-router-dom';
import { LogIn } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const { login, isLoggedIn, authLoading } = useAuth();
  const navigate = useNavigate();

  if (authLoading) {
    return <div>Loading...</div>;
  }

  if (isLoggedIn) {
    return <Navigate to="/dashboard" replace />;
  }

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      await login(email, password);
    } catch (err) {
      let errorMessage = 'Login failed. Please check your credentials.';
      if (err.response && err.response.data && err.response.data.message) {
        errorMessage = err.response.data.message;
      } else if (err.message) {
        errorMessage = err.message;
      }
      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  const primaryButtonBase = "w-full text-white rounded transition-colors duration-150 focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 py-2 px-4";
  const primaryButtonColors = "bg-[#2980b9] hover:bg-[#2573a6] focus:ring-[#2573a6]";
  const loginButtonClasses = `${primaryButtonBase} ${primaryButtonColors}`;
  const inputClasses = "border border-gray-300 rounded w-full p-2 focus:outline-none focus:ring-2 focus:ring-[#2980b9] focus:border-transparent disabled:bg-gray-100";

  return (
    <>
      <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-blue-50 via-white to-blue-100 p-4">
        <div className="w-full max-w-md bg-white rounded-xl shadow-xl overflow-hidden">
          <div className="bg-[#2980b9] p-6 text-center">
            <img src="/logo.png" alt="QuizCraft Logo" className="mx-auto h-16 w-auto mb-3 drop-shadow-md" />
            <h1 className="text-3xl font-bold text-white">QuizCraft</h1>
            <p className="text-blue-100 mt-1 text-sm">Your Personal Quiz Companion</p>
          </div>
          <div className="p-8 space-y-6">
            <div className="text-center text-gray-600">
              <p className="mb-4">
                Welcome back to <strong>QuizCraft</strong>! Create, share, and take quizzes to boost your knowledge. Log in to access your dashboard and continue learning.
              </p>
            </div>
            <form onSubmit={handleSubmit} className="space-y-4">
              <h2 className="text-xl font-semibold text-center text-gray-700 mb-5">Log In to Your Account</h2>
              <div>
                <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">Email Address</label>
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className={inputClasses}
                  required
                  placeholder="you@example.com"
                  disabled={isLoading}
                />
              </div>
              <div>
                <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">Password</label>
                <input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className={inputClasses}
                  required
                  placeholder="••••••••"
                  disabled={isLoading}
                />
                {error && (
                  <div className="mt-2 p-2 rounded bg-red-100 text-red-700 text-sm border border-red-300 text-center">
                    {error}
                  </div>
                )}
              </div>
              <div className="pt-2">
                <button
                  type="submit"
                  className={loginButtonClasses}
                  disabled={isLoading}
                >
                  {isLoading ? (
                    <>
                      <svg className="animate-spin -ml-1 mr-2 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                      Logging In...
                    </>
                  ) : (
                    <>
                      <LogIn size={18} />
                      Log In
                    </>
                  )}
                </button>
              </div>
            </form>
            <div className="mt-6 text-center text-sm text-gray-600">
              Don't have an account?{' '}
              <Link to="/signup" className="font-medium text-[#2980b9] hover:text-[#2573a6] hover:underline">
                Sign Up
              </Link>
            </div>
          </div>
        </div>
        <footer className="text-center text-gray-500 text-xs mt-8">
          &copy; {new Date().getFullYear()} QuizCraft. All rights reserved.
        </footer>
      </div>
    </>
  );
}

export default Login;