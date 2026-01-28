import { useEffect, useRef, useState } from 'react';
import { useMapbox } from '../hooks/useMapbox';
import { Navigation, MapPin, Clock, X } from 'lucide-react';

const MapboxMap = ({ alerts = [], onMarkerClick, className = '' }) => {
  const mapContainerRef = useRef(null);
  const { map, addMarker, clearMarkers, flyTo, mapbox } = useMapbox('map-container');
  const [userLocation, setUserLocation] = useState(null);
  const [selectedAlert, setSelectedAlert] = useState(null);
  const [showingRoute, setShowingRoute] = useState(false);

  // Get user location
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

  const handleNavigate = (alert) => {
    if (!map || !userLocation) return;
    
    // Use Mapbox Directions API to show route on the map
    const start = [userLocation.lng, userLocation.lat];
    const end = [alert.coordinates.lng, alert.coordinates.lat];
    
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
          if (!mapbox || !mapbox.current) return;
          const coordinates = route.coordinates;
          const bounds = coordinates.reduce((bounds, coord) => bounds.extend(coord), new mapbox.current.LngLatBounds(coordinates[0], coordinates[0]));
          
          map.fitBounds(bounds, {
            padding: 80
          });
          
          setShowingRoute(true);
        }
      })
      .catch(error => {
        console.error('Error fetching directions:', error);
        // Fallback to Google Maps if Mapbox Directions fails
        const destination = `${alert.coordinates.lat},${alert.coordinates.lng}`;
        const url = `https://www.google.com/maps/dir/?api=1&destination=${destination}`;
        window.open(url, '_blank');
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

  useEffect(() => {
    if (!map || !alerts.length) return;

    clearMarkers();

    alerts.forEach((alert) => {
      if (alert.coordinates) {
        // Custom pin HTML for each type with icons
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
          /* removed 'family' purple pin - fire uses orange pin */
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

        // Create custom marker element
        const el = document.createElement('div');
        el.innerHTML = pinHTML;
        el.className = 'custom-marker-wrapper';
        el.style.width = '40px';
        el.style.height = '56px';
        el.style.cursor = 'pointer';
        el.style.position = 'relative';
        el.style.zIndex = '1';

        // Click event to show details
        el.addEventListener('click', (e) => {
          e.stopPropagation();
          setSelectedAlert(alert);
          el.style.zIndex = '1000';
          if (onMarkerClick) {
            onMarkerClick(alert);
          }
        });

        const marker = addMarker([alert.coordinates.lng, alert.coordinates.lat], {
          element: el,
        });
      }
    });

    // Fly to first alert if available
    if (alerts[0]?.coordinates) {
      flyTo([alerts[0].coordinates.lng, alerts[0].coordinates.lat]);
    }
  }, [map, alerts, userLocation]);

  return (
    <div className={`relative ${className}`}>
      <div 
        ref={mapContainerRef}
        id="map-container" 
        className="w-full h-full rounded-lg shadow-lg"
        style={{ minHeight: '400px' }}
        onClick={() => setSelectedAlert(null)}
      />

      {/* Details Card - Shows on Click */}
      {selectedAlert && userLocation && (
        <div className="absolute top-4 right-4 z-[1001] bg-white dark:bg-gray-800 rounded-lg shadow-2xl border border-gray-200 dark:border-gray-700 p-4 w-[320px]">
          <div className="space-y-3">
            {/* Header with Close Button */}
            <div className="flex items-start justify-between pb-2 border-b border-gray-200 dark:border-gray-700">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-2">
                  <span className={`px-2 py-1 rounded text-xs font-bold uppercase ${
                    selectedAlert.type === 'police' ? 'bg-blue-500 text-white' :
                    selectedAlert.type === 'hospital' ? 'bg-red-500 text-white' :
                    selectedAlert.type === 'fire' ? 'bg-orange-500 text-white' :
                    'bg-gray-500 text-white'
                  }`}>
                    {selectedAlert.type}
                  </span>
                  <span className={`px-2 py-1 rounded text-xs font-semibold ${
                    selectedAlert.status === 'active' ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300' :
                    selectedAlert.status === 'pending' ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300' :
                    'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300'
                  }`}>
                    {selectedAlert.status}
                  </span>
                </div>
                <h3 className="font-bold text-base text-gray-900 dark:text-white mb-1">
                  {selectedAlert.title}
                </h3>
                <p className="text-xs text-gray-600 dark:text-gray-400 line-clamp-2">
                  {selectedAlert.description}
                </p>
              </div>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setSelectedAlert(null);
                }}
                className="ml-2 p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors flex-shrink-0"
              >
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>

            {/* Compact Details Grid */}
            <div className="grid grid-cols-2 gap-2">
              <div className="flex items-center gap-2 p-2.5 bg-blue-50 dark:bg-blue-900/20 rounded">
                <Navigation className="w-5 h-5 text-blue-500 flex-shrink-0" />
                <div className="min-w-0">
                  <p className="text-xs text-gray-500 dark:text-gray-400">Distance</p>
                  <p className="font-bold text-base text-gray-900 dark:text-white truncate">
                    {calculateDistance(
                      userLocation.lat,
                      userLocation.lng,
                      selectedAlert.coordinates.lat,
                      selectedAlert.coordinates.lng
                    ).toFixed(1)} km
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 p-2.5 bg-green-50 dark:bg-green-900/20 rounded">
                <Clock className="w-5 h-5 text-green-500 flex-shrink-0" />
                <div className="min-w-0">
                  <p className="text-xs text-gray-500 dark:text-gray-400">ETA</p>
                  <p className="font-bold text-base text-gray-900 dark:text-white truncate">
                    {calculateETA(
                      calculateDistance(
                        userLocation.lat,
                        userLocation.lng,
                        selectedAlert.coordinates.lat,
                        selectedAlert.coordinates.lng
                      )
                    )}
                  </p>
                </div>
              </div>
            </div>

            <div className="flex items-start gap-2 p-2.5 bg-gray-50 dark:bg-gray-700/50 rounded">
              <MapPin className="w-5 h-5 text-gray-500 dark:text-gray-400 mt-0.5 flex-shrink-0" />
              <div className="min-w-0 flex-1">
                <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Location</p>
                <p className="text-sm font-semibold text-gray-900 dark:text-white">
                  {typeof selectedAlert.location === 'string'
                    ? selectedAlert.location
                    : selectedAlert.location?.address || 'Location not specified'}
                </p>
              </div>
            </div>

            {selectedAlert.reporter && (
              <div className="p-2.5 bg-gray-50 dark:bg-gray-700/50 rounded">
                <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Reporter</p>
                <p className="text-sm font-semibold text-gray-900 dark:text-white">
                  {typeof selectedAlert.reporter === 'string'
                    ? selectedAlert.reporter
                    : selectedAlert.reporter?.name || 'Reporter'}
                </p>
              </div>
            )}

            {/* Navigate Buttons */}
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleNavigate(selectedAlert);
                }}
                className="btn-primary py-2.5 text-sm font-semibold flex items-center justify-center gap-1.5"
              >
                <Navigation className="w-4 h-4" />
                Show Route
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  const destination = `${selectedAlert.coordinates.lat},${selectedAlert.coordinates.lng}`;
                  const url = `https://www.google.com/maps/dir/?api=1&destination=${destination}`;
                  window.open(url, '_blank');
                }}
                className="bg-green-600 hover:bg-green-700 text-white py-2.5 px-2 rounded-lg transition-colors text-sm font-semibold flex items-center justify-center gap-1.5"
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

      {/* Clear Route Button */}
      {showingRoute && (
        <div className="absolute top-4 right-4 z-[1002] mt-[360px]">
          <button
            onClick={clearRoute}
            className="glassmorphism px-4 py-2 rounded-lg shadow-xl text-sm font-semibold text-gray-900 dark:text-white hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors flex items-center gap-2"
          >
            <X className="w-4 h-4" />
            Clear Route
          </button>
        </div>
      )}
      
      {/* Map legend */}
      <div className="absolute bottom-4 left-4 glassmorphism p-4 rounded-lg shadow-xl">
        <h4 className="font-semibold text-sm mb-2 text-gray-900 dark:text-white">Alert Types</h4>
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-blue-500"></div>
            <span className="text-xs text-gray-700 dark:text-gray-300">Police</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-red-500"></div>
            <span className="text-xs text-gray-700 dark:text-gray-300">Hospital</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-orange-500"></div>
            <span className="text-xs text-gray-700 dark:text-gray-300">Fire</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-orange-500"></div>
            <span className="text-xs text-gray-700 dark:text-gray-300">Fire</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-indigo-500"></div>
            <span className="text-xs text-gray-700 dark:text-gray-300">Other</span>
          </div>
        </div>
      </div>

      {/* Alert count badge */}
      {alerts.length > 0 && (
        <div className="absolute top-4 left-4 glassmorphism px-4 py-2 rounded-lg shadow-xl">
          <span className="font-semibold text-gray-900 dark:text-white">
            {alerts.length} Active Alert{alerts.length !== 1 ? 's' : ''}
          </span>
        </div>
      )}
    </div>
  );
};

export default MapboxMap;
