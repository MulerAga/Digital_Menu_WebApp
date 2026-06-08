import { useEffect, useState } from "react";
import { orderAPI, feedbackAPI } from "../../services/api";
import { useSocket } from "../../context/SocketContext";
import StatusBadge from "../../components/ui/StatusBadge";
import toast from "react-hot-toast";

const STATUSES = ["pending", "preparing", "served"];

const StarDisplay = ({ rating }) => (
  <span className="flex items-center gap-0.5">
    {[1, 2, 3, 4, 5].map((s) => (
      <span
        key={s}
        className={`text-sm ${s <= rating ? "text-yellow-400" : "text-gray-200 dark:text-gray-700"}`}
      >
        ★
      </span>
    ))}
  </span>
);

export default function StaffDashboard() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("");
  const [search, setSearch] = useState("");
  const [sortAsc, setSortAsc] = useState(false);
  const [activeTab, setActiveTab] = useState("orders");
  const [allFeedback, setAllFeedback] = useState([]);
  const [feedbackMap, setFeedbackMap] = useState({});
  const [feedbackLoading, setFeedbackLoading] = useState(false);
  const { socket, clearNewOrderCount } = useSocket();

  useEffect(() => {
    clearNewOrderCount();
  }, []);

  const fetchOrders = () => {
    setLoading(true);
    orderAPI
      .getAll({ status: filter || undefined })
      .then((res) => setOrders(res.data))
      .finally(() => setLoading(false));
  };

  const fetchAllFeedback = () => {
    setFeedbackLoading(true);
    feedbackAPI
      .getAll()
      .then((res) => {
        setAllFeedback(res.data);
        const map = {};
        res.data.forEach((f) => {
          map[f.order_id] = f;
        });
        setFeedbackMap(map);
      })
      .finally(() => setFeedbackLoading(false));
  };

  useEffect(() => {
    fetchOrders();
  }, [filter]);

  useEffect(() => {
    fetchAllFeedback();
  }, []);

  useEffect(() => {
    if (!socket) return;

    const handleNewOrder = (order) => {
      if (!filter || order.status === filter) {
        setOrders((prev) => [order, ...prev]);
      }
      toast("🔔 New order!", {
        duration: 5000,
        style: { background: "#f97316", color: "#fff" },
      });
    };

    const handleOrderUpdated = (updated) => {
      setOrders((prev) =>
        prev.map((o) => (o.id === updated.id ? { ...o, ...updated } : o)),
      );
    };

    const handleNewFeedback = (fb) => {
      setFeedbackMap((prev) => ({ ...prev, [fb.order_id]: fb }));
      setAllFeedback((prev) => {
        const exists = prev.find((f) => f.order_id === fb.order_id);
        return exists
          ? prev.map((f) => (f.order_id === fb.order_id ? fb : f))
          : [fb, ...prev];
      });
      toast(`⭐ New feedback for Order #${fb.order_id}`, { duration: 4000 });
    };

    socket.on("new_order", handleNewOrder);
    socket.on("order_updated", handleOrderUpdated);
    socket.on("new_feedback", handleNewFeedback);

    return () => {
      socket.off("new_order", handleNewOrder);
      socket.off("order_updated", handleOrderUpdated);
      socket.off("new_feedback", handleNewFeedback);
    };
  }, [socket, filter]);

  const updateStatus = async (id, status) => {
    try {
      // Optimistically update UI immediately
      setOrders((prev) =>
        prev.map((o) => (o.id === id ? { ...o, status } : o)),
      );

      await orderAPI.updateStatus(id, status);
      toast.success(`Order #${id} → ${status}`);
    } catch (err) {
      // Revert on error
      setOrders((prev) =>
        prev.map((o) =>
          o.id === id
            ? { ...o, status: orders.find((ord) => ord.id === id)?.status }
            : o,
        ),
      );
      toast.error(err.response?.data?.message || "Failed to update");
    }
  };

  const nextStatus = { pending: "preparing", preparing: "served" };

  const filteredOrders = [...orders]
    .filter((o) => {
      if (!search) return true;
      const q = search.trim();

      // If search starts with #, filter ONLY by order ID
      if (q.startsWith("#")) {
        const idToSearch = q.slice(1).toLowerCase();
        return String(o.id).toLowerCase().includes(idToSearch);
      }

      // Otherwise (no #), filter ONLY by table number
      return String(o.table_number ?? "")
        .toLowerCase()
        .includes(q);
    })
    .sort((a, b) =>
      sortAsc
        ? new Date(a.created_at) - new Date(b.created_at)
        : new Date(b.created_at) - new Date(a.created_at),
    );

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold">Staff Dashboard 👨‍🍳</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Manage and update live orders
          </p>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
            <span className="text-xs text-gray-500 dark:text-gray-400">
              Live updates active
            </span>
          </div>
          <div className="flex bg-white dark:bg-gray-900 rounded-xl p-1 shadow-sm border border-gray-100 dark:border-gray-800 gap-1">
            <button
              onClick={() => setActiveTab("orders")}
              className={`px-3 py-1.5 rounded-lg text-sm font-semibold transition-all ${activeTab === "orders" ? "bg-primary-500 text-white shadow" : "text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"}`}
            >
              Orders
            </button>
            <button
              onClick={() => setActiveTab("feedback")}
              className={`px-3 py-1.5 rounded-lg text-sm font-semibold transition-all flex items-center gap-1.5 ${activeTab === "feedback" ? "bg-primary-500 text-white shadow" : "text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"}`}
            >
              Feedback
              {allFeedback.length > 0 && (
                <span
                  className={`text-xs px-1.5 py-0.5 rounded-full ${activeTab === "feedback" ? "bg-white/20" : "bg-primary-100 dark:bg-primary-900/30 text-primary-600 dark:text-primary-400"}`}
                >
                  {allFeedback.length}
                </span>
              )}
            </button>
          </div>
        </div>
      </div>

      {activeTab === "orders" ? (
        <>
          <div className="flex flex-col sm:flex-row gap-2">
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="# for order ID, number only for table"
              className="flex-1 px-4 py-2 text-sm rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-primary-400"
            />
          </div>
          <div className="flex gap-2 overflow-x-auto pb-1">
            {["", ...STATUSES].map((s) => (
              <button
                key={s}
                onClick={() => setFilter(s)}
                className={`flex-shrink-0 px-4 py-2 rounded-full text-sm font-medium capitalize transition-all
                  ${filter === s ? "bg-primary-500 text-white shadow" : "btn-secondary"}`}
              >
                {s || "All"}
              </button>
            ))}
            <button
              onClick={() => setSortAsc((prev) => !prev)}
              className="ml-8 btn-secondary text-xs px-3 py-1.5 flex items-center gap-1 flex-shrink-0"
            >
              {sortAsc ? "⬆️ Oldest to Newest" : "⬇️ Newest to Oldest"}
            </button>
          </div>

          {loading ? (
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 animate-pulse">
              {[...Array(6)].map((_, i) => (
                <div key={i} className="card h-40" />
              ))}
            </div>
          ) : filteredOrders.length === 0 ? (
            <div className="text-center py-16 text-gray-400">
              <div className="text-5xl mb-3">✅</div>
              <p className="text-lg font-medium">
                No {filter || ""} orders{search ? ` matching "${search}"` : ""}
              </p>
            </div>
          ) : (
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredOrders.map((order) => (
                <div
                  key={order.id}
                  className={`card p-4 animate-fade-in border-l-4 ${
                    order.status === "pending"
                      ? "border-yellow-400"
                      : order.status === "preparing"
                        ? "border-blue-400"
                        : order.status === "served"
                          ? "border-purple-400"
                          : "border-gray-300"
                  }`}
                >
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <span className="font-bold text-lg">#{order.id}</span>
                      {order.table_number && (
                        <span className="ml-2 badge bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300">
                          🪑 Table {order.table_number}
                        </span>
                      )}
                    </div>
                    <StatusBadge status={order.status} />
                  </div>

                  <p className="text-xs text-gray-400 mb-2">
                    {new Date(order.created_at).toLocaleTimeString()}
                  </p>

                  <div className="space-y-1 mb-3">
                    {order.items?.map((item) => (
                      <div
                        key={item.id}
                        className="flex justify-between text-sm"
                      >
                        <span>{item.name}</span>
                        <span className="text-gray-400 font-medium">
                          ×{item.quantity}
                        </span>
                      </div>
                    ))}
                  </div>

                  {order.notes && (
                    <p className="text-xs text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 rounded-lg px-3 py-1.5 mb-3">
                      📝 {order.notes}
                    </p>
                  )}

                  {feedbackMap[order.id] && (
                    <div className="flex items-center gap-1.5 mb-3 text-xs text-gray-500 dark:text-gray-400">
                      <StarDisplay rating={feedbackMap[order.id].rating} />
                      {feedbackMap[order.id].comment && (
                        <span className="truncate italic">
                          "{feedbackMap[order.id].comment}"
                        </span>
                      )}
                    </div>
                  )}

                  <div className="flex items-center justify-between">
                    <span className="font-bold text-primary-600">
                      ${Number(order.total).toFixed(2)}
                    </span>
                    <div className="flex gap-2">
                      {nextStatus[order.status] && (
                        <button
                          onClick={() =>
                            updateStatus(order.id, nextStatus[order.status])
                          }
                          className="btn-primary text-xs py-1.5 px-3"
                        >
                          → {nextStatus[order.status]}
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      ) : (
        <div className="space-y-4">
          {allFeedback.length > 0 && (
            <div className="card p-4 flex items-center gap-4">
              <div className="text-4xl font-bold text-yellow-500">
                {(
                  allFeedback.reduce((s, f) => s + f.rating, 0) /
                  allFeedback.length
                ).toFixed(1)}
              </div>
              <div>
                <div className="flex gap-0.5 mb-1">
                  {[1, 2, 3, 4, 5].map((s) => (
                    <span
                      key={s}
                      className={`text-xl ${s <= Math.round(allFeedback.reduce((sum, f) => sum + f.rating, 0) / allFeedback.length) ? "text-yellow-400" : "text-gray-200 dark:text-gray-700"}`}
                    >
                      ★
                    </span>
                  ))}
                </div>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Average from {allFeedback.length} review
                  {allFeedback.length !== 1 ? "s" : ""}
                </p>
              </div>
            </div>
          )}

          {feedbackLoading ? (
            <div className="space-y-3 animate-pulse">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="card h-20" />
              ))}
            </div>
          ) : allFeedback.length === 0 ? (
            <div className="text-center py-16 text-gray-400">
              <div className="text-5xl mb-3">💬</div>
              <p>No feedback yet</p>
            </div>
          ) : (
            <div className="space-y-3">
              {allFeedback.map((fb) => (
                <div key={fb.id} className="card p-4 animate-fade-in">
                  <div className="flex items-start justify-between gap-3 flex-wrap">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold text-sm">
                          Order #{fb.order_id}
                        </span>
                        {fb.table_number && (
                          <span className="text-xs text-gray-400">
                            🪑 Table {fb.table_number}
                          </span>
                        )}
                        <span className="text-xs text-gray-400">
                          {fb.customer_name || "Guest"}
                        </span>
                      </div>
                      <StarDisplay rating={fb.rating} />
                      {fb.comment && (
                        <p className="text-sm text-gray-600 dark:text-gray-300 italic">
                          "{fb.comment}"
                        </p>
                      )}
                    </div>
                    <div className="text-right text-xs text-gray-400 flex-shrink-0">
                      <p>${Number(fb.total).toFixed(2)}</p>
                      <p>{new Date(fb.created_at).toLocaleDateString()}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
