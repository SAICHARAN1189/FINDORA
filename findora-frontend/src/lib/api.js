// src/lib/api.js - Axios API client
import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

const api = axios.create({
  baseURL: API_URL,
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor - add auth token
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('authToken');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor - handle errors
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // Token expired or invalid
      localStorage.removeItem('authToken');
      localStorage.removeItem('user');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

// ─── Auth API ─────────────────────────────────────────────────
export const authAPI = {
  demoLogin: (userId) => api.post('/auth/demo-login', { userId }),
  register: (data) => api.post('/auth/register', data),
  getMe: () => api.get('/auth/me'),
  updateProfile: (data) => api.put('/auth/profile', data),
  linkTelegram: (linkCode) => api.post('/auth/link-telegram', { linkCode }),
  unlinkTelegram: () => api.delete('/auth/link-telegram'),
  getTelegramStatus: () => api.get('/auth/telegram-status'),
};


// ─── Reports API ──────────────────────────────────────────────
export const reportsAPI = {
  getAll: (params) => api.get('/reports', { params }),
  getPublic: () => api.get('/reports/public'),
  getById: (id) => api.get(`/reports/${id}`),
  create: (data) => api.post('/reports', data),
  update: (id, data) => api.put(`/reports/${id}`, data),
  delete: (id) => api.delete(`/reports/${id}`),
};

// ─── Matches API ──────────────────────────────────────────────
export const matchesAPI = {
  getAll: (params) => api.get('/matches', { params }),
  getById: (id) => api.get(`/matches/${id}`),
  accept: (id) => api.post(`/matches/${id}/accept`),
  reject: (id, reason) => api.post(`/matches/${id}/reject`, { reason }),
  verify: (id, returnMethod) => api.post(`/matches/${id}/verify`, { returnMethod }),
  complete: (id) => api.post(`/matches/${id}/complete`),
};

// ─── Lockers API ──────────────────────────────────────────────
export const lockersAPI = {
  getAll: () => api.get('/lockers'),
  getById: (id) => api.get(`/lockers/${id}`),
  assign: (matchId, reportId) => api.post('/lockers/assign', { matchId, reportId }),
  getSession: (sessionId) => api.get(`/lockers/sessions/${sessionId}`),
  deposit: (sessionId) => api.post(`/lockers/sessions/${sessionId}/deposit`),
  verifyOTP: (sessionId, otp) => api.post(`/lockers/sessions/${sessionId}/verify-otp`, { otp }),
  collect: (sessionId) => api.post(`/lockers/sessions/${sessionId}/collect`),
  resendOTP: (sessionId) => api.post(`/lockers/sessions/${sessionId}/resend-otp`),
};

// ─── Notifications API ────────────────────────────────────────
export const notificationsAPI = {
  getAll: () => api.get('/notifications'),
  markRead: (id) => api.put(`/notifications/${id}/read`),
  markAllRead: () => api.put('/notifications/read-all'),
};

// ─── Chat API ─────────────────────────────────────────────────
export const chatAPI = {
  getChats: () => api.get('/chat'),
  createChat: (otherUserId, matchId) => api.post('/chat', { otherUserId, matchId }),
  getMessages: (chatId) => api.get(`/chat/${chatId}/messages`),
  sendMessage: (chatId, text) => api.post(`/chat/${chatId}/messages`, { text }),
};

// ─── Admin API ────────────────────────────────────────────────
export const adminAPI = {
  // Dashboard
  getStats: () => api.get('/admin/stats'),
  getDashboard: () => api.get('/admin/dashboard'),
  
  // Users
  getUsers: () => api.get('/admin/users'),
  updateUserRole: (uid, role) => api.put(`/admin/users/${uid}/role`, { role }),
  blockUser: (uid) => api.post(`/admin/users/${uid}/block`),
  unblockUser: (uid) => api.post(`/admin/users/${uid}/unblock`),
  
  // Reports & Case Management
  getReports: () => api.get('/admin/reports'),
  updateReportStatus: (id, status) => api.put(`/admin/reports/${id}/status`, { status }),
  flagReport: (id, reason) => api.post(`/admin/reports/${id}/flag`, { reason }),
  unflagReport: (id) => api.post(`/admin/reports/${id}/unflag`),
  deleteReport: (id, reason) => api.delete(`/admin/reports/${id}`, { data: { reason } }),
  bulkAction: (reportIds, action, data) => api.post('/admin/reports/bulk-action', { reportIds, action, data }),
  
  // Fraud Detection
  getFraudStats: () => api.get('/admin/fraud/stats'),
  getHighRiskReports: (limit) => api.get('/admin/fraud/high-risk', { params: { limit } }),
  getFraudAssessment: (reportId) => api.get(`/admin/fraud/assessment/${reportId}`),
  scanReport: (reportId) => api.post(`/admin/fraud/scan/${reportId}`),
  
  // Rewards
  getLeaderboard: (limit) => api.get('/admin/rewards/leaderboard', { params: { limit } }),
  awardPoints: (userId, points, reason) => api.post('/admin/rewards/award', { userId, points, reason }),
  deductPoints: (userId, points, reason) => api.post('/admin/rewards/deduct', { userId, points, reason }),
  awardBadge: (userId, badgeId) => api.post('/admin/rewards/badge', { userId, badgeId }),
  
  // Analytics
  getAnalyticsTrends: (days) => api.get('/admin/analytics/trends', { params: { days } }),
  getCategoryAnalytics: () => api.get('/admin/analytics/categories'),
  getAnalyticsGeographic: () => api.get('/admin/analytics/geographic'),
  getAnalyticsMatches: () => api.get('/admin/analytics/matches'),
  getAnalyticsEngagement: () => api.get('/admin/analytics/engagement'),
  getAnalyticsTiming: () => api.get('/admin/analytics/timing'),
  getAnalyticsBrands: () => api.get('/admin/analytics/brands'),
  getAnalyticsActivityPattern: () => api.get('/admin/analytics/activity-pattern'),
  
  // Audit Logs
  getAuditLogs: () => api.get('/admin/audit-logs'),
  
  // Legacy analytics (kept for backward compatibility)
  getAllReports: () => api.get('/admin/reports'),
  getCategoryAnalytics: () => api.get('/admin/analytics/categories'),
  getTimelineAnalytics: () => api.get('/admin/analytics/timeline'),
  getLeaderboard: () => api.get('/admin/leaderboard'),
};

// ─── Health Check ─────────────────────────────────────────────
export const healthAPI = {
  check: () => api.get('/health'),
};

export default api;
