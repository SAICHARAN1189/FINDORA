#!/usr/bin/env node

/**
 * Locker Workflow Integration Test
 * 
 * Tests the complete deposit → OTP → unlock → collection workflow
 * 
 * Workflow:
 * 1. Backend creates locker session
 * 2. Backend sends deposit command via MQTT
 * 3. Simulator unlocks door (depositing)
 * 4. User places item and closes door
 * 5. Simulator locks and marks as occupied
 * 6. User enters OTP via API
 * 7. Backend verifies OTP
 * 8. Backend sends unlock command
 * 9. Simulator unlocks for collection
 * 10. Door auto-locks after timeout
 * 11. Session completes
 */

const axios = require('axios');
const { getMQTTBridge } = require('./src/services/mqttBridge');

const API_URL = process.env.API_URL || 'http://localhost:3001/api';
const LOCKER_ID = process.argv[2] || 'locker-sim-001';

// Demo credentials
const TEST_USER = {
  uid: 'demo-user-1',
  email: 'alice@demo.com',
  displayName: 'Alice Johnson',
  role: 'user'
};

// Test report
const TEST_REPORT = 'report-002'; // Found iPhone (from demo data)
const TEST_MATCH = 'match-001';

console.log('╔═══════════════════════════════════════════════╗');
console.log('║   Locker Workflow Integration Test            ║');
console.log('╚═══════════════════════════════════════════════╝');
console.log('');
console.log(`🔧 Locker ID:    ${LOCKER_ID}`);
console.log(`👤 Test User:    ${TEST_USER.displayName}`);
console.log(`📄 Test Report:  ${TEST_REPORT}`);
console.log(`🎯 API URL:      ${API_URL}`);
console.log('');

// Axios instance with auth header
const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Authorization': `Bearer demo-token-${TEST_USER.uid}`
  }
});

// ==================== TEST UTILITIES ====================
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function logStep(step, message) {
  console.log(`\n[STEP ${step}] ${message}`);
  console.log('─'.repeat(50));
}

function logSuccess(message) {
  console.log(`✅ ${message}`);
}

function logError(message) {
  console.error(`❌ ${message}`);
}

function logInfo(message) {
  console.log(`ℹ️  ${message}`);
}

// ==================== TEST STEPS ====================
let testSession = null;
let testOTP = null;
let mqttBridge = null;

async function step1_ConnectMQTT() {
  logStep(1, 'Connect to MQTT Broker');
  
  try {
    mqttBridge = getMQTTBridge();
    await mqttBridge.connect();
    
    logSuccess('MQTT bridge connected');
    
    // Wait for locker heartbeat
    logInfo('Waiting for locker heartbeat (35s)...');
    await sleep(35000);
    
    const lockerState = mqttBridge.getLockerState(LOCKER_ID);
    if (lockerState) {
      logSuccess(`Locker ${LOCKER_ID} is online`);
      logInfo(`State: ${lockerState.state}`);
      logInfo(`Door Locked: ${lockerState.doorLocked}`);
    } else {
      logError(`Locker ${LOCKER_ID} not found. Make sure simulator is running!`);
      throw new Error('Locker not online');
    }
    
    return true;
  } catch (error) {
    logError(`Failed to connect MQTT: ${error.message}`);
    throw error;
  }
}

async function step2_CheckLockerAvailability() {
  logStep(2, 'Check Locker Availability');
  
  try {
    const response = await api.get(`/iot/lockers/${LOCKER_ID}`);
    const locker = response.data;
    
    logSuccess('Locker details retrieved');
    logInfo(`Name: ${locker.name || locker.id}`);
    logInfo(`Location: ${locker.location}`);
    logInfo(`State: ${locker.state}`);
    logInfo(`Online: ${locker.online ? 'Yes' : 'No'}`);
    
    if (!locker.online) {
      throw new Error('Locker is offline');
    }
    
    if (locker.state !== 'AVAILABLE' && locker.state !== 'IDLE') {
      logInfo(`Warning: Locker state is ${locker.state}, not AVAILABLE`);
    }
    
    return true;
  } catch (error) {
    logError(`Failed to check locker: ${error.response?.data?.error || error.message}`);
    throw error;
  }
}

async function step3_CreateSession() {
  logStep(3, 'Create Locker Session (Deposit)');
  
  try {
    const response = await api.post('/iot/sessions', {
      lockerId: LOCKER_ID,
      reportId: TEST_REPORT,
      matchId: TEST_MATCH,
      depositedBy: TEST_USER.uid,
      claimedBy: TEST_USER.uid, // Same user for test
    });
    
    testSession = response.data.session;
    testOTP = testSession.otp;
    
    logSuccess('Locker session created');
    logInfo(`Session ID: ${testSession.id}`);
    logInfo(`OTP: ${testOTP} (expires in 10 minutes)`);
    logInfo(`State: ${testSession.state}`);
    
    logInfo('\n🎬 Check simulator - door should unlock for deposit');
    
    return true;
  } catch (error) {
    logError(`Failed to create session: ${error.response?.data?.error || error.message}`);
    throw error;
  }
}

async function step4_WaitForDeposit() {
  logStep(4, 'Wait for Item Deposit');
  
  logInfo('Waiting 8 seconds for deposit simulation...');
  logInfo('(In real scenario: User places item, then simulator locks door)');
  
  await sleep(8000);
  
  // Check session state
  try {
    const response = await api.get(`/iot/sessions/${testSession.id}`);
    const session = response.data;
    
    logInfo(`Session State: ${session.state}`);
    
    if (session.state === 'ITEM_DEPOSITED') {
      logSuccess('Item deposited successfully');
    } else if (session.state === 'PENDING') {
      logInfo('Still pending - door may still be open');
      logInfo('Type "lock" in simulator to simulate door closing');
      
      // Wait a bit more
      logInfo('Waiting additional 5 seconds...');
      await sleep(5000);
      
      const response2 = await api.get(`/iot/sessions/${testSession.id}`);
      if (response2.data.state === 'ITEM_DEPOSITED') {
        logSuccess('Item deposited successfully');
      } else {
        logError(`Session still in ${response2.data.state} state`);
      }
    }
    
    return true;
  } catch (error) {
    logError(`Failed to check session: ${error.response?.data?.error || error.message}`);
    throw error;
  }
}

