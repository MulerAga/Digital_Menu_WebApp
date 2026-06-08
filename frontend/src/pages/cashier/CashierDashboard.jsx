import { useEffect, useMemo, useState } from "react";
import { orderAPI, getImageUrl } from "../../services/api";
import { useSocket } from "../../context/SocketContext";
import StatusBadge from "../../components/ui/StatusBadge";
import toast from "react-hot-toast";

const playNotification = () => {
  try {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    const ctx = new AudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = "sine";
    osc.frequency.value = 520;
    gain.gain.value = 0.08;

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start();
    setTimeout(() => {
      osc.stop();
      ctx.close();
    }, 150);
  } catch (err) {}
};

const statusBadgeColor = {
  pending:
    "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-200",
  preparing: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-200",
  served:
    "bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-200",
};

const paymentBadgeColor = {
  cash: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-200",
  bank: "bg-sky-100 text-sky-700 dark:bg-sky-900/40 dark:text-sky-200",
  wallet:
    "bg-fuchsia-100 text-fuchsia-700 dark:bg-fuchsia-900/40 dark:text-fuchsia-200",
};

const OrderCard = ({ order, onPay, onPrint, onViewReceipt }) => {
  const canPay =
    ["cash", "bank", "wallet"].includes(order.payment_method) &&
    !order.cash_paid;

  const canViewReceipt =
    (order.payment_method === "bank" || order.payment_method === "wallet") &&
    !!order.receipt_image;

  // Debug helper — remove after confirming button appears
  if (order.payment_method === "bank" || order.payment_method === "wallet") {
    console.debug(
      `[Order #${order.id}] payment_method="${order.payment_method}" receipt_image=${JSON.stringify(order.receipt_image)} canViewReceipt=${canViewReceipt}`,
    );
  }

  return (
    <div className="group rounded-2xl border border-green-500 dark:border-green-50 bg-white dark:bg-gray-900 shadow-sm hover:shadow-md transition-shadow overflow-hidden">
      <div className="p-4 border-b border-gray-100 dark:border-gray-800">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-sm font-semibold text-gray-500 dark:text-gray-400">
                Order #{order.id}
              </span>
              <span
                className={`px-2.5 py-1 text-xs font-medium rounded-full ${
                  statusBadgeColor[order.status] ||
                  "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-200"
                }`}
              >
                {order.status}
              </span>
              <span
                className={`px-2.5 py-1 text-xs font-medium rounded-full capitalize ${
                  paymentBadgeColor[order.payment_method] ||
                  "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-200"
                }`}
              >
                {order.payment_method}
              </span>
              {order.cash_paid === 1 && (
                <span className="px-2.5 py-1 text-xs font-medium rounded-full bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-200">
                  Paid
                </span>
              )}
            </div>

            <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
              {order.table_number ? `Table ${order.table_number}` : "Takeaway"}{" "}
              • {new Date(order.created_at).toLocaleString()}
            </p>
          </div>

          <div className="text-right">
            <p className="text-xs uppercase tracking-wide text-gray-400">
              Total
            </p>
            <p className="text-xl font-bold text-emerald-600 dark:text-emerald-400">
              ${Number(order.total).toFixed(2)}
            </p>
          </div>
        </div>
      </div>

      <div className="p-4">
        <div className="space-y-2 text-sm">
          {order.items?.map((item) => (
            <div
              key={item.id}
              className="flex items-center justify-between rounded-lg bg-gray-50 dark:bg-gray-800 px-3 py-2"
            >
              <span className="text-gray-700 dark:text-gray-200">
                {item.name} × {item.quantity}
              </span>
              <span className="font-medium text-gray-900 dark:text-gray-100">
                ${Number(item.price).toFixed(2)}
              </span>
            </div>
          ))}
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          {canPay && (
            <button
              onClick={() => onPay(order.id)}
              className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-emerald-700 transition"
            >
              Mark as Paid
            </button>
          )}

          <button
            onClick={() => onPrint(order)}
            className="inline-flex items-center gap-2 rounded-xl bg-gray-900 px-1 py-1 text-sm font-medium text-white hover:bg-black transition dark:bg-gray-800 dark:hover:bg-gray-700"
          >
            🖨 Print Receipt
          </button>

          {canViewReceipt && (
            <button
              onClick={() => onViewReceipt(getImageUrl(order.receipt_image))}
              className="inline-flex items-center gap-2 rounded-xl bg-sky-600 px-1 py-1 text-sm font-medium text-white hover:bg-sky-700 transition"
            >
              View Receipt
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default function CashierDashboard() {
  const [orders, setOrders] = useState([]);
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [activeCategory, setActiveCategory] = useState("all");
  const [showAll, setShowAll] = useState(false);
  const [paidOpen, setPaidOpen] = useState(false);
  const [receiptImage, setReceiptImage] = useState(null);
  const { socket } = useSocket();

  const viewReceipt = (image) => {
    setReceiptImage(image);
  };
  const paymentCategories = [
    { id: "all", label: "All" },
    { id: "cash", label: "Cash Payment" },
    { id: "bank", label: "Bank Transfer" },
    { id: "wallet", label: "Mobile Wallet" },
  ];
  const fetchOrders = async () => {
    setLoading(true);
    try {
      const res = await orderAPI.getAll();
      setOrders(res.data || []);
    } catch {
      toast.error("Failed to load orders");
    } finally {
      setLoading(false);
    }
  };

  const fetchSummary = async () => {
    try {
      const res = await orderAPI.getCashierSummary();
      setSummary(res.data);
    } catch {
      setSummary(null);
    }
  };

  useEffect(() => {
    fetchOrders();
    fetchSummary();
  }, []);

  useEffect(() => {
    if (!socket) return;

    const handleNew = (order) => {
      setOrders((prev) => [order, ...prev]);
      toast(`New ${order.payment_method} order`);
      playNotification();
      fetchSummary();
    };

    const handleUpdate = (updated) => {
      setOrders((prev) => prev.map((o) => (o.id === updated.id ? updated : o)));
      fetchSummary();
    };

    socket.on("new_order", handleNew);
    socket.on("order_updated", handleUpdate);

    return () => {
      socket.off("new_order", handleNew);
      socket.off("order_updated", handleUpdate);
    };
  }, [socket]);

  const updateOrder = async (id, action) => {
    try {
      let updatedOrder = null;

      if (action === "paid") {
        const res = await orderAPI.markCashPaid(id);
        updatedOrder = res?.data?.order || res?.data || null;
      }

      setOrders((prev) =>
        prev.map((o) => {
          if (o.id !== id) return o;
          return updatedOrder
            ? { ...o, ...updatedOrder }
            : { ...o, cash_paid: 1 };
        }),
      );

      toast.success("Updated");
      fetchSummary();
    } catch {
      toast.error("Update failed");
    }
  };

  const printReceipt = (order) => {
    const win = window.open("", "_blank", "width=450,height=600");
    if (!win) return;

    win.document.write(`
      <html>
        <body style="font-family: sans-serif; padding: 16px;">
          <h2>Receipt #${order.id}</h2>
          <p>${new Date(order.created_at).toLocaleString()}</p>
          <hr/>
          ${order.items
            .map((i) => `<p>${i.name} x ${i.quantity} - $${i.price}</p>`)
            .join("")}
          <hr/>
          <h3>Total: $${order.total}</h3>
        </body>
      </html>
    `);

    win.document.close();
    win.print();
  };

  const filteredOrders = useMemo(() => {
    if (showAll) return orders;

    if (!search) return orders;

    return orders.filter(
      (o) =>
        String(o.id).includes(search) ||
        o.items?.some((i) =>
          i.name.toLowerCase().includes(search.toLowerCase()),
        ),
    );
  }, [orders, search, showAll]);

  const newOrders = filteredOrders.filter((o) => o.cash_paid !== 1);
  const paidOrders = filteredOrders.filter((o) => o.cash_paid === 1);
  const cashOrders = newOrders.filter((o) => o.payment_method === "cash");
  const bankOrders = newOrders.filter((o) => o.payment_method === "bank");
  const walletOrders = newOrders.filter((o) => o.payment_method === "wallet");
  const displayedOrders = useMemo(() => {
    switch (activeCategory) {
      case "cash":
        return cashOrders;
      case "bank":
        return bankOrders;
      case "wallet":
        return walletOrders;
      default:
        return newOrders;
    }
  }, [activeCategory, newOrders, cashOrders, bankOrders, walletOrders]);

  const sectionCard =
    "rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 shadow-sm";
  const sectionHeader =
    "flex items-center justify-between px-4 py-3 border-b border-gray-100 dark:border-gray-800";

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold">Cashier Dashboard</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Track orders, payments, and receipts in one place.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div
          onClick={() => setShowAll(true)}
          className="cursor-pointer rounded-2xl bg-gradient-to-br from-gray-900 to-gray-700 text-white p-4 shadow-sm"
        >
          <p className="text-sm text-gray-300">Total Orders</p>
          <p className="text-3xl font-bold">{summary?.total_orders ?? 0}</p>
        </div>

        <div className="rounded-2xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 p-4 shadow-sm">
          <p className="text-sm text-gray-500 dark:text-gray-400">Pending</p>
          <p className="text-3xl font-bold text-yellow-600">
            {newOrders.length}
          </p>
        </div>

        <div className="rounded-2xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 p-4 shadow-sm">
          <p className="text-sm text-gray-500 dark:text-gray-400">Paid</p>
          <p className="text-3xl font-bold text-green-600">
            {paidOrders.length}
          </p>
        </div>
      </div>

      <input
        className="w-full rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 px-4 py-3 outline-none focus:ring-2 focus:ring-emerald-500"
        placeholder="Search orders..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />

      <section className={sectionCard}>
        <div className={sectionHeader}>
          <div>
            <h2 className="text-xl font-bold">New Orders</h2>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Orders awaiting payment or processing.
            </p>
          </div>
        </div>

        <div className="p-4">
          {/* Categories */}
          <div className="flex gap-2 overflow-x-auto pb-3 mb-4">
            {paymentCategories.map((category) => (
              <button
                key={category.id}
                onClick={() => setActiveCategory(category.id)}
                className={`whitespace-nowrap px-4 py-2 rounded-xl text-sm font-medium transition
          ${
            activeCategory === category.id
              ? "bg-emerald-600 text-white"
              : "bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700"
          }`}
              >
                {category.label}
              </button>
            ))}
          </div>

          {/* Orders */}
          <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
            {displayedOrders.length > 0 ? (
              displayedOrders.map((o) => (
                <OrderCard
                  key={o.id}
                  order={o}
                  onPay={(id) => updateOrder(id, "paid")}
                  onPrint={printReceipt}
                  onViewReceipt={viewReceipt}
                />
              ))
            ) : (
              <div className="col-span-full text-center py-10 text-gray-500">
                No orders found
              </div>
            )}
          </div>
        </div>
      </section>

      <section className={sectionCard}>
        <div className={sectionHeader}>
          <div>
            <h2 className="text-xl font-bold">Paid Orders</h2>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Completed and settled orders.
            </p>
          </div>
          <button
            onClick={() => setPaidOpen(!paidOpen)}
            className="rounded-full bg-gray-100 dark:bg-gray-800 px-4 py-2 text-sm font-medium"
          >
            {paidOpen ? "Hide Paid Orders" : "Show Paid Orders"}
          </button>
        </div>

        {paidOpen && (
          <div className="p-4 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {paidOrders.map((o) => (
              <OrderCard
                key={o.id}
                order={o}
                onPay={(id) => updateOrder(id, "paid")}
                onPrint={printReceipt}
                onViewReceipt={viewReceipt}
              />
            ))}
          </div>
        )}
      </section>

      {receiptImage && (
        <div
          className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4"
          onClick={() => setReceiptImage(null)}
        >
          <div
            className="bg-white dark:bg-gray-900 p-4 rounded-2xl max-w-3xl w-full shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold">Payment Receipt</h3>
              <button
                className="px-3 py-1 bg-red-500 text-white rounded-lg"
                onClick={() => setReceiptImage(null)}
              >
                Close
              </button>
            </div>

            <img
              src={receiptImage}
              alt="Payment Receipt"
              className="max-h-[80vh] max-w-full rounded-xl mx-auto"
            />
          </div>
        </div>
      )}
    </div>
  );
}
