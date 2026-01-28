#include <WiFi.h>
#include <HTTPClient.h>
#include <TinyGPS++.h>
#include <HardwareSerial.h>
#include <LiquidCrystal_I2C.h>
#include <WiFiManager.h>
#include <Preferences.h>
#include <ArduinoJson.h>
#include <WebServer.h>
#include <ESPmDNS.h>
#include <Wire.h>

// Forward declarations for functions used before their definitions
void checkButtons();
void checkWiFiReset();
void sendAlert(const String &type);
void setupWiFi();
void openConfigPortalNonDestructive();
void startLocalWebServer();
String loginFormHtml(const String &msg);
void handleRoot();
void handleDeviceLogin();

// ---------------------- LCD ----------------------
LiquidCrystal_I2C lcd(0x27, 16, 2);

// ---------------------- GPS ----------------------
TinyGPSPlus gps;
HardwareSerial GPS_Serial(1);


// ---------------------- SERVER -------------------
String serverURL = "https://alertodepinbackend.onrender.com/api/alerts/iot";
// Explicit auth base to avoid brittle string manipulation
const String AUTH_BASE = "https://alertodepinbackend.onrender.com/api/auth";

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

// ---------------------- PREFERENCES ------------------
Preferences prefs;
const char* PREF_NAMESPACE = "alertodepin";
const char* PREF_USER_EMAIL = "user_email";
// Preference keys for stored token and last-known location
const char* PREF_USER_TOKEN = "user_token";
const char* PREF_LAST_LAT = "last_lat";
const char* PREF_LAST_LNG = "last_lng";

// Local web server
WebServer server(80);
bool localServerRunning = false;

// Device user info saved in prefs
String deviceUserEmail = "";
String deviceUserToken = "";

// Saved-location tracking
bool hasSavedLocation = false;
double lastSavedLat = 0.0;
double lastSavedLng = 0.0;
unsigned long lastSaveMillis = 0;

// Save thresholds
const unsigned long SAVE_MIN_INTERVAL_MS = 5 * 60 * 1000UL; // 5 minutes
const double SAVE_DISTANCE_THRESHOLD_M = 20.0; // 20 meters

// LCD update helpers
unsigned long lcdHoldUntil = 0;
unsigned long lastLcdUpdate = 0;
const unsigned long LCD_UPDATE_MS = 1000UL;
char lastLine0[17] = {0};
char lastLine1[17] = {0};

// Simple buzzer helper (blocking short tones)
void beep(int times, int onMs, int offMs) {
  for (int i = 0; i < times; ++i) {
    digitalWrite(BUZZER_PIN, HIGH);
    delay(onMs);
    digitalWrite(BUZZER_PIN, LOW);
    delay(offMs);
  }
}

// Haversine for meters between two lat/lngs
double haversineMeters(double lat1, double lon1, double lat2, double lon2) {
  const double R = 6371000.0; // earth radius in meters
  double dLat = (lat2 - lat1) * DEG_TO_RAD;
  double dLon = (lon2 - lon1) * DEG_TO_RAD;
  double a = sin(dLat/2) * sin(dLat/2) + cos(lat1*DEG_TO_RAD) * cos(lat2*DEG_TO_RAD) * sin(dLon/2) * sin(dLon/2);
  double c = 2 * atan2(sqrt(a), sqrt(1-a));
  return R * c;
}

// Persist current latitude/longitude as last-known location
void saveLastLocation() {
  prefs.begin(PREF_NAMESPACE, false);
  prefs.putString(PREF_LAST_LAT, String(latitude));
  prefs.putString(PREF_LAST_LNG, String(longitude));
  prefs.end();
  lastSavedLat = latitude;
  lastSavedLng = longitude;
  lastSaveMillis = millis();
  hasSavedLocation = true;
  Serial.printf("Saved last location: %0.6f,%0.6f\n", lastSavedLat, lastSavedLng);
}

void loadLastLocation() {
  prefs.begin(PREF_NAMESPACE, false);
  String sLat = prefs.getString(PREF_LAST_LAT, "");
  String sLng = prefs.getString(PREF_LAST_LNG, "");
  prefs.end();

  if (sLat.length() > 0 && sLng.length() > 0) {
    latitude = sLat.toDouble();
    longitude = sLng.toDouble();
    hasSavedLocation = true;
    // set last-saved trackers so we don't immediately rewrite the prefs
    lastSavedLat = latitude;
    lastSavedLng = longitude;
    lastSaveMillis = millis();
    Serial.printf("Loaded saved location: %0.6f, %0.6f\n", latitude, longitude);
  } else {
    hasSavedLocation = false;
    Serial.println("No saved location in prefs");
  }
}

// RTC printing removed.

// Simple I2C scanner: prints addresses to Serial and shows first found on the LCD
void scanI2CAndShow() {
  byte error, address;
  int nDevices = 0;
  for (address = 1; address < 127; address++) {
    Wire.beginTransmission(address);
    error = Wire.endTransmission();
    if (error == 0) {
      Serial.print("I2C device found at 0x");
      if (address < 16) Serial.print("0");
      Serial.print(address, HEX);
      Serial.print("  (dec ");
      Serial.print(address);
      Serial.println(")");
      // do not display raw address on the LCD (avoid showing "0x27 dec 39" style message)
      // keep output to Serial only for diagnostics
      nDevices++;
      delay(20);
    }
  }
  if (nDevices == 0) {
    Serial.println("No I2C devices found");
    // optionally inform briefly that no I2C devices found
    lcd.clear(); lcd.setCursor(0,0); lcd.print("I2C: none");
  } else {
    Serial.print(nDevices);
    Serial.println(" device(s) found");
  }
  delay(800);
  // keep LCD clear after initial scan (do not show address details)
  lcd.clear();
}

