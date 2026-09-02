import { useEffect, useState } from "react";
import { authAPI, approvalsAPI } from "../../services/api";
import { useAuth } from "../../context/AuthContext";
import toast from "react-hot-toast";


const ROLE_STYLES = {
  admin:
    "bg-red-50 text-red-700 border border-red-200 dark:bg-red-950/40 dark:text-red-300 dark:border-red-900/50",
  manager:
    "bg-purple-50 text-purple-700 border border-purple-200 dark:bg-purple-950/40 dark:text-purple-300 dark:border-purple-900/50",
  cashier:
    "bg-amber-50 text-amber-700 border border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-900/50",
  staff:
    "bg-blue-50 text-blue-700 border border-blue-200 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-900/50",
  customer:
    "bg-gray-50 text-gray-700 border border-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:border-gray-700",
};


export default function AdminUsers() {
  const [users, setUsers] = useState([]);
  const [pendingUsers, setPendingUsers] = useState([]);
  const [activeTab, setActiveTab] = useState("directory"); // "directory" or "pending"
  const [loading, setLoading] = useState(true);
  const [loadingPending, setLoadingPending] = useState(false);
  const [rejectingUserId, setRejectingUserId] = useState(null);
  const [rejectionReason, setRejectionReason] = useState("");
  const [submittingAction, setSubmittingAction] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");


  const { user: me, isAdmin } = useAuth();


  const fetchUsers = async () => {
    try {
      setLoading(true);
      const res = await authAPI.getUsers();
      // Only display staff-level accounts for this restaurant
      setUsers(
        res.data.filter((u) => {
          // Admin sees all staff
          if (isAdmin) {
            return ["manager", "cashier", "staff"].includes(u.role);
          }
        }),
      );
    } catch {
      toast.error("Failed to load staff list");
    } finally {
      setLoading(false);
    }
  };


  const fetchPending = async () => {
    if (!isAdmin) return;
    try {
      setLoadingPending(true);
      const res = await approvalsAPI.getPendingApprovals();
      setPendingUsers(res.data);
    } catch {
      toast.error("Failed to load pending approvals");
    } finally {
      setLoadingPending(false);
    }
  };


  useEffect(() => {
    fetchUsers();
    if (isAdmin) {
      fetchPending();
    } else {
      setActiveTab("directory"); // Enforce managers only see directory
    }
  }, [isAdmin]);


  // Filter users based on search query (name, email, or phone)
  const filteredUsers = users.filter((u) => {
    if (!searchQuery.trim()) return true;
    const query = searchQuery.toLowerCase().trim();
    return (
      u.name?.toLowerCase().includes(query) ||
      u.email?.toLowerCase().includes(query) ||
      u.phone?.toLowerCase().includes(query)
    );
  });


  const handleRoleChange = async (id, role) => {
    try {
      await authAPI.updateRole(id, role);
      toast.success("Role updated successfully");
      fetchUsers();
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to update role");
    }
  };


  const handleToggleActive = async (id, currentState) => {
    try {
      await authAPI.toggleActive(id);
      toast.success(currentState ? "Staff deactivated" : "Staff activated");
      fetchUsers();
    } catch {
      toast.error("Failed to update staff status");
    }
  };


  const handleDelete = async (id) => {
    if (!confirm("Are you sure you want to remove this staff member?")) return;
    try {
      await authAPI.deleteUser(id);
      toast.success("Staff member removed");
      fetchUsers();
    } catch {
      toast.error("Failed to remove staff member");
    }
  };


  const handleApprove = async (userId) => {
    try {
      setSubmittingAction(true);
      await approvalsAPI.approveStaff(userId);
      toast.success("Staff member approved and activated!");
      fetchPending();
      fetchUsers();
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to approve staff");
    } finally {
      setSubmittingAction(false);
    }
  };


  const handleRejectSubmit = async (e) => {
    e.preventDefault();
    if (!rejectingUserId) return;
    try {
      setSubmittingAction(true);
      await approvalsAPI.rejectStaff(rejectingUserId, rejectionReason);
      toast.success("Staff application rejected");
      setRejectingUserId(null);
      setRejectionReason("");
      fetchPending();
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to reject staff");
    } finally {
      setSubmittingAction(false);
    }
  };


  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">
            Staff Management 👥
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            {isAdmin
              ? "Manage active staff members, adjust roles, and approve new registration requests."
              : "View active staff directory, toggle statuses, and update employee roles."}
          </p>
        </div>


        {/* Tab Switcher */}
        {isAdmin && (
          <div className="flex bg-gray-100 dark:bg-gray-800 p-1 rounded-xl w-fit border border-gray-200/50 dark:border-gray-700/50">
            <button
              onClick={() => setActiveTab("directory")}
              className={`px-4 py-2 text-sm font-semibold rounded-lg transition-all duration-200 ${
                activeTab === "directory"
                  ? "bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm"
                  : "text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
              }`}
            >
              Approved ({filteredUsers.length})
            </button>
            <button
              onClick={() => setActiveTab("pending")}
              className={`relative px-4 py-2 text-sm font-semibold rounded-lg transition-all duration-200 ${
                activeTab === "pending"
                  ? "bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm"
                  : "text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
              }`}
            >
              Pending Approvals
              {pendingUsers.length > 0 && (
                <span className="absolute -top-1 -right-1 bg-primary-500 text-white text-[10px] w-5 h-5 rounded-full flex items-center justify-center font-bold border-2 border-white dark:border-gray-800 animate-pulse">
                  {pendingUsers.length}
                </span>
              )}
            </button>
          </div>
        )}
      </div>


      {/* Search Input (Admin only, Directory tab only) */}
      {isAdmin && activeTab === "directory" && (
        <div className="relative">
          <input
            type="text"
            placeholder="Search by name, email, or phone..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="input w-full pl-10 pr-4 py-2 text-sm border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950"
          />
          <svg
            className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
            />
          </svg>
        </div>
      )}


      {activeTab === "directory" ? (
        /* TAB 1: STAFF DIRECTORY */
        <div className="card overflow-hidden border border-gray-200/60 dark:border-gray-800/80 shadow-md">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 dark:bg-gray-800/50 border-b border-gray-200 dark:border-gray-800 text-gray-500 dark:text-gray-400">
                <tr>
                  {["Staff Member", "Role", "Status", "Joined", "Actions"].map(
                    (h) => (
                      <th
                        key={h}
                        className="px-5 py-4 text-left font-semibold uppercase tracking-wider text-xs"
                      >
                        {h}
                      </th>
                    ),
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800/60">
                {loading ? (
                  [...Array(4)].map((_, i) => (
                    <tr key={i}>
                      <td colSpan={5} className="px-5 py-4">
                        <div className="h-5 bg-gray-100 dark:bg-gray-800 rounded animate-pulse w-full" />
                      </td>
                    </tr>
                  ))
                ) : filteredUsers.length === 0 ? (
                  <tr>
                    <td
                      colSpan={5}
                      className="px-5 py-12 text-center text-gray-500"
                    >
                      <p className="text-lg font-medium">
                        {searchQuery.trim()
                          ? "No staff members match your search."
                          : "No staff members found."}
                      </p>
                      <p className="text-sm text-gray-400 mt-1">
                        {searchQuery.trim()
                          ? "Try a different name, email, or phone number."
                          : "Register staff members to see them in the directory."}
                      </p>
                    </td>
                  </tr>
                ) : (
                  filteredUsers.map((u) => {
                    const isCurrentUserAdmin = u.role === "admin";
                    const isSelf = u.id === me?.id;
                    const canEdit = !isSelf && (!isCurrentUserAdmin || isAdmin);


                    return (
                      <tr
                        key={u.id}
                        className="hover:bg-gray-50/50 dark:hover:bg-gray-800/20 transition-colors"
                      >
                        {/* Name & Email */}
                        <td className="px-5 py-4">
                          <div className="flex items-center gap-3">
                            <div className="w-9 h-9 rounded-xl bg-primary-500 text-white flex items-center justify-center text-sm font-bold shadow-sm shadow-primary-500/20">
                              {u.name?.[0]?.toUpperCase()}
                            </div>
                            <div className="min-w-0">
                              <div className="flex items-center gap-2">
                                <span className="font-semibold text-gray-900 dark:text-gray-100">
                                  {u.name}
                                </span>
                                {isSelf && (
                                  <span className="badge bg-primary-100 text-primary-700 dark:bg-primary-900/30 dark:text-primary-400 text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-md">
                                    You
                                  </span>
                                )}
                              </div>
                              <span className="text-xs text-gray-400 block truncate max-w-xs">
                                {u.email}
                              </span>
                              <span className="text-xs text-primary-300 block truncate max-w-xs">
                                {u.phone}
                              </span>
                            </div>
                          </div>
                        </td>


                        {/* Role Badge */}
                        <td className="px-5 py-4">
                          <span
                            className={`badge px-2.5 py-1 text-xs font-bold uppercase tracking-wider rounded-lg ${ROLE_STYLES[u.role] || ROLE_STYLES.customer}`}
                          >
                            {u.role}
                          </span>
                        </td>


                        {/* Active Status */}
                        <td className="px-5 py-4">
                          <span
                            className={`badge px-2 py-0.5 text-xs font-bold rounded-md ${
                              u.is_active
                                ? "bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-400 dark:border-emerald-900/50"
                                : "bg-red-50 text-red-700 border border-red-200 dark:bg-red-950/30 dark:text-red-400 dark:border-red-900/50"
                            }`}
                          >
                            {u.is_active ? "Active" : "Inactive"}
                          </span>
                        </td>


                        {/* Joined Date */}
                        <td className="px-5 py-4 text-gray-500 dark:text-gray-400 text-xs">
                          {new Date(u.created_at).toLocaleDateString(
                            undefined,
                            {
                              year: "numeric",
                              month: "short",
                              day: "numeric",
                            },
                          )}
                        </td>


                        {/* Actions */}
                        <td className="px-5 py-4">
                          {canEdit ? (
                            <div className="flex items-center gap-2">
                              {/* Role Selector dropdown */}
                              <select
                                value={u.role}
                                onChange={(e) =>
                                  handleRoleChange(u.id, e.target.value)
                                }
                                className="text-xs input py-1.5 px-3 w-auto bg-white dark:bg-gray-950 border-gray-200 dark:border-gray-800"
                              >
                                <option value="staff">Staff</option>
                                <option value="cashier">Cashier</option>
                                <option value="manager">Manager</option>
                              </select>


                              {/* Toggle active button */}
                              <button
                                onClick={() =>
                                  handleToggleActive(u.id, u.is_active)
                                }
                                className={`text-xs px-3 py-1.5 rounded-lg font-medium transition-colors border ${
                                  u.is_active
                                    ? "bg-amber-50 hover:bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-950/20 dark:text-amber-400 dark:border-amber-900/50"
                                    : "bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-950/20 dark:text-emerald-400 dark:border-emerald-900/50"
                                }`}
                              >
                                {u.is_active ? "Deactivate" : "Activate"}
                              </button>


                              {/* Delete button */}
                              <button
                                onClick={() => handleDelete(u.id)}
                                className="text-xs px-3 py-1.5 rounded-lg font-medium bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 transition-colors dark:bg-red-950/20 dark:text-red-400 dark:border-red-900/50"
                              >
                                Delete
                              </button>
                            </div>
                          ) : (
                            <span className="text-xs text-gray-400">—</span>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        /* TAB 2: PENDING APPROVALS (ADMIN ONLY) */
        <div className="card overflow-hidden border border-gray-200/60 dark:border-gray-800/80 shadow-md">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 dark:bg-gray-800/50 border-b border-gray-200 dark:border-gray-800 text-gray-500 dark:text-gray-400">
                <tr>
                  {[
                    "Candidate Info",
                    "Contact Phone",
                    "Requested Role",
                    "Applied On",
                    "Actions",
                  ].map((h) => (
                    <th
                      key={h}
                      className="px-5 py-4 text-left font-semibold uppercase tracking-wider text-xs"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800/60">
                {loadingPending ? (
                  [...Array(3)].map((_, i) => (
                    <tr key={i}>
                      <td colSpan={5} className="px-5 py-4">
                        <div className="h-5 bg-gray-100 dark:bg-gray-800 rounded animate-pulse w-full" />
                      </td>
                    </tr>
                  ))
                ) : pendingUsers.length === 0 ? (
                  <tr>
                    <td
                      colSpan={5}
                      className="px-5 py-16 text-center text-gray-500"
                    >
                      <div className="text-5xl mb-4">✨</div>
                      <p className="text-xl font-bold text-gray-900 dark:text-white">
                        All caught up!
                      </p>
                      <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 max-w-sm mx-auto">
                        No pending staff approval applications. New registration
                        requests will appear here.
                      </p>
                    </td>
                  </tr>
                ) : (
                  pendingUsers.map((u) => (
                    <tr
                      key={u.id}
                      className="hover:bg-gray-50/50 dark:hover:bg-gray-800/20 transition-colors"
                    >
                      {/* Name & Email */}
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-xl bg-amber-500 text-white flex items-center justify-center text-sm font-bold shadow-sm shadow-amber-500/20">
                            {u.name?.[0]?.toUpperCase()}
                          </div>
                          <div className="min-w-0">
                            <span className="font-semibold text-gray-900 dark:text-gray-100 block">
                              {u.name}
                            </span>
                            <span className="text-xs text-gray-400 block truncate max-w-xs">
                              {u.email}
                            </span>
                          </div>
                        </div>
                      </td>


                      {/* Phone */}
                      <td className="px-5 py-4 font-medium text-gray-700 dark:text-gray-300">
                        {u.phone || "—"}
                      </td>


                      {/* Requested Role */}
                      <td className="px-5 py-4">
                        <span
                          className={`badge px-2.5 py-1 text-xs font-bold uppercase tracking-wider rounded-lg ${ROLE_STYLES[u.requested_role] || ROLE_STYLES.customer}`}
                        >
                          {u.requested_role}
                        </span>
                      </td>


                      {/* Applied On */}
                      <td className="px-5 py-4 text-gray-500 dark:text-gray-400 text-xs">
                        {new Date(u.created_at).toLocaleDateString(undefined, {
                          year: "numeric",
                          month: "short",
                          day: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </td>


                      {/* Actions */}
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => handleApprove(u.id)}
                            disabled={submittingAction}
                            className="text-xs px-3 py-1.5 font-bold uppercase tracking-wider rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm shadow-emerald-600/10 hover:shadow-md transition-all duration-200 disabled:opacity-50"
                          >
                            Approve
                          </button>
                          <button
                            onClick={() => setRejectingUserId(u.id)}
                            disabled={submittingAction}
                            className="text-xs px-3 py-1.5 font-bold uppercase tracking-wider rounded-lg border border-red-200 hover:bg-red-50 text-red-700 dark:border-red-900/50 dark:hover:bg-red-950/20 transition-all duration-200 disabled:opacity-50"
                          >
                            Reject
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}


      {/* REJECTION MODAL DIALOG */}
      {rejectingUserId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
          <div className="card p-6 max-w-md w-full shadow-2xl animate-scale-in border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900">
            <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
              Reject Staff Registration
            </h3>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
              Please provide an optional reason for rejecting this staff
              application. This will be stored in logs and visible to the
              applicant.
            </p>


            <form onSubmit={handleRejectSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-1.5">
                  Rejection Reason (Optional)
                </label>
                <textarea
                  value={rejectionReason}
                  onChange={(e) => setRejectionReason(e.target.value)}
                  placeholder="e.g. Does not meet staff requirements, Incorrect details provided, etc."
                  rows={3}
                  className="input w-full resize-none text-sm border-gray-200 dark:border-gray-800"
                />
              </div>


              <div className="flex justify-end gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setRejectingUserId(null);
                    setRejectionReason("");
                  }}
                  className="px-4 py-2 text-sm font-semibold rounded-lg text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingAction}
                  className="px-4 py-2 text-sm font-semibold rounded-lg bg-red-600 hover:bg-red-700 text-white disabled:opacity-50 transition-colors shadow-sm"
                >
                  {submittingAction ? "Rejecting..." : "Reject Application"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}