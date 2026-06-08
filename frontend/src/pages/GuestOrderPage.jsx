import { useEffect, useState } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { orderAPI } from "../services/api";
import { useAuth } from "../context/AuthContext";
import { useBasePath, useSlug } from "../context/SlugContext";
import StatusBadge from "../components/ui/StatusBadge";
import FeedbackModal from "../components/FeedbackModal";

const STEPS = ["pending", "preparing", "served"];

export default function GuestOrderPage() {
  const { token, slug: slugParam } = useParams(); // ← also read slug from URL
  const navigate = useNavigate();
  const { user } = useAuth();
  const base = useBasePath();
  const slugFromContext = useSlug();
  const slug = slugFromContext || slugParam; // ← fallback to URL param
  // ... rest unchanged
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [feedback, setFeedback] = useState(null);
  const [showFeedback, setShowFeedback] = useState(false);

  const fetchOrder = () => {
    if (!token) {
      setError("Missing order token");
      setLoading(false);
      return;
    }
    orderAPI
      .getByGuestToken(token, slug)
      .then((res) => {
        console.log("order data:", res.data);
        setOrder(res.data);
      })
      .catch(() => setError("Order not found. The link may be invalid."))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchOrder();
    const interval = setInterval(() => {
      // Stop polling once order is served/completed/cancelled
      if (
        order &&
        ["served", "completed", "cancelled"].includes(order.status)
      ) {
        clearInterval(interval);
        return;
      }
      fetchOrder();
    }, 10000);
    return () => clearInterval(interval);
  }, [token]);

  useEffect(() => {
    if (!order || !["served", "completed"].includes(order.status)) return;
    orderAPI
      .getFeedback(order.id, slug, order.branch_id)
      .then((res) => setFeedback(res.data))
      .catch(() => setFeedback(null));
  }, [order?.id, order?.status]);

  if (loading)
    return (
      <div className="max-w-lg mx-auto mt-12 space-y-4 animate-pulse">
        <div className="card h-32" />
        <div className="card h-48" />
      </div>
    );

  if (error)
    return (
      <div className="text-center py-24 animate-fade-in">
        <div className="text-6xl mb-4">🔍</div>
        <h2 className="text-xl font-bold mb-2">Order not found</h2>
        <p className="text-gray-500 dark:text-gray-400 mb-6">{error}</p>
        <Link to={base || "/"} className="btn-primary px-8 py-3">
          Back to Menu
        </Link>
      </div>
    );

  const stepIndex = STEPS.indexOf(order.status);
  const isServed = ["served", "completed"].includes(order.status);

  return (
    <div className="max-w-lg mx-auto animate-fade-in space-y-6">
      {/* Header */}
      <div className="text-center relative">
        <div className="text-5xl mb-3">🎉</div>
        <h1 className="text-2xl font-bold">Order Placed!</h1>
        <p className="text-gray-500 dark:text-gray-400 mt-1">
          Order #{order.id} •{" "}
          {order.table_number ? `Table ${order.table_number}` : "Takeaway"}
        </p>
        <button
          onClick={() =>
            navigate(user ? `${base}/orders` : `${base}/my-orders`)
          }
          className="mt-3 inline-flex items-center gap-1 text-sm text-primary-600 hover:text-primary-700 font-medium transition-colors"
        >
          ↑ Collapse
        </button>
      </div>

      {/* Live status indicator */}
      <div className="card p-4 flex items-center gap-3 border-l-4 border-primary-400">
        <span className="w-2.5 h-2.5 rounded-full bg-green-500 animate-pulse flex-shrink-0" />
        <p className="text-sm text-gray-500 dark:text-gray-400">
          Status updates automatically!
        </p>
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
                    className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold transition-all
                      ${
                        i < stepIndex
                          ? "bg-primary-500 text-white"
                          : i === stepIndex
                            ? "bg-primary-500 text-white ring-4 ring-primary-200 dark:ring-primary-900/50"
                            : "bg-gray-100 dark:bg-gray-800"
                      }`}
                  >
                    {i < stepIndex ? "✓" : ["⏳", "👨‍🍳", "✅"][i]}
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
          <div className="mt-4 text-center">
            <StatusBadge status={order.status} />
          </div>
        </div>
      )}

      {order.status === "cancelled" && (
        <div className="card p-4 border-l-4 border-red-400 text-center">
          <p className="text-red-600 font-semibold">
            ❌ This order was cancelled
          </p>
        </div>
      )}

      {/* Order details */}
      <div className="card divide-y divide-gray-100 dark:divide-gray-800">
        <p className="px-4 py-3 font-semibold text-sm">Your Items</p>
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
        <div className="flex justify-between px-4 py-3 font-bold">
          <span>Total</span>
          <span className="text-primary-600">
            ${Number(order.total).toFixed(2)}
          </span>
        </div>
      </div>

      {order.notes && (
        <div className="card p-4 text-sm text-gray-500 dark:text-gray-400">
          📝 {order.notes}
        </div>
      )}

      {/* Feedback */}
      {isServed && (
        <div className="card p-4">
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

      {/* Bookmark hint */}
      <p className="text-center text-xs text-gray-400 dark:text-gray-500 pb-4">
        💡 Bookmark this page to track your order anytime
      </p>

      {/* Feedback modal */}
      {showFeedback && (
        <FeedbackModal
          orderId={order.id}
          existing={feedback}
          guestToken={order.guest_token}
          restaurantSlug={slug}
          branchId={order.branch_id}
          onClose={() => setShowFeedback(false)}
          onSubmitted={(fb) => {
            setFeedback(fb);
            setShowFeedback(false);
          }}
        />
      )}
    </div>
  );
}
