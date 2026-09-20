// src/pages/admin/EnhancedDashboard.jsx
import { useState, useEffect } from 'react';
import { adminAPI } from '../../lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/Card';
import { Spinner } from '../../components/ui/Spinner';
import { Badge } from '../../components/ui/Badge';
import { 
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer 
} from 'recharts';
import { 
  FileText, GitCompare, CheckCircle, Lock, Users, TrendingUp,
  AlertTriangle, Award, Clock, MapPin, Activity
} from 'lucide-react';
import toast from 'react-hot-toast';

const COLORS = ['#6366f1', '#8b5cf6', '#ec4899', '#f59e0b', '#10b981', '#3b82f6'];

export default function EnhancedDashboard() {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState({
    dashboard: null,
    trends: [],
    categories: [],
    engagement: null,
    fraud: null,
    geographic: []
  });

  useEffect(() => {
    fetchAllData();
  }, []);

  const fetchAllData = async () => {
    try {
      const [dashboard, trends, categories, engagement, fraud, geographic] = await Promise.all([
        adminAPI.getDashboard(),
        adminAPI.getAnalyticsTrends(30),
        adminAPI.getCategoryAnalytics(),
        adminAPI.getAnalyticsEngagement(),
        adminAPI.getFraudStats(),
        adminAPI.getAnalyticsGeographic()
      ]);

      setData({
        dashboard: dashboard.data,
        trends: trends.data.data || [],
        categories: categories.data.data || [],
        engagement: engagement.data,
        fraud: fraud.data,
        geographic: geographic.data.data || []
      });
    } catch (error) {
      console.error('Failed to fetch dashboard data:', error);
      toast.error('Failed to load dashboard data');
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

  const { dashboard, trends, categories, engagement, fraud, geographic } = data;
  const stats = dashboard?.overview || {};
  const matchStats = dashboard?.matches || {};
  const userStats = dashboard?.users || {};

  return (
    <div className="max-w-[1400px] mx-auto space-y-6 pb-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Admin Dashboard</h1>
          <p className="text-gray-600 mt-1">Comprehensive system analytics and insights</p>
        </div>
        <div className="text-right">
          <p className="text-sm text-gray-500">Last updated</p>
          <p className="text-sm font-medium">{new Date().toLocaleString()}</p>
        </div>
      </div>

      {/* Primary Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Total Reports"
          value={stats.totalReports}
          subtitle={`Lost: ${stats.lostReports} | Found: ${stats.foundReports}`}
          icon={<FileText className="w-8 h-8" />}
          color="blue"
        />
        <StatCard
          title="Total Matches"
          value={stats.totalMatches}
          subtitle={`${matchStats.acceptanceRate}% acceptance rate`}
          icon={<GitCompare className="w-8 h-8" />}
          color="purple"
        />
        <StatCard
          title="Success Rate"
          value={`${Math.round((stats.collectedReports / stats.totalReports) * 100)}%`}
          subtitle={`${stats.collectedReports} items recovered`}
          icon={<CheckCircle className="w-8 h-8" />}
          color="green"
        />
        <StatCard
          title="Active Users"
          value={userStats.activeUsers}
          subtitle={`${userStats.totalUsers} total users`}
          icon={<Users className="w-8 h-8" />}
          color="orange"
        />
      </div>

      {/* Secondary Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-red-100 rounded-lg">
                <AlertTriangle className="w-6 h-6 text-red-600" />
              </div>
              <div className="flex-1">
                <p className="text-sm text-gray-600">Fraud Alerts</p>
                <div className="flex items-baseline gap-2">
                  <p className="text-2xl font-bold text-gray-900">{fraud?.requiresReview || 0}</p>
                  <Badge variant={fraud?.requiresReview > 5 ? "error" : "warning"} size="sm">
                    {fraud?.flagged || 0} flagged
                  </Badge>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-yellow-100 rounded-lg">
                <Award className="w-6 h-6 text-yellow-600" />
              </div>
              <div className="flex-1">
                <p className="text-sm text-gray-600">Avg Points/User</p>
                <p className="text-2xl font-bold text-gray-900">{userStats.averagePointsPerUser}</p>
                <p className="text-xs text-gray-500">{userStats.usersWithBadges} have badges</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-indigo-100 rounded-lg">
                <Clock className="w-6 h-6 text-indigo-600" />
              </div>
              <div className="flex-1">
                <p className="text-sm text-gray-600">Avg Resolution Time</p>
                <p className="text-2xl font-bold text-gray-900">
                  {dashboard?.timing?.averageFullResolution || 0}h
                </p>
                <p className="text-xs text-gray-500">From report to collection</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Charts Row 1 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Trends Chart */}
        <Card>
          <CardHeader>
            <CardTitle>Report Trends (30 Days)</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={trends.slice(-30)}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis 
                  dataKey="date" 
                  tickFormatter={(date) => new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                  tick={{ fontSize: 12 }}
                />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip 
                  labelFormatter={(date) => new Date(date).toLocaleDateString()}
                  contentStyle={{ borderRadius: '8px', border: '1px solid #e5e7eb' }}
                />
                <Legend />
                <Line type="monotone" dataKey="lost" stroke="#ef4444" strokeWidth={2} name="Lost" />
                <Line type="monotone" dataKey="found" stroke="#10b981" strokeWidth={2} name="Found" />
                <Line type="monotone" dataKey="matched" stroke="#6366f1" strokeWidth={2} name="Matched" />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Category Distribution */}
        <Card>
          <CardHeader>
            <CardTitle>Category Distribution</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={categories.slice(0, 8)}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip contentStyle={{ borderRadius: '8px', border: '1px solid #e5e7eb' }} />
                <Legend />
                <Bar dataKey="lost" fill="#ef4444" name="Lost" radius={[4, 4, 0, 0]} />
                <Bar dataKey="found" fill="#10b981" name="Found" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Charts Row 2 */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Match Quality */}
        <Card>
          <CardHeader>
            <CardTitle>Match Quality</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={250}>
              <PieChart>
                <Pie
                  data={[
                    { name: 'High (80-100%)', value: matchStats.byConfidence?.high || 0 },
                    { name: 'Medium (50-79%)', value: matchStats.byConfidence?.medium || 0 },
                    { name: 'Low (<50%)', value: matchStats.byConfidence?.low || 0 }
                  ]}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {[0, 1, 2].map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
            <div className="mt-4 text-center">
              <p className="text-sm text-gray-600">Average Confidence</p>
              <p className="text-2xl font-bold text-gray-900">{matchStats.averageConfidence}%</p>
            </div>
          </CardContent>
        </Card>

        {/* User Activity */}
        <Card>
          <CardHeader>
            <CardTitle>User Activity</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <ActivityBar 
                label="Very Active (10+ reports)"
                value={userStats.activityDistribution?.veryActive || 0}
                max={userStats.totalUsers}
                color="bg-green-500"
              />
              <ActivityBar 
                label="Active (5-9 reports)"
                value={userStats.activityDistribution?.active || 0}
                max={userStats.totalUsers}
                color="bg-blue-500"
              />
              <ActivityBar 
                label="Moderate (2-4 reports)"
                value={userStats.activityDistribution?.moderate || 0}
                max={userStats.totalUsers}
                color="bg-yellow-500"
              />
              <ActivityBar 
                label="Low (1 report)"
                value={userStats.activityDistribution?.low || 0}
                max={userStats.totalUsers}
                color="bg-gray-400"
              />
            </div>
            <div className="mt-6 pt-4 border-t">
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Avg Reports/User</span>
                <span className="font-semibold">{userStats.averageReportsPerUser}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Top Locations */}
        <Card>
          <CardHeader>
            <CardTitle>Top Locations</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {geographic.slice(0, 6).map((loc, idx) => (
                <div key={idx} className="flex items-center justify-between">
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    <MapPin className="w-4 h-4 text-gray-400 flex-shrink-0" />
                    <span className="text-sm text-gray-700 truncate">{loc.name}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" size="sm">{loc.total}</Badge>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Fraud Risk Overview */}
      {fraud && fraud.total > 0 && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Fraud Risk Overview (Last 7 Days)</CardTitle>
              <Badge variant="error">{fraud.requiresReview} require review</Badge>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <RiskStatCard label="Low Risk" value={fraud.byRisk?.LOW || 0} color="green" />
              <RiskStatCard label="Medium Risk" value={fraud.byRisk?.MEDIUM || 0} color="yellow" />
              <RiskStatCard label="High Risk" value={fraud.byRisk?.HIGH || 0} color="orange" />
              <RiskStatCard label="Critical Risk" value={fraud.byRisk?.CRITICAL || 0} color="red" />
            </div>
            {fraud.averageRiskScore > 0 && (
              <div className="mt-4 pt-4 border-t text-center">
                <p className="text-sm text-gray-600">Average Risk Score</p>
                <p className="text-2xl font-bold text-gray-900">{fraud.averageRiskScore}/100</p>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// Helper Components
function StatCard({ title, value, subtitle, icon, color }) {
  const colors = {
    blue: 'bg-blue-100 text-blue-600',
    purple: 'bg-purple-100 text-purple-600',
    green: 'bg-green-100 text-green-600',
    orange: 'bg-orange-100 text-orange-600'
  };

  return (
    <Card>
      <CardContent className="pt-6">
        <div className="flex items-center justify-between">
          <div className="flex-1">
            <p className="text-sm text-gray-600 mb-1">{title}</p>
            <p className="text-3xl font-bold text-gray-900 mb-1">{value}</p>
            {subtitle && <p className="text-xs text-gray-500">{subtitle}</p>}
          </div>
          <div className={`p-3 rounded-lg ${colors[color]}`}>
            {icon}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function ActivityBar({ label, value, max, color }) {
  const percentage = max > 0 ? (value / max) * 100 : 0;
  
  return (
    <div>
      <div className="flex justify-between text-sm mb-1">
        <span className="text-gray-600">{label}</span>
        <span className="font-medium">{value}</span>
      </div>
      <div className="w-full bg-gray-200 rounded-full h-2">
        <div 
          className={`${color} h-2 rounded-full transition-all duration-300`}
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
}

function RiskStatCard({ label, value, color }) {
  const colors = {
    green: 'bg-green-100 text-green-800 border-green-200',
    yellow: 'bg-yellow-100 text-yellow-800 border-yellow-200',
    orange: 'bg-orange-100 text-orange-800 border-orange-200',
    red: 'bg-red-100 text-red-800 border-red-200'
  };

  return (
    <div className={`p-4 rounded-lg border ${colors[color]}`}>
      <p className="text-sm font-medium mb-1">{label}</p>
      <p className="text-2xl font-bold">{value}</p>
    </div>
  );
}
