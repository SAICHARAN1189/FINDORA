/**
 * MQTT Bridge Service
 * 
 * Manages MQTT communication with ESP32 smart lockers
 * - Connects to MQTT broker
 * - Publishes commands to lockers
 * - Subscribes to locker status updates
 * - Manages locker sessions and heartbeats
 */

const mqtt = require('mqtt');
const EventEmitter = require('events');

class MQTTBridge extends EventEmitter {
  constructor(config = {}) {
    super();
    
    this.broker = config.broker || process.env.MQTT_BROKER || 'mqtt://broker.hivemq.com:1883';
    this.clientId = config.clientId || `findora-backend-${Date.now()}`;
    this.client = null;
    this.connected = false;
    this.lockers = new Map(); // Store locker states
    this.lastHeartbeat = new Map(); // Track last heartbeat time
    
    console.log('🌉 MQTT Bridge initialized');
    console.log(`   Broker: ${this.broker}`);
    console.log(`   Client ID: ${this.clientId}`);
  }

  /**
   * Connect to MQTT broker
   */
  connect() {
    return new Promise((resolve, reject) => {
      console.log('🔌 Connecting to MQTT broker...');
      
      this.client = mqtt.connect(this.broker, {
        clientId: this.clientId,
        clean: true,
        reconnectPeriod: 5000,
        connectTimeout: 30000,
      });

      this.client.on('connect', () => {
        console.log('✅ MQTT broker connected');
        this.connected = true;
        this.subscribeToTopics();
        this.emit('connected');
        resolve();
      });

      this.client.on('error', (error) => {
        console.error('❌ MQTT error:', error.message);
        this.emit('error', error);
        if (!this.connected) {
          reject(error);
        }
      });

      this.client.on('offline', () => {
        console.log('📴 MQTT broker offline');
        this.connected = false;
        this.emit('offline');
      });

      this.client.on('reconnect', () => {
        console.log('🔄 MQTT reconnecting...');
        this.emit('reconnecting');
      });

      this.client.on('message', (topic, message) => {
        this.handleMessage(topic, message);
      });
    });
  }

  /**
   * Subscribe to all locker topics
   */
  subscribeToTopics() {
    const topics = [
      'findora/locker/+/status',
      'findora/locker/+/heartbeat',
      'findora/locker/+/session',
      'findora/locker/+/otp'
    ];

    topics.forEach(topic => {
      this.client.subscribe(topic, (err) => {
        if (err) {
          console.error(`❌ Failed to subscribe to ${topic}:`, err);
        } else {
          console.log(`📥 Subscribed to: ${topic}`);
        }
      });
    });
  }

  /**
   * Handle incoming MQTT messages
   */
  handleMessage(topic, message) {
    try {
      const data = JSON.parse(message.toString());
      const topicParts = topic.split('/');
      const lockerId = topicParts[2];
      const messageType = topicParts[3];

      // console.log(`📨 MQTT [${topic}]:`, data);

      switch (messageType) {
        case 'heartbeat':
          this.handleHeartbeat(lockerId, data);
          break;
        case 'status':
          this.handleStatus(lockerId, data);
          break;
        case 'session':
          this.handleSession(lockerId, data);
          break;
        case 'otp':
          this.handleOTP(lockerId, data);
          break;
        default:
          console.log(`Unknown message type: ${messageType}`);
      }
    } catch (error) {
      console.error('Error parsing MQTT message:', error);
    }
  }

  /**
   * Handle locker heartbeat
   */
  handleHeartbeat(lockerId, data) {
    this.lastHeartbeat.set(lockerId, Date.now());
    
    // Update locker state
    const locker = this.lockers.get(lockerId) || {};
    this.lockers.set(lockerId, {
      ...locker,
      lockerId,
      state: data.state,
      uptime: data.uptime,
      wifiRSSI: data.wifiRSSI,
      doorLocked: data.doorLocked,
      sessionActive: data.sessionActive,
      lastHeartbeat: Date.now(),
      online: true
    });

    this.emit('heartbeat', { lockerId, data });
  }

  /**
   * Handle locker status update
   */
  handleStatus(lockerId, data) {
    const locker = this.lockers.get(lockerId) || {};
    this.lockers.set(lockerId, {
      ...locker,
      ...data,
      lastUpdate: Date.now(),
      online: true
    });

    this.emit('status', { lockerId, data });
    
    // Special handling for door events
    if (data.event === 'unlocked') {
      this.emit('door_unlocked', { lockerId, data });
    } else if (data.event === 'locked') {
      this.emit('door_locked', { lockerId, data });
    }
  }

