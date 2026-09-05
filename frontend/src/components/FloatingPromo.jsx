import { useEffect, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { menuAPI, getImageUrl } from "../services/api";
import { useCart } from "../context/CartContext";
import { useAuth } from "../context/AuthContext";
import { useSlug, useBranchSlug, useBasePath } from "../context/SlugContext";

export default function FloatingPromo() {
  const [promos, setPromos] = useState([]);
  const [current, setCurrent] = useState(0);
  const [visible, setVisible] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [addedIds, setAddedIds] = useState(new Set());
  const { add } = useCart();
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const slug = useSlug();
  const branchSlug = useBranchSlug();
  const base = useBasePath();

  // Only show on the menu (index) page of the current restaurant
  const restaurantSlug = slug || import.meta.env.VITE_RESTAURANT_SLUG;
  const expectedPath = branchSlug
    ? `/${slug}/branches/${branchSlug}`
    : `/${slug}`;
  const isMenuPage =
    location.pathname === expectedPath ||
    location.pathname === `${expectedPath}/`;

  const isCustomer = !user || user.role === "customer";

  useEffect(() => {
    if (!restaurantSlug) return;
    menuAPI
      .getPublicPromotions(restaurantSlug, branchSlug || null)
      .then((res) => {
        const data = Array.isArray(res.data) ? res.data : [];
        if (data.length) {
          setPromos(data);
          setTimeout(() => setVisible(true), 500);
        }
      })
      .catch(() => setPromos([]));
  }, [restaurantSlug, branchSlug]);

  useEffect(() => {
    if (!promos.length || dismissed) return;
    const interval = setInterval(() => {
      setCurrent((c) => (c + 1) % promos.length);
    }, 6000);
    return () => clearInterval(interval);
  }, [promos, dismissed]);

  if (!visible || dismissed || !promos.length || !isMenuPage) return null;

  const promo = promos[current];
  const discountedPrice = promo.discount_percent
    ? (promo.price * (1 - promo.discount_percent / 100)).toFixed(2)
    : null;

  const handleOrderNow = () => {
    if (!isCustomer) {
      navigate(base || "/");
      return;
    }
    add(promo);
    setAddedIds((prev) => new Set(prev).add(promo.id));
    setTimeout(() => {
      if (promos.length > 1) {
        setCurrent((c) => (c + 1) % promos.length);
      } else {
        setDismissed(true);
      }
    }, 2000);
  };

  const buttonLabel = !isCustomer
    ? "Discounted"
    : addedIds.has(promo.id)
      ? "✓ Added"
      : "Order Now";

  return (
    <div className="fixed bottom-6 right-6 z-50 animate-bounce-in max-w-56 w-full">
      <div className="card shadow-2xl border-2 border-primary-200 dark:border-primary-800 overflow-hidden">
        <div className="bg-gradient-to-r from-primary-500 to-orange-400 px-4 py-2 flex items-center justify-between">
          <div className="flex items-center gap-2 text-white">
            <span className="animate-float text-lg">
              {promo.discount_percent ? "🔥" : promo.is_featured ? "⭐" : "💡"}
            </span>
            <span className="text-sm font-bold">
              {promo.discount_percent
                ? `${promo.discount_percent}% OFF!`
                : promo.is_featured
                  ? "Featured"
                  : "Recommended"}
            </span>
          </div>
          <button
            onClick={() => setDismissed(true)}
            className="text-white/80 hover:text-white text-lg leading-none"
            aria-label="Dismiss"
          >
            ×
          </button>
        </div>

        <div className="p-3 flex gap-3 items-center">
          {promo.image ? (
            <img
              src={getImageUrl(promo.image)}
              alt={promo.name}
              className="w-16 h-16 rounded-xl object-cover flex-shrink-0"
            />
          ) : (
            <div className="w-16 h-16 rounded-xl bg-primary-100 dark:bg-primary-900/30 flex items-center justify-center text-3xl flex-shrink-0">
              {promo.category_icon || "🍴"}
            </div>
          )}
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-sm truncate">{promo.name}</p>
            <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
              {promo.category_name}
            </p>
            <div className="flex items-center gap-2 mt-1">
              {discountedPrice ? (
                <>
                  <span className="text-primary-600 font-bold text-sm">
                    ${discountedPrice}
                  </span>
                  <span className="text-gray-400 line-through text-xs">
                    ${Number(promo.price).toFixed(2)}
                  </span>
                </>
              ) : (
                <span className="text-primary-600 font-bold text-sm">
                  ${Number(promo.price).toFixed(2)}
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="px-3 pb-3 flex gap-2">
          <button
            onClick={handleOrderNow}
            className="flex-1 btn-primary text-xs py-1.5"
          >
            {buttonLabel}
          </button>
          {promos.length > 1 && (
            <button
              onClick={() => setCurrent((c) => (c + 1) % promos.length)}
              className="btn-secondary text-xs py-1.5 px-3"
            >
              Next →
            </button>
          )}
        </div>

        {promos.length > 1 && (
          <div className="flex justify-center gap-1 pb-2">
            {promos.map((_, i) => (
              <button
                key={i}
                onClick={() => setCurrent(i)}
                className={`w-1.5 h-1.5 rounded-full transition-all ${i === current ? "bg-primary-500 w-3" : "bg-gray-300 dark:bg-gray-600"}`}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
