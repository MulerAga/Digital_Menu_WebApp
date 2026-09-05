import { useEffect, useState, useRef } from "react";
import { menuAPI, getImageUrl } from "../../services/api";
import { useBranchSlug } from "../../context/SlugContext";
import toast from "react-hot-toast";

const EMPTY_FORM = {
  name: "",
  description: "",
  price: "",
  category_id: "",
  available: true,
  is_featured: false,
  discount_percent: 0,
};

export default function AdminMenu() {
  const [items, setItems] = useState([]);
  const [categories, setCategories] = useState([]);
  const [form, setForm] = useState(EMPTY_FORM);
  const [imageFile, setImageFile] = useState(null);
  const [imageObjectUrl, setImageObjectUrl] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const [existingImage, setExistingImage] = useState(null);
  const [editId, setEditId] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [catForm, setCatForm] = useState({ name: "", icon: "" });
  const [showCatForm, setShowCatForm] = useState(false);
  const catListRef = useRef(null);
  const [deleteCatModal, setDeleteCatModal] = useState(null);
  const [editingCat, setEditingCat] = useState(null);
  const [tableSearch, setTableSearch] = useState("");
  const [tableCatFilter, setTableCatFilter] = useState("");
  const [unsplashOpen, setUnsplashOpen] = useState(false);
  const [unsplashResults, setUnsplashResults] = useState([]);
  const [unsplashLoading, setUnsplashLoading] = useState(false);
  const [nameError, setNameError] = useState(false);
  const dragItem = useRef(null);
  const dragOver = useRef(null);

  // ── Branch context from URL (not localStorage) ──────────────────────────
  const branchSlug = useBranchSlug();

  // ── Fetch items & categories scoped to current branch ───────────────────
  const fetchAll = () =>
    Promise.all([
      menuAPI.getItems({ branch: branchSlug }).then((r) => setItems(r.data)),
      menuAPI.getCategories(branchSlug).then((r) => setCategories(r.data)),
    ]);

  // Re-fetch whenever the admin switches branches
  useEffect(() => {
    fetchAll();
  }, [branchSlug]);

  // Create/revoke object URL when imageFile changes
  useEffect(() => {
    if (!imageFile) {
      setImageObjectUrl(null);
      return;
    }
    const url = URL.createObjectURL(imageFile);
    setImageObjectUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [imageFile]);

  const handleDragStart = (index) => {
    dragItem.current = index;
  };
  const handleDragEnter = (index) => {
    dragOver.current = index;
  };

  const handleDragEnd = async () => {
    const reordered = [...categories];
    const [moved] = reordered.splice(dragItem.current, 1);
    reordered.splice(dragOver.current, 0, moved);
    dragItem.current = null;
    dragOver.current = null;
    setCategories(reordered);
    try {
      await menuAPI.reorderCategories(
        reordered.map((c) => c.id),
        branchSlug,
      ); // ← branchSlug
      toast.success("Category order saved");
    } catch {
      toast.error("Failed to save order");
      fetchAll();
    }
  };

  const defaultCategoryId = categories[0]?.id || "";

  const openEdit = (item) => {
    setForm({
      name: item.name,
      description: item.description || "",
      price: item.price,
      category_id: item.category_id || "",
      available: item.available,
      is_featured: item.is_featured,
      discount_percent: item.discount_percent || 0,
    });
    setEditId(item.id);
    setImageFile(null);
    setImagePreview(item.image || null);
    setExistingImage(item.image || null);
    setShowForm(true);
    setShowCatForm(false);
  };

  const searchUnsplash = async () => {
    const query = form.name.trim();
    if (!query) {
      setNameError(true);
      setTimeout(() => setNameError(false), 2000);
      return;
    }
    setUnsplashLoading(true);
    setUnsplashOpen(true);
    try {
      const key = import.meta.env.VITE_UNSPLASH_ACCESS_KEY;
      const res = await fetch(
        `https://api.unsplash.com/search/photos?query=${encodeURIComponent(query)}&per_page=12&orientation=landscape&client_id=${key}`,
      );
      const data = await res.json();
      setUnsplashResults(data.results || []);
    } catch {
      toast.error("Failed to fetch images");
    } finally {
      setUnsplashLoading(false);
    }
  };

  const pickUnsplash = (photo) => {
    setImagePreview(photo.urls.regular);
    setImageFile(null);
    setUnsplashOpen(false);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const fd = new FormData();
      Object.entries(form).forEach(([k, v]) => {
        fd.append(k, typeof v === "boolean" ? String(v) : v);
      });
      if (imageFile) {
        fd.append("image", imageFile);
      } else if (imagePreview && imagePreview !== existingImage) {
        const blob = await fetch(imagePreview).then((r) => r.blob());
        fd.append(
          "image",
          new File([blob], "unsplash.jpg", { type: blob.type }),
        );
      }
      // ── Pass branchSlug so the backend scopes to the correct branch ──
      if (editId) await menuAPI.updateItem(editId, fd, branchSlug);
      else await menuAPI.createItem(fd, branchSlug);

      toast.success(editId ? "Item updated" : "Item created");
      setShowForm(false);
      setForm(EMPTY_FORM);
      setEditId(null);
      setImageFile(null);
      setImagePreview(null);
      setExistingImage(null);
      fetchAll();
    } catch (err) {
      toast.error(err.response?.data?.message || "Error saving item");
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id) => {
    if (!confirm("Delete this item?")) return;
    await menuAPI.deleteItem(id, branchSlug); // ← branchSlug
    toast.success("Item deleted");
    fetchAll();
  };

  const toggleAvailable = async (item) => {
    const fd = new FormData();
    Object.entries({
      name: item.name,
      description: item.description || "",
      price: item.price,
      category_id: item.category_id || "",
      is_featured: String(item.is_featured),
      discount_percent: item.discount_percent || 0,
      available: String(!item.available),
    }).forEach(([k, v]) => fd.append(k, v));
    await menuAPI.updateItem(item.id, fd, branchSlug); // ← branchSlug
    fetchAll();
  };

  const handleAddCategory = async (e) => {
    e.preventDefault();
    try {
      await menuAPI.createCategory(catForm, branchSlug); // ← branchSlug
      toast.success("Category added");
      setCatForm({ name: "", icon: "" });
      await fetchAll();
      setTimeout(
        () =>
          catListRef.current?.scrollIntoView({
            behavior: "smooth",
            block: "nearest",
          }),
        100,
      );
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to add category");
    }
  };

  const handleDeleteCategory = async (deleteItems) => {
    if (!deleteCatModal) return;
    try {
      await menuAPI.deleteCategory(deleteCatModal.id, deleteItems, branchSlug); // ← branchSlug
      toast.success("Category deleted");
      setDeleteCatModal(null);
      fetchAll();
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to delete category");
    }
  };

  const handleUpdateCategory = async (e) => {
    e.preventDefault();
    try {
      await menuAPI.updateCategory(
        editingCat.id,
        { name: editingCat.name, icon: editingCat.icon },
        branchSlug, // ← branchSlug
      );
      toast.success("Category updated");
      setEditingCat(null);
      fetchAll();
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to update category");
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Menu Management 🍕</h1>
        <div className="flex gap-2">
          <button
            onClick={() => {
              setShowCatForm(!showCatForm);
              setShowForm(false);
            }}
            className="btn-secondary text-sm"
          >
            + Category
          </button>
          <button
            onClick={() => {
              if (showForm && !editId) {
                setShowForm(false);
              } else {
                setShowForm(true);
                setEditId(null);
                setImageFile(null);
                setImagePreview(null);
                setExistingImage(null);
                setForm({ ...EMPTY_FORM, category_id: defaultCategoryId });
                setShowCatForm(false);
              }
            }}
            className="btn-primary text-sm"
          >
            + Add Item
          </button>
        </div>
      </div>

      {/* Category Form */}
      {showCatForm && (
        <div className="card p-4 animate-slide-up">
          <form onSubmit={handleAddCategory} className="flex gap-3 items-end">
            <div className="flex-1">
              <label className="block text-sm font-medium mb-1">
                Category Name
              </label>
              <input
                className="input"
                required
                value={catForm.name}
                onChange={(e) =>
                  setCatForm({ ...catForm, name: e.target.value })
                }
                placeholder="e.g. Main Courses"
              />
            </div>
            <div className="w-24">
              <label className="block text-sm font-medium mb-1">Icon</label>
              <input
                className="input"
                value={catForm.icon}
                onChange={(e) =>
                  setCatForm({ ...catForm, icon: e.target.value })
                }
                placeholder=""
              />
            </div>
            <button type="submit" className="btn-primary">
              Add
            </button>
            <button
              type="button"
              onClick={() => setShowCatForm(false)}
              className="btn-secondary"
            >
              Cancel
            </button>
          </form>

          {categories.length > 0 && (
            <div
              ref={catListRef}
              className="mt-4 border-t border-gray-100 dark:border-gray-800 pt-4"
            >
              <p className="text-sm font-medium mb-2 text-gray-500 dark:text-gray-400">
                Existing Categories{" "}
                <span className="text-xs font-normal">
                  (drag to reorder or type a number + Enter)
                </span>
              </p>
              <div className="flex flex-col gap-2">
                {categories.map((cat, index) => (
                  <div
                    key={cat.id}
                    draggable={!editingCat}
                    onDragStart={() => handleDragStart(index)}
                    onDragEnter={() => handleDragEnter(index)}
                    onDragEnd={handleDragEnd}
                    onDragOver={(e) => e.preventDefault()}
                  >
                    {editingCat?.id === cat.id ? (
                      <form
                        onSubmit={handleUpdateCategory}
                        className="flex gap-2 items-center"
                      >
                        <input
                          className="input w-16 text-center px-2"
                          value={editingCat.icon}
                          onChange={(e) =>
                            setEditingCat({
                              ...editingCat,
                              icon: e.target.value,
                            })
                          }
                          placeholder="🍣"
                        />
                        <input
                          className="input flex-1"
                          required
                          value={editingCat.name}
                          onChange={(e) =>
                            setEditingCat({
                              ...editingCat,
                              name: e.target.value,
                            })
                          }
                        />
                        <button
                          type="submit"
                          className="btn-primary text-xs py-1.5 px-3"
                        >
                          Save
                        </button>
                        <button
                          type="button"
                          onClick={() => setEditingCat(null)}
                          className="btn-secondary text-xs py-1.5 px-3"
                        >
                          Cancel
                        </button>
                      </form>
                    ) : (
                      <div className="flex items-center justify-between bg-gray-50 dark:bg-gray-800 px-3 py-2 rounded-xl cursor-grab active:cursor-grabbing">
                        <span className="flex items-center gap-2 text-sm font-medium">
                          <span className="text-gray-300 dark:text-gray-600 select-none">
                            ⠿
                          </span>
                          <span>{cat.icon}</span>
                          {cat.name}
                        </span>
                        <div className="flex items-center gap-2">
                          <input
                            type="number"
                            min="1"
                            max={categories.length}
                            defaultValue={index + 1}
                            key={`${cat.id}-${index}`}
                            onDragStart={(e) => e.stopPropagation()}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") {
                                const newPos = Math.min(
                                  Math.max(parseInt(e.target.value) - 1, 0),
                                  categories.length - 1,
                                );
                                const reordered = [...categories];
                                reordered.splice(index, 1);
                                reordered.splice(newPos, 0, cat);
                                setCategories(reordered);
                                menuAPI
                                  .reorderCategories(
                                    reordered.map((c) => c.id),
                                    branchSlug,
                                  ) // ← branchSlug
                                  .then(() => toast.success("Order saved"))
                                  .catch(() => {
                                    toast.error("Failed to save order");
                                    fetchAll();
                                  });
                              }
                            }}
                            className="w-12 text-center text-xs border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-900 py-1 px-1 focus:outline-none focus:ring-1 focus:ring-primary-400"
                          />
                          <button
                            onClick={() =>
                              setEditingCat({
                                id: cat.id,
                                name: cat.name,
                                icon: cat.icon,
                              })
                            }
                            className="text-xs btn-secondary py-1 px-2"
                          >
                            Edit
                          </button>
                          <button
                            onClick={() =>
                              setDeleteCatModal({ id: cat.id, name: cat.name })
                            }
                            className="text-xs px-2 py-1 rounded-lg bg-red-50 dark:bg-red-900/20 text-red-600 hover:bg-red-100 transition-colors"
                          >
                            Delete
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Item Form */}
      {showForm && (
        <div className="card p-6 animate-slide-up">
          <h2 className="font-semibold mb-4">
            {editId ? "Edit Item" : "New Menu Item"}
          </h2>
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Name *</label>
              <input
                className={`input transition-all ${nameError ? "border-red-400 ring-2 ring-red-200 animate-bounce-in" : ""}`}
                required
                value={form.name}
                onChange={(e) => {
                  setForm({ ...form, name: e.target.value });
                  setNameError(false);
                }}
                placeholder={nameError ? "⚠️ Enter a food name first" : ""}
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Price *</label>
              <input
                className="input"
                type="number"
                step="0.01"
                min="0"
                required
                value={form.price}
                onChange={(e) => setForm({ ...form, price: e.target.value })}
                onWheel={(e) => e.target.blur()}
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Category</label>
              <select
                className="input"
                value={form.category_id}
                onChange={(e) =>
                  setForm({ ...form, category_id: e.target.value })
                }
              >
                <option value="">Uncategorized</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.icon} {c.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">
                Item Image
              </label>
              <div className="flex gap-4 p-4 rounded-2xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
                <div className="flex-shrink-0 w-32 h-32 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 flex flex-col items-center justify-center overflow-hidden">
                  {imageObjectUrl || imagePreview ? (
                    <img
                      src={imageObjectUrl || getImageUrl(imagePreview)}
                      alt="preview"
                      className="w-full h-full object-cover"
                      onError={(e) => {
                        e.target.style.display = "none";
                      }}
                    />
                  ) : (
                    <>
                      <svg
                        className="w-10 h-10 text-gray-300 dark:text-gray-600 mb-1"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <rect
                          x="3"
                          y="3"
                          width="18"
                          height="18"
                          rx="2"
                          strokeWidth="1.5"
                        />
                        <circle cx="8.5" cy="8.5" r="1.5" strokeWidth="1.5" />
                        <path strokeWidth="1.5" d="M21 15l-5-5L5 21" />
                      </svg>
                      <span className="text-xs text-gray-400 dark:text-gray-500">
                        No image selected
                      </span>
                    </>
                  )}
                </div>
                <div className="flex-1 flex flex-col gap-2 justify-center">
                  <div className="relative">
                    <input
                      type="text"
                      className="input text-sm pr-8"
                      placeholder="Paste image url here..."
                      value={imageFile ? imageFile.name : imagePreview || ""}
                      readOnly={!!imageFile}
                      onChange={(e) => {
                        setImagePreview(e.target.value);
                        setImageFile(null);
                      }}
                    />
                    {(imagePreview || imageFile) && (
                      <button
                        type="button"
                        onClick={() => {
                          setImagePreview(null);
                          setImageFile(null);
                        }}
                        className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 hover:text-red-500 transition-colors text-xs"
                      >
                        ✕
                      </button>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <label className="flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-xl border-2 border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 text-sm font-semibold hover:bg-white dark:hover:bg-gray-800 transition-colors cursor-pointer">
                      ⬆️ Upload Local
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(e) => {
                          setImageFile(e.target.files[0]);
                          setImagePreview(null);
                        }}
                      />
                    </label>
                    <button
                      type="button"
                      onClick={searchUnsplash}
                      className="flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-xl border-2 border-primary-400 text-primary-600 dark:text-primary-400 text-sm font-semibold hover:bg-primary-50 dark:hover:bg-primary-900/20 transition-colors"
                    >
                      🔍 Search Online
                    </button>
                  </div>
                </div>
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">
                Description
              </label>
              <textarea
                className="input resize-none"
                rows={2}
                value={form.description}
                onChange={(e) =>
                  setForm({ ...form, description: e.target.value })
                }
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">
                Discount %
              </label>
              <input
                className="input"
                type="number"
                min="0"
                max="100"
                value={form.discount_percent}
                onChange={(e) =>
                  setForm({ ...form, discount_percent: e.target.value })
                }
                onWheel={(e) => e.target.blur()}
              />
            </div>
            <div className="flex items-center gap-6">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.is_featured}
                  onChange={(e) =>
                    setForm({ ...form, is_featured: e.target.checked })
                  }
                  className="w-4 h-4 accent-primary-500"
                />
                <span className="text-sm">Popular ⭐</span>
              </label>
            </div>
            <div className="flex gap-3 pt-2">
              <button type="submit" disabled={loading} className="btn-primary">
                {loading ? "Saving..." : editId ? "Update Item" : "Create Item"}
              </button>
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="btn-secondary"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Items Table */}
      <div className="card overflow-hidden">
        <div className="flex gap-3 p-4 border-b border-gray-100 dark:border-gray-800">
          <div className="relative flex-1">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">
              🔍
            </span>
            <input
              type="text"
              className="input pl-9 text-sm"
              placeholder="Search by food name..."
              value={tableSearch}
              onChange={(e) => setTableSearch(e.target.value)}
            />
          </div>
          <select
            className="input text-sm sm:w-48"
            value={tableCatFilter}
            onChange={(e) => setTableCatFilter(e.target.value)}
          >
            <option value="">All Categories</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.icon} {c.name}
              </option>
            ))}
            <option value="null">Uncategorized</option>
          </select>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 dark:bg-gray-800 text-gray-500 dark:text-gray-400">
              <tr>
                {[
                  "Item",
                  "Category",
                  "Price",
                  "Discount",
                  "Status",
                  "Actions",
                ].map((h) => (
                  <th key={h} className="px-4 py-3 text-left font-medium">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
              {items
                .filter((item) => {
                  const matchesName =
                    !tableSearch ||
                    item.name.toLowerCase().includes(tableSearch.toLowerCase());
                  const matchesCat =
                    !tableCatFilter ||
                    (tableCatFilter === "null"
                      ? !item.category_id
                      : String(item.category_id) === String(tableCatFilter));
                  return matchesName && matchesCat;
                })
                .map((item) => (
                  <tr
                    key={item.id}
                    className="hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors"
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        {item.image ? (
                          <img
                            src={getImageUrl(item.image)}
                            alt={item.name}
                            className="w-10 h-10 rounded-lg object-cover"
                          />
                        ) : (
                          <div className="w-10 h-10 rounded-lg bg-orange-50 dark:bg-gray-700 flex items-center justify-center text-xl">
                            {item.category_icon ? item.category_icon : "🍴"}
                          </div>
                        )}
                        <div>
                          <p className="font-medium">{item.name}</p>
                          {(item.is_featured === true ||
                            item.is_featured === 1) && (
                            <span className="text-xs text-amber-500">
                              ⭐ Popular
                            </span>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-gray-500 dark:text-gray-400">
                      {item.category_name || "Uncategorized"}
                    </td>
                    <td className="px-4 py-3 font-semibold">
                      ${Number(item.price).toFixed(2)}
                    </td>
                    <td className="px-4 py-3">
                      {item.discount_percent > 0 ? (
                        <span className="badge bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400">
                          -{item.discount_percent}%
                        </span>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => toggleAvailable(item)}
                        className={`badge cursor-pointer transition-all hover:opacity-80 active:scale-95 ${
                          item.available
                            ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                            : "bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400"
                        }`}
                      >
                        {item.available ? "Available" : "Unavailable"}
                      </button>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-2">
                        <button
                          onClick={() => openEdit(item)}
                          className="text-xs btn-secondary py-1 px-2"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => handleDelete(item.id)}
                          className="text-xs px-2 py-1 rounded-lg bg-red-50 dark:bg-red-900/20 text-red-600 hover:bg-red-100 transition-colors"
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
          {!items.length && (
            <div className="text-center py-12 text-gray-400">
              No menu items yet. Add your first item!
            </div>
          )}
          {items.length > 0 &&
            items.filter((item) => {
              const matchesName =
                !tableSearch ||
                item.name.toLowerCase().includes(tableSearch.toLowerCase());
              const matchesCat =
                !tableCatFilter ||
                (tableCatFilter === "null"
                  ? !item.category_id
                  : String(item.category_id) === String(tableCatFilter));
              return matchesName && matchesCat;
            }).length === 0 && (
              <div className="text-center py-12 text-gray-400">
                No items match your search.
              </div>
            )}
        </div>
      </div>

      {/* Unsplash Image Picker */}
      {unsplashOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm animate-fade-in">
          <div className="card p-5 w-full max-w-2xl mx-4 shadow-2xl animate-bounce-in max-h-[80vh] flex flex-col">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-lg">
                Search Online — "{form.name}"
              </h3>
              <button
                onClick={() => setUnsplashOpen(false)}
                className="text-gray-400 hover:text-gray-600 text-xl"
              >
                ✕
              </button>
            </div>
            {unsplashLoading ? (
              <div className="grid grid-cols-3 gap-3 overflow-y-auto">
                {[...Array(6)].map((_, i) => (
                  <div
                    key={i}
                    className="h-32 rounded-xl bg-gray-200 dark:bg-gray-700 animate-pulse"
                  />
                ))}
              </div>
            ) : unsplashResults.length === 0 ? (
              <p className="text-center text-gray-400 py-8">No results found</p>
            ) : (
              <div className="grid grid-cols-3 gap-3 overflow-y-auto">
                {unsplashResults.map((photo) => (
                  <button
                    key={photo.id}
                    type="button"
                    onClick={() => pickUnsplash(photo)}
                    className="relative group rounded-xl overflow-hidden h-32 focus:outline-none focus:ring-2 focus:ring-primary-500"
                  >
                    <img
                      src={photo.urls.small}
                      alt={photo.alt_description}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                    />
                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors flex items-center justify-center">
                      <span className="opacity-0 group-hover:opacity-100 text-white text-xs font-semibold bg-black/50 px-2 py-1 rounded-full transition-opacity">
                        Select
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            )}
            <p className="text-xs text-gray-400 mt-3 text-center">
              Photos from{" "}
              <a
                href="https://unsplash.com"
                target="_blank"
                rel="noreferrer"
                className="underline"
              >
                Unsplash
              </a>
            </p>
          </div>
        </div>
      )}

      {/* Delete Category Modal */}
      {deleteCatModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm animate-fade-in">
          <div className="card p-6 w-full max-w-sm mx-4 shadow-2xl animate-bounce-in">
            <div className="text-center mb-5">
              <div className="text-4xl mb-3">🗂️</div>
              <h3 className="font-bold text-lg">
                Delete "{deleteCatModal.name}"?
              </h3>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                What should happen to the items in this category?
              </p>
            </div>
            <div className="space-y-3">
              <button
                onClick={() => handleDeleteCategory(false)}
                className="w-full flex items-center gap-3 p-3 rounded-xl border-2 border-gray-200 dark:border-gray-700 hover:border-primary-400 hover:bg-primary-50 dark:hover:bg-primary-900/20 transition-all text-left"
              >
                <span className="text-2xl">📦</span>
                <div>
                  <p className="font-semibold text-sm">
                    Keep items (Uncategorized)
                  </p>
                  <p className="text-xs text-gray-400">
                    Items will remain but have no category
                  </p>
                </div>
              </button>
              <button
                onClick={() => handleDeleteCategory(true)}
                className="w-full flex items-center gap-3 p-3 rounded-xl border-2 border-red-200 dark:border-red-800 hover:border-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-all text-left"
              >
                <span className="text-2xl">🗑️</span>
                <div>
                  <p className="font-semibold text-sm text-red-600">
                    Delete all items too
                  </p>
                  <p className="text-xs text-gray-400">
                    Permanently removes all items in this category
                  </p>
                </div>
              </button>
              <button
                onClick={() => setDeleteCatModal(null)}
                className="w-full btn-secondary py-2 text-sm"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
