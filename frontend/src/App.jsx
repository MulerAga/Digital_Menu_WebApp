import { Routes, Route, Navigate, useParams } from "react-router-dom";
import { useAuth } from "./context/AuthContext";
import { SlugProvider, useBasePath } from "./context/SlugContext";
import Layout from "./components/Layout";
import LoadingScreen from "./components/ui/LoadingScreen";

// Pages
import LoginPage from "./pages/LoginPage";
import MenuPage from "./pages/MenuPage";
import CartPage from "./pages/CartPage";
import OrdersPage from "./pages/OrdersPage";
import OrderDetailPage from "./pages/OrderDetailPage";
import GuestOrderPage from "./pages/GuestOrderPage";
import GuestOrdersPage from "./pages/GuestOrdersPage";
import AdminDashboard from "./pages/admin/AdminDashboard";
import AdminMenu from "./pages/admin/AdminMenu";
import AdminOrders from "./pages/admin/AdminOrders";
import AdminUsers from "./pages/admin/AdminUsers";
import AdminBranches from "./pages/admin/AdminBranches";
import StaffDashboard from "./pages/staff/StaffDashboard";
import CashierDashboard from "./pages/cashier/CashierDashboard";
import StaffRegistrationPage from "./pages/StaffRegistrationPage";
import PendingApprovalPage from "./pages/PendingApprovalPage";
import ApprovalRejectedPage from "./pages/ApprovalRejectedPage";
import UnauthorizedPage from "./pages/UnauthorizedPage";

const PrivateRoute = ({ children, roles }) => {
  const { user, loading, restaurantSlug, branchSlug: userBranchSlug } = useAuth();
  const base = useBasePath();
  const { slug, branchSlug } = useParams();

  if (loading) return <LoadingScreen />;
  if (!user) return <Navigate to={`${base}/login`} replace />;

  if (slug && restaurantSlug && slug.toLowerCase() !== restaurantSlug.toLowerCase()) {
    return <Navigate to={`/${slug}/unauthorized`} replace />;
  }

  if (branchSlug && user.role !== "admin") {
    if (!userBranchSlug || userBranchSlug.toLowerCase() !== branchSlug.toLowerCase()) {
      return <Navigate to={`${base}/unauthorized`} replace />;
    }
  }

  if (roles && !roles.includes(user.role)) {
    return <Navigate to={`${base}/unauthorized`} replace />;
  }

  return children;
};

const SlugLayout = () => {
  const { slug } = useParams();
  return (
    <SlugProvider slug={slug} branchSlug={null}>
      <Layout />
    </SlugProvider>
  );
};

const BranchLayout = () => {
  const { slug, branchSlug } = useParams();
  return (
    <SlugProvider slug={slug} branchSlug={branchSlug}>
      <Layout />
    </SlugProvider>
  );
};

const RootRedirect = () => {
  const { user, loading, restaurantSlug, branchSlug, isManager } = useAuth();
  if (loading) return <LoadingScreen />;
  if (user && restaurantSlug) {
    const base = branchSlug
      ? `/${restaurantSlug}/branches/${branchSlug}`
      : `/${restaurantSlug}`;
    if (user.role === "manager") return <Navigate to={`${base}/manager`} replace />;
    if (user.role === "admin") return <Navigate to={`${base}/admin`} replace />;
    if (user.role === "staff") return <Navigate to={`${base}/staff`} replace />;
    if (user.role === "cashier") return <Navigate to={`${base}/cashier`} replace />;
    return <Navigate to={base} replace />;
  }
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-orange-50 via-white to-amber-50 dark:from-gray-950 dark:via-gray-900 dark:to-gray-950 px-4 text-center">
      <div className="text-7xl mb-6">🍽️</div>
      <h1 className="text-3xl font-bold mb-2">RestaurantHub</h1>
      <p className="text-gray-500 dark:text-gray-400 mb-6 max-w-sm">
        Please navigate to your restaurant's URL to continue.
        <br />
        Example: <span className="font-mono text-primary-600">/canoe-restaurant</span>
      </p>
    </div>
  );
};

