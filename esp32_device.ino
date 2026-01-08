#include <WiFi.h>
#include <HTTPClient.h>
#include <TinyGPS++.h>
#include <HardwareSerial.h>
#include <LiquidCrystal_I2C.h>
#include <WiFiManager.h>

// ---------------------- LCD ----------------------
LiquidCrystal_I2C lcd(0x27, 16, 2);

// ---------------------- GPS ----------------------
TinyGPSPlus gps;
HardwareSerial GPS_Serial(1);

// ---------------------- SERVER -------------------
String serverURL = "https://alertodepinbackend.onrender.com/api/alerts/iot";

// ---------------------- BUTTONS ------------------
const int BTN_POLICE_PIN   = 32;
const int BTN_HOSPITAL_PIN = 33;
const int BTN_FIRE_PIN     = 25; // was BTN_CITIZEN_PIN

// 🔘 WiFi RESET BUTTON
const int BTN_WIFI_RESET   = 14;

// ---------------------- LEDS ---------------------
const int LED_WIFI_PIN = 2;
const int LED_GPS_PIN  = 4;

// ---------------------- BUZZER ------------------
const int BUZZER_PIN = 23;

// ---------------------- TIMING ------------------
const unsigned long DEBOUNCE_MS = 150;
const unsigned long GPS_DEBUG_INTERVAL = 2000;
const unsigned long WIFI_RESET_HOLD_MS = 5000;

// ---------------------- STATES ------------------
unsigned long lastButtonTime = 0;
unsigned long wifiResetPressStart = 0;

int lastPoliceState   = HIGH;
int lastHospitalState = HIGH;
int lastFireState     = HIGH;

double latitude  = 0.0;
double longitude = 0.0;

bool gpsHasFix = false;

// ---------------------- BUZZER ------------------
void beep(int times, int onMs, int offMs) {
  for (int i = 0; i < times; i++) {
    digitalWrite(BUZZER_PIN, HIGH);
    delay(onMs);
    digitalWrite(BUZZER_PIN, LOW);
    if (i < times - 1) delay(offMs);
  }
}

// ---------------------- LED STATUS --------------
void updateStatusLeds() {
  digitalWrite(LED_WIFI_PIN, WiFi.status() == WL_CONNECTED);
  digitalWrite(LED_GPS_PIN, gpsHasFix);
}

