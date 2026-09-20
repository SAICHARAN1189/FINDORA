// src/pages/dashboard/LockersPage.jsx
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { lockersAPI } from '../../lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { Spinner } from '../../components/ui/Spinner';
import { Lock, Unlock, RefreshCw, Send, Cpu, CheckCircle2, Copy } from 'lucide-react';
import { formatRelativeTime, getLockerStateColor } from '../../lib/utils';
import toast from 'react-hot-toast';

export default function LockersPage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [lockers, setLockers] = useState([]);
  const [rearming, setRearming] = useState(false);
  const [activeOtp, setActiveOtp] = useState(null);

  useEffect(() => {
    fetchLockers();
    // Auto-poll every 2.5s so ESP32 keypad unlocks reflect immediately in the UI
    const interval = setInterval(fetchLockers, 2500);
    return () => clearInterval(interval);
  }, []);

  const fetchLockers = async () => {
    try {
      const { data } = await lockersAPI.getAll();
      setLockers(data.lockers);

      // Look for active session OTP on Locker A2 or any locker
      const a2 = data.lockers?.find((l) => l.id === 'locker-002');
      if (a2?.session?.otp && a2.session.otp !== '******') {
        setActiveOtp(a2.session.otp);
      }
    } catch (error) {
      // Avoid spamming toasts during polling
    } finally {
      setLoading(false);
    }
  };

  const handleRearmLocker = async () => {
    setRearming(true);
    try {
      const { data } = await lockersAPI.rearm();
      toast.success(`🎉 Locker A2 Re-Armed! New OTP: ${data.otp}`);
      setActiveOtp(data.otp);
      await fetchLockers();
    } catch (error) {
      toast.error('Failed to re-arm locker');
    } finally {
      setRearming(false);
    }
  };

  const handleCopyOtp = (code) => {
    if (code) {
      navigator.clipboard.writeText(code);
      toast.success(`Copied OTP ${code} to clipboard!`);
    }
  };

  if (loading && lockers.length === 0) {
    return (
      <div className="flex justify-center py-12">
        <Spinner size="lg" />
      </div>
    );
  }

  const lockerA2 = lockers.find((l) => l.id === 'locker-002');

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Smart Lockers</h1>
          <p className="text-gray-600">Secure contactless item return system with ESP32 keypad integration</p>
        </div>
        <Button
          onClick={handleRearmLocker}
          loading={rearming}
          className="bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm flex items-center gap-2"
        >
          <RefreshCw className={`w-4 h-4 ${rearming ? 'animate-spin' : ''}`} />
          Re-arm Locker A2 (New OTP)
        </Button>
      </div>

      {/* Hardware & Testing Banner */}
      <Card className="border-2 border-indigo-200 bg-gradient-to-br from-indigo-50/70 via-white to-blue-50/50 shadow-sm">
        <CardContent className="p-5 space-y-4">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-3 border-b border-indigo-100">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-indigo-600 text-white rounded-xl shadow-md">
                <Cpu className="w-6 h-6" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="font-bold text-gray-900 text-lg">Hardware Keypad & Telegram Test Station</h3>
                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-100 text-emerald-800">
                    ● ESP32 Online (Port 8000)
                  </span>
                </div>
                <p className="text-sm text-gray-600">
                  Target Box: <code className="text-indigo-700 font-bold">BOX001</code> &bull; Hardware Locker:{' '}
                  <strong className="text-gray-900">Locker A2</strong>
                </p>
              </div>
            </div>

            {/* Live OTP Display Box */}
            <div className="flex items-center gap-3 bg-white border border-indigo-200 rounded-xl p-3 shadow-inner">
              <div>
                <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider block">Current Keypad OTP</span>
                <span className="text-2xl font-mono font-bold text-indigo-700 tracking-widest">
                  {activeOtp || '------'}
                </span>
              </div>
              {activeOtp && (
                <button
                  onClick={() => handleCopyOtp(activeOtp)}
                  className="p-1.5 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition"
                  title="Copy OTP"
                >
                  <Copy className="w-5 h-5" />
                </button>
              )}
            </div>
          </div>

          {/* Instructions and Quick Actions */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-sm">
            <div className="bg-white/80 border border-indigo-100 rounded-lg p-3">
              <span className="font-semibold text-gray-900 block mb-1">1. Get OTP in Telegram</span>
              <p className="text-xs text-gray-600 mb-2">
                Send <code className="bg-gray-100 px-1 py-0.5 rounded font-bold text-indigo-600">/otp</code> to the bot anytime:
              </p>
              <a
                href="https://t.me/smartLostandFoundbot"
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-indigo-600 hover:underline"
              >
                <Send className="w-3.5 h-3.5" /> @smartLostandFoundbot &rarr;
              </a>
            </div>

            <div className="bg-white/80 border border-indigo-100 rounded-lg p-3">
              <span className="font-semibold text-gray-900 block mb-1">2. Enter on 4x4 Keypad</span>
              <p className="text-xs text-gray-600">
                Type the 6-digit code on the ESP32 keypad and press <kbd className="bg-gray-200 px-1 py-0.5 rounded font-mono font-bold">#</kbd> to unlock! Press <kbd className="bg-gray-200 px-1 py-0.5 rounded font-mono font-bold">*</kbd> to clear.
              </p>
            </div>

            <div className="bg-white/80 border border-indigo-100 rounded-lg p-3">
              <span className="font-semibold text-gray-900 block mb-1">3. Auto-Rearm & Infinite Testing</span>
              <p className="text-xs text-gray-600">
                Once unlocked, Locker A2 automatically re-arms after 10s so you can test as many times as you like!
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Locker Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {lockers.map((locker) => {
          const isLockerA2 = locker.id === 'locker-002';
          const isLockerOpen = locker.state === 'OPEN';
          const isItemDeposited = locker.state === 'ITEM_DEPOSITED';

          return (
            <Card
              key={locker.id}
              className={`transition-all ${
                isLockerA2 ? 'border-indigo-400 ring-2 ring-indigo-200/60 shadow-md' : 'hover:shadow-md'
              } ${isLockerOpen ? 'bg-emerald-50/50 border-emerald-400' : ''}`}
            >
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    {isLockerOpen ? (
                      <Unlock className="w-6 h-6 text-emerald-600 animate-bounce" />
                    ) : (
                      <Lock className={`w-6 h-6 ${isLockerA2 ? 'text-indigo-600' : 'text-gray-700'}`} />
                    )}
                    <div>
                      <CardTitle className="flex items-center gap-2">
                        {locker.name}
                        {isLockerA2 && (
                          <span className="text-[10px] uppercase font-bold bg-indigo-100 text-indigo-700 px-1.5 py-0.5 rounded">
                            Hardware Test
                          </span>
                        )}
                      </CardTitle>
                    </div>
                  </div>
                  <Badge className={getLockerStateColor(locker.state)}>
                    {locker.state.replace('_', ' ')}
                  </Badge>
                </div>
              </CardHeader>

              <CardContent className="space-y-4">
                {/* State-specific callouts */}
                {isLockerOpen && (
                  <div className="p-3 bg-emerald-100 border border-emerald-300 rounded-lg text-emerald-900 text-xs flex items-center gap-2">
                    <CheckCircle2 className="w-5 h-5 text-emerald-600 flex-shrink-0" />
                    <span>
                      <strong>Access Granted!</strong> Locker unlocked. Auto-rearming with new OTP in a few seconds...
                    </span>
                  </div>
                )}

                {isItemDeposited && locker.session?.otp && (
                  <div className="p-2.5 bg-indigo-50 border border-indigo-200 rounded-lg flex items-center justify-between">
                    <div>
                      <span className="text-[10px] uppercase font-bold text-gray-500 block">Valid Keypad OTP</span>
                      <span className="text-lg font-mono font-bold text-indigo-700 tracking-wider">
                        {locker.session.otp}
                      </span>
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleCopyOtp(locker.session.otp)}
                      className="text-xs h-7 px-2"
                    >
                      Copy
                    </Button>
                  </div>
                )}

                <div className="text-sm space-y-1">
                  <p className="text-gray-600">{locker.location}</p>
                  <p className="text-xs text-gray-500">
                    Last heartbeat: {formatRelativeTime(locker.lastHeartbeat)}
                  </p>
                  {locker.firmwareVersion && (
                    <p className="text-xs text-gray-500">Firmware: v{locker.firmwareVersion}</p>
                  )}
                </div>

                {/* Card footer buttons */}
                <div className="pt-2 border-t border-gray-100 flex gap-2">
                  {locker.sessionId && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="w-full text-xs"
                      onClick={() => navigate(`/lockers/session/${locker.sessionId}`)}
                    >
                      View Session
                    </Button>
                  )}
                  {isLockerA2 && (
                    <Button
                      size="sm"
                      variant="primary"
                      className="w-full text-xs bg-indigo-600 hover:bg-indigo-700"
                      onClick={handleRearmLocker}
                      loading={rearming}
                    >
                      {locker.state === 'AVAILABLE' ? '⚡ Arm for Test' : '⚡ Re-arm / New OTP'}
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
