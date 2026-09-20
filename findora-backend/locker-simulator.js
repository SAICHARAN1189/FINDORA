#!/usr/bin/env node

/**
 * ESP32 Smart Locker Simulator
 * 
 * Software simulation of ESP32 locker behavior for testing
 * Mimics the complete state machine and MQTT communication
 * 
 * Usage:
 *   node locker-simulator.js [locker-id] [location]
 * 
 * Example:
 *   node locker-simulator.js locker-001 "Main Building"
 */

const mqtt = require('mqtt');
const readline = require('readline');

// ==================== CONFIGURATION ====================
const LOCKER_ID = process.argv[2] || 'locker-sim-001';
const LOCATION = process.argv[3] || 'Simulated Location';
const MQTT_BROKER = process.env.MQTT_BROKER || 'mqtt://broker.hivemq.com:1883';
const CLIENT_ID = `findora-sim-${LOCKER_ID}-${Date.now()}`;

// Timing constants
const HEARTBEAT_INTERVAL = 30000; // 30 seconds
const UNLOCK_DURATION = 5000;     // 5 seconds

// ==================== STATE MACHINE ====================
const States = {
  IDLE: 'IDLE',
  DEPOSITING: 'DEPOSITING',
  OCCUPIED: 'OCCUPIED',
  VERIFYING_OTP: 'VERIFYING_OTP',
  UNLOCKED: 'UNLOCKED',
  MAINTENANCE: 'MAINTENANCE',
  ERROR: 'ERROR',
};

let currentState = States.IDLE;
let doorLocked = true;
let sessionActive = false;
let currentSession = null;
let unlockStartTime = 0;
let startTime = Date.now();

// ==================== MQTT TOPICS ====================
const topicPrefix = `findora/locker/${LOCKER_ID}`;
const topics = {
  status: `${topicPrefix}/status`,
  command: `${topicPrefix}/command`,
  heartbeat: `${topicPrefix}/heartbeat`,
  otp: `${topicPrefix}/otp`,
  session: `${topicPrefix}/session`,
};

// ==================== MQTT CLIENT ====================
let mqttClient = null;
let connected = false;

console.log('╔═══════════════════════════════════════════════╗');
console.log('║   Findora Smart Locker Simulator             ║');
console.log('╚═══════════════════════════════════════════════╝');
console.log('');
console.log(`🔧 Locker ID:  ${LOCKER_ID}`);
console.log(`📍 Location:   ${LOCATION}`);
console.log(`🌐 MQTT:       ${MQTT_BROKER}`);
console.log(`🆔 Client ID:  ${CLIENT_ID}`);
console.log('');

// ==================== MQTT CONNECTION ====================
function connectMQTT() {
  console.log('🔌 Connecting to MQTT broker...');
  
  mqttClient = mqtt.connect(MQTT_BROKER, {
    clientId: CLIENT_ID,
    clean: true,
    reconnectPeriod: 5000,
    connectTimeout: 30000,
  });

  mqttClient.on('connect', () => {
    console.log('✅ MQTT connected');
    connected = true;
    
    // Subscribe to command topic
    mqttClient.subscribe(topics.command, (err) => {
      if (err) {
        console.error('❌ Subscribe error:', err);
      } else {
        console.log(`📥 Subscribed to: ${topics.command}`);
      }
    });
    
    // Publish initial status
    publishStatus();
    publishHeartbeat();
    
    console.log('');
    console.log('✨ Locker simulator ready!');
    console.log('');
    displayHelp();
  });

  mqttClient.on('error', (error) => {
    console.error('❌ MQTT error:', error.message);
    connected = false;
  });

  mqttClient.on('offline', () => {
    console.log('📴 MQTT offline');
    connected = false;
  });

  mqttClient.on('reconnect', () => {
    console.log('🔄 MQTT reconnecting...');
  });

  mqttClient.on('message', (topic, message) => {
    handleCommand(topic, message);
  });
}

// ==================== STATE MANAGEMENT ====================
function changeState(newState) {
  if (currentState === newState) return;
  
  console.log(`\n🔄 State: ${currentState} → ${newState}`);
  currentState = newState;
  
  publishStatus();
  displayCurrentState();
}

function displayCurrentState() {
  const icons = {
    [States.IDLE]: '✅',
    [States.DEPOSITING]: '📦',
    [States.OCCUPIED]: '🔒',
    [States.VERIFYING_OTP]: '🔑',
    [States.UNLOCKED]: '🔓',
    [States.MAINTENANCE]: '🔧',
    [States.ERROR]: '❌',
  };
  
  console.log(`${icons[currentState]} Current State: ${currentState}`);
  console.log(`🚪 Door: ${doorLocked ? '🔒 LOCKED' : '🔓 UNLOCKED'}`);
  if (sessionActive && currentSession) {
    console.log(`📋 Session: ${currentSession.sessionId}`);
    console.log(`👤 Report: ${currentSession.reportId}`);
  }
}

