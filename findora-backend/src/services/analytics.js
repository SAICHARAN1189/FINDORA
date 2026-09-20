/**
 * Analytics Service
 * 
 * Provides comprehensive analytics and reporting:
 * - Time-series data
 * - Category breakdowns
 * - Success rates
 * - Geographic analysis
 * - User engagement metrics
 */

const store = require('../config/demoStore');

/**
 * Get report trends over time
 */
function getReportTrends(days = 30) {
  const reports = store.getAllReports();
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - days);
  
  const dailyData = {};
  
  // Initialize all days
  for (let i = 0; i < days; i++) {
    const date = new Date();
    date.setDate(date.getDate() - i);
    const dateKey = date.toISOString().split('T')[0];
    dailyData[dateKey] = {
      date: dateKey,
      lost: 0,
      found: 0,
      total: 0,
      matched: 0,
      collected: 0
    };
  }
  
  // Aggregate data
  reports.forEach(report => {
    const reportDate = new Date(report.createdAt);
    if (reportDate < cutoffDate) return;
    
    const dateKey = reportDate.toISOString().split('T')[0];
    if (dailyData[dateKey]) {
      dailyData[dateKey][report.type]++;
      dailyData[dateKey].total++;
      
      if (report.status === 'matched') dailyData[dateKey].matched++;
      if (report.status === 'collected') dailyData[dateKey].collected++;
    }
  });
  
  return Object.values(dailyData).sort((a, b) => a.date.localeCompare(b.date));
}

/**
 * Get category distribution
 */
function getCategoryAnalytics() {
  const reports = store.getAllReports();
  const categories = {};
  
  reports.forEach(report => {
    if (!categories[report.category]) {
      categories[report.category] = {
        name: report.category,
        lost: 0,
        found: 0,
        total: 0,
        matched: 0,
        successRate: 0
      };
    }
    
    categories[report.category][report.type]++;
    categories[report.category].total++;
    
    if (report.status === 'matched' || report.status === 'collected') {
      categories[report.category].matched++;
    }
  });
  
  // Calculate success rates
  Object.values(categories).forEach(cat => {
    cat.successRate = cat.total > 0 
      ? Math.round((cat.matched / cat.total) * 100) 
      : 0;
  });
  
  return Object.values(categories).sort((a, b) => b.total - a.total);
}

/**
 * Get match success rates
 */
function getMatchAnalytics() {
  const matches = store.getAllMatches();
  
  const stats = {
    total: matches.length,
    pending: 0,
    accepted: 0,
    rejected: 0,
    verified: 0,
    completed: 0,
    
    byConfidence: {
      high: 0,    // 80-100%
      medium: 0,  // 50-79%
      low: 0      // <50%
    },
    
    averageConfidence: 0,
    acceptanceRate: 0,
    completionRate: 0,
    averageTimeToAccept: 0
  };
  
  let totalConfidence = 0;
  let acceptedCount = 0;
  let timeToAcceptSum = 0;
  
  matches.forEach(match => {
    stats[match.status]++;
    
    totalConfidence += match.confidence;
    
    // Confidence buckets
    if (match.confidence >= 80) stats.byConfidence.high++;
    else if (match.confidence >= 50) stats.byConfidence.medium++;
    else stats.byConfidence.low++;
    
    // Time to accept
    if (match.status !== 'pending') {
      acceptedCount++;
      const created = new Date(match.createdAt);
      const updated = new Date(match.updatedAt);
      const hours = (updated - created) / (1000 * 60 * 60);
      timeToAcceptSum += hours;
    }
  });
  
  stats.averageConfidence = matches.length > 0 
    ? Math.round(totalConfidence / matches.length) 
    : 0;
  
  stats.acceptanceRate = matches.length > 0
    ? Math.round(((stats.accepted + stats.verified + stats.completed) / matches.length) * 100)
    : 0;
  
  stats.completionRate = matches.length > 0
    ? Math.round((stats.completed / matches.length) * 100)
    : 0;
  
  stats.averageTimeToAccept = acceptedCount > 0
    ? Math.round((timeToAcceptSum / acceptedCount) * 10) / 10
    : 0;
  
  return stats;
}

