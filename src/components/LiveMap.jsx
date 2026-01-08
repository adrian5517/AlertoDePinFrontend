import { useEffect, useRef, useState } from 'react';
import { useMapbox } from '../hooks/useMapbox';
import { Navigation, MapPin, Clock, X, User, Users } from 'lucide-react';
import mapboxgl from 'mapbox-gl';

const LiveMap = ({ alerts = [], onlineUsers = [], onMarkerClick, selectedAlert, className = '' }) => {
  const mapContainerRef = useRef(null);
  const { map, addMarker, clearMarkers, flyTo } = useMapbox('live-map-container');
  const [userLocation, setUserLocation] = useState(null);
  const [selectedItem, setSelectedItem] = useState(null);
  const [selectedType, setSelectedType] = useState(null); // 'alert' or 'user'
  const [showingRoute, setShowingRoute] = useState(false);
  const markersRef = useRef([]); // Track all markers

  // When selectedAlert prop changes, update selectedItem and show route
  useEffect(() => {
    if (selectedAlert) {
      setSelectedItem(selectedAlert);
      setSelectedType('alert');
      // Auto-show route after a short delay to ensure map is ready
      setTimeout(() => {
        handleNavigate(selectedAlert);
      }, 300);
    }
  }, [selectedAlert]);

  // Get user's current location once
  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setUserLocation({
            lat: position.coords.latitude,
            lng: position.coords.longitude
          });
        },
        (error) => console.error('Geolocation error:', error),
        { enableHighAccuracy: true }
      );
    }
  }, []);

  // Calculate distance between two coordinates (Haversine formula)
  const calculateDistance = (lat1, lon1, lat2, lon2) => {
    const R = 6371; // Earth's radius in km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = 
      Math.sin(dLat/2) * Math.sin(dLat/2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
      Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
  };

  // Calculate ETA (assuming average speed of 40 km/h in city)
  const calculateETA = (distance) => {
    const speed = 40; // km/h
    const hours = distance / speed;
    const minutes = Math.round(hours * 60);
    if (minutes < 60) return `${minutes} min`;
    const hrs = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${hrs}h ${mins}m`;
  };

  const handleNavigate = (item) => {
    if (!map || !userLocation) return;
    
    // Extract coordinates properly from different formats
    let coords = null;
    if (item.coordinates) {
      coords = item.coordinates;
    } else if (item.location?.coordinates?.coordinates) {
      // GeoJSON format
      coords = {
        lng: item.location.coordinates.coordinates[0],
        lat: item.location.coordinates.coordinates[1]
      };
    } else if (item.location) {
      coords = item.location;
    }
    
    if (!coords || !coords.lat || !coords.lng) {
      console.error('Invalid coordinates for navigation:', item);
      return;
    }
    
    // Use Mapbox Directions API to show route on the map
    const start = [userLocation.lng, userLocation.lat];
    const end = [coords.lng, coords.lat];
    
    // Mapbox access token from env (Vite)
    const accessToken = import.meta.env.VITE_MAPBOX_TOKEN || '';
    
    // Get directions using Mapbox Directions API
    const directionsUrl = `https://api.mapbox.com/directions/v5/mapbox/driving/${start[0]},${start[1]};${end[0]},${end[1]}?geometries=geojson&access_token=${accessToken}`;
    
    fetch(directionsUrl)
      .then(response => response.json())
      .then(data => {
        if (data.routes && data.routes.length > 0) {
          const route = data.routes[0].geometry;
          
          // Remove existing route layer if it exists
          if (map.getLayer('route')) {
            map.removeLayer('route');
          }
          if (map.getSource('route')) {
            map.removeSource('route');
          }
          
          // Add route to map
          map.addSource('route', {
            type: 'geojson',
            data: {
              type: 'Feature',
              properties: {},
              geometry: route
            }
          });
          
          map.addLayer({
            id: 'route',
            type: 'line',
            source: 'route',
            layout: {
              'line-join': 'round',
              'line-cap': 'round'
            },
            paint: {
              'line-color': '#3b82f6',
              'line-width': 5,
              'line-opacity': 0.8
            }
          });
          
          // Fit map to show the route
          const coordinates = route.coordinates;
          const bounds = coordinates.reduce((bounds, coord) => {
            return bounds.extend(coord);
          }, new mapboxgl.LngLatBounds(coordinates[0], coordinates[0]));
          
          map.fitBounds(bounds, {
            padding: 80
          });
          
          setShowingRoute(true);
        }
      })
      .catch(error => {
        console.error('Error fetching directions:', error);
      });
  };

  const clearRoute = () => {
    if (map) {
      if (map.getLayer('route')) {
        map.removeLayer('route');
      }
      if (map.getSource('route')) {
        map.removeSource('route');
      }
      setShowingRoute(false);
    }
  };

  // Add markers for alerts and online users
  useEffect(() => {
    if (!map) return;

    console.log('LiveMap - Received alerts:', alerts);
    console.log('LiveMap - Received online users:', onlineUsers);

    clearMarkers();
    markersRef.current = [];

    // Alert markers
    alerts.forEach((alert) => {
      console.log('Processing alert:', alert);
      console.log('Alert location:', alert.location);
      
      // Handle different coordinate formats
      let coords = null;
      
      if (alert.coordinates) {
        // Direct coordinates object {lat, lng}
        coords = alert.coordinates;
      } else if (alert.location?.coordinates?.coordinates) {
        // GeoJSON format: location.coordinates.coordinates = [lng, lat]
        const geoCoords = alert.location.coordinates.coordinates;
        coords = {
          lng: geoCoords[0],
          lat: geoCoords[1]
        };
      } else if (Array.isArray(alert.location?.coordinates)) {
        // Direct array format [lng, lat]
        coords = {
          lng: alert.location.coordinates[0],
          lat: alert.location.coordinates[1]
        };
      } else if (alert.location?.coordinates?.lat && alert.location?.coordinates?.lng) {
        // Object format {lat, lng}
        coords = alert.location.coordinates;
      }
      
      // Skip if no valid coordinates
      if (!coords || !coords.lat || !coords.lng) {
        console.warn('Alert has no valid coordinates:', alert);
        console.warn('Checked paths:', {
          'alert.coordinates': alert.coordinates,
          'alert.location': alert.location,
          'alert.location?.coordinates': alert.location?.coordinates,
          'alert.location?.coordinates?.coordinates': alert.location?.coordinates?.coordinates
        });
        return;
      }
      
      console.log('Alert coordinates:', coords);

        const pinDesigns = {
          police: `
            <div class="relative group">
              <div class="w-10 h-10 bg-blue-600 rounded-full shadow-lg flex items-center justify-center border-4 border-white transition-transform duration-200 hover:scale-110">
                <svg class="w-6 h-6 text-white" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 2L4 5v6.09c0 5.05 3.41 9.76 8 10.91 4.59-1.15 8-5.86 8-10.91V5l-8-3z"/>
                </svg>
              </div>
              <div class="absolute -bottom-2 left-1/2 transform -translate-x-1/2 w-0 h-0 border-l-8 border-r-8 border-t-8 border-transparent border-t-blue-600"></div>
            </div>
          `,
          hospital: `
            <div class="relative group">
              <div class="w-10 h-10 bg-red-600 rounded-full shadow-lg flex items-center justify-center border-4 border-white transition-transform duration-200 hover:scale-110">
                <svg class="w-6 h-6 text-white" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M20 6h-4V4c0-1.1-.9-2-2-2h-4c-1.1 0-2 .9-2 2v2H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2zM10 4h4v2h-4V4zm2 13h-2v-3H7v-2h3V9h2v3h3v2h-3v3z"/>
                </svg>
              </div>
              <div class="absolute -bottom-2 left-1/2 transform -translate-x-1/2 w-0 h-0 border-l-8 border-r-8 border-t-8 border-transparent border-t-red-600"></div>
            </div>
          `,
          fire: `
            <div class="relative group">
              <div class="w-10 h-10 bg-orange-600 rounded-full shadow-lg flex items-center justify-center border-4 border-white transition-transform duration-200 hover:scale-110">
                <svg class="w-6 h-6 text-white" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 23s-8-4.5-8-11.8C4 5 8 1 12 1s8 4 8 10.2c0 7.3-8 11.8-8 11.8zm1-18v8l4-4c0 4-2 6-5 8 1-4-2-6-2-6l1-6z"/>
                </svg>
              </div>
              <div class="absolute -bottom-2 left-1/2 transform -translate-x-1/2 w-0 h-0 border-l-8 border-r-8 border-t-8 border-transparent border-t-orange-600"></div>
            </div>
          `,
          /* 'family' pin removed - use 'fire' pin for fire-related alerts */
          default: `
            <div class="relative group">
              <div class="w-10 h-10 bg-indigo-600 rounded-full shadow-lg flex items-center justify-center border-4 border-white transition-transform duration-200 hover:scale-110">
                <svg class="w-6 h-6 text-white" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/>
                </svg>
              </div>
              <div class="absolute -bottom-2 left-1/2 transform -translate-x-1/2 w-0 h-0 border-l-8 border-r-8 border-t-8 border-transparent border-t-indigo-600"></div>
            </div>
          `
        };

        const pinHTML = pinDesigns[alert.type] || pinDesigns.default;

        const el = document.createElement('div');
        el.innerHTML = pinHTML;
        el.className = 'custom-marker-wrapper';
        el.style.width = '40px';
        el.style.height = '56px';
        el.style.cursor = 'pointer';
        el.style.position = 'relative';
        el.style.zIndex = '1';

        el.addEventListener('click', (e) => {
          e.stopPropagation();
          setSelectedItem(alert);
          setSelectedType('alert');
          el.style.zIndex = '1000';
          if (onMarkerClick) {
            onMarkerClick(alert);
          }
        });

        const marker = addMarker([coords.lng, coords.lat], {
          element: el,
        });
        markersRef.current.push(marker);
    });

    // Online user markers
    onlineUsers.forEach((user) => {
      if (user.location) {
        const coords = user.location;
        
        // Different colors and icons for different user types
        const userStyles = {
          'citizen': {
            color: '#10b981',
            icon: `<svg class="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/>
            </svg>`
          },
          'police': {
            color: '#3b82f6',
            icon: `<svg class="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 2L4 5v6.09c0 5.05 3.41 9.76 8 10.91 4.59-1.15 8-5.86 8-10.91V5l-8-3z"/>
            </svg>`
          },
          'hospital': {
            color: '#ef4444',
            icon: `<svg class="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 24 24">
              <path d="M19 3H5c-1.1 0-1.99.9-1.99 2L3 19c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-1 11h-4v4h-4v-4H6v-4h4V6h4v4h4v4z"/>
            </svg>`
          },
          'fire': {
            color: '#f97316',
            icon: `<svg class="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 23s-8-4.5-8-11.8C4 5 8 1 12 1s8 4 8 10.2c0 7.3-8 11.8-8 11.8zm1-18v8l4-4c0 4-2 6-5 8 1-4-2-6-2-6l1-6z"/>
            </svg>`
          },
          'family': {
            color: '#a855f7',
            icon: `<svg class="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 24 24">
              <path d="M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5s-3 1.34-3 3 1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z"/>
            </svg>`
          }
        };

        const style = userStyles[user.userType] || {
          color: '#6366f1',
          icon: `<svg class="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 24 24">
            <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/>
          </svg>`
        };

        const userMarkerHTML = `
          <div class="relative group">
            <div class="w-8 h-8 rounded-full shadow-lg flex items-center justify-center border-2 border-white transition-transform duration-200 hover:scale-125 animate-pulse" style="background-color: ${style.color}">
              ${style.icon}
            </div>
            <div class="absolute -top-10 left-1/2 transform -translate-x-1/2 bg-gray-900 text-white text-xs px-2 py-1 rounded whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-[9999]">
              <div class="font-semibold">${user.name}</div>
              <div class="text-[10px] capitalize text-gray-300">${user.userType}</div>
            </div>
          </div>
        `;

        const el = document.createElement('div');
        el.innerHTML = userMarkerHTML;
        el.className = 'online-user-marker';
        el.style.width = '32px';
        el.style.height = '32px';
        el.style.cursor = 'pointer';
        el.style.position = 'relative';
        el.style.zIndex = '2';

        el.addEventListener('click', (e) => {
          e.stopPropagation();
          setSelectedItem(user);
          setSelectedType('user');
          el.style.zIndex = '1000';
        });

        const marker = addMarker([coords.lng, coords.lat], {
          element: el,
        });
        markersRef.current.push(marker);
      }
    });

    // Fit bounds to show all alerts (only if there are alerts and map isn't being manually controlled)
    if (markersRef.current.length > 0 && !map.isMoving() && !selectedItem) {
      const bounds = new mapboxgl.LngLatBounds();
      
      // Add all alert coordinates to bounds
      alerts.forEach((alert) => {
        let coords = null;
        if (alert.coordinates) {
          coords = alert.coordinates;
        } else if (alert.location?.coordinates?.coordinates) {
          const geoCoords = alert.location.coordinates.coordinates;
          coords = { lng: geoCoords[0], lat: geoCoords[1] };
        }
        if (coords && coords.lat && coords.lng) {
          bounds.extend([coords.lng, coords.lat]);
        }
      });
      
      // Add online users to bounds
      onlineUsers.forEach((user) => {
        if (user.location && user.location.lat && user.location.lng) {
          bounds.extend([user.location.lng, user.location.lat]);
        }
      });
      
      // Add user location to bounds if available
      if (userLocation) {
        bounds.extend([userLocation.lng, userLocation.lat]);
      }
      
      // Only fit bounds if we have valid bounds
      if (!bounds.isEmpty()) {
        map.fitBounds(bounds, {
          padding: { top: 80, bottom: 80, left: 80, right: 80 },
          maxZoom: 15, // Don't zoom in too much
          duration: 1000
        });
      }
    }
  }, [map, alerts, onlineUsers, userLocation, selectedItem]);

  return (
    <div className={`relative ${className}`}>
      <div 
        ref={mapContainerRef}
        id="live-map-container" 
        className="w-full h-full rounded-lg shadow-lg"
        style={{ minHeight: '400px' }}
        onClick={() => {
          setSelectedItem(null);
          setSelectedType(null);
        }}
      />

      {/* Alert Details Card */}
      {selectedItem && selectedType === 'alert' && userLocation && (
        <div className="absolute top-4 right-4 z-[1001] bg-white dark:bg-gray-800 rounded-lg shadow-2xl border border-gray-200 dark:border-gray-700 p-4 w-[320px]">
          <div className="space-y-3">
            <div className="flex items-start justify-between pb-2 border-b border-gray-200 dark:border-gray-700">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-2">
                  <span className={`px-2 py-1 rounded text-xs font-bold uppercase ${
                    selectedItem.type === 'police' ? 'bg-blue-500 text-white' :
                    selectedItem.type === 'hospital' ? 'bg-red-500 text-white' :
                    selectedItem.type === 'fire' ? 'bg-orange-500 text-white' :
                    selectedItem.type === 'family' ? 'bg-purple-500 text-white' :
                    'bg-gray-500 text-white'
                  }`}>
                    {selectedItem.type}
                  </span>
                  <span className={`px-2 py-1 rounded text-xs font-semibold ${
                    selectedItem.status === 'active' ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300' :
                    selectedItem.status === 'pending' ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300' :
                    'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300'
                  }`}>
                    {selectedItem.status}
                  </span>
                </div>
                <h3 className="font-bold text-base text-gray-900 dark:text-white mb-1">
                  {selectedItem.title || selectedItem.description}
                </h3>
                <p className="text-xs text-gray-600 dark:text-gray-400 line-clamp-2">
                  {selectedItem.description}
                </p>
              </div>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setSelectedItem(null);
                  setSelectedType(null);
                }}
                className="ml-2 p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors flex-shrink-0"
              >
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div className="flex items-center gap-2 p-2.5 bg-blue-50 dark:bg-blue-900/20 rounded">
                <Navigation className="w-5 h-5 text-blue-500 flex-shrink-0" />
                <div className="min-w-0">
                  <p className="text-xs text-gray-500 dark:text-gray-400">Distance</p>
                  <p className="font-bold text-base text-gray-900 dark:text-white truncate">
                    {(() => {
                      const alertLat = selectedItem.coordinates?.lat || selectedItem.location?.coordinates?.coordinates?.[1] || 0;
                      const alertLng = selectedItem.coordinates?.lng || selectedItem.location?.coordinates?.coordinates?.[0] || 0;
                      return calculateDistance(userLocation.lat, userLocation.lng, alertLat, alertLng).toFixed(1);
                    })()} km
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 p-2.5 bg-green-50 dark:bg-green-900/20 rounded">
                <Clock className="w-5 h-5 text-green-500 flex-shrink-0" />
                <div className="min-w-0">
                  <p className="text-xs text-gray-500 dark:text-gray-400">ETA</p>
                  <p className="font-bold text-base text-gray-900 dark:text-white truncate">
                    {(() => {
                      const alertLat = selectedItem.coordinates?.lat || selectedItem.location?.coordinates?.coordinates?.[1] || 0;
                      const alertLng = selectedItem.coordinates?.lng || selectedItem.location?.coordinates?.coordinates?.[0] || 0;
                      return calculateETA(calculateDistance(userLocation.lat, userLocation.lng, alertLat, alertLng));
                    })()}
                  </p>
                </div>
              </div>
            </div>

            <div className="flex gap-2">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleNavigate(selectedItem);
                }}
                className="flex-1 py-2.5 px-4 bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-900 dark:text-white rounded-lg transition-colors text-sm font-semibold flex items-center justify-center gap-1.5"
              >
                <Navigation className="w-4 h-4" />
                Show Route
              </button>
              
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  const alertLat = selectedItem.coordinates?.lat || selectedItem.location?.coordinates?.coordinates?.[1];
                  const alertLng = selectedItem.coordinates?.lng || selectedItem.location?.coordinates?.coordinates?.[0];
                  const googleMapsUrl = `https://www.google.com/maps/dir/?api=1&origin=${userLocation.lat},${userLocation.lng}&destination=${alertLat},${alertLng}&travelmode=driving`;
                  window.open(googleMapsUrl, '_blank');
                }}
                className="flex-1 py-2.5 px-4 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors text-sm font-semibold flex items-center justify-center gap-1.5"
              >
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/>
                </svg>
                Google Maps
              </button>
            </div>
          </div>
        </div>
      )}

      {/* User Details Card */}
      {selectedItem && selectedType === 'user' && (
        <div className="absolute top-4 right-4 z-[1001] bg-white dark:bg-gray-800 rounded-lg shadow-2xl border border-gray-200 dark:border-gray-700 p-4 w-[280px]">
          <div className="space-y-3">
            <div className="flex items-start justify-between pb-2 border-b border-gray-200 dark:border-gray-700">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-2">
                  <User className="w-5 h-5 text-green-500" />
                  <span className="px-2 py-1 rounded text-xs font-semibold bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300">
                    Online
                  </span>
                </div>
                <h3 className="font-bold text-base text-gray-900 dark:text-white mb-1">
                  {selectedItem.name}
                </h3>
                <p className="text-xs text-gray-600 dark:text-gray-400 capitalize">
                  {selectedItem.userType}
                </p>
              </div>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setSelectedItem(null);
                  setSelectedType(null);
                }}
                className="ml-2 p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors flex-shrink-0"
              >
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>

            {userLocation && (
              <div className="p-2.5 bg-blue-50 dark:bg-blue-900/20 rounded">
                <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Distance from you</p>
                <p className="font-bold text-base text-gray-900 dark:text-white">
                  {calculateDistance(
                    userLocation.lat,
                    userLocation.lng,
                    selectedItem.location.lat,
                    selectedItem.location.lng
                  ).toFixed(1)} km away
                </p>
              </div>
            )}

            <div className="p-2.5 bg-gray-50 dark:bg-gray-700/50 rounded">
              <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Last Updated</p>
              <p className="text-sm font-semibold text-gray-900 dark:text-white">
                {new Date(selectedItem.lastUpdate).toLocaleTimeString()}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Clear Route Button */}
      {showingRoute && (
        <div className="absolute top-4 left-4 z-[1002]">
          <button
            onClick={clearRoute}
            className="glassmorphism px-4 py-2 rounded-lg shadow-xl text-sm font-semibold text-gray-900 dark:text-white hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors flex items-center gap-2"
          >
            <X className="w-4 h-4" />
            Clear Route
          </button>
        </div>
      )}
      
      {/* Enhanced legend with online users */}
      <div className="absolute bottom-4 left-4 glassmorphism p-4 rounded-lg shadow-xl max-w-xs">
        <div className="flex items-center gap-2 mb-3 pb-2 border-b border-gray-300 dark:border-gray-600">
          <MapPin className="w-4 h-4 text-primary-600" />
          <h4 className="font-semibold text-sm text-gray-900 dark:text-white">Map Legend</h4>
        </div>
        
        <div className="space-y-3">
          <div>
            <p className="text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1.5">📍 Alert Types</p>
            <div className="space-y-1.5">
              <div className="flex items-center gap-2">
                <div className="w-5 h-5 rounded-full bg-blue-500 flex items-center justify-center">
                  <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M12 2L4 5v6.09c0 5.05 3.41 9.76 8 10.91 4.59-1.15 8-5.86 8-10.91V5l-8-3z"/>
                  </svg>
                </div>
                <span className="text-xs text-gray-700 dark:text-gray-300">Police Emergency</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-5 h-5 rounded-full bg-red-500 flex items-center justify-center">
                  <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M19 3H5c-1.1 0-1.99.9-1.99 2L3 19c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-1 11h-4v4h-4v-4H6v-4h4V6h4v4h4v4z"/>
                  </svg>
                </div>
                <span className="text-xs text-gray-700 dark:text-gray-300">Medical Emergency</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-5 h-5 rounded-full bg-orange-500 flex items-center justify-center">
                  <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M12 23s-8-4.5-8-11.8C4 5 8 1 12 1s8 4 8 10.2c0 7.3-8 11.8-8 11.8zm1-18v8l4-4c0 4-2 6-5 8 1-4-2-6-2-6l1-6z"/>
                  </svg>
                </div>
                <span className="text-xs text-gray-700 dark:text-gray-300">Fire Emergency</span>
              </div>
                <div className="flex items-center gap-2">
                <div className="w-5 h-5 rounded-full bg-orange-500 flex items-center justify-center">
                  <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M12 23s-8-4.5-8-11.8C4 5 8 1 12 1s8 4 8 10.2c0 7.3-8 11.8-8 11.8zm1-18v8l4-4c0 4-2 6-5 8 1-4-2-6-2-6l1-6z"/>
                  </svg>
                </div>
                <span className="text-xs text-gray-700 dark:text-gray-300">Fire Alert</span>
              </div>
            </div>
          </div>

          <div className="pt-2 border-t border-gray-300 dark:border-gray-600">
            <p className="text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1.5">🟢 Online Users</p>
            <div className="space-y-1.5">
              <div className="flex items-center gap-2">
                <div className="w-5 h-5 rounded-full bg-green-500 animate-pulse flex items-center justify-center">
                  <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/>
                  </svg>
                </div>
                <span className="text-xs text-gray-700 dark:text-gray-300">Citizens</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-5 h-5 rounded-full bg-blue-500 animate-pulse flex items-center justify-center">
                  <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M12 2L4 5v6.09c0 5.05 3.41 9.76 8 10.91 4.59-1.15 8-5.86 8-10.91V5l-8-3z"/>
                  </svg>
                </div>
                <span className="text-xs text-gray-700 dark:text-gray-300">Police Officers</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-5 h-5 rounded-full bg-red-500 animate-pulse flex items-center justify-center">
                  <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M19 3H5c-1.1 0-1.99.9-1.99 2L3 19c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-1 11h-4v4h-4v-4H6v-4h4V6h4v4h4v4z"/>
                  </svg>
                </div>
                <span className="text-xs text-gray-700 dark:text-gray-300">Medical Staff</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-5 h-5 rounded-full bg-orange-500 animate-pulse flex items-center justify-center">
                  <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M12 23s-8-4.5-8-11.8C4 5 8 1 12 1s8 4 8 10.2c0 7.3-8 11.8-8 11.8zm1-18v8l4-4c0 4-2 6-5 8 1-4-2-6-2-6l1-6z"/>
                  </svg>
                </div>
                <span className="text-xs text-gray-700 dark:text-gray-300">Firefighters</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Stats badge */}
      <div className="absolute top-4 left-4 glassmorphism rounded-lg shadow-xl overflow-hidden">
        <div className="px-4 py-2 space-y-1">
          <div className="flex items-center gap-2">
            <MapPin className="w-4 h-4 text-red-500" />
            <span className="font-semibold text-sm text-gray-900 dark:text-white">
              {alerts.length} Active Alert{alerts.length !== 1 ? 's' : ''}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Users className="w-4 h-4 text-green-500" />
            <span className="font-semibold text-sm text-gray-900 dark:text-white">
              {onlineUsers.length} Online User{onlineUsers.length !== 1 ? 's' : ''}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LiveMap;