// ==================== DOOR CONTROL ====================
function unlockDoor() {
  console.log('\n🔓 UNLOCKING DOOR');
  doorLocked = false;
  unlockStartTime = Date.now();
  
  publishEvent('unlocked');
  
  if (currentState === States.DEPOSITING) {
    console.log('📦 Door open for deposit - Place item inside');
  } else {
    changeState(States.UNLOCKED);
    console.log('🎉 Door unlocked for collection');
    
    // Auto-lock after timeout
    setTimeout(() => {
      if (!doorLocked) {
        console.log('\n⏰ Auto-locking door (timeout)');
        lockDoor();
      }
    }, UNLOCK_DURATION);
  }
}

function lockDoor() {
  console.log('\n🔒 LOCKING DOOR');
  doorLocked = true;
  
  publishEvent('locked');
  
  if (currentState === States.DEPOSITING) {
    // Deposit complete
    changeState(States.OCCUPIED);
    console.log('✅ Item deposited and secured');
    
    // Publish session update
    if (currentSession) {
      publishMessage(topics.session, {
        lockerId: LOCKER_ID,
        sessionId: currentSession.sessionId,
        status: 'occupied',
        timestamp: Date.now(),
      });
    }
    
  } else if (currentState === States.UNLOCKED) {
    // Collection complete
    sessionActive = false;
    currentSession = null;
    changeState(States.IDLE);
    console.log('✅ Collection complete');
  }
}

// ==================== COMMAND HANDLER ====================
function handleCommand(topic, message) {
  try {
    const data = JSON.parse(message.toString());
    const action = data.action;
    
    console.log(`\n📨 Command received: ${action}`);
    
    switch (action) {
      case 'deposit':
        handleDeposit(data);
        break;
      
      case 'verify_otp':
        handleVerifyOTP(data);
        break;
      
      case 'unlock':
        if (currentState === States.OCCUPIED || currentState === States.IDLE) {
          unlockDoor();
        } else {
          console.log('⚠️  Cannot unlock in current state');
        }
        break;
      
      case 'lock':
        lockDoor();
        break;
      
      case 'cancel':
        sessionActive = false;
        currentSession = null;
        changeState(States.IDLE);
        console.log('❌ Session cancelled');
        break;
      
      case 'maintenance':
        changeState(data.enable ? States.MAINTENANCE : States.IDLE);
        console.log(`🔧 Maintenance mode: ${data.enable ? 'ENABLED' : 'DISABLED'}`);
        break;
      
      case 'status':
        publishStatus();
        break;
      
      case 'otp_result':
        console.log(`🔑 OTP Result: ${data.success ? '✅ VALID' : '❌ INVALID'}`);
        if (data.reason) {
          console.log(`   Reason: ${data.reason}`);
        }
        break;
      
      default:
        console.log(`⚠️  Unknown command: ${action}`);
    }
  } catch (error) {
    console.error('❌ Error parsing command:', error.message);
  }
}

function handleDeposit(data) {
  if (currentState !== States.IDLE) {
    console.log('⚠️  Cannot deposit - locker not available');
    return;
  }
  
  // Store session
  currentSession = {
    sessionId: data.sessionId,
    reportId: data.reportId,
    userId: data.userId,
    depositTime: Date.now(),
  };
  sessionActive = true;
  
  console.log('📦 Deposit session started');
  console.log(`   Session ID: ${data.sessionId}`);
  console.log(`   Report ID: ${data.reportId}`);
  console.log(`   User ID: ${data.userId}`);
  
  changeState(States.DEPOSITING);
  unlockDoor();
  
  // Publish session started
  publishMessage(topics.session, {
    lockerId: LOCKER_ID,
    sessionId: data.sessionId,
    status: 'depositing',
    timestamp: Date.now(),
  });
  
  console.log('\n💡 TIP: Type "lock" to simulate closing the door');
}

function handleVerifyOTP(data) {
  if (!sessionActive) {
    console.log('⚠️  No active session');
    return;
  }
  
  console.log(`🔑 Verifying OTP: ${data.otp}`);
  changeState(States.VERIFYING_OTP);
  
  // Publish OTP verification request
  publishMessage(topics.otp, {
    lockerId: LOCKER_ID,
    sessionId: currentSession.sessionId,
    otp: data.otp,
    action: 'verify',
    timestamp: Date.now(),
  });
  
  console.log('⏳ Waiting for backend verification...');
}

// ==================== MQTT PUBLISHING ====================
function publishMessage(topic, data) {
  if (!connected) return;
  
  const message = JSON.stringify(data);
  mqttClient.publish(topic, message, { qos: 1 }, (err) => {
    if (err) {
      console.error(`❌ Publish error [${topic}]:`, err);
    }
  });
}

