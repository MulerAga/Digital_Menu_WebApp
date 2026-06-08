import { useState } from "react";
import { orderAPI } from "../services/api";
import toast from "react-hot-toast";

/**
 * FeedbackModal — lets a customer (or guest) rate and comment on a served order.
 *
 * Props:
 *   orderId     — the order's numeric id
 *   guestToken  — (optional) guest token for unauthenticated users
 *   existing    — (optional) existing feedback object { rating, comment } to pre-fill
 *   onClose     — called when the modal should close
 *   onSubmitted — called with the saved feedback object after a successful save
 */
export default function FeedbackModal({
  orderId,
  guestToken,
  existing,
  onClose,
  onSubmitted,
  restaurantSlug,
  branchId,
}) {
  const [rating, setRating] = useState(existing?.rating || 0);

  const [hovered, setHovered] = useState(0);
  const [comment, setComment] = useState(existing?.comment || "");
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!rating) return toast.error("Please select a rating");
    setSubmitting(true);
    try {
      const payload = { rating, comment: comment.trim() || undefined };
      if (guestToken) payload.guest_token = guestToken;
      const res = await orderAPI.submitFeedback(
        orderId,
        payload,
        restaurantSlug,
        branchId,
      );
      toast.success(
        existing ? "Feedback updated!" : "Thanks for your feedback! 🙏",
      );
      onSubmitted?.(res.data);
      onClose();
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to submit feedback");
    } finally {
      setSubmitting(false);
    }
  };

  const STAR_LABELS = ["", "Poor", "Fair", "Good", "Very Good", "Excellent"];
  const displayRating = hovered || rating;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fade-in">
      <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl w-full max-w-md p-6 space-y-5">
        {/* Header */}
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold">Rate Your Order #{orderId}</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors text-2xl leading-none"
            aria-label="Close"
          >
            ×
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Star rating */}
          <div className="text-center space-y-2">
            <p className="text-sm text-gray-500 dark:text-gray-400">
              How was your experience?
            </p>
            <div
              className="flex justify-center gap-2"
              role="group"
              aria-label="Star rating"
            >
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  key={star}
                  type="button"
                  onClick={() => setRating(star)}
                  onMouseEnter={() => setHovered(star)}
                  onMouseLeave={() => setHovered(0)}
                  aria-label={`${star} star${star > 1 ? "s" : ""}`}
                  className={`text-4xl transition-transform hover:scale-110 focus:outline-none focus:scale-110 ${
                    star <= displayRating
                      ? "text-yellow-400"
                      : "text-gray-200 dark:text-gray-700"
                  }`}
                >
                  ★
                </button>
              ))}
            </div>
            {displayRating > 0 && (
              <p className="text-sm font-medium text-primary-600">
                {STAR_LABELS[displayRating]}
              </p>
            )}
          </div>

          {/* Comment */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
              Comments{" "}
              <span className="text-gray-400 font-normal">(optional)</span>
            </label>
            <textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              rows={3}
              maxLength={500}
              placeholder="Tell us what you liked or how we can improve..."
              className="input w-full resize-none text-sm"
            />
            <p className="text-xs text-gray-400 text-right mt-1">
              {comment.length}/500
            </p>
          </div>

          {/* Actions */}
          <div className="flex gap-3">
            <button
              type="button"
              onClick={onClose}
              className="btn-secondary flex-1 py-2.5"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting || !rating}
              className="btn-primary flex-1 py-2.5 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {submitting
                ? "Submitting…"
                : existing
                  ? "Update Feedback"
                  : "Submit Feedback"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
