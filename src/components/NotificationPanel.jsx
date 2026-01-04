import { motion, AnimatePresence } from 'framer-motion';
import { X, AlertCircle, CheckCircle, Info, AlertTriangle } from 'lucide-react';
import { useNotificationStore } from '../context/store';
import { useEffect } from 'react';

const iconMap = {
  success: CheckCircle,
  error: AlertCircle,
  warning: AlertTriangle,
  info: Info,
};

const colorMap = {
  success: 'bg-green-50 border-green-500 text-green-800 dark:bg-green-900/20 dark:text-green-400',
  error: 'bg-red-50 border-red-500 text-red-800 dark:bg-red-900/20 dark:text-red-400',
  warning: 'bg-yellow-50 border-yellow-500 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-400',
  info: 'bg-blue-50 border-blue-500 text-blue-800 dark:bg-blue-900/20 dark:text-blue-400',
};

const NotificationPanel = () => {
  const { notifications, removeNotification } = useNotificationStore();
  console.log('[NotificationPanel] Current notifications:', notifications);

  // Auto-dismiss notifications after 5 seconds
  useEffect(() => {
    const timers = notifications.map((notif) =>
      setTimeout(() => removeNotification(notif.id), 5000)
    );
    return () => timers.forEach(clearTimeout);
  }, [notifications]);

  return (
    <div className="fixed top-20 right-4 z-50 space-y-2 max-w-sm w-full">
      <AnimatePresence>
        {notifications.slice(0, 3).map((notif) => {
          const Icon = iconMap[notif.type] || Info;
          const colorClass = colorMap[notif.type] || colorMap.info;
          const title = notif.title || 'Notification';
          const message = notif.message || 'You have a new notification.';

          return (
            <motion.div
              key={notif.id}
              initial={{ opacity: 0, x: 300, scale: 0.8 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={{ opacity: 0, x: 300, scale: 0.8 }}
              className={`p-4 rounded-lg border-l-4 shadow-lg ${colorClass} backdrop-blur-sm`}
            >
              <div className="flex items-start gap-3">
                <Icon className="w-5 h-5 flex-shrink-0 mt-0.5" />
                <div className="flex-1">
                  <h4 className="font-semibold text-sm">{title}</h4>
                  <p className="text-xs mt-1 opacity-90">{message}</p>
                </div>
                <button
                  onClick={() => removeNotification(notif.id)}
                  className="flex-shrink-0 hover:opacity-70 transition-opacity"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
};

export default NotificationPanel;
