# ESP32 Smart Locker Setup Guide

## Hardware Requirements

### Components
- **ESP32 Development Board** (ESP32-DevKitC or similar)
- **12V Solenoid Lock** with relay module
- **0.96" OLED Display** (SSD1306, I2C)
- **5V Relay Module** (for solenoid control)
- **Passive Buzzer** (optional, for audio feedback)
- **LED Indicators** (optional)
- **Magnetic Door Sensor** (optional, for auto-detection)
- **12V Power Supply** (for solenoid)
- **Jumper Wires**
- **Breadboard** (for prototyping)

### Wiring Diagram

```
ESP32 Pin Connections:
┌─────────────────────────────────────────────────────┐
│ ESP32 Pin    │ Component        │ Notes            │
├──────────────┼──────────────────┼──────────────────┤
│ GPIO 21      │ OLED SDA         │ I2C Data         │
│ GPIO 22      │ OLED SCL         │ I2C Clock        │
│ GPIO 23      │ Relay IN         │ Solenoid Control │
│ GPIO 18      │ Buzzer           │ Audio Feedback   │
│ GPIO 19      │ Green LED        │ Status           │
│ GPIO 5       │ Red LED          │ Error/Locked     │
│ GPIO 4       │ Door Sensor      │ Magnetic Switch  │
│ 3.3V         │ OLED VCC         │ Power            │
│ GND          │ OLED GND         │ Ground           │
│ VIN (5V)     │ Relay VCC        │ Relay Power      │
│ GND          │ Relay GND        │ Ground           │
└─────────────────────────────────────────────────────┘

Relay Module:
- VCC → ESP32 VIN (5V)
- GND → ESP32 GND
- IN  → ESP32 GPIO 23
- COM → Solenoid (+)
- NO  → 12V Power Supply (+)

Solenoid:
- (+) → Relay COM
- (-) → 12V Power Supply (-)
```

## Software Setup

### 1. Install Arduino IDE
Download and install from: https://www.arduino.cc/en/software

### 2. Install ESP32 Board Support
1. Open Arduino IDE
2. Go to **File → Preferences**
3. Add to "Additional Board Manager URLs":
   ```
   https://raw.githubusercontent.com/espressif/arduino-esp32/gh-pages/package_esp32_index.json
   ```
4. Go to **Tools → Board → Boards Manager**
5. Search for "esp32" and install "esp32 by Espressif Systems"

### 3. Install Required Libraries
Go to **Sketch → Include Library → Manage Libraries** and install:
- **Adafruit SSD1306** (by Adafruit)
- **Adafruit GFX Library** (by Adafruit)
- **WiFi** (built-in with ESP32)
- **HTTPClient** (built-in with ESP32)
- **ArduinoJson** (by Benoit Blanchon)

## ESP32 Firmware Code

Create a new sketch and paste this code:

