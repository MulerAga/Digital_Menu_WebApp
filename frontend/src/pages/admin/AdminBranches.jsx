import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { branchesAPI, authAPI } from "../../services/api";
import { useAuth } from "../../context/AuthContext";
import { useRestaurantPath } from "../../context/SlugContext";
import toast from "react-hot-toast";

const PLAN_COLORS = {
  basic: "bg-blue-100 text-blue-700",
  advanced: "bg-purple-100 text-purple-700",
  premium: "bg-amber-100 text-amber-700",
};

export default function AdminBranches() {
  const { user } = useAuth();
  const restaurantBase = useRestaurantPath();

  const [branches, setBranches] = useState([]);
  const [limits, setLimits] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editBranch, setEditBranch] = useState(null);
  const [form, setForm] = useState({ branch_name: "", address: "", phone: "" });
  const [saving, setSaving] = useState(false);

  const [selectedBranch, setSelectedBranch] = useState(null);
  const [branchUsers, setBranchUsers] = useState([]);
  const [allStaff, setAllStaff] = useState([]);
  const [usersLoading, setUsersLoading] = useState(false);
  const [assigningId, setAssigningId] = useState(null);

  const fetchAll = async () => {
    setLoading(true);
    try {
      const [branchRes, limitsRes] = await Promise.all([
        branchesAPI.list(),
        branchesAPI.getLimits(),
      ]);
      setBranches(branchRes.data);
      setLimits(limitsRes.data);
    } catch (err) {
      console.error("Failed to load branches", err);
      toast.error(
        err.response?.data?.message || err.message || "Failed to load branches",
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAll();
  }, []);

  const openCreate = () => {
    setEditBranch(null);
    setForm({ branch_name: "", address: "", phone: "" });
    setShowForm(true);
  };

  const openEdit = (b) => {
    setEditBranch(b);
    setForm({
      branch_name: b.branch_name,
      address: b.address || "",
      phone: b.phone || "",
    });
    setShowForm(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      if (editBranch) {
        await branchesAPI.update(editBranch.id, form);
        toast.success("Branch updated");
      } else {
        await branchesAPI.create(form);
        toast.success("Branch created");
      }
      setShowForm(false);
      fetchAll();
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to save branch");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (branch) => {
    if (
      !confirm(`Delete branch "${branch.branch_name}"? This cannot be undone.`)
    )
      return;
    try {
      await branchesAPI.delete(branch.id);
      toast.success("Branch deleted");
      fetchAll();
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to delete branch");
    }
  };

  const openUsers = async (branch) => {
    setSelectedBranch(branch);
    setUsersLoading(true);
    try {
      const [buRes, allRes] = await Promise.all([
        branchesAPI.getUsers(branch.id),
        authAPI.getUsers(),
      ]);

      const assignedUsers = buRes.data || [];
      const assignedIds = new Set(assignedUsers.map((u) => u.id));

      setBranchUsers(assignedUsers);
      setAllStaff(
        (allRes.data || []).filter(
          (u) =>
            ["staff", "cashier", "manager"].includes(u.role) &&
            !assignedIds.has(u.id),
        ),
      );
    } catch {
      toast.error("Failed to load users");
    } finally {
      setUsersLoading(false);
    }
  };

  const refreshUsers = async () => {
    if (!selectedBranch) return;
    await openUsers(selectedBranch);
  };

  const handleAssign = async (userId) => {
    if (!selectedBranch) return;
    setAssigningId(userId);
    try {
      await branchesAPI.assignUser(userId, selectedBranch.id);
      toast.success("User assigned to branch");
      await Promise.all([refreshUsers(), fetchAll()]);
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to assign user");
    } finally {
      setAssigningId(null);
    }
  };

  const canAdd =
    limits &&
    (limits.max_branches === null ||
      limits.current_branches < limits.max_branches);

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold">Branch Management 🏪</h1>
          {limits && (
            <div className="flex items-center gap-2 mt-1">
              <span
                className={`badge text-xs px-2 py-0.5 rounded-full capitalize ${PLAN_COLORS[limits.plan?.toLowerCase()] || PLAN_COLORS.basic}`}
              >
                {limits.plan} plan
              </span>
              <span className="text-sm text-gray-500 dark:text-gray-400">
                {limits.current_branches} / {limits.max_branches ?? "∞"}{" "}
                branches
              </span>
            </div>
          )}
        </div>
        <button
          onClick={openCreate}
          disabled={!canAdd}
          title={!canAdd ? `Upgrade your plan to add more branches` : ""}
          className="btn-primary text-sm disabled:opacity-50 disabled:cursor-not-allowed"
        >
          + New Branch
        </button>
      </div>

      {limits && !canAdd && (
        <div className="card p-4 border-l-4 border-amber-400 bg-amber-50 dark:bg-amber-900/20">
          <p className="text-sm text-amber-800 dark:text-amber-300">
            You've reached the branch limit for your{" "}
            <strong>{limits.plan}</strong> plan ({limits.max_branches} branch
            {limits.max_branches === 1 ? "" : "es"}). Upgrade to add more
            branches.
          </p>
        </div>
      )}

      {showForm && (
        <div className="card p-5 animate-slide-up">
          <h2 className="font-semibold mb-4">
            {editBranch ? "Edit Branch" : "New Branch"}
          </h2>
          <form onSubmit={handleSubmit} className="space-y-3">
            <div>
              <label className="block text-sm font-medium mb-1">
                Branch Name *
              </label>
              <input
                className="input"
                required
                value={form.branch_name}
                onChange={(e) =>
                  setForm({ ...form, branch_name: e.target.value })
                }
                placeholder="e.g. Bole"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Address</label>
              <input
                className="input"
                value={form.address}
                onChange={(e) => setForm({ ...form, address: e.target.value })}
                placeholder="e.g. Bole Road, Addis Ababa"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Phone</label>
              <input
                className="input"
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
                placeholder="+251 ..."
              />
            </div>
            <div className="flex gap-2 pt-1">
              <button type="submit" disabled={saving} className="btn-primary">
                {saving ? "Saving..." : editBranch ? "Update" : "Create"}
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

      {loading ? (
        <div className="space-y-3 animate-pulse">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="card h-20" />
          ))}
        </div>
      ) : branches.length === 0 ? (
        <div className="card p-8 text-center text-gray-400">
          <div className="text-4xl mb-2">🏪</div>
          <p>No branches yet. Create your first branch.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {branches.map((branch) => {
            const branchBase = branch.is_main_branch
              ? restaurantBase
              : `${restaurantBase}/branches/${branch.branch_slug}`;
            return (
              <div key={branch.id} className="card p-4 animate-fade-in">
                <div className="flex items-start justify-between gap-4 flex-wrap">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-primary-100 dark:bg-primary-900/30 text-primary-600 flex items-center justify-center text-xl">
                      {branch.is_main_branch ? "🏠" : "🏪"}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-semibold">
                          {branch.branch_name}
                        </span>
                        {!!branch.is_main_branch && (
                          <span className="badge bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 text-xs">
                            Main
                          </span>
                        )}
                      </div>
                      {branch.address && (
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                          📍 {branch.address}
                        </p>
                      )}
                      {branch.phone && (
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                          📞 {branch.phone}
                        </p>
                      )}
                      <p className="text-xs text-primary-500 mt-0.5 font-mono">
                        {branchBase}
                      </p>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2 items-center">
                    <div className="text-right text-xs text-gray-500 dark:text-gray-400 mr-2">
                      <p>{branch.staff_count ?? 0} staff</p>
                    </div>
                    <Link
                      to={`${branchBase}/admin`}
                      className="btn-secondary text-xs py-1.5 px-3"
                    >
                      Dashboard
                    </Link>
                    <button
                      onClick={() => openUsers(branch)}
                      className="btn-secondary text-xs py-1.5 px-3"
                    >
                      Staff
                    </button>
                    <button
                      onClick={() => openEdit(branch)}
                      className="btn-secondary text-xs py-1.5 px-3"
                    >
                      Edit
                    </button>
                    {!branch.is_main_branch && (
                      <button
                        onClick={() => handleDelete(branch)}
                        className="text-xs px-3 py-1.5 rounded-lg bg-red-50 dark:bg-red-900/20 text-red-600 hover:bg-red-100 transition-colors"
                      >
                        Delete
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {selectedBranch && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm animate-fade-in p-4">
          <div className="card p-6 w-full max-w-lg shadow-2xl animate-bounce-in max-h-[80vh] flex flex-col">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-lg">
                Staff of &rarr; {selectedBranch.branch_name}
              </h3>
              <button
                onClick={() => setSelectedBranch(null)}
                className="text-gray-400 hover:text-gray-600 text-xl"
              >
                ✕
              </button>
            </div>

            {usersLoading ? (
              <div className="space-y-2 animate-pulse flex-1">
                {[...Array(3)].map((_, i) => (
                  <div
                    key={i}
                    className="h-10 bg-gray-100 dark:bg-gray-700 rounded"
                  />
                ))}
              </div>
            ) : (
              <div className="overflow-y-auto flex-1 space-y-4">
                <div>
                  <p className="text-sm font-semibold text-gray-500 dark:text-gray-400 mb-2">
                    Assigned ({branchUsers.length})
                  </p>
                  {branchUsers.length === 0 ? (
                    <p className="text-sm text-gray-400">
                      No staff assigned yet
                    </p>
                  ) : (
                    <div className="space-y-2">
                      {branchUsers.map((u) => (
                        <div
                          key={u.id}
                          className="flex items-center justify-between bg-gray-50 dark:bg-gray-800 rounded-lg px-3 py-2"
                        >
                          <div>
                            <p className="text-sm font-medium">{u.name}</p>
                            <p className="text-xs text-gray-400">{u.role}</p>
                          </div>
                          <span
                            className={`text-xs px-2 py-0.5 rounded-full ${u.is_active ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}
                          >
                            {u.is_active ? "Active" : "Inactive"}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {allStaff.map((u) => (
                  <div
                    key={u.id}
                    className="flex items-center justify-between bg-gray-50 dark:bg-gray-800 rounded-lg px-3 py-2"
                  >
                    <div>
                      <p className="text-sm font-medium">{u.name}</p>

                      <p className="text-xs text-gray-400 capitalize">
                        {u.role}
                      </p>

                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        {u.branch_name
                          ? `Assigned to ${u.branch_name}`
                          : "Not assigned to a branch"}
                      </p>
                    </div>

                    <button
                      disabled={assigningId === u.id}
                      onClick={() => handleAssign(u.id)}
                      className="btn-primary text-xs py-1 px-3 disabled:opacity-60"
                    >
                      {assigningId === u.id
                        ? "Moving..."
                        : u.branch_name
                          ? "Move here"
                          : "Assign"}
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
