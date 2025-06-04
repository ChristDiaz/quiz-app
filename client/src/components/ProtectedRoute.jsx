// Provides route protection by verifying authentication state.
import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

function ProtectedRoute() {
  // Get BOTH isLoggedIn and the loading state from context
  const { isLoggedIn, authLoading: isAuthLoading } = useAuth();

  // If authentication status is still being determined, show a loading indicator
  if (isAuthLoading) {
    return (
      <div className="flex justify-center items-center h-[calc(100vh-10rem)]"> {/* Adjust height as needed */}
        <p className="text-gray-500 animate-pulse text-lg">Verifying access...</p>
      </div>
    );
  }

  // If loading is finished and user is not logged in, redirect to login
  if (!isLoggedIn) {
    console.log("ProtectedRoute: Not logged in, redirecting to /login"); // Debug log
    return <Navigate to="/login" replace />;
  }

  // If loading is finished and user is logged in, render the requested component
  console.log("ProtectedRoute: Logged in, rendering Outlet."); // Debug log
  return <Outlet />;
}

export default ProtectedRoute;
