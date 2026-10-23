#include <WiFi.h>
#include <HTTPClient.h>
#include <Wire.h>
#include <LiquidCrystal_I2C.h>
#include <Keypad.h>

// ============================================================
//                 SMART LOST & FOUND LOCKER
//                 ESP32 MAIN FIRMWARE
// ============================================================

// ============================================================
//                         WIFI
// ============================================================

const char* WIFI_SSID = "LOST&FOUND";
const char* WIFI_PASSWORD = "11111111";

// IMPORTANT:
// Your laptop's current IP on LOST&FOUND WiFi
const char* SERVER_URL = "http://10.30.104.71:8000";

// ============================================================
//                       OTP API
// ============================================================

const char* VERIFY_ENDPOINT = "/api/v1/box/verify-otp";
const char* BOX_ID = "BOX001";

// ============================================================
//                         LCD
// ============================================================

#define LCD_ADDRESS 0x27

LiquidCrystal_I2C lcd(LCD_ADDRESS, 16, 2);

// ============================================================
//                       KEYPAD 4x4
// ============================================================

const byte ROWS = 4;
const byte COLS = 4;

/*
   Physical keypad mapping based on your testing.
*/

char keys[ROWS][COLS] =
{
  {'D', 'C', 'B', 'A'},
  {'#', '9', '6', '3'},
  {'0', '8', '5', '2'},
  {'*', '7', '4', '1'}
};

// ============================================================
//                     KEYPAD PIN CONNECTIONS
// ============================================================

byte rowPins[ROWS] =
{
  13,
  14,
  27,
  26
};

byte colPins[COLS] =
{
  25,
  33,
  32,
  23
};

Keypad keypad = Keypad(
  makeKeymap(keys),
  rowPins,
  colPins,
  ROWS,
  COLS
);

// ============================================================
//                    SOLENOID CONTROL
// ============================================================

#define SOLENOID_PIN 18

// HIGH = MOSFET ON = Solenoid ON = UNLOCK
// LOW  = MOSFET OFF = Solenoid OFF = LOCK

#define SOLENOID_ON HIGH
#define SOLENOID_OFF LOW

const unsigned long UNLOCK_TIME = 5000;

// ============================================================
//                       OTP SETTINGS
// ============================================================

String enteredOTP = "";
const int OTP_LENGTH = 6;

// ============================================================
//                  FUNCTION DECLARATIONS
// ============================================================

void connectWiFi();
void showHomeScreen();
void processKey(char key);
void verifyOTP();
void clearOTP();
bool verifyOTPWithServer(const String& otp);
void unlockBox();
void lockBox();

// ============================================================
//                           SETUP
// ============================================================

void setup()
{
  Serial.begin(115200);
  delay(500);

  Serial.println();
  Serial.println("=================================");
  Serial.println("      SMART LOST & FOUND");
  Serial.println("      ESP32 LOCKER CONTROLLER");
  Serial.println("=================================");

  // ==========================================================
  // LCD
  // ==========================================================

  Wire.begin(21, 22);
  lcd.init();
  lcd.backlight();
  lcd.clear();
  lcd.setCursor(0, 0);
  lcd.print("SMART LOST&FOUND");
  lcd.setCursor(0, 1);
  lcd.print("Starting...");

  delay(2000);

  // ==========================================================
  // SOLENOID
  // ==========================================================

  pinMode(SOLENOID_PIN, OUTPUT);
  digitalWrite(SOLENOID_PIN, SOLENOID_OFF);
  Serial.println("Solenoid initialized: OFF");

  // ==========================================================
  // WIFI
  // ==========================================================

  connectWiFi();

  // ==========================================================
  // HOME SCREEN
  // ==========================================================

  showHomeScreen();
}

// ============================================================
//                            LOOP
// ============================================================

void loop()
{
  char key = keypad.getKey();

  if (key)
  {
    Serial.print("Key pressed: ");
    Serial.println(key);
    processKey(key);
  }

  if (WiFi.status() != WL_CONNECTED)
  {
    Serial.println("WiFi disconnected. Reconnecting...");
    WiFi.reconnect();
    delay(500);
  }
}

// ============================================================
//                    WIFI CONNECTION
// ============================================================

void connectWiFi()
{
  lcd.clear();
  lcd.setCursor(0, 0);
  lcd.print("Connecting WiFi");
  lcd.setCursor(0, 1);
  lcd.print("Please wait...");

  Serial.println();
  Serial.print("Connecting to WiFi: ");
  Serial.println(WIFI_SSID);

  WiFi.mode(WIFI_STA);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);

  int attempts = 0;
  while (WiFi.status() != WL_CONNECTED && attempts < 30)
  {
    delay(500);
    Serial.print(".");
    attempts++;
  }

  Serial.println();

  if (WiFi.status() == WL_CONNECTED)
  {
    Serial.println("WiFi connected!");
    Serial.print("ESP32 IP: ");
    Serial.println(WiFi.localIP());

    lcd.clear();
    lcd.setCursor(0, 0);
    lcd.print("WiFi Connected");
    lcd.setCursor(0, 1);
    lcd.print(WiFi.localIP());

    delay(2000);
  }
  else
  {
    Serial.println("WiFi connection FAILED");

    lcd.clear();
    lcd.setCursor(0, 0);
    lcd.print("WiFi Failed");
    lcd.setCursor(0, 1);
    lcd.print("Check Settings");

    delay(2000);
  }
}

// ============================================================
//                       HOME SCREEN
// ============================================================

