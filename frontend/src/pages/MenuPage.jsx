import { useEffect, useState } from "react";
import { menuAPI } from "../services/api";
import { useSlug, useBranchSlug } from "../context/SlugContext";
import MenuItemCard from "../components/MenuItemCard";

export default function MenuPage() {
  const slug = useSlug();
  const branchSlug = useBranchSlug();
  const RESTAURANT_SLUG =
    slug || import.meta.env.VITE_RESTAURANT_SLUG || "menu";
  const [items, setItems] = useState([]);
  const [categories, setCategories] = useState([]);
  const [selectedCat, setSelectedCat] = useState("");
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState("");
  const [loading, setLoading] = useState(true);

  const sortOptions = [
    { value: "", label: "Featured" },
    { value: "price_asc", label: "Price: Low to High" },
    { value: "price_desc", label: "Price: High to Low" },
    { value: "name_asc", label: "Name: A → Z" },
    { value: "name_desc", label: "Name: Z → A" },
  ];

  const effectivePrice = (item) => {
    const p = Number(item.price);
    return item.discount_percent > 0
      ? p * (1 - item.discount_percent / 100)
      : p;
  };

  const applySorting = (list) => {
    if (!sort) return list;
    return [...list].sort((a, b) => {
      if (sort === "price_asc") return effectivePrice(a) - effectivePrice(b);
      if (sort === "price_desc") return effectivePrice(b) - effectivePrice(a);
      if (sort === "name_asc")
        return a.name
          .trim()
          .localeCompare(b.name.trim(), undefined, { sensitivity: "base" });
      if (sort === "name_desc")
        return b.name
          .trim()
          .localeCompare(a.name.trim(), undefined, { sensitivity: "base" });
      return 0;
    });
  };

  useEffect(() => {
    menuAPI
      .getPublicCategories(RESTAURANT_SLUG, branchSlug)
      .then((res) => setCategories(res.data))
      .catch(() => {});
  }, [RESTAURANT_SLUG, branchSlug]);

  useEffect(() => {
    setLoading(true);
    const params = {
      category: selectedCat || undefined,
      search: search || undefined,
      branch: branchSlug || undefined,
    };
    menuAPI
      .getPublicItems(RESTAURANT_SLUG, params)
      .then((res) => setItems(res.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [RESTAURANT_SLUG, branchSlug, selectedCat, search]);

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Hero */}
      <div className="relative rounded-3xl overflow-hidden bg-gradient-to-r from-primary-500 to-orange-400 p-8 text-white">
        <div className="relative z-10">
          <h1 className="text-3xl md:text-4xl font-bold mb-2">Our Menu 🍽️</h1>
          <p className="text-orange-100 text-lg">
            Fresh, delicious food made with love
          </p>
        </div>
        <div className="absolute right-6 top-1/2 -translate-y-1/2 text-8xl opacity-20 animate-float">
          🍕
        </div>
      </div>

      {/* Search + Sort */}
      <div className="flex flex-col gap-4 sm:flex-row">
        <div className="relative flex-1">
          <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400">
            🔍
          </span>
          <input
            type="text"
            className="input pl-11 text-base"
            placeholder="Search menu items..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <select
          className="input text-sm w-44 flex-shrink-0"
          value={sort}
          onChange={(e) => setSort(e.target.value)}
        >
          {sortOptions.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </div>

      {/* Categories */}
      <div className="flex flex-wrap gap-2 pb-2">
        {categories.length > 0 && (
  <button
    onClick={() => setSelectedCat("")}
    className={`flex-shrink-0 px-4 py-2 rounded-full text-sm font-medium transition-all
      ${!selectedCat
        ? "bg-primary-500 text-white shadow-md"
        : "bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 border border-gray-200 dark:border-gray-700 hover:border-primary-300"
      }`}
  >
    All
  </button>
)}
        {categories.map((cat) => (
          <button
            key={cat.id}
            onClick={() => setSelectedCat(cat.id)}
            className={`flex-shrink-0 flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-medium transition-all
              ${selectedCat === cat.id ? "bg-primary-500 text-white shadow-md" : "bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 border border-gray-200 dark:border-gray-700 hover:border-primary-300"}`}
          >
            <span>{cat.icon}</span> {cat.name}
          </button>
        ))}
      </div>

      {/* Menu Grid */}
      <section>
        {loading ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
            {[...Array(8)].map((_, i) => (
              <div key={i} className="card h-64 animate-pulse">
                <div className="h-44 bg-gray-200 dark:bg-gray-700 rounded-t-2xl" />
                <div className="p-4 space-y-2">
                  <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-3/4" />
                  <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-1/2" />
                </div>
              </div>
            ))}
          </div>
        ) : (
          (() => {
            const displayItems = applySorting(items);

            return displayItems.length === 0 && (search || selectedCat) ? (
              <div className="text-center py-16 text-gray-400">
                <div className="text-5xl mb-3">🍽️</div>
                <p className="text-lg font-medium">No items found</p>
              </div>
            ) : displayItems.length === 0 ? null : (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {displayItems.map((item) => (
                  <MenuItemCard key={item.id} item={item} />
                ))}
              </div>
            );
          })()
        )}
      </section>
    </div>
  );
}
