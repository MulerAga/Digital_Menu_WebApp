import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useEffect } from "react";
import { useBasePath } from "../context/SlugContext";

export default function PendingApprovalPage() {
  const { logout, user } = useAuth();
  const navigate = useNavigate();
  const base = useBasePath();

  useEffect(() => {
    // If somehow an approved user reaches this page, redirect
    if (user?.approval_status === "approved") {
      navigate(`${base || ""}/`);
    }
  }, [user, navigate, base]);

  const handleLogout = () => {
    logout();
    navigate(`${base || ""}/login`);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800 flex items-center justify-center p-4">
      <div className="card p-8 max-w-md w-full text-center">
        <div className="mb-6">
          <div className="w-16 h-16 mx-auto bg-blue-100 dark:bg-blue-900/30 rounded-full flex items-center justify-center mb-4">
            <span className="text-3xl">⏳</span>
          </div>
          <h1 className="font-bold text-gray-900 dark:text-white mb-2">
             Registration Successful!
          </h1>
          <h1 className="font-bold text-gray-900 dark:text-white mb-2">
            Waiting for Approval
          </h1>
        </div>

        <div className="space-y-4 mb-8">
          <p className="text-gray-600 dark:text-gray-300 ">
            Your account is pending approval from the restaurant administrator.
          </p>
          <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
            <p className="text-sm text-blue-800 dark:text-blue-300">
              <strong>Account Status:</strong>
              <br />
              <span className="inline-block mt-1 px-3 py-1 bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-300 rounded-full text-xs font-semibold">
                Pending Approval
              </span>
            </p>
          </div>
          <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4 text-left space-y-2 text-sm text-gray-600 dark:text-gray-300">
            <p>
              <strong>What happens next:</strong>
            </p>
            <ul className="list-disc list-inside space-y-1">
              <li>
                The restaurant administrator will review your registration
              </li>
              <li>You will be notified once your account is approved</li>
              <li>Once approved, you can log in to access your dashboard</li>
            </ul>
          </div>
        </div>

        {user && (
          <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4 text-sm text-gray-600 dark:text-gray-300 mb-6">
            <p className="font-semibold text-gray-700 dark:text-gray-200 mb-1">
              Registered as:
            </p>
            <p>{user.name}</p>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              {user.email}
            </p>
          </div>
        )}

        <div className="space-y-3">
          <button
            onClick={handleLogout}
            className="w-full bg-red-600 hover:bg-red-700 text-white font-semibold py-3 rounded-lg transition"
          >
            Back to Home
          </button>
        </div>
      </div>
    </div>
  );
}
