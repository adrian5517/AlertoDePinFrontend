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

// ---------------------- LCD ----------------------
LiquidCrystal_I2C lcd(0x27, 16, 2);

// ---------------------- GPS ----------------------
TinyGPSPlus gps;
HardwareSerial GPS_Serial(1);

// ---------------------- SERVER -------------------
String serverURL = "https://alertodepinbackend.onrender.com/api/alerts/iot-protected";
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
const char* PREF_USER_TOKEN = "user_token";
String deviceUserEmail = "";
String deviceUserToken = "";

// ---------------------- LOCAL WEB SERVER ------------------
WebServer server(80);
bool localServerRunning = false;

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
  // Inject custom styling into the captive portal to give it a premium look
  // WiFiManager will include this inside the <head> of the portal HTML
  const char* customHead = R"rawliteral(
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;600;800&display=swap" rel="stylesheet">
    <style>
      :root{--bg:#ffffff;--card:#fff;--muted:#9aa8bf;--accent1:#EF4444;--accent2:#DC2626}
      body{font-family:Inter,system-ui,Segoe UI,Arial,sans-serif;margin:0;background:linear-gradient(180deg,#ffffff,#f8fbff 60%);color:#0b2545}
      .portal-wrap{max-width:640px;margin:28px auto;padding:18px}
      .brand{display:flex;align-items:center;gap:12px}
      .brand .logo{width:64px;height:64px;border-radius:12px;background:linear-gradient(90deg,var(--accent1),var(--accent2));display:flex;align-items:center;justify-content:center;box-shadow:0 12px 30px rgba(2,6,23,0.12)}
      .brand h1{margin:0;font-size:20px;color:#071133}
      .card{background:#fff;padding:18px;border-radius:12px;box-shadow:0 12px 40px rgba(15,23,42,0.06);margin-top:14px}
      label{display:block;font-size:13px;color:#0b2545;margin-bottom:6px}
      input[type=text], input[type=password], input[type=email]{width:100%;padding:12px;border-radius:10px;border:1px solid #e6eef8;background:#fcfeff}
      .primary{display:inline-block;padding:10px 14px;border-radius:10px;background:linear-gradient(90deg,var(--accent1),var(--accent2));color:#fff;border:none;font-weight:700;cursor:pointer}
      .muted{color:var(--muted);font-size:13px}
      .linked-banner{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:10px;border-radius:10px;background:linear-gradient(90deg,var(--accent1),var(--accent2));color:#fff;margin-bottom:12px}
      .small{font-size:13px;color:#0b2545}
      @media (max-width:640px){.portal-wrap{margin:12px;padding:12px}}    
    </style>
    <script>
      document.addEventListener('DOMContentLoaded', function(){
        try{
          // Grab the portal inputs rendered by WiFiManager
          var tokenInput = document.querySelector('input[name="device_token"]');
          var emailInput = document.querySelector('input[name="user_email"]');
          var nameInput = document.querySelector('input[name="user_name"]');
          var passInput = document.querySelector('input[name="user_password"]');

          // Helper to find the row or wrapper for WiFiManager's input
          function rowOf(el){ if(!el) return null; return el.closest('tr') || el.parentElement || el; }
          function hideEl(el){ var r = rowOf(el); if(r) r.style.display='none'; }
          function showEl(el){ var r = rowOf(el); if(r) r.style.display='table-row' || 'block'; }

          // Add helpful placeholders for clarity
          if(emailInput) emailInput.placeholder = 'you@example.com';
          if(passInput) passInput.placeholder = 'Your account password';
          if(nameInput) nameInput.placeholder = 'Full name (for register)';
          if(tokenInput) tokenInput.placeholder = 'Paste device token (optional)';

          // Move token input out of the main flow and hide it by default; provide a small toggle to reveal it
          if(tokenInput){
            // hide the token input row initially
            hideEl(tokenInput);
            var container = document.querySelector('.content') || document.body;
            var pasteBtn = document.createElement('button');
            pasteBtn.type = 'button';
            pasteBtn.textContent = 'Paste token';
            pasteBtn.className = 'primary';
            pasteBtn.style.margin = '8px 0';
            pasteBtn.addEventListener('click', function(){ showEl(tokenInput); pasteBtn.style.display='none'; tokenInput.focus(); });
            // insert the button near the top of the portal content
            var insertBeforeEl = container.querySelector('table') || container.firstChild || container;
            insertBeforeEl.parentNode.insertBefore(pasteBtn, insertBeforeEl);
            // add an Unlink button for the captive portal that will submit a special value
            var unlinkBtn = document.createElement('button');
            unlinkBtn.type = 'button';
            unlinkBtn.textContent = 'Unlink device';
            unlinkBtn.className = 'primary';
            unlinkBtn.style.margin = '8px 8px';
            unlinkBtn.style.background = '#fff';
            unlinkBtn.style.color = '#9b1f1f';
            unlinkBtn.addEventListener('click', function(){
              try {
                if (!confirm('Are you sure you want to unlink this device?')) return;
                // set special unlink marker and submit the form
                if(tokenInput) tokenInput.value = '__UNLINK__';
                var f = document.querySelector('form'); if(f) f.submit();
              } catch (e) { console.warn('unlink submit failed', e); }
            });
            insertBeforeEl.parentNode.insertBefore(unlinkBtn, insertBeforeEl);
          }

          // If the device already has a saved token (prefilled by code), show a linked banner and collapse account inputs
          if(tokenInput && tokenInput.value && tokenInput.value.trim().length>0){
            hideEl(emailInput); hideEl(nameInput); hideEl(passInput);
            var container = document.querySelector('.content') || document.body;
            var banner = document.createElement('div');
            banner.className = 'linked-banner';
            banner.innerHTML = '<div><strong>Device linked</strong><div class="muted">Using saved token</div></div><div><button id="_change" class="primary" style="background:#fff;color:#1f2937;">Change</button></div>';
            container.insertBefore(banner, container.firstChild);
            document.getElementById('_change').addEventListener('click', function(){
              // reveal the hidden inputs so user can change account or paste a new token
              showEl(emailInput); showEl(nameInput); showEl(passInput);
              // also reveal token paste button if present
              var b = container.querySelector('button[type="button"]'); if(b) b.style.display='inline-block';
              banner.parentElement.removeChild(banner);
            });
          }
        }catch(e){ console.warn('portal-ui init err', e); }
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

  // reuse the same custom head injection used in setupWiFi
  const char* customHead = R"rawliteral(
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;600;800&display=swap" rel="stylesheet">
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

  lcd.init();
  lcd.backlight();

  pinMode(BTN_POLICE_PIN,   INPUT_PULLUP);
  pinMode(BTN_HOSPITAL_PIN, INPUT_PULLUP);
  pinMode(BTN_FIRE_PIN,     INPUT_PULLUP);
  pinMode(BTN_WIFI_RESET,   INPUT_PULLUP);

  pinMode(LED_WIFI_PIN, OUTPUT);
  pinMode(LED_GPS_PIN,  OUTPUT);
  pinMode(BUZZER_PIN,   OUTPUT);

  // Load stored user email (if any)
  prefs.begin(PREF_NAMESPACE, false);
  deviceUserEmail = prefs.getString(PREF_USER_EMAIL, "");
  deviceUserToken = prefs.getString(PREF_USER_TOKEN, "");
  prefs.end();
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
  // If connected to WiFi as STA, start local web server for login/config
  if (WiFi.status() == WL_CONNECTED) {
    startLocalWebServer();
    lcd.clear(); lcd.print("Portal: "); lcd.setCursor(0,1); lcd.print(WiFi.localIP().toString()); delay(1200); lcd.clear();
  }
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

  // Serve local web requests when running
  if (localServerRunning) {
    server.handleClient();
  }

  lcd.setCursor(0, 0);
  lcd.print("Lat:");
  lcd.print(latitude, 4);
  lcd.setCursor(0, 1);
  lcd.print("Lon:");
  lcd.print(longitude, 4);

  // show token status briefly if user long-presses another button? (left as-is)

  delay(150);
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
  if (deviceUserToken.length() > 0) {
    http.addHeader("Authorization", "Bearer " + deviceUserToken);
  }

  // Build JSON payload and include device's associated user email if available
  String payload = "{";
  payload += "\"type\":\"" + type + "\",";
  payload += "\"latitude\": " + String(latitude, 6) + ",";
  payload += "\"longitude\": " + String(longitude, 6);
  if (deviceUserEmail.length() > 0) {
    payload += ",\"userEmail\":\"" + deviceUserEmail + "\"";
  }
  payload += "}";

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