// ---------------------- WIFI MANAGER ------------
void setupWiFi() {
  WiFiManager wm;

  // 🧪 DEBUG MODE
  wm.setDebugOutput(true);

  // Custom portal title
  wm.setTitle("AlertoDePin");

  lcd.clear();
  lcd.print("WiFi Setup");
  lcd.setCursor(0, 1);
  lcd.print("AlertoDePin");

  // 📲 AP name + password
  // Inject custom styling into the captive portal to give it a premium look
  // WiFiManager will include this inside the <head> of the portal HTML
  const char* customHead = R"rawliteral(
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;600;800&display=swap" rel="stylesheet">
    <style>
      body { font-family: 'Inter', Arial, sans-serif; margin:0; background: #f6f9fc; color:#0f172a; }
      .wm-title { text-align:center; padding:28px 16px 8px; }
      .wm-title h1 { margin:0; font-size:24px; letter-spacing:0.4px; font-weight:700; color:#0b2545; }
      .wm-title p { margin:6px 0 0; color:#374151; opacity:0.9; }
      .wm-input { max-width:520px; margin:18px auto; padding:20px; background: #ffffff; border-radius:12px; box-shadow: 0 6px 18px rgba(15,23,42,0.08); border: 1px solid #e6eef8; }
      .wm-input label { display:block; font-size:13px; color:#0b2545; margin-bottom:6px; }
      .wm-input input[type=text], .wm-input input[type=password], .wm-input input[type=email] { width:100%; padding:12px 14px; border-radius:8px; border:1px solid #cbd5e1; background:#fff; color:#0b2545; }
      .wm-input input:focus { outline:none; box-shadow:0 6px 20px rgba(59,130,246,0.12); border-color: #3b82f6; }
      .wm-button { display:block; width:100%; padding:12px 16px; border-radius:10px; background:linear-gradient(90deg,#2563eb,#3b82f6); color:#ffffff; font-weight:700; border:none; box-shadow: 0 8px 20px rgba(37,99,235,0.12); cursor:pointer; }
      .wm-button:hover { opacity:0.95; }
      .wm-footer { text-align:center; margin-top:14px; font-size:12px; color:#64748b; opacity:0.95; }
      .qr-note { text-align:center; margin-top:12px; color:#0b2545; font-size:13px; }
      .wm-brand { padding:12px 8px; }
      .qr-block img { border-radius:8px; box-shadow: 0 6px 18px rgba(15,23,42,0.06); }
      @media (max-width:560px){ .wm-input{ margin:12px; padding:14px } .wm-title h1{ font-size:20px } }
    </style>
      <script>
        // Insert branded header and QR block into the portal body on load
        document.addEventListener('DOMContentLoaded', function() {
          try {
            var body = document.body;
            var header = document.createElement('div');
            header.className = 'wm-brand';
            header.innerHTML = '\n            <div style="text-align:center; padding:18px 12px;">\n              <div style="display:inline-flex; align-items:center; gap:12px;">\n                <div style="width:56px; height:56px; border-radius:12px; background:linear-gradient(90deg,#06b6d4,#3b82f6); display:flex; align-items:center; justify-content:center; box-shadow:0 8px 30px rgba(2,6,23,0.6);">\n                  <!-- Alert icon -->\n                  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">\n                    <path d="M1 21h22L12 2 1 21z" fill="#ffffff"/>\n                    <rect x="11" y="8" width="2" height="5" rx="1" fill="#0b2545"/>\n                    <circle cx="12" cy="17" r="1" fill="#0b2545"/>\n                  </svg>\n                </div>\n                <div style="text-align:left; color:#0b2545;">\n                  <div style="font-weight:700; font-size:18px;">AlertoDePin</div>\n                  <div style="font-size:13px; color:#374151; margin-top:4px;">Quick WiFi setup & device dashboard</div>\n                </div>\n              </div>\n            </div>';

            // Insert header at top
            if (body.firstChild) body.insertBefore(header, body.firstChild);

            // QR block
            var qrBlock = document.createElement('div');
            qrBlock.className = 'qr-block';
            qrBlock.style.textAlign = 'center';
            qrBlock.style.margin = '12px auto';
            qrBlock.style.maxWidth = '520px';
            qrBlock.innerHTML = '\n            <div style="display:flex; gap:12px; justify-content:center; flex-wrap:wrap; align-items:center;">\n              <div style="background:rgba(255,255,255,0.02); padding:10px; border-radius:10px;">\n                <div style="font-weight:700; color:#cfe5ff; margin-bottom:6px;">Open Portal</div>\n                <img src="https://api.qrserver.com/v1/create-qr-code/?size=160x160&data=http://192.168.4.1" alt="Portal QR">\n                <div style="font-size:12px; color:#a8d0ff; margin-top:6px;">http://192.168.4.1</div>\n              </div>\n              <div style="background:rgba(255,255,255,0.02); padding:10px; border-radius:10px;">\n                <div style="font-weight:700; color:#cfe5ff; margin-bottom:6px;">Open Dashboard</div>\n                <img src="https://api.qrserver.com/v1/create-qr-code/?size=160x160&data=https://alerto-de-pin-frontend.vercel.app" alt="Dashboard QR">\n                <div style="font-size:12px; color:#a8d0ff; margin-top:6px;">https://alerto-de-pin-frontend.vercel.app</div>\n              </div>\n            </div>';

            // Place QR block after the portal form container if available
            var container = document.querySelector('.content') || document.querySelector('#root') || document.body;
            container.appendChild(qrBlock);
          } catch (e) {
            console.warn('Custom portal injection failed', e);
          }
        });
      </script>
  )rawliteral";
  wm.setCustomHeadElement(customHead);

  bool res = wm.autoConnect("AlertoDePin", "12345678");

  if (!res) {
    lcd.clear();
    lcd.print("WiFi Failed");
    beep(3, 200, 100);
    delay(3000);
    ESP.restart();
  }

  // 📲 QR INFO (point to your frontend web app)
  Serial.println("WiFi Portal");
  Serial.println("SSID: AlertoDePin");
  Serial.println("PASS: 12345678");
  Serial.println("DASH: https://alerto-de-pin-frontend.vercel.app");
  Serial.println("QR:");
  Serial.println("https://alerto-de-pin-frontend.vercel.app");

  lcd.clear();
  lcd.print("WiFi Connected");
  beep(1, 150, 0);
  delay(1000);
  lcd.clear();
}

// ---------------------- SETUP -------------------
void setup() {
  Serial.begin(115200);
  Serial.println("ALERTODEPIN BOOT");

  // GPS serial: RX=26, TX=27 (adjust if your wiring differs)
  GPS_Serial.begin(9600, SERIAL_8N1, 26, 27);

  lcd.init();
  lcd.backlight();

  pinMode(BTN_POLICE_PIN,   INPUT_PULLUP);
  pinMode(BTN_HOSPITAL_PIN, INPUT_PULLUP);
  pinMode(BTN_FIRE_PIN,     INPUT_PULLUP);
  pinMode(BTN_WIFI_RESET,   INPUT_PULLUP);

  pinMode(LED_WIFI_PIN, OUTPUT);
  pinMode(LED_GPS_PIN,  OUTPUT);
  pinMode(BUZZER_PIN,   OUTPUT);

  setupWiFi();
}

// ---------------------- LOOP --------------------
void loop() {
  // ---- GPS READ ----
  while (GPS_Serial.available()) {
    gps.encode(GPS_Serial.read());
    if (gps.location.isUpdated()) {
      latitude  = gps.location.lat();
      longitude = gps.location.lng();
      gpsHasFix = gps.location.isValid();
    }
  }

  static unsigned long lastGpsLog = 0;
  if (millis() - lastGpsLog > GPS_DEBUG_INTERVAL) {
    lastGpsLog = millis();
    Serial.print("GPS FIX: ");
    Serial.println(gpsHasFix ? "YES" : "NO");
  }

  updateStatusLeds();
  checkButtons();
  checkWiFiReset();

  lcd.setCursor(0, 0);
  lcd.print("Lat:");
  lcd.print(latitude, 4);
  lcd.setCursor(0, 1);
  lcd.print("Lon:");
  lcd.print(longitude, 4);

  delay(150);
}

// ---------------------- WIFI RESET --------------
void checkWiFiReset() {
  if (digitalRead(BTN_WIFI_RESET) == LOW) {
    if (wifiResetPressStart == 0) {
      wifiResetPressStart = millis();
    } else if (millis() - wifiResetPressStart >= WIFI_RESET_HOLD_MS) {
      lcd.clear();
      lcd.print("WiFi Reset!");
      beep(4, 150, 80);
      WiFiManager wm;
      wm.resetSettings();
      delay(2000);
      ESP.restart();
    }
  } else {
    wifiResetPressStart = 0;
  }
}

// ---------------------- BUTTON HANDLER ----------
void checkButtons() {
  unsigned long now = millis();
  if (now - lastButtonTime < DEBOUNCE_MS) return;

  int p = digitalRead(BTN_POLICE_PIN);
  int h = digitalRead(BTN_HOSPITAL_PIN);
  int f = digitalRead(BTN_FIRE_PIN);

  bool policePressed   = lastPoliceState   == HIGH && p == LOW;
  bool hospitalPressed = lastHospitalState == HIGH && h == LOW;
  bool firePressed     = lastFireState     == HIGH && f == LOW;

  lastPoliceState   = p;
  lastHospitalState = h;
  lastFireState     = f;

  if (!policePressed && !hospitalPressed && !firePressed) return;
  lastButtonTime = now;

  if (!gpsHasFix || WiFi.status() != WL_CONNECTED) {
    lcd.clear();
    lcd.print("GPS/WiFi ERR");
    beep(3, 100, 80);
    delay(1200);
    lcd.clear();
    return;
  }

  if (policePressed)   sendAlert("police");
  if (hospitalPressed) sendAlert("hospital");
  if (firePressed)     sendAlert("fire");
}

// ---------------------- SEND ALERT --------------
void sendAlert(const String &type) {
  HTTPClient http;

  lcd.clear();
  lcd.print("Sending ");
  lcd.print(type);

  http.begin(serverURL);
  http.addHeader("Content-Type", "application/json");

  String payload =
    "{\"type\":\"" + type + "\"," \
    "\"latitude\": " + String(latitude, 6) + "," \
    "\"longitude\": " + String(longitude, 6) + "}";

  Serial.println(payload);

  int code = http.POST(payload);

  lcd.clear();
  if (code == 201 || code == 200) {
    lcd.print("Sent OK");
    beep(1, 150, 0);
  } else {
    lcd.print("ERR ");
    lcd.print(code);
    beep(3, 120, 80);
  }

  delay(1500);
  lcd.clear();
  http.end();
}
