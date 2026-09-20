/**
 * Fraud Detection Service
 * 
 * Detects suspicious patterns and fraudulent activities:
 * - Duplicate reports (same item, location, time)
 * - Rapid submissions (spam)
 * - Location anomalies
 * - Suspicious behavior patterns
 * - High-risk users
 */

const store = require('../config/demoStore');

// Risk score thresholds
const RISK_LEVELS = {
  LOW: 0,
  MEDIUM: 30,
  HIGH: 60,
  CRITICAL: 80
};

// Time windows for detection
const TIME_WINDOWS = {
  RAPID_SUBMISSION: 5 * 60 * 1000,      // 5 minutes
  DUPLICATE_CHECK: 24 * 60 * 60 * 1000, // 24 hours
  PATTERN_ANALYSIS: 7 * 24 * 60 * 60 * 1000 // 7 days
};

/**
 * Calculate similarity between two strings (0-1)
 */
function textSimilarity(str1, str2) {
  if (!str1 || !str2) return 0;
  
  const s1 = str1.toLowerCase().trim();
  const s2 = str2.toLowerCase().trim();
  
  if (s1 === s2) return 1;
  
  // Jaccard similarity for quick comparison
  const words1 = new Set(s1.split(/\s+/));
  const words2 = new Set(s2.split(/\s+/));
  
  const intersection = new Set([...words1].filter(w => words2.has(w)));
  const union = new Set([...words1, ...words2]);
  
  return intersection.size / union.size;
}

/**
 * Calculate distance between two locations (km)
 */
