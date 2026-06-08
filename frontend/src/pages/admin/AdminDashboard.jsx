import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { orderAPI, restaurantsAPI, getImageUrl } from "../../services/api";
import {
  useBasePath,
  useRestaurantPath,
  useBranchSlug,
} from "../../context/SlugContext";
import { useAuth } from "../../context/AuthContext";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";
import StatusBadge from "../../components/ui/StatusBadge";

// ─── OrderedItemsPanel ────────────────────────────────────────────────────────
// Now receives branchSlug as a prop and forwards it to the API call.
function OrderedItemsPanel({ branchSlug }) {
  const [period, setPeriod] = useState("day");
  const [sort, setSort] = useState("desc");
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    orderAPI
      .getOrderedItems(period, sort, branchSlug) // ← branchSlug forwarded
      .then((res) => setItems(res.data))
      .finally(() => setLoading(false));
  }, [period, sort, branchSlug]); // ← re-fetch when branch changes

  return (
    <div className="card p-5">
      <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
        <h2 className="font-semibold">📦 Ordered Items</h2>
        <div className="flex gap-2">
          <select
            value={period}
            onChange={(e) => setPeriod(e.target.value)}
            className="text-xs border rounded px-2 py-1 dark:bg-gray-800 dark:border-gray-600"
          >
            <option value="day">Today</option>
            <option value="week">Last 7 Days</option>
            <option value="month">Last 30 Days</option>
          </select>
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value)}
            className="text-xs border rounded px-2 py-1 dark:bg-gray-800 dark:border-gray-600"
          >
            <option value="desc">High → Low</option>
            <option value="asc">Low → High</option>
          </select>
        </div>
      </div>
      {loading ? (
        <div className="space-y-2 animate-pulse">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-8 bg-gray-100 dark:bg-gray-700 rounded" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <p className="text-sm text-gray-400 text-center py-6">
          No orders for this period
        </p>
      ) : (
        <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
          {items.map((item, i) => (
            <div key={item.name} className="flex items-center gap-3">
              <span className="w-6 h-6 rounded-full bg-primary-100 dark:bg-primary-900/30 text-primary-600 text-xs font-bold flex items-center justify-center shrink-0">
                {i + 1}
              </span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{item.name}</p>
                <p className="text-xs text-gray-400">
                  {item.total_qty} ordered
                </p>
              </div>
              <span className="text-sm font-semibold text-primary-600 shrink-0">
                ${Number(item.revenue).toFixed(2)}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── StatCard ─────────────────────────────────────────────────────────────────
const StatCard = ({ icon, label, value, sub, color }) => (
  <div className="card p-5">
    <div className="flex items-center justify-between mb-3">
      <span className="text-2xl">{icon}</span>
      <span className={`badge ${color}`}>{sub}</span>
    </div>
    <p className="text-2xl font-bold">{value}</p>
    <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">{label}</p>
  </div>
);

// ─── AdminDashboard ───────────────────────────────────────────────────────────
export default function AdminDashboard() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [logo, setLogo] = useState(null);
  const [restaurantName, setRestaurantName] = useState(null);
  const [uploading, setUploading] = useState(false);

  const base = useBasePath();
  const restaurantPath = useRestaurantPath();
  const branchSlug = useBranchSlug(); // ← comes from SlugContext (URL-aware)
  const { isAdmin, isManager } = useAuth();
  const dashBase = isManager ? `${base}/manager` : `${base}/admin`;

  // ── Fetch analytics scoped to the current branch ──────────────────────────
  useEffect(() => {
    setLoading(true);
    setError(null);
    orderAPI
      .getAnalytics(branchSlug) // ← pass branchSlug
      .then((res) => setData(res.data))
      .catch((err) =>
        setError(err.response?.data?.message || "Failed to load analytics"),
      )
      .finally(() => setLoading(false));
  }, [branchSlug]); // ← re-fetch whenever branch changes

  // ── Fetch restaurant branding (admin only) ────────────────────────────────
  useEffect(() => {
    if (!isAdmin) return;
    let cancelled = false;

    const fetchBrand = async () => {
      try {
        // Pass branchSlug so branding can be branch-specific if needed.
        // If your API doesn't support branch-level branding yet, this still
        // works — it just returns the restaurant-level branding as before.
        const res = await restaurantsAPI.getMy(branchSlug);
        if (res.data && !cancelled) {
          setLogo(res.data.logo || null);
          setRestaurantName(res.data.restaurant_name || null);
        }
      } catch {
        // ignore
      }
    };

    fetchBrand();
    return () => {
      cancelled = true;
    };
  }, [isAdmin, branchSlug]); // ← re-fetch when branch changes

  // ── Upload logo ───────────────────────────────────────────────────────────
  const handleUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const fd = new FormData();
    fd.append("logo", file);
    setUploading(true);
    try {
      const res = await restaurantsAPI.uploadLogo(fd);
      setLogo(res.data.logo);
    } catch (err) {
      console.error(err);
      alert(err.response?.data?.message || "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  // ── Loading skeleton ──────────────────────────────────────────────────────
  if (loading)
    return (
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 animate-pulse">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="card h-28" />
        ))}
      </div>
    );

  // ── Error state ───────────────────────────────────────────────────────────
  if (error)
    return (
      <div className="card p-8 text-center text-red-500">
        <p className="text-lg font-semibold mb-1">Failed to load dashboard</p>
        <p className="text-sm text-gray-500">{error}</p>
      </div>
    );

  // ── Dashboard UI ──────────────────────────────────────────────────────────
  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-center gap-4">
          {logo ? (
            <img
              src={getImageUrl(logo)}
              alt={restaurantName || "Restaurant"}
              className="w-16 h-16 rounded object-cover"
            />
          ) : (
            <div className="w-16 h-16 rounded bg-primary-100 text-primary-700 flex items-center justify-center text-2xl">
              🍽️
            </div>
          )}
          <div>
            <h1 className="text-2xl font-bold">
              {restaurantName || "Dashboard 📊"}
              {/* Show which branch we're viewing */}
              {branchSlug && (
                <span className="ml-2 text-base font-normal text-gray-400 capitalize">
                  — {branchSlug}
                </span>
              )}
            </h1>
            {isAdmin && (
              <label className="text-xs text-gray-500 dark:text-gray-400">
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleUpload}
                  className="hidden"
                />
                <span className="text-primary-600 hover:underline cursor-pointer">
                  {uploading ? "Uploading..." : "Change logo"}
                </span>
              </label>
            )}
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <Link to={`${dashBase}/menu`} className="btn-secondary text-sm">
            Manage Menu
          </Link>
          <Link to={`${dashBase}/orders`} className="btn-primary text-sm">
            All Orders and Feedback
          </Link>
          {isAdmin && !branchSlug && (
            <Link to={`${base}/admin/users`} className="btn-secondary text-sm">
              Manage Staff
            </Link>
          )}
        </div>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          icon="💰"
          label="Total Revenue"
          value={`$${Number(data.total_revenue).toFixed(2)}`}
          sub="All time"
          color="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
        />
        <StatCard
          icon="📋"
          label="Total Orders"
          value={data.total_orders}
          sub="All time"
          color="bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400"
        />
        <StatCard
          icon="🌅"
          label="Today's Orders"
          value={data.today_orders}
          sub="Today"
          color="bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400"
        />
        <StatCard
          icon="💵"
          label="Today's Revenue"
          value={`$${Number(data.today_revenue).toFixed(2)}`}
          sub="Today"
          color="bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400"
        />
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Sales Chart */}
        <div className="card p-5 lg:col-span-2">
          <h2 className="font-semibold mb-4">Sales (Last 12 Months)</h2>
          {data.daily_sales?.length ? (
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={data.daily_sales}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 11 }}
                  tickFormatter={(v) => {
                    const [y, m] = v.split("-");
                    return new Date(y, m - 1).toLocaleDateString("en", {
                      month: "short",
                      year: "2-digit",
                    });
                  }}
                />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip
                  formatter={(v) => [`$${Number(v).toFixed(2)}`, "Revenue"]}
                  labelFormatter={(v) => {
                    const [y, m] = v.split("-");
                    return new Date(y, m - 1).toLocaleDateString("en", {
                      month: "long",
                      year: "numeric",
                    });
                  }}
                />
                <Bar dataKey="revenue" fill="#f97316" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-48 flex items-center justify-center text-gray-400">
              No data yet
            </div>
          )}
        </div>

        {/* Status Breakdown */}
        <div className="card p-5">
          <h2 className="font-semibold mb-4">Order Status</h2>
          <div className="space-y-3">
            {data.status_breakdown?.map((s) => (
              <div key={s.status} className="flex items-center justify-between">
                <StatusBadge status={s.status} />
                <span className="font-bold">{s.count}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Ordered Items — branchSlug passed as prop */}
        <OrderedItemsPanel branchSlug={branchSlug} />

        {/* Recent Orders */}
        <div className="card p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold">Recent Orders</h2>
            <Link
              to={`${dashBase}/orders`}
              className="text-xs text-primary-600 hover:underline"
            >
              View all
            </Link>
          </div>
          <div className="space-y-3">
            {data.recent_orders?.slice(0, 5).map((order) => (
              <div
                key={order.id}
                className="flex items-center justify-between text-sm"
              >
                <div>
                  <span className="font-medium">#{order.id}</span>
                  <span className="text-gray-400 ml-2">
                    {order.customer_name || "Guest"}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <StatusBadge status={order.status} />
                  <span className="font-semibold">
                    ${Number(order.total).toFixed(2)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
