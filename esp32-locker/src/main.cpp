/**
 * Findora ESP32 Smart Locker Firmware
 * 
 * Features:
 * - WiFi connectivity
 * - MQTT communication with backend
 * - Solenoid lock control
 * - OLED display (128x64)
 * - State machine for locker operations
 * - OTP verification
 * - Heartbeat monitoring
 * - Secure unlock flow
 */

#include <WiFi.h>
#include <PubSubClient.h>
#include <Wire.h>
#include <Adafruit_GFX.h>
#include <Adafruit_SSD1306.h>
#include <ArduinoJson.h>

// ==================== CONFIGURATION ====================
// WiFi Credentials
const char* WIFI_SSID = "YOUR_WIFI_SSID";
const char* WIFI_PASSWORD = "YOUR_WIFI_PASSWORD";

// MQTT Broker
const char* MQTT_BROKER = "broker.hivemq.com"; // Public MQTT broker for demo
const int MQTT_PORT = 1883;
const char* MQTT_CLIENT_ID = "findora-locker-001"; // Change for each locker

// Locker Configuration
const char* LOCKER_ID = "locker-001";
const char* LOCKER_LOCATION = "Building A - Floor 1";

// Pin Definitions
#define SOLENOID_PIN 25        // GPIO25 - Solenoid lock control
#define LED_STATUS_PIN 2       // GPIO2 - Built-in LED for status
#define BUTTON_PIN 34          // GPIO34 - Physical button for manual trigger

// OLED Display (I2C)
#define SCREEN_WIDTH 128
#define SCREEN_HEIGHT 64
#define OLED_RESET -1
#define SCREEN_ADDRESS 0x3C

// Timing Constants
#define HEARTBEAT_INTERVAL 30000    // 30 seconds
#define UNLOCK_DURATION 5000        // 5 seconds
#define OTP_TIMEOUT 300000          // 5 minutes
#define RECONNECT_DELAY 5000        // 5 seconds

// ==================== GLOBAL OBJECTS ====================
WiFiClient wifiClient;
PubSubClient mqttClient(wifiClient);
Adafruit_SSD1306 display(SCREEN_WIDTH, SCREEN_HEIGHT, &Wire, OLED_RESET);

// ==================== STATE MACHINE ====================
enum LockerState {
  STATE_IDLE,           // Available for deposit
  STATE_DEPOSITING,     // User depositing item
  STATE_OCCUPIED,       // Item stored, waiting for collection
  STATE_VERIFYING_OTP,  // OTP entered, verifying
  STATE_UNLOCKED,       // Door unlocked for collection
  STATE_MAINTENANCE,    // Under maintenance
  STATE_ERROR          // Error state
};

LockerState currentState = STATE_IDLE;
String stateNames[] = {"IDLE", "DEPOSITING", "OCCUPIED", "VERIFYING", "UNLOCKED", "MAINTENANCE", "ERROR"};

// ==================== SESSION DATA ====================
struct LockerSession {
  String sessionId;
  String reportId;
  String userId;
  String enteredOTP;
  unsigned long depositTime;
  unsigned long otpExpiry;
  bool isActive;
} currentSession;

// ==================== TIMING ====================
unsigned long lastHeartbeat = 0;
unsigned long unlockStartTime = 0;
unsigned long lastButtonPress = 0;
bool buttonPressed = false;

// ==================== MQTT TOPICS ====================
String topicPrefix = String("findora/locker/") + LOCKER_ID;
String topicStatus = topicPrefix + "/status";
String topicCommand = topicPrefix + "/command";
String topicHeartbeat = topicPrefix + "/heartbeat";
String topicOTP = topicPrefix + "/otp";
String topicSession = topicPrefix + "/session";

// ==================== FUNCTION DECLARATIONS ====================
void setupWiFi();
void setupMQTT();
void mqttCallback(char* topic, byte* payload, unsigned int length);
void reconnectMQTT();
void publishHeartbeat();
void publishStatus();
void handleCommand(JsonDocument& doc);
void handleOTPVerification(const char* otp);
void handleDeposit(JsonDocument& doc);
void handleCollection();
void unlockDoor();
void lockDoor();
void updateDisplay(const String& line1, const String& line2 = "", const String& line3 = "", const String& line4 = "");
void changeState(LockerState newState);
void checkUnlockTimeout();
void handleButton();