```cpp
#include <WiFi.h>
#include <HTTPClient.h>
#include <ArduinoJson.h>
#include <Wire.h>
#include <Adafruit_GFX.h>
#include <Adafruit_SSD1306.h>

// WiFi Configuration
const char* ssid = "YOUR_WIFI_SSID";
const char* password = "YOUR_WIFI_PASSWORD";

// Backend API Configuration
const char* apiUrl = "http://YOUR_BACKEND_IP:3001/api/lockers";
const char* lockerId = "locker-001"; // Change for each locker

// Pin Definitions
#define RELAY_PIN 23
#define BUZZER_PIN 18
#define LED_GREEN 19
#define LED_RED 5
#define DOOR_SENSOR 4

// OLED Display
#define SCREEN_WIDTH 128
#define SCREEN_HEIGHT 64
#define OLED_RESET -1
Adafruit_SSD1306 display(SCREEN_WIDTH, SCREEN_HEIGHT, &Wire, OLED_RESET);

// State Management
enum LockerState {
  AVAILABLE,
  RESERVED,
  ITEM_DEPOSITED,
  READY_FOR_COLLECTION,
  OPEN,
  COLLECTED,
  OFFLINE,
  ERROR_STATE
};

LockerState currentState = AVAILABLE;
String sessionId = "";
unsigned long lastHeartbeat = 0;
const unsigned long HEARTBEAT_INTERVAL = 30000; // 30 seconds

void setup() {
  Serial.begin(115200);
  
  // Initialize pins
  pinMode(RELAY_PIN, OUTPUT);
  pinMode(BUZZER_PIN, OUTPUT);
  pinMode(LED_GREEN, OUTPUT);
  pinMode(LED_RED, OUTPUT);
  pinMode(DOOR_SENSOR, INPUT_PULLUP);
  
  digitalWrite(RELAY_PIN, LOW); // Lock closed
  digitalWrite(LED_RED, HIGH);
  
  // Initialize OLED
  if(!display.begin(SSD1306_SWITCHCAPVCC, 0x3C)) {
    Serial.println(F("SSD1306 allocation failed"));
    for(;;);
  }
  
  display.clearDisplay();
  display.setTextSize(1);
  display.setTextColor(SSD1306_WHITE);
  display.setCursor(0, 0);
  display.println("Findora Locker");
  display.println("Initializing...");
  display.display();
  
  // Connect to WiFi
  connectWiFi();
  
  // Register locker with backend
  registerLocker();
  
  beep(2); // Ready signal
}

void loop() {
  // Send heartbeat
  if (millis() - lastHeartbeat > HEARTBEAT_INTERVAL) {
    sendHeartbeat();
    lastHeartbeat = millis();
  }
  
  // Check door sensor
  if (currentState == OPEN && isDoorClosed()) {
    delay(2000); // Wait 2 seconds
    if (isDoorClosed()) {
      lockDoor();
      currentState = COLLECTED;
      updateDisplay("Item Collected!", "Thank you!");
      sendStateUpdate("COLLECTED");
    }
  }
  
  // Update display based on state
  updateStatusDisplay();
  
  delay(1000);
}

void connectWiFi() {
  Serial.print("Connecting to WiFi");
  WiFi.begin(ssid, password);
  
  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }
  
  Serial.println("\nWiFi connected");
  Serial.print("IP: ");
  Serial.println(WiFi.localIP());
  
  updateDisplay("WiFi Connected", WiFi.localIP().toString().c_str());
  delay(2000);
}

void registerLocker() {
  if (WiFi.status() == WL_CONNECTED) {
    HTTPClient http;
    http.begin(String(apiUrl) + "/" + lockerId + "/heartbeat");
    http.addHeader("Content-Type", "application/json");
    
    StaticJsonDocument<200> doc;
    doc["state"] = "AVAILABLE";
    doc["firmwareVersion"] = "1.2.0";
    
    String jsonString;
    serializeJson(doc, jsonString);
    
    int httpCode = http.POST(jsonString);
    if (httpCode > 0) {
      Serial.println("Locker registered");
    }
    http.end();
  }
}

void sendHeartbeat() {
  if (WiFi.status() == WL_CONNECTED) {
    HTTPClient http;
    http.begin(String(apiUrl) + "/" + lockerId + "/heartbeat");
    http.addHeader("Content-Type", "application/json");
    
    StaticJsonDocument<200> doc;
    doc["state"] = stateToString(currentState);
    doc["firmwareVersion"] = "1.2.0";
    
    String jsonString;
    serializeJson(doc, jsonString);
    
    int httpCode = http.POST(jsonString);
    
    if (httpCode > 0) {
      String payload = http.getString();
      StaticJsonDocument<512> response;
      deserializeJson(response, payload);
      
      String command = response["command"];
      if (command == "UNLOCK") {
        unlockDoor();
      }
    }
    
    http.end();
  }
}

void sendStateUpdate(const char* state) {
  if (WiFi.status() == WL_CONNECTED) {
    HTTPClient http;
    http.begin(String(apiUrl) + "/" + lockerId + "/heartbeat");
    http.addHeader("Content-Type", "application/json");
    
    StaticJsonDocument<200> doc;
    doc["state"] = state;
    
    String jsonString;
    serializeJson(doc, jsonString);
    
    http.POST(jsonString);
    http.end();
  }
}

void unlockDoor() {
  digitalWrite(RELAY_PIN, HIGH); // Unlock
  digitalWrite(LED_GREEN, HIGH);
  digitalWrite(LED_RED, LOW);
  
  currentState = OPEN;
  updateDisplay("UNLOCKED!", "Collect your item");
  beep(3);
  
  // Auto-lock after 30 seconds if door not closed
  unsigned long unlockTime = millis();
  while (millis() - unlockTime < 30000) {
    if (isDoorClosed()) {
      delay(2000);
      if (isDoorClosed()) {
        lockDoor();
        return;
      }
    }
    delay(100);
  }
  
  lockDoor();
}

void lockDoor() {
  digitalWrite(RELAY_PIN, LOW); // Lock
  digitalWrite(LED_GREEN, LOW);
  digitalWrite(LED_RED, HIGH);
  beep(1);
}

bool isDoorClosed() {
  return digitalRead(DOOR_SENSOR) == LOW; // Magnetic sensor
}

void updateDisplay(const char* line1, const char* line2) {
  display.clearDisplay();
  display.setTextSize(2);
  display.setCursor(0, 10);
  display.println(line1);
  display.setTextSize(1);
  display.setCursor(0, 40);
  display.println(line2);
  display.display();
}

void updateStatusDisplay() {
  display.clearDisplay();
  display.setTextSize(1);
  display.setCursor(0, 0);
  display.println("Findora Locker");
  display.println(lockerId);
  display.println("");
  display.print("Status: ");
  display.println(stateToString(currentState));
  display.println("");
  display.print("WiFi: ");
  display.println(WiFi.RSSI());
  display.display();
}

void beep(int times) {
  for (int i = 0; i < times; i++) {
    digitalWrite(BUZZER_PIN, HIGH);
    delay(100);
    digitalWrite(BUZZER_PIN, LOW);
    delay(100);
  }
}

const char* stateToString(LockerState state) {
  switch(state) {
    case AVAILABLE: return "AVAILABLE";
    case RESERVED: return "RESERVED";
    case ITEM_DEPOSITED: return "ITEM_DEPOSITED";
    case READY_FOR_COLLECTION: return "READY_FOR_COLLECTION";
    case OPEN: return "OPEN";
    case COLLECTED: return "COLLECTED";
    case OFFLINE: return "OFFLINE";
    case ERROR_STATE: return "ERROR";
    default: return "UNKNOWN";
  }
}
```

