// src/pages/dashboard/HomePage.jsx
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { reportsAPI, matchesAPI, adminAPI } from '../../lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { Spinner } from '../../components/ui/Spinner';
import { FileText, GitCompare, Lock, CheckCircle, Plus, TrendingUp } from 'lucide-react';
import { formatRelativeTime, getStatusColor, getCategoryIcon } from '../../lib/utils';

export default function HomePage() {
  const { user, isAdmin } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState(null);
  const [recentReports, setRecentReports] = useState([]);
  const [recentMatches, setRecentMatches] = useState([]);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [reportsRes, matchesRes] = await Promise.all([
        reportsAPI.getAll({ limit: 5 }),
        matchesAPI.getAll({ limit: 5 }),
      ]);

      setRecentReports(reportsRes.data.reports);
      setRecentMatches(matchesRes.data.matches);

      if (isAdmin()) {
        const statsRes = await adminAPI.getStats();
        setStats(statsRes.data);
      }
    } catch (error) {
      console.error('Failed to fetch data:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Spinner size="lg" />
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* Welcome Banner */}
      <div className="bg-gradient-to-r from-blue-600 to-purple-600 rounded-lg p-6 text-white">
        <h1 className="text-2xl font-bold mb-2">
          Welcome back, {user?.displayName}! 👋
        </h1>
        <p className="text-blue-100 mb-4">
          {isAdmin() 
            ? 'Manage reports, matches, and system settings from your admin dashboard.'
            : 'Report lost items or help others find their belongings.'}
        </p>
        <div className="flex gap-3">
          <Button onClick={() => navigate('/reports/new')} variant="secondary">
            <Plus className="w-4 h-4" />
            New Report
          </Button>
          <Button onClick={() => navigate('/matches')} variant="ghost" className="text-white border-white hover:bg-white/20">
            <GitCompare className="w-4 h-4" />
            View Matches
          </Button>
        </div>
      </div>

      {/* Stats Grid */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Total Reports</p>
                  <p className="text-2xl font-bold text-gray-900">{stats.totalReports}</p>
                </div>
                <FileText className="w-8 h-8 text-blue-600" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Active Matches</p>
                  <p className="text-2xl font-bold text-gray-900">{stats.totalMatches}</p>
                </div>
                <GitCompare className="w-8 h-8 text-purple-600" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Items Recovered</p>
                  <p className="text-2xl font-bold text-gray-900">{stats.collectedReports}</p>
                </div>
                <CheckCircle className="w-8 h-8 text-green-600" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Available Lockers</p>
                  <p className="text-2xl font-bold text-gray-900">{stats.availableLockers}/{stats.totalLockers}</p>
                </div>
                <Lock className="w-8 h-8 text-orange-600" />
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Reports */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Recent Reports</CardTitle>
              <Button variant="ghost" size="sm" onClick={() => navigate('/reports')}>
                View All
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {recentReports.length === 0 ? (
              <p className="text-center text-gray-500 py-8">No reports yet</p>
            ) : (
              <div className="space-y-3">
                {recentReports.map((report) => (
                  <div
                    key={report.id}
                    onClick={() => navigate(`/reports`)}
                    className="p-3 border border-gray-200 rounded-lg hover:bg-gray-50 cursor-pointer transition-colors"
                  >
                    <div className="flex items-start gap-3">
                      <span className="text-2xl">{getCategoryIcon(report.category)}</span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <Badge variant={report.type === 'lost' ? 'danger' : 'success'}>
                            {report.type.toUpperCase()}
                          </Badge>
                          <Badge className={getStatusColor(report.status)}>
                            {report.status}
                          </Badge>
                        </div>
                        <p className="font-medium text-gray-900 truncate">{report.title}</p>
                        <p className="text-sm text-gray-600 truncate">{report.description}</p>
                        <p className="text-xs text-gray-400 mt-1">
                          {formatRelativeTime(report.createdAt)}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Recent Matches */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Recent Matches</CardTitle>
              <Button variant="ghost" size="sm" onClick={() => navigate('/matches')}>
                View All
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {recentMatches.length === 0 ? (
              <p className="text-center text-gray-500 py-8">No matches yet</p>
            ) : (
              <div className="space-y-3">
                {recentMatches.map((match) => (
                  <div
                    key={match.id}
                    onClick={() => navigate(`/matches/${match.id}`)}
                    className="p-3 border border-gray-200 rounded-lg hover:bg-gray-50 cursor-pointer transition-colors"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <div className="text-2xl font-bold text-blue-600">
                          {match.confidence}%
                        </div>
                        <Badge className={getStatusColor(match.status)}>
                          {match.status}
                        </Badge>
                      </div>
                    </div>
                    <p className="text-sm text-gray-900 font-medium truncate">
                      {match.lostReport?.title} ↔️ {match.foundReport?.title}
                    </p>
                    <p className="text-xs text-gray-400 mt-1">
                      {formatRelativeTime(match.createdAt)}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions */}
      {!isAdmin() && (
        <Card>
          <CardHeader>
            <CardTitle>Quick Actions</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <button
                onClick={() => navigate('/reports/new')}
                className="p-4 border-2 border-dashed border-gray-300 rounded-lg hover:border-blue-500 hover:bg-blue-50 transition-colors"
              >
                <FileText className="w-8 h-8 text-blue-600 mx-auto mb-2" />
                <p className="font-medium text-gray-900">Report Lost/Found</p>
                <p className="text-sm text-gray-500">Create a new report</p>
              </button>
              <button
                onClick={() => navigate('/matches')}
                className="p-4 border-2 border-dashed border-gray-300 rounded-lg hover:border-purple-500 hover:bg-purple-50 transition-colors"
              >
                <GitCompare className="w-8 h-8 text-purple-600 mx-auto mb-2" />
                <p className="font-medium text-gray-900">View Matches</p>
                <p className="text-sm text-gray-500">Check potential matches</p>
              </button>
              <button
                onClick={() => navigate('/rewards')}
                className="p-4 border-2 border-dashed border-gray-300 rounded-lg hover:border-green-500 hover:bg-green-50 transition-colors"
              >
                <TrendingUp className="w-8 h-8 text-green-600 mx-auto mb-2" />
                <p className="font-medium text-gray-900">Rewards</p>
                <p className="text-sm text-gray-500">View your points & badges</p>
              </button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