// ==================== SETUP ====================
void setup() {
  Serial.begin(115200);
  delay(1000);
  
  Serial.println("\n\n=================================");
  Serial.println("Findora Smart Locker System");
  Serial.println("=================================");
  Serial.println("Locker ID: " + String(LOCKER_ID));
  Serial.println("Location: " + String(LOCKER_LOCATION));
  
  // Initialize pins
  pinMode(SOLENOID_PIN, OUTPUT);
  pinMode(LED_STATUS_PIN, OUTPUT);
  pinMode(BUTTON_PIN, INPUT_PULLUP);
  
  // Start with door locked
  lockDoor();
  
  // Initialize OLED display
  if(!display.begin(SSD1306_SWITCHCAPVCC, SCREEN_ADDRESS)) {
    Serial.println("ERROR: OLED display initialization failed!");
    changeState(STATE_ERROR);
  } else {
    Serial.println("OLED display initialized");
    display.clearDisplay();
    display.setTextSize(1);
    display.setTextColor(SSD1306_WHITE);
    updateDisplay("Findora Locker", "Initializing...", "", LOCKER_ID);
  }
  
  // Connect to WiFi
  setupWiFi();
  
  // Setup MQTT
  setupMQTT();
  
  // Initialize session
  currentSession.isActive = false;
  
  // Set initial state
  changeState(STATE_IDLE);
  
  Serial.println("Setup complete - System ready!");
}

// ==================== MAIN LOOP ====================
void loop() {
  // Maintain MQTT connection
  if (!mqttClient.connected()) {
    reconnectMQTT();
  }
  mqttClient.loop();
  
  // Handle heartbeat
  unsigned long now = millis();
  if (now - lastHeartbeat >= HEARTBEAT_INTERVAL) {
    publishHeartbeat();
    lastHeartbeat = now;
  }
  
  // Check unlock timeout
  if (currentState == STATE_UNLOCKED) {
    checkUnlockTimeout();
  }
  
  // Handle physical button
  handleButton();
  
  // Blink status LED
  static unsigned long lastBlink = 0;
  if (now - lastBlink >= 1000) {
    digitalWrite(LED_STATUS_PIN, !digitalRead(LED_STATUS_PIN));
    lastBlink = now;
  }
  
  delay(10);
}

// ==================== WiFi SETUP ====================
void setupWiFi() {
  Serial.print("Connecting to WiFi: ");
  Serial.println(WIFI_SSID);
  
  updateDisplay("WiFi", "Connecting...", WIFI_SSID);
  
  WiFi.mode(WIFI_STA);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  
  int attempts = 0;
  while (WiFi.status() != WL_CONNECTED && attempts < 30) {
    delay(500);
    Serial.print(".");
    attempts++;
  }
  
  if (WiFi.status() == WL_CONNECTED) {
    Serial.println("\nWiFi connected!");
    Serial.print("IP Address: ");
    Serial.println(WiFi.localIP());
    updateDisplay("WiFi Connected", WiFi.localIP().toString(), "", "Signal: " + String(WiFi.RSSI()) + "dBm");
    delay(2000);
  } else {
    Serial.println("\nWiFi connection failed!");
    updateDisplay("WiFi ERROR", "Check credentials", "Retrying...");
    changeState(STATE_ERROR);
  }
}

// ==================== MQTT SETUP ====================
void setupMQTT() {
  mqttClient.setServer(MQTT_BROKER, MQTT_PORT);
  mqttClient.setCallback(mqttCallback);
  mqttClient.setBufferSize(512);
  
  Serial.print("MQTT Broker: ");
  Serial.println(MQTT_BROKER);
  
  reconnectMQTT();
}

void reconnectMQTT() {
  while (!mqttClient.connected()) {
    Serial.print("Connecting to MQTT broker...");
    updateDisplay("MQTT", "Connecting...", MQTT_BROKER);
    
    if (mqttClient.connect(MQTT_CLIENT_ID)) {
      Serial.println(" Connected!");
      
      // Subscribe to command topic
      mqttClient.subscribe(topicCommand.c_str());
      Serial.println("Subscribed to: " + topicCommand);
      
      // Publish online status
      publishStatus();
      publishHeartbeat();
      
      updateDisplay("MQTT Connected", "Ready", "", LOCKER_ID);
      delay(2000);
      
    } else {
      Serial.print(" Failed, rc=");
      Serial.print(mqttClient.state());
      Serial.println(" - Retrying in 5s");
      updateDisplay("MQTT ERROR", "Retry in 5s...", "Code: " + String(mqttClient.state()));
      delay(RECONNECT_DELAY);
    }
  }
}

// ==================== MQTT CALLBACK ====================
void mqttCallback(char* topic, byte* payload, unsigned int length) {
  Serial.print("MQTT Message [");
  Serial.print(topic);
  Serial.print("]: ");
  
  // Convert payload to string
  char message[length + 1];
  memcpy(message, payload, length);
  message[length] = '\0';
  Serial.println(message);
  
  // Parse JSON
  JsonDocument doc;
  DeserializationError error = deserializeJson(doc, message);
  
  if (error) {
    Serial.print("JSON parse error: ");
    Serial.println(error.c_str());
    return;
  }
  
  // Handle command
  if (String(topic) == topicCommand) {
    handleCommand(doc);
  }
}

