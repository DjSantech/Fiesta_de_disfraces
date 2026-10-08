import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { api, staffApi, tokenStore } from './api';

const AuthContext = createContext(null);

export const ROLE_HOME = {
  admin: '/staff/admin',
  puerta: '/staff/puerta',
  barra: '/staff/barra',
};

export const ROLE_LABEL = {
  admin: 'Administrador',
  puerta: 'Portería',
  barra: 'Barra',
};

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(() => Boolean(tokenStore.get()));

  // Si hay token guardado, valida la sesión al cargar.
  useEffect(() => {
    if (!tokenStore.get()) return undefined;
    let alive = true;
    staffApi('/api/auth/me')
      .then((data) => alive && setUser(data.user))
      .catch(() => {
        if (!alive) return;
        tokenStore.set(null);
        setUser(null);
      })
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, []);

  // Cualquier 401 de la API cierra la sesión.
  useEffect(() => {
    const onUnauthorized = () => setUser(null);
    window.addEventListener('fd:unauthorized', onUnauthorized);
    return () => window.removeEventListener('fd:unauthorized', onUnauthorized);
  }, []);

  const login = useCallback(async (username, password) => {
    const data = await api('/api/auth/login', { method: 'POST', body: { username, password } });
    tokenStore.set(data.token);
    setUser(data.user);
    return data.user;
  }, []);

  const logout = useCallback(() => {
    tokenStore.set(null);
    setUser(null);
  }, []);

  const value = useMemo(() => ({ user, loading, login, logout }), [user, loading, login, logout]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth debe usarse dentro de <AuthProvider>');
  return ctx;
}
