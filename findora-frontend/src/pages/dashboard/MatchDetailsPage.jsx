// src/pages/dashboard/MatchDetailsPage.jsx
import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { matchesAPI, lockersAPI, chatAPI } from '../../lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { Spinner } from '../../components/ui/Spinner';
import { Modal } from '../../components/ui/Modal';
import { ArrowLeft, Check, X, Lock, MessageSquare } from 'lucide-react';
import { formatDate, getStatusColor } from '../../lib/utils';
import toast from 'react-hot-toast';

export default function MatchDetailsPage() {
  const { id } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [match, setMatch] = useState(null);
  const [showReturnModal, setShowReturnModal] = useState(false);
  const [processing, setProcessing] = useState(false);

  useEffect(() => {
    fetchMatch();
  }, [id]);

  const fetchMatch = async () => {
    try {
      const { data } = await matchesAPI.getById(id);
      setMatch(data);
    } catch (error) {
      toast.error('Failed to load match');
      navigate('/matches');
    } finally {
      setLoading(false);
    }
  };

  const handleAccept = async () => {
    setProcessing(true);
    try {
      await matchesAPI.accept(id);
      toast.success('Match accepted!');
      fetchMatch();
    } catch (error) {
      toast.error(error.response?.data?.error || 'Failed to accept match');
    } finally {
      setProcessing(false);
    }
  };

  const handleReject = async () => {
    setProcessing(true);
    try {
      await matchesAPI.reject(id, 'Not the right item');
      toast.success('Match rejected');
      navigate('/matches');
    } catch (error) {
      toast.error('Failed to reject match');
    } finally {
      setProcessing(false);
    }
  };

  const handleVerify = async (returnMethod) => {
    setProcessing(true);
    try {
      await matchesAPI.verify(id, returnMethod);
      toast.success('Ownership verified!');
      
      if (returnMethod === 'locker') {
        const { data } = await lockersAPI.assign(id, match.foundReportId);
        navigate(`/lockers/session/${data.session.id}`);
      } else if (returnMethod === 'direct') {
        const { data } = await chatAPI.createChat(match.foundUserId, id);
        navigate(`/chat`);
      }
      
      setShowReturnModal(false);
      fetchMatch();
    } catch (error) {
      toast.error(error.response?.data?.error || 'Failed to verify');
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

  const isLostUser = match.lostUserId === user?.uid;
  const isFoundUser = match.foundUserId === user?.uid;

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" onClick={() => navigate('/matches')}>
          <ArrowLeft className="w-4 h-4" />
        </Button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-gray-900">Match Details</h1>
          <div className="flex items-center gap-2 mt-1">
            <Badge className={getStatusColor(match.status)}>{match.status}</Badge>
            <span className="text-sm text-gray-600">
              Confidence: <span className="font-bold text-blue-600">{match.confidence}%</span>
            </span>
          </div>
        </div>
      </div>

      {/* Match Reasons */}
      <Card>
        <CardHeader>
          <CardTitle>Why This Match?</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {match.reasons?.map((reason, idx) => (
              <div key={idx} className="flex items-center gap-2 bg-green-50 border border-green-200 rounded-lg p-3">
                <Check className="w-5 h-5 text-green-600 flex-shrink-0" />
                <div>
                  <div className="text-sm font-medium text-gray-900">{reason.label}</div>
                  <div className="text-xs text-gray-600">Score: {reason.score}/100</div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Reports Comparison */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card className="border-2 border-red-200">
          <CardHeader className="bg-red-50">
            <CardTitle className="text-red-800">Lost Report</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {match.lostReport?.imageUrl && (
              <img src={match.lostReport.imageUrl} alt="Lost" className="w-full h-48 object-cover rounded-lg mb-3" />
            )}
            <p className="font-bold text-lg">{match.lostReport?.title}</p>
            <p className="text-sm text-gray-600">{match.lostReport?.description}</p>
            <div className="text-sm space-y-1">
              <p><span className="font-medium">Brand:</span> {match.lostReport?.brand || 'N/A'}</p>
              <p><span className="font-medium">Color:</span> {match.lostReport?.color || 'N/A'}</p>
              <p><span className="font-medium">Location:</span> {match.lostReport?.location?.name || 'N/A'}</p>
              <p><span className="font-medium">Reported by:</span> {match.lostUser?.displayName}</p>
            </div>
          </CardContent>
        </Card>

        <Card className="border-2 border-green-200">
          <CardHeader className="bg-green-50">
            <CardTitle className="text-green-800">Found Report</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {match.foundReport?.imageUrl && (
              <img src={match.foundReport.imageUrl} alt="Found" className="w-full h-48 object-cover rounded-lg mb-3" />
            )}
            <p className="font-bold text-lg">{match.foundReport?.title}</p>
            <p className="text-sm text-gray-600">{match.foundReport?.description}</p>
            <div className="text-sm space-y-1">
              <p><span className="font-medium">Brand:</span> {match.foundReport?.brand || 'N/A'}</p>
              <p><span className="font-medium">Color:</span> {match.foundReport?.color || 'N/A'}</p>
              <p><span className="font-medium">Location:</span> {match.foundReport?.location?.name || 'N/A'}</p>
              <p><span className="font-medium">Reported by:</span> {match.foundUser?.displayName}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Actions */}
      <Card>
        <CardContent className="pt-6">
          {match.status === 'pending' && isLostUser && (
            <div className="space-y-3">
              <p className="text-sm text-gray-600">Is this your item?</p>
              <div className="flex gap-3">
                <Button onClick={handleAccept} loading={processing} className="flex-1">
                  <Check className="w-4 h-4" />
                  Yes, This Is My Item
                </Button>
                <Button variant="danger" onClick={handleReject} loading={processing}>
                  <X className="w-4 h-4" />
                  No, Not Mine
                </Button>
              </div>
            </div>
          )}

          {match.status === 'accepted' && isLostUser && (
            <div className="space-y-3">
              <p className="text-sm text-gray-600">Select return method to verify ownership:</p>
              <Button onClick={() => setShowReturnModal(true)} className="w-full">
                Verify & Choose Return Method
              </Button>
            </div>
          )}

          {match.status === 'verified' && (
            <div className="bg-green-50 border border-green-200 rounded-lg p-4">
              <p className="text-green-800 font-medium">✓ Ownership Verified</p>
              <p className="text-sm text-green-600">Return method: {match.returnMethod}</p>
            </div>
          )}

          {match.status === 'completed' && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <p className="text-blue-800 font-medium">🎉 Case Completed!</p>
              <p className="text-sm text-blue-600">Item has been successfully recovered.</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Return Method Modal */}
      <Modal isOpen={showReturnModal} onClose={() => setShowReturnModal(false)} title="Choose Return Method">
        <div className="space-y-4">
          <button
            onClick={() => handleVerify('direct')}
            disabled={processing}
            className="w-full p-4 border-2 border-gray-300 rounded-lg hover:border-blue-500 hover:bg-blue-50 transition-colors text-left"
          >
            <MessageSquare className="w-8 h-8 text-blue-600 mb-2" />
            <p className="font-medium text-gray-900">Direct Handover</p>
            <p className="text-sm text-gray-600">Chat with the finder to arrange pickup</p>
          </button>
          <button
            onClick={() => handleVerify('locker')}
            disabled={processing}
            className="w-full p-4 border-2 border-gray-300 rounded-lg hover:border-purple-500 hover:bg-purple-50 transition-colors text-left"
          >
            <Lock className="w-8 h-8 text-purple-600 mb-2" />
            <p className="font-medium text-gray-900">Smart Locker</p>
            <p className="text-sm text-gray-600">Secure contactless collection with OTP</p>
          </button>
        </div>
      </Modal>
    </div>
  );
}
