import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useBasePath } from "../context/SlugContext";

export default function ApprovalRejectedPage() {
  const { logout, user } = useAuth();
  const navigate = useNavigate();
  const base = useBasePath();

  const handleLogout = () => {
    logout();
    navigate(`${base || ""}/login`);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-red-50 to-orange-100 dark:from-gray-900 dark:to-gray-800 flex items-center justify-center p-4">
      <div className="card p-8 max-w-md w-full text-center">
        <div className="mb-6">
          <div className="w-16 h-16 mx-auto bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center mb-4">
            <span className="text-3xl">❌</span>
          </div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
            Registration Rejected
          </h1>
        </div>

        <div className="space-y-4 mb-8">
          <p className="text-gray-600 dark:text-gray-300 text-lg">
            Your registration has been rejected by the restaurant administrator.
          </p>
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
            <p className="text-sm text-red-800 dark:text-red-300">
              <strong>Account Status:</strong>
              <br />
              <span className="inline-block mt-1 px-3 py-1 bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300 rounded-full text-xs font-semibold">
                Rejected
              </span>
            </p>
          </div>
          <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4 text-left space-y-2 text-sm text-gray-600 dark:text-gray-300">
            <p>
              <strong>What this means:</strong>
            </p>
            <ul className="list-disc list-inside space-y-1">
              <li>Your account registration has been declined</li>
              <li>You will not be able to access the restaurant system</li>
              <li>Contact the restaurant administrator for more information</li>
            </ul>
          </div>
        </div>

        {user && (
          <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4 text-sm text-gray-600 dark:text-gray-300 mb-6">
            <p className="font-semibold text-gray-700 dark:text-gray-200 mb-1">
              Registration Details:
            </p>
            <p>{user.name}</p>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              {user.email}
            </p>
          </div>
        )}

        <div className="space-y-3">
          <p className="text-sm text-gray-500 dark:text-gray-400">
            For assistance, please contact the restaurant administrator.
          </p>
          <button
            onClick={handleLogout}
            className="w-full bg-gray-600 hover:bg-gray-700 text-white font-semibold py-3 rounded-lg transition"
          >
            Go Back
          </button>
        </div>
      </div>
    </div>
  );
}
