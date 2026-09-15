import React, { createContext, useContext, useState, useEffect } from 'react';

const AuthContext = createContext(null);
const BACKEND = import.meta.env.VITE_BACKEND_URL || 'https://smart-kiosk-v7ws.onrender.com';

export function AuthProvider({ children }) {
  const [token, setToken] = useState(localStorage.getItem('adminToken') || null);
  const [user, setUser] = useState(JSON.parse(localStorage.getItem('adminUser')) || null);

  useEffect(() => {
    if (token) {
      localStorage.setItem('adminToken', token);
      localStorage.setItem('adminUser', JSON.stringify(user));
    } else {
      localStorage.removeItem('adminToken');
      localStorage.removeItem('adminUser');
    }
  }, [token, user]);

  const login = async (email, password) => {
    const res = await fetch(`${BACKEND}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Autentificare eșuată');
    
    setToken(data.token);
    setUser(data.user);
    return data;
  };

  const logout = () => {
    setToken(null);
    setUser(null);
  };

  // Helper fetch to automatically inject token
  const fetchWithAuth = async (url, options = {}) => {
    const defaultHeaders = { 
      'Content-Type': 'application/json',
      'x-api-key': import.meta.env.VITE_API_KEY || 'sk-live-2024-secure'
    };
    const headers = { ...defaultHeaders, ...options.headers };
    if (token) headers['Authorization'] = `Bearer ${token}`;
    
    // Remove Content-Type for FormData so browser can set boundary automatically
    if (options.body instanceof FormData) {
      delete headers['Content-Type'];
    }
    
    const res = await fetch(url, { ...options, headers });
    if (res.status === 401) {
      try {
        const clone = res.clone();
        const data = await clone.json();
        if (data && (data.error === 'Not authorized, token failed' || data.error === 'Not authorized, no token')) {
          console.warn('[Auth] Token invalid sau expirat:', data.error);
          logout();
        }
      } catch (_) {}
    }
    return res;
  };

  return (
    <AuthContext.Provider value={{ token, user, login, logout, fetchWithAuth }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
