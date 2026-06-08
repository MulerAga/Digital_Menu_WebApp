import { useNavigate, useParams } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useBasePath } from "../context/SlugContext";

export default function UnauthorizedPage() {
  const navigate = useNavigate();
  const { user, restaurantSlug, logout } = useAuth();
  const base = useBasePath();

  // base from SlugContext if inside /:slug layout, otherwise derive from restaurantSlug
  const { slug, branchSlug } = useParams();

  const home = branchSlug ? `/${slug}/branches/${branchSlug}` : `/${slug}`;

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 to-red-100 dark:from-gray-900 dark:to-gray-800 flex items-center justify-center p-4">
      <div className="card p-8 max-w-md w-full text-center">
        <div className="mb-6">
          <div className="w-16 h-16 mx-auto bg-orange-100 dark:bg-orange-900/30 rounded-full flex items-center justify-center mb-4">
            <span className="text-3xl">🚫</span>
          </div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
            Access Denied
          </h1>
        </div>

        <div className="space-y-4 mb-8">
          <div className="bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 rounded-lg p-4">
            <p className="text-sm text-orange-800 dark:text-orange-300">
              <strong>Your Role:</strong>
              <br />
              <span className="inline-block mt-1 px-3 py-1 bg-orange-100 dark:bg-orange-900/30 text-orange-800 dark:text-orange-300 rounded-full text-xs font-semibold capitalize">
                {user?.role || "User"}
              </span>
            </p>
          </div>
          <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4 text-left space-y-2 text-sm text-gray-600 dark:text-gray-300">
            <p>
              <strong>What you can do:</strong>
            </p>
            <ul className="list-disc list-inside space-y-1">
              <li>Check with your administrator for access</li>
              <li>Make sure you're logged in with the correct account</li>
              <li>Make sure you're using the correct URL link </li>
              <li>Contact support if you believe this is a mistake</li>
            </ul>
          </div>
        </div>

        <div className="space-y-3">
          <button
            onClick={() => {
              logout();
              navigate(home);
            }}
            className="w-full bg-primary-600 hover:bg-primary-700 text-white font-semibold py-3 rounded-lg transition"
          >
            Go to Home
          </button>
        </div>
      </div>
    </div>
  );
}
