// src/config/demoStore.js
// In-memory store for demo mode - replaces Firestore

const { v4: uuidv4 } = require('uuid');

// ─── Demo Data ────────────────────────────────────────────────
const now = Date.now();
const H = 3600000; // 1 hour in ms

const demoUsers = {
  'demo-user-1': {
    uid: 'demo-user-1',
    email: 'alice@demo.com',
    displayName: 'Alice Johnson',
    role: 'user',
    photoURL: null,
    telegramChatId: null,
    rewardPoints: 420,
    badges: ['early_adopter', 'good_samaritan'],
    createdAt: now - 30 * 24 * H,
    blocked: false,
  },
  'demo-user-2': {
    uid: 'demo-user-2',
    email: 'bob@demo.com',
    displayName: 'Bob Smith',
    role: 'user',
    photoURL: null,
    telegramChatId: 5679070779,
    rewardPoints: 180,
    badges: ['first_report'],
    createdAt: now - 20 * 24 * H,
    blocked: false,
  },
  'demo-admin-1': {
    uid: 'demo-admin-1',
    email: 'admin@demo.com',
    displayName: 'Admin User',
    role: 'institution_admin',
    photoURL: null,
    telegramChatId: null,
    rewardPoints: 0,
    badges: [],
    createdAt: now - 60 * 24 * H,
    blocked: false,
  },
  'demo-police-1': {
    uid: 'demo-police-1',
    email: 'police@demo.com',
    displayName: 'Officer Singh',
    role: 'police',
    photoURL: null,
    telegramChatId: null,
    rewardPoints: 0,
    badges: [],
    createdAt: now - 90 * 24 * H,
    blocked: false,
  },
  'demo-super-1': {
    uid: 'demo-super-1',
    email: 'super@demo.com',
    displayName: 'Super Admin',
    role: 'super_admin',
    photoURL: null,
    telegramChatId: null,
    rewardPoints: 0,
    badges: [],
    createdAt: now - 120 * 24 * H,
    blocked: false,
  },
};

