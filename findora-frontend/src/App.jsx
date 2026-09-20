import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import { LoadingScreen } from './components/ui/Spinner';

// Auth Pages
import LoginPage from './pages/auth/LoginPage';

// Dashboard
import DashboardLayout from './pages/dashboard/DashboardLayout';
import HomePage from './pages/dashboard/HomePage';
import ReportsPage from './pages/dashboard/ReportsPage';
import CreateReportPage from './pages/dashboard/CreateReportPage';
import MatchesPage from './pages/dashboard/MatchesPage';
import MatchDetailsPage from './pages/dashboard/MatchDetailsPage';
import LockersPage from './pages/dashboard/LockersPage';
import LockerSessionPage from './pages/dashboard/LockerSessionPage';
import ChatPage from './pages/dashboard/ChatPage';
import RewardsPage from './pages/dashboard/RewardsPage';
import ProfilePage from './pages/dashboard/ProfilePage';

// Admin
import AdminDashboard from './pages/admin/AdminDashboard';
import EnhancedDashboard from './pages/admin/EnhancedDashboard';
import CaseManagement from './pages/admin/CaseManagement';

// Protected Route
function ProtectedRoute({ children }) {
  const { user, loading } = useAuth();
  
  if (loading) return <LoadingScreen />;
  if (!user) return <Navigate to="/login" replace />;
  
  return children;
}

function App() {
  return (
    <Routes>
      {/* Public Routes */}
      <Route path="/login" element={<LoginPage />} />
      
      {/* Protected Routes */}
      <Route
        path="/"
        element={
          <ProtectedRoute>
            <DashboardLayout />
          </ProtectedRoute>
        }
      >
        <Route index element={<HomePage />} />
        <Route path="reports" element={<ReportsPage />} />
        <Route path="reports/new" element={<CreateReportPage />} />
        <Route path="matches" element={<MatchesPage />} />
        <Route path="matches/:id" element={<MatchDetailsPage />} />
        <Route path="lockers" element={<LockersPage />} />
        <Route path="lockers/session/:sessionId" element={<LockerSessionPage />} />
        <Route path="chat" element={<ChatPage />} />
        <Route path="rewards" element={<RewardsPage />} />
        <Route path="profile" element={<ProfilePage />} />
        <Route path="admin" element={<AdminDashboard />} />
        <Route path="admin/dashboard" element={<EnhancedDashboard />} />
        <Route path="admin/cases" element={<CaseManagement />} />
      </Route>
      
      {/* Fallback */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default App;
