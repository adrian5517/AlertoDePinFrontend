import { useEffect, useRef, useState } from 'react';
import { useAuth } from '../context/AuthContext';

// We will dynamically import mapbox-gl to allow code-splitting and
// reduce initial bundle size. A `mapbox` ref will be exposed so
// consumers can access Mapbox constructors when available.

// Mapbox access token will be set on the dynamically-loaded module.

export const useMapbox = (containerId, options = {}) => {
  const mapRef = useRef(null);
  const [map, setMap] = useState(null);
  const mapboxRef = useRef(null);
  const markersRef = useRef([]);
  const { darkMode } = useAuth();

  useEffect(() => {
    if (!containerId) return;

    let mounted = true;

    const defaultOptions = {
      container: containerId,
      style: darkMode 
        ? 'mapbox://styles/mapbox/dark-v11' 
        : 'mapbox://styles/mapbox/streets-v12',
      center: [123.1816, 13.6218], // Naga City, Camarines Sur coordinates
      zoom: 13,
      ...options,
    };

    const initMap = async () => {
      try {
        const mapboxModule = await import('mapbox-gl');
        await import('mapbox-gl/dist/mapbox-gl.css');

        if (!mounted) return;

        mapboxModule.accessToken = import.meta.env.VITE_MAPBOX_TOKEN || '';
        mapboxRef.current = mapboxModule;

        const mapInstance = new mapboxModule.Map(defaultOptions);

        // Add navigation controls
        mapInstance.addControl(new mapboxModule.NavigationControl(), 'top-right');

        // Add geolocation control with high accuracy settings
        const geolocateControl = new mapboxModule.GeolocateControl({
          positionOptions: {
            enableHighAccuracy: true,
            timeout: 10000,
            maximumAge: 0
          },
          trackUserLocation: true,
          showUserHeading: true,
          showUserLocation: true,
          fitBoundsOptions: {
            maxZoom: 16
          }
        });

        mapInstance.addControl(geolocateControl, 'top-right');

        mapInstance.on('load', () => {
          geolocateControl.trigger();
        });

        mapRef.current = mapInstance;
        setMap(mapInstance);
      } catch (err) {
        console.error('Failed to load mapbox-gl dynamically:', err);
      }
    };

    initMap();

    return () => {
      mounted = false;
      if (mapRef.current) {
        try {
          mapRef.current.remove();
        } catch (e) {
          console.warn('Error removing map instance during cleanup', e);
        }
        mapRef.current = null;
        setMap(null);
      }
      mapboxRef.current = null;
    };
  }, [containerId, darkMode]);

  // Update map style when dark mode changes
  useEffect(() => {
    if (map) {
      const newStyle = darkMode 
        ? 'mapbox://styles/mapbox/dark-v11' 
        : 'mapbox://styles/mapbox/streets-v12';
      map.setStyle(newStyle);
    }
  }, [map, darkMode]);

  const addMarker = (coordinates, options = {}) => {
    if (!map) return null;

    const { color = '#EF4444', popup, element, ...markerOptions } = options;

    let markerElement;
    
    if (element) {
      // Use custom element if provided
      markerElement = element;
    } else {
      // Create default circular marker
      markerElement = document.createElement('div');
      markerElement.className = 'custom-marker';
      markerElement.style.backgroundColor = color;
      markerElement.style.width = '30px';
      markerElement.style.height = '30px';
      markerElement.style.borderRadius = '50%';
      markerElement.style.border = '3px solid white';
      markerElement.style.boxShadow = '0 2px 4px rgba(0,0,0,0.3)';
      markerElement.style.cursor = 'pointer';
    }

    // If a custom element is provided, default the anchor to 'bottom'
    const markerConstructorOptions = { ...markerOptions };
    if (element) {
      markerConstructorOptions.anchor = markerConstructorOptions.anchor || 'bottom';
    }

    const Mapbox = mapboxRef.current;
    if (!Mapbox) return null;

    const marker = new Mapbox.Marker(markerElement, markerConstructorOptions)
      .setLngLat(coordinates)
      .addTo(map);

    if (popup) {
      marker.setPopup(
        new Mapbox.Popup({ offset: 25 }).setHTML(popup)
      );
    }

    markersRef.current.push(marker);
    return marker;
  };

  const clearMarkers = () => {
    (markersRef.current || []).forEach(marker => marker.remove());
    markersRef.current = [];
  };

  const flyTo = (coordinates, zoom = 14) => {
    if (!map) return;
    map.flyTo({ center: coordinates, zoom, duration: 2000 });
  };

  return {
    map,
    addMarker,
    clearMarkers,
    flyTo,
    markers: markersRef,
    mapbox: mapboxRef,
  };
};
