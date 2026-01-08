import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { AlertCircle, Clock, CheckCircle, TrendingUp, Shield, Activity, Users, Edit2, Save, X, Lock, MapPin } from 'lucide-react';
import DashboardHeader from '../components/DashboardHeader';
import LiveMap from '../components/LiveMap';
import AlertCard from '../components/AlertCard';
import { useAuth } from '../context/AuthContext';
import { useNotificationStore } from '../context/store';
import { alertsAPI, usersAPI } from '../services/api';
import io from 'socket.io-client';

const SOCKET_URL = import.meta.env.VITE_API_URL || 'https://alertodepinbackend.onrender.com';

// Mock data
const mockAlerts = [
  {
    id: 1,
    title: 'Medical Emergency',
    description: 'Reported chest pain and difficulty breathing',
    type: 'hospital',
    status: 'pending',
    location: 'Naga City Center',
    timestamp: new Date().toISOString(),
    reporter: 'John Doe',
    coordinates: { lat: 13.6218, lng: 123.1816 },
  },
  {
    id: 2,
    title: 'Robbery in Progress',
    description: 'Suspicious activity near convenience store',
    type: 'police',
    status: 'active',
    location: 'SM City Naga',
    timestamp: new Date(Date.now() - 3600000).toISOString(),
    reporter: 'Jane Smith',
    coordinates: { lat: 13.6191, lng: 123.1973 },
  },
];

