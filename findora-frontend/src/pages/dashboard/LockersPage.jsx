// src/pages/dashboard/LockersPage.jsx
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { lockersAPI } from '../../lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { Spinner } from '../../components/ui/Spinner';
import { Lock } from 'lucide-react';
import { formatRelativeTime, getLockerStateColor } from '../../lib/utils';
import toast from 'react-hot-toast';

export default function LockersPage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [lockers, setLockers] = useState([]);

  useEffect(() => {
    fetchLockers();
  }, []);

  const fetchLockers = async () => {
    try {
      const { data } = await lockersAPI.getAll();
      setLockers(data.lockers);
    } catch (error) {
      toast.error('Failed to fetch lockers');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <Spinner size="lg" />
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Smart Lockers</h1>
        <p className="text-gray-600">Secure contactless item return system</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {lockers.map((locker) => (
          <Card
            key={locker.id}
            className={`hover:shadow-lg transition-shadow ${
              locker.session ? 'cursor-pointer' : ''
            }`}
            onClick={() => locker.session && navigate(`/lockers/session/${locker.sessionId}`)}
          >
            <CardHeader>
              <div className="flex items-center gap-3">
                <Lock className="w-6 h-6 text-gray-700" />
                <CardTitle>{locker.name}</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <Badge className={getLockerStateColor(locker.state)}>
                {locker.state.replace('_', ' ')}
              </Badge>
              <div className="text-sm space-y-1">
                <p className="text-gray-600">{locker.location}</p>
                <p className="text-xs text-gray-500">
                  Last heartbeat: {formatRelativeTime(locker.lastHeartbeat)}
                </p>
                {locker.firmwareVersion && (
                  <p className="text-xs text-gray-500">Firmware: v{locker.firmwareVersion}</p>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