const demoReports = {
  'report-001': {
    id: 'report-001',
    type: 'lost',
    status: 'active',
    userId: 'demo-user-1',
    userDisplayName: 'Alice Johnson',
    category: 'electronics',
    title: 'Lost iPhone 15 Pro',
    description: 'Lost my iPhone 15 Pro with a blue titanium case near the Central Library. Has a cracked screen protector on the bottom right corner.',
    brand: 'Apple',
    model: 'iPhone 15 Pro',
    color: 'Blue Titanium',
    location: { name: 'Central Library, Block A', lat: 12.9716, lng: 77.5946 },
    dateOccurred: new Date(now - 2 * 24 * H).toISOString(),
    imageUrl: 'https://placehold.co/400x300/1a1a2e/ffffff?text=iPhone+15+Pro',
    identifyingCharacteristics: 'Cracked screen protector bottom-right, sticker of a cat on the back',
    anonymous: false,
    createdAt: new Date(now - 2 * 24 * H).toISOString(),
    updatedAt: new Date(now - 2 * 24 * H).toISOString(),
  },
  'report-002': {
    id: 'report-002',
    type: 'found',
    status: 'matched',
    userId: 'demo-user-2',
    userDisplayName: 'Bob Smith',
    category: 'electronics',
    title: 'Found iPhone near Library',
    description: 'Found an iPhone with blue case near the library entrance. Screen protector has some cracks.',
    brand: 'Apple',
    model: 'iPhone 15 Pro',
    color: 'Blue',
    location: { name: 'Central Library Entrance', lat: 12.9718, lng: 77.5948 },
    dateOccurred: new Date(now - 1 * 24 * H).toISOString(),
    imageUrl: 'https://placehold.co/400x300/16213e/ffffff?text=Found+iPhone',
    identifyingCharacteristics: 'Cat sticker visible on back',
    anonymous: false,
    createdAt: new Date(now - 1 * 24 * H).toISOString(),
    updatedAt: new Date(now - 1 * 24 * H).toISOString(),
  },
  'report-003': {
    id: 'report-003',
    type: 'lost',
    status: 'active',
    userId: 'demo-user-1',
    userDisplayName: 'Alice Johnson',
    category: 'bags',
    title: 'Lost Black Backpack',
    description: 'Lost my black Nike backpack at the food court. Contains laptop and books.',
    brand: 'Nike',
    model: 'Elemental Backpack',
    color: 'Black',
    location: { name: 'Food Court, Ground Floor', lat: 12.9720, lng: 77.5940 },
    dateOccurred: new Date(now - 5 * 24 * H).toISOString(),
    imageUrl: 'https://placehold.co/400x300/0f3460/ffffff?text=Nike+Backpack',
    identifyingCharacteristics: 'Red keychain, initials AJ sewn inside',
    anonymous: false,
    createdAt: new Date(now - 5 * 24 * H).toISOString(),
    updatedAt: new Date(now - 5 * 24 * H).toISOString(),
  },
  'report-004': {
    id: 'report-004',
    type: 'found',
    status: 'collected',
    userId: 'demo-user-2',
    userDisplayName: 'Bob Smith',
    category: 'keys',
    title: 'Found Car Keys',
    description: 'Found a set of car keys with a Hyundai remote near parking lot B.',
    brand: 'Hyundai',
    model: null,
    color: 'Silver',
    location: { name: 'Parking Lot B', lat: 12.9710, lng: 77.5930 },
    dateOccurred: new Date(now - 7 * 24 * H).toISOString(),
    imageUrl: 'https://placehold.co/400x300/533483/ffffff?text=Car+Keys',
    identifyingCharacteristics: 'Has a small teddy bear keychain',
    anonymous: false,
    createdAt: new Date(now - 7 * 24 * H).toISOString(),
    updatedAt: new Date(now - 7 * 24 * H).toISOString(),
  },
  'report-005': {
    id: 'report-005',
    type: 'lost',
    status: 'active',
    userId: 'demo-user-2',
    userDisplayName: 'Bob Smith',
    category: 'documents',
    title: 'Lost Student ID Card',
    description: 'Lost my university student ID card. Name: Bob Smith, Roll: 21CS042',
    brand: null,
    model: null,
    color: 'Blue/White',
    location: { name: 'Main Gate Security', lat: 12.9700, lng: 77.5920 },
    dateOccurred: new Date(now - 3 * 24 * H).toISOString(),
    imageUrl: 'https://placehold.co/400x300/e94560/ffffff?text=ID+Card',
    identifyingCharacteristics: 'Photo ID with university logo',
    anonymous: false,
    createdAt: new Date(now - 3 * 24 * H).toISOString(),
    updatedAt: new Date(now - 3 * 24 * H).toISOString(),
  },
};

const demoMatches = {
  'match-001': {
    id: 'match-001',
    lostReportId: 'report-001',
    foundReportId: 'report-002',
    lostUserId: 'demo-user-1',
    foundUserId: 'demo-user-2',
    confidence: 91,
    status: 'pending', // pending | accepted | rejected | verified | completed
    reasons: [
      { factor: 'category', score: 10, label: 'Same category (Electronics)' },
      { factor: 'brand', score: 10, label: 'Same brand (Apple)' },
      { factor: 'model', score: 5, label: 'Same model (iPhone 15 Pro)' },
      { factor: 'color', score: 5, label: 'Similar color (Blue / Blue Titanium)' },
      { factor: 'location', score: 8, label: 'Nearby location (~250m apart)' },
      { factor: 'textSimilarity', score: 18, label: 'Similar description (cat sticker, cracked protector)' },
      { factor: 'imageSimilarity', score: 25, label: 'Similar item appearance' },
      { factor: 'time', score: 10, label: 'Found 1 day after reported lost' },
    ],
    createdAt: new Date(now - 12 * H).toISOString(),
    updatedAt: new Date(now - 12 * H).toISOString(),
  },
};

const demoLockers = {
  'locker-001': {
    id: 'locker-001',
    name: 'Locker A1',
    location: 'Main Building - Ground Floor',
    state: 'AVAILABLE',
    ip: '192.168.1.101',
    lastHeartbeat: new Date(now - 2 * 60000).toISOString(),
    sessionId: null,
    firmwareVersion: '1.2.0',
  },
  'locker-002': {
    id: 'locker-002',
    name: 'Locker A2',
    location: 'Main Building - Ground Floor',
    state: 'ITEM_DEPOSITED',
    ip: '192.168.1.102',
    lastHeartbeat: new Date(now - 1 * 60000).toISOString(),
    sessionId: 'session-001',
    firmwareVersion: '1.2.0',
  },
  'locker-003': {
    id: 'locker-003',
    name: 'Locker B1',
    location: 'Library - Level 2',
    state: 'AVAILABLE',
    ip: '192.168.1.103',
    lastHeartbeat: new Date(now - 30000).toISOString(),
    sessionId: null,
    firmwareVersion: '1.2.0',
  },
  'locker-004': {
    id: 'locker-004',
    name: 'Locker B2',
    location: 'Library - Level 2',
    state: 'OFFLINE',
    ip: '192.168.1.104',
    lastHeartbeat: new Date(now - 15 * 60000).toISOString(),
    sessionId: null,
    firmwareVersion: '1.1.5',
  },
};

