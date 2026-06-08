import { useCart } from '../context/CartContext';
import { useAuth } from '../context/AuthContext';
import { getImageUrl } from '../services/api';
import { useState } from 'react';

export default function MenuItemCard({ item }) {
  const { add, items } = useCart();
  const { isAdmin, isStaff, isCashier, isManager } = useAuth();
  const isViewOnly = isAdmin || isStaff || isCashier || isManager;
  const [showPop, setShowPop] = useState(false);

  const inCart = items.find((i) => i.id === item.id);
  const discountedPrice = item.discount_percent
    ? (item.price * (1 - item.discount_percent / 100)).toFixed(2)
    : null;

  const handleAdd = () => {
    add(item);
    setShowPop(true);
    setTimeout(() => setShowPop(false), 1200);
  };

  const imgSrc = item.image ? getImageUrl(item.image) : null;

  return (
    <div className="card overflow-hidden group hover:shadow-md transition-all duration-300 hover:-translate-y-1 animate-fade-in">
      {/* Image */}
      <div className="relative h-44 bg-gradient-to-br from-orange-50 to-amber-50 dark:from-gray-800 dark:to-gray-700 overflow-hidden">
        {imgSrc ? (
          <img src={imgSrc} alt={item.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-5xl">
            {item.category_icon ? item.category_icon : '🍴'}
          </div>
        )}
        {/* Badges */}
        <div className="absolute top-2 left-2 flex flex-col gap-1">
          {item.discount_percent > 0 && (
            <span className="badge bg-red-500 text-white text-xs font-bold shadow">
              -{item.discount_percent}%
            </span>
          )}
          {item.is_featured === true || item.is_featured === 1 ? (
            <span className="badge bg-black text-amber-900 text-xs font-bold shadow p-1">
              ⭐ Popular
            </span>
          ) : null}
        </div>
        {!item.available && (
          <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
            <span className="text-white font-bold text-sm bg-black/60 px-3 py-1 rounded-full">Unavailable</span>
          </div>
        )}
        {/* Add to cart pop */}
        {showPop && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <span
              className="bg-black/70 text-white text-sm font-semibold px-3 py-1.5 rounded-full text-center max-w-[80%] animate-cart-pop"
            >
              🛒 {item.name}
            </span>
          </div>
        )}
      </div>

      {/* Info */}
      <div className="p-4">
        <div className="flex items-start justify-between gap-2 mb-1">
          <h3 className="font-semibold text-sm leading-tight line-clamp-2">{item.name}</h3>
        </div>
        {item.description && (
          <p className="text-xs text-gray-500 dark:text-gray-400 line-clamp-2 mb-2">{item.description}</p>
        )}


        {/* Price + Add */}
        <div className="flex items-center justify-between mt-3">
          <div>
            {discountedPrice ? (
              <div className="flex items-center gap-1.5">
                <span className="font-bold text-primary-600">${discountedPrice}</span>
                <span className="text-xs text-gray-400 line-through">${Number(item.price).toFixed(2)}</span>
              </div>
            ) : (
              <span className="font-bold text-primary-600">${Number(item.price).toFixed(2)}</span>
            )}
          </div>
          <button
            onClick={handleAdd}
            disabled={!item.available || isViewOnly}
            className={`flex items-center gap-1 px-3 py-1.5 rounded-xl text-sm font-semibold transition-all active:scale-95
              ${isViewOnly
                ? item.available
                  ? 'bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400 cursor-default'
                  : 'bg-red-100 dark:bg-red-900/30 text-red-500 dark:text-red-400 cursor-default'
                : !item.available
                  ? 'bg-gray-100 dark:bg-gray-800 text-gray-400 dark:text-gray-500 cursor-not-allowed opacity-60'
                  : inCart
                    ? 'bg-primary-100 dark:bg-primary-900/30 text-primary-600 dark:text-primary-400'
                    : 'btn-primary'
              }`}
          >
            {isViewOnly
              ? item.available ? '✓ Available' : '✕ Unavailable'
              : !item.available ? 'Unavailable'
              : inCart ? `✓ ${inCart.qty}` : '+ Add'
            }
          </button>
        </div>
      </div>
    </div>
  );
}
