// src/pages/dashboard/RewardsPage.jsx
import { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { adminAPI } from '../../lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { Spinner } from '../../components/ui/Spinner';
import { Trophy, Award, Star } from 'lucide-react';
import toast from 'react-hot-toast';

export default function RewardsPage() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [leaderboard, setLeaderboard] = useState([]);

  useEffect(() => {
    fetchLeaderboard();
  }, []);

  const fetchLeaderboard = async () => {
    try {
      const { data } = await adminAPI.getLeaderboard();
      setLeaderboard(data.leaderboard);
    } catch (error) {
      console.error('Failed to fetch leaderboard:', error);
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

  const userRank = leaderboard.find((u) => u.uid === user?.uid);

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Rewards & Leaderboard</h1>
        <p className="text-gray-600">Earn points for helping others</p>
      </div>

      {/* User Stats */}
      <Card className="bg-gradient-to-r from-blue-500 to-purple-600 text-white">
        <CardContent className="pt-6">
          <div className="flex items-center gap-4">
            <div className="w-20 h-20 bg-white/20 rounded-full flex items-center justify-center">
              <Trophy className="w-10 h-10" />
            </div>
            <div className="flex-1">
              <p className="text-sm text-blue-100">Your Points</p>
              <p className="text-4xl font-bold">{user?.rewardPoints || 0}</p>
              {userRank && (
                <p className="text-sm text-blue-100 mt-1">Rank #{userRank.rank}</p>
              )}
            </div>
          </div>
          {user?.badges && user.badges.length > 0 && (
            <div className="mt-4 pt-4 border-t border-white/20">
              <p className="text-sm text-blue-100 mb-2">Your Badges</p>
              <div className="flex gap-2 flex-wrap">
                {user.badges.map((badge) => (
                  <Badge key={badge} variant="default" className="bg-white/20 text-white">
                    {badge.replace('_', ' ')}
                  </Badge>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* How to Earn */}
      <Card>
        <CardHeader>
          <CardTitle>How to Earn Points</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="flex items-start gap-3">
              <Star className="w-5 h-5 text-yellow-500 flex-shrink-0 mt-1" />
              <div>
                <p className="font-medium text-gray-900">Report Found Item</p>
                <p className="text-sm text-gray-600">+50 points</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <Star className="w-5 h-5 text-yellow-500 flex-shrink-0 mt-1" />
              <div>
                <p className="font-medium text-gray-900">Report Lost Item</p>
                <p className="text-sm text-gray-600">+10 points</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <Star className="w-5 h-5 text-yellow-500 flex-shrink-0 mt-1" />
              <div>
                <p className="font-medium text-gray-900">Verified Return</p>
                <p className="text-sm text-gray-600">+100 points</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <Star className="w-5 h-5 text-yellow-500 flex-shrink-0 mt-1" />
              <div>
                <p className="font-medium text-gray-900">Item Recovered</p>
                <p className="text-sm text-gray-600">+25 points</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Leaderboard */}
      <Card>
        <CardHeader>
          <CardTitle>Top Contributors</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {leaderboard.slice(0, 10).map((entry) => (
              <div
                key={entry.uid}
                className={`flex items-center gap-4 p-3 rounded-lg ${
                  entry.uid === user?.uid ? 'bg-blue-50 border-2 border-blue-300' : 'bg-gray-50'
                }`}
              >
                <div
                  className={`w-10 h-10 rounded-full flex items-center justify-center font-bold ${
                    entry.rank === 1
                      ? 'bg-yellow-400 text-yellow-900'
                      : entry.rank === 2
                      ? 'bg-gray-300 text-gray-800'
                      : entry.rank === 3
                      ? 'bg-orange-400 text-orange-900'
                      : 'bg-gray-200 text-gray-700'
                  }`}
                >
                  {entry.rank}
                </div>
                <div className="flex-1">
                  <p className="font-medium text-gray-900">{entry.displayName}</p>
                  <div className="flex gap-1 mt-1">
                    {entry.badges.slice(0, 3).map((badge) => (
                      <Badge key={badge} variant="default" className="text-xs">
                        {badge}
                      </Badge>
                    ))}
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-lg font-bold text-blue-600">{entry.rewardPoints}</p>
                  <p className="text-xs text-gray-500">points</p>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
