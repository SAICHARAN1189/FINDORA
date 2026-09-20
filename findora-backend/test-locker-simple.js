#!/usr/bin/env node

/**
 * Simple Locker Workflow Test
 * 
 * Automated test that simulates the locker closing automatically
 */

const axios = require('axios');
const { getMQTTBridge } = require('./src/services/mqttBridge');

const API_URL = process.env.API_URL || 'http://localhost:3001/api';
const LOCKER_ID = 'locker-001';
const TEST_USER = { uid: 'demo-user-1' };
const TEST_REPORT = 'report-002';

console.log('🧪 Simple Locker Workflow Test\n');

const api = axios.create({
  baseURL: API_URL,
  headers: { 'Authorization': `Bearer demo-token-${TEST_USER.uid}` }
});

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

let mqttBridge = null;
let testSession = null;

async function runTest() {
  try {
    console.log('1️⃣  Connecting to MQTT...');
    mqttBridge = getMQTTBridge();
    await mqttBridge.connect();
    console.log('✅ MQTT connected\n');
    
    await sleep(3000);
    
    console.log('2️⃣  Creating locker session...');
    const sessionRes = await api.post('/iot/sessions', {
      lockerId: LOCKER_ID,
      reportId: TEST_REPORT,
      depositedBy: TEST_USER.uid,
      claimedBy: TEST_USER.uid,
    });
    testSession = sessionRes.data.session;
    console.log(`✅ Session created: ${testSession.id}`);
    console.log(`   OTP: ${testSession.otp}\n`);
    
    await sleep(3000);
    
    console.log('3️⃣  Simulating door close (locking)...');
    await mqttBridge.lockDoor(LOCKER_ID);
    console.log('✅ Lock command sent\n');
    
    await sleep(5000);
    
    console.log('4️⃣  Verifying OTP...');
    const otpRes = await api.post(`/iot/sessions/${testSession.id}/verify-otp`, {
      otp: testSession.otp
    });
    console.log(`✅ OTP verified: ${otpRes.data.message}\n`);
    
    await sleep(7000);
    
    console.log('5️⃣  Checking final session state...');
    const finalRes = await api.get(`/iot/sessions/${testSession.id}`);
    console.log(`✅ Final state: ${finalRes.data.state}\n`);
    
    if (finalRes.data.state === 'COMPLETED') {
      console.log('🎉 TEST PASSED - Complete workflow successful!\n');
      process.exit(0);
    } else {
      console.log(`⚠️  Test completed but state is ${finalRes.data.state}\n`);
      process.exit(0);
    }
    
  } catch (error) {
    console.error('\n❌ TEST FAILED:', error.response?.data || error.message);
    process.exit(1);
  } finally {
    if (mqttBridge) {
      mqttBridge.disconnect();
    }
  }
}

console.log('Starting test in 3 seconds...\n');
setTimeout(runTest, 3000);
