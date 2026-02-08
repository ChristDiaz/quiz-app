import React, { createContext, useState, useContext, useEffect, useCallback } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';

// --- Axios Instance Setup ---
export const apiClient = axios.create({
  baseURL: '/api',
});

// Add a request interceptor to attach the token
apiClient.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers['Authorization'] = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// --- React Context Definition ---
const AuthContext = createContext(null);

// --- AuthProvider Component ---
export const AuthProvider = ({ children }) => {
  const [token, setToken] = useState(localStorage.getItem('token'));
  const [user, setUser] = useState(null);
  const [isLoggedIn, setIsLoggedIn] = useState(!!localStorage.getItem('token'));
  const [authLoading, setAuthLoading] = useState(true); // Only for initial auth check
  const navigate = useNavigate();

  // Function to check auth status (e.g., verify token with backend)
  const checkAuthStatus = useCallback(async () => {
    const storedToken = localStorage.getItem('token');
    if (!storedToken) {
      setIsLoggedIn(false);
      setToken(null);
      setUser(null);
      setAuthLoading(false);
      return;
    }
    try {
      const response = await apiClient.get('/auth/me');
      setUser(response.data.user);
      setToken(storedToken);
      setIsLoggedIn(true);
    } catch (error) {
      setIsLoggedIn(false);
      setToken(null);
      setUser(null);
    } finally {
      setAuthLoading(false);
    }
  }, []);

  useEffect(() => {
    checkAuthStatus();
  }, [checkAuthStatus]);

  const refreshUser = useCallback(async () => {
    const response = await apiClient.get('/auth/me');
    setUser(response.data.user);
    return response.data.user;
  }, []);

  // Login function
  const login = async (email, password) => {
    try {
      const response = await apiClient.post('/auth/login', { email, password });
      const { token: newToken, user: loggedInUser } = response.data;
      localStorage.setItem('token', newToken);
      setToken(newToken);
      setUser(loggedInUser);
      setIsLoggedIn(true);
    } catch (error) {
      throw error; // Let the Login page handle error display
    }
  };

  // Logout function
  const logout = useCallback(() => {
    localStorage.removeItem('token');
    setToken(null);
    setUser(null);
    setIsLoggedIn(false);
  }, []);

  // Add response interceptor for handling 401 globally *inside* the provider
  useEffect(() => {
    const responseInterceptor = apiClient.interceptors.response.use(
      response => response,
      error => {
        const isLoginRequest =
          error.config &&
          error.config.url &&
          error.config.url.includes('/auth/login');
        if (
          error.response &&
          error.response.status === 401 &&
          isLoggedIn &&
          !isLoginRequest
        ) {
          logout();
        }
        return Promise.reject(error);
      }
    );
    return () => {
      apiClient.interceptors.response.eject(responseInterceptor);
    };
  }, [isLoggedIn, logout]);

  const value = {
    token,
    user,
    isLoggedIn,
    authLoading, // Only for initial auth check
    login,
    logout,
    refreshUser,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

// --- Custom Hook to use the Auth Context ---
export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined || context === null) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