// Simple GPS diagnostic: echo raw GPS bytes and look for NMEA sentences
void gpsDiagnosticScan() {
  Serial.println("GPS diagnostic: scanning for NMEA sentences...");
  const int attempts = 2;
  int bauds[attempts] = {9600, 4800};
  bool found = false;

  for (int a = 0; a < attempts && !found; ++a) {
    int baud = bauds[a];
    Serial.print("Trying GPS baud: "); Serial.println(baud);
    // re-init GPS serial at the candidate baud (pins kept the same)
    GPS_Serial.begin(baud, SERIAL_8N1, 26, 27);

    unsigned long start = millis();
    String line = "";
    int nmeaCount = 0;

    while (millis() - start < 8000) {
      while (GPS_Serial.available()) {
        char c = (char)GPS_Serial.read();
        // echo raw bytes so the user can see them on the main Serial
        Serial.write(c);
        if (c == '\n') {
          // got a line, check if it starts with '$' (NMEA)
          if (line.length() > 0 && line.charAt(0) == '$') {
            Serial.print("\nNMEA: ");
            Serial.println(line);
            nmeaCount++;
            found = true;
          }
          line = "";
        } else if (c != '\r') {
          // accumulate (ignore CR)
          line += c;
          // keep line from growing too much
          if (line.length() > 120) line = line.substring(line.length() - 120);
        }
      }
      delay(10);
    }

    if (nmeaCount > 0) {
      Serial.print(nmeaCount);
      Serial.print(" NMEA sentence(s) found at ");
      Serial.print(baud);
      Serial.println(" baud");
      lcd.clear(); lcd.print("GPS: data OK");
      delay(900);
      lcd.clear();
    } else {
      Serial.print("No NMEA sentences at "); Serial.print(baud); Serial.println(" baud\n");
    }
  }

  if (!found) {
    Serial.println("GPS NMEA not detected on the tested baud rates.");
    lcd.clear(); lcd.print("GPS: no data");
    delay(1200);
    lcd.clear();
  }
}

// helper to clear a single LCD row without clearing whole display
void clearLcdRow(int row) {
  lcd.setCursor(0, row);
  for (int i = 0; i < 16; ++i) lcd.print(' ');
}

// Update the LCD no more frequently than LCD_UPDATE_MS and only when content changed
void updateLCD() {
  unsigned long now = millis();
  // honor an explicit hold so transient messages (e.g. Sent OK) remain visible
  if (millis() < lcdHoldUntil) return;
  if (now - lastLcdUpdate < LCD_UPDATE_MS) return;
  lastLcdUpdate = now;

  char line0[17] = {0};
  char line1[17] = {0};

  if (gpsHasFix) {
    // show latitude and longitude (shortened)
    snprintf(line0, sizeof(line0), "Lat:%7.4f", latitude);
    snprintf(line1, sizeof(line1), "Lon:%7.4f", longitude);
  } else if (hasSavedLocation) {
    // show the last-saved location when no current GPS fix is available
    snprintf(line0, sizeof(line0), "Last Lat:%7.4f", latitude);
    snprintf(line1, sizeof(line1), "Last Lon:%7.4f", longitude);
  } else {
    // No GPS and no saved location available
    snprintf(line0, sizeof(line0), "No GPS Fix");
    snprintf(line1, sizeof(line1), "Connect WiFi");
  }

  // Only redraw rows that changed
  if (strncmp(line0, lastLine0, 16) != 0) {
    clearLcdRow(0);
    lcd.setCursor(0, 0); lcd.print(line0);
    strncpy(lastLine0, line0, 16);
    lastLine0[16] = '\0';
  }
  if (strncmp(line1, lastLine1, 16) != 0) {
    clearLcdRow(1);
    lcd.setCursor(0, 1); lcd.print(line1);
    strncpy(lastLine1, line1, 16);
    lastLine1[16] = '\0';
  }
}

// ---------------------- LED STATUS --------------
void updateStatusLeds() {
  digitalWrite(LED_WIFI_PIN, WiFi.status() == WL_CONNECTED);
  digitalWrite(LED_GPS_PIN, gpsHasFix);
}

// NTP sync removed — device will not attempt to obtain wall-clock time via NTP.

