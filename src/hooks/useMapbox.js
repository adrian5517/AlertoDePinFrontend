import { useEffect, useRef, useState } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { useAuth } from '../context/AuthContext';

// Mapbox access token (read from Vite env variable)
mapboxgl.accessToken = import.meta.env.VITE_MAPBOX_TOKEN || '';

export const useMapbox = (containerId, options = {}) => {
  const mapRef = useRef(null);
  const [map, setMap] = useState(null);
  const markersRef = useRef([]);
  const { darkMode } = useAuth();

  useEffect(() => {
    if (!containerId) return;

    const defaultOptions = {
      container: containerId,
      style: darkMode 
        ? 'mapbox://styles/mapbox/dark-v11' 
        : 'mapbox://styles/mapbox/streets-v12',
      center: [123.1816, 13.6218], // Naga City, Camarines Sur coordinates
      zoom: 13,
      ...options,
    };

    const mapInstance = new mapboxgl.Map(defaultOptions);
    
    // Add navigation controls
    mapInstance.addControl(new mapboxgl.NavigationControl(), 'top-right');
    
    // Add geolocation control with high accuracy settings
    const geolocateControl = new mapboxgl.GeolocateControl({
      positionOptions: {
        enableHighAccuracy: true,  // Use GPS instead of WiFi/Cell tower
        timeout: 10000,            // Wait up to 10 seconds
        maximumAge: 0              // Don't use cached location
      },
      trackUserLocation: true,      // Keep tracking user position
      showUserHeading: true,        // Show direction user is facing
      showUserLocation: true,       // Show blue dot for user location
      fitBoundsOptions: {
        maxZoom: 16                // Zoom level when location is found
      }
    });
    
    mapInstance.addControl(geolocateControl, 'top-right');
    
    // Automatically trigger geolocation on load
    mapInstance.on('load', () => {
      geolocateControl.trigger();
    });

    mapRef.current = mapInstance;
    setMap(mapInstance);

    return () => {
      mapInstance.remove();
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

    const marker = new mapboxgl.Marker(markerElement, markerConstructorOptions)
      .setLngLat(coordinates)
      .addTo(map);

    if (popup) {
      marker.setPopup(
        new mapboxgl.Popup({ offset: 25 }).setHTML(popup)
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
  };
};