/**
 * Get geographic analytics
 */
function getGeographicAnalytics() {
  const reports = store.getAllReports();
  const locations = {};
  
  reports.forEach(report => {
    if (!report.location?.name) return;
    
    const locName = report.location.name;
    if (!locations[locName]) {
      locations[locName] = {
        name: locName,
        lost: 0,
        found: 0,
        total: 0,
        lat: report.location.lat,
        lng: report.location.lng
      };
    }
    
    locations[locName][report.type]++;
    locations[locName].total++;
  });
  
  return Object.values(locations).sort((a, b) => b.total - a.total);
}

/**
 * Get user engagement metrics
 */
function getUserEngagementMetrics() {
  const users = store.getAllUsers().filter(u => u.role === 'user');
  const reports = store.getAllReports();
  const matches = store.getAllMatches();
  
  const engagement = {
    totalUsers: users.length,
    activeUsers: 0,
    newUsers: 0,
    
    averageReportsPerUser: 0,
    averagePointsPerUser: 0,
    
    usersWithBadges: 0,
    
    activityDistribution: {
      veryActive: 0,  // 10+ reports
      active: 0,      // 5-9 reports
      moderate: 0,    // 2-4 reports
      low: 0          // 1 report
    }
  };
  
  const last30Days = Date.now() - 30 * 24 * 60 * 60 * 1000;
  const last7Days = Date.now() - 7 * 24 * 60 * 60 * 1000;
  
  let totalReports = 0;
  let totalPoints = 0;
  
  users.forEach(user => {
    const userReports = store.getReportsByUser(user.uid);
    totalReports += userReports.length;
    totalPoints += user.rewardPoints || 0;
    
    // Active users (any activity in last 7 days)
    const recentActivity = userReports.some(r => 
      new Date(r.createdAt).getTime() > last7Days
    );
    if (recentActivity) engagement.activeUsers++;
    
    // New users (created in last 30 days)
    if (new Date(user.createdAt).getTime() > last30Days) {
      engagement.newUsers++;
    }
    
    // Badge holders
    if (user.badges && user.badges.length > 0) {
      engagement.usersWithBadges++;
    }
    
    // Activity distribution
    const reportCount = userReports.length;
    if (reportCount >= 10) engagement.activityDistribution.veryActive++;
    else if (reportCount >= 5) engagement.activityDistribution.active++;
    else if (reportCount >= 2) engagement.activityDistribution.moderate++;
    else if (reportCount >= 1) engagement.activityDistribution.low++;
  });
  
  engagement.averageReportsPerUser = users.length > 0
    ? Math.round((totalReports / users.length) * 10) / 10
    : 0;
  
  engagement.averagePointsPerUser = users.length > 0
    ? Math.round(totalPoints / users.length)
    : 0;
  
  return engagement;
}

/**
 * Get time-based analytics (response times, resolution times)
 */
