import { useState, useEffect } from "react";
import {
  Link,
  useNavigate,
  useSearchParams,
  useParams,
} from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useSocket } from "../context/SocketContext";
import { restaurantsAPI, getImageUrl } from "../services/api";
import toast from "react-hot-toast";

export default function LoginPage() {
  // branchSlug is set when accessed via /:slug/branches/:branchSlug/login
  const { slug, branchSlug } = useParams();
  const [form, setForm] = useState({ email: "", password: "" });
  const [logo, setLogo] = useState(null);
  const [restaurantName, setRestaurantName] = useState(null);

  useEffect(() => {
    let cancelled = false;
    const fetchBrand = async () => {
      try {
        if (slug) {
          const res = await restaurantsAPI.getPublic(slug);
          if (res.data && !cancelled) {
            setLogo(res.data.logo || null);
            setRestaurantName(res.data.restaurant_name || null);
          }
        }
      } catch {
        // ignore
      }
    };
    fetchBrand();
    return () => (cancelled = true);
  }, [slug]);

  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const { loginStaff } = useAuth();
  const { connect } = useSocket();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  // If the user came from a restaurant slug page, redirect back there after login
  const from = searchParams.get("from") || null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      // Pass the slug so the backend can validate restaurant membership
      const res = await loginStaff(
        form.email,
        form.password,
        slug || undefined,
      );

      // Handle staff approval states
      if (res.approvalStatus === "pending") {
        toast.error("Your account is pending approval");
        navigate(slug ? `/${slug}/pending-approval` : "/pending-approval");
        return;
      }
      if (res.approvalStatus === "rejected") {
        toast.error("Your account registration was rejected");
        navigate(slug ? `/${slug}/approval-rejected` : "/approval-rejected");
        return;
      }

      const loggedInUser = res;
      const token = localStorage.getItem("token");
      if (token) connect(token);
      toast.success("Welcome back!");
      const resolvedRole =
        loggedInUser.role || loggedInUser.requestedRole || "customer";
      // Use restaurant_slug from API response (from restaurants table)
      const targetSlug = slug || loggedInUser.restaurant_slug;

      // Determine base path: respect branchSlug from URL, then user's own branch
      const targetBranchSlug = branchSlug || loggedInUser.branch_slug || null;
      const targetBase = targetSlug
        ? targetBranchSlug
          ? `/${targetSlug}/branches/${targetBranchSlug}`
          : `/${targetSlug}`
        : "";

      if (resolvedRole === "admin") {
        navigate(`${targetBase}/admin`);
      } else if (resolvedRole === "manager") {
        navigate(`${targetBase}/manager`);
      } else if (resolvedRole === "staff") {
        navigate(`${targetBase}/staff`);
      } else if (resolvedRole === "cashier") {
        navigate(`${targetBase}/cashier`);
      } else if (from) {
        navigate(from);
      } else if (targetBase) {
        navigate(`${targetBase}/`);
      } else {
        navigate("/");
      }
    } catch (err) {
      const status = err.response?.status;
      const message = err.response?.data?.message;
      if (message === "You do not belong to this restaurant.") {
        toast.error("You do not belong to this restaurant.");
      } else if (status === 401 || status === 400) {
        toast.error("Invalid credentials");
      } else {
        toast.error(message || "Login failed");
      }
    } finally {
      setLoading(false);
    }
  };

  // Back link goes to the restaurant page if we came from one, otherwise home or the current slug page
  const backTo =
    from ||
    (slug
      ? branchSlug
        ? `/${slug}/branches/${branchSlug}`
        : `/${slug}`
      : "/");

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-orange-50 via-white to-amber-50 dark:from-gray-950 dark:via-gray-900 dark:to-gray-950 px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="mb-8">
            <Link
              to={backTo}
              className="text-sm text-black hover:text-primary-100 transition-colors bg-red-500/50 p-2 rounded-lg"
            >
              ← Go Back to Home
            </Link>
          </div>

          <div className="flex items-center justify-center gap-3">
            {logo ? (
              <img
                src={getImageUrl(logo)}
                alt={restaurantName || "Restaurant"}
                className="w-20 h-20 mb-3 rounded object-cover"
              />
            ) : (
              <div className="text-6xl mb-3 animate-float inline-block">🍽️</div>
            )}
            <h1 className="text-3xl font-bold">
              {restaurantName || "RestaurantOS"}
            </h1>
          </div>
          <p className="text-gray-500 dark:text-gray-400 mt-1">
            Sign in to your account
          </p>
        </div>
        <div className="card p-8 shadow-xl">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1.5">Email</label>
              <input
                type="email"
                required
                className="input"
                placeholder="you@example.com"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1.5">
                Password
              </label>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  required
                  className="input pr-10"
                  placeholder="••••••••"
                  value={form.password}
                  onChange={(e) =>
                    setForm({ ...form, password: e.target.value })
                  }
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
                  tabIndex={-1}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? (
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      className="w-5 h-5"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth={2}
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M13.875 18.825A10.05 10.05 0 0112 19c-5 0-9-4-9-7s4-7 9-7a9.97 9.97 0 016.375 2.325M15 12a3 3 0 11-4.5-2.598M3 3l18 18"
                      />
                    </svg>
                  ) : (
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      className="w-5 h-5"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth={2}
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                      />
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M2.458 12C3.732 7.943 7.523 5 12 5c4.477 0 8.268 2.943 9.542 7-1.274 4.057-5.065 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
                      />
                    </svg>
                  )}
                </button>
              </div>
            </div>
            <button
              type="submit"
              disabled={loading}
              className="btn-primary w-full py-3 mt-2"
            >
              {loading ? "Signing in..." : "Sign In"}
            </button>
          </form>
          <div className="mt-4 text-center text-sm text-gray-500 dark:text-gray-400">
            Don't have an account?{" "}
            <Link
              to={slug ? `/${slug}/register` : "/register-staff"}
              className="text-primary-600 hover:underline font-medium"
            >
              Register
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