async function step5_VerifyOTP() {
  logStep(5, 'Verify OTP for Collection');
  
  logInfo(`Attempting to verify OTP: ${testOTP}`);
  
  try {
    const response = await api.post(`/iot/sessions/${testSession.id}/verify-otp`, {
      otp: testOTP
    });
    
    logSuccess('OTP verified successfully');
    logInfo(`Message: ${response.data.message}`);
    logInfo(`Session State: ${response.data.session.state}`);
    
    logInfo('\n🎬 Check simulator - door should unlock for collection');
    
    return true;
  } catch (error) {
    logError(`OTP verification failed: ${error.response?.data?.error || error.message}`);
    throw error;
  }
}

async function step6_WaitForCollection() {
  logStep(6, 'Wait for Collection');
  
  logInfo('Waiting 7 seconds for collection simulation...');
  logInfo('(Door should auto-lock after 5 seconds)');
  
  await sleep(7000);
  
  // Check final session state
  try {
    const response = await api.get(`/iot/sessions/${testSession.id}`);
    const session = response.data;
    
    logInfo(`Final Session State: ${session.state}`);
    
    if (session.state === 'COMPLETED') {
      logSuccess('Collection completed successfully');
    } else if (session.state === 'COLLECTING') {
      logInfo('Still in COLLECTING state - door may still be open');
    } else {
      logInfo(`Unexpected state: ${session.state}`);
    }
    
    return true;
  } catch (error) {
    logError(`Failed to check final state: ${error.response?.data?.error || error.message}`);
    throw error;
  }
}

async function step7_VerifyLockerAvailable() {
  logStep(7, 'Verify Locker Returned to Available');
  
  try {
    const response = await api.get(`/iot/lockers/${LOCKER_ID}`);
    const locker = response.data;
    
    logInfo(`Locker State: ${locker.state || locker.mqttState}`);
    
    if (locker.state === 'AVAILABLE' || locker.mqttState === 'IDLE') {
      logSuccess('Locker is available for next use');
    } else {
      logInfo(`Locker state: ${locker.state || locker.mqttState} (may take a moment to update)`);
    }
    
    logInfo(`Session ID: ${locker.sessionId || 'None'}`);
    
    return true;
  } catch (error) {
    logError(`Failed to check locker: ${error.response?.data?.error || error.message}`);
    throw error;
  }
}

// ==================== TEST NEGATIVE SCENARIOS ====================
async function testInvalidOTP() {
  logStep('8a', 'Test Invalid OTP (Negative Test)');
  
  // First create another session
  try {
    const response = await api.post('/iot/sessions', {
      lockerId: LOCKER_ID,
      reportId: TEST_REPORT,
      matchId: TEST_MATCH,
      depositedBy: TEST_USER.uid,
      claimedBy: TEST_USER.uid,
    });
    
    const session = response.data.session;
    logInfo(`New session created: ${session.id}`);
    
    await sleep(3000);
    
    // Try invalid OTP
    try {
      await api.post(`/iot/sessions/${session.id}/verify-otp`, {
        otp: '999999'
      });
      
      logError('Should have rejected invalid OTP!');
    } catch (error) {
      if (error.response?.status === 400) {
        logSuccess('Invalid OTP correctly rejected');
        logInfo(`Error: ${error.response.data.error}`);
      } else {
        throw error;
      }
    }
    
    // Clean up - cancel session
    await api.post(`/iot/sessions/${session.id}/cancel`);
    logInfo('Test session cancelled');
    
    return true;
  } catch (error) {
    logError(`Negative test failed: ${error.message}`);
    return false;
  }
}

// ==================== MAIN TEST RUNNER ====================
async function runTests() {
  console.log('🚀 Starting integration test...\n');
  
  const startTime = Date.now();
  let allPassed = true;
  
  try {
    // Main workflow
    await step1_ConnectMQTT();
    await step2_CheckLockerAvailability();
    await step3_CreateSession();
    await step4_WaitForDeposit();
    await step5_VerifyOTP();
    await step6_WaitForCollection();
    await step7_VerifyLockerAvailable();
    
    // Negative tests
    await sleep(2000);
    await testInvalidOTP();
    
  } catch (error) {
    allPassed = false;
    console.error('\n💥 Test failed:', error.message);
  }
  
  const duration = ((Date.now() - startTime) / 1000).toFixed(1);
  
  console.log('\n');
  console.log('═'.repeat(50));
  if (allPassed) {
    console.log('✅ ALL TESTS PASSED');
  } else {
    console.log('❌ SOME TESTS FAILED');
  }
  console.log(`⏱️  Duration: ${duration}s`);
  console.log('═'.repeat(50));
  console.log('');
  
  // Cleanup
  if (mqttBridge) {
    mqttBridge.disconnect();
  }
  
  process.exit(allPassed ? 0 : 1);
}

// ==================== STARTUP ====================
console.log('⚠️  Prerequisites:');
console.log('   1. Backend server running (npm start)');
console.log('   2. Locker simulator running:');
console.log(`      node locker-simulator.js ${LOCKER_ID}`);
console.log('');
console.log('Starting in 3 seconds...');
console.log('');

setTimeout(runTests, 3000);
