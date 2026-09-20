// src/pages/dashboard/DashboardLayout.jsx
import { useState } from 'react';
import { Outlet, NavLink, useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { 
  Home, FileText, GitCompare, Lock, MessageSquare, Trophy, 
  BarChart3, LogOut, Menu, X, Bell, User 
} from 'lucide-react';
import { Button } from '../../components/ui/Button';
import NotificationBell from '../../components/NotificationBell';

export default function DashboardLayout() {
  const { user, logout, isAdmin } = useAuth();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const navItems = [
    { path: '/', icon: Home, label: 'Dashboard', exact: true },
    { path: '/reports', icon: FileText, label: 'Reports' },
    { path: '/matches', icon: GitCompare, label: 'Matches' },
    { path: '/lockers', icon: Lock, label: 'Lockers' },
    { path: '/chat', icon: MessageSquare, label: 'Messages' },
    { path: '/rewards', icon: Trophy, label: 'Rewards' },
    { path: '/profile', icon: User, label: 'Profile' },
  ];

  if (isAdmin()) {
    navItems.push({ path: '/admin', icon: BarChart3, label: 'Admin Panel' });
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Top Bar */}
      <div className="fixed top-0 left-0 right-0 z-30 bg-white border-b border-gray-200 shadow-sm">
        <div className="flex items-center justify-between px-4 h-16">
          <div className="flex items-center gap-4">
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="lg:hidden p-2 hover:bg-gray-100 rounded-lg"
            >
              {sidebarOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
            <div className="flex items-center gap-2">
              <div className="w-10 h-10 bg-blue-600 rounded-lg flex items-center justify-center text-xl">
                🔍
              </div>
              <div>
                <h1 className="text-xl font-bold text-gray-900">Findora</h1>
                <p className="text-xs text-gray-500 hidden sm:block">Smart Lost & Found</p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <NotificationBell />
            
            <Link
              to="/profile"
              className="hidden sm:flex items-center gap-2 px-3 py-2 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
            >
              <User className="w-4 h-4 text-gray-600" />
              <div className="text-sm">
                <p className="font-medium text-gray-900">{user?.displayName}</p>
                <p className="text-xs text-gray-500 capitalize">{user?.role?.replace('_', ' ')}</p>
              </div>
            </Link>

            <Button
              variant="ghost"
              size="sm"
              onClick={handleLogout}
              className="hidden sm:flex"
            >
              <LogOut className="w-4 h-4" />
              Logout
            </Button>
          </div>
        </div>
      </div>

      {/* Sidebar */}
      <aside
        className={`fixed top-16 left-0 z-20 h-[calc(100vh-4rem)] w-64 bg-white border-r border-gray-200 transition-transform duration-200 ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        } lg:translate-x-0`}
      >
        <nav className="p-4 space-y-1">
          {navItems.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              end={item.exact}
              onClick={() => setSidebarOpen(false)}
              className={({ isActive }) =>
                `flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
                  isActive
                    ? 'bg-blue-50 text-blue-700 font-medium'
                    : 'text-gray-700 hover:bg-gray-100'
                }`
              }
            >
              <item.icon className="w-5 h-5" />
              {item.label}
            </NavLink>
          ))}
        </nav>

        {/* User Info (Mobile) */}
        <div className="sm:hidden absolute bottom-0 left-0 right-0 p-4 border-t border-gray-200">
          <div className="flex items-center gap-2 mb-3">
            <User className="w-4 h-4 text-gray-600" />
            <div className="text-sm">
              <p className="font-medium text-gray-900">{user?.displayName}</p>
              <p className="text-xs text-gray-500 capitalize">{user?.role?.replace('_', ' ')}</p>
            </div>
          </div>
          <Button variant="outline" size="sm" onClick={handleLogout} className="w-full">
            <LogOut className="w-4 h-4" />
            Logout
          </Button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="lg:ml-64 mt-16 p-4 md:p-6">
        <Outlet />
      </main>

      {/* Sidebar Backdrop (Mobile) */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-10 bg-black bg-opacity-50 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}
    </div>
  );
}
