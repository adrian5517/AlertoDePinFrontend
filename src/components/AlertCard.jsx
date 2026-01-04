import { motion } from 'framer-motion';
import { Clock, MapPin, AlertCircle, CheckCircle, XCircle } from 'lucide-react';

const statusConfig = {
  pending: { color: 'bg-yellow-100 text-yellow-800 border-yellow-300', icon: Clock, label: 'Pending' },
  active: { color: 'bg-red-100 text-red-800 border-red-300', icon: AlertCircle, label: 'Active' },
  responded: { color: 'bg-blue-100 text-blue-800 border-blue-300', icon: CheckCircle, label: 'Responded' },
  resolved: { color: 'bg-green-100 text-green-800 border-green-300', icon: CheckCircle, label: 'Resolved' },
  cancelled: { color: 'bg-gray-100 text-gray-800 border-gray-300', icon: XCircle, label: 'Cancelled' },
};

const AlertCard = ({ alert, onAction }) => {
  const status = statusConfig[alert.status] || statusConfig.pending;
  const StatusIcon = status.icon;

  // Format location from backend structure
  const location = alert.location?.address || alert.location || 'Unknown location';
  const timestamp = alert.createdAt || alert.timestamp;
  const reporter = alert.reporter?.name || alert.reporter || 'Unknown';
  
  // Get coordinates from backend structure
  const coordinates = alert.location?.coordinates?.coordinates 
    ? { lng: alert.location.coordinates.coordinates[0], lat: alert.location.coordinates.coordinates[1] }
    : alert.coordinates;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ y: -4 }}
      className="card hover:shadow-2xl transition-all duration-200 cursor-pointer"
      onClick={() => onAction && onAction(alert)}
    >
      <div className="flex items-start justify-between mb-4">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-2">
            <span className={`px-3 py-1 rounded-full text-xs font-medium border ${status.color}`}>
              <StatusIcon className="w-3 h-3 inline mr-1" />
              {status.label}
            </span>
            <span className="text-xs text-gray-500 dark:text-gray-400 capitalize">
              {alert.type}
            </span>
          </div>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-1">
            {alert.title}
          </h3>
          <p className="text-sm text-gray-600 dark:text-gray-400 line-clamp-2">
            {alert.description}
          </p>
        </div>
      </div>

      <div className="space-y-2 text-sm">
        <div className="flex items-center gap-2 text-gray-600 dark:text-gray-400">
          <MapPin className="w-4 h-4" />
          <span>{location}</span>
        </div>
        <div className="flex items-center gap-2 text-gray-600 dark:text-gray-400">
          <Clock className="w-4 h-4" />
          <span>{new Date(timestamp).toLocaleString()}</span>
        </div>
        {reporter && (
          <div className="flex items-center gap-2 text-gray-600 dark:text-gray-400">
            <span className="font-medium">Reporter:</span>
            <span>{reporter}</span>
          </div>
        )}
      </div>

      {coordinates && (
        <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
          <p className="text-xs text-gray-500 dark:text-gray-500">
            Coordinates: {coordinates.lat.toFixed(4)}, {coordinates.lng.toFixed(4)}
          </p>
        </div>
      )}
    </motion.div>
  );
};

export default AlertCard;
