/**
 * Rewards System Service
 * 
 * Manages points, badges, achievements, and leaderboard:
 * - Award points for various actions
 * - Unlock badges based on achievements
 * - Track user milestones
 * - Maintain leaderboard
 */

const store = require('../config/demoStore');

// Point values for different actions
const POINTS = {
  REPORT_LOST: 10,
  REPORT_FOUND: 15,
  MATCH_ACCEPTED: 25,
  ITEM_RETURNED: 50,
  ITEM_COLLECTED: 30,
  HELPFUL_RATING: 5,
  QUICK_RESPONSE: 10,
  COMPLETE_PROFILE: 20,
  VERIFY_IDENTITY: 30
};

// Badge definitions
const BADGES = {
  EARLY_ADOPTER: {
    id: 'early_adopter',
    name: 'Early Adopter',
    description: 'One of the first users',
    icon: '🌟',
    criteria: { type: 'manual' }
  },
  FIRST_REPORT: {
    id: 'first_report',
    name: 'First Report',
    description: 'Created your first report',
    icon: '📝',
    criteria: { type: 'report_count', value: 1 }
  },
  GOOD_SAMARITAN: {
    id: 'good_samaritan',
    name: 'Good Samaritan',
    description: 'Helped return 5 items',
    icon: '🎗️',
    criteria: { type: 'items_returned', value: 5 }
  },
  SUPER_FINDER: {
    id: 'super_finder',
    name: 'Super Finder',
    description: 'Found 10 items',
    icon: '🔍',
    criteria: { type: 'found_reports', value: 10 }
  },
  HONEST_CITIZEN: {
    id: 'honest_citizen',
    name: 'Honest Citizen',
    description: 'Reported 20 found items',
    icon: '💎',
    criteria: { type: 'found_reports', value: 20 }
  },
  PERFECT_MATCHER: {
    id: 'perfect_matcher',
    name: 'Perfect Matcher',
    description: 'All matches verified',
    icon: '🎯',
    criteria: { type: 'match_accuracy', value: 100 }
  },
  COMMUNITY_HERO: {
    id: 'community_hero',
    name: 'Community Hero',
    description: 'Earned 500 points',
    icon: '🦸',
    criteria: { type: 'total_points', value: 500 }
  },
  SPEED_DEMON: {
    id: 'speed_demon',
    name: 'Speed Demon',
    description: 'Quick response time (<1 hour)',
    icon: '⚡',
    criteria: { type: 'quick_responses', value: 5 }
  },
  VERIFIED_MEMBER: {
    id: 'verified_member',
    name: 'Verified Member',
    description: 'Identity verified',
    icon: '✅',
    criteria: { type: 'verified', value: true }
  },
  CATEGORY_EXPERT: {
    id: 'category_expert',
    name: 'Category Expert',
    description: 'Specialist in a category',
    icon: '🏆',
    criteria: { type: 'category_specialist', value: 10 }
  }
};

/**
 * Award points to a user
 */
function awardPoints(userId, points, reason, metadata = {}) {
  const user = store.getUser(userId);
  if (!user) return null;
  
  const currentPoints = user.rewardPoints || 0;
  const newPoints = currentPoints + points;
  
  store.updateUser(userId, { rewardPoints: newPoints });
  
  // Log the transaction
  store.addPointsTransaction({
    userId,
    points,
    reason,
    metadata,
    previousBalance: currentPoints,
    newBalance: newPoints,
    timestamp: new Date().toISOString()
  });
  
  // Check for new badges
  checkAndAwardBadges(userId);
  
  // Log to audit
  store.addAuditLog({
    action: 'POINTS_AWARDED',
    userId: 'SYSTEM',
    targetUserId: userId,
    details: `+${points} points: ${reason}`
  });
  
  return {
    points,
    newBalance: newPoints,
    reason
  };
}

/**
 * Deduct points from a user (for violations)
 */
function deductPoints(userId, points, reason) {
  return awardPoints(userId, -points, reason);
}

/**
 * Award points for report creation
 */
function awardReportPoints(report) {
  const points = report.type === 'lost' ? POINTS.REPORT_LOST : POINTS.REPORT_FOUND;
  return awardPoints(
    report.userId,
    points,
    `${report.type === 'lost' ? 'Lost' : 'Found'} item report`,
    { reportId: report.id, type: report.type }
  );
}