function getTimeAnalytics() {
  const reports = store.getAllReports();
  const matches = store.getAllMatches();
  
  const stats = {
    averageReportToMatch: 0,
    averageMatchToCollection: 0,
    averageFullResolution: 0,
    
    fastest: {
      reportToMatch: null,
      matchToCollection: null,
      fullResolution: null
    }
  };
  
  let reportToMatchSum = 0;
  let matchToCollectionSum = 0;
  let fullResolutionSum = 0;
  let reportToMatchCount = 0;
  let matchToCollectionCount = 0;
  let fullResolutionCount = 0;
  
  // Calculate times
  matches.forEach(match => {
    const lostReport = store.getReport(match.lostReportId);
    const foundReport = store.getReport(match.foundReportId);
    
    if (!lostReport || !foundReport) return;
    
    // Report to match time
    const lostCreated = new Date(lostReport.createdAt);
    const matchCreated = new Date(match.createdAt);
    const reportToMatchHours = (matchCreated - lostCreated) / (1000 * 60 * 60);
    
    reportToMatchSum += reportToMatchHours;
    reportToMatchCount++;
    
    if (!stats.fastest.reportToMatch || reportToMatchHours < stats.fastest.reportToMatch) {
      stats.fastest.reportToMatch = Math.round(reportToMatchHours * 10) / 10;
    }
    
    // Match to collection time (if completed)
    if (match.status === 'completed' && match.updatedAt) {
      const matchUpdated = new Date(match.updatedAt);
      const matchToCollectionHours = (matchUpdated - matchCreated) / (1000 * 60 * 60);
      
      matchToCollectionSum += matchToCollectionHours;
      matchToCollectionCount++;
      
      if (!stats.fastest.matchToCollection || matchToCollectionHours < stats.fastest.matchToCollection) {
        stats.fastest.matchToCollection = Math.round(matchToCollectionHours * 10) / 10;
      }
      
      // Full resolution time
      const fullResolutionHours = (matchUpdated - lostCreated) / (1000 * 60 * 60);
      fullResolutionSum += fullResolutionHours;
      fullResolutionCount++;
      
      if (!stats.fastest.fullResolution || fullResolutionHours < stats.fastest.fullResolution) {
        stats.fastest.fullResolution = Math.round(fullResolutionHours * 10) / 10;
      }
    }
  });
  
  stats.averageReportToMatch = reportToMatchCount > 0
    ? Math.round((reportToMatchSum / reportToMatchCount) * 10) / 10
    : 0;
  
  stats.averageMatchToCollection = matchToCollectionCount > 0
    ? Math.round((matchToCollectionSum / matchToCollectionCount) * 10) / 10
    : 0;
  
  stats.averageFullResolution = fullResolutionCount > 0
    ? Math.round((fullResolutionSum / fullResolutionCount) * 10) / 10
    : 0;
  
  return stats;
}

/**
 * Get comprehensive dashboard summary
 */
function getDashboardSummary() {
  const stats = store.getStats();
  const matchAnalytics = getMatchAnalytics();
  const userEngagement = getUserEngagementMetrics();
  const timeAnalytics = getTimeAnalytics();
  
  return {
    overview: stats,
    matches: matchAnalytics,
    users: userEngagement,
    timing: timeAnalytics,
    generatedAt: new Date().toISOString()
  };
}

/**
 * Get brand analytics (most common brands)
 */
function getBrandAnalytics() {
  const reports = store.getAllReports();
  const brands = {};
  
  reports.forEach(report => {
    if (!report.brand) return;
    
    if (!brands[report.brand]) {
      brands[report.brand] = {
        name: report.brand,
        lost: 0,
        found: 0,
        total: 0
      };
    }
    
    brands[report.brand][report.type]++;
    brands[report.brand].total++;
  });
  
  return Object.values(brands)
    .sort((a, b) => b.total - a.total)
    .slice(0, 20);
}

/**
 * Get hourly activity pattern
 */
function getActivityPattern() {
  const reports = store.getAllReports();
  const hourly = Array(24).fill(0).map((_, hour) => ({
    hour,
    count: 0,
    label: `${hour}:00`
  }));
  
  reports.forEach(report => {
    const date = new Date(report.createdAt);
    const hour = date.getHours();
    hourly[hour].count++;
  });
  
  return hourly;
}

module.exports = {
  getReportTrends,
  getCategoryAnalytics,
  getMatchAnalytics,
  getGeographicAnalytics,
  getUserEngagementMetrics,
  getTimeAnalytics,
  getDashboardSummary,
  getBrandAnalytics,
  getActivityPattern
};
