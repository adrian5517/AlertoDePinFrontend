import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { AlertCircle, Search, Filter, X, CheckCircle, Loader2, Clock, Shield, Activity, MapPin, Phone, User } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { alertsAPI } from '../services/api';
import toast from 'react-hot-toast';

const AlertsPage = () => {
  const { user } = useAuth();
  const [alerts, setAlerts] = useState([]);
  const [filterStatus, setFilterStatus] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchAlerts();
  }, [user]);

  const fetchAlerts = async () => {
    try {
      setLoading(true);
      const response = await alertsAPI.getAll();
      console.log('My Alerts - Full API response:', response);
      console.log('My Alerts - Current user:', user);
      
      const alertsData = response.data || response.alerts || [];
      console.log('My Alerts - Total alerts from API:', alertsData.length);
      console.log('My Alerts - Sample alert:', alertsData[0]);
      
      // Backend already filters by reporter for citizens, so use all alerts returned
      const myAlerts = alertsData;
      
      // Sort by most recent first
      myAlerts.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
      
      console.log('My Alerts - Final alerts count:', myAlerts.length);
      setAlerts(myAlerts);
    } catch (error) {
      console.error('Error fetching alerts:', error);
      toast.error(error.message || 'Failed to load alerts');
    } finally {
      setLoading(false);
    }
  };

  const handleCancelAlert = async (alertId) => {
    if (!window.confirm('Are you sure you want to cancel this alert?')) {
      return;
    }

    try {
      await alertsAPI.cancel(alertId);
      toast.success('Alert cancelled successfully');
      fetchAlerts(); // Refresh the list
    } catch (error) {
      console.error('Error cancelling alert:', error);
      toast.error(error.response?.data?.message || 'Failed to cancel alert');
    }
  };

  const filteredAlerts = alerts.filter(alert => {
    const matchesStatus = filterStatus === 'all' || alert.status === filterStatus;
    const matchesSearch = (alert.type?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         alert.description?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         alert.location?.toLowerCase().includes(searchQuery.toLowerCase()));
    return matchesStatus && matchesSearch;
  });

  const statusCounts = {
    all: alerts.length,
    pending: alerts.filter(a => a.status === 'pending').length,
    active: alerts.filter(a => a.status === 'active').length,
    responded: alerts.filter(a => a.status === 'responded').length,
    resolved: alerts.filter(a => a.status === 'resolved').length,
  };

  const getStatusIcon = (status) => {
    switch(status) {
      case 'pending': return <Clock className="w-5 h-5" />;
      case 'responded': return <Activity className="w-5 h-5" />;
      case 'active': return <Shield className="w-5 h-5" />;
      case 'resolved': return <CheckCircle className="w-5 h-5" />;
      default: return <AlertCircle className="w-5 h-5" />;
    }
  };

  const getStatusColor = (status) => {
    switch(status) {
      case 'pending': return 'bg-yellow-500';
      case 'responded': return 'bg-blue-500';
      case 'active': return 'bg-orange-500';
      case 'resolved': return 'bg-green-500';
      default: return 'bg-gray-500';
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-gray-100 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900 p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-8"
        >
          <h1 className="text-4xl font-bold bg-gradient-to-r from-primary-600 to-blue-600 bg-clip-text text-transparent mb-2">
            My Alert History
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            Track and manage all your emergency alerts
          </p>
        </motion.div>

        {/* Stats Cards */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="grid grid-cols-2 md:grid-cols-5 gap-3"
        >
          {Object.entries(statusCounts).map(([status, count], index) => (
            <motion.button
              key={status}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: index * 0.05 }}
              whileHover={{ scale: 1.05, y: -5 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => setFilterStatus(status)}
              className={`relative overflow-hidden p-4 rounded-xl transition-all duration-300 ${
                filterStatus === status
                  ? 'bg-gradient-to-br from-primary-500 to-primary-600 text-white shadow-lg shadow-primary-500/50'
                  : 'bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 hover:border-primary-300 dark:hover:border-primary-600 hover:shadow-md'
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <span className={`${filterStatus === status ? 'text-white' : 'text-gray-400'}`}>
                  {getStatusIcon(status)}
                </span>
                {filterStatus === status && (
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    className="w-2 h-2 bg-white rounded-full"
                  />
                )}
              </div>
              <p className={`text-3xl font-bold mb-1 ${filterStatus === status ? 'text-white' : 'text-gray-900 dark:text-white'}`}>
                {count}
              </p>
              <p className={`text-xs font-medium capitalize ${filterStatus === status ? 'text-white/90' : 'text-gray-600 dark:text-gray-400'}`}>
                {status === 'all' ? 'Total Alerts' : status}
              </p>
            </motion.button>
          ))}
        </motion.div>

        {/* Search Bar */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-4"
        >
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              placeholder="Search by type, description, or location..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-12 pr-4 py-3 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white placeholder-gray-400 focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none transition-all"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-4 top-1/2 -translate-y-1/2 p-1 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-full transition-colors"
              >
                <X className="w-4 h-4 text-gray-400" />
              </button>
            )}
          </div>
        </motion.div>

        {/* Alerts List */}
        <AnimatePresence mode="wait">
          {loading ? (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="bg-white dark:bg-gray-800 rounded-xl shadow-lg text-center py-16"
            >
              <Loader2 className="w-16 h-16 text-primary-500 animate-spin mx-auto mb-4" />
              <p className="text-gray-600 dark:text-gray-400 font-medium">Loading your alerts...</p>
            </motion.div>
          ) : (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="space-y-4"
            >
              {filteredAlerts.length > 0 ? (
                filteredAlerts.map((alert, index) => (
                  <motion.div
                    key={alert._id}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.05 }}
                    whileHover={{ scale: 1.01, y: -2 }}
                    className="bg-white dark:bg-gray-800 rounded-xl shadow-lg hover:shadow-xl transition-all overflow-hidden border border-gray-100 dark:border-gray-700"
                  >
                    {/* Status Bar */}
                    <div className={`h-1.5 ${getStatusColor(alert.status)}`} />
                    
                    <div className="p-6">
                      <div className="flex items-start justify-between gap-4">
                        {/* Main Content */}
                        <div className="flex-1 space-y-4">
                          {/* Header with badges */}
                          <div className="flex flex-wrap items-center gap-2">
                            <span className={`px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wide ${
                              alert.type === 'police' ? 'bg-blue-500 text-white' :
                              alert.type === 'hospital' ? 'bg-red-500 text-white' :
                              alert.type === 'fire' ? 'bg-orange-500 text-white' :
                              'bg-purple-500 text-white'
                            }`}>
                              {alert.type}
                            </span>
                            
                            <span className={`px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wide flex items-center gap-1 ${
                              alert.status === 'pending' ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300' :
                              alert.status === 'active' ? 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300' :
                              alert.status === 'responded' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300' :
                              alert.status === 'resolved' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300' :
                              'bg-gray-100 text-gray-700 dark:bg-gray-900/30 dark:text-gray-300'
                            }`}>
                              {getStatusIcon(alert.status)}
                              {alert.status}
                            </span>

                            <span className="text-xs text-gray-400 dark:text-gray-500 ml-auto">
                              {new Date(alert.createdAt).toLocaleString('en-US', {
                                month: 'short',
                                day: 'numeric',
                                year: 'numeric',
                                hour: '2-digit',
                                minute: '2-digit'
                              })}
                            </span>
                          </div>
                          
                          {/* Description */}
                          <p className="text-lg font-semibold text-gray-900 dark:text-white">
                            {alert.description || 'Emergency alert'}
                          </p>
                          
                          {/* Location */}
                          <div className="flex items-start gap-2 text-gray-600 dark:text-gray-400">
                            <MapPin className="w-5 h-5 text-primary-500 flex-shrink-0 mt-0.5" />
                            <span className="text-sm">
                              {typeof alert.location === 'string' 
                                ? alert.location 
                                : alert.location?.address || 'Location not specified'}
                            </span>
                          </div>
                          
                          {/* Responder Info */}
                          {alert.responder && (
                            <motion.div
                              initial={{ opacity: 0, y: 10 }}
                              animate={{ opacity: 1, y: 0 }}
                              className="bg-gradient-to-r from-blue-50 to-blue-100 dark:from-blue-900/20 dark:to-blue-800/20 rounded-lg p-4 border border-blue-200 dark:border-blue-800"
                            >
                              <div className="flex items-center gap-3 mb-2">
                                <div className="w-10 h-10 bg-blue-500 rounded-full flex items-center justify-center">
                                  <User className="w-5 h-5 text-white" />
                                </div>
                                <div>
                                  <p className="text-sm font-semibold text-blue-900 dark:text-blue-100">
                                    {alert.responder.name}
                                  </p>
                                  <p className="text-xs text-blue-600 dark:text-blue-400">
                                    Assigned Responder
                                  </p>
                                </div>
                              </div>
                              {alert.responder.contactNumber && (
                                <div className="flex items-center gap-2 text-blue-700 dark:text-blue-300">
                                  <Phone className="w-4 h-4" />
                                  <span className="text-sm font-medium">{alert.responder.contactNumber}</span>
                                </div>
                              )}
                            </motion.div>
                          )}
                        </div>
                        
                        {/* Action Buttons */}
                        <div className="flex flex-col gap-2">
                          {/* Cancel button - only show for active/pending alerts WITHOUT responder */}
                          {(alert.status === 'active' || alert.status === 'pending') && !alert.responder && (
                            <motion.button
                              whileHover={{ scale: 1.05 }}
                              whileTap={{ scale: 0.95 }}
                              onClick={() => handleCancelAlert(alert._id)}
                              className="px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg transition-colors text-sm font-semibold flex items-center gap-2 shadow-lg shadow-red-500/30"
                              title="Cancel Alert"
                            >
                              <X className="w-4 h-4" />
                              Cancel
                            </motion.button>
                          )}
                          
                          {/* Show badge if responder assigned */}
                          {alert.responder && (alert.status === 'active' || alert.status === 'responded') && (
                            <div className="px-4 py-2 bg-blue-500 text-white rounded-lg text-xs font-semibold flex items-center gap-2 shadow-lg shadow-blue-500/30">
                              <CheckCircle className="w-4 h-4" />
                              Active
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </motion.div>
                ))
              ) : (
                <motion.div
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="bg-white dark:bg-gray-800 rounded-xl shadow-lg text-center py-16 px-6"
                >
                  <div className="w-20 h-20 bg-gray-100 dark:bg-gray-700 rounded-full flex items-center justify-center mx-auto mb-4">
                    <AlertCircle className="w-10 h-10 text-gray-400" />
                  </div>
                  <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
                    No Alerts Found
                  </h3>
                  <p className="text-gray-600 dark:text-gray-400">
                    {searchQuery || filterStatus !== 'all' 
                      ? 'Try adjusting your filters or search query'
                      : 'You haven\'t sent any emergency alerts yet'}
                  </p>
                </motion.div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};

export default AlertsPage;