void showHomeScreen()
{
  enteredOTP = "";

  lcd.clear();
  lcd.setCursor(0, 0);
  lcd.print("SMART LOST&FOUND");
  lcd.setCursor(0, 1);
  lcd.print("Enter OTP:");

  Serial.println();
  Serial.println("--------------------------------");
  Serial.println("SMART LOST & FOUND LOCKER READY");
  Serial.println("Enter 6 digit OTP");
  Serial.println("* = Clear");
  Serial.println("# = Submit");
  Serial.println("--------------------------------");
}

// ============================================================
//                       KEY PROCESSING
// ============================================================

void processKey(char key)
{
  if (key == '*')
  {
    clearOTP();
    return;
  }

  if (key == '#')
  {
    if (enteredOTP.length() == OTP_LENGTH)
    {
      verifyOTP();
    }
    else
    {
      lcd.clear();
      lcd.setCursor(0, 0);
      lcd.print("OTP must be");
      lcd.setCursor(0, 1);
      lcd.print("6 digits!");

      Serial.println("OTP must contain 6 digits.");
      delay(1500);
      showHomeScreen();
    }
    return;
  }

  if (key >= '0' && key <= '9')
  {
    if (enteredOTP.length() < OTP_LENGTH)
    {
      enteredOTP += key;
      int position = enteredOTP.length() - 1;

      lcd.setCursor(10 + position, 1);
      lcd.print("*");

      Serial.print("OTP: ");
      for (unsigned int i = 0; i < enteredOTP.length(); i++)
      {
        Serial.print("*");
      }
      Serial.println();
    }
  }
}

// ============================================================
//                         CLEAR OTP
// ============================================================

void clearOTP()
{
  enteredOTP = "";
  lcd.setCursor(0, 1);
  lcd.print("Enter OTP:      ");
  Serial.println("OTP cleared");
}

// ============================================================
//                       VERIFY OTP
// ============================================================

void verifyOTP()
{
  Serial.println();
  Serial.println("=================================");
  Serial.println("          VERIFYING OTP");
  Serial.println("=================================");

  lcd.clear();
  lcd.setCursor(0, 0);
  lcd.print("VERIFYING OTP...");
  lcd.setCursor(0, 1);
  lcd.print("Please wait");

  bool success = verifyOTPWithServer(enteredOTP);

  if (success)
  {
    Serial.println("OTP SUCCESS!");

    lcd.clear();
    lcd.setCursor(0, 0);
    lcd.print("ACCESS GRANTED");
    lcd.setCursor(0, 1);
    lcd.print("Opening locker");

    delay(1000);

    unlockBox();
    delay(UNLOCK_TIME);
    lockBox();

    lcd.clear();
    lcd.setCursor(0, 0);
    lcd.print("ITEM RETRIEVED");
    lcd.setCursor(0, 1);
    lcd.print("Locker Locked");

    delay(2500);
  }
  else
  {
    Serial.println("OTP FAILED!");

    lcd.clear();
    lcd.setCursor(0, 0);
    lcd.print("ACCESS DENIED");
    lcd.setCursor(0, 1);
    lcd.print("Invalid OTP");

    delay(2000);
  }

  showHomeScreen();
}

// ============================================================
//                VERIFY OTP WITH BACKEND
// ============================================================

bool verifyOTPWithServer(const String& otp)
{
  if (WiFi.status() != WL_CONNECTED)
  {
    Serial.println("WiFi disconnected!");
    connectWiFi();
    if (WiFi.status() != WL_CONNECTED)
    {
      Serial.println("Cannot verify OTP: WiFi unavailable.");
      return false;
    }
  }

  HTTPClient http;
  WiFiClient client;

  String url = String(SERVER_URL) + VERIFY_ENDPOINT;
  Serial.print("POST URL: ");
  Serial.println(url);

  String jsonBody = "{\"box_id\":\"" + String(BOX_ID) + "\",\"otp_code\":\"" + otp + "\"}";
  Serial.print("Request: ");
  Serial.println(jsonBody);

  http.begin(client, url);
  http.addHeader("Content-Type", "application/json");
  http.setTimeout(8000);

  int httpCode = http.POST(jsonBody);
  Serial.print("HTTP Code: ");
  Serial.println(httpCode);

  bool isSuccess = false;

  if (httpCode > 0)
  {
    String response = http.getString();
    Serial.println("Server response:");
    Serial.println(response);

    if (response.indexOf("\"success\":true") >= 0 || response.indexOf("\"success\": true") >= 0)
    {
      isSuccess = true;
    }
  }
  else
  {
    Serial.print("HTTP request failed: ");
    Serial.println(http.errorToString(httpCode));
  }

  http.end();
  client.stop(); // Cleanly close socket
  delay(50);

  return isSuccess;
}

// ============================================================
//                       UNLOCK LOCKER
// ============================================================

void unlockBox()
{
  Serial.println();
  Serial.println("=================================");
  Serial.println("       UNLOCKING LOCKER");
  Serial.println("=================================");

  digitalWrite(SOLENOID_PIN, SOLENOID_ON);
  Serial.println("GPIO18 = HIGH");
  Serial.println("MOSFET = ON");
  Serial.println("SOLENOID = ON");
  Serial.println("LOCKER UNLOCKED");
}

// ============================================================
//                        LOCK LOCKER
// ============================================================

void lockBox()
{
  Serial.println();
  Serial.println("=================================");
  Serial.println("         LOCKING LOCKER");
  Serial.println("=================================");

  digitalWrite(SOLENOID_PIN, SOLENOID_OFF);
  Serial.println("GPIO18 = LOW");
  Serial.println("MOSFET = OFF");
  Serial.println("SOLENOID = OFF");
  Serial.println("LOCKER LOCKED");
}