## Configuration Steps

1. **Update WiFi Credentials**
   ```cpp
   const char* ssid = "YOUR_WIFI_SSID";
   const char* password = "YOUR_WIFI_PASSWORD";
   ```

2. **Update Backend URL**
   ```cpp
   const char* apiUrl = "http://192.168.1.100:3001/api/lockers";
   ```
   Replace `192.168.1.100` with your computer's local IP address.

3. **Set Unique Locker ID**
   ```cpp
   const char* lockerId = "locker-001";
   ```
   Each locker must have a unique ID matching the backend database.

4. **Select Board**
   - Go to **Tools → Board → ESP32 Arduino**
   - Select your ESP32 board (e.g., "ESP32 Dev Module")

5. **Upload Code**
   - Connect ESP32 via USB
   - Select correct **Port** under **Tools → Port**
   - Click **Upload** button

## Testing

### 1. Monitor Serial Output
Open **Tools → Serial Monitor** (115200 baud) to see:
- WiFi connection status
- IP address
- Heartbeat messages
- State changes

### 2. Backend Integration Test
The locker will appear in the admin dashboard at:
```
http://localhost:5173/admin
```

### 3. Full Workflow Test
1. Create a match on the platform
2. Select "Smart Locker" as return method
3. System assigns this locker
4. Locker state changes to RESERVED
5. Finder deposits item (simulated or physical button)
6. System generates OTP
7. Owner enters OTP on platform
8. Backend sends UNLOCK command
9. Locker unlocks automatically
10. Door sensor detects collection
11. Locker auto-locks and marks COLLECTED

## Troubleshooting

### WiFi Connection Issues
- Check SSID and password
- Ensure 2.4GHz WiFi (ESP32 doesn't support 5GHz)
- Move closer to router

### OLED Not Displaying
- Check I2C connections (SDA, SCL)
- Verify I2C address (0x3C or 0x3D)
- Test with I2C scanner sketch

### Solenoid Not Working
- Check relay connections
- Verify 12V power supply
- Test relay with manual HIGH/LOW signals

### Backend Communication Failed
- Verify backend URL and port
- Check firewall settings
- Ensure both devices on same network
- Test API endpoint with curl

### Door Sensor Issues
- Check magnetic alignment
- Verify INPUT_PULLUP configuration
- Test sensor with multimeter

## Advanced Features

### Multiple Lockers
Deploy multiple ESP32 units with different locker IDs:
```cpp
// Locker 1
const char* lockerId = "locker-001";

// Locker 2
const char* lockerId = "locker-002";
```

### HTTPS Support
For production, use WiFiClientSecure:
```cpp
#include <WiFiClientSecure.h>
WiFiClientSecure client;
client.setInsecure(); // For testing
```

### OTA Updates
Add OTA support for remote firmware updates:
```cpp
#include <ArduinoOTA.h>
ArduinoOTA.begin();
ArduinoOTA.handle(); // In loop()
```

## Safety & Security

- Always test with low-power solenoids first
- Use proper electrical isolation
- Implement backup manual unlock mechanism
- Monitor temperature and current draw
- Add overcurrent protection
- Secure physical access to ESP32
- Use HTTPS in production
- Implement authentication tokens

## Maintenance

- Clean magnetic sensors regularly
- Check solenoid alignment
- Monitor power supply voltage
- Update firmware periodically
- Check WiFi signal strength
- Review system logs

## Support

For issues:
1. Check Serial Monitor output
2. Verify hardware connections
3. Test individual components
4. Review backend logs
5. Contact support team

---

**Safety First:** Always test in a controlled environment before production deployment.
