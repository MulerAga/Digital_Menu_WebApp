import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { orderAPI } from "../services/api";
import { useBasePath, useSlug, useBranchSlug } from "../context/SlugContext";
import StatusBadge from "../components/ui/StatusBadge";

export default function GuestOrdersPage() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const base = useBasePath();
  const slug = useSlug();
  const branchSlug = useBranchSlug();

  useEffect(() => {
    const all = JSON.parse(localStorage.getItem("guest_orders") || "[]");

    const saved = all.filter((o) => {
      if (o.slug && o.slug !== slug) return false;
      if ("branchSlug" in o && o.branchSlug !== branchSlug) return false;
      return true;
    });

    if (!saved.length) {
      setLoading(false);
      return;
    }

    Promise.all(
      saved.map((o) =>
        orderAPI
          .getByGuestToken(o.token, slug)
          .then((r) => ({ ...r.data, _token: o.token }))
          .catch(() => null),
      ),
    )
      .then((results) => setOrders(results.filter(Boolean)))
      .finally(() => setLoading(false));
  }, [slug, branchSlug]);

  if (loading)
    return (
      <div className="max-w-lg mx-auto space-y-3 animate-pulse mt-6">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="card h-20" />
        ))}
      </div>
    );

  if (!orders.length)
    return (
      <div className="text-center py-24 animate-fade-in">
        <div className="text-7xl mb-4">📋</div>
        <h2 className="text-2xl font-bold mb-2">No orders yet</h2>
        <p className="text-gray-500 dark:text-gray-400 mb-6">
          Your order history will appear here
        </p>
        <Link to={base || "/"} className="btn-primary px-8 py-3">
          Browse Menu
        </Link>
      </div>
    );

  return (
    <div className="max-w-lg mx-auto animate-fade-in space-y-4">
      <h1 className="text-2xl font-bold">My Orders 📋</h1>
      <p className="text-[#F97316] dark:text-red-600 text-sm">
        You can put your feedback after our service is served!
      </p>
      {orders.map((order) => (
        <Link
          key={order.id}
          to={`${base}/track/${order._token}`}
          className="card p-4 flex items-center justify-between hover:shadow-md transition-all group"
        >
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="font-semibold">Order #{order.id}</span>
              <StatusBadge status={order.status} />
            </div>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {order.items?.reduce((sum, i) => sum + (i.quantity || 1), 0) || 0}{" "}
              items •{" "}
              {order.table_number ? `Table ${order.table_number}` : "Takeaway"}
            </p>
          </div>
          <div className="text-right">
            <p className="font-bold text-primary-600">
              ${Number(order.total).toFixed(2)}
            </p>
            <span className="text-xs text-gray-400 group-hover:text-primary-500 transition-colors">
              Track →
            </span>
          </div>
        </Link>
      ))}
    </div>
  );
}