/**
 * Award points for match acceptance
 */
function awardMatchPoints(match) {
  // Award to found item reporter
  awardPoints(
    match.foundUserId,
    POINTS.MATCH_ACCEPTED,
    'Match accepted',
    { matchId: match.id }
  );
  
  // Bonus to lost item reporter if they respond quickly
  const matchCreated = new Date(match.createdAt);
  const now = new Date();
  const hoursDiff = (now - matchCreated) / (1000 * 60 * 60);
  
  if (hoursDiff < 1) {
    awardPoints(
      match.lostUserId,
      POINTS.QUICK_RESPONSE,
      'Quick response to match',
      { matchId: match.id }
    );
  }
}

/**
 * Award points for item return/collection
 */
function awardReturnPoints(match, returnType = 'returned') {
  const points = returnType === 'returned' ? POINTS.ITEM_RETURNED : POINTS.ITEM_COLLECTED;
  
  // Award to finder
  awardPoints(
    match.foundUserId,
    points,
    `Item ${returnType}`,
    { matchId: match.id }
  );
  
  // Award to owner
  awardPoints(
    match.lostUserId,
    Math.floor(points * 0.6),
    `Item ${returnType}`,
    { matchId: match.id }
  );
}

/**
 * Check and award badges based on user achievements
 */
function checkAndAwardBadges(userId) {
  const user = store.getUser(userId);
  if (!user) return;
  
  const currentBadges = user.badges || [];
  const newBadges = [];
  
  const userReports = store.getReportsByUser(userId);
  const userMatches = store.getMatchesForUser(userId);
  
  // Check each badge criteria
  Object.values(BADGES).forEach(badge => {
    // Skip if already has badge
    if (currentBadges.includes(badge.id)) return;
    
    let earned = false;
    
    switch (badge.criteria.type) {
      case 'report_count':
        earned = userReports.length >= badge.criteria.value;
        break;
      
      case 'found_reports':
        const foundCount = userReports.filter(r => r.type === 'found').length;
        earned = foundCount >= badge.criteria.value;
        break;
      
      case 'items_returned':
        const returnedCount = userMatches.filter(m => 
          m.status === 'completed' && m.foundUserId === userId
        ).length;
        earned = returnedCount >= badge.criteria.value;
        break;
      
      case 'total_points':
        earned = (user.rewardPoints || 0) >= badge.criteria.value;
        break;
      
      case 'match_accuracy':
        const verifiedMatches = userMatches.filter(m => m.status === 'verified');
        const rejectedMatches = userMatches.filter(m => m.status === 'rejected');
        const totalMatches = verifiedMatches.length + rejectedMatches.length;
        
        if (totalMatches >= 5) {
          const accuracy = (verifiedMatches.length / totalMatches) * 100;
          earned = accuracy >= badge.criteria.value;
        }
        break;
      
      case 'quick_responses':
        // Count quick responses (implementation depends on tracking)
        earned = false; // Placeholder
        break;
      
      case 'verified':
        earned = user.verified === badge.criteria.value;
        break;
      
      case 'category_specialist':
        // Check if user has 10+ reports in a single category
        const categoryCount = {};
        userReports.forEach(r => {
          categoryCount[r.category] = (categoryCount[r.category] || 0) + 1;
        });
        earned = Object.values(categoryCount).some(count => count >= badge.criteria.value);
        break;
    }
    
    if (earned) {
      newBadges.push(badge.id);
    }
  });
  
  // Award new badges
  if (newBadges.length > 0) {
    const updatedBadges = [...currentBadges, ...newBadges];
    store.updateUser(userId, { badges: updatedBadges });
    
    // Log badge awards
    newBadges.forEach(badgeId => {
      const badge = Object.values(BADGES).find(b => b.id === badgeId);
      store.addAuditLog({
        action: 'BADGE_AWARDED',
        userId: 'SYSTEM',
        targetUserId: userId,
        details: `Earned: ${badge.name}`
      });
      
      // Create notification
      store.createNotification({
        userId,
        type: 'BADGE_EARNED',
        title: 'New Badge Earned! 🎉',
        message: `You've earned the "${badge.name}" badge!`,
        data: { badgeId, badge }
      });
    });
  }
  
  return newBadges;
}

