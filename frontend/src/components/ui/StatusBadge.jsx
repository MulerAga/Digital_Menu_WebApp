const STATUS_STYLES = {
  pending:   'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300',
  preparing: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
  served:    'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
  cancelled: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300',
};

const STATUS_ICONS = {
  pending: '⏳', preparing: '👨‍🍳', served: '✅', cancelled: '❌',
};

export default function StatusBadge({ status }) {
  return (
    <span className={`badge ${STATUS_STYLES[status] || 'bg-gray-100 text-gray-800'}`}>
      {STATUS_ICONS[status]} {status?.charAt(0).toUpperCase() + status?.slice(1)}
    </span>
  );
}