export default function App() {
  const { loading } = useAuth();
  if (loading) return <LoadingScreen />;

  return (
    <Routes>
      {/* Root */}
      <Route path="/" element={<RootRedirect />} />

      {/* Restaurant-level auth pages */}
      <Route path="/:slug/login" element={<LoginPage />} />
      <Route path="/:slug/register" element={<StaffRegistrationPage />} />
      <Route path="/:slug/register-staff" element={<StaffRegistrationPage />} />
      <Route path="/:slug/pending-approval" element={<PendingApprovalPage />} />
      <Route path="/:slug/approval-rejected" element={<ApprovalRejectedPage />} />
      <Route path="/:slug/unauthorized" element={<UnauthorizedPage />} />

      {/* Branch-level auth pages */}
      <Route path="/:slug/branches/:branchSlug/login" element={<LoginPage />} />
      <Route path="/:slug/branches/:branchSlug/unauthorized" element={<UnauthorizedPage />} />

      {/* ── Main branch: /:slug ── */}
      <Route path="/:slug" element={<SlugLayout />}>
        <Route index element={<MenuPage />} />
        <Route path="cart" element={<CartPage />} />
        <Route path="track/:token" element={<GuestOrderPage />} />
        <Route path="my-orders" element={<GuestOrdersPage />} />
        <Route path="orders" element={<PrivateRoute><OrdersPage /></PrivateRoute>} />
        <Route path="orders/:id" element={<PrivateRoute><OrderDetailPage /></PrivateRoute>} />

        {/* Admin-only routes */}
        <Route path="admin" element={<PrivateRoute roles={["admin"]}><AdminDashboard /></PrivateRoute>} />
        <Route path="admin/menu" element={<PrivateRoute roles={["admin"]}><AdminMenu /></PrivateRoute>} />
        <Route path="admin/orders" element={<PrivateRoute roles={["admin"]}><AdminOrders /></PrivateRoute>} />
        <Route path="admin/users" element={<PrivateRoute roles={["admin"]}><AdminUsers /></PrivateRoute>} />
        <Route path="admin/branches" element={<PrivateRoute roles={["admin"]}><AdminBranches /></PrivateRoute>} />

        {/* Manager routes */}
        <Route path="manager" element={<PrivateRoute roles={["manager"]}><AdminDashboard /></PrivateRoute>} />
        <Route path="manager/menu" element={<PrivateRoute roles={["manager"]}><AdminMenu /></PrivateRoute>} />
        <Route path="manager/orders" element={<PrivateRoute roles={["manager"]}><AdminOrders /></PrivateRoute>} />
        <Route path="manager/users" element={<PrivateRoute roles={["manager"]}><AdminUsers /></PrivateRoute>} />

        {/* Staff & Cashier */}
        <Route path="staff" element={<PrivateRoute roles={["admin", "staff"]}><StaffDashboard /></PrivateRoute>} />
        <Route path="cashier" element={<PrivateRoute roles={["cashier"]}><CashierDashboard /></PrivateRoute>} />
      </Route>

      {/* ── Sub-branch: /:slug/branches/:branchSlug ── */}
      <Route path="/:slug/branches/:branchSlug" element={<BranchLayout />}>
        <Route index element={<MenuPage />} />
        <Route path="cart" element={<CartPage />} />
        <Route path="track/:token" element={<GuestOrderPage />} />
        <Route path="my-orders" element={<GuestOrdersPage />} />
        <Route path="orders" element={<PrivateRoute><OrdersPage /></PrivateRoute>} />
        <Route path="orders/:id" element={<PrivateRoute><OrderDetailPage /></PrivateRoute>} />

        {/* Admin-only routes */}
        <Route path="admin" element={<PrivateRoute roles={["admin"]}><AdminDashboard /></PrivateRoute>} />
        <Route path="admin/menu" element={<PrivateRoute roles={["admin"]}><AdminMenu /></PrivateRoute>} />
        <Route path="admin/orders" element={<PrivateRoute roles={["admin"]}><AdminOrders /></PrivateRoute>} />
        <Route path="admin/users" element={<PrivateRoute roles={["admin"]}><AdminUsers /></PrivateRoute>} />

        {/* Manager routes */}
        <Route path="manager" element={<PrivateRoute roles={["manager"]}><AdminDashboard /></PrivateRoute>} />
        <Route path="manager/menu" element={<PrivateRoute roles={["manager"]}><AdminMenu /></PrivateRoute>} />
        <Route path="manager/orders" element={<PrivateRoute roles={["manager"]}><AdminOrders /></PrivateRoute>} />
        <Route path="manager/users" element={<PrivateRoute roles={["manager"]}><AdminUsers /></PrivateRoute>} />

        {/* Staff & Cashier */}
        <Route path="staff" element={<PrivateRoute roles={["admin", "staff"]}><StaffDashboard /></PrivateRoute>} />
        <Route path="cashier" element={<PrivateRoute roles={["cashier"]}><CashierDashboard /></PrivateRoute>} />
      </Route>

      {/* Legacy redirects */}
      <Route path="/login" element={<Navigate to="/" replace />} />
      <Route path="/register-staff" element={<Navigate to="/" replace />} />
      <Route path="/pending-approval" element={<PendingApprovalPage />} />
      <Route path="/approval-rejected" element={<ApprovalRejectedPage />} />
      <Route path="/unauthorized" element={<UnauthorizedPage />} />
      <Route path="/orders" element={<Navigate to="/" replace />} />
      <Route path="/admin" element={<Navigate to="/" replace />} />
      <Route path="/staff" element={<Navigate to="/" replace />} />
      <Route path="/cashier" element={<Navigate to="/" replace />} />
      <Route path="/cart" element={<Navigate to="/" replace />} />
      <Route path="/my-orders" element={<Navigate to="/" replace />} />

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}