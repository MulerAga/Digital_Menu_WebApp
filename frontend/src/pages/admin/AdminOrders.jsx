import { useEffect, useState } from 'react';
import { orderAPI, feedbackAPI } from '../../services/api';
import { useBranchSlug } from '../../context/SlugContext';
import { useSocket } from '../../context/SocketContext';
import StatusBadge from '../../components/ui/StatusBadge';
import toast from 'react-hot-toast';

const STATUSES = ['pending', 'preparing', 'served'];
const PAYMENT_METHODS = ['cash', 'wallet', 'bank'];
const PAYMENT_LABELS = { cash: 'Cash', wallet: 'Mobile Wallet', bank: 'Bank Transfer' };

const StarDisplay = ({ rating }) => (
  <span className="flex items-center gap-0.5">
    {[1, 2, 3, 4, 5].map((s) => (
      <span key={s} className={`text-sm ${s <= rating ? 'text-yellow-400' : 'text-gray-200 dark:text-gray-700'}`}>★</span>
    ))}
  </span>
);

export default function AdminOrders() {
  const [orders, setOrders] = useState([]);
  const [filter, setFilter] = useState('');
  const [period, setPeriod] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [feedbackMap, setFeedbackMap] = useState({});
  const [activeTab, setActiveTab] = useState('orders');
  const [allFeedback, setAllFeedback] = useState([]);
  const [feedbackLoading, setFeedbackLoading] = useState(false);
  const { socket } = useSocket();

  const branchSlug = useBranchSlug();

  // ── Search filter logic ──────────────────────────────────────────────────
  // If search starts with "#" → match by order ID
  // Otherwise → match by table number
  const filteredOrders = orders.filter((order) => {
    if (!search.trim()) return true;
    const q = search.trim();
    if (q.startsWith('#')) {
      const idQuery = q.slice(1).trim();
      return idQuery === '' || String(order.id).includes(idQuery);
    }
    return String(order.table_number ?? '').toLowerCase().includes(q.toLowerCase());
  });

  const fetchOrders = () => {
    setLoading(true);
    orderAPI
      .getAll({
        status: filter || undefined,
        period: period || undefined,
        payment_method: paymentMethod || undefined,
        branch: branchSlug || undefined,
      })
      .then((res) => setOrders(res.data))
      .finally(() => setLoading(false));
  };

  const fetchAllFeedback = () => {
    setFeedbackLoading(true);
    feedbackAPI
      .getAll(branchSlug)
      .then((res) => {
        setAllFeedback(res.data);
        const map = {};
        res.data.forEach((f) => { map[f.order_id] = f; });
        setFeedbackMap(map);
      })
      .finally(() => setFeedbackLoading(false));
  };

  useEffect(() => { fetchOrders(); }, [filter, period, paymentMethod, branchSlug]);
  useEffect(() => { fetchAllFeedback(); }, [branchSlug]);

  useEffect(() => {
    if (!socket) return;
    socket.on('new_order', (order) => {
      if (branchSlug && order.branch_slug && order.branch_slug !== branchSlug) return;
      setOrders((prev) => [order, ...prev]);
      toast('New order received!', { icon: '🔔' });
    });
    socket.on('order_updated', (updated) => {
      setOrders((prev) =>
        prev.map((o) => (o.id === updated.id ? { ...o, ...updated } : o))
      );
    });
    socket.on('new_feedback', (fb) => {
      if (branchSlug && fb.branch_slug && fb.branch_slug !== branchSlug) return;
      setFeedbackMap((prev) => ({ ...prev, [fb.order_id]: fb }));
      setAllFeedback((prev) => {
        const exists = prev.find((f) => f.order_id === fb.order_id);
        return exists
          ? prev.map((f) => (f.order_id === fb.order_id ? fb : f))
          : [fb, ...prev];
      });
      toast('New feedback received! ⭐', { icon: '💬' });
    });
    return () => {
      socket.off('new_order');
      socket.off('order_updated');
      socket.off('new_feedback');
    };
  }, [socket, branchSlug]);

  const avgRating = allFeedback.length
    ? (allFeedback.reduce((sum, f) => sum + f.rating, 0) / allFeedback.length).toFixed(1)
    : null;

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-2xl font-bold">
          All Orders 📋
          {branchSlug && (
            <span className="ml-2 text-base font-normal text-gray-400 capitalize">
              — {branchSlug}
            </span>
          )}
        </h1>

        {/* Tab switcher */}
        <div className="flex bg-white dark:bg-gray-900 rounded-xl p-1 shadow-sm border border-gray-100 dark:border-gray-800 gap-1">
          <button
            onClick={() => setActiveTab('orders')}
            className={`px-4 py-1.5 rounded-lg text-sm font-semibold transition-all ${
              activeTab === 'orders'
                ? 'bg-primary-500 text-white shadow'
                : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
            }`}
          >
            Orders
          </button>
          <button
            onClick={() => setActiveTab('feedback')}
            className={`px-4 py-1.5 rounded-lg text-sm font-semibold transition-all flex items-center gap-1.5 ${
              activeTab === 'feedback'
                ? 'bg-primary-500 text-white shadow'
                : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
            }`}
          >
            Feedback
            {allFeedback.length > 0 && (
              <span
                className={`text-xs px-1.5 py-0.5 rounded-full ${
                  activeTab === 'feedback'
                    ? 'bg-white/20'
                    : 'bg-primary-100 dark:bg-primary-900/30 text-primary-600 dark:text-primary-400'
                }`}
              >
                {allFeedback.length}
              </span>
            )}
          </button>
        </div>
      </div>

      {activeTab === 'orders' ? (
        <>
          {/* Search bar */}
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm select-none pointer-events-none">
              🔍
            </span>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="# for ID or number only for table number…"
              className="input pl-9 pr-32 text-sm w-full"
            />
            {/* Live mode hint */}
            {search.trim() && !search.trim().startsWith('#') || search.trim().startsWith('#') ? (
              <span className="absolute right-8 top-1/2 -translate-y-1/2 text-xs text-gray-400 pointer-events-none hidden sm:block">
                {search.trim().startsWith('#') ? 'by order ID' : 'by table'}
              </span>
            ) : null}
            {/* Clear button */}
            {search && (
              <button
                onClick={() => setSearch('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors text-xs"
              >
                ✕
              </button>
            )}
          </div>

          {/* Status filters */}
          <div className="flex gap-2 flex-wrap">
            <button
              onClick={() => setFilter('')}
              className={`px-3 py-1.5 rounded-full text-sm font-medium transition-all ${
                !filter ? 'bg-primary-500 text-white' : 'btn-secondary'
              }`}
            >
              All
            </button>
            {STATUSES.map((s) => (
              <button
                key={s}
                onClick={() => setFilter(s)}
                className={`px-3 py-1.5 rounded-full text-sm font-medium capitalize transition-all ${
                  filter === s ? 'bg-primary-500 text-white' : 'btn-secondary'
                }`}
              >
                {s}
              </button>
            ))}
          </div>

          {/* Period & Payment filters */}
          <div className="flex flex-wrap gap-3">
            <select
              value={period}
              onChange={(e) => setPeriod(e.target.value)}
              className="input text-sm w-40"
            >
              <option value="">All Time</option>
              <option value="day">Today</option>
              <option value="week">Last 7 Days</option>
              <option value="month">Last 30 Days</option>
            </select>
            <select
              value={paymentMethod}
              onChange={(e) => setPaymentMethod(e.target.value)}
              className="input text-sm w-40"
            >
              <option value="">All Payments</option>
              {PAYMENT_METHODS.map((m) => (
                <option key={m} value={m}>{PAYMENT_LABELS[m]}</option>
              ))}
            </select>
          </div>

          {loading ? (
            <div className="space-y-3 animate-pulse">
              {[...Array(4)].map((_, i) => <div key={i} className="card h-20" />)}
            </div>
          ) : filteredOrders.length === 0 ? (
            <div className="text-center py-16 text-gray-400">
              <div className="text-5xl mb-3">📋</div>
              <p>{search.trim() ? 'No orders match your search.' : 'No orders found.'}</p>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredOrders.map((order) => (
                <div key={order.id} className="card p-4 animate-fade-in">
                  <div className="flex items-start justify-between gap-4 flex-wrap">
                    <div>
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <span className="font-bold">Order #{order.id}</span>
                        <StatusBadge status={order.status} />
                        {order.table_number && (
                          <span className="badge bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300">
                            🪑 Table {order.table_number}
                          </span>
                        )}
                        {feedbackMap[order.id] && (
                          <span className="flex items-center gap-1 text-xs bg-yellow-50 dark:bg-yellow-900/20 text-yellow-700 dark:text-yellow-400 px-2 py-0.5 rounded-full">
                            <StarDisplay rating={feedbackMap[order.id].rating} />
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-gray-500 dark:text-gray-400">
                        {order.customer_name || 'Guest'} •{' '}
                        {new Date(order.created_at).toLocaleString()}
                      </p>
                      <div className="flex flex-wrap gap-1 mt-2">
                        {order.items?.map((item) => (
                          <span
                            key={item.id}
                            className="text-xs bg-gray-100 dark:bg-gray-800 px-2 py-0.5 rounded-full"
                          >
                            {item.name} ×{item.quantity}
                          </span>
                        ))}
                      </div>
                      {feedbackMap[order.id]?.comment && (
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-2 italic">
                          💬 "{feedbackMap[order.id].comment}"
                        </p>
                      )}
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className="font-bold text-primary-600 text-lg">
                        ${Number(order.total).toFixed(2)}
                      </p>
                      <p className="text-xs text-gray-400">
                        {PAYMENT_LABELS[order.payment_method] || order.payment_method}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      ) : (
        /* Feedback tab */
        <div className="space-y-4">
          {avgRating && (
            <div className="card p-4 flex items-center gap-4">
              <div className="text-4xl font-bold text-yellow-500">{avgRating}</div>
              <div>
                <div className="flex gap-0.5 mb-1">
                  {[1, 2, 3, 4, 5].map((s) => (
                    <span
                      key={s}
                      className={`text-xl ${
                        s <= Math.round(avgRating)
                          ? 'text-yellow-400'
                          : 'text-gray-200 dark:text-gray-700'
                      }`}
                    >
                      ★
                    </span>
                  ))}
                </div>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Average rating from {allFeedback.length} review{allFeedback.length !== 1 ? 's' : ''}
                </p>
              </div>
            </div>
          )}

          {feedbackLoading ? (
            <div className="space-y-3 animate-pulse">
              {[...Array(3)].map((_, i) => <div key={i} className="card h-20" />)}
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
                        <span className="font-semibold text-sm">Order #{fb.order_id}</span>
                        {fb.table_number && (
                          <span className="text-xs text-gray-400">🪑 Table {fb.table_number}</span>
                        )}
                        <span className="text-xs text-gray-400">{fb.customer_name || 'Guest'}</span>
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