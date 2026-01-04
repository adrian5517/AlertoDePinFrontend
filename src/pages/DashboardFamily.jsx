import { useState } from 'react';
import { motion } from 'framer-motion';
import { Users, MapPin, AlertCircle, Clock } from 'lucide-react';
import DashboardHeader from '../components/DashboardHeader';
import MapboxMap from '../components/MapboxMap';
import AlertCard from '../components/AlertCard';
import { useAuth } from '../context/AuthContext';

// Mock data for family member alerts
const mockFamilyAlerts = [
  {
    id: 1,
    title: 'Emergency Alert from Maria',
    description: 'SOS alert triggered - immediate assistance needed',
    type: 'family',
    status: 'active',
    location: 'SM City Naga',
    timestamp: new Date().toISOString(),
    reporter: 'Maria Dela Cruz (Mother)',
    coordinates: { lat: 13.6191, lng: 123.1973 },
  },
  {
    id: 2,
    title: 'Location Check-in from Pedro',
    description: 'Safe arrival notification',
    type: 'family',
    status: 'resolved',
    location: 'Boulevard, Naga City',
    timestamp: new Date(Date.now() - 7200000).toISOString(),
    reporter: 'Pedro Santos (Father)',
    coordinates: { lat: 13.6255, lng: 123.1760 },
  },
];

const familyMembers = [
  { id: 1, name: 'Maria Dela Cruz', relation: 'Mother', phone: '+63 912 345 6789', status: 'active' },
  { id: 2, name: 'Pedro Santos', relation: 'Father', phone: '+63 923 456 7890', status: 'safe' },
  { id: 3, name: 'Juan Dela Cruz', relation: 'Brother', phone: '+63 934 567 8901', status: 'safe' },
];

const DashboardFamily = () => {
  const { user } = useAuth();
  const [alerts] = useState(mockFamilyAlerts);
  const [members] = useState(familyMembers);

  const stats = [
    { label: 'Family Members', value: members.length, icon: Users, color: 'bg-green-600' },
    { label: 'Active Alerts', value: alerts.filter(a => a.status === 'active').length, icon: AlertCircle, color: 'bg-red-600' },
    { label: 'Safe Check-ins', value: members.filter(m => m.status === 'safe').length, icon: MapPin, color: 'bg-blue-600' },
    { label: 'Last Update', value: '5m ago', icon: Clock, color: 'bg-purple-600' },
  ];

  return (
    <div className="space-y-6">
      <DashboardHeader
        title="Family Safety Monitor"
        subtitle={`${user?.name} - Track and protect your loved ones`}
        stats={stats}
        actions={
          <button className="btn-primary">
            <Users className="w-4 h-4 inline mr-2" />
            Add Family Member
          </button>
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
            <div className="p-4 border-b border-gray-200 dark:border-gray-700 bg-green-50 dark:bg-green-900/20">
              <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                Family Location Tracking
              </h2>
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                Real-time locations of your registered family members
              </p>
            </div>
            <MapboxMap 
              alerts={alerts} 
              className="h-[500px]"
            />
          </div>
        </motion.div>

        {/* Family Members List */}
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          className="space-y-4"
        >
          <div className="card">
            <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">
              Registered Family
            </h2>
            <div className="space-y-3">
              {members.map((member) => (
                <div
                  key={member.id}
                  className="p-3 rounded-lg border border-gray-200 dark:border-gray-700 hover:border-green-300 transition-all"
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-green-600 rounded-full flex items-center justify-center">
                        <Users className="w-5 h-5 text-white" />
                      </div>
                      <div>
                        <h3 className="font-semibold text-sm text-gray-900 dark:text-white">
                          {member.name}
                        </h3>
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                          {member.relation}
                        </p>
                      </div>
                    </div>
                    <span className={`text-xs px-2 py-1 rounded-full ${
                      member.status === 'active' ? 'bg-red-100 text-red-800 animate-pulse' :
                      'bg-green-100 text-green-800'
                    }`}>
                      {member.status}
                    </span>
                  </div>
                  <p className="text-xs text-gray-600 dark:text-gray-400 mb-2">
                    📞 {member.phone}
                  </p>
                  <div className="flex gap-2">
                    <button className="flex-1 text-xs btn-primary py-2">
                      View Location
                    </button>
                    <button className="flex-1 text-xs bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 px-3 py-2 rounded-lg transition-colors">
                      Call
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </motion.div>
      </div>

      {/* Recent Family Alerts */}
      <div>
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
          Recent Family Alerts
        </h2>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {alerts.map((alert, index) => (
            <motion.div
              key={alert.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
            >
              <AlertCard alert={alert} />
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default DashboardFamily;
