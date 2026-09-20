// src/pages/auth/LoginPage.jsx
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { authAPI } from '../../lib/api';
import { Button } from '../../components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/Card';
import { DEMO_USERS } from '../../lib/utils';
import toast from 'react-hot-toast';

export default function LoginPage() {
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleDemoLogin = async (userId) => {
    setLoading(true);
    try {
      const { data } = await authAPI.demoLogin(userId);
      login(data.token, data.user);
      toast.success(`Welcome, ${data.user.displayName}!`);
      navigate('/');
    } catch (error) {
      toast.error(error.response?.data?.error || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 via-white to-purple-50 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center space-y-2">
          <div className="flex items-center justify-center mb-4">
            <div className="w-16 h-16 bg-blue-600 rounded-full flex items-center justify-center text-3xl">
              🔍
            </div>
          </div>
          <CardTitle className="text-3xl">Findora</CardTitle>
          <p className="text-gray-600">AI-Powered Smart Lost & Found</p>
        </CardHeader>

        <CardContent className="space-y-4">
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <p className="text-sm text-blue-800 font-medium mb-2">
              🔧 Demo Mode - Select a user to login
            </p>
            <p className="text-xs text-blue-600">
              No authentication required. Perfect for testing the full platform.
            </p>
          </div>

          <div className="space-y-2">
            {DEMO_USERS.map((user) => (
              <Button
                key={user.id}
                variant="outline"
                className="w-full justify-start text-left"
                onClick={() => handleDemoLogin(user.id)}
                disabled={loading}
              >
                <span className="flex-1">{user.name}</span>
                <span className="text-xs text-gray-500 capitalize">{user.role}</span>
              </Button>
            ))}
          </div>

          <div className="relative my-6">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-gray-300"></div>
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-2 bg-white text-gray-500">Key Features</span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 text-sm">
            <div className="flex items-center gap-2">
              <span className="text-blue-600">🤖</span>
              <span className="text-gray-600">AI Matching</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-blue-600">🔒</span>
              <span className="text-gray-600">Smart Lockers</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-blue-600">💬</span>
              <span className="text-gray-600">Secure Chat</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-blue-600">🏆</span>
              <span className="text-gray-600">Rewards</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
