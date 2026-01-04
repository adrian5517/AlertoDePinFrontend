# 🚀 Quick Start Guide

## ✅ Setup Complete!

Your ALERTO DE PIN Emergency Response System is ready!

## 🌐 Access the Application

The dev server is running at: **http://localhost:5174**

## 🧪 Test Accounts

Login with these demo accounts:

### Admin Account
- Email: `admin@test.com`
- Password: `any password`
- Access: Full system control, analytics, user management

### Police Account
- Email: `police@test.com`
- Password: `any password`
- Access: Incident map, priority alerts, response tools

### Hospital Account
- Email: `hospital@test.com`
- Password: `any password`
- Access: Medical emergencies, ambulance dispatch

### Family Account
- Email: `family@test.com`
- Password: `any password`
- Access: Family member tracking, safety monitoring

### Citizen Account
- Email: `user@test.com` (or any other email)
- Password: `any password`
- Access: Send alerts, view history

## 🗺️ Mapbox Setup (Required for Maps)

1. Get a free token from [Mapbox](https://account.mapbox.com/access-tokens/)
2. Open `src/hooks/useMapbox.js`
3. Replace line 7:
   ```javascript
   mapboxgl.accessToken = 'pk.YOUR_ACTUAL_MAPBOX_TOKEN_HERE';
   ```

## ✨ Features to Try

1. **Dark Mode**: Click the moon/sun icon in the navbar
2. **Dashboard Navigation**: Use the sidebar to explore different sections
3. **Alert Cards**: View mock emergency alerts with status indicators
4. **Responsive Design**: Resize your browser or use mobile device tools
5. **User Switching**: Logout and login with different user types to see different dashboards

## 📁 Key Files

- `src/App.jsx` - Main routing configuration
- `src/context/AuthContext.jsx` - Authentication logic
- `src/pages/` - All dashboard pages
- `src/components/` - Reusable UI components
- `tailwind.config.js` - Theme customization

## 🛠️ Development Commands

```bash
# Start dev server
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview
```

## 🎨 Customization

### Change Colors
Edit `tailwind.config.js` to modify the color scheme

### Add New Pages
1. Create component in `src/pages/`
2. Add route in `src/App.jsx`
3. Add to sidebar menu in `src/components/Sidebar.jsx`

### Connect Backend
Replace mock data with API calls in dashboard pages

## 📝 Next Steps

- [ ] Add your Mapbox token for map functionality
- [ ] Test all user types and dashboards
- [ ] Customize colors and branding
- [ ] Connect to your backend API
- [ ] Deploy to production

## 🐛 Troubleshooting

**Port in use?** The app will automatically use another port (5174, 5175, etc.)

**Tailwind not working?** Restart the dev server: `Ctrl+C` then `npm run dev`

**Maps not showing?** Add your Mapbox token in `src/hooks/useMapbox.js`

---

Enjoy building your emergency response system! 🚨
