import { createContext, useContext, useEffect, useState } from "react";
import { authAPI } from "../services/api";

const normalizeUser = (user) => {
  if (!user) return null;
  const requestedRole = user.requested_role || user.requestedRole || null;
  // Get restaurant_slug from API response (from restaurants table)
  const restaurant_slug = user.restaurant_slug || null;
  return {
    ...user,
    role: user.role || requestedRole || "customer",
    requestedRole,
    restaurant_slug,
    restaurant_id: user.restaurant_id || null,
    branch_id: user.branch_id || null,
    branch_slug: user.branch_slug || null,
    is_main_branch: user.is_main_branch ?? true,
  };
};

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(() => {
    try {
      return normalizeUser(JSON.parse(localStorage.getItem("user")));
    } catch {
      return null;
    }
  });
  const [loading, setLoading] = useState(true);
  const [approvalStatus, setApprovalStatus] = useState(
    user?.approval_status || null,
  );

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (token) {
      authAPI
        .getMe()
        .then((res) => {
          const normalized = normalizeUser(res.data);
          setUser(normalized);
          setApprovalStatus(normalized.approval_status);
          localStorage.setItem("user", JSON.stringify(normalized));
          if (normalized.restaurant_slug) {
            localStorage.setItem("restaurant_slug", normalized.restaurant_slug);
          }
          if (normalized.branch_id) {
            localStorage.setItem("branch_id", String(normalized.branch_id));
          }
          if (normalized.branch_slug) {
            localStorage.setItem("branch_slug", normalized.branch_slug);
          }
        })
        .catch(() => {
          localStorage.removeItem("token");
          localStorage.removeItem("user");
          localStorage.removeItem("restaurant_slug");
          localStorage.removeItem("branch_id");
          localStorage.removeItem("branch_slug");
          setUser(null);
          setApprovalStatus(null);
        })
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, []);

  const login = async (email, password) => {
    const res = await authAPI.login({ email, password });
    const normalized = normalizeUser(res.data.user);
    localStorage.setItem("token", res.data.token);
    localStorage.setItem("user", JSON.stringify(normalized));
    if (normalized.restaurant_slug)
      localStorage.setItem("restaurant_slug", normalized.restaurant_slug);
    if (normalized.branch_id)
      localStorage.setItem("branch_id", String(normalized.branch_id));
    if (normalized.branch_slug)
      localStorage.setItem("branch_slug", normalized.branch_slug);
    setUser(normalized);
    setApprovalStatus(normalized.approval_status);
    return normalized;
  };

  const loginStaff = async (email, password, slug) => {
    const res = await authAPI.loginStaff({
      email,
      password,
      slug: slug || undefined,
    });
    if (
      res.data.approvalStatus === "pending" ||
      res.data.approvalStatus === "rejected"
    ) {
      setApprovalStatus(res.data.approvalStatus);
      return res.data;
    }
    const normalized = normalizeUser(res.data.user);
    localStorage.setItem("token", res.data.token);
    localStorage.setItem("user", JSON.stringify(normalized));
    if (normalized.restaurant_slug)
      localStorage.setItem("restaurant_slug", normalized.restaurant_slug);
    if (normalized.branch_id)
      localStorage.setItem("branch_id", String(normalized.branch_id));
    if (normalized.branch_slug)
      localStorage.setItem("branch_slug", normalized.branch_slug);
    setUser(normalized);
    setApprovalStatus(normalized.approval_status);
    return normalized;
  };

  const register = async (data) => {
    const res = await authAPI.register(data);
    if (res.data?.token && res.data?.user) {
      const normalized = normalizeUser(res.data.user);
      localStorage.setItem("token", res.data.token);
      localStorage.setItem("user", JSON.stringify(normalized));
      if (normalized.restaurant_slug) {
        localStorage.setItem("restaurant_slug", normalized.restaurant_slug);
      }
      setUser(normalized);
      setApprovalStatus(normalized.approval_status);
      return normalized;
    }
    return res.data;
  };

  const registerStaff = async (data) => {
    const res = await authAPI.registerStaff(data);
    return res.data;
  };

  const logout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    localStorage.removeItem("restaurant_slug");
    localStorage.removeItem("branch_id");
    localStorage.removeItem("branch_slug");
    localStorage.removeItem("sub_token");
    localStorage.removeItem("sub_user");
    setUser(null);
    setApprovalStatus(null);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        login,
        loginStaff,
        register,
        registerStaff,
        logout,
        approvalStatus,
        isAdmin: user?.role === "admin",
        isManager: user?.role === "manager",
        isStaff: user?.role === "staff",
        isCashier: user?.role === "cashier",
        isApproved: user?.approval_status === "approved",
        isPending: user?.approval_status === "pending",
        isRejected: user?.approval_status === "rejected",
        userSlug: user?.slug || null,
        restaurantSlug: user?.restaurant_slug || null,
        branchId: user?.branch_id || null,
        branchSlug: user?.branch_slug || null,
        isMainBranch: user?.is_main_branch ?? true,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