function publishStatus() {
  publishMessage(topics.status, {
    lockerId: LOCKER_ID,
    location: LOCATION,
    state: currentState,
    doorLocked: doorLocked,
    sessionActive: sessionActive,
    uptime: Math.floor((Date.now() - startTime) / 1000),
    wifiConnected: true,
    wifiRSSI: -50 - Math.floor(Math.random() * 30), // Simulated signal
    ipAddress: '192.168.1.100',
    firmwareVersion: '1.0.0-sim',
    ...(sessionActive && currentSession ? {
      sessionId: currentSession.sessionId,
      reportId: currentSession.reportId,
      userId: currentSession.userId,
    } : {}),
  });
}

function publishHeartbeat() {
  publishMessage(topics.heartbeat, {
    lockerId: LOCKER_ID,
    state: currentState,
    uptime: Math.floor((Date.now() - startTime) / 1000),
    wifiRSSI: -50 - Math.floor(Math.random() * 30),
    doorLocked: doorLocked,
    sessionActive: sessionActive,
    timestamp: Date.now(),
  });
}

function publishEvent(event) {
  publishMessage(topics.status, {
    lockerId: LOCKER_ID,
    event: event,
    timestamp: Date.now(),
  });
}

// ==================== HEARTBEAT LOOP ====================
function startHeartbeat() {
  setInterval(() => {
    if (connected) {
      publishHeartbeat();
      console.log(`\n💓 Heartbeat sent [${currentState}]`);
    }
  }, HEARTBEAT_INTERVAL);
}

// ==================== INTERACTIVE COMMANDS ====================
function displayHelp() {
  console.log('╔══════════════════════════════════════════════╗');
  console.log('║  INTERACTIVE COMMANDS                        ║');
  console.log('╠══════════════════════════════════════════════╣');
  console.log('║  unlock    - Unlock door manually            ║');
  console.log('║  lock      - Lock door manually              ║');
  console.log('║  status    - Show current status             ║');
  console.log('║  publish   - Publish status to MQTT          ║');
  console.log('║  help      - Show this help                  ║');
  console.log('║  quit      - Exit simulator                  ║');
  console.log('╚══════════════════════════════════════════════╝');
  console.log('');
}

function setupCLI() {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    prompt: `[${LOCKER_ID}] > `,
  });

  rl.prompt();

  rl.on('line', (line) => {
    const cmd = line.trim().toLowerCase();
    
    switch (cmd) {
      case 'unlock':
        unlockDoor();
        break;
      
      case 'lock':
        lockDoor();
        break;
      
      case 'status':
        console.log('');
        console.log('═══════════════════════════════════');
        console.log(`Locker ID:      ${LOCKER_ID}`);
        console.log(`Location:       ${LOCATION}`);
        console.log(`State:          ${currentState}`);
        console.log(`Door:           ${doorLocked ? 'LOCKED 🔒' : 'UNLOCKED 🔓'}`);
        console.log(`MQTT:           ${connected ? 'Connected ✅' : 'Disconnected ❌'}`);
        console.log(`Session Active: ${sessionActive ? 'Yes' : 'No'}`);
        if (sessionActive && currentSession) {
          console.log(`Session ID:     ${currentSession.sessionId}`);
          console.log(`Report ID:      ${currentSession.reportId}`);
        }
        console.log(`Uptime:         ${Math.floor((Date.now() - startTime) / 1000)}s`);
        console.log('═══════════════════════════════════');
        break;
      
      case 'publish':
        publishStatus();
        console.log('✅ Status published');
        break;
      
      case 'help':
        displayHelp();
        break;
      
      case 'quit':
      case 'exit':
        console.log('\n👋 Shutting down simulator...');
        if (mqttClient) {
          mqttClient.end();
        }
        process.exit(0);
        break;
      
      case '':
        break;
      
      default:
        console.log(`❌ Unknown command: ${cmd}`);
        console.log('Type "help" for available commands');
    }
    
    rl.prompt();
  });

  rl.on('close', () => {
    console.log('\n👋 Goodbye!');
    process.exit(0);
  });
}

// ==================== STARTUP ====================
function main() {
  // Connect to MQTT
  connectMQTT();
  
  // Start heartbeat
  startHeartbeat();
  
  // Setup interactive CLI
  setupCLI();
}

// ==================== ERROR HANDLING ====================
process.on('SIGINT', () => {
  console.log('\n\n⚠️  Received SIGINT, shutting down...');
  if (mqttClient) {
    mqttClient.end();
  }
  process.exit(0);
});

process.on('uncaughtException', (error) => {
  console.error('\n❌ Uncaught exception:', error);
  process.exit(1);
});

// Start the simulator
main();