// ==================== COMMAND HANDLER ====================
void handleCommand(JsonDocument& doc) {
  String action = doc["action"].as<String>();
  Serial.println("Command: " + action);
  
  if (action == "deposit") {
    handleDeposit(doc);
  }
  else if (action == "verify_otp") {
    String otp = doc["otp"].as<String>();
    handleOTPVerification(otp.c_str());
  }
  else if (action == "unlock") {
    if (currentState == STATE_OCCUPIED || currentState == STATE_IDLE) {
      unlockDoor();
    }
  }
  else if (action == "lock") {
    lockDoor();
  }
  else if (action == "cancel") {
    currentSession.isActive = false;
    changeState(STATE_IDLE);
  }
  else if (action == "maintenance") {
    bool enable = doc["enable"].as<bool>();
    changeState(enable ? STATE_MAINTENANCE : STATE_IDLE);
  }
  else if (action == "status") {
    publishStatus();
  }
  else {
    Serial.println("Unknown command: " + action);
  }
}

// ==================== DEPOSIT HANDLER ====================
void handleDeposit(JsonDocument& doc) {
  if (currentState != STATE_IDLE) {
    Serial.println("Cannot deposit - locker not available");
    return;
  }
  
  // Store session data
  currentSession.sessionId = doc["sessionId"].as<String>();
  currentSession.reportId = doc["reportId"].as<String>();
  currentSession.userId = doc["userId"].as<String>();
  currentSession.depositTime = millis();
  currentSession.isActive = true;
  
  Serial.println("Starting deposit session: " + currentSession.sessionId);
  
  // Change state and unlock for deposit
  changeState(STATE_DEPOSITING);
  updateDisplay("DEPOSITING", "Place item inside", "Close door when", "done");
  
  unlockDoor();
  
  // Publish session started
  JsonDocument response;
  response["lockerId"] = LOCKER_ID;
  response["sessionId"] = currentSession.sessionId;
  response["status"] = "depositing";
  response["timestamp"] = millis();
  
  char buffer[256];
  serializeJson(response, buffer);
  mqttClient.publish(topicSession.c_str(), buffer);
}

// ==================== OTP VERIFICATION ====================
void handleOTPVerification(const char* otp) {
  Serial.print("Verifying OTP: ");
  Serial.println(otp);
  
  if (!currentSession.isActive) {
    Serial.println("No active session");
    updateDisplay("ERROR", "No active session", "", "");
    return;
  }
  
  changeState(STATE_VERIFYING_OTP);
  updateDisplay("VERIFYING", "OTP: " + String(otp), "Please wait...", "");
  
  // Store OTP for verification
  currentSession.enteredOTP = String(otp);
  
  // Publish OTP verification request
  JsonDocument doc;
  doc["lockerId"] = LOCKER_ID;
  doc["sessionId"] = currentSession.sessionId;
  doc["otp"] = otp;
  doc["action"] = "verify";
  
  char buffer[256];
  serializeJson(doc, buffer);
  mqttClient.publish(topicOTP.c_str(), buffer);
  
  // Wait for response (handled via MQTT callback with verified/failed command)
}

// ==================== DOOR CONTROL ====================
void unlockDoor() {
  Serial.println("🔓 UNLOCKING DOOR");
  digitalWrite(SOLENOID_PIN, HIGH);  // Energize solenoid
  unlockStartTime = millis();
  
  if (currentState == STATE_DEPOSITING) {
    updateDisplay("DOOR OPEN", "Place item inside", "Close when done", "");
  } else {
    changeState(STATE_UNLOCKED);
    updateDisplay("DOOR UNLOCKED", "Collect your item", "Auto-lock in 5s", "");
  }
  
  // Publish unlock event
  JsonDocument doc;
  doc["lockerId"] = LOCKER_ID;
  doc["event"] = "unlocked";
  doc["timestamp"] = millis();
  
  char buffer[128];
  serializeJson(doc, buffer);
  mqttClient.publish(topicStatus.c_str(), buffer);
}

void lockDoor() {
  Serial.println("🔒 LOCKING DOOR");
  digitalWrite(SOLENOID_PIN, LOW);   // De-energize solenoid
  
  // If we were depositing, move to occupied
  if (currentState == STATE_DEPOSITING) {
    changeState(STATE_OCCUPIED);
    updateDisplay("ITEM STORED", "Locker secured", "Session active", "");
    
    // Publish occupied status
    JsonDocument doc;
    doc["lockerId"] = LOCKER_ID;
    doc["sessionId"] = currentSession.sessionId;
    doc["status"] = "occupied";
    doc["timestamp"] = millis();
    
    char buffer[256];
    serializeJson(doc, buffer);
    mqttClient.publish(topicSession.c_str(), buffer);
    
  } else if (currentState == STATE_UNLOCKED) {
    // Collection complete
    currentSession.isActive = false;
    changeState(STATE_IDLE);
    updateDisplay("Collection", "Complete", "", "Thank you!");
    delay(3000);
    changeState(STATE_IDLE);
  }
  
  // Publish lock event
  JsonDocument doc;
  doc["lockerId"] = LOCKER_ID;
  doc["event"] = "locked";
  doc["timestamp"] = millis();
  
  char buffer[128];
  serializeJson(doc, buffer);
  mqttClient.publish(topicStatus.c_str(), buffer);
}

