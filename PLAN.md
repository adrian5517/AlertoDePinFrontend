# AlertoDePin — Project Plan & Todo

Purpose
- Provide a concise plan to audit, fix, test, and deploy the AlertoDePin system (backend, frontend, IoT device).
- Prioritize stability (real-time, notifications, geolocation) and developer onboarding.

High-level goals
1. Ensure Socket.IO realtime updates (alerts, online users, notifications) are reliable.
2. Stabilize backend APIs (alerts, notifications, CORS, reverse geocoding).
3. Align frontend event handling and notification model with backend.
4. Validate IoT device (ESP32) alert flow end-to-end.
5. Create CI/dev processes and deployment checklist.

Priority tasks (short-term)
- Backend
  - Add any missing Notification types (e.g., `family_alert`) to the Notification model enum.
  - Audit alert creation flows: ensure Notification types emitted match model and frontend expectations.
  - Add defensive checks when emitting Socket.IO events (check io exists).
  - Improve reverse-geocode error logging and make LOCATIONIQ_KEY required or provide clear fallback.
  - Ensure rooms are used for targeted emits (use `io.to(userId)` consistently).
  - Unit/integration tests for createAlert, respondToAlert, resolveAlert, createIoTAlert.

- Frontend
  - Verify NotificationPanel uses the same notification payload shape (id, title, message, type).
  - Ensure socket event names match backend emits (`new-alert` vs `newAlert`, `newNotification` etc).
  - Add join-room on socket connect using user id so server can emit to rooms instead of raw socket ids.
  - Add resilient reconnection logic and handle location permission errors gracefully.

- IoT (ESP32)
  - Validate POST to /api/alerts/iot works over TLS; ensure backend accepts device origin (CORS not needed for server-to-server).
  - Add device auth later (API key) to prevent spam.
  - Test reverse geocode fallback address formatting.

- DevOps / Env
  - Document required environment variables:
    - MONGODB_URI
    - LOCATIONIQ_KEY
    - FRONTEND_URL (comma-separated for multiple allowed origins)
    - PORT
  - Local run instructions for backend and frontend (include debugging socket origins endpoint).
  - Deployment checklist for backend: ensure FRONTEND_URL correct, environment secrets set, database index for 2dsphere exists.
  - TLS: ensure backend is served over HTTPS for IoT.

Medium-term tasks
- Add notifications read/unread endpoints and frontend UI.
- Add tests for geospatial queries and ensure 2dsphere index exists (already created in model).
- Add rate limiting and basic auth for IoT endpoint.
- Improve logging (structured logs, Sentry optional).

Testing & verification
- Backend:
  - curl /api/health -> OK
  - POST /api/debug/emit-test -> all connected clients should receive `new-alert`
  - Test create alert flow: POST /api/alerts (auth) -> DB entry + socket broadcast + Notification records
  - Test IoT POST -> 201 + alert emitted
- Socket.IO:
  - Start server, connect a test client, emit `user-online` and confirm `online-users-update` broadcasts.
  - Confirm `update-location` emits `user-location-update`.
  - Confirm targeted emits use user room: server should call `io.to(userId)` and client should join `user-${userId}` room.
- Frontend:
  - Login -> server join-room on connect; notifications appear on `newNotification` with correct shape.
  - Trigger an alert from ESP32 -> alert appears on live map and notification panel.

Quick PR checklist (for each change)
- [ ] Code compiles and lints.
- [ ] Unit test(s) added for critical flows.
- [ ] Manual smoke test steps documented in PR description.
- [ ] Update PLAN.md with any new steps/assumptions.
- [ ] Confirm env vars in deployment platform.

Notes & known issues to address first
- Notification model enum does not include `family_alert` but the controller creates that type — add it or change controller.
- Frontend NotificationPanel expects notifications with `id` — ensure the store maps MongoDB `_id` to `id` or backend emits id field.
- Socket event naming: controller uses multiple names (`new-alert`, `newAlert`, `newNotification`) — standardize and document.
- CORS config in server uses FRONTEND_URL list; verify deployed frontend URL(s) match exactly (no trailing slash).
- Reverse geocode may fail; ensure fallback text is clear (already present).

Success criteria
- Realtime alerts and notifications consistently delivered to intended users.
- IoT device can create alerts that show in dashboard and notify responders and family.
- Clear dev onboarding and documented deploy steps.

Next immediate actions (day 1)
1. Add `family_alert` to Notification model enum OR change controller to use supported type.
2. Map notification payload id consistently (backend or socket payload).
3. Run backend locally, call POST /api/debug/emit-test and verify frontend receives notification.
4. Test ESP32 POST using curl with sample lat/lon and ensure 201 and socket broadcast.

End.
