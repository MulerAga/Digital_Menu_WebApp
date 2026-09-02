import { useState } from "react";
import { useNavigate, useParams, Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export default function StaffRegistrationPage() {
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    password: "",
    phone: "",
    businessName: "",
    requestedRole: "staff",
  });
  const { slug } = useParams();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);
  const navigate = useNavigate();
  const { registerStaff } = useAuth();

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      // Validate required fields
      if (
        !formData.name ||
        !formData.email ||
        !formData.password ||
        !formData.phone ||
        !formData.businessName
      ) {
        setError("All fields are required");
        setLoading(false);
        return;
      }

      // Validate email format
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
        setError("Invalid email format");
        setLoading(false);
        return;
      }

      // Validate password length
      if (formData.password.length < 6) {
        setError("Password must be at least 6 characters");
        setLoading(false);
        return;
      }

      const result = await registerStaff({
        name: formData.name,
        email: formData.email,
        password: formData.password,
        phone: formData.phone,
        businessName: formData.businessName.trim(),
        requestedRole: formData.requestedRole,
        slug: slug || undefined,
      });

      if (result?.pending) {
        setSuccess(true);
        setTimeout(() => {
          navigate(slug ? `/${slug}/pending-approval` : "/pending-approval");
        }, 10);
      } else {
        setError(result?.message || "Registration failed");
      }
    } catch (err) {
      setError(
        err.response?.data?.message || "Registration failed. Please try again.",
      );
      console.error("Registration error:", err);
    } finally {
      setLoading(false);
    }
  };
  const backTo = slug ? `/${slug}` : "/";
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800 flex items-center justify-center p-4">
      <div className="card p-8 max-w-md w-full">
        <div className="mb-8">
          <div className="mb-4">
            <Link
              to={backTo}
              className="text-sm text-black hover:text-primary-100 transition-colors bg-red-500/50 p-2 rounded-lg"
            >
              ← Go Back to Home
            </Link>
          </div>
        </div>

        <div className="mb-6 text-center">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
            Staff Registration
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            Join as a staff member
          </p>
        </div>

        {error && (
          <div className="mb-4 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
            <p className="text-red-800 dark:text-red-300 text-sm">{error}</p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Full Name */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Full Name *
            </label>
            <input
              type="text"
              name="name"
              value={formData.name}
              onChange={handleChange}
              placeholder="John Doe"
              className="input w-full"
              required
            />
          </div>

          {/* Email */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Email Address *
            </label>
            <input
              type="email"
              name="email"
              value={formData.email}
              onChange={handleChange}
              placeholder="john@example.com"
              className="input w-full"
              required
            />
          </div>

          {/* Phone */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Phone Number *
            </label>
            <input
              type="tel"
              name="phone"
              value={formData.phone}
              onChange={handleChange}
              placeholder="0998897890 / 0787654321"
              className="input w-full"
              required
            />
          </div>

          {/* Password */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Password *
            </label>
            <input
              type="password"
              name="password"
              value={formData.password}
              onChange={handleChange}
              placeholder="••••••••"
              className="input w-full"
              required
              minLength="6"
            />
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              Minimum 6 characters
            </p>
          </div>

          {/* Business Name */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Business Name *
            </label>
            <input
              type="text"
              name="businessName"
              value={formData.businessName}
              onChange={handleChange}
              placeholder="Enter  restaurant or hotel name"
              className="input w-full"
              required
            />
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              Use the restaurant or business name associated with your account
            </p>
          </div>

          {/* Requested Role */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Requested Role *
            </label>
            <select
              name="requestedRole"
              value={formData.requestedRole}
              onChange={handleChange}
              className="input w-full"
              required
            >
              <option value="staff">Staff 👨‍💼</option>
              <option value="cashier">Cashier 💳</option>
              <option value="manager">Manager 📊</option>
            </select>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              Your requested role (subject to admin approval)
            </p>
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={loading}
            className="btn-primary w-full mt-6"
          >
            {loading ? "Registering..." : "Register"}
          </button>
        </form>

        <div className="mt-6 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
          <p className="text-sm text-blue-800 dark:text-blue-300">
            <strong>ℹ️ After registration:</strong>
            <br />
            Your account will be pending approval. The restaurant admin will
            review your request and notify you once approved.
          </p>
        </div>
      </div>
    </div>
  );
}
