# 🚨 ALERTO DE PIN - Emergency Response System

A modern, responsive web application for emergency alert monitoring and coordination built with React, Tailwind CSS, and Mapbox GL.

## 🏗️ Tech Stack

- **Frontend Framework**: React 18 + Vite
- **Styling**: Tailwind CSS
- **Animations**: Framer Motion
- **Maps**: Mapbox GL JS
- **Charts**: Recharts
- **Icons**: Lucide React
- **Routing**: React Router DOM v6
- **State Management**: Zustand + Context API

## ✨ Features

### 🔐 Authentication System
- Login and Sign-up pages with modern UI
- Role-based access control (Citizen, Police, Hospital, Family, Admin)
- Protected routes and authorization

### 👥 User Roles

1. **Citizen/User**
   - Send emergency alerts
   - View alert history
   - Track alert status
   - Personal dashboard

2. **Police Officer**
   - Live incident map
   - Priority incident queue
   - Real-time alert monitoring
   - Response tracking

3. **Hospital Staff**
   - Medical emergency map
   - Ambulance dispatch system
   - Emergency queue management
   - Patient tracking

4. **Family Member**
   - Track registered family members
   - Receive family alerts
   - Location monitoring
   - Safety check-ins

5. **Admin**
   - User management
   - System analytics and charts
   - Activity logs
   - Complete system oversight

### 🗺️ Map Features
- Real-time alert markers with color-coded types
- Interactive popups with alert details
- Geolocation tracking
- Map navigation controls
- Custom marker styling

### 🎨 Design Features
- Dark/Light mode toggle
- Glassmorphism effects
- Smooth animations and transitions
- Responsive design (mobile, tablet, desktop)
- Professional color scheme (blue, red, gray, white)
- Custom scrollbars

## 🚀 Getting Started

### Prerequisites
- Node.js 16+ and npm/yarn
- Mapbox API token (free tier available)

### Installation

1. Clone the repository:
```bash
cd AlertoDePin
```

2. Install dependencies:
```bash
npm install
```

3. Configure Mapbox:
   - Get a free API token from [Mapbox](https://www.mapbox.com/)
   - Open `src/hooks/useMapbox.js`
   - Replace `pk.YOUR_MAPBOX_TOKEN_HERE` with your actual token:
   ```javascript
   mapboxgl.accessToken = 'pk.your_actual_token_here';
   ```

4. Start the development server:
```bash
npm run dev
```

5. Open your browser to `http://localhost:5173`

## 🧪 Demo Accounts

For testing purposes, the app uses email-based role detection:

- **Admin**: Use email containing "admin" (e.g., admin@test.com)
- **Police**: Use email containing "police" (e.g., police@test.com)
- **Hospital**: Use email containing "hospital" (e.g., hospital@test.com)
- **Family**: Use email containing "family" (e.g., family@test.com)
- **Citizen**: Any other email (e.g., user@test.com)

Password: Use any password (demo mode)

## 📁 Project Structure

```
src/
├── components/
│   ├── Navbar.jsx              # Top navigation bar
│   ├── Sidebar.jsx             # Side navigation menu
│   ├── MapboxMap.jsx           # Interactive map component
│   ├── AlertCard.jsx           # Alert display card
│   ├── DashboardHeader.jsx     # Dashboard header with stats
│   ├── DashboardLayout.jsx     # Main layout wrapper
│   └── ProtectedRoute.jsx      # Route protection HOC
├── pages/
│   ├── Login.jsx               # Login page
│   ├── Signup.jsx              # Registration page
│   ├── DashboardCitizen.jsx    # Citizen dashboard
│   ├── DashboardPolice.jsx     # Police dashboard
│   ├── DashboardHospital.jsx   # Hospital dashboard
│   ├── DashboardFamily.jsx     # Family dashboard
│   └── DashboardAdmin.jsx      # Admin control panel
├── context/
│   ├── AuthContext.jsx         # Authentication context
│   └── store.js                # Zustand stores
├── hooks/
│   └── useMapbox.js            # Custom Mapbox hook
├── App.jsx                     # Main app with routing
├── main.jsx                    # App entry point
└── index.css                   # Global styles
```

## 🎯 Key Features Implementation

### Dark Mode
Toggle between light and dark themes using the moon/sun icon in the navbar. Preference is saved to localStorage.

### Real-time Alerts
Mock alerts are displayed with:
- Color-coded status badges
- Location information
- Timestamp tracking
- Coordinate data

### Responsive Design
- Mobile-first approach
- Collapsible sidebar for mobile
- Responsive grid layouts
- Touch-friendly controls

### Map Integration
- Manila, Philippines as default center
- Custom markers for different alert types
- Interactive popups with alert details
- Navigation and geolocation controls

## 🔧 Customization

### Colors
Edit `tailwind.config.js` to customize the color scheme:
```javascript
theme: {
  extend: {
    colors: {
      primary: { /* your colors */ },
      danger: { /* your colors */ },
    }
  }
}
```

### Map Style
Change map style in `src/hooks/useMapbox.js`:
```javascript
style: 'mapbox://styles/mapbox/streets-v12', // or dark-v11, light-v11, etc.
```

## 🚀 Building for Production

```bash
npm run build
```

The optimized build will be in the `dist/` folder.

## 📝 Next Steps

To connect with a real backend:

1. Replace mock data with API calls
2. Implement proper authentication (JWT, Firebase, etc.)
3. Set up WebSocket for real-time updates
4. Connect to a database (MongoDB, PostgreSQL, etc.)
5. Add proper error handling and validation
6. Implement actual emergency alert system integration

## 🤝 Contributing

This is a demonstration project. For production use:
- Add comprehensive error handling
- Implement proper security measures
- Add unit and integration tests
- Set up CI/CD pipeline
- Add proper logging and monitoring

## 📄 License

This project is created for educational and demonstration purposes.

## 👨‍💻 Developer Notes

- All authentication is currently simulated (localStorage)
- Alert data is mock data for demonstration
- Mapbox token needs to be added for map functionality
- Ready for backend integration with minimal changes

---

Built with ❤️ using React + Vite + Tailwind CSS
