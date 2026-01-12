import { useState, useEffect, Suspense, lazy } from 'react';
import { motion } from 'framer-motion';
import {
  AlertTriangle,
  CheckCircle,
  Clock,
  Plus,
  X,
  FileText,
  Users,
  MapPin
} from 'lucide-react';
import DashboardHeader from '../components/DashboardHeader';
const LiveMap = lazy(() => import('../components/LiveMap'));
import AlertCard from '../components/AlertCard';
import ConfirmModal from '../components/ConfirmModal';
import ResolveModal from '../components/ResolveModal';
import { useAuth } from '../context/AuthContext';
import { useNotificationStore } from '../context/store';
import { alertsAPI } from '../services/api';
import io from 'socket.io-client';

const SOCKET_URL = import.meta.env.VITE_API_URL || 'https://alertodepinbackend.onrender.com';

const DashboardFire = () => {
  const { user } = useAuth();
  const { addNotification } = useNotificationStore();

  const [alerts, setAlerts] = useState([]);
  const [onlineUsers, setOnlineUsers] = useState([]);
  const [selectedAlert, setSelectedAlert] = useState(null);
  const [loading, setLoading] = useState(true);

  

  // Modal states
  const [showRespondModal, setShowRespondModal] = useState(false);
  const [showArrivedModal, setShowArrivedModal] = useState(false);
  const [showResolveModal, setShowResolveModal] = useState(false);
  const [modalAlertId, setModalAlertId] = useState(null);

  // ------------------ FETCH ALERTS ------------------
  useEffect(() => {
    const fetchAlerts = async () => {
      try {
        setLoading(true);
        const response = await alertsAPI.getAll();
        const alertsData = response.alerts || response.data || [];
        const fireAlerts = alertsData.filter(
          (alert) =>
            alert.type === 'fire' &&
            alert.status !== 'resolved' &&
            alert.status !== 'cancelled'
        );
        setAlerts(fireAlerts);
      } catch (error) {
        console.error('Error fetching alerts:', error);
        addNotification('Failed to load alerts', 'error');
      } finally {
        setLoading(false);
      }
    };

    fetchAlerts();
    const interval = setInterval(fetchAlerts, 30000);
    return () => clearInterval(interval);
  }, [addNotification]);

  // ------------------ SOCKET.IO SETUP ------------------
  useEffect(() => {
    if (!user?._id) return;

    let isSubscribed = true;
    const socket = io(SOCKET_URL, {
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionAttempts: 5
    });

    socket.on('connect', () => {
      if (!isSubscribed) return;
      // connected to Socket.IO

      if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          (position) => {
            if (!isSubscribed) return;
            const userData = {
              userId: user._id,
              location: {
                lat: position.coords.latitude,
                lng: position.coords.longitude
              },
              userType: user.accountType || 'fire',
              name: user.name || 'Fire Responder'
            };
            socket.emit('user-online', userData);
          },
          (error) => console.error('Geolocation error:', error),
          { enableHighAccuracy: true, timeout: 20000 }
        );
      }
    });

    // Online users list
    socket.on('online-users-update', (users) => {
      if (!isSubscribed) return;
      setOnlineUsers(users);
    });

    // Single user location update
    socket.on('user-location-update', (data) => {
      if (!isSubscribed) return;
      setOnlineUsers((prev) => {
        const updated = [...prev];
        const index = updated.findIndex((u) => u.userId === data.userId);
        if (index !== -1) {
          updated[index] = { ...updated[index], location: data.location };
        }
        return updated;
      });
    });

    // Real-time new alerts
    socket.on('new-alert', (alert) => {
      if (!isSubscribed) return;
        if (
          alert.type === 'fire' &&
          alert.status !== 'resolved' &&
          alert.status !== 'cancelled'
        ) {
        setAlerts((prev) => [alert, ...prev]);
        addNotification(
          `New fire alert: ${alert.description || 'Emergency'}`,
          'warning'
        );
      }
    });

    // Real-time notifications
    socket.on('newNotification', (notif) => {
      if (!isSubscribed) return;

      const notifType =
        notif.type === 'alert_responded'
          ? 'success'
          : notif.type === 'alert_resolved'
          ? 'info'
          : notif.type === 'alert'
          ? 'warning'
          : 'info';

      addNotification({
        title: notif.title || 'Notification',
        message: notif.message || 'You have a new notification.',
        type: notifType
      });
    });

    const locationInterval = setInterval(() => {
      if (!isSubscribed || !navigator.geolocation || !socket.connected) return;

      navigator.geolocation.getCurrentPosition(
        (position) => {
          if (!isSubscribed) return;
          socket.emit('update-location', {
            userId: user._id,
            location: {
              lat: position.coords.latitude,
              lng: position.coords.longitude
            }
          });
        },
        (error) => console.error('Geolocation error:', error),
        { enableHighAccuracy: false, timeout: 20000, maximumAge: 60000 }
      );
    }, 60000);

    return () => {
      isSubscribed = false;
      clearInterval(locationInterval);

      if (socket.connected) {
        socket.off('connect');
        socket.off('online-users-update');
        socket.off('user-location-update');
        socket.off('new-alert');
        socket.off('newNotification');
        socket.disconnect();
      }
    };
  }, [user?._id, addNotification]);

  // ------------------ STATS ------------------
  const stats = [
    {
      label: 'Active Incidents',
      value: alerts.filter((a) => a.status === 'active').length,
      icon: AlertTriangle,
      color: 'bg-red-600'
    },
    {
      label: 'Pending Response',
      value: alerts.filter((a) => a.status === 'pending').length,
      icon: Clock,
      color: 'bg-yellow-600'
    },
    {
      label: 'Online Users',
      value: onlineUsers.length,
      icon: Users,
      color: 'bg-green-600'
    },
    { label: 'Response Rate', value: '94%', icon: FileText, color: 'bg-blue-600' }
  ];

  // ------------------ HANDLERS ------------------
  const handleMarkerClick = (alert) => {
    setSelectedAlert(alert);
  };

  const handleRespond = async (alertId) => {
    try {
      const alert = alerts.find((a) => (a._id || a.id) === alertId);
      if (!alert) {
        addNotification('Alert not found', 'error');
        return;
      }
      const response = await alertsAPI.respond(alertId);
      setAlerts((prev) =>
        prev.map((a) =>
          (a._id || a.id) === alertId ? { ...a, status: 'responded', responder: user } : a
        )
      );
      setSelectedAlert(response.alert || alert);
      handleMarkerClick(response.alert || alert);
      addNotification('Successfully responded! Route displayed on map', 'success');
    } catch (error) {
      console.error('Error responding to alert:', error);
      addNotification(error.message || 'Failed to respond to alert', 'error');
    }
  };

  const handleMarkArrived = async (alertId) => {
    try {
      await alertsAPI.update(alertId, { status: 'active', notes: 'Responder has arrived on scene' });
      setAlerts((prev) =>
        prev.map((a) =>
          (a._id || a.id) === alertId ? { ...a, status: 'active', arrivedAt: new Date() } : a
        )
      );
      addNotification('Marked as arrived at scene', 'success');
    } catch (error) {
      console.error('Error marking arrival:', error);
      addNotification(error.response?.data?.message || 'Failed to update status', 'error');
    }
  };

  const handleResolve = async (notes) => {
    try {
      const alertId = modalAlertId;
      await alertsAPI.resolve(alertId, notes || 'Incident resolved successfully');
      setAlerts((prev) => prev.filter((a) => (a._id || a.id) !== alertId));
      if (selectedAlert?._id === alertId || selectedAlert?.id === alertId) setSelectedAlert(null);
      addNotification('Incident resolved successfully!', 'success');
    } catch (error) {
      console.error('Error resolving alert:', error);
      addNotification(error.response?.data?.message || 'Failed to resolve incident', 'error');
    }
  };

  


  // ------------------ RENDER ------------------
  return (
    <div className="space-y-6">
      <DashboardHeader
        title="Fire Command Center"
        subtitle={`Responder ${user?.name} - Real-time incident monitoring`}
        stats={stats}
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} className="lg:col-span-2">
          <div className="card p-0 overflow-hidden">
            <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
              <h2 className="text-xl font-bold text-gray-900 dark:text-white">Live Incident Map</h2>
              <div className="flex items-center gap-3 text-sm">
                <div className="flex items-center gap-1"><div className="w-2 h-2 bg-red-500 rounded-full animate-pulse" /><span className="text-gray-600 dark:text-gray-400">{alerts.length} Alerts</span></div>
                <div className="flex items-center gap-1"><div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" /><span className="text-gray-600 dark:text-gray-400">{onlineUsers.length} Online</span></div>
              </div>
            </div>
            {loading ? (<div className="h-[500px] flex items-center justify-center"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600" /></div>) : (
                <Suspense fallback={<div className="h-[500px] flex items-center justify-center">Loading map…</div>}>
                  <LiveMap
                    alerts={alerts}
                    onlineUsers={onlineUsers}
                    onMarkerClick={handleMarkerClick}
                    selectedAlert={selectedAlert}
                    className="h-[500px]"
                  />
                </Suspense>
            )}
          </div>
        </motion.div>

        <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="space-y-4">
          <div className="card">
            <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">Priority Incidents</h2>
            <div className="space-y-3 max-h-[500px] overflow-y-auto">
              {alerts.map((alert) => (
                <div key={alert._id || alert.id} className={`p-3 rounded-lg border cursor-pointer transition-all ${selectedAlert?._id === alert._id || selectedAlert?.id === alert.id ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20' : 'border-gray-200 dark:border-gray-700 hover:border-primary-300'}`} onClick={() => setSelectedAlert(alert)}>
                  <div className="flex items-start justify-between mb-2">
                    <h3 className="font-semibold text-sm text-gray-900 dark:text-white">{alert.description || 'Emergency Alert'}</h3>
                    <span className={`text-xs px-2 py-1 rounded-full ${alert.status === 'active' ? 'bg-red-100 text-red-800' : alert.status === 'pending' ? 'bg-yellow-100 text-yellow-800' : 'bg-green-100 text-green-800'}`}>{alert.status}</span>
                  </div>
                  <p className="text-xs text-gray-600 dark:text-gray-400 mb-2">📍{typeof alert.location === 'string' ? alert.location : alert.location?.address || 'Location not specified'}</p>
                  <div className="space-y-2">
                    {(alert.status === 'pending' || alert.status === 'active') && alert.responder?._id !== user?._id && (
                      <button onClick={(e) => { e.stopPropagation(); setModalAlertId(alert._id || alert.id); setShowRespondModal(true); }} className="w-full text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white py-2 px-3 rounded-lg transition-colors flex items-center justify-center gap-1"><AlertTriangle className="w-3 h-3" /> Respond to Incident</button>
                    )}
                    {alert.status === 'responded' && alert.responder?._id === user?._id && (
                      <>
                        <div className="p-2 bg-blue-50 dark:bg-blue-900/20 rounded text-xs"><span className="text-blue-700 dark:text-blue-300 font-semibold flex items-center gap-1"><CheckCircle className="w-3 h-3" />You are responding to this incident</span></div>
                        <div className="grid grid-cols-2 gap-2">
                          <button onClick={(e) => { e.stopPropagation(); setModalAlertId(alert._id || alert.id); setShowArrivedModal(true); }} className="text-xs font-semibold bg-green-600 hover:bg-green-700 text-white py-2 px-3 rounded-lg transition-colors flex items-center justify-center gap-1"><MapPin className="w-3 h-3" /> Arrived</button>
                          <button onClick={(e) => { e.stopPropagation(); setModalAlertId(alert._id || alert.id); setShowResolveModal(true); }} className="text-xs font-semibold bg-purple-600 hover:bg-purple-700 text-white py-2 px-3 rounded-lg transition-colors flex items-center justify-center gap-1"><CheckCircle className="w-3 h-3" /> Resolve</button>
                        </div>
                      </>
                    )}
                    {alert.status === 'active' && alert.responder?._id === user?._id && (
                      <>
                        <div className="p-2 bg-green-50 dark:bg-green-900/20 rounded text-xs"><span className="text-green-700 dark:text-green-300 font-semibold flex items-center gap-1"><CheckCircle className="w-3 h-3" />On scene</span></div>
                        <button onClick={(e) => { e.stopPropagation(); setModalAlertId(alert._id || alert.id); setShowResolveModal(true); }} className="w-full text-xs font-semibold bg-purple-600 hover:bg-purple-700 text-white py-2 px-3 rounded-lg transition-colors flex items-center justify-center gap-1"><CheckCircle className="w-3 h-3" /> Mark as Resolved</button>
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </motion.div>
      </div>

      {selectedAlert && (<motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}><AlertCard alert={selectedAlert} /></motion.div>)}

      <ConfirmModal isOpen={showRespondModal} onClose={() => setShowRespondModal(false)} onConfirm={() => handleRespond(modalAlertId)} title="Respond to Incident" message="Are you sure you want to respond to this incident? This will notify the reporter that you are on the way." type="confirm" />

      <ConfirmModal isOpen={showArrivedModal} onClose={() => setShowArrivedModal(false)} onConfirm={() => handleMarkArrived(modalAlertId)} title="Confirm Arrival" message="Confirm that you have arrived at the incident location. This will notify the reporter that you are on scene." type="success" />

      <ResolveModal isOpen={showResolveModal} onClose={() => setShowResolveModal(false)} onConfirm={handleResolve} alert={alerts.find((a) => (a._id || a.id) === modalAlertId)} />
    </div>
  );
};

export default DashboardFire;
