// src/pages/dashboard/LockerSessionPage.jsx
import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { lockersAPI } from '../../lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Badge } from '../../components/ui/Badge';
import { Spinner } from '../../components/ui/Spinner';
import { ArrowLeft, Lock, CheckCircle } from 'lucide-react';
import { formatDate, getLockerStateColor } from '../../lib/utils';
import toast from 'react-hot-toast';

export default function LockerSessionPage() {
  const { sessionId } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [session, setSession] = useState(null);
  const [otp, setOtp] = useState('');
  const [processing, setProcessing] = useState(false);

  useEffect(() => {
    fetchSession();
    const interval = setInterval(fetchSession, 5000); // Poll every 5s
    return () => clearInterval(interval);
  }, [sessionId]);

  const fetchSession = async () => {
    try {
      const { data } = await lockersAPI.getSession(sessionId);
      setSession(data);
      setLoading(false);
    } catch (error) {
      toast.error('Failed to load session');
      navigate('/lockers');
    }
  };

  const handleDeposit = async () => {
    setProcessing(true);
    try {
      await lockersAPI.deposit(sessionId);
      toast.success('Item deposited successfully!');
      fetchSession();
    } catch (error) {
      toast.error(error.response?.data?.error || 'Failed to deposit');
    } finally {
      setProcessing(false);
    }
  };

  const handleVerifyOTP = async () => {
    if (!otp || otp.length !== 6) {
      toast.error('Please enter a valid 6-digit OTP');
      return;
    }

    setProcessing(true);
    try {
      await lockersAPI.verifyOTP(sessionId, otp);
      toast.success('Locker unlocked! Collect your item.');
      fetchSession();
    } catch (error) {
      toast.error(error.response?.data?.error || 'Invalid OTP');
    } finally {
      setProcessing(false);
    }
  };

  const handleResendOTP = async () => {
    setProcessing(true);
    try {
      const { data } = await lockersAPI.resendOTP(sessionId);
      toast.success(`New OTP sent: ${data.otp}`);
      fetchSession();
    } catch (error) {
      toast.error('Failed to resend OTP');
    } finally {
      setProcessing(false);
    }
  };

  const handleRearm = async () => {
    setProcessing(true);
    try {
      const { data } = await lockersAPI.rearm();
      toast.success(`🎉 Locker re-armed! New OTP: ${data.otp}`);
      fetchSession();
    } catch (e) {
      toast.error('Failed to re-arm locker');
    } finally {
      setProcessing(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <Spinner size="lg" />
      </div>
    );
  }

  const isDepositor = session.depositedBy === user?.uid;
  const isCollector = session.claimedBy === user?.uid;

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" onClick={() => navigate('/lockers')}>
          <ArrowLeft className="w-4 h-4" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Locker Session</h1>
          <p className="text-gray-600">Secure item transfer</p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <Lock className="w-6 h-6" />
            <CardTitle>{session.locker?.name}</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-2">
            <Badge className={getLockerStateColor(session.state)}>
              {session.state.replace('_', ' ')}
            </Badge>
            <span className="text-sm text-gray-600">{session.locker?.location}</span>
          </div>

          {/* Timeline */}
          <div className="border-l-2 border-gray-300 pl-4 space-y-4">
            <div className="relative">
              <div className="absolute -left-[1.4rem] w-3 h-3 bg-green-500 rounded-full border-2 border-white" />
              <p className="text-sm font-medium">Locker Assigned</p>
              <p className="text-xs text-gray-500">{formatDate(session.createdAt)}</p>
            </div>

            {session.state !== 'RESERVED' && (
              <div className="relative">
                <div className="absolute -left-[1.4rem] w-3 h-3 bg-green-500 rounded-full border-2 border-white" />
                <p className="text-sm font-medium">Item Deposited</p>
                <p className="text-xs text-gray-500">{formatDate(session.updatedAt)}</p>
              </div>
            )}

            {session.unlockedAt && (
              <div className="relative">
                <div className="absolute -left-[1.4rem] w-3 h-3 bg-green-500 rounded-full border-2 border-white" />
                <p className="text-sm font-medium">Locker Unlocked</p>
                <p className="text-xs text-gray-500">{formatDate(session.unlockedAt)}</p>
              </div>
            )}

            {session.collectedAt && (
              <div className="relative">
                <div className="absolute -left-[1.4rem] w-3 h-3 bg-green-500 rounded-full border-2 border-white" />
                <p className="text-sm font-medium">Item Collected</p>
                <p className="text-xs text-gray-500">{formatDate(session.collectedAt)}</p>
              </div>
            )}
          </div>

          {/* Actions based on role and state */}
          {session.state === 'RESERVED' && isDepositor && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <p className="text-sm text-blue-800 mb-3">
                📍 Please deposit the item in locker <strong>{session.locker?.name}</strong>
              </p>
              <Button onClick={handleDeposit} loading={processing} className="w-full">
                ✓ I've Deposited the Item
              </Button>
            </div>
          )}

          {['ITEM_DEPOSITED', 'READY_FOR_COLLECTION'].includes(session.state) && (
            <div className="bg-green-50 border border-green-200 rounded-lg p-4 space-y-3">
              <div className="space-y-2">
                <p className="text-sm text-green-800 font-medium">
                  🔑 Enter your OTP to unlock the locker (or type on ESP32 Keypad)
                </p>
                {session.otp && session.otp !== '******' && (
                  <div className="bg-white border border-green-300 rounded p-2">
                    <p className="text-xs text-gray-600">Your Active OTP:</p>
                    <p className="text-2xl font-mono font-bold text-green-700 tracking-widest">
                      {session.otp}
                    </p>
                  </div>
                )}
              </div>
              <Input
                placeholder="Enter 6-digit OTP"
                value={otp}
                onChange={(e) => setOtp(e.target.value)}
                maxLength={6}
              />
              <div className="flex gap-2">
                <Button onClick={handleVerifyOTP} loading={processing} className="flex-1">
                  Unlock Locker
                </Button>
                <Button variant="outline" onClick={handleResendOTP} loading={processing}>
                  Resend OTP
                </Button>
              </div>
            </div>
          )}

          {session.state === 'OPEN' && (
            <div className="bg-orange-50 border border-orange-200 rounded-lg p-4 text-center space-y-3">
              <CheckCircle className="w-12 h-12 text-orange-600 mx-auto mb-2" />
              <p className="text-orange-800 font-medium text-lg">🚪 Locker is Open / Access Granted!</p>
              <p className="text-sm text-orange-600">Item collected. Ready to test again?</p>
              <Button onClick={handleRearm} loading={processing} className="w-full bg-indigo-600 hover:bg-indigo-700 text-white">
                ⚡ Test Again (Re-arm Locker & New OTP)
              </Button>
            </div>
          )}

          {session.state === 'COLLECTED' && (
            <div className="bg-green-50 border border-green-200 rounded-lg p-4 text-center space-y-3">
              <CheckCircle className="w-12 h-12 text-green-600 mx-auto mb-2" />
              <p className="text-green-800 font-medium text-lg">🎉 Item Collected!</p>
              <p className="text-sm text-green-600">Case completed successfully.</p>
              <Button onClick={handleRearm} loading={processing} className="w-full bg-indigo-600 hover:bg-indigo-700 text-white">
                ⚡ Test Again (Re-arm Locker & New OTP)
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
