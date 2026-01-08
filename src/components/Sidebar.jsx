import { Link, useLocation } from 'react-router-dom';
import {
  LayoutDashboard,
  AlertCircle,
  MapPin,
  Users,
  Settings,
  BarChart3,
  Shield,
  Activity,
  X,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';

const Sidebar = ({ isOpen, onClose }) => {
  const location = useLocation();
  const { user } = useAuth();

  const getMenuItems = () => {
    const baseItems = [
      { icon: LayoutDashboard, label: 'Dashboard', path: `/dashboard/${user?.userType}` },
      { icon: MapPin, label: 'Live Map', path: '/map' },
      { icon: AlertCircle, label: 'My Alerts', path: '/alerts' },
    ];

    if (user?.userType === 'admin') {
      return [
        ...baseItems,
        { icon: Users, label: 'User Management', path: '/users' },
        { icon: BarChart3, label: 'Analytics', path: '/analytics' },
        { icon: Activity, label: 'System Logs', path: '/logs' },
        { icon: Settings, label: 'Settings', path: '/settings' },
      ];
    }

    return [...baseItems, { icon: Settings, label: 'Settings', path: '/settings' }];
  };

  const menuItems = getMenuItems();

  return (
    <>
      {/* Overlay for mobile */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={onClose}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`
          fixed lg:sticky top-16 left-0 z-50 h-[calc(100vh-4rem)]
          w-64 glassmorphism border-r border-gray-200 dark:border-gray-700
          transition-transform duration-300 lg:translate-x-0
          ${isOpen ? 'translate-x-0' : '-translate-x-full'}
        `}
      >
        <div className="h-full flex flex-col overflow-hidden">
          {/* Close button for mobile */}
          <div className="lg:hidden flex justify-end p-4">
            <button
              onClick={onClose}
              className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800"
            >
              <X className="w-6 h-6" />
            </button>
          </div>

          {/* User type badge */}
          <div className="p-4">
            <div className="flex items-center gap-2 p-3 bg-primary-50 dark:bg-primary-900/20 rounded-lg border border-primary-200 dark:border-primary-800">
              <Shield className="w-5 h-5 text-primary-600 dark:text-primary-400" />
              <span className="font-medium text-primary-900 dark:text-primary-100 capitalize">
                {user?.userType} Account
              </span>
            </div>
          </div>

          {/* Navigation */}
          <nav className="flex-1 px-4 space-y-1">
            {menuItems.map((item) => {
              const Icon = item.icon;
              const isActive = location.pathname === item.path;

              return (
                <Link
                  key={item.path}
                  to={item.path}
                  onClick={onClose}
                  className={`
                    flex items-center gap-3 px-4 py-3 rounded-lg transition-all
                    ${
                      isActive
                        ? 'bg-primary-600 text-white shadow-lg shadow-primary-600/50'
                        : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800'
                    }
                  `}
                >
                  <Icon className="w-5 h-5" />
                  <span className="font-medium">{item.label}</span>
                </Link>
              );
            })}
          </nav>

          {/* Emergency SOS button */}
          <div className="p-4 border-t border-gray-200 dark:border-gray-700">
            <button
              type="button"
              onClick={() => {
                // Dispatch a global event that dashboards can listen for
                try { window.dispatchEvent(new CustomEvent('send-sos')); } catch (e) { console.warn('Dispatch send-sos failed', e); }
                onClose && onClose();
              }}
              className="w-full btn-danger flex items-center justify-center gap-2 py-3 animate-pulse-slow cursor-pointer"
            >
              <AlertCircle className="w-5 h-5" />
              <span className="font-bold">SEND SOS</span>
            </button>
          </div>
        </div>
      </aside>
    </>
  );
};

export default Sidebar;
