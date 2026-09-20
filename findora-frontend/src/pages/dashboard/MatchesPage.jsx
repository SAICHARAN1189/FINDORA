// src/pages/dashboard/MatchesPage.jsx
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { matchesAPI } from '../../lib/api';
import { Card, CardContent } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { Spinner } from '../../components/ui/Spinner';
import { GitCompare } from 'lucide-react';
import { formatRelativeTime, getStatusColor } from '../../lib/utils';
import toast from 'react-hot-toast';

export default function MatchesPage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [matches, setMatches] = useState([]);

  useEffect(() => {
    fetchMatches();
  }, []);

  const fetchMatches = async () => {
    try {
      const { data } = await matchesAPI.getAll();
      setMatches(data.matches);
    } catch (error) {
      toast.error('Failed to fetch matches');
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
    <div className="max-w-5xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">AI Matches</h1>
        <p className="text-gray-600">Potential matches found by our AI</p>
      </div>

      {matches.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <GitCompare className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-600">No matches found yet</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {matches.map((match) => (
            <Card
              key={match.id}
              className="hover:shadow-lg transition-shadow cursor-pointer"
              onClick={() => navigate(`/matches/${match.id}`)}
            >
              <CardContent className="p-6">
                <div className="flex items-start gap-4">
                  <div className="flex-shrink-0">
                    <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center">
                      <span className="text-2xl font-bold text-blue-600">
                        {match.confidence}%
                      </span>
                    </div>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-2">
                      <Badge className={getStatusColor(match.status)}>
                        {match.status}
                      </Badge>
                      <span className="text-sm text-gray-500">
                        {formatRelativeTime(match.createdAt)}
                      </span>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="border border-red-200 bg-red-50 rounded-lg p-3">
                        <div className="text-xs text-red-600 font-medium mb-1">LOST</div>
                        <p className="font-medium text-gray-900">{match.lostReport?.title}</p>
                        <p className="text-sm text-gray-600">by {match.lostUser?.displayName}</p>
                      </div>
                      <div className="border border-green-200 bg-green-50 rounded-lg p-3">
                        <div className="text-xs text-green-600 font-medium mb-1">FOUND</div>
                        <p className="font-medium text-gray-900">{match.foundReport?.title}</p>
                        <p className="text-sm text-gray-600">by {match.foundUser?.displayName}</p>
                      </div>
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {match.reasons?.slice(0, 3).map((reason, idx) => (
                        <div
                          key={idx}
                          className="text-xs bg-gray-100 text-gray-700 px-2 py-1 rounded"
                        >
                          ✓ {reason.label}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