// ==================== UNLOCK TIMEOUT ====================
void checkUnlockTimeout() {
  if (millis() - unlockStartTime >= UNLOCK_DURATION) {
    Serial.println("Unlock timeout - auto-locking");
    lockDoor();
  }
}

// ==================== BUTTON HANDLER ====================
void handleButton() {
  int buttonState = digitalRead(BUTTON_PIN);
  unsigned long now = millis();
  
  // Debounce (50ms)
  if (buttonState == LOW && !buttonPressed && (now - lastButtonPress > 50)) {
    buttonPressed = true;
    lastButtonPress = now;
    
    Serial.println("Button pressed");
    
    // Manual lock/unlock toggle (for maintenance)
    if (currentState == STATE_MAINTENANCE) {
      if (digitalRead(SOLENOID_PIN) == HIGH) {
        lockDoor();
      } else {
        unlockDoor();
      }
    }
  }
  
  if (buttonState == HIGH) {
    buttonPressed = false;
  }
}

// ==================== STATE MANAGEMENT ====================
void changeState(LockerState newState) {
  if (currentState == newState) return;
  
  Serial.print("State change: ");
  Serial.print(stateNames[currentState]);
  Serial.print(" -> ");
  Serial.println(stateNames[newState]);
  
  currentState = newState;
  publishStatus();
  
  // Update display based on state
  switch (newState) {
    case STATE_IDLE:
      updateDisplay("AVAILABLE", "Ready for deposit", "", LOCKER_ID);
      break;
    case STATE_OCCUPIED:
      updateDisplay("OCCUPIED", "Item stored", "OTP required", "");
      break;
    case STATE_MAINTENANCE:
      updateDisplay("MAINTENANCE", "Out of service", "", "");
      break;
    case STATE_ERROR:
      updateDisplay("ERROR", "System error", "Contact support", "");
      break;
    default:
      break;
  }
}

// ==================== DISPLAY UPDATE ====================
void updateDisplay(const String& line1, const String& line2, const String& line3, const String& line4) {
  display.clearDisplay();
  display.setCursor(0, 0);
  
  display.setTextSize(2);
  display.println(line1);
  
  display.setTextSize(1);
  display.println();
  
  if (line2.length() > 0) {
    display.println(line2);
  }
  if (line3.length() > 0) {
    display.println(line3);
  }
  if (line4.length() > 0) {
    display.println();
    display.println(line4);
  }
  
  display.display();
}

// ==================== HEARTBEAT ====================
void publishHeartbeat() {
  JsonDocument doc;
  doc["lockerId"] = LOCKER_ID;
  doc["state"] = stateNames[currentState];
  doc["uptime"] = millis() / 1000;
  doc["wifiRSSI"] = WiFi.RSSI();
  doc["doorLocked"] = (digitalRead(SOLENOID_PIN) == LOW);
  doc["sessionActive"] = currentSession.isActive;
  doc["timestamp"] = millis();
  
  char buffer[256];
  serializeJson(doc, buffer);
  
  mqttClient.publish(topicHeartbeat.c_str(), buffer);
  Serial.println("💓 Heartbeat sent");
}

// ==================== STATUS ====================
void publishStatus() {
  JsonDocument doc;
  doc["lockerId"] = LOCKER_ID;
  doc["location"] = LOCKER_LOCATION;
  doc["state"] = stateNames[currentState];
  doc["doorLocked"] = (digitalRead(SOLENOID_PIN) == LOW);
  doc["sessionActive"] = currentSession.isActive;
  doc["uptime"] = millis() / 1000;
  doc["wifiConnected"] = (WiFi.status() == WL_CONNECTED);
  doc["wifiRSSI"] = WiFi.RSSI();
  doc["ipAddress"] = WiFi.localIP().toString();
  
  if (currentSession.isActive) {
    doc["sessionId"] = currentSession.sessionId;
    doc["reportId"] = currentSession.reportId;
    doc["userId"] = currentSession.userId;
  }
  
  char buffer[384];
  serializeJson(doc, buffer);
  
  mqttClient.publish(topicStatus.c_str(), buffer);
  Serial.println("📊 Status published");
}
