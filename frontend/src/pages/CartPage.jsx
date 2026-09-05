import { useState, useEffect } from "react";
import { useNavigate, useLocation, useSearchParams } from "react-router-dom";
import { useCart } from "../context/CartContext";
import { useAuth } from "../context/AuthContext";
import { useBasePath, useSlug } from "../context/SlugContext";
import { getImageUrl, orderAPI } from "../services/api";
import toast from "react-hot-toast";
import { Copy } from "lucide-react";

const PAYMENT_METHODS = [
  { value: "cash", label: "Cash", icon: "💵" },
  { value: "bank", label: "Bank Transfer", icon: "🏦" },
  { value: "wallet", label: "Mobile Wallet", icon: "📱" },
];

const PAYMENT_DETAILS = {
  bank: {
    title: "Bank Transfer Instructions",
    name: "Commercial Bank of Ethiopia",
    account: "1000123456789",
    holder: "Digital Menu PLC",
  },
  wallet: {
    title: "Mobile Wallet Instructions",
    name: "Telebirr Or CBE Birr",
    account: "+251912345678",
    holder: "Digital Menu PLC",
  },
};

const copyToClipboard = (text) => {
  navigator.clipboard.writeText(text);
  toast.success("Copied!");
};

export default function CartPage() {
  const {
    items,
    total,
    itemCount,
    updateQty,
    remove,
    clear,
    tableNumber,
    setTable,
  } = useCart();
  const [dreceipt, setdReceipt] = useState(null);
  const [receiptPreview, setReceiptPreview] = useState(null);
  const { user } = useAuth();
  const base = useBasePath();
  const slug = useSlug();
  const [payment, setPayment] = useState("cash");
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();

  const pathParts = location.pathname.split("/").filter(Boolean);
  const restaurantSlug = pathParts[0];
  const branchSlug = pathParts[2] || null;

  // Pre-fill table number from QR code URL (?table=5)
  useEffect(() => {
    const tableFromUrl = searchParams.get("table");
    if (tableFromUrl && !tableNumber) {
      setTable(tableFromUrl);
    }
  }, [setTable]); // ← fixed: added setTable to dependency array

  useEffect(() => {
    return () => {
      if (receiptPreview) {
        URL.revokeObjectURL(receiptPreview);
      }
    };
  }, [receiptPreview]);

  const handleOrder = async () => {
    if ((payment === "bank" || payment === "wallet") && !dreceipt) {
      toast.error("Please upload payment screenshot");
      return;
    }
    if (!items.length) return;
    if (!tableNumber.trim()) {
      toast.error("Please enter a table number");
      return;
    }
    setLoading(true);
    try {
      const formData = new FormData();
      formData.append(
        "items",
        JSON.stringify(
          items.map((i) => ({ menu_item_id: i.id, quantity: i.qty })),
        ),
      );
      formData.append("table_number", tableNumber);
      formData.append("payment_method", payment);
      formData.append("notes", notes || "");
      formData.append("restaurant_slug", restaurantSlug);
      if (branchSlug) formData.append("branch_slug", branchSlug);
      if (dreceipt) formData.append("receipt_image", dreceipt);

      const res = await orderAPI.place(formData, restaurantSlug, branchSlug);
      clear();
      toast.success("Order placed successfully!", { icon: "🎉" });

      if (user) {
        navigate(`${base}/orders/${res.data.id}`);
      } else {
        const guestOrders = JSON.parse(
          localStorage.getItem("guest_orders") || "[]",
        );
        guestOrders.unshift({
          id: res.data.id,
          token: res.data.guest_token,
          slug: restaurantSlug || null,
          branchSlug: branchSlug || null,
          created_at: res.data.created_at,
        });
        localStorage.setItem("guest_orders", JSON.stringify(guestOrders));
        navigate(`${base}/track/${res.data.guest_token}`);
      }
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to place order");
    } finally {
      setLoading(false);
    }
  };

  if (!items.length) {
    return (
      <div className="text-center py-24 animate-fade-in">
        <div className="text-7xl mb-4">🛒</div>
        <h2 className="text-2xl font-bold mb-2">Your cart is empty</h2>
        <p className="text-gray-500 dark:text-gray-400 mb-6">
          Add some delicious items from the menu
        </p>
        <button
          onClick={() => navigate(base || "/")}
          className="btn-primary px-8 py-3"
        >
          Browse Menu
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto animate-fade-in space-y-6">
      <h1 className="text-2xl font-bold">Your Cart 🛒</h1>

      {/* Items */}
      <div className="card divide-y divide-gray-100 dark:divide-gray-800">
        {items.map((item) => {
          const price = item.discount_percent
            ? item.price * (1 - item.discount_percent / 100)
            : item.price;
          return (
            <div key={item.id} className="flex items-center gap-4 p-4">
              <div className="w-12 h-12 rounded-xl bg-orange-50 dark:bg-gray-800 flex items-center justify-center text-2xl flex-shrink-0 overflow-hidden">
                {item.image ? (
                  <img
                    src={getImageUrl(item.image)}
                    alt={item.name}
                    className="w-full h-full object-cover rounded-xl"
                  />
                ) : item.category_icon ? (
                  item.category_icon
                ) : (
                  "🍴"
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-sm truncate">{item.name}</p>
                <p className="text-primary-600 font-semibold text-sm">
                  ${(price * item.qty).toFixed(2)}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => updateQty(item.id, item.qty - 1)}
                  className="w-7 h-7 rounded-full bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 flex items-center justify-center font-bold transition-colors"
                >
                  −
                </button>
                <span className="w-6 text-center font-semibold text-sm">
                  {item.qty}
                </span>
                <button
                  onClick={() => updateQty(item.id, item.qty + 1)}
                  className="w-7 h-7 rounded-full bg-primary-100 dark:bg-primary-900/30 hover:bg-primary-200 text-primary-600 flex items-center justify-center font-bold transition-colors"
                >
                  +
                </button>
                <button
                  onClick={() => remove(item.id)}
                  className="w-7 h-7 rounded-full hover:bg-red-50 dark:hover:bg-red-900/20 text-red-400 flex items-center justify-center transition-colors ml-1"
                >
                  ✕
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Table & Notes */}
      <div className="card p-4 space-y-4">
        <div>
          <label className="block text-sm font-medium mb-1.5">
            Table Number <span className="text-red-500">*</span>
          </label>

          {searchParams.get("table") ? (
            <div className="input bg-gray-100 dark:bg-gray-800">
              Table {tableNumber}
            </div>
          ) : (
            <input
              type="text"
              className="input"
              placeholder="e.g. Table 5"
              value={tableNumber}
              onChange={(e) => setTable(e.target.value)}
              required
            />
          )}

          {searchParams.get("table") && (
            <p className="text-xs text-green-600 mt-1">
              ✓ Table {searchParams.get("table")} detected from QR code
            </p>
          )}
        </div>
        <div>
          <label className="block text-sm font-medium mb-1.5">
            Special Notes
          </label>
          <textarea
            className="input resize-none"
            rows={2}
            placeholder="Preferences ..."
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
        </div>
      </div>

      {/* Payment */}
      <div className="card p-4">
        <p className="text-sm font-medium mb-3">Payment Method</p>
        <div className="grid grid-cols-3 gap-2">
          {PAYMENT_METHODS.map((m) => (
            <button
              key={m.value}
              onClick={() => setPayment(m.value)}
              className={`flex flex-col items-center gap-1 p-3 rounded-xl border-2 transition-all text-sm font-medium
                ${payment === m.value ? "border-primary-500 bg-primary-50 dark:bg-primary-900/20 text-primary-600" : "border-gray-200 dark:border-gray-700 hover:border-gray-300"}`}
            >
              <span className="text-xl">{m.icon}</span>
              {m.label}
            </button>
          ))}
        </div>
      </div>

      {(payment === "bank" || payment === "wallet") && (
        <div className="card p-4 bg-blue-50 dark:bg-gray-900 space-y-3">
          <h2 className="font-bold text-lg">
            {PAYMENT_DETAILS[payment].title}
          </h2>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between items-center">
              <span className="text-gray-500">Account Name</span>
              <span className="font-medium">
                {PAYMENT_DETAILS[payment].name}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-500">Account Number</span>
              <div className="flex items-center gap-2">
                <span className="font-mono">
                  {PAYMENT_DETAILS[payment].account}
                </span>
                <button
                  onClick={() =>
                    copyToClipboard(PAYMENT_DETAILS[payment].account)
                  }
                  className="text-gray-500 hover:text-primary-600 transition"
                >
                  <Copy size={18} />
                </button>
              </div>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-500">Account Holder</span>
              <span className="font-medium">
                {PAYMENT_DETAILS[payment].holder}
              </span>
            </div>
          </div>
        </div>
      )}

      {(payment === "bank" || payment === "wallet") && (
        <div className="card p-4 space-y-3 border border-blue-200 dark:border-gray-700">
          <h3 className="font-medium text-sm">
            Upload Payment Screenshot <span className="text-red-500">*</span>
          </h3>
          <div className="border-2 border-dashed rounded-xl p-4 text-center">
            <input
              type="file"
              accept="image/*"
              className="hidden"
              id="receiptUpload"
              onChange={(e) => {
                const file = e.target.files[0];
                setdReceipt(file);
                if (file) {
                  setReceiptPreview(URL.createObjectURL(file));
                }
              }}
            />
            <label htmlFor="receiptUpload" className="cursor-pointer block">
              {receiptPreview ? (
                <div className="flex flex-col items-center">
                  <img
                    src={receiptPreview}
                    alt="Receipt"
                    className="w-full max-h-48 object-contain rounded-lg"
                  />
                  <p className="text-xs text-gray-500 mt-2">
                    Click to change receipt image
                  </p>
                </div>
              ) : (
                <>
                  <div className="text-4xl mb-2">📤</div>
                  <p className="text-sm text-gray-500">
                    Click to upload receipt image
                  </p>
                  <p className="text-xs text-gray-400 mt-1">
                    JPEG, PNG, WebP • Max 5MB
                  </p>
                </>
              )}
            </label>
          </div>
          {dreceipt && (
            <p className="text-green-600 text-sm">✔ {dreceipt.name} selected</p>
          )}
        </div>
      )}

      {/* Summary */}
      <div className="card p-4 space-y-2">
        <div className="flex justify-between text-sm text-gray-500 dark:text-gray-400">
          <span>{itemCount} items</span>
          <span>${total.toFixed(2)}</span>
        </div>
        <div className="flex justify-between font-bold text-lg border-t border-gray-100 dark:border-gray-800 pt-2">
          <span>Total</span>
          <span className="text-primary-600">${total.toFixed(2)}</span>
        </div>
        <button
          onClick={handleOrder}
          disabled={loading}
          className="btn-primary w-full py-3 mt-2 text-base"
        >
          {loading ? "Placing order..." : `Place Order • $${total.toFixed(2)}`}
        </button>
      </div>
    </div>
  );
}
