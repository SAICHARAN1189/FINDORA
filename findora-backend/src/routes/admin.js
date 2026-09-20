// src/routes/admin.js
const express = require('express');
const router = express.Router();
const store = require('../config/demoStore');
const { authenticate, requireRole } = require('../middleware/auth');
const fraudDetection = require('../services/fraudDetection');
const rewardsSystem = require('../services/rewardsSystem');
const analytics = require('../services/analytics');

// ==================== DASHBOARD & STATS ====================

// GET /api/admin/stats
router.get('/stats', authenticate, requireRole('institution_admin', 'super_admin', 'police'), (req, res) => {
  const stats = store.getStats();
  res.json(stats);
});

// GET /api/admin/dashboard - Comprehensive dashboard data
router.get('/dashboard', authenticate, requireRole('institution_admin', 'super_admin'), (req, res) => {
  const summary = analytics.getDashboardSummary();
  const fraudStats = fraudDetection.getFraudStats();
  const leaderboard = rewardsSystem.getLeaderboard(10);
  
  res.json({
    ...summary,
    fraud: fraudStats,
    topUsers: leaderboard
  });
});

// GET /api/admin/users
router.get('/users', authenticate, requireRole('institution_admin', 'super_admin'), (req, res) => {
  const users = store.getAllUsers().map(u => ({ ...u })); // Don't expose sensitive fields
  res.json({ users });
});

// PUT /api/admin/users/:uid/role
router.put('/users/:uid/role', authenticate, requireRole('super_admin'), (req, res) => {
  const { role } = req.body;
  const validRoles = ['user', 'institution_admin', 'police', 'super_admin'];
  if (!validRoles.includes(role)) return res.status(400).json({ error: 'Invalid role' });

  const updated = store.updateUser(req.params.uid, { role });
  store.addAuditLog({ action: 'ROLE_CHANGED', userId: req.user.uid, targetUserId: req.params.uid, details: `Role -> ${role}` });
  res.json(updated);
});

// POST /api/admin/users/:uid/block
router.post('/users/:uid/block', authenticate, requireRole('institution_admin', 'super_admin'), (req, res) => {
  store.updateUser(req.params.uid, { blocked: true });
  store.addAuditLog({ action: 'USER_BLOCKED', userId: req.user.uid, targetUserId: req.params.uid });
  res.json({ message: 'User blocked' });
});

// POST /api/admin/users/:uid/unblock
router.post('/users/:uid/unblock', authenticate, requireRole('institution_admin', 'super_admin'), (req, res) => {
  store.updateUser(req.params.uid, { blocked: false });
  store.addAuditLog({ action: 'USER_UNBLOCKED', userId: req.user.uid, targetUserId: req.params.uid });
  res.json({ message: 'User unblocked' });
});

// GET /api/admin/audit-logs
router.get('/audit-logs', authenticate, requireRole('institution_admin', 'super_admin'), (req, res) => {
  const logs = store.getAuditLogs();
  res.json({ logs });
});

// GET /api/admin/reports (all reports for admin)
router.get('/reports', authenticate, requireRole('institution_admin', 'super_admin', 'police'), (req, res) => {
  const reports = store.getAllReports();
  reports.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  res.json({ reports });
});

// Analytics endpoints
router.get('/analytics/categories', authenticate, requireRole('institution_admin', 'super_admin'), (req, res) => {
  const reports = store.getAllReports();
  const byCategory = {};
  reports.forEach(r => {
    if (!byCategory[r.category]) byCategory[r.category] = { lost: 0, found: 0, total: 0 };
    byCategory[r.category][r.type]++;
    byCategory[r.category].total++;
  });
  res.json({ data: Object.entries(byCategory).map(([name, counts]) => ({ name, ...counts })) });
});

router.get('/analytics/timeline', authenticate, requireRole('institution_admin', 'super_admin'), (req, res) => {
  const reports = store.getAllReports();
  const byDay = {};
  reports.forEach(r => {
    const day = r.createdAt.split('T')[0];
    if (!byDay[day]) byDay[day] = { date: day, lost: 0, found: 0, recovered: 0 };
    byDay[day][r.type]++;
    if (r.status === 'collected') byDay[day].recovered++;
  });
  res.json({ data: Object.values(byDay).sort((a, b) => a.date.localeCompare(b.date)) });
});

// Rewards leaderboard
router.get('/leaderboard', authenticate, (req, res) => {
  const users = store.getAllUsers()
    .filter(u => u.role === 'user')
    .sort((a, b) => (b.rewardPoints || 0) - (a.rewardPoints || 0))
    .slice(0, 20)
    .map((u, i) => ({
      rank: i + 1,
      uid: u.uid,
      displayName: u.displayName,
      rewardPoints: u.rewardPoints || 0,
      badges: u.badges || [],
    }));
  res.json({ leaderboard: users });
});

// ==================== CASE MANAGEMENT ====================

