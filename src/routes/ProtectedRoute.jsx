import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { Spinner } from '../components/common/Feedback.jsx';

/**
 * Gate for authenticated pages.
 *
 * While the stored token is being re-validated the route renders nothing but a
 * spinner, so a reload never flashes the login page at a signed-in user.
 */
export const ProtectedRoute = () => {
  const { isAuthenticated, isLoading } = useAuth();
  const location = useLocation();

  if (isLoading) return <Spinner label="Restoring your session…" />;

  if (!isAuthenticated) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  return <Outlet />;
};
