import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import DashboardLayout from './components/DashboardLayout';
import NotificationPanel from './components/NotificationPanel';
import Login from './pages/Login';
import Signup from './pages/Signup';
import DashboardCitizen from './pages/DashboardCitizen';
import DashboardPolice from './pages/DashboardPolice';
import DashboardHospital from './pages/DashboardHospital';
import DashboardFire from './pages/DashboardFire';
import DashboardFamily from './pages/DashboardFamily';
import DashboardAdmin from './pages/DashboardAdmin';
import MapPage from './pages/MapPage';
import AlertsPage from './pages/AlertsPage';
import SettingsPage from './pages/SettingsPage';

const AppRoutes = () => {
  const { user } = useAuth();

  return (
    <Routes>
      {/* Public Routes */}
      <Route path="/login" element={!user ? <Login /> : <Navigate to={`/dashboard/${user.userType}`} />} />
      <Route path="/signup" element={!user ? <Signup /> : <Navigate to={`/dashboard/${user.userType}`} />} />

      {/* Protected Dashboard Routes */}
      <Route
        path="/"
        element={
          <ProtectedRoute>
            <DashboardLayout />
          </ProtectedRoute>
        }
      >
        <Route index element={<Navigate to={user ? `/dashboard/${user.userType}` : '/login'} />} />
        
        <Route
          path="dashboard/citizen"
          element={
            <ProtectedRoute allowedRoles={['citizen']}>
              <DashboardCitizen />
            </ProtectedRoute>
          }
        />
        
        <Route
          path="dashboard/police"
          element={
            <ProtectedRoute allowedRoles={['police']}>
              <DashboardPolice />
            </ProtectedRoute>
          }
        />
        
        <Route
          path="dashboard/hospital"
          element={
            <ProtectedRoute allowedRoles={['hospital']}>
              <DashboardHospital />
            </ProtectedRoute>
          }
        />
        
        <Route
          path="dashboard/fire"
          element={
            <ProtectedRoute allowedRoles={['fire']}>
              <DashboardFire />
            </ProtectedRoute>
          }
        />
        
        <Route
          path="dashboard/family"
          element={
            <ProtectedRoute allowedRoles={['family']}>
              <DashboardFamily />
            </ProtectedRoute>
          }
        />
        
        <Route
          path="dashboard/admin"
          element={
            <ProtectedRoute allowedRoles={['admin']}>
              <DashboardAdmin />
            </ProtectedRoute>
          }
        />

        {/* Placeholder routes for sidebar links */}
        <Route path="map" element={<MapPage />} />
        <Route path="alerts" element={<AlertsPage />} />
        <Route path="settings" element={<SettingsPage />} />
        <Route path="users" element={<div className="card"><h1 className="text-2xl font-bold">User Management</h1><p className="text-gray-600 dark:text-gray-400 mt-2">Admin-only user management interface coming soon...</p></div>} />
        <Route path="analytics" element={<div className="card"><h1 className="text-2xl font-bold">Analytics</h1><p className="text-gray-600 dark:text-gray-400 mt-2">Detailed analytics coming soon...</p></div>} />
        <Route path="logs" element={<div className="card"><h1 className="text-2xl font-bold">System Logs</h1><p className="text-gray-600 dark:text-gray-400 mt-2">System logs view coming soon...</p></div>} />
      </Route>

      {/* Fallback Route */}
      <Route path="*" element={<Navigate to="/" />} />
    </Routes>
  );
};

function App() {
  return (
    <AuthProvider>
      <Router>
        <NotificationPanel />
        <AppRoutes />
      </Router>
    </AuthProvider>
  );
}

export default App;