// PUT /api/admin/reports/:id/status - Update report status
router.put('/reports/:id/status', authenticate, requireRole('institution_admin', 'super_admin', 'police'), (req, res) => {
  const { status } = req.body;
  const validStatuses = ['active', 'matched', 'collected', 'closed', 'archived'];
  
  if (!validStatuses.includes(status)) {
    return res.status(400).json({ error: 'Invalid status' });
  }
  
  const report = store.getReport(req.params.id);
  if (!report) {
    return res.status(404).json({ error: 'Report not found' });
  }
  
  store.updateReport(req.params.id, { status });
  store.addAuditLog({
    action: 'REPORT_STATUS_CHANGED',
    userId: req.user.uid,
    targetReportId: req.params.id,
    details: `Status: ${report.status} → ${status}`
  });
  
  res.json({ message: 'Status updated', report: store.getReport(req.params.id) });
});

// POST /api/admin/reports/:id/flag - Flag report as suspicious
router.post('/reports/:id/flag', authenticate, requireRole('institution_admin', 'super_admin'), (req, res) => {
  const { reason } = req.body;
  
  store.updateReport(req.params.id, {
    flagged: true,
    flagReason: reason || 'Flagged by admin',
    flaggedBy: req.user.uid,
    flaggedAt: new Date().toISOString()
  });
  
  store.addAuditLog({
    action: 'REPORT_FLAGGED',
    userId: req.user.uid,
    targetReportId: req.params.id,
    details: reason || 'Flagged by admin'
  });
  
  res.json({ message: 'Report flagged' });
});

// POST /api/admin/reports/:id/unflag - Unflag report
router.post('/reports/:id/unflag', authenticate, requireRole('institution_admin', 'super_admin'), (req, res) => {
  store.updateReport(req.params.id, {
    flagged: false,
    flagReason: null,
    flaggedBy: null,
    flaggedAt: null
  });
  
  store.addAuditLog({
    action: 'REPORT_UNFLAGGED',
    userId: req.user.uid,
    targetReportId: req.params.id
  });
  
  res.json({ message: 'Report unflagged' });
});

// DELETE /api/admin/reports/:id - Delete report (soft delete)
router.delete('/reports/:id', authenticate, requireRole('institution_admin', 'super_admin'), (req, res) => {
  const { reason } = req.body;
  
  store.updateReport(req.params.id, {
    status: 'deleted',
    deletedBy: req.user.uid,
    deletedAt: new Date().toISOString(),
    deletionReason: reason
  });
  
  store.addAuditLog({
    action: 'REPORT_DELETED',
    userId: req.user.uid,
    targetReportId: req.params.id,
    details: reason || 'Deleted by admin'
  });
  
  res.json({ message: 'Report deleted' });
});

// POST /api/admin/reports/bulk-action - Bulk operations
router.post('/reports/bulk-action', authenticate, requireRole('institution_admin', 'super_admin'), (req, res) => {
  const { reportIds, action, data } = req.body;
  
  if (!Array.isArray(reportIds) || reportIds.length === 0) {
    return res.status(400).json({ error: 'reportIds array required' });
  }
  
  const results = {
    success: [],
    failed: []
  };
  
  reportIds.forEach(id => {
    try {
      switch (action) {
        case 'flag':
          store.updateReport(id, { flagged: true, flagReason: data?.reason });
          break;
        case 'unflag':
          store.updateReport(id, { flagged: false });
          break;
        case 'archive':
          store.updateReport(id, { status: 'archived' });
          break;
        case 'delete':
          store.updateReport(id, { status: 'deleted', deletedBy: req.user.uid });
          break;
        default:
          throw new Error('Invalid action');
      }
      results.success.push(id);
    } catch (error) {
      results.failed.push({ id, error: error.message });
    }
  });
  
  store.addAuditLog({
    action: 'BULK_OPERATION',
    userId: req.user.uid,
    details: `${action} on ${results.success.length} reports`
  });
  
  res.json(results);
});

// ==================== FRAUD DETECTION ====================

// GET /api/admin/fraud/stats - Get fraud detection statistics
router.get('/fraud/stats', authenticate, requireRole('institution_admin', 'super_admin'), (req, res) => {
  const stats = fraudDetection.getFraudStats();
  res.json(stats);
});

// GET /api/admin/fraud/high-risk - Get high-risk reports
router.get('/fraud/high-risk', authenticate, requireRole('institution_admin', 'super_admin'), (req, res) => {
  const limit = parseInt(req.query.limit) || 20;
  const highRisk = fraudDetection.getHighRiskReports(limit);
  res.json({ reports: highRisk });
});

// GET /api/admin/fraud/assessment/:reportId - Get fraud assessment for report
router.get('/fraud/assessment/:reportId', authenticate, requireRole('institution_admin', 'super_admin'), (req, res) => {
  const assessments = store.getFraudAssessmentsByReport(req.params.reportId);
  res.json({ assessments });
});

