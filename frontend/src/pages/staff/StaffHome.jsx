import { Navigate } from 'react-router-dom';
import { ROLE_HOME, useAuth } from '../../lib/auth';

/** /staff → inicio según el rol. */
export default function StaffHome() {
  const { user } = useAuth();
  return <Navigate to={ROLE_HOME[user?.role] || '/staff/login'} replace />;
}
