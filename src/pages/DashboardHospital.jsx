import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Activity, AlertCircle, CheckCircle, Clock } from 'lucide-react';
import DashboardHeader from '../components/DashboardHeader';
import LiveMap from '../components/LiveMap';
import AlertCard from '../components/AlertCard';
import { useAuth } from '../context/AuthContext';
import { useNotificationStore } from '../context/store';
import { alertsAPI } from '../services/api';
import io from 'socket.io-client';

// (alerts are loaded from the API)

const SOCKET_URL = import.meta.env.VITE_API_URL || 'https://alertodepinbackend.onrender.com';

const DashboardHospital = () => {
  const { user } = useAuth();
  const { addNotification } = useNotificationStore();
  const [alerts, setAlerts] = useState([]);
  const [selectedAlert, setSelectedAlert] = useState(null);
  const [onlineUsers, setOnlineUsers] = useState([]);
  const [loading, setLoading] = useState(true);

  const stats = [
    { label: 'Active Emergencies', value: alerts.filter(a => a.status === 'active').length, icon: AlertCircle, color: 'bg-red-600' },
    { label: 'Awaiting Ambulance', value: alerts.filter(a => a.status === 'pending').length, icon: Clock, color: 'bg-yellow-600' },
    { label: 'Responded Today', value: alerts.filter(a => a.status === 'responded').length, icon: CheckCircle, color: 'bg-green-600' },
    { label: 'Avg Response Time', value: '7m', icon: Activity, color: 'bg-blue-600' },
  ];

  // Fetch alerts
  useEffect(() => {
    let isMounted = true;
    const fetchAlerts = async () => {
      try {
        setLoading(true);
        const res = await alertsAPI.getAll();
        const alertsData = res.alerts || res.data || res;
        if (!isMounted) return;
        const hospitalAlerts = (alertsData || []).filter(a => a.type === 'hospital');
        setAlerts(hospitalAlerts);
      } catch (error) {
        console.error('Error fetching hospital alerts:', error);
        addNotification('Failed to load hospital alerts', 'error');
      } finally {
        setLoading(false);
      }
    };

    fetchAlerts();
    const interval = setInterval(fetchAlerts, 30000);
    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [addNotification]);

  // Socket.IO - listen for real-time alerts/notifications
  useEffect(() => {
    if (!user?._id) return;
    let isSubscribed = true;
    const socket = io(SOCKET_URL, { transports: ['websocket', 'polling'] });

    socket.on('connect', () => {
      if (!isSubscribed) return;
      console.log('Hospital dashboard connected to Socket.IO');
      if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          (position) => {
            if (!isSubscribed) return;
            socket.emit('user-online', {
              userId: user._id,
              location: { lat: position.coords.latitude, lng: position.coords.longitude },
              userType: user.accountType || 'hospital',
              name: user.name || 'Hospital User',
            });
          },
          (err) => console.error('Geolocation error:', err),
          { enableHighAccuracy: true, timeout: 20000 }
        );
      }
    });

    socket.on('online-users-update', (users) => {
      if (!isSubscribed) return;
      setOnlineUsers(users);
    });

    socket.on('new-alert', (alert) => {
      if (!isSubscribed) return;
      console.log('Hospital - Received new alert via Socket:', alert);
      if (alert.type === 'hospital' && alert.status !== 'resolved' && alert.status !== 'cancelled') {
        setAlerts((prev) => [alert, ...prev]);
        addNotification({ title: `New medical alert`, message: alert.description || 'Medical emergency reported', type: 'warning' });
      }
    });

    socket.on('newNotification', (notif) => {
      if (!isSubscribed) return;
      const notifType = notif.type === 'alert_responded' ? 'success' : notif.type === 'alert_resolved' ? 'info' : notif.type === 'alert' ? 'warning' : 'info';
      addNotification({ title: notif.title || 'Notification', message: notif.message || 'You have a new notification.', type: notifType });
    });

    const locInterval = setInterval(() => {
      if (!isSubscribed || !navigator.geolocation || !socket.connected) return;
      navigator.geolocation.getCurrentPosition(
        (position) => {
          if (!isSubscribed) return;
          socket.emit('update-location', { userId: user._id, location: { lat: position.coords.latitude, lng: position.coords.longitude } });
        },
        (error) => console.error('Geolocation error:', error),
        { enableHighAccuracy: false, timeout: 20000, maximumAge: 60000 }
      );
    }, 60000);

    return () => {
      isSubscribed = false;
      clearInterval(locInterval);
      if (socket.connected) {
        socket.off('connect');
        socket.off('online-users-update');
        socket.off('new-alert');
        socket.off('newNotification');
        socket.disconnect();
      }
    };
  }, [user?._id, addNotification]);

  const handleDispatchAmbulance = (alertId) => {
    (async () => {
      const id = alertId || selectedAlert?._id || selectedAlert?.id;
      console.log('Dispatching ambulance for alert:', id);
      try {
        // Prefer using the respond endpoint if available so backend notifications run
        if (id) {
          await alertsAPI.respond(id);
          setAlerts((prev) =>
            prev.map((a) =>
              (a._id || a.id) === id ? { ...a, status: 'responded', responder: user } : a
            )
          );
          addNotification('Ambulance dispatched', 'success');
        } else {
          console.warn('No alert id provided to dispatch ambulance');
          addNotification('Unable to dispatch ambulance: missing alert id', 'error');
        }
      } catch (err) {
        console.error('Error dispatching ambulance:', err);
        addNotification(err.message || 'Failed to dispatch ambulance', 'error');
      }
    })();
  };

  return (
    <div className="space-y-6">
      <DashboardHeader
        title="Hospital Emergency Control"
        subtitle={`${user?.name} - Medical Emergency Monitoring System`}
        stats={stats}
        actions={
          <div className="flex gap-2">
            <button className="btn-danger">
              <Activity className="w-4 h-4 inline mr-2" />
              Dispatch Ambulance
            </button>
            <button className="btn-primary">
              View ER Status
            </button>
          </div>
        }
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Map Section */}
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          className="lg:col-span-2"
        >
          <div className="card p-0 overflow-hidden">
            <div className="p-4 border-b border-gray-200 dark:border-gray-700 bg-red-50 dark:bg-red-900/20">
              <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                Live Medical Emergency Map
              </h2>
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                Real-time tracking of medical emergencies in your coverage area
              </p>
            </div>
            <LiveMap
              alerts={alerts}
              onlineUsers={onlineUsers}
              onMarkerClick={setSelectedAlert}
              selectedAlert={selectedAlert}
              className="h-[500px]"
            />
          </div>
        </motion.div>

        {/* Emergency Queue */}
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          className="space-y-4"
        >
          <div className="card">
            <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">
              Emergency Queue
            </h2>
            <div className="space-y-3 max-h-[500px] overflow-y-auto">
              {alerts.map((alert, index) => (
                <div
                  key={alert._id || alert.id}
                  className={`p-3 rounded-lg border cursor-pointer transition-all ${
                    (selectedAlert?._id === alert._id || selectedAlert?.id === alert.id || selectedAlert?._id === alert.id || selectedAlert?.id === alert._id)
                      ? 'border-red-500 bg-red-50 dark:bg-red-900/20'
                      : 'border-gray-200 dark:border-gray-700 hover:border-red-300'
                  }`}
                  onClick={() => setSelectedAlert(alert)}
                >
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <span className="text-xs font-bold text-gray-500 dark:text-gray-400">
                        #{index + 1}
                      </span>
                      <h3 className="font-semibold text-sm text-gray-900 dark:text-white">
                        {alert.title}
                      </h3>
                    </div>
                    <span className={`text-xs px-2 py-1 rounded-full ${
                      alert.status === 'active' ? 'bg-red-100 text-red-800 animate-pulse' :
                      alert.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                      'bg-green-100 text-green-800'
                    }`}>
                      {alert.status}
                    </span>
                  </div>
                  <p className="text-xs text-gray-600 dark:text-gray-400 mb-2">
                    {alert.description}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-500 mb-2">
                    📍
                    {typeof alert.location === 'string'
                      ? ` ${alert.location}`
                      : ` ${alert.location?.address || 'Location not specified'}`}
                  </p>
                  {alert.status !== 'responded' && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDispatchAmbulance(alert._id || alert.id);
                      }}
                      className="w-full text-xs btn-danger py-2"
                    >
                      Dispatch Ambulance
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        </motion.div>
      </div>

      {/* Selected Alert Details */}
      {selectedAlert && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <div className="card">
            <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">
              Emergency Details
            </h2>
            <AlertCard alert={selectedAlert} />
            <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
              <h3 className="font-semibold text-gray-900 dark:text-white mb-3">
                Medical Response Actions
              </h3>
              <div className="grid grid-cols-2 gap-3">
                <button className="btn-danger">Dispatch Unit</button>
                <button className="btn-primary">Contact Reporter</button>
                <button className="btn-primary">View Patient History</button>
                <button className="btn-primary">Update Status</button>
              </div>
            </div>
          </div>
        </motion.div>
      )}
    </div>
  );
};

export default DashboardHospital;