  /**
   * Handle session events
   */
  handleSession(lockerId, data) {
    this.emit('session', { lockerId, data });
    
    if (data.status === 'depositing') {
      this.emit('deposit_started', { lockerId, data });
    } else if (data.status === 'occupied') {
      this.emit('deposit_completed', { lockerId, data });
    }
  }

  /**
   * Handle OTP verification request
   */
  handleOTP(lockerId, data) {
    this.emit('otp_verification', { lockerId, data });
  }

  /**
   * Send command to a specific locker
   */
  sendCommand(lockerId, command) {
    return new Promise((resolve, reject) => {
      if (!this.connected) {
        return reject(new Error('MQTT not connected'));
      }

      const topic = `findora/locker/${lockerId}/command`;
      const message = JSON.stringify(command);

      this.client.publish(topic, message, { qos: 1 }, (err) => {
        if (err) {
          console.error(`❌ Failed to send command to ${lockerId}:`, err);
          reject(err);
        } else {
          console.log(`📤 Command sent to ${lockerId}:`, command);
          resolve();
        }
      });
    });
  }

  /**
   * Start deposit session
   */
  async startDeposit(lockerId, sessionData) {
    return this.sendCommand(lockerId, {
      action: 'deposit',
      sessionId: sessionData.sessionId,
      reportId: sessionData.reportId,
      userId: sessionData.userId,
      timestamp: Date.now()
    });
  }

  /**
   * Request OTP verification
   */
  async verifyOTP(lockerId, otp, sessionId) {
    return this.sendCommand(lockerId, {
      action: 'verify_otp',
      otp: otp,
      sessionId: sessionId,
      timestamp: Date.now()
    });
  }

  /**
   * Unlock locker door
   */
  async unlockDoor(lockerId) {
    return this.sendCommand(lockerId, {
      action: 'unlock',
      timestamp: Date.now()
    });
  }

  /**
   * Lock locker door
   */
  async lockDoor(lockerId) {
    return this.sendCommand(lockerId, {
      action: 'lock',
      timestamp: Date.now()
    });
  }

  /**
   * Cancel active session
   */
  async cancelSession(lockerId) {
    return this.sendCommand(lockerId, {
      action: 'cancel',
      timestamp: Date.now()
    });
  }

  /**
   * Set maintenance mode
   */
  async setMaintenance(lockerId, enable) {
    return this.sendCommand(lockerId, {
      action: 'maintenance',
      enable: enable,
      timestamp: Date.now()
    });
  }

  /**
   * Request locker status
   */
  async requestStatus(lockerId) {
    return this.sendCommand(lockerId, {
      action: 'status',
      timestamp: Date.now()
    });
  }

  /**
   * Get locker state
   */
  getLockerState(lockerId) {
    return this.lockers.get(lockerId) || null;
  }

  /**
   * Get all lockers
   */
  getAllLockers() {
    return Array.from(this.lockers.values());
  }

  /**
   * Check if locker is online (heartbeat within last 60 seconds)
   */
  isLockerOnline(lockerId) {
    const lastHB = this.lastHeartbeat.get(lockerId);
    if (!lastHB) return false;
    return (Date.now() - lastHB) < 60000; // 60 seconds
  }

  /**
   * Check offline lockers periodically
   */
  startOfflineCheck() {
    setInterval(() => {
      this.lockers.forEach((locker, lockerId) => {
        const online = this.isLockerOnline(lockerId);
        if (locker.online !== online) {
          locker.online = online;
          this.lockers.set(lockerId, locker);
          
          if (!online) {
            console.log(`⚠️  Locker ${lockerId} went offline`);
            this.emit('locker_offline', { lockerId });
          }
        }
      });
    }, 10000); // Check every 10 seconds
  }

  /**
   * Disconnect from MQTT broker
   */
  disconnect() {
    if (this.client) {
      console.log('🔌 Disconnecting from MQTT broker...');
      this.client.end();
      this.connected = false;
    }
  }

  /**
   * Get connection status
   */
  isConnected() {
    return this.connected;
  }
}

// Singleton instance
let mqttBridgeInstance = null;

module.exports = {
  getMQTTBridge: (config) => {
    if (!mqttBridgeInstance) {
      mqttBridgeInstance = new MQTTBridge(config);
    }
    return mqttBridgeInstance;
  },
  MQTTBridge
};
