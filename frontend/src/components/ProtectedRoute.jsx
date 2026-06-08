import { Navigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import LoadingScreen from "../components/ui/LoadingScreen";
import { useBasePath } from "../context/SlugContext";

/**
 * ProtectedRoute - Protects routes and requires authentication + specific roles
 */
export const ProtectedRoute = ({ children, roles }) => {
  const { user, loading } = useAuth();
  const base = useBasePath();

  if (loading) {
    return <LoadingScreen />;
  }

  if (!user) {
    return <Navigate to={`${base || ""}/login`} replace />;
  }

  if (roles && !roles.includes(user.role)) {
    return <Navigate to={`${base || ""}/unauthorized`} replace />;
  }

  return children;
};

/**
 * ApprovedRoute - Protects routes and requires approval status
 * Used for staff dashboards that require admin approval
 */
export const ApprovedRoute = ({ children }) => {
  const { user, loading, approvalStatus } = useAuth();
  const base = useBasePath();

  if (loading) {
    return <LoadingScreen />;
  }

  if (!user) {
    return <Navigate to={`${base || ""}/login`} replace />;
  }

  if (approvalStatus === "pending") {
    return <Navigate to={`${base || ""}/pending-approval`} replace />;
  }

  if (approvalStatus === "rejected") {
    return <Navigate to={`${base || ""}/approval-rejected`} replace />;
  }

  return children;
};

/**
 * AdminOnlyRoute - Allows only admin users
 */
export const AdminOnlyRoute = ({ children }) => {
  const { user, loading } = useAuth();
  const base = useBasePath();

  if (loading) {
    return <LoadingScreen />;
  }

  if (!user || user.role !== "admin") {
    return <Navigate to={`${base || ""}/unauthorized`} replace />;
  }

  return children;
};

/**
 * ManagerOrAdminRoute - Allows manager and admin users
 */
export const ManagerOrAdminRoute = ({ children }) => {
  const { user, loading } = useAuth();
  const base = useBasePath();

  if (loading) {
    return <LoadingScreen />;
  }

  if (!user || !["manager", "admin"].includes(user.role)) {
    return <Navigate to={`${base || ""}/unauthorized`} replace />;
  }

  return children;
};

/**
 * PublicRoute - Allows unauthenticated users, redirects authenticated to dashboard
 */
export const PublicRoute = ({ children }) => {
  const { user, loading } = useAuth();
  const base = useBasePath();

  if (loading) {
    return <LoadingScreen />;
  }

  if (user) {
    // Redirect based on role
    if (user.role === "admin")
      return <Navigate to={`${base || ""}/admin`} replace />;
    if (user.role === "manager")
      return <Navigate to={`${base || ""}/manager`} replace />;
    if (user.role === "cashier")
      return <Navigate to={`${base || ""}/cashier`} replace />;
    if (user.role === "staff")
      return <Navigate to={`${base || ""}/staff`} replace />;
  }

  return children;
};
