// src/pages/dashboard/ProfilePage.jsx
import { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { authAPI } from '../../lib/api';
import { Card, CardContent } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { User, Mail, Award, Calendar, Send, CheckCircle, XCircle, Link, Unlink, ExternalLink } from 'lucide-react';
import { formatDate } from '../../lib/utils';
import toast from 'react-hot-toast';

// ── Telegram icon (SVG, since lucide doesn't have one) ──────────
function TelegramIcon({ className }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
      <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z" />
    </svg>
  );
}

export default function ProfilePage() {
  const { user, updateUser } = useAuth();

  // Telegram linking state
  const [tgLinked, setTgLinked] = useState(!!user?.telegramChatId);
  const [tgChatId, setTgChatId] = useState(user?.telegramChatId || null);
  const [linkCode, setLinkCode] = useState('');
  const [showLinkForm, setShowLinkForm] = useState(false);
  const [linking, setLinking] = useState(false);
  const [unlinking, setUnlinking] = useState(false);

  // Sync from user context if it updates
  useEffect(() => {
    setTgLinked(!!user?.telegramChatId);
    setTgChatId(user?.telegramChatId || null);
  }, [user?.telegramChatId]);

  const handleLinkTelegram = async (e) => {
    e.preventDefault();
    if (!linkCode.trim()) return toast.error('Enter your link code');
    setLinking(true);
    try {
      const { data } = await authAPI.linkTelegram(linkCode.trim());
      setTgLinked(true);
      setTgChatId(data.telegramChatId);
      setShowLinkForm(false);
      setLinkCode('');
      updateUser(data.user);
      toast.success('🎉 Telegram linked! You\'ll receive locker OTPs there.');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to link Telegram');
    } finally {
      setLinking(false);
    }
  };

  const handleUnlinkTelegram = async () => {
    if (!confirm('Unlink your Telegram account? You will no longer receive OTPs on Telegram.')) return;
    setUnlinking(true);
    try {
      const { data } = await authAPI.unlinkTelegram();
      setTgLinked(false);
      setTgChatId(null);
      updateUser(data.user);
      toast.success('Telegram account unlinked.');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to unlink Telegram');
    } finally {
      setUnlinking(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Profile</h1>
        <p className="text-gray-600">Your account information and settings</p>
      </div>

      {/* ── Account Info Card ── */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center gap-4 mb-6">
            <div className="w-20 h-20 bg-blue-600 rounded-full flex items-center justify-center text-3xl text-white font-bold">
              {user?.displayName?.[0] || 'U'}
            </div>
            <div>
              <h2 className="text-2xl font-bold text-gray-900">{user?.displayName}</h2>
              <Badge variant="primary" className="mt-1 capitalize">
                {user?.role?.replace('_', ' ')}
              </Badge>
            </div>
          </div>

          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <Mail className="w-5 h-5 text-gray-400" />
              <div>
                <p className="text-sm text-gray-600">Email</p>
                <p className="font-medium text-gray-900">{user?.email}</p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <Award className="w-5 h-5 text-gray-400" />
              <div>
                <p className="text-sm text-gray-600">Reward Points</p>
                <p className="font-medium text-gray-900">{user?.rewardPoints || 0}</p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <Calendar className="w-5 h-5 text-gray-400" />
              <div>
                <p className="text-sm text-gray-600">Member Since</p>
                <p className="font-medium text-gray-900">{formatDate(user?.createdAt)}</p>
              </div>
            </div>

            {user?.badges && user.badges.length > 0 && (
              <div>
                <p className="text-sm text-gray-600 mb-2">Badges</p>
                <div className="flex gap-2 flex-wrap">
                  {user.badges.map((badge) => (
                    <Badge key={badge} variant="success">
                      {badge.replace('_', ' ')}
                    </Badge>
                  ))}
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* ── Telegram Integration Card ── */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 bg-[#229ED9] rounded-xl flex items-center justify-center">
              <TelegramIcon className="w-6 h-6 text-white" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-gray-900">Telegram OTP Delivery</h3>
              <p className="text-sm text-gray-500">Receive locker access codes via Telegram</p>
            </div>
          </div>

          {tgLinked ? (
            /* ── Linked State ── */
            <div className="space-y-4">
              <div className="flex items-center gap-3 p-3 bg-green-50 border border-green-200 rounded-lg">
                <CheckCircle className="w-5 h-5 text-green-600 shrink-0" />
                <div>
                  <p className="text-sm font-medium text-green-800">Telegram account linked</p>
                  <p className="text-xs text-green-600">Chat ID: {tgChatId}</p>
                </div>
              </div>
              <p className="text-sm text-gray-600">
                🔑 Your locker OTPs will be sent to your Telegram chat when an item is deposited and ready for collection.
              </p>
              <button
                onClick={handleUnlinkTelegram}
                disabled={unlinking}
                className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-red-600 bg-red-50 border border-red-200 rounded-lg hover:bg-red-100 transition-colors disabled:opacity-50"
              >
                <Unlink className="w-4 h-4" />
                {unlinking ? 'Unlinking…' : 'Unlink Telegram'}
              </button>
            </div>
          ) : (
            /* ── Not Linked State ── */
            <div className="space-y-4">
              <div className="flex items-center gap-3 p-3 bg-gray-50 border border-gray-200 rounded-lg">
                <XCircle className="w-5 h-5 text-gray-400 shrink-0" />
                <p className="text-sm text-gray-600">No Telegram account linked</p>
              </div>

              {!showLinkForm ? (
                <div className="space-y-3">
                  <p className="text-sm text-gray-600">
                    Link your Telegram account to receive smart locker OTPs directly on Telegram instead of only as in-app notifications.
                  </p>
                  <button
                    onClick={() => setShowLinkForm(true)}
                    className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-[#229ED9] rounded-lg hover:bg-[#1a8bc4] transition-colors"
                  >
                    <Link className="w-4 h-4" />
                    Link Telegram Account
                  </button>
                </div>
              ) : (
                /* ── Link Form ── */
                <div className="space-y-4">
                  {/* Instructions */}
                  <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg space-y-2">
                    <p className="text-sm font-semibold text-blue-900">How to link:</p>
                    <ol className="text-sm text-blue-800 list-decimal list-inside space-y-1">
                      <li>
                        Open Telegram and start your OTP bot
                        <a
                          href="https://t.me"
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 ml-1 text-blue-600 underline"
                        >
                          Open Telegram <ExternalLink className="w-3 h-3" />
                        </a>
                      </li>
                      <li>Send <code className="bg-blue-100 px-1 rounded font-mono">/start</code> to the bot</li>
                      <li>Copy the <strong>8-character link code</strong> (e.g. <code className="bg-blue-100 px-1 rounded font-mono">ABCD-1234</code>)</li>
                      <li>Paste it below and click <strong>Link</strong></li>
                    </ol>
                  </div>

                  <form onSubmit={handleLinkTelegram} className="space-y-3">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Link Code from Telegram Bot
                      </label>
                      <input
                        id="telegram-link-code"
                        type="text"
                        placeholder="XXXX-XXXX"
                        value={linkCode}
                        onChange={(e) => setLinkCode(e.target.value.toUpperCase())}
                        maxLength={9}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg font-mono text-lg tracking-widest text-center focus:outline-none focus:ring-2 focus:ring-blue-500 uppercase"
                      />
                    </div>
                    <div className="flex gap-2">
                      <button
                        type="submit"
                        disabled={linking || linkCode.length < 9}
                        className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-[#229ED9] rounded-lg hover:bg-[#1a8bc4] transition-colors disabled:opacity-50"
                      >
                        <Send className="w-4 h-4" />
                        {linking ? 'Linking…' : 'Link'}
                      </button>
                      <button
                        type="button"
                        onClick={() => { setShowLinkForm(false); setLinkCode(''); }}
                        className="px-4 py-2 text-sm font-medium text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
                      >
                        Cancel
                      </button>
                    </div>
                  </form>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
