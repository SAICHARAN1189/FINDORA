// src/pages/dashboard/ReportsPage.jsx
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { reportsAPI } from '../../lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Input, Select } from '../../components/ui/Input';
import { Badge } from '../../components/ui/Badge';
import { Spinner } from '../../components/ui/Spinner';
import { Plus, Search, Filter } from 'lucide-react';
import { formatRelativeTime, getStatusColor, getCategoryIcon, CATEGORIES } from '../../lib/utils';
import toast from 'react-hot-toast';

export default function ReportsPage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [reports, setReports] = useState([]);
  const [filters, setFilters] = useState({
    type: '',
    status: '',
    category: '',
    search: '',
  });

  useEffect(() => {
    fetchReports();
  }, [filters]);

  const fetchReports = async () => {
    try {
      setLoading(true);
      const params = {};
      if (filters.type) params.type = filters.type;
      if (filters.status) params.status = filters.status;
      if (filters.category) params.category = filters.category;

      const { data } = await reportsAPI.getAll(params);
      let filtered = data.reports;

      if (filters.search) {
        const searchLower = filters.search.toLowerCase();
        filtered = filtered.filter(
          (r) =>
            r.title?.toLowerCase().includes(searchLower) ||
            r.description?.toLowerCase().includes(searchLower) ||
            r.brand?.toLowerCase().includes(searchLower)
        );
      }

      setReports(filtered);
    } catch (error) {
      toast.error('Failed to fetch reports');
    } finally {
      setLoading(false);
    }
  };

  const handleFilterChange = (key, value) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
  };

  const clearFilters = () => {
    setFilters({ type: '', status: '', category: '', search: '' });
  };

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Reports</h1>
          <p className="text-gray-600">Manage lost and found reports</p>
        </div>
        <Button onClick={() => navigate('/reports/new')}>
          <Plus className="w-4 h-4" />
          New Report
        </Button>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
            <Input
              placeholder="Search reports..."
              value={filters.search}
              onChange={(e) => handleFilterChange('search', e.target.value)}
              className="md:col-span-2"
            />
            <Select
              value={filters.type}
              onChange={(e) => handleFilterChange('type', e.target.value)}
              options={[
                { value: '', label: 'All Types' },
                { value: 'lost', label: 'Lost' },
                { value: 'found', label: 'Found' },
              ]}
            />
            <Select
              value={filters.status}
              onChange={(e) => handleFilterChange('status', e.target.value)}
              options={[
                { value: '', label: 'All Status' },
                { value: 'active', label: 'Active' },
                { value: 'matched', label: 'Matched' },
                { value: 'collected', label: 'Collected' },
              ]}
            />
            <Select
              value={filters.category}
              onChange={(e) => handleFilterChange('category', e.target.value)}
              options={[
                { value: '', label: 'All Categories' },
                ...CATEGORIES.map((c) => ({ value: c.value, label: c.label })),
              ]}
            />
          </div>
          {(filters.type || filters.status || filters.category || filters.search) && (
            <div className="mt-4">
              <Button variant="ghost" size="sm" onClick={clearFilters}>
                Clear Filters
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Reports List */}
      {loading ? (
        <div className="flex justify-center py-12">
          <Spinner size="lg" />
        </div>
      ) : reports.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Search className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-600 mb-4">No reports found</p>
            <Button onClick={() => navigate('/reports/new')}>
              <Plus className="w-4 h-4" />
              Create First Report
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {reports.map((report) => (
            <Card key={report.id} className="hover:shadow-lg transition-shadow cursor-pointer">
              <CardContent className="p-0">
                {report.imageUrl && (
                  <img
                    src={report.imageUrl}
                    alt={report.title}
                    className="w-full h-48 object-cover rounded-t-lg"
                  />
                )}
                <div className="p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-2xl">{getCategoryIcon(report.category)}</span>
                    <Badge variant={report.type === 'lost' ? 'danger' : 'success'}>
                      {report.type.toUpperCase()}
                    </Badge>
                    <Badge className={getStatusColor(report.status)}>
                      {report.status}
                    </Badge>
                  </div>
                  <h3 className="font-semibold text-gray-900 mb-1">{report.title}</h3>
                  <p className="text-sm text-gray-600 mb-2 line-clamp-2">
                    {report.description}
                  </p>
                  <div className="flex items-center justify-between text-xs text-gray-500">
                    <span>{report.location?.name || 'Unknown location'}</span>
                    <span>{formatRelativeTime(report.createdAt)}</span>
                  </div>
                  {report.brand && (
                    <div className="mt-2 text-sm">
                      <span className="font-medium">Brand:</span> {report.brand}
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
