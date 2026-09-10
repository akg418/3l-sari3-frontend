import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { Spinner } from '../components/common/Feedback.jsx';

/** Keeps a signed-in user away from the login and register screens. */
export const PublicOnlyRoute = () => {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) return <Spinner />;
  if (isAuthenticated) return <Navigate to="/channels" replace />;

  return <Outlet />;
};
