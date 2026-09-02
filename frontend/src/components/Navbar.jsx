import { Link, useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useCart } from "../context/CartContext";
import { useTheme } from "../context/ThemeContext";
import { useSocket } from "../context/SocketContext";
import {
  useBasePath,
  useSlug,
  useBranchSlug,
  useRestaurantPath,
} from "../context/SlugContext";
import { useState, useEffect, useRef } from "react";
import { restaurantsAPI, getImageUrl } from "../services/api";

export default function Navbar() {
  const { user, logout, isAdmin, isManager, isStaff, isCashier } = useAuth();
  const { itemCount } = useCart();
  const { dark, toggle } = useTheme();
  const { newOrderCount, clearNewOrderCount } = useSocket();
  const navigate = useNavigate();
  const location = useLocation();

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [logo, setLogo] = useState(null);
  const [restaurantName, setRestaurantName] = useState(null);
  const fileInputRef = useRef(null);

  const base = useBasePath();
  const slug = useSlug();
  const branchSlug = useBranchSlug();
  const restaurantPath = useRestaurantPath();

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
        } else if (user && isAdmin) {
          const res = await restaurantsAPI.getMy();
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
    return () => {
      cancelled = true;
    };
  }, [slug, user, isAdmin]);

  const handleLogout = () => {
    logout();
    navigate(base || "/");
  };

  const openLogoFilePicker = () => {
    if (isAdmin && fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  const handleLogoFileChange = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const formData = new FormData();
    formData.append("logo", file);

    try {
      const res = await restaurantsAPI.uploadLogo(formData);
      setLogo(res.data.logo);
    } catch (err) {
      console.error("Logo upload failed:", err);
      alert(err.response?.data?.message || "Logo upload failed");
    } finally {
      event.target.value = null;
    }
  };

  const navLink = (to, label, badge) => (
    <Link
      to={to}
      className={`relative px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
        location.pathname === to
          ? "bg-primary-100 dark:bg-primary-900/30 text-primary-600 dark:text-primary-400"
          : "text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800"
      }`}
      onClick={() => {
        setMobileMenuOpen(false);
        setUserMenuOpen(false);
        if (badge) clearNewOrderCount();
      }}
    >
      {label}
      {badge > 0 && (
        <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs w-5 h-5 rounded-full flex items-center justify-center font-bold animate-bounce-in">
          {badge > 99 ? "99+" : badge}
        </span>
      )}
    </Link>
  );

  const isCustomerOrGuest =
    !user || (!isAdmin && !isStaff && !isCashier && !isManager);

  return (
    <nav className="sticky top-0 z-50 bg-white/80 dark:bg-gray-900/80 backdrop-blur-md border-b border-gray-200 dark:border-gray-800">
      <div className="container mx-auto px-4 max-w-7xl">
        <div className="flex items-center justify-between h-16">
          {/* Left brand */}
          <div className="flex items-center gap-2 font-bold text-xl text-primary-600">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleLogoFileChange}
            />

            {logo ? (
              <img
                src={getImageUrl(logo)}
                alt={restaurantName || "Restaurant"}
                className={`w-8 h-8 rounded object-cover ${
                  isAdmin ? "cursor-pointer" : ""
                }`}
                title={isAdmin ? "Click to upload a new logo" : undefined}
                onClick={(event) => {
                  if (isAdmin) {
                    event.preventDefault();
                    event.stopPropagation();
                    openLogoFilePicker();
                  }
                }}
              />
            ) : (
              <span
                className={`text-2xl ${isAdmin ? "cursor-pointer" : ""}`}
                title={
                  isAdmin ? "Click to upload your restaurant logo" : undefined
                }
                onClick={(event) => {
                  if (isAdmin) {
                    event.preventDefault();
                    event.stopPropagation();
                    openLogoFilePicker();
                  }
                }}
              >
                🍽️
              </span>
            )}

            <Link to={base || "/"} className="hidden sm:block">
              {restaurantName
                ? restaurantName
                : slug
                  ? slug
                      .replace(/-/g, " ")
                      .replace(/\b\w/g, (c) => c.toUpperCase())
                  : "RestaurantOS"}
              {branchSlug && (
                <span className="ml-1.5 text-sm font-normal text-gray-400 dark:text-gray-500">
                  /{" "}
                  {branchSlug
                    .replace(/-/g, " ")
                    .replace(/\b\w/g, (c) => c.toUpperCase())}
                </span>
              )}
            </Link>

            {/* Mobile only: Menu stays next to logo */}
            <Link
              to={base || "/"}
              className={`sm:hidden absolute left-1/3 -translate-x-1/2 text-base font-semibold ${
                location.pathname === (base || "/")
                  ? "bg-primary-100 dark:bg-primary-900/30 text-primary-600 dark:text-primary-400 px-3 py-1 rounded-lg"
                  : "text-gray-600 dark:text-gray-300"
              }`}
            >
              Menu
            </Link>
          </div>

          {/* Center menu for 640px - 767px */}
          <div className="hidden sm:flex md:hidden absolute left-1/2 -translate-x-1/2 ">
            {navLink(`${base || "/"}`, "Menu")}
          </div>

          {/* Desktop Nav */}
          <div className="hidden md:flex items-center gap-1 ">
            {navLink(`${base || "/"}`, "Menu")}
            {!user && navLink(`${base}/my-orders`, "My Orders")}
            {user &&
              !isAdmin &&
              !isManager &&
              !isStaff &&
              !isCashier &&
              navLink(`${base}/orders`, "My Orders")}
            {isAdmin && navLink(`${base}/admin`, "Dashboard")}
            {isManager && navLink(`${base}/manager`, "Dashboard")}
            {isAdmin &&
              !branchSlug &&
              navLink(`${restaurantPath}/admin/branches`, "Branches")}
            {isCashier && navLink(`${base}/cashier`, "Cashier", newOrderCount)}
            {isStaff &&
              !isAdmin &&
              !isManager &&
              navLink(`${base}/staff`, "Dashboard", newOrderCount)}
          </div>

          {/* Right side */}
          <div className="flex items-center gap-2">
            <button
              onClick={toggle}
              className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
              aria-label="Toggle theme"
            >
              {dark ? "☀️" : "🌙"}
            </button>

            {isCustomerOrGuest && (
              <Link
                to={`${base}/cart`}
                className="relative p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
              >
                🛒
                {itemCount > 0 && (
                  <span className="absolute -top-1 -right-1 bg-primary-500 text-white text-xs w-5 h-5 rounded-full flex items-center justify-center font-bold animate-bounce-in">
                    {itemCount}
                  </span>
                )}
              </Link>
            )}

            {user ? (
              <div className="relative hidden md:block">
                <button
                  onClick={() => {
                    setUserMenuOpen(!userMenuOpen);
                    setMobileMenuOpen(false);
                  }}
                  className="flex items-center gap-2 px-3 py-2 rounded-xl bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors text-sm font-medium"
                >
                  <span className="w-7 h-7 rounded-full bg-primary-500 text-white flex items-center justify-center text-xs font-bold">
                    {user.name?.[0]?.toUpperCase()}
                  </span>
                  <span className="hidden sm:block max-w-24 truncate">
                    {user.name}
                  </span>
                </button>

                {userMenuOpen && (
                  <div className="absolute right-0 mt-2 w-48 card shadow-lg py-1 animate-slide-up z-50">
                    <div className="px-4 py-2 border-b border-gray-100 dark:border-gray-800">
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        Signed in as
                      </p>
                      <p className="text-sm font-medium truncate">
                        {user.email}
                      </p>
                      <span className="badge bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300 mt-1">
                        {user.role}
                      </span>
                    </div>

                    <button
                      onClick={handleLogout}
                      className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                    >
                      Sign out
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <Link
                to={`${base || ""}/login`}
                className="hidden md:inline-flex btn-primary text-sm"
              >
                Sign in
              </Link>
            )}

            {/* Mobile hamburger */}
            <button
              onClick={() => {
                setMobileMenuOpen(!mobileMenuOpen);
                setUserMenuOpen(false);
              }}
              className="md:hidden p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800"
              aria-label="Open menu"
            >
              ☰
            </button>
          </div>
        </div>

        {/* Mobile menu */}
        {/* Mobile menu */}
        {mobileMenuOpen && (
          <div className="md:hidden pb-3 flex flex-col gap-1 animate-slide-up">
            {!user && navLink(`${base}/my-orders`, "My Orders")}
            {!user && navLink(`${base}/login`, "Sign in")}

            {user &&
              !isAdmin &&
              !isStaff &&
              !isCashier &&
              !isManager &&
              navLink(`${base}/orders`, "My Orders")}

            {isAdmin && navLink(`${base}/admin`, "Dashboard")}
            {isManager && navLink(`${base}/manager`, "Dashboard")}
            {isAdmin &&
              !branchSlug &&
              navLink(`${restaurantPath}/admin/branches`, "Branches")}
            {isCashier && navLink(`${base}/cashier`, "Cashier", newOrderCount)}
            {isStaff &&
              !isAdmin &&
              !isManager &&
              navLink(`${base}/staff`, "Dashboard", newOrderCount)}
            {isAdmin && navLink(`${base}/admin/menu`, "Manage Menu")}
            {isManager && navLink(`${base}/manager/menu`, "Manage Menu")}
            {isAdmin && navLink(`${base}/admin/orders`, "All Orders")}
            {isManager && navLink(`${base}/manager/orders`, "All Orders")}
            {isAdmin &&
              !branchSlug &&
              navLink(`${restaurantPath}/admin/users`, "Manage Staff")}

            {user && (
              <button
                onClick={handleLogout}
                className="w-full text-left px-3 py-2 rounded-lg text-sm font-medium text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
              >
                Sign out
              </button>
            )}
          </div>
        )}
      </div>
    </nav>
  );
}
