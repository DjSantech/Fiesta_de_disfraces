import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { ROLE_HOME, useAuth } from '../../lib/auth';
import { PageSpinner } from '../ui';

/**
 * Protege rutas del staff. Sin sesión → login (con ?next=). Rol no permitido → inicio de su rol.
 * <RequireRole roles={['admin']}>…</RequireRole>  o como layout route sin children (usa <Outlet/>).
 */
export default function RequireRole({ roles, children }) {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) return <PageSpinner label="Verificando sesión…" />;
  if (!user) {
    const next = encodeURIComponent(location.pathname + location.search);
    return <Navigate to={`/staff/login?next=${next}`} replace />;
  }
  if (roles && !roles.includes(user.role)) {
    return <Navigate to={ROLE_HOME[user.role] || '/staff/login'} replace />;
  }
  return children ?? <Outlet />;
}
