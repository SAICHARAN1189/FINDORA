// src/pages/admin/CaseManagement.jsx
import { useState, useEffect } from 'react';
import { adminAPI } from '../../lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/Card';
import { Spinner } from '../../components/ui/Spinner';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Select } from '../../components/ui/Select';
import { Modal } from '../../components/ui/Modal';
import { 
  Search, Filter, Flag, Archive, Trash2, CheckCircle, XCircle,
  AlertTriangle, Eye, MoreVertical
} from 'lucide-react';
import toast from 'react-hot-toast';

export default function CaseManagement() {
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filters, setFilters] = useState({
    type: 'all',
    status: 'all',
    flagged: 'all'
  });
  const [selectedReports, setSelectedReports] = useState([]);
  const [actionModal, setActionModal] = useState({ open: false, report: null, action: null });

  useEffect(() => {
    fetchReports();
  }, []);

  const fetchReports = async () => {
    try {
      const res = await adminAPI.getReports();
      setReports(res.data.reports || []);
    } catch (error) {
      toast.error('Failed to fetch reports');
    } finally {
      setLoading(false);
    }
  };

  const handleStatusChange = async (reportId, newStatus) => {
    try {
      await adminAPI.updateReportStatus(reportId, newStatus);
      toast.success('Status updated');
      fetchReports();
    } catch (error) {
      toast.error('Failed to update status');
    }
  };

  const handleFlag = async (reportId, reason) => {
    try {
      await adminAPI.flagReport(reportId, reason);
      toast.success('Report flagged');
      fetchReports();
      setActionModal({ open: false, report: null, action: null });
    } catch (error) {
      toast.error('Failed to flag report');
    }
  };

  const handleUnflag = async (reportId) => {
    try {
      await adminAPI.unflagReport(reportId);
      toast.success('Report unflagged');
      fetchReports();
    } catch (error) {
      toast.error('Failed to unflag report');
    }
  };

  const handleDelete = async (reportId, reason) => {
    try {
      await adminAPI.deleteReport(reportId, reason);
      toast.success('Report deleted');
      fetchReports();
      setActionModal({ open: false, report: null, action: null });
    } catch (error) {
      toast.error('Failed to delete report');
    }
  };

  const handleBulkAction = async (action) => {
    if (selectedReports.length === 0) {
      toast.error('No reports selected');
      return;
    }

    try {
      await adminAPI.bulkAction(selectedReports, action);
      toast.success(`${action} applied to ${selectedReports.length} reports`);
      setSelectedReports([]);
      fetchReports();
    } catch (error) {
      toast.error('Bulk action failed');
    }
  };

  const toggleSelectReport = (reportId) => {
    setSelectedReports(prev =>
      prev.includes(reportId)
        ? prev.filter(id => id !== reportId)
        : [...prev, reportId]
    );
  };

  const toggleSelectAll = () => {
    if (selectedReports.length === filteredReports.length) {
      setSelectedReports([]);
    } else {
      setSelectedReports(filteredReports.map(r => r.id));
    }
  };

  // Filter reports
  const filteredReports = reports.filter(report => {
    const matchesSearch = 
      report.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      report.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
      report.id.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesType = filters.type === 'all' || report.type === filters.type;
    const matchesStatus = filters.status === 'all' || report.status === filters.status;
    const matchesFlagged = 
      filters.flagged === 'all' ||
      (filters.flagged === 'flagged' && report.flagged) ||
      (filters.flagged === 'unflagged' && !report.flagged);
    
    return matchesSearch && matchesType && matchesStatus && matchesFlagged;
  });

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <Spinner size="lg" />
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Case Management</h1>
          <p className="text-gray-600 mt-1">Manage and review all reports</p>
        </div>
        <div className="text-sm text-gray-600">
          {filteredReports.length} of {reports.length} reports
        </div>
      </div>

      {/* Search and Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <Input
                  type="text"
                  placeholder="Search by title, description, or ID..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            <div className="flex gap-2">
              <Select value={filters.type} onChange={(e) => setFilters({...filters, type: e.target.value})}>
                <option value="all">All Types</option>
                <option value="lost">Lost</option>
                <option value="found">Found</option>
              </Select>
              <Select value={filters.status} onChange={(e) => setFilters({...filters, status: e.target.value})}>
                <option value="all">All Status</option>
                <option value="active">Active</option>
                <option value="matched">Matched</option>
                <option value="collected">Collected</option>
                <option value="closed">Closed</option>
              </Select>
              <Select value={filters.flagged} onChange={(e) => setFilters({...filters, flagged: e.target.value})}>
                <option value="all">All Flags</option>
                <option value="flagged">Flagged Only</option>
                <option value="unflagged">Not Flagged</option>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Bulk Actions */}
      {selectedReports.length > 0 && (
        <Card className="bg-blue-50 border-blue-200">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-blue-900">
                {selectedReports.length} report(s) selected
              </p>
              <div className="flex gap-2">
                <Button 
                  size="sm" 
                  variant="outline"
                  onClick={() => handleBulkAction('flag')}
                >
                  <Flag className="w-4 h-4 mr-1" />
                  Flag
                </Button>
                <Button 
                  size="sm" 
                  variant="outline"
                  onClick={() => handleBulkAction('archive')}
                >
                  <Archive className="w-4 h-4 mr-1" />
                  Archive
                </Button>
                <Button 
                  size="sm" 
                  variant="error"
                  onClick={() => handleBulkAction('delete')}
                >
                  <Trash2 className="w-4 h-4 mr-1" />
                  Delete
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Reports Table */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Reports</CardTitle>
            <Button size="sm" variant="ghost" onClick={toggleSelectAll}>
              {selectedReports.length === filteredReports.length ? 'Deselect All' : 'Select All'}
            </Button>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    <input
                      type="checkbox"
                      checked={selectedReports.length === filteredReports.length && filteredReports.length > 0}
                      onChange={toggleSelectAll}
                      className="rounded"
                    />
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">ID</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Title</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Type</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Flags</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {filteredReports.map((report) => (
                  <tr key={report.id} className="hover:bg-gray-50">
                    <td className="px-4 py-4">
                      <input
                        type="checkbox"
                        checked={selectedReports.includes(report.id)}
                        onChange={() => toggleSelectReport(report.id)}
                        className="rounded"
                      />
                    </td>
                    <td className="px-4 py-4 text-sm font-mono text-gray-600">
                      {report.id.slice(0, 8)}
                    </td>
                    <td className="px-4 py-4">
                      <div>
                        <p className="text-sm font-medium text-gray-900">{report.title}</p>
                        <p className="text-xs text-gray-500">{report.category}</p>
                      </div>
                    </td>
                    <td className="px-4 py-4">
                      <Badge variant={report.type === 'lost' ? 'error' : 'success'} size="sm">
                        {report.type}
                      </Badge>
                    </td>
                    <td className="px-4 py-4">
                      <Select
                        value={report.status}
                        onChange={(e) => handleStatusChange(report.id, e.target.value)}
                        className="text-sm"
                      >
                        <option value="active">Active</option>
                        <option value="matched">Matched</option>
                        <option value="collected">Collected</option>
                        <option value="closed">Closed</option>
                        <option value="archived">Archived</option>
                      </Select>
                    </td>
                    <td className="px-4 py-4 text-sm text-gray-600">
                      {new Date(report.createdAt).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-4">
                      {report.flagged ? (
                        <div className="flex items-center gap-1">
                          <AlertTriangle className="w-4 h-4 text-red-500" />
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleUnflag(report.id)}
                            className="text-xs"
                          >
                            Unflag
                          </Button>
                        </div>
                      ) : (
                        <span className="text-xs text-gray-400">None</span>
                      )}
                    </td>
                    <td className="px-4 py-4 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button 
                          size="sm" 
                          variant="ghost"
                          onClick={() => setActionModal({ open: true, report, action: 'flag' })}
                        >
                          <Flag className="w-4 h-4" />
                        </Button>
                        <Button 
                          size="sm" 
                          variant="ghost"
                          onClick={() => setActionModal({ open: true, report, action: 'delete' })}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {filteredReports.length === 0 && (
            <div className="text-center py-12 text-gray-500">
              No reports found matching your criteria
            </div>
          )}
        </CardContent>
      </Card>

      {/* Action Modal */}
      {actionModal.open && (
        <ActionModal
          report={actionModal.report}
          action={actionModal.action}
          onClose={() => setActionModal({ open: false, report: null, action: null })}
          onConfirm={(reason) => {
            if (actionModal.action === 'flag') {
              handleFlag(actionModal.report.id, reason);
            } else if (actionModal.action === 'delete') {
              handleDelete(actionModal.report.id, reason);
            }
          }}
        />
      )}
    </div>
  );
}

function ActionModal({ report, action, onClose, onConfirm }) {
  const [reason, setReason] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    onConfirm(reason);
  };

  return (
    <Modal open={true} onClose={onClose}>
      <div className="p-6">
        <h2 className="text-xl font-bold text-gray-900 mb-4">
          {action === 'flag' ? 'Flag Report' : 'Delete Report'}
        </h2>
        <p className="text-sm text-gray-600 mb-4">
          Report: <span className="font-medium">{report.title}</span>
        </p>
        <form onSubmit={handleSubmit}>
          <Input
            type="text"
            placeholder={action === 'flag' ? 'Reason for flagging...' : 'Reason for deletion...'}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            required
            className="mb-4"
          />
          <div className="flex gap-2 justify-end">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" variant={action === 'delete' ? 'error' : 'primary'}>
              Confirm
            </Button>
          </div>
        </form>
      </div>
    </Modal>
  );
}