const demoLockerSessions = {
  'session-001': {
    id: 'session-001',
    lockerId: 'locker-002',
    matchId: 'match-001',
    reportId: 'report-002',
    depositedBy: 'demo-user-1',
    claimedBy: 'demo-user-2',
    otp: '847291',
    otpExpiry: new Date(now + 10 * 60000).toISOString(),
    otpAttempts: 0,
    state: 'ITEM_DEPOSITED',
    createdAt: new Date(now - 3 * H).toISOString(),
    updatedAt: new Date(now - 1 * H).toISOString(),
  },
};

const demoNotifications = {};
const demoChats = {};
const demoChatMessages = {};
const demoAuditLogs = {};
const demoFraudAssessments = {};
const demoPointsTransactions = {};

// ─── Store Operations ──────────────────────────────────────────
const store = {
  users: { ...demoUsers },
  reports: { ...demoReports },
  matches: { ...demoMatches },
  lockers: { ...demoLockers },
  lockerSessions: { ...demoLockerSessions },
  notifications: { ...demoNotifications },
  chats: { ...demoChats },
  chatMessages: { ...demoChatMessages },
  auditLogs: { ...demoAuditLogs },
  fraudAssessments: { ...demoFraudAssessments },
  pointsTransactions: { ...demoPointsTransactions },

  // Users
  getUser: (uid) => store.users[uid] || null,
  createUser: (data) => { store.users[data.uid] = data; return data; },
  updateUser: (uid, data) => {
    store.users[uid] = { ...store.users[uid], ...data, updatedAt: new Date().toISOString() };
    return store.users[uid];
  },
  getAllUsers: () => Object.values(store.users),

  // Reports
  getReport: (id) => store.reports[id] || null,
  createReport: (data) => {
    const id = data.id || `report-${uuidv4().slice(0, 8)}`;
    store.reports[id] = { ...data, id };
    return store.reports[id];
  },
  updateReport: (id, data) => {
    store.reports[id] = { ...store.reports[id], ...data, updatedAt: new Date().toISOString() };
    return store.reports[id];
  },
  getAllReports: () => Object.values(store.reports),
  getReportsByUser: (uid) => Object.values(store.reports).filter(r => r.userId === uid),

  // Matches
  getMatch: (id) => store.matches[id] || null,
  createMatch: (data) => {
    const id = data.id || `match-${uuidv4().slice(0, 8)}`;
    store.matches[id] = { ...data, id };
    return store.matches[id];
  },
  updateMatch: (id, data) => {
    store.matches[id] = { ...store.matches[id], ...data, updatedAt: new Date().toISOString() };
    return store.matches[id];
  },
  getAllMatches: () => Object.values(store.matches),
  getMatchesForUser: (uid) => Object.values(store.matches).filter(m => m.lostUserId === uid || m.foundUserId === uid),

  // Lockers
  getLocker: (id) => store.lockers[id] || null,
  getAllLockers: () => Object.values(store.lockers),
  updateLocker: (id, data) => {
    store.lockers[id] = { ...store.lockers[id], ...data };
    return store.lockers[id];
  },

  // Locker Sessions
  getLockerSession: (id) => store.lockerSessions[id] || null,
  getLockerSessionByLocker: (lockerId) => Object.values(store.lockerSessions).find(s => s.lockerId === lockerId && s.state !== 'COMPLETED' && s.state !== 'CANCELLED'),
  getLockerSessionByOTP: (otp) => Object.values(store.lockerSessions).find(s => s.otp === otp && s.state === 'ITEM_DEPOSITED'),
  createLockerSession: (data) => {
    const id = data.id || `session-${uuidv4().slice(0, 8)}`;
    const otp = data.otp || Math.floor(100000 + Math.random() * 900000).toString();
    const otpExpiry = new Date(Date.now() + 10 * 60000).toISOString(); // 10 minutes
    store.lockerSessions[id] = { 
      ...data, 
      id, 
      otp, 
      otpExpiry,
      otpAttempts: 0,
      state: data.state || 'PENDING',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    return store.lockerSessions[id];
  },
  updateLockerSession: (id, data) => {
    store.lockerSessions[id] = { ...store.lockerSessions[id], ...data, updatedAt: new Date().toISOString() };
    return store.lockerSessions[id];
  },
  getAllLockerSessions: () => Object.values(store.lockerSessions),

  // Notifications
  createNotification: (data) => {
    const id = `notif-${uuidv4().slice(0, 8)}`;
    store.notifications[id] = { ...data, id, read: false, createdAt: new Date().toISOString() };
    return store.notifications[id];
  },
  getNotificationsForUser: (uid) => Object.values(store.notifications).filter(n => n.userId === uid).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)),
  markNotificationRead: (id) => {
    if (store.notifications[id]) store.notifications[id].read = true;
  },

  // Chats
  createChat: (data) => {
    const id = data.id || `chat-${uuidv4().slice(0, 8)}`;
    store.chats[id] = { ...data, id, createdAt: new Date().toISOString() };
    store.chatMessages[id] = [];
    return store.chats[id];
  },
  getChat: (id) => store.chats[id] || null,
  getChatsByUser: (uid) => Object.values(store.chats).filter(c => c.participants.includes(uid)),
  getChatMessages: (chatId) => store.chatMessages[chatId] || [],
  addChatMessage: (chatId, msg) => {
    if (!store.chatMessages[chatId]) store.chatMessages[chatId] = [];
    const message = { ...msg, id: `msg-${uuidv4().slice(0, 8)}`, createdAt: new Date().toISOString() };
    store.chatMessages[chatId].push(message);
    store.chats[chatId].lastMessage = msg.text;
    store.chats[chatId].lastMessageAt = message.createdAt;
    return message;
  },

  // Audit Logs
  addAuditLog: (data) => {
    const id = `log-${uuidv4().slice(0, 8)}`;
    store.auditLogs[id] = { ...data, id, createdAt: new Date().toISOString() };
    return store.auditLogs[id];
  },
  getAuditLogs: () => Object.values(store.auditLogs).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)),

  // Fraud Assessments
  addFraudAssessment: (data) => {
    const id = `fraud-${uuidv4().slice(0, 8)}`;
    store.fraudAssessments[id] = { ...data, id };
    return store.fraudAssessments[id];
  },
  getAllFraudAssessments: () => Object.values(store.fraudAssessments),
  getFraudAssessment: (id) => store.fraudAssessments[id] || null,
  getFraudAssessmentsByReport: (reportId) => Object.values(store.fraudAssessments).filter(a => a.reportId === reportId),

  // Points Transactions
  addPointsTransaction: (data) => {
    const id = `txn-${uuidv4().slice(0, 8)}`;
    store.pointsTransactions[id] = { ...data, id };
    return store.pointsTransactions[id];
  },
  getPointsTransactions: (userId) => Object.values(store.pointsTransactions).filter(t => t.userId === userId).sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp)),
  getAllPointsTransactions: () => Object.values(store.pointsTransactions),

  // Stats
  getStats: () => {
    const reports = Object.values(store.reports);
    const matches = Object.values(store.matches);
    const lockers = Object.values(store.lockers);
    return {
      totalReports: reports.length,
      lostReports: reports.filter(r => r.type === 'lost').length,
      foundReports: reports.filter(r => r.type === 'found').length,
      activeReports: reports.filter(r => r.status === 'active').length,
      matchedReports: reports.filter(r => r.status === 'matched').length,
      collectedReports: reports.filter(r => r.status === 'collected').length,
      totalMatches: matches.length,
      pendingMatches: matches.filter(m => m.status === 'pending').length,
      confirmedMatches: matches.filter(m => m.status === 'verified').length,
      completedMatches: matches.filter(m => m.status === 'completed').length,
      availableLockers: lockers.filter(l => l.state === 'AVAILABLE').length,
      totalLockers: lockers.length,
      onlineLockers: lockers.filter(l => l.state !== 'OFFLINE' && l.state !== 'ERROR').length,
    };
  },
};

module.exports = store;
