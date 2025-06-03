import React, { createContext, useState, useContext, useEffect, useCallback } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom'; // Import useNavigate

// --- Axios Instance Setup ---
// Create an Axios instance (recommended)
export const apiClient = axios.create({ // <-- Export apiClient as named export
  baseURL: '/api', // Your API base URL
});

// Add a request interceptor to attach the token
apiClient.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers['Authorization'] = `Bearer ${token}`;
      // console.log('Interceptor: Attaching token'); // Less verbose log
    } else {
      // console.log('Interceptor: No token found.');
    }
    return config;
  },
  (error) => {
    console.error('Axios Request Interceptor Error:', error);
    return Promise.reject(error);
  }
);

// --- React Context Definition ---
const AuthContext = createContext(null);

// --- AuthProvider Component ---
export const AuthProvider = ({ children }) => { // <-- Export AuthProvider
  const [token, setToken] = useState(localStorage.getItem('token'));
  const [user, setUser] = useState(null); // Optional: Store user info
  const [isLoggedIn, setIsLoggedIn] = useState(!!localStorage.getItem('token'));
  const [isLoading, setIsLoading] = useState(true); // Start loading until checked
  const navigate = useNavigate(); // Hook for navigation

  // Function to check auth status (e.g., verify token with backend)
  const checkAuthStatus = useCallback(async () => {
    const storedToken = localStorage.getItem('token');
    if (!storedToken) {
      setIsLoggedIn(false);
      setToken(null);
      setUser(null);
      setIsLoading(false);
      console.log("AuthContext: No token found, setting logged out.");
      return;
    }

    console.log("AuthContext: Token found, verifying...");
    try {
      // Use the apiClient instance which automatically adds the token
      // Make a request to a protected endpoint to verify the token
      const response = await apiClient.get('/auth/me');
      setUser(response.data.user); // Assuming backend returns user info
      setToken(storedToken);
      setIsLoggedIn(true);
      console.log("AuthContext: Token verified successfully.");
    } catch (error) {
      console.error("AuthContext: Token verification failed:", error.response?.data?.message || error.message);
      localStorage.removeItem('token'); // Remove invalid token
      setToken(null);
      setUser(null);
      setIsLoggedIn(false);
      // Optionally navigate to login if verification fails on load
      // navigate('/login', { replace: true });
    } finally {
      setIsLoading(false);
    }
  }, []); // No dependencies needed if navigate isn't used inside

  // Check authentication status on initial load
  useEffect(() => {
    console.log("AuthContext: Initializing - checking auth status...");
    checkAuthStatus();
  }, [checkAuthStatus]); // Run checkAuthStatus when it changes (only on mount due to useCallback)

  // Login function
  const login = async (email, password) => {
    try {
      setIsLoading(true); // Indicate loading during login attempt
      const response = await apiClient.post('/auth/login', { email, password });
      const { token: newToken, user: loggedInUser } = response.data; // Adjust based on your API response

      localStorage.setItem('token', newToken);
      setToken(newToken);
      setUser(loggedInUser); // Store user info
      setIsLoggedIn(true);
      console.log("AuthContext: Login successful.");
      // Navigation should happen in App.jsx based on isLoggedIn state change
      // navigate('/dashboard'); // Avoid navigation directly in context if possible
    } catch (error) {
      console.error("AuthContext: Login failed:", error);
      // Clear any potential stale state
      localStorage.removeItem('token');
      setToken(null);
      setUser(null);
      setIsLoggedIn(false);
      throw error; // Re-throw error so the Login component can handle it (e.g., show message)
    } finally {
      setIsLoading(false); // Stop loading indicator
    }
  };

  // Logout function
  const logout = useCallback(() => {
    console.log("AuthContext: Logging out.");
    localStorage.removeItem('token');
    setToken(null);
    setUser(null);
    setIsLoggedIn(false);
    // Optional: Make API call to invalidate token on backend
    // apiClient.post('/auth/logout').catch(err => console.error("Logout API call failed:", err));

    // Navigation happens in App.jsx based on isLoggedIn state change
    // navigate('/login', { replace: true }); // Avoid navigation directly in context
  }, []); // No dependencies needed if navigate isn't used inside

  // Add response interceptor for handling 401 globally *inside* the provider
  // This ensures 'logout' is available in the interceptor's scope
  useEffect(() => {
    const responseInterceptor = apiClient.interceptors.response.use(
      response => response,
      error => {
        if (error.response && error.response.status === 401 && isLoggedIn) { // Only logout if currently logged in
          console.error("Axios Response Interceptor: Unauthorized (401)! Logging out.");
          logout(); // Call the logout function from the context
        }
        return Promise.reject(error);
      }
    );

    // Cleanup interceptor on component unmount
    return () => {
      apiClient.interceptors.response.eject(responseInterceptor);
    };
  }, [isLoggedIn, logout]); // Re-attach interceptor if isLoggedIn or logout changes


  // Value provided by the context
  const value = {
    token,
    user,
    isLoggedIn,
    isLoading, // Provide loading state
    login,
    logout,
    // apiClient, // You could provide apiClient here, but importing it directly is also fine
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

// --- Custom Hook to use the Auth Context ---
export const useAuth = () => { // <-- Export useAuth
  const context = useContext(AuthContext);
  if (context === undefined || context === null) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

// Default export is no longer needed or should be something else if required
// export default apiClient; // REMOVE THIS or change if needed elsewhere as default