const DashboardCitizen = () => {
  const { user } = useAuth();
  const { addNotification } = useNotificationStore();
  const [alerts, setAlerts] = useState([]);
  const [stats, setStats] = useState({
    myAlerts: 0,
    activeAlerts: 0,
    resolvedAlerts: 0,
  });
  const [selectedAlertType, setSelectedAlertType] = useState(null);
  const [showAlertModal, setShowAlertModal] = useState(false);
  const [loading, setLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [alertForm, setAlertForm] = useState({
    title: '',
    description: '',
    notes: '',
  });
  const [editForm, setEditForm] = useState({
    name: '',
    contactNumber: '',
    address: '',
  });
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });
  const [familyMembers, setFamilyMembers] = useState([]);
  const [familySearchQuery, setFamilySearchQuery] = useState('');
  const [familySearchResults, setFamilySearchResults] = useState([]);
  const [familyLoading, setFamilyLoading] = useState(false);

  useEffect(() => {
    fetchData();
    
    // Setup Socket.IO for real-time notifications
    if (!user) return;

    const socket = io(SOCKET_URL, {
      transports: ['websocket', 'polling']
    });

    socket.on('connect', () => {
      console.log('Citizen dashboard connected to Socket.IO');
      // Join user's room for personal notifications
      socket.emit('join-room', user._id);
    });

    // Listen for alert responses
    socket.on('alertResponded', (data) => {
      console.log('Alert responded:', data);
      addNotification({
        type: 'success',
        title: 'Responder On The Way!',
        message: data.message || `${data.alert?.responder?.name || 'A responder'} is en route to your location`,
      });
      
      // Update alert in local state
      setAlerts(prev => prev.map(alert => 
        alert._id === data.alert._id 
          ? { ...alert, status: 'responded', responder: data.alert.responder }
          : alert
      ));
    });
    
    // Listen for alert status updates (arrived, resolved, etc)
    socket.on('alertUpdated', (data) => {
      console.log('Alert updated:', data);
      
      let title = 'Alert Update';
      let message = data.message || 'Your alert has been updated';
      
      if (data.alert?.status === 'active' && data.alert?.arrivedAt) {
        title = 'Responder Arrived!';
        message = `${data.alert?.responder?.name || 'The responder'} has arrived at your location`;
      } else if (data.alert?.status === 'resolved') {
        title = 'Incident Resolved';
        message = 'Your alert has been successfully resolved. Thank you for using AlertoDePin.';
      }
      
      addNotification({
        type: 'info',
        title,
        message,
      });
      
      // Update alert in local state
      setAlerts(prev => prev.map(alert => 
        alert._id === data.alert?._id 
          ? { ...alert, ...data.alert }
          : alert
      ));
    });

    // Listen for alert cancellation (if responder cancels)
    socket.on('alertCancelled', (data) => {
      console.log('Alert cancelled:', data);
      addNotification({
        type: 'info',
        title: 'Alert Update',
        message: data.message || 'Alert status updated',
      });
      
      setAlerts(prev => prev.map(alert => 
        alert._id === data.alert._id 
          ? { ...alert, status: 'cancelled' }
          : alert
      ));
    });

    return () => {
      socket.off('alertResponded');
      socket.off('alertUpdated');
      socket.off('alertCancelled');
      socket.disconnect();
    };
  }, [user]);

  useEffect(() => {
    if (user) {
      setEditForm({
        name: user.name || '',
        contactNumber: user.contactNumber || '',
        address: user.address || '',
      });
      // load family members
      fetchFamilyMembers();
    }
  }, [user]);

  const fetchFamilyMembers = async () => {
    if (!user) return;
    try {
      setFamilyLoading(true);
      const res = await usersAPI.getFamily();
      setFamilyMembers(res.family || []);
    } catch (e) {
      console.error('Failed to fetch family members', e);
    } finally {
      setFamilyLoading(false);
    }
  };

  const handleFamilySearch = async () => {
    if (!familySearchQuery.trim()) return;
    try {
      setFamilyLoading(true);
      const res = await usersAPI.search(familySearchQuery.trim());
      setFamilySearchResults(res.users || []);
    } catch (e) {
      console.error('Family search failed', e);
    } finally {
      setFamilyLoading(false);
    }
  };

  const handleAddFamily = async (memberId) => {
    try {
      setFamilyLoading(true);
      const res = await usersAPI.updateFamily({ action: 'add', memberId });
      setFamilyMembers(res.family || []);
      setFamilySearchResults(prev => prev.filter(p => p._id !== memberId));
      addNotification({ type: 'success', title: 'Added', message: 'Family member added' });
    } catch (e) {
      console.error('Add family failed', e);
      addNotification({ type: 'error', title: 'Failed', message: e.message || 'Could not add family member' });
    } finally {
      setFamilyLoading(false);
    }
  };

  const handleRemoveFamily = async (memberId) => {
    try {
      setFamilyLoading(true);
      const res = await usersAPI.updateFamily({ action: 'remove', memberId });
      setFamilyMembers(res.family || []);
      addNotification({ type: 'success', title: 'Removed', message: 'Family member removed' });
    } catch (e) {
      console.error('Remove family failed', e);
      addNotification({ type: 'error', title: 'Failed', message: e.message || 'Could not remove family member' });
    } finally {
      setFamilyLoading(false);
    }
  };

  // Listen for global 'send-sos' events (dispatched from Sidebar or other places)
  useEffect(() => {
    const handler = () => {
      try { sendSos(); } catch (e) { console.error('send-sos handler error', e); }
    };
    window.addEventListener('send-sos', handler);
    return () => window.removeEventListener('send-sos', handler);
  }, [user]);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [alertsData, statsData] = await Promise.all([
        alertsAPI.getAll(),
        usersAPI.getStats(),
      ]);

      // Filter to show only current user's alerts
      const myAlerts = (alertsData.data || alertsData.alerts || []).filter(
        alert => alert.reporter?._id === user?._id || alert.reporter === user?._id
      );
      
      // Sort by newest first
      myAlerts.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
      
      setAlerts(myAlerts);
      setStats(statsData);
    } catch (error) {
      console.error('Error fetching data:', error);
      addNotification({
        type: 'error',
        title: 'Error',
        message: `Failed to load dashboard data: ${error.message}`,
      });
    } finally {
      setLoading(false);
    }
  };

  const statsDisplay = [
    { label: 'Total Alerts Sent', value: stats.myAlerts || 0, icon: AlertCircle, color: 'bg-blue-600' },
    { label: 'Active Alerts', value: stats.activeAlerts || 0, icon: Clock, color: 'bg-yellow-600' },
    { label: 'Resolved', value: stats.resolvedAlerts || 0, icon: CheckCircle, color: 'bg-green-600' },
  ];

  const alertTypes = [
    { 
      type: 'police', 
      label: 'Police Emergency', 
      icon: Shield, 
      color: 'bg-blue-600 hover:bg-blue-700',
      description: 'Crime, theft, assault, or security threat'
    },
    { 
      type: 'hospital', 
      label: 'Medical Emergency', 
      icon: Activity, 
      color: 'bg-red-600 hover:bg-red-700',
      description: 'Medical emergency, injury, or health crisis'
    },
    { 
      type: 'fire', 
      label: 'Fire Alert', 
      icon: Users, 
      color: 'bg-orange-600 hover:bg-orange-700',
      description: 'Notify fire responders and your registered family members'
    },
  ];

  const handleSendAlert = (type) => {
    setSelectedAlertType(type);
    setAlertForm({
      title: `${type.label} - Emergency`,
      description: '',
      notes: '',
    });
    setShowAlertModal(true);
  };

  const confirmSendAlert = async () => {
    if (!alertForm.description.trim()) {
      addNotification({
        type: 'error',
        title: 'Missing Information',
        message: 'Please provide a description of the emergency.',
      });
      return;
    }

    // Get user's current location
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        async (position) => {
          try {
            const longitude = position.coords.longitude;
            const latitude = position.coords.latitude;
            
            // Get address from coordinates using reverse geocoding
            let address = 'Location from GPS';
            try {
              const response = await fetch(
                `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}`
              );
              const data = await response.json();
              if (data.display_name) {
                address = data.display_name;
              }
            } catch (geoError) {
              console.log('Geocoding failed, using default address:', geoError);
              address = user?.address || `${latitude.toFixed(6)}, ${longitude.toFixed(6)}`;
            }

            const alertData = {
              title: alertForm.title,
              description: alertForm.description,
              type: selectedAlertType.type,
              priority: 'high',
              location: {
                coordinates: {
                  type: 'Point',
                  coordinates: [longitude, latitude],
                },
                address: address,
              },
              notes: alertForm.notes,
            };

            // Update user location (correct order: [longitude, latitude])
            await usersAPI.updateLocation([longitude, latitude]);

            // Create alert
            const result = await alertsAPI.create(alertData);
            
            addNotification({
              type: 'success',
              title: `${selectedAlertType.label} Sent!`,
              message: `Your emergency alert has been sent to ${selectedAlertType.type} responders.`,
            });

            setShowAlertModal(false);
            setSelectedAlertType(null);
            setAlertForm({ title: '', description: '', notes: '' });
            
            // Refresh alerts
            fetchData();
          } catch (error) {
            console.error('Error sending alert:', error);
            addNotification({
              type: 'error',
              title: 'Failed to Send Alert',
              message: error.message || 'Please try again.',
            });
          }
        },
        (error) => {
          addNotification({
            type: 'error',
            title: 'Location Error',
            message: 'Unable to get your location. Please enable location services.',
          });
          console.error('Geolocation error:', error);
        },
        {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 0,
        }
      );
    } else {
      addNotification({
        type: 'error',
        title: 'Location Not Supported',
        message: 'Your browser does not support geolocation.',
      });
    }
  };

  const handleEditProfile = async () => {
    try {
      const response = await usersAPI.updateProfile(editForm);
      
      // Update user in AuthContext
      const updatedUser = { ...user, ...response.user };
      localStorage.setItem('user', JSON.stringify(updatedUser));
      
      addNotification({
        type: 'success',
        title: 'Profile Updated',
        message: 'Your profile has been updated successfully',
      });
      
      setIsEditing(false);
      
      // Refresh to get updated data
      window.location.reload();
    } catch (error) {
      addNotification({
        type: 'error',
        title: 'Update Failed',
        message: error.message || 'Failed to update profile',
      });
    }
  };

  const handleChangePassword = async () => {
    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      addNotification({
        type: 'error',
        title: 'Password Mismatch',
        message: 'New password and confirm password do not match',
      });
      return;
    }

    if (passwordForm.newPassword.length < 6) {
      addNotification({
        type: 'error',
        title: 'Invalid Password',
        message: 'Password must be at least 6 characters long',
      });
      return;
    }

    try {
      await usersAPI.changePassword({
        currentPassword: passwordForm.currentPassword,
        newPassword: passwordForm.newPassword,
      });

      addNotification({
        type: 'success',
        title: 'Password Changed',
        message: 'Your password has been changed successfully',
      });

      setIsChangingPassword(false);
      setPasswordForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
    } catch (error) {
      addNotification({
        type: 'error',
        title: 'Password Change Failed',
        message: error.message || 'Failed to change password',
      });
    }
  };

  const handleCancelAlert = async (alertId) => {
    if (!confirm('Are you sure you want to cancel this alert? This action cannot be undone.')) {
      return;
    }

    try {
      await alertsAPI.cancel(alertId);
      addNotification({
        type: 'success',
        title: 'Alert Cancelled',
        message: 'Your alert has been cancelled successfully.',
      });
      fetchData(); // Refresh alerts
    } catch (error) {
      console.error('Error cancelling alert:', error);
      addNotification({
        type: 'error',
        title: 'Failed to Cancel',
        message: error.message || 'Unable to cancel alert. Please try again.',
      });
    }
  };

  // Immediate SOS sender (used by Quick Actions SOS button)
  const sendSos = async () => {
    const Swal = window.Swal;
    const premiumClasses = {
      popup: 'swal2-popup premium',
      title: 'swal2-title premium-title',
      htmlContainer: 'swal2-html-container premium-content',
      confirmButton: 'swal2-confirm btn-premium',
      cancelButton: 'swal2-cancel btn-secondary',
    };

    const sosTitle = 'Emergency SOS';
    const sosDescription = 'SOS - Immediate assistance required';
    const sosType = 'police';

    const createAndSend = async (longitude, latitude, address) => {
      const alertData = {
        title: sosTitle,
        description: sosDescription,
        type: sosType,
        priority: 'high',
        location: {
          coordinates: {
            type: 'Point',
            coordinates: [longitude, latitude],
          },
          address,
        },
        notes: '',
      };

      await usersAPI.updateLocation([longitude, latitude]);
      await alertsAPI.create(alertData);
    };

    const handleSendWithCoords = async (longitude, latitude) => {
      if (!longitude || !latitude) {
        if (Swal) {
          Swal.close();
          Swal.fire({ icon: 'error', title: 'Location Error', html: 'Unable to determine location.', customClass: premiumClasses, confirmButtonText: 'Close' });
        } else {
          addNotification({ type: 'error', title: 'Location Error', message: 'Unable to determine location.' });
        }
        return;
      }

      if (Swal) {
        Swal.fire({
          title: 'Sending SOS...',
          html: '<div style="display:flex;flex-direction:column;gap:6px"><strong>Sending secure alert</strong><span style="color:rgba(15,23,42,0.65)">We are notifying responders near you.</span></div>',
          allowOutsideClick: false,
          didOpen: () => Swal.showLoading(),
          customClass: premiumClasses,
        });
      }

      // try reverse geocode
      let address = user?.address || `${latitude.toFixed(6)}, ${longitude.toFixed(6)}`;
      try {
        const response = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}`);
        const data = await response.json();
        if (data.display_name) address = data.display_name;
      } catch (e) {
        // ignore -- fallback to coords
      }

      try {
        await createAndSend(longitude, latitude, address);
        if (Swal) {
          Swal.close();
          Swal.fire({
            icon: 'success',
            title: 'SOS Sent',
            html: `<div style="display:flex;flex-direction:column;gap:6px"><strong>Help is on the way.</strong><span style=\"color:rgba(15,23,42,0.75)\">${address || 'Location unavailable'}</span></div>`,
            confirmButtonText: 'Done',
            customClass: premiumClasses,
          });
        } else {
          addNotification({ type: 'success', title: 'SOS Sent', message: 'Emergency SOS has been sent to responders.' });
        }
        fetchData();
      } catch (err) {
        console.error('SOS send failed:', err);
        if (Swal) {
          Swal.close();
          Swal.fire({ icon: 'error', title: 'SOS Failed', html: err.message || 'Please try again.', customClass: premiumClasses, confirmButtonText: 'Close' });
        } else {
          addNotification({ type: 'error', title: 'SOS Failed', message: err.message || 'Please try again.' });
        }
      }
    };

    // Primary: browser geolocation
    if (navigator.geolocation) {
      // show loading immediately
      if (Swal) Swal.fire({ title: 'Locating you…', allowOutsideClick: false, didOpen: () => Swal.showLoading(), customClass: premiumClasses });

      navigator.geolocation.getCurrentPosition(
        (position) => {
          const longitude = position.coords.longitude;
          const latitude = position.coords.latitude;
          handleSendWithCoords(longitude, latitude);
        },
        async (error) => {
          console.warn('Geolocation error:', error);
          // If permission denied or other error, try IP fallback
          try {
            if (window.Swal) {
              Swal.close();
              Swal.fire({ title: 'Using approximate location', html: 'Location permission denied. Attempting approximate location via IP.', icon: 'info', customClass: premiumClasses, confirmButtonText: 'Continue' });
            }

            // IP fallback (approximate)
            const ipRes = await fetch('https://ipapi.co/json/');
            const ipData = await ipRes.json();
            const lat = parseFloat(ipData.latitude || ipData.lat || ipData.latitude);
            const lon = parseFloat(ipData.longitude || ipData.lon || ipData.longitude);

            if (!isNaN(lat) && !isNaN(lon)) {
              handleSendWithCoords(lon, lat);
            } else {
              if (window.Swal) {
                Swal.fire({ icon: 'error', title: 'Location Error', html: 'Unable to get location. Please enable location services.', customClass: premiumClasses });
              } else {
                addNotification({ type: 'error', title: 'Location Error', message: 'Unable to get location. Please enable location services.' });
              }
            }
          } catch (e) {
            console.error('IP fallback failed:', e);
            if (window.Swal) {
              Swal.fire({ icon: 'error', title: 'Location Error', html: 'Unable to get your location. Please enable location services.', customClass: premiumClasses });
            } else {
              addNotification({ type: 'error', title: 'Location Error', message: 'Unable to get your location. Please enable location services.' });
            }
          }
        },
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
      );
    } else {
      // no navigator geolocation -- try IP fallback
      try {
        if (window.Swal) Swal.fire({ title: 'Using approximate location', html: 'Browser does not support geolocation. Attempting approximate location via IP.', icon: 'info', customClass: premiumClasses });
        const ipRes = await fetch('https://ipapi.co/json/');
        const ipData = await ipRes.json();
        const lat = parseFloat(ipData.latitude || ipData.lat || ipData.latitude);
        const lon = parseFloat(ipData.longitude || ipData.lon || ipData.longitude);
        if (!isNaN(lat) && !isNaN(lon)) {
          handleSendWithCoords(lon, lat);
        } else {
          if (window.Swal) Swal.fire({ icon: 'error', title: 'Location Not Supported', html: 'Your browser does not support geolocation.', customClass: premiumClasses });
          else addNotification({ type: 'error', title: 'Location Not Supported', message: 'Your browser does not support geolocation.' });
        }
      } catch (e) {
        console.error('IP fallback failed:', e);
        if (window.Swal) Swal.fire({ icon: 'error', title: 'Location Error', html: 'Unable to determine location.', customClass: premiumClasses });
        else addNotification({ type: 'error', title: 'Location Error', message: 'Unable to determine location.' });
      }
    }
  };

  return (
    <div className="space-y-6">
      <DashboardHeader
        title={`Welcome back, ${user?.name}!`}
        subtitle="Monitor your emergency alerts and account status"
        stats={statsDisplay}
      />

      {/* Live Map for citizen - shows recent alerts nearby */}
      <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} className="card p-0 overflow-hidden">
        <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">My Alerts Map</h2>
          <p className="text-sm text-gray-600 dark:text-gray-400">Shows your recent alerts and nearby incidents</p>
        </div>
        <div className="h-[520px] md:h-[640px] lg:h-[760px]">
          <LiveMap alerts={alerts} onMarkerClick={(a) => { setSelectedAlert(a); window.scrollTo({ top: 0, behavior: 'smooth' }); }} className="h-full" />
        </div>
      </motion.div>

      {/* Emergency Alert moved to bottom for easier reach */}

      {/* My Recent Alerts - Second Priority */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="card"
      >
        <div className="flex justify-between items-center mb-6">
          <div>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
              My Recent Alerts
            </h2>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
              Track your emergency alerts and their status
            </p>
          </div>
          <button className="btn-secondary text-sm">
            View All
          </button>
        </div>
        {loading ? (
          <div className="text-center py-12">
            <div className="inline-block animate-spin rounded-full h-12 w-12 border-4 border-primary-600 border-t-transparent"></div>
            <p className="mt-4 text-gray-600 dark:text-gray-400">Loading alerts...</p>
          </div>
        ) : alerts.length === 0 ? (
          <div className="text-center py-12 bg-gray-50 dark:bg-gray-900 rounded-lg">
            <AlertCircle className="w-16 h-16 mx-auto text-gray-400 mb-4" />
            <p className="text-gray-600 dark:text-gray-400 font-medium">No alerts yet</p>
            <p className="text-sm text-gray-500 dark:text-gray-500 mt-2">
              Send your first emergency alert using the buttons above
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {alerts.slice(0, 4).map((alert) => (
              <div 
                key={alert._id}
                className="p-4 border border-gray-200 dark:border-gray-700 rounded-lg hover:shadow-md transition-shadow"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <span className={`px-2 py-1 rounded text-xs font-bold uppercase ${
                        alert.type === 'police' ? 'bg-blue-500 text-white' :
                        alert.type === 'hospital' ? 'bg-red-500 text-white' :
                        alert.type === 'fire' ? 'bg-orange-500 text-white' :
                        alert.type === 'family' ? 'bg-purple-500 text-white' :
                        'bg-gray-500 text-white'
                      }`}>
                        {alert.type}
                      </span>
                      <span className={`px-2 py-1 rounded text-xs font-semibold ${
                        alert.status === 'active' ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300' :
                        alert.status === 'pending' ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300' :
                        alert.status === 'responded' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300' :
                        alert.status === 'cancelled' ? 'bg-gray-100 text-gray-700 dark:bg-gray-900/30 dark:text-gray-300' :
                        'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300'
                      }`}>
                        {alert.status}
                      </span>
                    </div>
                    <h3 className="font-semibold text-gray-900 dark:text-white mb-1">
                      {alert.title || alert.description}
                    </h3>
                    <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                      {alert.description}
                    </p>
                    <div className="flex items-center gap-3 text-xs text-gray-500 dark:text-gray-500">
                      <span className="flex items-center gap-1">
                        <MapPin className="w-3 h-3" />
                        {alert.location?.address || 'Location unavailable'}
                      </span>
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {new Date(alert.createdAt).toLocaleString()}
                      </span>
                    </div>
                    
                    {/* Show responder info */}
                    {alert.responder && (
                      <div className="mt-2 p-2 bg-blue-50 dark:bg-blue-900/20 rounded">
                        <p className="text-sm text-blue-700 dark:text-blue-300 font-medium flex items-center gap-1">
                          <CheckCircle className="w-4 h-4" />
                          Responder: {alert.responder.name || 'Officer'}
                        </p>
                        {alert.responder.contactNumber && (
                          <p className="text-xs text-blue-600 dark:text-blue-400 mt-1">
                            📞 {alert.responder.contactNumber}
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                  
                  {/* Cancel button - only show for active/pending alerts WITHOUT responder */}
                  {(alert.status === 'active' || alert.status === 'pending') && !alert.responder && (
                    <button
                      onClick={() => handleCancelAlert(alert._id)}
                      className="ml-3 px-3 py-1.5 bg-red-100 hover:bg-red-200 dark:bg-red-900/30 dark:hover:bg-red-900/50 text-red-700 dark:text-red-300 rounded-lg transition-colors text-sm font-medium flex items-center gap-1"
                      title="Cancel Alert"
                    >
                      <X className="w-4 h-4" />
                      Cancel
                    </button>
                  )}
                  
                  {/* Show responded badge on the right */}
                  {alert.responder && alert.status === 'responded' && (
                    <div className="ml-3 px-3 py-1.5 bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300 rounded-lg text-xs font-medium flex items-center gap-1">
                      <CheckCircle className="w-3 h-3" />
                      Help is on the way
                    </div>
                  )}
                </div>
              </div>
            ))}
            
            {alerts.length > 4 && (
              <button className="w-full py-2 text-sm text-primary-600 hover:text-primary-700 dark:text-primary-400 dark:hover:text-primary-300 font-medium">
                View All {alerts.length} Alerts →
              </button>
            )}
          </div>
        )}
      </motion.div>

      {/* Bottom Row - Account Info & Quick Actions */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.2 }}
          className="card"
        >
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-bold text-gray-900 dark:text-white">
              Account Information
            </h2>
            <div className="flex gap-2">
              {!isEditing && !isChangingPassword && (
                <>
                  <button
                    onClick={() => setIsEditing(true)}
                    className="p-2 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors"
                    title="Edit Profile"
                  >
                    <Edit2 className="w-5 h-5" />
                  </button>
                  <button
                    onClick={() => setIsChangingPassword(true)}
                    className="p-2 text-purple-600 hover:bg-purple-50 dark:hover:bg-purple-900/20 rounded-lg transition-colors"
                    title="Change Password"
                  >
                    <Lock className="w-5 h-5" />
                  </button>
                </>
              )}
            </div>
          </div>

          {isChangingPassword ? (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Current Password
                </label>
                <input
                  type="password"
                  value={passwordForm.currentPassword}
                  onChange={(e) => setPasswordForm({...passwordForm, currentPassword: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                  placeholder="Enter current password"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  New Password
                </label>
                <input
                  type="password"
                  value={passwordForm.newPassword}
                  onChange={(e) => setPasswordForm({...passwordForm, newPassword: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                  placeholder="Enter new password"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Confirm New Password
                </label>
                <input
                  type="password"
                  value={passwordForm.confirmPassword}
                  onChange={(e) => setPasswordForm({...passwordForm, confirmPassword: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                  placeholder="Confirm new password"
                />
              </div>
              <div className="flex gap-2">
                <button onClick={handleChangePassword} className="btn-primary flex items-center gap-2 text-sm">
                  <Save className="w-4 h-4" />
                  Change Password
                </button>
                <button 
                  onClick={() => {
                    setIsChangingPassword(false);
                    setPasswordForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
                  }}
                  className="btn-secondary flex items-center gap-2 text-sm"
                >
                  <X className="w-4 h-4" />
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="flex justify-between items-center py-2 border-b border-gray-200 dark:border-gray-700">
                <span className="text-gray-600 dark:text-gray-400 text-sm">Name:</span>
                {isEditing ? (
                  <input
                    type="text"
                    value={editForm.name}
                    onChange={(e) => setEditForm({...editForm, name: e.target.value})}
                    className="px-2 py-1 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm"
                  />
                ) : (
                  <span className="font-medium text-gray-900 dark:text-white">{user?.name}</span>
                )}
              </div>
              <div className="flex justify-between items-center py-2 border-b border-gray-200 dark:border-gray-700">
                <span className="text-gray-600 dark:text-gray-400 text-sm">Email:</span>
                <span className="font-medium text-gray-900 dark:text-white">{user?.email}</span>
              </div>
              <div className="flex justify-between items-center py-2 border-b border-gray-200 dark:border-gray-700">
                <span className="text-gray-600 dark:text-gray-400 text-sm">Account Type:</span>
                <span className="font-medium text-gray-900 dark:text-white capitalize">{user?.userType}</span>
              </div>
              <div className="flex justify-between items-center py-2 border-b border-gray-200 dark:border-gray-700">
                <span className="text-gray-600 dark:text-gray-400 text-sm">Contact:</span>
                {isEditing ? (
                  <input
                    type="text"
                    value={editForm.contactNumber}
                    onChange={(e) => setEditForm({...editForm, contactNumber: e.target.value})}
                    className="px-2 py-1 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm"
                  />
                ) : (
                  <span className="font-medium text-gray-900 dark:text-white">{user?.contactNumber || 'Not set'}</span>
                )}
              </div>
              <div className="flex justify-between items-center py-2 border-b border-gray-200 dark:border-gray-700">
                <span className="text-gray-600 dark:text-gray-400 text-sm">Address:</span>
                {isEditing ? (
                  <input
                    type="text"
                    value={editForm.address}
                    onChange={(e) => setEditForm({...editForm, address: e.target.value})}
                    className="px-2 py-1 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800 text-gray-900 dark:text-white w-48 text-sm"
                  />
                ) : (
                  <span className="font-medium text-gray-900 dark:text-white text-right">{user?.address || 'Not set'}</span>
                )}
              </div>
              <div className="flex justify-between items-center py-2">
                <span className="text-gray-600 dark:text-gray-400 text-sm">Status:</span>
                <span className="font-medium text-green-600 dark:text-green-400 capitalize">{user?.status || 'Active'}</span>
              </div>
              {/* Family Members Management */}
              <div className="pt-4 border-t border-gray-100 dark:border-gray-800">
                <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Family Members</h3>
                {familyLoading ? (
                  <p className="text-sm text-gray-500">Loading...</p>
                ) : (
                  <div className="space-y-2">
                    {familyMembers.length === 0 ? (
                      <p className="text-sm text-gray-500">No family members added yet.</p>
                    ) : (
                      familyMembers.map((m) => (
                        <div key={m._id} className="flex items-center justify-between bg-gray-50 dark:bg-gray-900/20 p-2 rounded">
                          <div>
                            <div className="font-medium text-gray-900 dark:text-white">{m.name}</div>
                            <div className="text-xs text-gray-500">{m.email}</div>
                          </div>
                          <button onClick={() => handleRemoveFamily(m._id)} className="text-red-600 hover:underline text-sm">Remove</button>
                        </div>
                      ))
                    )}

                    <div className="mt-2">
                      <label className="block text-xs text-gray-500 mb-1">Add family member by name or email</label>
                      <div className="flex gap-2">
                        <input value={familySearchQuery} onChange={(e) => setFamilySearchQuery(e.target.value)} placeholder="Search name or email" className="flex-1 px-3 py-2 border rounded bg-white dark:bg-gray-800 text-sm" />
                        <button onClick={handleFamilySearch} className="btn-primary text-sm">Search</button>
                      </div>

                      {familySearchResults.length > 0 && (
                        <div className="mt-2 space-y-2">
                          {familySearchResults.map(r => (
                            <div key={r._id} className="flex items-center justify-between p-2 bg-white dark:bg-gray-800 rounded shadow-sm">
                              <div>
                                <div className="font-medium">{r.name}</div>
                                <div className="text-xs text-gray-500">{r.email}</div>
                              </div>
                              <button onClick={() => handleAddFamily(r._id)} className="btn-primary text-sm">Add</button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
              
              {isEditing && (
                <div className="flex gap-2 pt-3">
                  <button onClick={handleEditProfile} className="btn-primary flex items-center gap-2 text-sm">
                    <Save className="w-4 h-4" />
                    Save Changes
                  </button>
                  <button 
                    onClick={() => {
                      setIsEditing(false);
                      setEditForm({
                        name: user?.name || '',
                        contactNumber: user?.contactNumber || '',
                        address: user?.address || '',
                      });
                    }}
                    className="btn-secondary flex items-center gap-2 text-sm"
                  >
                    <X className="w-4 h-4" />
                    Cancel
                  </button>
                </div>
              )}
            </div>
          )}
        </motion.div>

        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.2 }}
          className="card"
        >
          <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">
            Quick Actions
          </h2>
          <div className="space-y-3">
            <button type="button" onClick={sendSos} style={{ pointerEvents: 'auto' }} className="w-full btn-danger flex items-center justify-center gap-2 py-4 hover:scale-105 transition-transform cursor-pointer relative z-50">
              <AlertCircle className="w-5 h-5" />
              <span className="font-semibold">Emergency SOS (All Services)</span>
            </button>
            <button className="w-full btn-secondary flex items-center justify-center gap-2 py-3 hover:scale-105 transition-transform">
              <Clock className="w-5 h-5" />
              View Alert History
            </button>
            <button className="w-full btn-secondary flex items-center justify-center gap-2 py-3 hover:scale-105 transition-transform">
              <Users className="w-5 h-5" />
              Manage Emergency Contacts
            </button>
          </div>
        </motion.div>
      </div>

      {/* Emergency Alert Buttons - Most Important (moved) */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="card bg-gradient-to-br from-red-50 to-orange-50 dark:from-red-900/10 dark:to-orange-900/10 border-2 border-red-200 dark:border-red-800 mt-6"
      >
        <div className="flex items-center gap-3 mb-4">
          <div className="w-12 h-12 bg-red-600 rounded-full flex items-center justify-center animate-pulse">
            <AlertCircle className="w-6 h-6 text-white" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-gray-900 dark:text-white">
              Emergency Alert
            </h2>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Send immediate help request to responders
            </p>
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {alertTypes.map((alertType) => {
            const Icon = alertType.icon;
            return (
              <motion.button
                key={alertType.type}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => handleSendAlert(alertType)}
                className={`${alertType.color} text-white p-6 rounded-xl shadow-lg hover:shadow-xl transition-all duration-200`}
              >
                <Icon className="w-12 h-12 mx-auto mb-3" />
                <h3 className="font-bold text-lg mb-2">{alertType.label}</h3>
                <p className="text-sm opacity-90">{alertType.description}</p>
              </motion.button>
            );
          })}
        </div>
      </motion.div>

      {/* Confirmation Modal */}
      {showAlertModal && selectedAlertType && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-md w-full p-6"
          >
            <div className="text-center mb-6">
              {(() => {
                const Icon = selectedAlertType.icon;
                return <Icon className="w-16 h-16 mx-auto mb-4 text-danger-600" />;
              })()}
              <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
                Send {selectedAlertType.label}
              </h3>
              <p className="text-gray-600 dark:text-gray-400">
                Provide details about the emergency
              </p>
            </div>

            <div className="space-y-4 mb-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Title
                </label>
                <input
                  type="text"
                  value={alertForm.title}
                  onChange={(e) => setAlertForm({ ...alertForm, title: e.target.value })}
                  className="w-full px-4 py-2 bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent text-gray-900 dark:text-white"
                  placeholder="Brief title of the emergency"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Description *
                </label>
                <textarea
                  value={alertForm.description}
                  onChange={(e) => setAlertForm({ ...alertForm, description: e.target.value })}
                  className="w-full px-4 py-2 bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent text-gray-900 dark:text-white"
                  rows="3"
                  placeholder="Describe what's happening..."
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Additional Notes (Optional)
                </label>
                <textarea
                  value={alertForm.notes}
                  onChange={(e) => setAlertForm({ ...alertForm, notes: e.target.value })}
                  className="w-full px-4 py-2 bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent text-gray-900 dark:text-white"
                  rows="2"
                  placeholder="Any other important information..."
                />
              </div>
            </div>

            <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4 mb-6">
              <p className="text-sm text-yellow-800 dark:text-yellow-400">
                <strong>⚠️ Important:</strong> Your current location will be shared with emergency responders. Only send alerts for real emergencies.
              </p>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => {
                  setShowAlertModal(false);
                  setSelectedAlertType(null);
                }}
                className="flex-1 px-4 py-3 bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200 rounded-lg font-medium hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={confirmSendAlert}
                className="flex-1 px-4 py-3 bg-danger-600 hover:bg-danger-700 text-white rounded-lg font-medium transition-colors"
              >
                Send Alert Now
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
};

export default DashboardCitizen;
