import { useState } from 'react';
import { motion } from 'framer-motion';
import { Users, AlertCircle, BarChart3, Activity, Shield, Trash2, Edit } from 'lucide-react';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import DashboardHeader from '../components/DashboardHeader';
import { useAuth } from '../context/AuthContext';

// Mock analytics data
const analyticsData = [
  { name: 'Mon', alerts: 12, responded: 10 },
  { name: 'Tue', alerts: 19, responded: 17 },
  { name: 'Wed', alerts: 15, responded: 14 },
  { name: 'Thu', alerts: 22, responded: 20 },
  { name: 'Fri', alerts: 28, responded: 25 },
  { name: 'Sat', alerts: 18, responded: 16 },
  { name: 'Sun', alerts: 14, responded: 13 },
];

const mockUsers = [
  { id: 1, name: 'John Doe', email: 'john@example.com', userType: 'citizen', status: 'active', alerts: 5 },
  { id: 2, name: 'Jane Smith', email: 'jane@example.com', userType: 'police', status: 'active', alerts: 12 },
  { id: 3, name: 'Dr. Garcia', email: 'garcia@hospital.com', userType: 'hospital', status: 'active', alerts: 8 },
  { id: 4, name: 'Maria Santos', email: 'maria@example.com', userType: 'family', status: 'inactive', alerts: 2 },
];

const DashboardAdmin = () => {
  const { user } = useAuth();
  const [users] = useState(mockUsers);
  const [selectedTab, setSelectedTab] = useState('analytics');

  const stats = [
    { label: 'Total Users', value: users.length, icon: Users, color: 'bg-blue-600', change: 12 },
    { label: 'Total Alerts', value: '128', icon: AlertCircle, color: 'bg-red-600', change: 8 },
    { label: 'Response Rate', value: '92%', icon: BarChart3, color: 'bg-green-600', change: 3 },
    { label: 'System Uptime', value: '99.9%', icon: Activity, color: 'bg-purple-600', change: 0 },
  ];

  const tabs = [
    { id: 'analytics', label: 'Analytics', icon: BarChart3 },
    { id: 'users', label: 'User Management', icon: Users },
    { id: 'logs', label: 'System Logs', icon: Activity },
  ];

  return (
    <div className="space-y-6">
      <DashboardHeader
        title="Admin Control Panel"
        subtitle={`${user?.name} - System Administration & Monitoring`}
        stats={stats}
      />

      {/* Tab Navigation */}
      <div className="card">
        <div className="flex gap-2 border-b border-gray-200 dark:border-gray-700 pb-4">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setSelectedTab(tab.id)}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-all ${
                  selectedTab === tab.id
                    ? 'bg-primary-600 text-white'
                    : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800'
                }`}
              >
                <Icon className="w-4 h-4" />
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* Analytics Tab */}
        {selectedTab === 'analytics' && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="pt-6"
          >
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">
              System Analytics
            </h2>
            
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Line Chart */}
              <div className="p-4 bg-gray-50 dark:bg-gray-900 rounded-lg">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                  Weekly Alert Trends
                </h3>
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={analyticsData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    <Line type="monotone" dataKey="alerts" stroke="#EF4444" strokeWidth={2} />
                    <Line type="monotone" dataKey="responded" stroke="#10B981" strokeWidth={2} />
                  </LineChart>
                </ResponsiveContainer>
              </div>

              {/* Bar Chart */}
              <div className="p-4 bg-gray-50 dark:bg-gray-900 rounded-lg">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                  Alert vs Response Comparison
                </h3>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={analyticsData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    <Bar dataKey="alerts" fill="#EF4444" />
                    <Bar dataKey="responded" fill="#10B981" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Additional Stats */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6">
              <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
                <h4 className="text-sm font-medium text-blue-900 dark:text-blue-100 mb-2">
                  Average Response Time
                </h4>
                <p className="text-3xl font-bold text-blue-600 dark:text-blue-400">6.5m</p>
                <p className="text-xs text-blue-600 dark:text-blue-400 mt-1">-15% from last week</p>
              </div>
              <div className="p-4 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-800">
                <h4 className="text-sm font-medium text-green-900 dark:text-green-100 mb-2">
                  Success Rate
                </h4>
                <p className="text-3xl font-bold text-green-600 dark:text-green-400">94.2%</p>
                <p className="text-xs text-green-600 dark:text-green-400 mt-1">+2.3% improvement</p>
              </div>
              <div className="p-4 bg-purple-50 dark:bg-purple-900/20 rounded-lg border border-purple-200 dark:border-purple-800">
                <h4 className="text-sm font-medium text-purple-900 dark:text-purple-100 mb-2">
                  Active Responders
                </h4>
                <p className="text-3xl font-bold text-purple-600 dark:text-purple-400">47</p>
                <p className="text-xs text-purple-600 dark:text-purple-400 mt-1">15 police, 32 hospital</p>
              </div>
            </div>
          </motion.div>
        )}

        {/* User Management Tab */}
        {selectedTab === 'users' && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="pt-6"
          >
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
                User Management
              </h2>
              <button className="btn-primary">
                <Users className="w-4 h-4 inline mr-2" />
                Add New User
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Name</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Email</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">User Type</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Status</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Alerts</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                  {users.map((userItem) => (
                    <tr key={userItem.id} className="hover:bg-gray-50 dark:hover:bg-gray-800">
                      <td className="px-4 py-3 text-sm text-gray-900 dark:text-white font-medium">
                        {userItem.name}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">
                        {userItem.email}
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-xs px-2 py-1 rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-400 capitalize">
                          {userItem.userType}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`text-xs px-2 py-1 rounded-full ${
                          userItem.status === 'active' 
                            ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400' 
                            : 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-400'
                        }`}>
                          {userItem.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-900 dark:text-white">
                        {userItem.alerts}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex gap-2">
                          <button className="p-2 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors">
                            <Edit className="w-4 h-4" />
                          </button>
                          <button className="p-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors">
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </motion.div>
        )}

        {/* System Logs Tab */}
        {selectedTab === 'logs' && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="pt-6"
          >
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">
              System Activity Logs
            </h2>
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {[...Array(10)].map((_, i) => (
                <div key={i} className="p-3 bg-gray-50 dark:bg-gray-900 rounded-lg flex items-start gap-3">
                  <Activity className="w-4 h-4 text-blue-600 mt-1" />
                  <div className="flex-1">
                    <p className="text-sm text-gray-900 dark:text-white font-medium">
                      User john@example.com sent emergency alert
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                      {new Date(Date.now() - i * 600000).toLocaleString()}
                    </p>
                  </div>
                  <span className="text-xs px-2 py-1 rounded-full bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400">
                    Alert
                  </span>
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </div>
    </div>
  );
};

export default DashboardAdmin;
