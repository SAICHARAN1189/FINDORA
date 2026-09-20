// src/routes/reports.js
const express = require('express');
const router = express.Router();
const store = require('../config/demoStore');
const { authenticate, requireRole } = require('../middleware/auth');
const { findMatches } = require('../services/aiMatcher');
const fraudDetection = require('../services/fraudDetection');
const rewardsSystem = require('../services/rewardsSystem');
const { v4: uuidv4 } = require('uuid');

const VALID_CATEGORIES = ['electronics', 'bags', 'documents', 'keys', 'clothing', 'jewelry', 'sports', 'books', 'other'];
const REWARD_FOR_FOUND_REPORT = 50;
const REWARD_FOR_LOST_REPORT = 10;

// GET /api/reports - List reports (with filters)
router.get('/', authenticate, (req, res) => {
  const { type, status, category, userId, limit = 50, page = 1 } = req.query;
  let reports = store.getAllReports();

  // Non-admin users can only see their own reports + active found reports
  if (!['institution_admin', 'super_admin', 'police'].includes(req.user.role)) {
    reports = reports.filter(r => r.userId === req.user.uid || (r.type === 'found' && r.status === 'active'));
  }

  if (type) reports = reports.filter(r => r.type === type);
  if (status) reports = reports.filter(r => r.status === status);
  if (category) reports = reports.filter(r => r.category === category);
  if (userId) reports = reports.filter(r => r.userId === userId);

  // Sort newest first
  reports.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

  const total = reports.length;
  const start = (page - 1) * limit;
  const paginated = reports.slice(start, start + parseInt(limit));

  res.json({ reports: paginated, total, page: parseInt(page), limit: parseInt(limit) });
});

// GET /api/reports/public - Public feed of found items (no auth required)
router.get('/public', (req, res) => {
  let reports = store.getAllReports().filter(r => r.type === 'found' && r.status === 'active');
  reports.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  // Anonymize if anonymous mode enabled
  reports = reports.map(r => r.anonymous ? { ...r, userDisplayName: 'Anonymous Finder', userId: null } : r);
  res.json({ reports });
});

// GET /api/reports/:id
router.get('/:id', authenticate, (req, res) => {
  const report = store.getReport(req.params.id);
  if (!report) return res.status(404).json({ error: 'Report not found' });
  
  // Only owner or admins can see full details
  const isOwner = report.userId === req.user.uid;
  const isAdmin = ['institution_admin', 'super_admin', 'police'].includes(req.user.role);
  if (!isOwner && !isAdmin) {
    // Return partial info for others
    return res.json({ ...report, userId: null, userDisplayName: report.anonymous ? 'Anonymous' : report.userDisplayName });
  }
  res.json(report);
});

// POST /api/reports - Create report
router.post('/', authenticate, (req, res) => {
  const { type, category, title, description, brand, model, color, location, dateOccurred, imageUrl, identifyingCharacteristics, anonymous } = req.body;

  if (!type || !['lost', 'found'].includes(type)) {
    return res.status(400).json({ error: 'Type must be "lost" or "found"' });
  }
  if (!category || !VALID_CATEGORIES.includes(category)) {
    return res.status(400).json({ error: `Category must be one of: ${VALID_CATEGORIES.join(', ')}` });
  }
  if (!title || !description) {
    return res.status(400).json({ error: 'Title and description are required' });
  }

  const report = store.createReport({
    type,
    status: 'active',
    userId: req.user.uid,
    userDisplayName: req.user.displayName,
    category,
    title,
    description,
    brand: brand || null,
    model: model || null,
    color: color || null,
    location: location || null,
    dateOccurred: dateOccurred || new Date().toISOString(),
    imageUrl: imageUrl || null,
    identifyingCharacteristics: identifyingCharacteristics || null,
    anonymous: !!anonymous,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });

  store.addAuditLog({ action: 'CREATE_REPORT', userId: req.user.uid, details: `${type.toUpperCase()} report created: ${title}`, reportId: report.id });

  // Award reward points
  rewardsSystem.awardReportPoints(report);
  
  // Run fraud detection
  const fraudAssessment = fraudDetection.detectFraud(report, req.user.uid);
  const points = type === 'found' ? REWARD_FOR_FOUND_REPORT : REWARD_FOR_LOST_REPORT;
  store.updateUser(req.user.uid, { rewardPoints: (req.user.rewardPoints || 0) + points });

  // Run AI matching asynchronously
  setImmediate(() => {
    try {
      const allReports = store.getAllReports();
      const matches = findMatches(report, allReports);
      
      matches.forEach(match => {
        const lostReport = report.type === 'lost' ? report : match.report;
        const foundReport = report.type === 'found' ? report : match.report;

        // Check if match already exists
        const existing = store.getAllMatches().find(m => 
          m.lostReportId === lostReport.id && m.foundReportId === foundReport.id
        );
        if (existing) return;

        const newMatch = store.createMatch({
          lostReportId: lostReport.id,
          foundReportId: foundReport.id,
          lostUserId: lostReport.userId,
          foundUserId: foundReport.userId,
          confidence: match.confidence,
          status: 'pending',
          reasons: match.reasons,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        });

        // Update report statuses
        store.updateReport(lostReport.id, { status: 'matched' });
        store.updateReport(foundReport.id, { status: 'matched' });

        // Send notifications
        store.createNotification({
          userId: lostReport.userId,
          type: 'match_found',
          title: '🎯 Potential Match Found!',
          message: `A ${match.confidence}% match was found for your lost ${lostReport.category}. Review it now.`,
          matchId: newMatch.id,
          reportId: lostReport.id,
        });
        store.createNotification({
          userId: foundReport.userId,
          type: 'match_found',
          title: '🎯 Your Found Item Has a Potential Owner!',
          message: `A ${match.confidence}% match was found. The potential owner will be notified.`,
          matchId: newMatch.id,
          reportId: foundReport.id,
        });
      });
    } catch (err) {
      console.error('AI matching error:', err);
    }
  });

  res.status(201).json({ 
    report, 
    fraudAssessment,
    pointsAwarded: points,
    message: 'Report created. AI is analyzing for matches.' 
  });
});

// PUT /api/reports/:id
router.put('/:id', authenticate, (req, res) => {
  const report = store.getReport(req.params.id);
  if (!report) return res.status(404).json({ error: 'Report not found' });
  if (report.userId !== req.user.uid && req.user.role !== 'super_admin') {
    return res.status(403).json({ error: 'Cannot edit another user\'s report' });
  }

  const { title, description, brand, model, color, location, dateOccurred, identifyingCharacteristics, status } = req.body;
  const updated = store.updateReport(req.params.id, { title, description, brand, model, color, location, dateOccurred, identifyingCharacteristics, status });
  store.addAuditLog({ action: 'UPDATE_REPORT', userId: req.user.uid, details: `Report updated: ${req.params.id}` });
  res.json(updated);
});

// DELETE /api/reports/:id
router.delete('/:id', authenticate, (req, res) => {
  const report = store.getReport(req.params.id);
  if (!report) return res.status(404).json({ error: 'Report not found' });
  if (report.userId !== req.user.uid && !['institution_admin', 'super_admin'].includes(req.user.role)) {
    return res.status(403).json({ error: 'Cannot delete another user\'s report' });
  }
  store.updateReport(req.params.id, { status: 'deleted' });
  store.addAuditLog({ action: 'DELETE_REPORT', userId: req.user.uid, details: `Report deleted: ${req.params.id}` });
  res.json({ message: 'Report deleted' });
});

module.exports = router;