function calculateDistance(loc1, loc2) {
  if (!loc1?.lat || !loc2?.lat) return null;
  
  const R = 6371; // Earth radius in km
  const dLat = (loc2.lat - loc1.lat) * Math.PI / 180;
  const dLng = (loc2.lng - loc1.lng) * Math.PI / 180;
  
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(loc1.lat * Math.PI / 180) * Math.cos(loc2.lat * Math.PI / 180) *
    Math.sin(dLng / 2) * Math.sin(dLng / 2);
  
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * Check for duplicate reports
 */
function checkDuplicates(report) {
  const issues = [];
  const allReports = store.getAllReports();
  const cutoffTime = Date.now() - TIME_WINDOWS.DUPLICATE_CHECK;
  
  const recentReports = allReports.filter(r => 
    r.id !== report.id &&
    r.userId !== report.userId &&
    new Date(r.createdAt).getTime() > cutoffTime
  );
  
  for (const existingReport of recentReports) {
    let suspicionScore = 0;
    const reasons = [];
    
    // Check title similarity
    const titleSim = textSimilarity(report.title, existingReport.title);
    if (titleSim > 0.7) {
      suspicionScore += 30;
      reasons.push(`Similar title (${Math.round(titleSim * 100)}% match)`);
    }
    
    // Check description similarity
    const descSim = textSimilarity(report.description, existingReport.description);
    if (descSim > 0.6) {
      suspicionScore += 25;
      reasons.push(`Similar description (${Math.round(descSim * 100)}% match)`);
    }
    
    // Check same category and brand
    if (report.category === existingReport.category) {
      suspicionScore += 10;
      if (report.brand && report.brand === existingReport.brand) {
        suspicionScore += 10;
        reasons.push('Same brand and category');
      }
    }
    
    // Check location proximity
    const distance = calculateDistance(report.location, existingReport.location);
    if (distance !== null && distance < 0.5) { // Within 500m
      suspicionScore += 20;
      reasons.push(`Very close location (${Math.round(distance * 1000)}m apart)`);
    }
    
    // Check if it's a potential duplicate
    if (suspicionScore > 40) {
      issues.push({
        type: 'DUPLICATE',
        severity: suspicionScore > 70 ? 'HIGH' : 'MEDIUM',
        score: suspicionScore,
        message: 'Potential duplicate report detected',
        details: reasons.join('; '),
        relatedReportId: existingReport.id,
        relatedUserId: existingReport.userId
      });
    }
  }
  
  return issues;
}

/**
 * Check for rapid submissions (spam)
 */
function checkRapidSubmissions(userId) {
  const issues = [];
  const userReports = store.getReportsByUser(userId);
  const cutoffTime = Date.now() - TIME_WINDOWS.RAPID_SUBMISSION;
  
  const recentReports = userReports.filter(r => 
    new Date(r.createdAt).getTime() > cutoffTime
  );
  
  if (recentReports.length >= 3) {
    issues.push({
      type: 'RAPID_SUBMISSION',
      severity: 'HIGH',
      score: Math.min(recentReports.length * 20, 100),
      message: `${recentReports.length} reports in 5 minutes`,
      details: 'Possible spam or bot activity'
    });
  } else if (recentReports.length >= 2) {
    issues.push({
      type: 'RAPID_SUBMISSION',
      severity: 'MEDIUM',
      score: 30,
      message: 'Multiple reports in short time',
      details: 'Monitor for spam behavior'
    });
  }
  
  return issues;
}

/**
 * Check for location anomalies
 */
function checkLocationAnomaly(report, userId) {
  const issues = [];
  const userReports = store.getReportsByUser(userId);
  
  if (userReports.length < 2) return issues; // Not enough data
  
  // Get user's typical location
  const locations = userReports
    .filter(r => r.location?.lat && r.id !== report.id)
    .map(r => r.location);
  
  if (locations.length === 0) return issues;
  
  // Calculate average distance from user's typical locations
  const distances = locations.map(loc => calculateDistance(report.location, loc));
  const avgDistance = distances.reduce((a, b) => a + b, 0) / distances.length;
  
  // Flag if significantly far from typical locations (>20km)
  if (avgDistance > 20) {
    issues.push({
      type: 'LOCATION_ANOMALY',
      severity: avgDistance > 50 ? 'HIGH' : 'MEDIUM',
      score: Math.min(avgDistance * 2, 80),
      message: 'Unusual location for this user',
      details: `${Math.round(avgDistance)}km from typical locations`
    });
  }
  
  return issues;
}

/**
 * Analyze user behavior patterns
 */
function analyzeUserBehavior(userId) {
  const issues = [];
  const user = store.getUser(userId);
  const userReports = store.getReportsByUser(userId);
  
  if (!user || userReports.length < 3) return issues;
  
  // Check report type distribution
  const lostCount = userReports.filter(r => r.type === 'lost').length;
  const foundCount = userReports.filter(r => r.type === 'found').length;
  
  // Flag if heavily skewed toward found items (potential theft ring)
  if (foundCount > 10 && foundCount > lostCount * 5) {
    issues.push({
      type: 'SUSPICIOUS_PATTERN',
      severity: 'MEDIUM',
      score: 40,
      message: 'Unusually high number of found items',
      details: `${foundCount} found vs ${lostCount} lost reports`
    });
  }
  
  // Check for anonymous reports
  const anonymousCount = userReports.filter(r => r.anonymous).length;
  if (anonymousCount > 5 && anonymousCount / userReports.length > 0.7) {
    issues.push({
      type: 'SUSPICIOUS_PATTERN',
      severity: 'LOW',
      score: 20,
      message: 'High percentage of anonymous reports',
      details: `${anonymousCount}/${userReports.length} reports are anonymous`
    });
  }
  
  return issues;
}

/**
 * Check if user is high-risk
 */
function checkHighRiskUser(userId) {
  const issues = [];
  const user = store.getUser(userId);
  
  if (!user) return issues;
  
  // Check if user is blocked
  if (user.blocked) {
    issues.push({
      type: 'BLOCKED_USER',
      severity: 'CRITICAL',
      score: 100,
      message: 'User is blocked',
      details: 'This user has been blocked by administrators'
    });
  }
  
  // Check negative reward points (if implemented with penalties)
  if (user.rewardPoints < -50) {
    issues.push({
      type: 'NEGATIVE_REPUTATION',
      severity: 'HIGH',
      score: 60,
      message: 'Negative reputation score',
      details: `User has ${user.rewardPoints} points`
    });
  }
  
  return issues;
}

/**
 * Main fraud detection function
 * Returns risk assessment for a report
 */
function detectFraud(report, userId = null) {
  const uid = userId || report.userId;
  const allIssues = [];
  
  // Run all checks
  allIssues.push(...checkDuplicates(report));
  allIssues.push(...checkRapidSubmissions(uid));
  allIssues.push(...checkLocationAnomaly(report, uid));
  allIssues.push(...analyzeUserBehavior(uid));
  allIssues.push(...checkHighRiskUser(uid));
  
  // Calculate total risk score
  const totalScore = allIssues.reduce((sum, issue) => sum + issue.score, 0);
  
  // Determine risk level
  let riskLevel = 'LOW';
  if (totalScore >= RISK_LEVELS.CRITICAL) riskLevel = 'CRITICAL';
  else if (totalScore >= RISK_LEVELS.HIGH) riskLevel = 'HIGH';
  else if (totalScore >= RISK_LEVELS.MEDIUM) riskLevel = 'MEDIUM';
  
  // Create assessment
  const assessment = {
    reportId: report.id,
    userId: uid,
    riskScore: Math.min(totalScore, 100),
    riskLevel,
    issues: allIssues,
    timestamp: new Date().toISOString(),
    requiresReview: riskLevel === 'HIGH' || riskLevel === 'CRITICAL',
    autoFlag: totalScore >= 80
  };
  
  // Store assessment
  store.addFraudAssessment(assessment);
  
  // Auto-flag if critical
  if (assessment.autoFlag) {
    store.updateReport(report.id, { 
      flagged: true,
      flagReason: `Auto-flagged: ${riskLevel} risk (${totalScore} score)`,
      flaggedAt: new Date().toISOString()
    });
    
    // Log to audit
    store.addAuditLog({
      action: 'REPORT_AUTO_FLAGGED',
      userId: 'SYSTEM',
      targetReportId: report.id,
      details: `Risk: ${riskLevel}, Score: ${totalScore}`
    });
  }
  
  return assessment;
}

/**
 * Get fraud statistics
 */
function getFraudStats() {
  const assessments = store.getAllFraudAssessments();
  const last7Days = Date.now() - 7 * 24 * 60 * 60 * 1000;
  
  const recentAssessments = assessments.filter(a => 
    new Date(a.timestamp).getTime() > last7Days
  );
  
  const byRisk = {
    LOW: 0,
    MEDIUM: 0,
    HIGH: 0,
    CRITICAL: 0
  };
  
  const byType = {};
  
  recentAssessments.forEach(a => {
    byRisk[a.riskLevel]++;
    a.issues.forEach(issue => {
      byType[issue.type] = (byType[issue.type] || 0) + 1;
    });
  });
  
  return {
    total: recentAssessments.length,
    byRisk,
    byType,
    flagged: recentAssessments.filter(a => a.autoFlag).length,
    requiresReview: recentAssessments.filter(a => a.requiresReview).length,
    averageRiskScore: recentAssessments.length > 0 
      ? Math.round(recentAssessments.reduce((sum, a) => sum + a.riskScore, 0) / recentAssessments.length)
      : 0
  };
}

/**
 * Get high-risk reports for admin review
 */
function getHighRiskReports(limit = 20) {
  const assessments = store.getAllFraudAssessments();
  
  return assessments
    .filter(a => a.requiresReview)
    .sort((a, b) => b.riskScore - a.riskScore)
    .slice(0, limit)
    .map(a => {
      const report = store.getReport(a.reportId);
      return {
        ...a,
        report
      };
    });
}

module.exports = {
  detectFraud,
  getFraudStats,
  getHighRiskReports,
  RISK_LEVELS
};
