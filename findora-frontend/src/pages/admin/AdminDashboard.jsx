// src/pages/admin/AdminDashboard.jsx
import { useState, useEffect } from 'react';
import { adminAPI } from '../../lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/Card';
import { Spinner } from '../../components/ui/Spinner';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { FileText, GitCompare, CheckCircle, Lock } from 'lucide-react';
import toast from 'react-hot-toast';

export default function AdminDashboard() {
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState(null);
  const [categoryData, setCategoryData] = useState([]);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [statsRes, categoryRes] = await Promise.all([
        adminAPI.getStats(),
        adminAPI.getCategoryAnalytics(),
      ]);
      setStats(statsRes.data);
      setCategoryData(categoryRes.data.data);
    } catch (error) {
      toast.error('Failed to fetch admin data');
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
    <div className="max-w-7xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Admin Dashboard</h1>
        <p className="text-gray-600">System overview and analytics</p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Total Reports</p>
                <p className="text-2xl font-bold text-gray-900">{stats.totalReports}</p>
                <p className="text-xs text-gray-500 mt-1">
                  Lost: {stats.lostReports} | Found: {stats.foundReports}
                </p>
              </div>
              <FileText className="w-8 h-8 text-blue-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Total Matches</p>
                <p className="text-2xl font-bold text-gray-900">{stats.totalMatches}</p>
                <p className="text-xs text-gray-500 mt-1">
                  Pending: {stats.pendingMatches}
                </p>
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
                <p className="text-xs text-gray-500 mt-1">
                  Active: {stats.activeReports}
                </p>
              </div>
              <CheckCircle className="w-8 h-8 text-green-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Lockers</p>
                <p className="text-2xl font-bold text-gray-900">
                  {stats.availableLockers}/{stats.totalLockers}
                </p>
                <p className="text-xs text-gray-500 mt-1">
                  Online: {stats.onlineLockers}
                </p>
              </div>
              <Lock className="w-8 h-8 text-orange-600" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Category Analytics */}
      <Card>
        <CardHeader>
          <CardTitle>Reports by Category</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={categoryData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Bar dataKey="lost" fill="#ef4444" name="Lost" />
              <Bar dataKey="found" fill="#10b981" name="Found" />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </div>
  );
}