// POST /api/admin/fraud/scan/:reportId - Manually trigger fraud scan
router.post('/fraud/scan/:reportId', authenticate, requireRole('institution_admin', 'super_admin'), (req, res) => {
  const report = store.getReport(req.params.reportId);
  
  if (!report) {
    return res.status(404).json({ error: 'Report not found' });
  }
  
  const assessment = fraudDetection.detectFraud(report);
  
  store.addAuditLog({
    action: 'FRAUD_SCAN_MANUAL',
    userId: req.user.uid,
    targetReportId: req.params.reportId,
    details: `Risk: ${assessment.riskLevel}, Score: ${assessment.riskScore}`
  });
  
  res.json({ assessment });
});

// ==================== REWARDS MANAGEMENT ====================

// GET /api/admin/rewards/leaderboard - Full leaderboard
router.get('/rewards/leaderboard', authenticate, requireRole('institution_admin', 'super_admin'), (req, res) => {
  const limit = parseInt(req.query.limit) || 100;
  const leaderboard = rewardsSystem.getLeaderboard(limit);
  res.json({ leaderboard });
});

// POST /api/admin/rewards/award - Manually award points
router.post('/rewards/award', authenticate, requireRole('institution_admin', 'super_admin'), (req, res) => {
  const { userId, points, reason } = req.body;
  
  if (!userId || !points || !reason) {
    return res.status(400).json({ error: 'userId, points, and reason required' });
  }
  
  const result = rewardsSystem.awardPoints(userId, points, reason, {
    awardedBy: req.user.uid,
    manual: true
  });
  
  store.addAuditLog({
    action: 'POINTS_MANUAL_AWARD',
    userId: req.user.uid,
    targetUserId: userId,
    details: `+${points} points: ${reason}`
  });
  
  res.json(result);
});

// POST /api/admin/rewards/deduct - Manually deduct points
router.post('/rewards/deduct', authenticate, requireRole('institution_admin', 'super_admin'), (req, res) => {
  const { userId, points, reason } = req.body;
  
  if (!userId || !points || !reason) {
    return res.status(400).json({ error: 'userId, points, and reason required' });
  }
  
  const result = rewardsSystem.deductPoints(userId, points, reason);
  
  store.addAuditLog({
    action: 'POINTS_MANUAL_DEDUCT',
    userId: req.user.uid,
    targetUserId: userId,
    details: `-${points} points: ${reason}`
  });
  
  res.json(result);
});

// POST /api/admin/rewards/badge - Manually award badge
router.post('/rewards/badge', authenticate, requireRole('super_admin'), (req, res) => {
  const { userId, badgeId } = req.body;
  
  const user = store.getUser(userId);
  if (!user) {
    return res.status(404).json({ error: 'User not found' });
  }
  
  const badges = user.badges || [];
  if (badges.includes(badgeId)) {
    return res.status(400).json({ error: 'User already has this badge' });
  }
  
  badges.push(badgeId);
  store.updateUser(userId, { badges });
  
  store.addAuditLog({
    action: 'BADGE_MANUAL_AWARD',
    userId: req.user.uid,
    targetUserId: userId,
    details: `Badge: ${badgeId}`
  });
  
  res.json({ message: 'Badge awarded', badges });
});

// ==================== ANALYTICS ====================

// GET /api/admin/analytics/trends - Report trends
router.get('/analytics/trends', authenticate, requireRole('institution_admin', 'super_admin'), (req, res) => {
  const days = parseInt(req.query.days) || 30;
  const trends = analytics.getReportTrends(days);
  res.json({ data: trends });
});

// GET /api/admin/analytics/geographic - Geographic distribution
router.get('/analytics/geographic', authenticate, requireRole('institution_admin', 'super_admin'), (req, res) => {
  const data = analytics.getGeographicAnalytics();
  res.json({ data });
});

// GET /api/admin/analytics/matches - Match analytics
router.get('/analytics/matches', authenticate, requireRole('institution_admin', 'super_admin'), (req, res) => {
  const data = analytics.getMatchAnalytics();
  res.json(data);
});

// GET /api/admin/analytics/engagement - User engagement
router.get('/analytics/engagement', authenticate, requireRole('institution_admin', 'super_admin'), (req, res) => {
  const data = analytics.getUserEngagementMetrics();
  res.json(data);
});

// GET /api/admin/analytics/timing - Time analytics
router.get('/analytics/timing', authenticate, requireRole('institution_admin', 'super_admin'), (req, res) => {
  const data = analytics.getTimeAnalytics();
  res.json(data);
});

// GET /api/admin/analytics/brands - Brand analytics
router.get('/analytics/brands', authenticate, requireRole('institution_admin', 'super_admin'), (req, res) => {
  const data = analytics.getBrandAnalytics();
  res.json({ data });
});

// GET /api/admin/analytics/activity-pattern - Hourly activity pattern
router.get('/analytics/activity-pattern', authenticate, requireRole('institution_admin', 'super_admin'), (req, res) => {
  const data = analytics.getActivityPattern();
  res.json({ data });
});

module.exports = router;
