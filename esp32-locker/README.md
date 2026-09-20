# ESP32 Smart Locker Firmware

Complete firmware for Findora ESP32-based smart locker system.

## Features

- **WiFi Connectivity**: Automatic connection and reconnection
- **MQTT Communication**: Real-time bidirectional communication with backend
- **State Machine**: Robust state management (IDLE → DEPOSITING → OCCUPIED → UNLOCKED)
- **OTP Verification**: Secure 6-digit OTP for item collection
- **Solenoid Control**: Electromagnetic lock control with auto-timeout
- **OLED Display**: 128x64 display for user feedback
- **Heartbeat Monitoring**: 30-second health checks
- **Physical Button**: Manual control for maintenance
- **Session Management**: Track deposits and collections

## Hardware Requirements

### Core Components
- ESP32 Development Board (ESP32-DevKitC or similar)
- 12V Electromagnetic Solenoid Lock
- OLED Display (128x64, I2C, SSD1306)
- 5V Relay Module
- 12V Power Supply (2A minimum)
- Push Button (optional, for manual control)
- Breadboard and jumper wires

### Pin Connections

```
ESP32 GPIO → Component
---------------------------------
GPIO 25    → Relay IN (Solenoid control)
GPIO 2     → Built-in LED (status)
GPIO 34    → Push Button (pulled up)
GPIO 21    → OLED SDA (I2C data)
GPIO 22    → OLED SCL (I2C clock)
3.3V       → OLED VCC
GND        → OLED GND, Button GND

Relay Module → Solenoid
---------------------------------
Relay COM  → 12V Power Supply (+)
Relay NO   → Solenoid (+)
Solenoid (-)→ 12V Power Supply (-)
```

## Software Setup

### 1. Install PlatformIO

**VS Code (Recommended)**:
```bash
# Install PlatformIO extension in VS Code
# Search for "PlatformIO IDE" in extensions
```

**CLI**:
```bash
pip install platformio
```

### 2. Configure WiFi and MQTT

Edit `src/main.cpp`:

```cpp
// WiFi Credentials
const char* WIFI_SSID = "YourWiFiName";
const char* WIFI_PASSWORD = "YourWiFiPassword";

// MQTT Broker (default is public HiveMQ)
const char* MQTT_BROKER = "broker.hivemq.com";
const int MQTT_PORT = 1883;

// Locker Configuration
const char* LOCKER_ID = "locker-001";  // Change for each locker
const char* LOCKER_LOCATION = "Building A - Floor 1";
```

### 3. Build and Upload

```bash
# Navigate to esp32-locker directory
cd esp32-locker

# Build firmware
pio run

# Upload to ESP32
pio run --target upload

# Monitor serial output
pio device monitor
```

## MQTT Topics

### Published by ESP32

| Topic | Purpose | Frequency |
|-------|---------|-----------|
| `findora/locker/{id}/heartbeat` | Health status | Every 30s |
| `findora/locker/{id}/status` | Full state info | On change |
| `findora/locker/{id}/session` | Session events | On deposit/collection |
| `findora/locker/{id}/otp` | OTP verification | On OTP entry |

### Subscribed by ESP32

| Topic | Purpose | Payload |
|-------|---------|---------|
| `findora/locker/{id}/command` | Control commands | JSON (see below) |

## Command Payloads

### Start Deposit
```json
{
  "action": "deposit",
  "sessionId": "session-123",
  "reportId": "report-456",
  "userId": "user-789"
}
```

### Verify OTP
```json
{
  "action": "verify_otp",
  "otp": "123456"
}
```

### Manual Unlock
```json
{
  "action": "unlock"
}
```

### Manual Lock
```json
{
  "action": "lock"
}
```

### Cancel Session
```json
{
  "action": "cancel"
}
```

### Maintenance Mode
```json
{
  "action": "maintenance",
  "enable": true
}
```

### Request Status
```json
{
  "action": "status"
}
```

## State Machine

```
IDLE (door locked)
  ↓ [deposit command]
DEPOSITING (door unlocked for 5s)
  ↓ [door closes]
OCCUPIED (door locked, item stored)
  ↓ [valid OTP]
VERIFYING_OTP
  ↓ [OTP verified]
UNLOCKED (door unlocked for 5s)
  ↓ [timeout or manual lock]
IDLE (collection complete)
```

## Workflow Example

### Deposit Flow
1. Backend sends `deposit` command via MQTT
2. ESP32 changes state to `DEPOSITING`
3. Door unlocks for 5 seconds
4. User places item inside
5. Door auto-locks (or manual lock button)
6. State changes to `OCCUPIED`
7. ESP32 publishes session status

### Collection Flow
1. User enters OTP in mobile app
2. Backend sends `verify_otp` command via MQTT
3. ESP32 changes state to `VERIFYING_OTP`
4. Backend validates OTP
5. If valid, backend sends `unlock` command
6. ESP32 unlocks door for 5 seconds
7. User collects item
8. Door auto-locks
9. Session ends, state returns to `IDLE`

## Troubleshooting

### WiFi Connection Failed
- Check SSID and password
- Ensure 2.4GHz WiFi (ESP32 doesn't support 5GHz)
- Check signal strength

### MQTT Connection Failed
- Verify broker address and port
- Check firewall settings
- Try public broker: `broker.hivemq.com:1883`

### OLED Display Not Working
- Check I2C connections (SDA=GPIO21, SCL=GPIO22)
- Verify I2C address (default 0x3C)
- Test with I2C scanner sketch

### Solenoid Not Activating
- Check relay connections
- Verify 12V power supply
- Test relay with separate power source
- Check GPIO25 output with LED

### Serial Monitor Shows Gibberish
- Set baud rate to 115200
- Check USB cable quality

## Security Notes

- Change default MQTT broker for production
- Use TLS/SSL for MQTT in production
- Implement authentication for MQTT
- Store WiFi credentials securely
- Add tamper detection sensor
- Log all access attempts

## Performance

- **WiFi Connection**: ~5-10 seconds
- **MQTT Connection**: ~2-5 seconds
- **OTP Verification**: <1 second
- **Door Unlock**: Instant
- **Auto-lock Timeout**: 5 seconds
- **Heartbeat Interval**: 30 seconds
- **Memory Usage**: ~60KB RAM, ~500KB Flash

## Advanced Configuration

### Change Unlock Duration
```cpp
#define UNLOCK_DURATION 5000  // milliseconds (default: 5s)
```

### Change Heartbeat Interval
```cpp
#define HEARTBEAT_INTERVAL 30000  // milliseconds (default: 30s)
```

### Change OTP Timeout
```cpp
#define OTP_TIMEOUT 300000  // milliseconds (default: 5min)
```

### Custom OLED Messages
```cpp
updateDisplay("Line 1", "Line 2", "Line 3", "Line 4");
```

## License

Part of Findora Smart Lost & Found Ecosystem
