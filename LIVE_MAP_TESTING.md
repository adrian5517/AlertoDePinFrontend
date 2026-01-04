# Live Map Testing Guide

## Server Status
✅ **Backend:** Running on http://localhost:5000
✅ **Frontend:** Running on http://localhost:5174
✅ **Socket.IO:** Enabled and ready

## Testing Steps

### 1. Access the Live Map
1. Open browser to: http://localhost:5174
2. Login with your credentials
3. Click "Live Map" in the sidebar (MapPin icon)
4. **Allow location access** when browser prompts

### 2. View Online Users
**What you should see:**
- Green pulsing dots = Online Citizens
- Blue pulsing dots = Online Police
- Red pulsing dots = Online Hospital staff
- Orange pulsing dots = Online Fire responders
- Purple pulsing dots = Online Family members

**Test:**
- Open another browser window (or incognito)
- Login as different user type
- Both users should see each other on the map

### 3. View Active Alerts
**What you should see:**
- Blue large pins with shield icon = Police alerts
- Red large pins with medical icon = Hospital alerts
- Orange large pins with flame icon = Fire alerts
- Purple large pins with family icon = Family alerts

**Test:**
- Create a new alert from Dashboard
- Alert should appear instantly on map for all users
- No refresh needed!

### 4. Interact with Markers
**Click on Alert Marker:**
- Details card appears on right side
- Shows alert type, status, description
- Shows distance from your location
- Shows estimated time of arrival (ETA)
- "Show Route" button displays path on map
- "Google Maps" button opens external navigation

**Click on User Marker:**
- Details card shows user name
- Shows user type (Citizen, Police, etc.)
- Shows distance from you
- Shows last update time

### 5. Filter Alerts
**Test all filter buttons:**
- **All Alerts** - Shows everything
- **Police** - Only blue pins
- **Medical** - Only red pins
- **Fire** - Only orange pins
- **Family** - Only purple pins

Online users always visible regardless of filter!

### 6. Real-Time Updates
**Test automatic updates:**
1. Keep map open for 30+ seconds
2. Your location updates automatically
3. Move your device/laptop
4. Your marker should update position

**Test new alerts:**
1. Open second browser window
2. Create new alert
3. Alert appears on map in first window **instantly**
4. No page refresh needed!

**Test user disconnect:**
1. Close second browser window
2. User marker disappears from map **instantly**

### 7. Navigation Features
**Test route display:**
1. Click any alert marker
2. Click "Show Route" button
3. Blue line shows path from you to alert
4. Map auto-zooms to fit route
5. Click "Clear Route" to remove

**Test Google Maps:**
1. Click any alert marker
2. Click "Google Maps" button
3. Opens in new tab with navigation ready

### 8. Check Stats
**Top of page shows:**
- **Active Alerts** count (red MapPin icon)
- **Online Users** count (green Users icon)

**Map shows two badges:**
- **Top-left:** Alert and user counts
- **Bottom-left:** Legend explaining colors

### 9. Mobile Test (Optional)
1. Open http://localhost:5174 on phone
2. Allow location access
3. Map should work on touch devices
4. Pinch to zoom
5. Tap markers to view details

## Expected Behaviors

### Connection Success
✅ Console shows: "Connected to Socket.IO server"
✅ Your user appears on map immediately
✅ Other online users visible as pulsing dots
✅ Active alerts visible as large pins

### Real-Time Updates
✅ New alerts appear without refresh
✅ User markers update every 30 seconds
✅ Disconnected users removed immediately
✅ Distance/ETA updates when you move

### Interactions
✅ Markers clickable and show details
✅ Routes display on map
✅ Filters work correctly
✅ Legend matches marker colors
✅ Close buttons dismiss cards

## Troubleshooting

### No online users showing?
**Check:**
1. Browser console for Socket.IO connection
2. Location access granted
3. Multiple users logged in
4. Backend server running

### Alerts not appearing?
**Check:**
1. Filter not set to specific type
2. Alerts have status 'active' or 'pending'
3. Alerts have valid coordinates
4. Backend API responding

### Location not updating?
**Check:**
1. Browser location permissions
2. Console for geolocation errors
3. Socket.IO connection active
4. 30 seconds passed since last update

### Route not showing?
**Check:**
1. Mapbox API token valid
2. Console for API errors
3. Valid coordinates for both points
4. Internet connection for Mapbox API

## Console Commands for Testing

**Check Socket.IO connection:**
```javascript
// In browser console
window.socket // Should show Socket object
```

**Manually trigger location update:**
```javascript
navigator.geolocation.getCurrentPosition(pos => {
  console.log('Location:', pos.coords.latitude, pos.coords.longitude);
});
```

**Check online users (backend):**
```bash
# In terminal or Postman
curl http://localhost:5000/api/online-users
```

## Performance Expectations

### Load Time
- Map renders: < 2 seconds
- Markers appear: < 1 second
- Socket connects: < 500ms

### Update Frequency
- Location broadcast: Every 30 seconds
- New alerts: Instant (< 100ms)
- User disconnect: Instant (< 100ms)

### Smooth Operations
- Map pan/zoom: 60 FPS
- Marker animations: Smooth
- Route calculation: < 2 seconds
- Details card: < 100ms

## Success Criteria
✅ All online users visible on map
✅ All active alerts visible as pins
✅ Real-time updates working without refresh
✅ Location tracking every 30 seconds
✅ Filters work correctly
✅ Navigation features functional
✅ No console errors
✅ Smooth animations and interactions

## Known Limitations
⚠️ Requires browser location access
⚠️ Internet needed for Mapbox tiles
⚠️ Updates every 30 seconds (not continuous)
⚠️ Max 1000 markers recommended for performance
⚠️ Mobile data usage for real-time updates

---

**Ready to test?** Open http://localhost:5174/map and allow location access!

**Questions or issues?** Check the console for errors and refer to LIVE_MAP_IMPLEMENTATION.md
