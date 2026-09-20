#!/usr/bin/env node
/**
 * Comprehensive API Test Suite
 * Tests all major endpoints and functionality
 */

const axios = require('axios');

const API_URL = 'http://localhost:3001/api';
const ADMIN_TOKEN = 'demo-token-demo-admin-1';
const USER_TOKEN = 'demo-token-demo-user-1';

const api = (token) => axios.create({
  baseURL: API_URL,
  headers: { Authorization: `Bearer ${token}` },
  validateStatus: () => true, // Don't throw on any status
});

const tests = [];
const results = { passed: 0, failed: 0, total: 0 };

function test(name, fn) {
  tests.push({ name, fn });
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message || 'Assertion failed');
  }
}

// ==================== TESTS ====================

test('Health check', async () => {
  const res = await axios.get(`${API_URL}/health`);
  assert(res.status === 200, 'Health check should return 200');
  assert(res.data.status === 'ok', 'Status should be ok');
  assert(res.data.mode === 'demo', 'Should be in demo mode');
});

test('Auth - Demo login', async () => {
  const res = await axios.post(`${API_URL}/auth/demo-login`, { userId: 'demo-user-1' });
  assert(res.status === 200, 'Demo login should return 200');
  assert(res.data.token, 'Should return a token');
  assert(res.data.user, 'Should return user data');
});

test('Auth - Reject unauthenticated requests', async () => {
  const res = await axios.get(`${API_URL}/reports`, { validateStatus: () => true });
  assert(res.status === 401, 'Should return 401 for unauthenticated requests');
});

test('Reports - Create lost report with fraud detection', async () => {
  const res = await api(USER_TOKEN).post('/reports', {
    type: 'lost',
    category: 'electronics',
    title: 'Test Laptop',
    description: 'Black Dell laptop with stickers',
    brand: 'Dell',
    color: 'black',
    location: 'Library',
  });
  assert(res.status === 201, 'Should create report');
  assert(res.data.report, 'Should return report');
  assert(res.data.fraudAssessment, 'Should include fraud assessment');
  assert(res.data.pointsAwarded > 0, 'Should award points');
  assert(res.data.fraudAssessment.riskScore !== undefined, 'Should have risk score');
});

test('Reports - Get all reports', async () => {
  const res = await api(USER_TOKEN).get('/reports');
  assert(res.status === 200, 'Should return 200');
  assert(Array.isArray(res.data.reports), 'Should return reports array');
});

test('Matches - Get pending matches', async () => {
  const res = await api(USER_TOKEN).get('/matches?status=pending');
  assert(res.status === 200, 'Should return 200');
  assert(Array.isArray(res.data.matches), 'Should return matches array');
});

test('Lockers - Get all lockers', async () => {
  const res = await api(USER_TOKEN).get('/lockers');
  assert(res.status === 200, 'Should return 200');
  assert(Array.isArray(res.data.lockers), 'Should return lockers array');
  assert(res.data.lockers.length > 0, 'Should have demo lockers');
});

test('Notifications - Get user notifications', async () => {
  const res = await api(USER_TOKEN).get('/notifications');
  assert(res.status === 200, 'Should return 200');
  assert(Array.isArray(res.data.notifications), 'Should return notifications array');
});

test('Chat - Get user chats', async () => {
  const res = await api(USER_TOKEN).get('/chat');
  assert(res.status === 200, 'Should return 200');
  assert(Array.isArray(res.data.chats), 'Should return chats array');
});

test('Rewards - Get user profile', async () => {
  const res = await api(USER_TOKEN).get('/rewards/profile');
  assert(res.status === 200, 'Should return 200');
  assert(res.data.totalPoints !== undefined, 'Should have totalPoints');
  assert(Array.isArray(res.data.badges), 'Should have badges array');
});

test('Rewards - Get leaderboard', async () => {
  const res = await api(USER_TOKEN).get('/rewards/leaderboard');
  assert(res.status === 200, 'Should return 200');
  assert(Array.isArray(res.data.leaderboard), 'Should return leaderboard array');
});

test('IoT - Get lockers status', async () => {
  const res = await api(USER_TOKEN).get('/iot/lockers');
  assert(res.status === 200, 'Should return 200');
  assert(Array.isArray(res.data), 'Should return array');
});

test('IoT - Get sessions', async () => {
  const res = await api(USER_TOKEN).get('/iot/sessions');
  assert(res.status === 200, 'Should return 200');
  assert(Array.isArray(res.data), 'Should return array');
});

test('Admin - RBAC: Reject non-admin', async () => {
  const res = await api(USER_TOKEN).get('/admin/dashboard');
  assert(res.status === 403, 'Should return 403 for non-admin');
});

test('Admin - Dashboard (admin only)', async () => {
  const res = await api(ADMIN_TOKEN).get('/admin/dashboard');
  assert(res.status === 200, 'Should return 200');
  assert(res.data.overview, 'Should have overview');
  assert(res.data.overview.totalReports !== undefined, 'Should have totalReports in overview');
});

test('Admin - Get all reports', async () => {
  const res = await api(ADMIN_TOKEN).get('/admin/reports');
  assert(res.status === 200, 'Should return 200');
  assert(Array.isArray(res.data.reports), 'Should return reports array');
});

test('Admin - Fraud stats', async () => {
  const res = await api(ADMIN_TOKEN).get('/admin/fraud/stats');
  assert(res.status === 200, 'Should return 200');
  assert(res.data.total !== undefined, 'Should have fraud stats');
});

test('Admin - Rewards leaderboard', async () => {
  const res = await api(ADMIN_TOKEN).get('/admin/rewards/leaderboard');
  assert(res.status === 200, 'Should return 200');
  assert(Array.isArray(res.data.leaderboard), 'Should return leaderboard');
});

test('Admin - Analytics', async () => {
  const res = await api(ADMIN_TOKEN).get('/admin/analytics/trends?days=30');
  assert(res.status === 200, 'Should return 200');
  assert(res.data.data, 'Should have analytics data');
});

// ==================== RUN TESTS ====================

(async () => {
  console.log('\n🧪 Running Comprehensive API Tests\n');
  console.log('=' .repeat(60));
  
  for (const { name, fn } of tests) {
    results.total++;
    try {
      await fn();
      console.log(`✅ ${name}`);
      results.passed++;
    } catch (error) {
      console.log(`❌ ${name}`);
      console.log(`   Error: ${error.message}`);
      results.failed++;
    }
  }
  
  console.log('=' .repeat(60));
  console.log(`\n📊 Results: ${results.passed}/${results.total} passed`);
  
  if (results.failed > 0) {
    console.log(`\n⚠️  ${results.failed} test(s) failed\n`);
    process.exit(1);
  } else {
    console.log('\n🎉 All tests passed!\n');
    process.exit(0);
  }
})();
