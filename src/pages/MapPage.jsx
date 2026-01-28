import { useState, useEffect, lazy, Suspense } from 'react';
import { motion } from 'framer-motion';
import { MapPin, Filter, Users, Activity } from 'lucide-react';
const LiveMap = lazy(() => import('../components/LiveMap'));
import AlertCard from '../components/AlertCard';
import { useAuth } from '../context/AuthContext';
import { alertsAPI } from '../services/api';
import io from 'socket.io-client';

const SOCKET_URL = import.meta.env.VITE_API_URL || 'https://alertodepinbackend.onrender.com';

const MapPage = () => {
  const { user } = useAuth();
  const [alerts, setAlerts] = useState([]);
  const [onlineUsers, setOnlineUsers] = useState([]);
  const [selectedAlert, setSelectedAlert] = useState(null);
  const [filterType, setFilterType] = useState('all');
  const [loading, setLoading] = useState(true);
  const [socket, setSocket] = useState(null);

  // Fetch alerts from backend
  useEffect(() => {
    const fetchAlerts = async () => {
      try {
        setLoading(true);
        const response = await alertsAPI.getAll();
        // Filter only active and pending alerts
        const activeAlerts = response.data.filter(
          alert => alert.status === 'active' || alert.status === 'pending'
        );
        setAlerts(activeAlerts);
      } catch (error) {
        console.error('Error fetching alerts:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchAlerts();
    // Refresh alerts every 30 seconds
    const interval = setInterval(fetchAlerts, 30000);
    return () => clearInterval(interval);
  }, []);

  // Setup Socket.IO for real-time updates
  useEffect(() => {
    if (!user) return;

    const newSocket = io(SOCKET_URL, {
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionAttempts: 5
    });

    let locationInterval = null;

    newSocket.on('connect', () => {
      console.log('Connected to Socket.IO server');
      
      // Send user online status with location
      if (navigator.geolocation && user?._id) {
        navigator.geolocation.getCurrentPosition(
          (position) => {
            const userData = {
              userId: user._id,
              location: {
                lat: position.coords.latitude,
                lng: position.coords.longitude
              },
              userType: user.accountType || 'citizen',
              name: user.name || 'User'
            };
            newSocket.emit('user-online', userData);
          },
          (error) => console.error('Geolocation error:', error),
          { enableHighAccuracy: false, timeout: 5000, maximumAge: 60000 }
        );
      }
    });

    // Listen for online users updates
    newSocket.on('online-users-update', (users) => {
      setOnlineUsers(users);
    });

    // Listen for user location updates
    newSocket.on('user-location-update', (data) => {
      setOnlineUsers(prev => {
        const updated = [...prev];
        const index = updated.findIndex(u => u.userId === data.userId);
        if (index !== -1) {
          updated[index] = { ...updated[index], location: data.location };
        }
        return updated;
      });
    });

    // Listen for new alerts
    newSocket.on('new-alert', (alert) => {
      if (alert.status === 'active' || alert.status === 'pending') {
        setAlerts(prev => [alert, ...prev]);
      }
    });

    // Update location every 60 seconds (reduced from 30)
    locationInterval = setInterval(() => {
      if (navigator.geolocation && newSocket.connected) {
        navigator.geolocation.getCurrentPosition(
          (position) => {
            newSocket.emit('update-location', {
              userId: user._id,
              location: {
                lat: position.coords.latitude,
                lng: position.coords.longitude
              }
            });
          },
          (error) => console.error('Geolocation error:', error),
          { enableHighAccuracy: false, timeout: 5000, maximumAge: 60000 }
        );
      }
    }, 60000);

    setSocket(newSocket);

    return () => {
      if (locationInterval) clearInterval(locationInterval);
      if (newSocket) {
        newSocket.off('connect');
        newSocket.off('online-users-update');
        newSocket.off('user-location-update');
        newSocket.off('new-alert');
        newSocket.disconnect();
      }
    };
  }, [user]);

  const filteredAlerts = filterType === 'all' 
    ? alerts 
    : alerts.filter(a => a.type === filterType);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <Activity className="w-8 h-8 text-primary-600 animate-pulse" />
            Live Emergency Map
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            Real-time visualization of emergency alerts and online responders
          </p>
        </div>

        {/* Stats */}
        <div className="flex gap-4">
          <div className="glassmorphism px-4 py-2 rounded-lg">
            <div className="flex items-center gap-2">
              <MapPin className="w-5 h-5 text-red-500" />
              <div>
                <p className="text-xs text-gray-600 dark:text-gray-400">Active Alerts</p>
                <p className="text-lg font-bold text-gray-900 dark:text-white">{alerts.length}</p>
              </div>
            </div>
          </div>
          <div className="glassmorphism px-4 py-2 rounded-lg">
            <div className="flex items-center gap-2">
              <Users className="w-5 h-5 text-green-500" />
              <div>
                <p className="text-xs text-gray-600 dark:text-gray-400">Online Users</p>
                <p className="text-lg font-bold text-gray-900 dark:text-white">{onlineUsers.length}</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Filter Buttons */}
      <div className="flex gap-2 flex-wrap">
        <button
          onClick={() => setFilterType('all')}
          className={`px-4 py-2 rounded-lg transition-all duration-200 flex items-center gap-2 ${
            filterType === 'all'
              ? 'bg-primary-600 text-white shadow-lg scale-105'
              : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:scale-105'
          }`}
        >
          <MapPin className="w-4 h-4" />
          All Alerts
        </button>
        <button
          onClick={() => setFilterType('police')}
          className={`px-4 py-2 rounded-lg transition-all duration-200 flex items-center gap-2 ${
            filterType === 'police'
              ? 'bg-blue-600 text-white shadow-lg scale-105'
              : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:scale-105'
          }`}
        >
          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
            <path d="M12 2L4 5v6.09c0 5.05 3.41 9.76 8 10.91 4.59-1.15 8-5.86 8-10.91V5l-8-3z"/>
          </svg>
          Police
        </button>
        <button
          onClick={() => setFilterType('hospital')}
          className={`px-4 py-2 rounded-lg transition-all duration-200 flex items-center gap-2 ${
            filterType === 'hospital'
              ? 'bg-red-600 text-white shadow-lg scale-105'
              : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:scale-105'
          }`}
        >
          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
            <path d="M19 3H5c-1.1 0-1.99.9-1.99 2L3 19c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-1 11h-4v4h-4v-4H6v-4h4V6h4v4h4v4z"/>
          </svg>
          Medical
        </button>
        <button
          onClick={() => setFilterType('fire')}
          className={`px-4 py-2 rounded-lg transition-all duration-200 flex items-center gap-2 ${
            filterType === 'fire'
              ? 'bg-orange-600 text-white shadow-lg scale-105'
              : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:scale-105'
          }`}
        >
          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
            <path d="M12 23s-8-4.5-8-11.8C4 5 8 1 12 1s8 4 8 10.2c0 7.3-8 11.8-8 11.8zm1-18v8l4-4c0 4-2 6-5 8 1-4-2-6-2-6l1-6z"/>
          </svg>
          Fire
        </button>
        <button
          onClick={() => setFilterType('family')}
          className={`px-4 py-2 rounded-lg transition-all duration-200 flex items-center gap-2 ${
            filterType === 'family'
              ? 'bg-purple-600 text-white shadow-lg scale-105'
              : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:scale-105'
          }`}
        >
          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
            <path d="M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5s-3 1.34-3 3 1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z"/>
          </svg>
          Family
        </button>
      </div>

      {/* Live Map */}
      {loading ? (
        <div className="card p-12 flex items-center justify-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
        </div>
      ) : (
        <div className="card p-0 overflow-hidden">
          <Suspense fallback={<div className="p-12 flex items-center justify-center"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div></div>}>
            <LiveMap 
              alerts={filteredAlerts} 
              onlineUsers={onlineUsers}
              onMarkerClick={setSelectedAlert}
              className="h-[600px]"
            />
          </Suspense>
        </div>
      )}

      {/* Selected Alert Details */}
      {selectedAlert && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <AlertCard alert={selectedAlert} />
        </motion.div>
      )}

      {/* Alert List */}
      {filteredAlerts.length > 0 && (
        <div>
          <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">
            Recent Alerts
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredAlerts.slice(0, 6).map((alert, index) => (
              <motion.div
                key={alert._id || alert.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1 }}
                onClick={() => setSelectedAlert(alert)}
                className="cursor-pointer"
              >
                <AlertCard alert={alert} />
              </motion.div>
            ))}
          </div>
        </div>
      )}

      {filteredAlerts.length === 0 && !loading && (
        <div className="card text-center py-12">
          <MapPin className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <p className="text-gray-600 dark:text-gray-400 text-lg">
            No active alerts at this time
          </p>
        </div>
      )}
    </div>
  );
};

export default MapPage;
