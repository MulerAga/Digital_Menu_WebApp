import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { orderAPI } from "../services/api";
import { useSocket } from "../context/SocketContext";
import { useBasePath } from "../context/SlugContext";
import StatusBadge from "../components/ui/StatusBadge";
import FeedbackModal from "../components/FeedbackModal";
import { useParams } from "react-router-dom";

export default function OrdersPage() {
  const { branchSlug } = useParams();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState("active");
  const [feedbackMap, setFeedbackMap] = useState({});
  const [feedbackModal, setFeedbackModal] = useState(null);
  const { socket } = useSocket();
  const base = useBasePath();

  const fetchOrders = () => {
    orderAPI
      .getAll({ branch_slug: branchSlug || undefined })
      .then((res) => {
        const filtered = res.data.filter((o) => o.status !== "cancelled");
        setOrders(filtered);
        // Load feedback for all served orders
        const servedIds = filtered
          .filter((o) => ["served", "completed"].includes(o.status))
          .map((o) => o.id);
        servedIds.forEach((id) => {
          orderAPI
            .getFeedback(id)
            .then((r) => setFeedbackMap((prev) => ({ ...prev, [id]: r.data })))
            .catch(() => {}); // 404 = no feedback yet, that's fine
        });
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchOrders();
  }, []);

  useEffect(() => {
    if (!socket) return;
    const handler = (updated) => {
      setOrders((prev) =>
        prev
          .map((o) => (o.id === updated.id ? { ...o, ...updated } : o))
          .filter((o) => o.status !== "cancelled"),
      );
      // If order just became served, try loading its feedback
      if (["served", "completed"].includes(updated.status)) {
        orderAPI
          .getFeedback(updated.id)
          .then((r) =>
            setFeedbackMap((prev) => ({ ...prev, [updated.id]: r.data })),
          )
          .catch(() => {});
      }
    };
    socket.on("order_status_changed", handler);
    return () => socket.off("order_status_changed", handler);
  }, [socket]);

  const activeOrders = orders.filter(
    (o) => !["served", "completed"].includes(o.status),
  );
  const pastOrders = orders.filter((o) =>
    ["served", "completed"].includes(o.status),
  );
  const shown = tab === "active" ? activeOrders : pastOrders;

  const handleFeedbackSaved = (orderId, fb) => {
    setFeedbackMap((prev) => ({ ...prev, [orderId]: fb }));
    setFeedbackModal(null);
  };

  const OrderCard = ({ order }) => {
    const isServed = ["served", "completed"].includes(order.status);
    const existingFeedback = feedbackMap[order.id];

    return (
      <div className="card p-4 hover:shadow-md transition-all">
        <Link
          to={`${base}/orders/${order.id}`}
          className="items-center justify-between group block"
        >
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="font-semibold">Order #{order.id}</span>
              <StatusBadge status={order.status} />
            </div>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {order.items?.length || 0} items •{" "}
              {order.table_number ? `Table ${order.table_number}` : "Takeaway"}
            </p>
            <p className="text-xs text-gray-400 mt-0.5">
              {new Date(order.created_at).toLocaleString()}
            </p>
          </div>
          <div className="text-right">
            <p className="font-bold text-primary-600">
              ${Number(order.total).toFixed(2)}
            </p>
            <span className="text-xs text-gray-400 group-hover:text-primary-500 transition-colors">
              View →
            </span>
          </div>
        </Link>

        {/* Feedback row — only on served/completed orders */}
        {isServed && (
          <div className="mt-3 pt-3 border-t border-gray-100 dark:border-gray-800 flex items-center justify-between gap-3">
            {existingFeedback ? (
              <>
                {/* Show existing stars */}
                <div className="flex items-center gap-1">
                  {[1, 2, 3, 4, 5].map((s) => (
                    <span
                      key={s}
                      className={`text-base ${s <= existingFeedback.rating ? "text-yellow-400" : "text-gray-200 dark:text-gray-700"}`}
                    >
                      ★
                    </span>
                  ))}
                  {existingFeedback.comment && (
                    <span className="text-xs text-gray-400 ml-1 truncate max-w-[160px] italic">
                      "{existingFeedback.comment}"
                    </span>
                  )}
                </div>
                <button
                  onClick={(e) => {
                    e.preventDefault();
                    setFeedbackModal({
                      orderId: order.id,
                      existing: existingFeedback,
                    });
                  }}
                  className="text-xs text-primary-600 hover:underline flex-shrink-0"
                >
                  Edit
                </button>
              </>
            ) : (
              <>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  How was this order?
                </p>
                <button
                  onClick={(e) => {
                    e.preventDefault();
                    setFeedbackModal({ orderId: order.id, existing: null });
                  }}
                  className="btn-primary text-xs px-3 py-1.5 flex-shrink-0"
                >
                  ⭐ Give Feedback
                </button>
              </>
            )}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="max-w-2xl mx-auto animate-fade-in space-y-4">
      <h1 className="text-2xl font-bold">My Orders 📋</h1>
      <p className="text-gray-500 dark:text-gray-400 text-sm -mt-2">
        Real-time updates from our kitchen
      </p>

      {/* Tabs */}
      <div className="flex bg-white dark:bg-gray-900 rounded-2xl p-1 shadow-sm border border-gray-100 dark:border-gray-800">
        <button
          onClick={() => setTab("active")}
          className={`flex-1 py-2.5 rounded-xl text-sm font-semibold transition-all ${tab === "active" ? "bg-primary-500 text-white shadow" : "text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"}`}
        >
          Active
        </button>
        <button
          onClick={() => setTab("past")}
          className={`flex-1 py-2.5 rounded-xl text-sm font-semibold transition-all ${tab === "past" ? "bg-primary-500 text-white shadow" : "text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"}`}
        >
          Past Orders
        </button>
      </div>

      {/* Content */}
      {loading ? (
        <div className="space-y-3 animate-pulse">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="card h-24" />
          ))}
        </div>
      ) : shown.length === 0 ? (
        <div className="card p-8 border-2 border-dashed border-gray-200 dark:border-gray-700">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="w-10 h-10 text-gray-300 dark:text-gray-600 mb-4"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={1.5}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
            />
          </svg>
          <p className="font-bold text-lg mb-1">
            {tab === "active" ? "No active orders found" : "No past orders yet"}
          </p>
          <p className="text-gray-500 dark:text-gray-400 text-sm mb-5">
            {tab === "active"
              ? "Ready to eat something delicious?"
              : "Your completed orders will show up here"}
          </p>
          {tab === "active" && (
            <Link
              to={base || "/"}
              className="btn-primary px-6 py-2.5 text-sm inline-block rounded-xl"
            >
              Order Now
            </Link>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {shown.map((order) => (
            <OrderCard key={order.id} order={order} />
          ))}
        </div>
      )}

      {/* Feedback modal */}
      {feedbackModal && (
        <FeedbackModal
          orderId={feedbackModal.orderId}
          existing={feedbackModal.existing}
          onClose={() => setFeedbackModal(null)}
          onSubmitted={(fb) => handleFeedbackSaved(feedbackModal.orderId, fb)}
        />
      )}
    </div>
  );
}