/**
 * Get user's badge collection
 */
function getUserBadges(userId) {
  const user = store.getUser(userId);
  if (!user) return [];
  
  const userBadgeIds = user.badges || [];
  return userBadgeIds.map(id => {
    const badge = Object.values(BADGES).find(b => b.id === id);
    return badge || null;
  }).filter(Boolean);
}

/**
 * Get leaderboard
 */
function getLeaderboard(limit = 50, timeframe = 'all') {
  const users = store.getAllUsers().filter(u => u.role === 'user');
  
  // Sort by points
  const sorted = users
    .map(u => ({
      uid: u.uid,
      displayName: u.displayName,
      photoURL: u.photoURL,
      rewardPoints: u.rewardPoints || 0,
      badges: u.badges || [],
      badgeCount: (u.badges || []).length
    }))
    .sort((a, b) => {
      if (b.rewardPoints !== a.rewardPoints) {
        return b.rewardPoints - a.rewardPoints;
      }
      return b.badgeCount - a.badgeCount;
    });
  
  // Add rank
  return sorted.slice(0, limit).map((user, index) => ({
    rank: index + 1,
    ...user
  }));
}

/**
 * Get user statistics for rewards
 */
function getUserRewardStats(userId) {
  const user = store.getUser(userId);
  if (!user) return null;
  
  const userReports = store.getReportsByUser(userId);
  const userMatches = store.getMatchesForUser(userId);
  const transactions = store.getPointsTransactions(userId);
  
  const stats = {
    totalPoints: user.rewardPoints || 0,
    badges: getUserBadges(userId),
    badgeCount: (user.badges || []).length,
    
    reports: {
      total: userReports.length,
      lost: userReports.filter(r => r.type === 'lost').length,
      found: userReports.filter(r => r.type === 'found').length
    },
    
    matches: {
      total: userMatches.length,
      verified: userMatches.filter(m => m.status === 'verified').length,
      completed: userMatches.filter(m => m.status === 'completed').length
    },
    
    transactions: {
      total: transactions.length,
      earned: transactions.filter(t => t.points > 0).reduce((sum, t) => sum + t.points, 0),
      spent: Math.abs(transactions.filter(t => t.points < 0).reduce((sum, t) => sum + t.points, 0))
    }
  };
  
  // Calculate rank
  const leaderboard = getLeaderboard(1000);
  const userRank = leaderboard.findIndex(u => u.uid === userId);
  stats.rank = userRank >= 0 ? userRank + 1 : null;
  stats.topPercentile = userRank >= 0 ? Math.round((userRank / leaderboard.length) * 100) : null;
  
  return stats;
}

/**
 * Get available badges (catalog)
 */
function getAllBadges() {
  return Object.values(BADGES);
}

/**
 * Calculate next milestone for user
 */
function getNextMilestone(userId) {
  const stats = getUserRewardStats(userId);
  if (!stats) return null;
  
  const milestones = [];
  
  // Points milestones
  const pointsTargets = [100, 250, 500, 1000, 2500, 5000];
  const nextPoints = pointsTargets.find(p => p > stats.totalPoints);
  if (nextPoints) {
    milestones.push({
      type: 'points',
      target: nextPoints,
      current: stats.totalPoints,
      progress: (stats.totalPoints / nextPoints) * 100,
      reward: 'New badge unlock'
    });
  }
  
  // Badge milestones
  const earnedBadgeIds = stats.badges.map(b => b.id);
  const nextBadge = Object.values(BADGES).find(badge => 
    !earnedBadgeIds.includes(badge.id) && badge.criteria.type !== 'manual'
  );
  
  if (nextBadge) {
    milestones.push({
      type: 'badge',
      badge: nextBadge,
      description: nextBadge.description
    });
  }
  
  return milestones;
}

module.exports = {
  awardPoints,
  deductPoints,
  awardReportPoints,
  awardMatchPoints,
  awardReturnPoints,
  checkAndAwardBadges,
  getUserBadges,
  getLeaderboard,
  getUserRewardStats,
  getAllBadges,
  getNextMilestone,
  POINTS,
  BADGES
};
