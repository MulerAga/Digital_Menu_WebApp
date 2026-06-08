import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { orderAPI } from "../services/api";
import { useSocket } from "../context/SocketContext";
import { useAuth } from "../context/AuthContext";
import { useBasePath } from "../context/SlugContext";
import StatusBadge from "../components/ui/StatusBadge";
import FeedbackModal from "../components/FeedbackModal";

const STEPS = ["pending", "preparing", "served"];
const PAYMENT_LABELS = {
  cash: "Cash",
  wallet: "Mobile Wallet",
  bank: "Bank Transfer",
};

export default function OrderDetailPage() {
  const { id } = useParams();
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [feedback, setFeedback] = useState(null);
  const [showFeedback, setShowFeedback] = useState(false);
  const { socket } = useSocket();
  const { user } = useAuth();
  const base = useBasePath();

  useEffect(() => {
    orderAPI
      .getOne(id)
      .then((res) => setOrder(res.data))
      .finally(() => setLoading(false));
  }, [id]);

  // Load existing feedback if order is served
  useEffect(() => {
    if (!order || !["served", "completed"].includes(order.status)) return;
    orderAPI
      .getFeedback(id)
      .then((res) => setFeedback(res.data))
      .catch(() => setFeedback(null)); // 404 means no feedback yet
  }, [id, order?.status]);

  useEffect(() => {
    if (!socket) return;
    socket.emit("join_order", id);
    const handler = (updated) => {
      if (updated.id == id) setOrder((prev) => ({ ...prev, ...updated }));
    };
    socket.on("order_status_changed", handler);
    return () => socket.off("order_status_changed", handler);
  }, [socket, id]);

  if (loading) return <div className="card h-64 animate-pulse" />;
  if (!order)
    return (
      <div className="text-center py-16 text-gray-400">Order not found</div>
    );

  const stepIndex = STEPS.indexOf(order.status);
  const canFeedback =
    ["served"].includes(order.status) && (user?.role === "customer" || !user);

  const STAR_LABELS = ["", "Poor", "Fair", "Good", "Very Good", "Excellent"];

  return (
    <div className="max-w-2xl mx-auto animate-fade-in space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Order #{order.id}</h1>
        <StatusBadge status={order.status} />
      </div>

      {/* Progress */}
      {order.status !== "cancelled" && (
        <div className="card p-6">
          <p className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-4">
            Order Progress
          </p>
          <div className="flex items-center">
            {STEPS.map((step, i) => (
              <div
                key={step}
                className="flex items-center flex-1 last:flex-none"
              >
                <div
                  className={`flex flex-col items-center gap-1 ${i <= stepIndex ? "text-primary-600" : "text-gray-300 dark:text-gray-600"}`}
                >
                  <div
                    className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold transition-all
                    ${i < stepIndex ? "bg-primary-500 text-white" : i === stepIndex ? "bg-primary-500 text-white ring-4 ring-primary-200 dark:ring-primary-900/50" : "bg-gray-100 dark:bg-gray-800"}`}
                  >
                    {i < stepIndex ? "✓" : i + 1}
                  </div>
                  <span className="text-xs capitalize hidden sm:block">
                    {step}
                  </span>
                </div>
                {i < STEPS.length - 1 && (
                  <div
                    className={`flex-1 h-1 mx-1 rounded transition-all ${i < stepIndex ? "bg-primary-500" : "bg-gray-100 dark:bg-gray-800"}`}
                  />
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Details */}
      <div className="card p-4 space-y-3">
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div>
            <p className="text-gray-500 dark:text-gray-400">Table</p>
            <p className="font-medium">{order.table_number || "Takeaway"}</p>
          </div>
          <div>
            <p className="text-gray-500 dark:text-gray-400">Payment</p>
            <p className="font-medium">
              {PAYMENT_LABELS[order.payment_method] || order.payment_method}
            </p>
          </div>
          <div>
            <p className="text-gray-500 dark:text-gray-400">Placed</p>
            <p className="font-medium">
              {new Date(order.created_at).toLocaleString()}
            </p>
          </div>
          <div>
            <p className="text-gray-500 dark:text-gray-400">Total</p>
            <p className="font-bold text-primary-600">
              ${Number(order.total).toFixed(2)}
            </p>
          </div>
        </div>
        {order.notes && (
          <p className="text-sm text-gray-500 dark:text-gray-400 border-t border-gray-100 dark:border-gray-800 pt-3">
            📝 {order.notes}
          </p>
        )}
      </div>

      {/* Items */}
      <div className="card divide-y divide-gray-100 dark:divide-gray-800">
        <p className="px-4 py-3 font-semibold text-sm">Items</p>
        {order.items?.map((item) => (
          <div
            key={item.id}
            className="flex justify-between items-center px-4 py-3 text-sm"
          >
            <span>
              {item.name}{" "}
              <span className="text-gray-400">×{item.quantity}</span>
            </span>
            <span className="font-medium">
              ${(item.price * item.quantity).toFixed(2)}
            </span>
          </div>
        ))}
      </div>

      {/* Feedback section */}
      {canFeedback && (
        <div className="card p-4 space-y-3">
          {feedback ? (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <p className="font-semibold text-sm">Your Feedback</p>
                <button
                  onClick={() => setShowFeedback(true)}
                  className="text-xs text-primary-600 hover:underline"
                >
                  Edit
                </button>
              </div>
              <div className="flex items-center gap-1">
                {[1, 2, 3, 4, 5].map((s) => (
                  <span
                    key={s}
                    className={`text-xl ${s <= feedback.rating ? "text-yellow-400" : "text-gray-200 dark:text-gray-700"}`}
                  >
                    ★
                  </span>
                ))}
                <span className="text-sm text-gray-500 dark:text-gray-400 ml-1">
                  {STAR_LABELS[feedback.rating]}
                </span>
              </div>
              {feedback.comment && (
                <p className="text-sm text-gray-600 dark:text-gray-300 italic">
                  "{feedback.comment}"
                </p>
              )}
            </div>
          ) : (
            <div className="flex items-center justify-between">
              <div>
                <p className="font-semibold text-sm">How was your order?</p>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  Share your idea!
                </p>
              </div>
              <button
                onClick={() => setShowFeedback(true)}
                className="btn-primary text-sm px-4 py-2"
              >
                ⭐ Leave Feedback
              </button>
            </div>
          )}
        </div>
      )}

      <Link
        to={`${base}/orders`}
        className="btn-secondary w-full text-center block py-3"
      >
        ← Back to Orders
      </Link>

      {showFeedback && (
        <FeedbackModal
          orderId={order.id}
          existing={feedback}
          onClose={() => setShowFeedback(false)}
          onSubmitted={(fb) => setFeedback(fb)}
        />
      )}
    </div>
  );
}