// ---------------------- WIFI MANAGER ------------
void setupWiFi() {
  WiFiManager wm;

  // 🧪 DEBUG MODE — reduced for release builds
  wm.setDebugOutput(false);

  // Custom portal title
  wm.setTitle("AlertoDePin");

  lcd.clear(); lcd.print("WiFi Setup"); lcd.setCursor(0, 1); lcd.print("AlertoDePin");
  // Read stored prefs early so we can pre-fill the portal and hide inputs when not needed
  prefs.begin(PREF_NAMESPACE, false);
  String defaultEmail = prefs.getString(PREF_USER_EMAIL, "");
  String defaultToken = prefs.getString(PREF_USER_TOKEN, "");
  prefs.end();

  // Add a captive-portal input so users can enter their account email
  // Use stored values as defaults so the portal can hide unnecessary inputs
  WiFiManagerParameter custom_user_email("user_email", "Account Email (optional)", defaultEmail.c_str(), 64);
  WiFiManagerParameter custom_user_name("user_name", "Your Name (for register)", "", 64);
  WiFiManagerParameter custom_user_password("user_password", "Account Password", "", 64);
  WiFiManagerParameter custom_device_token("device_token", "Device Token (optional)", defaultToken.c_str(), 256);
  wm.addParameter(&custom_user_email);
  wm.addParameter(&custom_user_name);
  wm.addParameter(&custom_user_password);
  wm.addParameter(&custom_device_token);

  // 📲 AP name + password
  // Inject custom styling and improved UX into the captive portal so the portal reveals
  // account inputs when a network is selected and the labels/placeholders are clearer.
  const char* customHead = R"rawliteral(
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;600;800&display=swap" rel="stylesheet">
    <style>
      :root{--bg:#ffffff;--card:#fff;--muted:#64748b;--accent:#ef4444}
      body{font-family:Inter,system-ui,Segoe UI,Arial,sans-serif;margin:0;background:linear-gradient(180deg,#ffffff,#f8fbff 60%);color:#071133}
      .portal-wrap{max-width:640px;margin:18px auto;padding:16px}
      .brand{display:flex;align-items:center;gap:12px}
      .logo{width:56px;height:56px;border-radius:12px;background:linear-gradient(90deg,var(--accent),#dc2626);display:flex;align-items:center;justify-content:center;color:#fff;font-weight:800}
      .card{background:#fff;padding:14px;border-radius:12px;box-shadow:0 10px 30px rgba(2,6,23,0.06);margin-top:12px}
      .field-row{margin-bottom:12px}
      .portal-label{display:block;font-size:13px;color:#0b2545;margin-bottom:6px}
      input[type=text], input[type=password], input[type=email]{width:100%;padding:12px;border-radius:10px;border:1px solid #e6eef8;background:#fcfeff;font-size:15px}
      .controls{display:flex;gap:8px;flex-wrap:wrap;margin-top:10px}
      .btn{padding:10px 14px;border-radius:10px;background:var(--accent);color:#fff;border:none;font-weight:700;cursor:pointer}
      .btn.secondary{background:#fff;color:#1f2937;border:1px solid #e6eef8}
      .muted{color:var(--muted);font-size:13px}
      .linked-banner{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:12px;border-radius:10px;background:linear-gradient(90deg,var(--accent),#dc2626);color:#fff;margin-bottom:12px}
      @media (max-width:640px){.portal-wrap{margin:10px;padding:12px}}
    </style>
    <script>
      document.addEventListener('DOMContentLoaded', function(){
        try{
          // Find the inputs created by WiFiManager
          var inputs = {
            token: document.querySelector('input[name="device_token"]'),
            email: document.querySelector('input[name="user_email"]'),
            name: document.querySelector('input[name="user_name"]'),
            pass: document.querySelector('input[name="user_password"]'),
            ssid: document.querySelector('input[name="ssid"]') || document.querySelector('input#ssid'),
            psk: document.querySelector('input[name="psk"]') || document.querySelector('input#psk')
          };

          function rowOf(el){ if(!el) return null; return el.closest('tr') || el.parentElement || el; }
          function ensureLabel(el, text){ var r=rowOf(el); if(!r) return; var existing = r.querySelector('.portal-label'); if(!existing){ var l=document.createElement('label'); l.className='portal-label'; l.textContent=text; r.insertBefore(l, r.firstChild);} el.setAttribute('aria-label', text); }
          function hide(el){ var r=rowOf(el); if(r) r.style.display='none'; }
          function show(el){ var r=rowOf(el); if(r) r.style.display=''; }

          // Apply clear placeholders and labels
          if(inputs.email){ ensureLabel(inputs.email, 'Account Email (optional)'); inputs.email.placeholder='you@example.com'; }
          if(inputs.name){ ensureLabel(inputs.name, 'Full name (for register)'); inputs.name.placeholder='Juan Dela Cruz'; }
          if(inputs.pass){ ensureLabel(inputs.pass, 'Account Password'); inputs.pass.placeholder='Minimum 6 characters'; }
          if(inputs.token){ ensureLabel(inputs.token, 'Device Token (optional)'); inputs.token.placeholder='Paste device token (optional)'; }
          if(inputs.ssid){ ensureLabel(inputs.ssid, 'Network (SSID)'); if(inputs.ssid.placeholder==='') inputs.ssid.placeholder='Network (SSID)'; }
          if(inputs.psk){ ensureLabel(inputs.psk, 'Network Password'); if(inputs.psk.placeholder==='') inputs.psk.placeholder='Network password'; }

          // Hide token by default and show a friendly Paste token button
          if(inputs.token){ hide(inputs.token); var container = document.querySelector('.content') || document.body; var btnWrap = document.createElement('div'); btnWrap.className='controls'; var pasteBtn=document.createElement('button'); pasteBtn.type='button'; pasteBtn.className='btn secondary'; pasteBtn.textContent='Paste device token'; pasteBtn.addEventListener('click', function(){ show(inputs.token); pasteBtn.style.display='none'; inputs.token.focus(); }); btnWrap.appendChild(pasteBtn);
            // Unlink button
            var unlinkBtn=document.createElement('button'); unlinkBtn.type='button'; unlinkBtn.className='btn secondary'; unlinkBtn.textContent='Unlink device'; unlinkBtn.addEventListener('click', function(){ if(!confirm('Unlink device?')) return; inputs.token.value='__UNLINK__'; var f=document.querySelector('form'); if(f) f.submit(); }); btnWrap.appendChild(unlinkBtn);
            var insertBeforeEl = container.querySelector('table') || container.firstChild || container; if(insertBeforeEl && insertBeforeEl.parentNode) insertBeforeEl.parentNode.insertBefore(btnWrap, insertBeforeEl);
          }

          // Auto-reveal account inputs when SSID is selected
          function revealAccount(){ if(inputs.email) show(inputs.email); if(inputs.name) show(inputs.name); if(inputs.pass) show(inputs.pass); }
          if(inputs.ssid){ inputs.ssid.addEventListener('input', function(){ if(this.value && this.value.trim()) revealAccount(); }); document.addEventListener('click', function(){ setTimeout(function(){ if(inputs.ssid && inputs.ssid.value && inputs.ssid.value.trim()) revealAccount(); },50); }); }

          // If device token already present, hide account inputs and show linked banner
          if(inputs.token && inputs.token.value && inputs.token.value.trim().length>0){ if(inputs.email) hide(inputs.email); if(inputs.name) hide(inputs.name); if(inputs.pass) hide(inputs.pass); var c = document.querySelector('.content') || document.body; var banner=document.createElement('div'); banner.className='linked-banner'; var emailDisplay=(inputs.email && inputs.email.value)?inputs.email.value:'Linked (token)'; banner.innerHTML='<div><strong>Device linked</strong><div class="muted">'+emailDisplay+'</div></div><div><button id="_change" class="btn secondary">Change</button></div>'; if(c && c.firstChild) c.insertBefore(banner, c.firstChild); var change=document.getElementById('_change'); if(change){ change.addEventListener('click', function(){ if(inputs.email) show(inputs.email); if(inputs.name) show(inputs.name); if(inputs.pass) show(inputs.pass); if(pasteBtn) pasteBtn.style.display='inline-block'; banner.remove(); }); }
          }
        }catch(e){ console.warn('portal-ui init err', e); }
      });
    </script>
  )rawliteral";
  wm.setCustomHeadElement(customHead);

  bool res = wm.autoConnect("AlertoDePin", "12345678");

  if (!res) {
    lcd.clear(); lcd.print("WiFi Failed");
    beep(3, 200, 100);
    delay(3000);
    ESP.restart();
  }
  // Read portal inputs
  String enteredEmail = String(custom_user_email.getValue());
  String enteredPassword = String(custom_user_password.getValue());
  String enteredToken = String(custom_device_token.getValue());

  prefs.begin(PREF_NAMESPACE, false);
  // Special unlink marker: if the portal sent the magic value, clear stored token/email
  if (enteredToken == "__UNLINK__") {
    if (prefs.isKey(PREF_USER_TOKEN)) {
      prefs.remove(PREF_USER_TOKEN);
    }
    if (prefs.isKey(PREF_USER_EMAIL)) {
      prefs.remove(PREF_USER_EMAIL);
    }
    deviceUserToken = "";
    deviceUserEmail = "";
    Serial.println("Device unlinked via portal");
    lcd.clear(); lcd.print("Device unlinked"); delay(1200); lcd.clear();
  }
  // If user pasted a device token, prefer and save it
  else if (enteredToken.length() > 0) {
    prefs.putString(PREF_USER_TOKEN, enteredToken);
    deviceUserToken = enteredToken;
    Serial.println("Saved device token from portal");
    lcd.clear(); lcd.print("Token saved"); delay(1200); lcd.clear();
  } else if (enteredEmail.length() > 0 && enteredPassword.length() > 0) {
    // Attempt login to get JWT
    Serial.println("Attempting login from portal...");
    lcd.clear(); lcd.print("Logging in...");
    HTTPClient authHttp;
    String authUrl = AUTH_BASE + "/login";
    authHttp.begin(authUrl);
    authHttp.addHeader("Content-Type", "application/json");
    String body = "{\"email\":\"" + enteredEmail + "\",\"password\":\"" + enteredPassword + "\"}";
    int code = authHttp.POST(body);
    String resp = authHttp.getString();
    if (code == 200) {
      // parse JSON response for token
      DynamicJsonDocument doc(1024);
      DeserializationError err = deserializeJson(doc, resp);
      if (!err && doc.containsKey("token")) {
        String token = doc["token"].as<const char*>();
        prefs.putString(PREF_USER_TOKEN, token);
        deviceUserToken = token;
        Serial.println("Saved token from login");
        lcd.clear(); lcd.print("Login OK"); delay(1000); lcd.clear();
      } else {
        Serial.println("Login response parsing failed");
        lcd.clear(); lcd.print("Login parse err"); delay(1000); lcd.clear();
      }
    } else {
      Serial.println("Portal login failed, code: " + String(code));
      lcd.clear(); lcd.print("Login failed"); delay(1000); lcd.clear();
      // If login failed and user provided a name, attempt register
      String enteredName = String(custom_user_name.getValue());
      if (enteredName.length() > 0) {
        Serial.println("Attempting register from portal...");
        lcd.clear(); lcd.print("Registering...");
        HTTPClient regHttp;
        String regUrl = AUTH_BASE + "/register";
        regHttp.begin(regUrl);
        regHttp.addHeader("Content-Type", "application/json");
        String regBody = "{\"name\":\"" + enteredName + "\",\"email\":\"" + enteredEmail + "\",\"password\":\"" + enteredPassword + "\"}";
        int rcode = regHttp.POST(regBody);
        String rresp = regHttp.getString();
        if (rcode == 201) {
          DynamicJsonDocument rdoc(1024);
          DeserializationError rerr = deserializeJson(rdoc, rresp);
          if (!rerr && rdoc.containsKey("token")) {
            String token = rdoc["token"].as<const char*>();
            prefs.putString(PREF_USER_TOKEN, token);
            deviceUserToken = token;
            Serial.println("Saved token from register");
            lcd.clear(); lcd.print("Registered"); delay(1000); lcd.clear();
          }
        } else {
          Serial.println("Register failed, code: " + String(rcode));
          lcd.clear(); lcd.print("Reg failed"); delay(1000); lcd.clear();
        }
        regHttp.end();
      }
    }
    authHttp.end();
  }

  // Save email if provided (even if login failed)
  if (enteredEmail.length() > 0) {
    prefs.putString(PREF_USER_EMAIL, enteredEmail);
    deviceUserEmail = enteredEmail;
    Serial.println("Saved device user email: " + deviceUserEmail);
  }

  prefs.end();
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


// ---------------------- LOCAL SERVER HANDLERS ------------------
String loginFormHtml(const String &msg="") {
  String html = "<html><head><meta name='viewport' content='width=device-width,initial-scale=1'/><title>AlertoDePin Device Login</title>";
  html += "<style>body{font-family:Inter,Arial,sans-serif;background:#fff;color:#071133;padding:16px} .portal{max-width:640px;margin:18px auto} .brand{display:flex;align-items:center;gap:12px} .logo{width:56px;height:56px;border-radius:12px;background:linear-gradient(90deg,#EF4444,#DC2626);display:flex;align-items:center;justify-content:center;color:#fff;font-weight:800} .card{background:#fff;padding:16px;border-radius:12px;box-shadow:0 12px 40px rgba(2,6,23,0.06);margin-top:12px} label{display:block;margin-bottom:6px;color:#0b2545} input{width:100%;padding:10px;border-radius:8px;border:1px solid #f3d1d1;margin-bottom:10px} .btn{background:linear-gradient(90deg,#EF4444,#DC2626);color:#fff;padding:10px 14px;border-radius:8px;border:none;cursor:pointer} .linked{padding:10px;border-radius:8px;background:linear-gradient(90deg,#EF4444,#DC2626);color:#fff;display:flex;align-items:center;justify-content:space-between;margin-bottom:12px} .muted{color:#64748b;font-size:13px}</style>";
  // show logo + small subtitle (avoid repeating the site title)
  html += "</head><body><div class='portal'><div class='brand'><div class='logo'><svg width='28' height='28' viewBox='0 0 24 24' fill='none' xmlns='http://www.w3.org/2000/svg' aria-hidden='true'><path d='M12 2L1 21h22L12 2z' fill='white'/><path d='M11 8h2v5h-2z' fill='#ffe6e6'/><circle cx='12' cy='17' r='1.2' fill='#ffe6e6'/></svg></div><div><div style='font-weight:700;color:#071133'>AlertoDePin</div><div class='muted'>Device login & account</div></div></div>";

  // show optional message
  if (msg.length()) {
    html += "<div class='card' style='margin-top:12px;margin-bottom:12px'><strong>" + msg + "</strong></div>";
  }

  // Linked banner when token exists
  if (deviceUserToken.length() > 0) {
    String emailDisplay = deviceUserEmail.length() > 0 ? deviceUserEmail : "Linked (token)";
    html += "<div class='card'>";
    html += "<div class='linked'><div><strong>Device linked</strong><div class='muted'>" + emailDisplay + "</div></div><div style='display:flex;gap:8px'><button id='changeBtn' class='btn' style='background:#fff;color:#1f2937'>Change</button>";
    // unlink form
    html += "<form method='POST' action='/device-login' style='display:inline;margin:0;padding:0'><input type='hidden' name='unlink' value='1' /><button class='btn' type='submit' style='background:#fff;color:#9b1f1f'>Unlink</button></form></div></div>";
    // form starts hidden by default when token exists
    html += "<form id='loginForm' method='POST' action='/device-login' style='display:none;margin-top:12px'>";
  } else {
    html += "<div class='card'>";
    html += "<form id='loginForm' method='POST' action='/device-login' style='margin-top:6px'>";
  }

  // provide a small Paste-token toggle instead of showing the token field by default
  html += "<div style='margin-bottom:8px'><button id='pasteTokenBtn' class='btn' type='button' style='background:#fff;color:#1f2937'>Paste token</button></div>";
  html += "<div id='tokenRow' style='display:none;margin-bottom:8px'><label>Device Token (paste here)</label>";
  html += "<input name='token' placeholder='Paste device token (optional)' /></div>";
  html += "<label>Email</label>";
  html += "<input name='email' type='email' value='" + deviceUserEmail + "' placeholder='you@example.com' />";
  html += "<label>Password</label>";
  html += "<input name='password' type='password' value='' placeholder='Your account password' />";
  html += "<label>Name (for register)</label>";
  html += "<input name='name' value='' placeholder='Full name (for register)' />";
  html += "<div style='margin-top:8px'><button class='btn' type='submit'>Save / Login</button></div>";
  html += "</form></div>";

  html += "<p style='margin-top:10px' class='muted'>Device IP: " + WiFi.localIP().toString() + "</p>";

  // If token exists, add JS to reveal the form when user clicks Change
  // JS for Paste token toggle and Change button
  html += "<script>document.getElementById('pasteTokenBtn').addEventListener('click',function(e){e.preventDefault();document.getElementById('tokenRow').style.display='block'; this.style.display='none';});";
  if (deviceUserToken.length() > 0) {
    html += "document.getElementById('changeBtn').addEventListener('click',function(e){e.preventDefault();document.getElementById('loginForm').style.display='block';this.parentElement.parentElement.style.display='none';var pb=document.getElementById('pasteTokenBtn'); if(pb) pb.style.display='inline-block';});";
    // unlink confirm for local UI: intercept unlink form submit
    html += "(function(){ var unlinkInput = document.querySelector('input[name=\'unlink\']'); if(unlinkInput){ var f = unlinkInput.closest('form'); if(f){ f.addEventListener('submit', function(ev){ if(!confirm('Are you sure you want to unlink this device?')){ ev.preventDefault(); } }); } } })();";
  }
  html += "</script>";

  html += "</div></body></html>";
  return html;
}

void handleRoot() {
  server.send(200, "text/html", loginFormHtml());
}

void handleDeviceLogin() {
  String token = server.arg("token");
  String email = server.arg("email");
  String password = server.arg("password");
  String name = server.arg("name");
  String unlink = server.arg("unlink");

  prefs.begin(PREF_NAMESPACE, false);
  String msg = "";

  // handle explicit unlink request
  if (unlink.length() > 0 && unlink == "1") {
    if (prefs.isKey(PREF_USER_TOKEN)) prefs.remove(PREF_USER_TOKEN);
    if (prefs.isKey(PREF_USER_EMAIL)) prefs.remove(PREF_USER_EMAIL);
    deviceUserToken = "";
    deviceUserEmail = "";
    msg = "Device unlinked";
    Serial.println("Device unlinked via local web");
  }
  else if (token.length() > 0) {
    prefs.putString(PREF_USER_TOKEN, token);
    deviceUserToken = token;
    msg = "Token saved";
    Serial.println("Saved token via local web");
  } else if (email.length() > 0 && password.length() > 0) {
    // Try login
    HTTPClient authHttp;
    String authUrl = AUTH_BASE + "/login";
    authHttp.begin(authUrl);
    authHttp.addHeader("Content-Type", "application/json");
    String body = "{\"email\":\"" + email + "\",\"password\":\"" + password + "\"}";
    int code = authHttp.POST(body);
    String resp = authHttp.getString();
    if (code == 200) {
      DynamicJsonDocument doc(2048);
      DeserializationError err = deserializeJson(doc, resp);
      if (!err && doc.containsKey("token")) {
        String tok = doc["token"].as<const char*>();
        prefs.putString(PREF_USER_TOKEN, tok);
        deviceUserToken = tok;
        msg = "Login OK";
        Serial.println("Saved token from local login");
      } else {
        msg = "Login parse error";
      }
    } else {
      // Try register if name provided
      if (name.length() > 0) {
        HTTPClient regHttp;
        String regUrl = AUTH_BASE + "/register";
        regHttp.begin(regUrl);
        regHttp.addHeader("Content-Type", "application/json");
        String regBody = "{\"name\":\"" + name + "\",\"email\":\"" + email + "\",\"password\":\"" + password + "\"}";
        int rcode = regHttp.POST(regBody);
        String rresp = regHttp.getString();
        if (rcode == 201) {
          DynamicJsonDocument rdoc(2048);
          DeserializationError rerr = deserializeJson(rdoc, rresp);
          if (!rerr && rdoc.containsKey("token")) {
            String tok = rdoc["token"].as<const char*>();
            prefs.putString(PREF_USER_TOKEN, tok);
            deviceUserToken = tok;
            msg = "Registered & token saved";
            Serial.println("Saved token from local register");
          } else {
            msg = "Register parse error";
          }
        } else {
          msg = "Register failed: " + String(rcode);
        }
        regHttp.end();
      } else {
        msg = "Login failed: " + String(code);
      }
    }
    authHttp.end();
  }

  // save email locally if provided
  if (email.length() > 0) {
    prefs.putString(PREF_USER_EMAIL, email);
    deviceUserEmail = email;
  }
  prefs.end();

  server.send(200, "text/html", loginFormHtml(msg));
}

void startLocalWebServer() {
  if (localServerRunning) return;
  if (MDNS.begin("alertodepin")) {
    Serial.println("mDNS responder started: alertodepin.local");
  } else {
    Serial.println("mDNS start failed");
  }

  server.on("/", HTTP_GET, handleRoot);
  server.on("/device-login", HTTP_POST, handleDeviceLogin);
  server.begin();
  localServerRunning = true;
  Serial.println("Local web server started");
}

// Open a non-destructive config portal (short-press action)
void openConfigPortalNonDestructive() {
  WiFiManager wm;

  // read stored prefs to prefill portal
  prefs.begin(PREF_NAMESPACE, false);
  String defaultEmail = prefs.getString(PREF_USER_EMAIL, "");
  String defaultToken = prefs.getString(PREF_USER_TOKEN, "");
  prefs.end();

  WiFiManagerParameter custom_user_email("user_email", "Account Email (optional)", defaultEmail.c_str(), 64);
  WiFiManagerParameter custom_user_name("user_name", "Your Name (for register)", "", 64);
  WiFiManagerParameter custom_user_password("user_password", "Account Password", "", 64);
  WiFiManagerParameter custom_device_token("device_token", "Device Token (optional)", defaultToken.c_str(), 256);
  wm.addParameter(&custom_user_email);
  wm.addParameter(&custom_user_name);
  wm.addParameter(&custom_user_password);
  wm.addParameter(&custom_device_token);

  // reuse the same custom head injection used in setupWiFi to keep UX consistent
  const char* customHead = R"rawliteral(
    <style>
      :root{--bg:#ffffff;--card:#fff;--muted:#64748b;--accent:#ef4444}
      body{font-family:Inter,system-ui,Segoe UI,Arial,sans-serif;margin:0;background:#f6f8fb;color:#071133;padding:14px}
      .wrap{max-width:600px;margin:12px auto}
      .logo{display:flex;align-items:center;gap:10px;margin-bottom:8px}
      .dot{width:44px;height:44px;border-radius:8px;background:var(--accent);color:#fff;display:flex;align-items:center;justify-content:center;font-weight:700}
      .card{background:#fff;padding:12px;border-radius:10px;box-shadow:0 8px 24px rgba(2,6,23,0.06)}
      .field-row{margin-bottom:12px}
      .portal-label{display:block;font-size:13px;margin-bottom:6px;color:#213b5a}
      input{width:100%;padding:10px;border-radius:8px;border:1px solid #e6eef8;margin-top:6px;font-size:15px}
      .btn{display:inline-block;padding:10px 12px;border-radius:8px;background:var(--accent);color:#fff;border:none;font-weight:700;cursor:pointer;margin-top:10px}
      .btn.secondary{background:#fff;color:#1f2937;border:1px solid #e6eef8}
      .muted{font-size:13px;color:var(--muted);margin-top:8px}
      @media (max-width:480px){ .wrap{padding:8px} .dot{width:40px;height:40px} }
    </style>
    <script>
      document.addEventListener('DOMContentLoaded', function(){
        try{
          var inputs = {
            token: document.querySelector('input[name="device_token"]'),
            email: document.querySelector('input[name="user_email"]'),
            name: document.querySelector('input[name="user_name"]'),
            pass: document.querySelector('input[name="user_password"]'),
            ssid: document.querySelector('input[name="ssid"]') || document.querySelector('input#ssid'),
            psk: document.querySelector('input[name="psk"]') || document.querySelector('input#psk')
          };

          function rowOf(el){ if(!el) return null; return el.closest('tr')||el.parentElement||el; }
          function ensureLabel(el, text){ var r=rowOf(el); if(!r) return; var existing=r.querySelector('.portal-label'); if(!existing){ var l=document.createElement('label'); l.className='portal-label'; l.textContent=text; r.insertBefore(l, r.firstChild);} el.setAttribute('aria-label', text); }
          function hide(el){ var r=rowOf(el); if(r) r.style.display='none'; }
          function show(el){ var r=rowOf(el); if(r) r.style.display=''; }

          if(inputs.email){ ensureLabel(inputs.email, 'Account Email (optional)'); inputs.email.placeholder='you@example.com'; }
          if(inputs.name){ ensureLabel(inputs.name, 'Full name (for register)'); inputs.name.placeholder='Full name (for register)'; }
          if(inputs.pass){ ensureLabel(inputs.pass, 'Account Password'); inputs.pass.placeholder='Your account password'; }
          if(inputs.token){ ensureLabel(inputs.token, 'Device Token (optional)'); inputs.token.placeholder='Paste device token (optional)'; }
          if(inputs.ssid){ ensureLabel(inputs.ssid, 'Network (SSID)'); if(!inputs.ssid.placeholder) inputs.ssid.placeholder='Network (SSID)'; }
          if(inputs.psk){ ensureLabel(inputs.psk, 'Network Password'); if(!inputs.psk.placeholder) inputs.psk.placeholder='Network password'; }

          if(inputs.token){ hide(inputs.token); var container=document.querySelector('.content')||document.body; var controls=document.createElement('div'); controls.style.display='flex'; controls.style.gap='8px'; controls.style.flexWrap='wrap'; controls.style.marginTop='8px'; var pasteBtn=document.createElement('button'); pasteBtn.type='button'; pasteBtn.className='btn secondary'; pasteBtn.textContent='Paste token'; pasteBtn.addEventListener('click', function(){ show(inputs.token); pasteBtn.style.display='none'; inputs.token.focus(); }); controls.appendChild(pasteBtn); var unlinkBtn=document.createElement('button'); unlinkBtn.type='button'; unlinkBtn.className='btn secondary'; unlinkBtn.textContent='Unlink device'; unlinkBtn.addEventListener('click', function(){ if(!confirm('Are you sure you want to unlink this device?')) return; inputs.token.value='__UNLINK__'; var f=document.querySelector('form'); if(f) f.submit(); }); controls.appendChild(unlinkBtn); var insertBeforeEl = container.querySelector('table') || container.firstChild || container; if(insertBeforeEl && insertBeforeEl.parentNode) insertBeforeEl.parentNode.insertBefore(controls, insertBeforeEl); }

          function revealAccount(){ if(inputs.email) show(inputs.email); if(inputs.name) show(inputs.name); if(inputs.pass) show(inputs.pass); }
          if(inputs.ssid){ inputs.ssid.addEventListener('input', function(){ if(this.value && this.value.trim()) revealAccount(); }); document.addEventListener('click', function(){ setTimeout(function(){ if(inputs.ssid && inputs.ssid.value && inputs.ssid.value.trim()) revealAccount(); },50); }); }

          if(inputs.token && inputs.token.value && inputs.token.value.trim().length>0){ if(inputs.email) hide(inputs.email); if(inputs.name) hide(inputs.name); if(inputs.pass) hide(inputs.pass); var c=document.querySelector('.content')||document.body; var banner=document.createElement('div'); banner.className='linked-banner'; var emailDisplay=(inputs.email && inputs.email.value)?inputs.email.value:'Linked (token)'; banner.innerHTML='<div><strong>Device linked</strong><div class="muted">'+emailDisplay+'</div></div><div><button id="_change" class="btn secondary">Change</button></div>'; if(c && c.firstChild) c.insertBefore(banner, c.firstChild); var change=document.getElementById('_change'); if(change){ change.addEventListener('click', function(){ if(inputs.email) show(inputs.email); if(inputs.name) show(inputs.name); if(inputs.pass) show(inputs.pass); if(pasteBtn) pasteBtn.style.display='inline-block'; banner.remove(); }); }
          }
        }catch(e){ console.warn('portal-ui', e); }
      });
    </script>
  )rawliteral";
  wm.setCustomHeadElement(customHead);

  Serial.println("Opening config portal (non-destructive)");
  lcd.clear(); lcd.print("Open Portal"); lcd.setCursor(0,1); lcd.print("AlertoDePin");
  bool ok = wm.startConfigPortal("AlertoDePin","12345678");
  if (!ok) {
    Serial.println("Config portal failed or timed out");
    lcd.clear(); lcd.print("Portal failed"); delay(1000); lcd.clear();
    return;
  }

  // After portal closes, read parameter values and process like setupWiFi
  String enteredEmail = String(custom_user_email.getValue());
  String enteredPassword = String(custom_user_password.getValue());
  String enteredToken = String(custom_device_token.getValue());

  prefs.begin(PREF_NAMESPACE, false);
  if (enteredToken == "__UNLINK__") {
    if (prefs.isKey(PREF_USER_TOKEN)) prefs.remove(PREF_USER_TOKEN);
    if (prefs.isKey(PREF_USER_EMAIL)) prefs.remove(PREF_USER_EMAIL);
    deviceUserToken = ""; deviceUserEmail = "";
    Serial.println("Device unlinked via portal");
    lcd.clear(); lcd.print("Device unlinked"); delay(1200); lcd.clear();
  } else if (enteredToken.length() > 0) {
    prefs.putString(PREF_USER_TOKEN, enteredToken);
    deviceUserToken = enteredToken;
    Serial.println("Saved device token from portal (non-destructive)");
    lcd.clear(); lcd.print("Token saved"); delay(1200); lcd.clear();
  } else if (enteredEmail.length() > 0 && enteredPassword.length() > 0) {
    // attempt login/register same as setupWiFi
    HTTPClient authHttp;
    String authUrl = AUTH_BASE + "/login";
    authHttp.begin(authUrl);
    authHttp.addHeader("Content-Type", "application/json");
    String body = "{\"email\":\"" + enteredEmail + "\",\"password\":\"" + enteredPassword + "\"}";
    int code = authHttp.POST(body);
    String resp = authHttp.getString();
    if (code == 200) {
      DynamicJsonDocument doc(1024);
      DeserializationError err = deserializeJson(doc, resp);
      if (!err && doc.containsKey("token")) {
        String token = doc["token"].as<const char*>();
        prefs.putString(PREF_USER_TOKEN, token);
        deviceUserToken = token;
        Serial.println("Saved token from login");
        lcd.clear(); lcd.print("Login OK"); delay(1000); lcd.clear();
      }
    } else {
      String enteredName = String(custom_user_name.getValue());
      if (enteredName.length() > 0) {
        HTTPClient regHttp;
        String regUrl = AUTH_BASE + "/register";
        regHttp.begin(regUrl);
        regHttp.addHeader("Content-Type", "application/json");
        String regBody = "{\"name\":\"" + enteredName + "\",\"email\":\"" + enteredEmail + "\",\"password\":\"" + enteredPassword + "\"}";
        int rcode = regHttp.POST(regBody);
        String rresp = regHttp.getString();
        if (rcode == 201) {
          DynamicJsonDocument rdoc(1024);
          DeserializationError rerr = deserializeJson(rdoc, rresp);
          if (!rerr && rdoc.containsKey("token")) {
            String token = rdoc["token"].as<const char*>();
            prefs.putString(PREF_USER_TOKEN, token);
            deviceUserToken = token;
            Serial.println("Saved token from register");
            lcd.clear(); lcd.print("Registered"); delay(1000); lcd.clear();
          }
        }
        regHttp.end();
      }
    }
    authHttp.end();
  }

  if (enteredEmail.length() > 0) {
    prefs.putString(PREF_USER_EMAIL, enteredEmail);
    deviceUserEmail = enteredEmail;
  }
  prefs.end();

}

// ---------------------- SETUP -------------------
void setup() {
  Serial.begin(115200);
  Serial.println("ALERTODEPIN BOOT");

  // GPS serial: RX=26, TX=27 (adjust if your wiring differs)
  GPS_Serial.begin(9600, SERIAL_8N1, 26, 27);

  // Ensure I2C is initialized for the LCD backpack
  // Initialize I2C explicitly for ESP32 to avoid ambiguous pin mapping on some boards
  Wire.begin();
  delay(50); // allow bus to settle before LCD init

  // Probe common I2C addresses and instantiate the LCD object dynamically so
  // the sketch works with different expansion boards that use 0x27 or 0x3F.
  // Use the static LCD instance (address 0x27 by default).
  // This keeps behavior stable across expansion boards per user preference.
  lcd.init();
  lcd.backlight();

  // Quick boot test so users can confirm the display is working
  lcd.setCursor(0, 0);
  lcd.print("LCD init...");
  delay(800);
  lcd.clear();
  // Run a quick I2C scan and show first found address on the LCD
  scanI2CAndShow();

  pinMode(BTN_POLICE_PIN,   INPUT_PULLUP);
  pinMode(BTN_HOSPITAL_PIN, INPUT_PULLUP);
  pinMode(BTN_FIRE_PIN,     INPUT_PULLUP);
  pinMode(BTN_WIFI_RESET,   INPUT_PULLUP);

  // Initialize last button states from the pins to avoid detecting a
  // spurious press when the device powers up while a button is held.
  lastPoliceState   = digitalRead(BTN_POLICE_PIN);
  lastHospitalState = digitalRead(BTN_HOSPITAL_PIN);
  lastFireState     = digitalRead(BTN_FIRE_PIN);
  lastButtonTime = millis();
  wifiResetPressStart = 0;

  pinMode(LED_WIFI_PIN, OUTPUT);
  pinMode(LED_GPS_PIN,  OUTPUT);
  pinMode(BUZZER_PIN,   OUTPUT);

  // Load stored user email (if any)
  prefs.begin(PREF_NAMESPACE, false);
  deviceUserEmail = prefs.getString(PREF_USER_EMAIL, "");
  deviceUserToken = prefs.getString(PREF_USER_TOKEN, "");
  prefs.end();

  // Load previously-saved last-known GPS coordinates (if any)
  loadLastLocation();

  // RTC support removed; skipping RTC init.
  if (deviceUserEmail.length() > 0) {
    Serial.println("Loaded stored device user email: " + deviceUserEmail);
    lcd.clear();
    lcd.print("User:");
    lcd.setCursor(0,1);
    if (deviceUserEmail.length() > 16) {
      lcd.print(deviceUserEmail.substring(0,16));
    } else {
      lcd.print(deviceUserEmail);
    }
    delay(1200);
    lcd.clear();
  }

  setupWiFi();
  // NTP sync removed: skipping any attempt to obtain wall-clock time here
  // Start local web server so device is reachable both in STA and AP (portal) modes.
  // This ensures users can access the device IP (e.g., 192.168.4.1 when in AP)
  startLocalWebServer();
  // show the portal IP briefly on the LCD
  lcd.clear(); lcd.print("Portal: "); lcd.setCursor(0,1); lcd.print(WiFi.localIP().toString()); delay(1200); lcd.clear();
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

      if (gpsHasFix) {
        // compute movement since last saved location
        double dist = hasSavedLocation ? haversineMeters(lastSavedLat, lastSavedLng, latitude, longitude) : 1e9;
        unsigned long now = millis();
        bool timeOK = (now - lastSaveMillis) > SAVE_MIN_INTERVAL_MS;
        bool movedEnough = dist > SAVE_DISTANCE_THRESHOLD_M;
        if (!hasSavedLocation || movedEnough || timeOK) {
          saveLastLocation();
          Serial.printf("Saved location after move/time: dist=%.1fm timeOK=%d moved=%d\n", dist, timeOK ? 1 : 0, movedEnough ? 1 : 0);
        }
      }

      // RTC removed: no RTC sync here.
    }
  }

  static unsigned long lastGpsLog = 0;
  if (millis() - lastGpsLog > GPS_DEBUG_INTERVAL) {
    lastGpsLog = millis();
    Serial.print("GPS FIX: ");
    Serial.println(gpsHasFix ? "YES" : "NO");
  }

  updateStatusLeds();
  // NTP sync removed: no periodic NTP attempts
  checkButtons();
  checkWiFiReset();

  // Serve local web requests when running
  if (localServerRunning) {
    server.handleClient();
  }

  // Update LCD at a controlled rate to avoid flicker
  updateLCD();

  delay(200);

  // show token status briefly if user long-presses another button? (left as-is)
}

// ---------------------- WIFI RESET --------------
void checkWiFiReset() {
  int state = digitalRead(BTN_WIFI_RESET);
  if (state == LOW) {
    if (wifiResetPressStart == 0) wifiResetPressStart = millis();
  } else {
    if (wifiResetPressStart != 0) {
      unsigned long held = millis() - wifiResetPressStart;
      // short press -> open non-destructive portal
      if (held > 50 && held < WIFI_RESET_HOLD_MS) {
        Serial.println("Short press detected: open config portal");
        openConfigPortalNonDestructive();
      }
      // long press -> factory WiFi reset + remove token/email
      else if (held >= WIFI_RESET_HOLD_MS) {
        lcd.clear();
        lcd.print("WiFi Reset!");
        beep(4, 150, 80);
        // Clear stored WiFi credentials and stored user email
        WiFiManager wm;
        wm.resetSettings();
        prefs.begin(PREF_NAMESPACE, false);
        if (prefs.isKey(PREF_USER_EMAIL)) {
          prefs.remove(PREF_USER_EMAIL);
          Serial.println("Removed stored device user email");
        }
        if (prefs.isKey(PREF_USER_TOKEN)) {
          prefs.remove(PREF_USER_TOKEN);
          Serial.println("Removed stored device token");
        }
        prefs.end();
        delay(2000);
        ESP.restart();
      }
    }
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

  // Require WiFi. Allow sending if we have either a live GPS fix or a previously-saved location.
  if (WiFi.status() != WL_CONNECTED) {
    lcd.clear();
    lcd.print("WiFi ERR");
    beep(3, 100, 80);
    delay(1200);
    lcd.clear();
    return;
  }

  if (!(gpsHasFix || hasSavedLocation)) {
    lcd.clear();
    lcd.print("No location");
    beep(2, 100, 80);
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
  if (gpsHasFix) {
    lcd.print("Sending ");
    lcd.print(type);
  } else if (hasSavedLocation) {
    lcd.print("Sending (last) ");
    lcd.print(type);
  } else {
    lcd.print("Sending ");
    lcd.print(type);
  }

  // Prepare timestamp: prefer GPS time. NTP/RTC fallbacks removed.
  char tsbuf[32] = {0};
  bool clientHasTimestamp = false;
  if (gps.time.isValid() && gps.date.isValid()) {
    int y = gps.date.year();
    int m = gps.date.month();
    int d = gps.date.day();
    int hh = gps.time.hour();
    int mm = gps.time.minute();
    int ss = gps.time.second();
    snprintf(tsbuf, sizeof(tsbuf), "%04d-%02d-%02dT%02d:%02d:%02dZ", y, m, d, hh, mm, ss);
    clientHasTimestamp = true;
  }

  http.begin(serverURL);
  http.addHeader("Content-Type", "application/json");
  if (deviceUserToken.length() > 0) {
    http.addHeader("Authorization", "Bearer " + deviceUserToken);
  }

  // Build JSON payload using ArduinoJson
  String locSource = gpsHasFix ? "gps" : (hasSavedLocation ? "saved" : "unknown");
  DynamicJsonDocument doc(512);
  doc["type"] = type;
  doc["latitude"] = latitude;
  doc["longitude"] = longitude;
  doc["locationSource"] = locSource;
  doc["clientHasTimestamp"] = clientHasTimestamp;
  if (deviceUserEmail.length() > 0) doc["userEmail"] = deviceUserEmail;
  if (clientHasTimestamp) doc["timestamp"] = String(tsbuf);

  String payload;
  serializeJson(doc, payload);
  Serial.println(payload);

  int code = http.POST(payload);

  lcd.clear();
  if (code > 0 && (code == 201 || code == 200)) {
    if (gpsHasFix) {
      lcd.print("Sent OK");
    } else if (hasSavedLocation) {
      lcd.print("Sent (last)");
    } else {
      lcd.print("Sent OK");
    }
    beep(1, 150, 0);
  } else {
    // Generic server/connection error — keep last saved location and inform user
    lcd.print("Server down");
    lcd.setCursor(0,1);
    lcd.print("Please wait");
    beep(3, 120, 80);
  }

  // keep the sent/err message visible for a short time before allowing updates
  lcdHoldUntil = millis() + 4000UL; // 4 seconds
  // Force next LCD redraw after hold by clearing cached last-lines so updateLCD will refresh
  lastLine0[0] = '\0';
  lastLine1[0] = '\0';
  http.end();
}
