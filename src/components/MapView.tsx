// src/components/MapView.tsx
'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Loader } from '@googlemaps/js-api-loader';
import type { GooglePlace, Coordinates, WeatherData } from '@/types';
import { calculateWeatherSuitability } from '@/lib/geoUtils';
import { getCategoryForPlace } from '@/lib/activityMapper';
import {
  Map as MapIcon, Layers, Maximize2, Minimize2, Navigation2,
  MapPin, Star, TrendingUp, X, ChevronRight, Sparkles,
  Utensils, Coffee, ShoppingBag, TreePine, Gamepad2, Book,
  Palette, Heart, Flame, Zap, Shield
} from 'lucide-react';

interface MapViewProps {
  places: GooglePlace[];
  userCoordinates: Coordinates | null;
  weatherData: WeatherData | null;
  onPlaceSelect: (placeId: string) => void;
  isDarkTheme?: boolean;
}

// Category icons mapping (matching ActivityList)
const categoryIcons: Record<string, React.ComponentType<any>> = {
  'Food & Drink': Utensils,
  'Shopping': ShoppingBag,
  'Outdoor Active': TreePine,
  'Outdoor Relax': Coffee,
  'Indoor Active': Gamepad2,
  'Indoor Relax': Book,
  'Culture & Entertainment': Palette,
};

// Score-based marker colors
const getMarkerColor = (score: number): string => {
  if (score >= 85) return '#f97316'; // orange-500 (perfect)
  if (score >= 75) return '#eab308'; // yellow-500 (excellent)
  if (score >= 65) return '#22c55e'; // green-500 (great)
  if (score >= 55) return '#3b82f6'; // blue-500 (good)
  return '#9ca3af'; // gray-400 (fair)
};

const getScoreLabel = (score: number): string => {
  if (score >= 85) return 'Perfect';
  if (score >= 75) return 'Excellent';
  if (score >= 65) return 'Great';
  if (score >= 55) return 'Good';
  return 'Fair';
};

const getScoreIcon = (score: number) => {
  if (score >= 85) return Flame;
  if (score >= 75) return Zap;
  if (score >= 65) return TrendingUp;
  return Shield;
};

export default function MapView({
  places,
  userCoordinates,
  weatherData,
  onPlaceSelect,
  isDarkTheme = false,
}: MapViewProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const googleMapRef = useRef<google.maps.Map | null>(null);
  const markersRef = useRef<google.maps.marker.AdvancedMarkerElement[]>([]);
  const userMarkerRef = useRef<google.maps.marker.AdvancedMarkerElement | null>(null);
  const infoWindowRef = useRef<google.maps.InfoWindow | null>(null);
  const isInitializedRef = useRef(false); // ← ADD THIS LINE HERE
  
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [selectedPlace, setSelectedPlace] = useState<GooglePlace | null>(null);
  const [mapStyle, setMapStyle] = useState<'roadmap' | 'terrain' | 'satellite'>('roadmap');

console.log('=== DEBUG INFO ===');
console.log('API Key from env:', process.env.NEXT_PUBLIC_MAPS_API_KEY);
console.log('API Key exists?', !!process.env.NEXT_PUBLIC_MAPS_API_KEY);
console.log('API Key length:', process.env.NEXT_PUBLIC_MAPS_API_KEY?.length);
console.log('==================');

  // Initialize Google Maps
  useEffect(() => {
    const initMap = async () => {
      if (!mapRef.current || !userCoordinates) return;
      
      // Prevent multiple initializations
      if (isInitializedRef.current) {
        console.log('Map already initialized, skipping...');
        return;
      }
      
      try {
        setIsLoading(true);
        const apiKey = process.env.NEXT_PUBLIC_MAPS_API_KEY;
        
        if (!apiKey) {
          throw new Error('API key not found');
        }
        
        const loader = new Loader({
          apiKey: apiKey,
          version: 'weekly',
          libraries: ['marker'],
        });
        
        await loader.load();
        
        // Mark as initialized BEFORE creating the map
        isInitializedRef.current = true;
        
        const { Map } = await google.maps.importLibrary('maps') as google.maps.MapsLibrary;
        const { AdvancedMarkerElement, PinElement } = await google.maps.importLibrary('marker') as google.maps.MarkerLibrary;

        // Create map with modern styling
        const map = new Map(mapRef.current, {
          center: { lat: userCoordinates.latitude, lng: userCoordinates.longitude },
          zoom: 14,
          mapId: isDarkTheme ? 'DEMO_MAP_ID_DARK' : 'DEMO_MAP_ID',
          disableDefaultUI: true,
          zoomControl: true,
          mapTypeControl: false,
          streetViewControl: false,
          fullscreenControl: false,
          gestureHandling: 'greedy',
        });

        googleMapRef.current = map;

        // Create user location marker with pulsing effect
        const userPin = new PinElement({
          background: '#3b82f6',
          borderColor: '#ffffff',
          glyphColor: '#ffffff',
          scale: 1.3,
        });

        const userMarker = new AdvancedMarkerElement({
          map,
          position: { lat: userCoordinates.latitude, lng: userCoordinates.longitude },
          content: userPin.element,
          title: 'Your Location',
        });

        userMarkerRef.current = userMarker;

        // Create info window
        infoWindowRef.current = new google.maps.InfoWindow();

        setIsLoading(false);
      } catch (error) {
        console.error('Error initializing map:', error);
        console.error('Error details:', {
          message: error instanceof Error ? error.message : 'Unknown error',
          stack: error instanceof Error ? error.stack : undefined,
          apiKey: process.env.NEXT_PUBLIC_MAPS_API_KEY?.substring(0, 10) + '...'
        });
        setLoadError(`Failed to load map: ${error instanceof Error ? error.message : 'Unknown error'}`);
        setIsLoading(false);
        isInitializedRef.current = false; // Reset on error
      }
    };

    initMap();

    return () => {
      // Cleanup
      isInitializedRef.current = false; // Reset on cleanup
      markersRef.current.forEach(marker => {
        marker.map = null;
      });
      if (userMarkerRef.current) {
        userMarkerRef.current.map = null;
      }
    };
  }, [userCoordinates, isDarkTheme]);

  // Update markers when places change
  useEffect(() => {
    if (!googleMapRef.current || !weatherData) return;

    const updateMarkers = async () => {
      const { AdvancedMarkerElement, PinElement } = await google.maps.importLibrary('marker') as google.maps.MarkerLibrary;

      // Clear existing markers
      markersRef.current.forEach(marker => {
        marker.map = null;
      });
      markersRef.current = [];

      // Create markers for places
      places.forEach(place => {
        if (!place.location) return;

        const distance = place.distance || 0;
        const score = calculateWeatherSuitability(
          { ...place, distance },
          weatherData
        );

        const category = getCategoryForPlace(place);
        const categoryName = category?.valueOf() || 'Other';
        
        // Create custom pin with score-based color
        const pin = new PinElement({
          background: getMarkerColor(score),
          borderColor: '#ffffff',
          glyphColor: '#ffffff',
          scale: 1.2,
        });

        const marker = new AdvancedMarkerElement({
          map: googleMapRef.current,
          position: { lat: place.location.latitude, lng: place.location.longitude },
          content: pin.element,
          title: place.displayName?.text || 'Unknown',
        });

        // Add click listener
        marker.addListener('click', () => {
          setSelectedPlace(place);
          
          // Show info window
          if (infoWindowRef.current) {
            const content = createInfoWindowContent(place, score, categoryName);
            infoWindowRef.current.setContent(content);
            infoWindowRef.current.open(googleMapRef.current, marker);
          }
        });

        markersRef.current.push(marker);
      });
    };

    updateMarkers();
  }, [places, weatherData]);

  // Create info window content
  const createInfoWindowContent = (place: GooglePlace, score: number, category: string): string => {
    const Icon = getScoreIcon(score);
    
    return `
      <div style="padding: 12px; max-width: 280px; font-family: system-ui, -apple-system, sans-serif;">
        <div style="display: flex; align-items: start; gap: 12px; margin-bottom: 12px;">
          <div style="flex: 1;">
            <h3 style="margin: 0 0 4px 0; font-size: 16px; font-weight: 600; color: #111827;">
              ${place.displayName?.text || 'Unknown Place'}
            </h3>
            <p style="margin: 0; font-size: 12px; color: #6b7280;">
              ${category}
            </p>
          </div>
          <div style="text-align: right;">
            <div style="font-size: 20px; font-weight: bold; color: ${getMarkerColor(score)};">
              ${score}
            </div>
            <div style="font-size: 10px; color: #6b7280; text-transform: uppercase;">
              ${getScoreLabel(score)}
            </div>
          </div>
        </div>
        
        ${place.rating ? `
          <div style="display: flex; align-items: center; gap: 4px; margin-bottom: 8px;">
            <span style="color: #facc15;">★</span>
            <span style="font-weight: 600; font-size: 14px;">${place.rating.toFixed(1)}</span>
            <span style="font-size: 12px; color: #6b7280;">
              (${place.userRatingCount?.toLocaleString() || 0} reviews)
            </span>
          </div>
        ` : ''}
        
        ${place.formattedAddress ? `
          <p style="margin: 0 0 12px 0; font-size: 12px; color: #6b7280; line-height: 1.4;">
            ${place.formattedAddress}
          </p>
        ` : ''}
        
        <button 
          onclick="window.dispatchEvent(new CustomEvent('place-select', { detail: '${place.id}' }))"
          style="
            width: 100%;
            padding: 8px 16px;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            border: none;
            border-radius: 8px;
            font-weight: 600;
            font-size: 14px;
            cursor: pointer;
            transition: transform 0.2s;
          "
          onmouseover="this.style.transform='scale(1.02)'"
          onmouseout="this.style.transform='scale(1)'"
        >
          View Details →
        </button>
      </div>
    `;
  };

  // Listen for place selection from info window
  useEffect(() => {
    const handlePlaceSelect = (event: CustomEvent) => {
      onPlaceSelect(event.detail);
      setSelectedPlace(null);
    };

    window.addEventListener('place-select' as any, handlePlaceSelect);
    return () => {
      window.removeEventListener('place-select' as any, handlePlaceSelect);
    };
  }, [onPlaceSelect]);

  // Recenter map on user location
  const handleRecenter = useCallback(() => {
    if (googleMapRef.current && userCoordinates) {
      googleMapRef.current.panTo({
        lat: userCoordinates.latitude,
        lng: userCoordinates.longitude,
      });
      googleMapRef.current.setZoom(14);
    }
  }, [userCoordinates]);

  // Toggle fullscreen
  const toggleFullscreen = useCallback(() => {
    setIsFullscreen(prev => !prev);
  }, []);

  // Change map style
  const handleMapStyleChange = useCallback((style: 'roadmap' | 'terrain' | 'satellite') => {
    if (googleMapRef.current) {
      googleMapRef.current.setMapTypeId(style);
      setMapStyle(style);
    }
  }, []);

  const containerClasses = isFullscreen
    ? 'fixed inset-0 z-50'
    : 'relative w-full rounded-2xl overflow-hidden border border-white/20 shadow-2xl';

  const heightClasses = isFullscreen ? 'h-screen' : 'h-[600px]';

  return (
    <div className={containerClasses}>
      {/* Map Container */}
      <div className={`relative ${heightClasses} w-full`}>
        <div ref={mapRef} className="absolute inset-0" />

        {/* Loading Overlay */}
        {isLoading && (
          <div className="absolute inset-0 flex items-center justify-center bg-gray-900/80 backdrop-blur-sm">
            <div className="text-center">
              <div className="w-16 h-16 border-4 border-white/20 border-t-white/60 rounded-full animate-spin mx-auto mb-4" />
              <p className="text-white font-medium">Loading map...</p>
            </div>
          </div>
        )}

        {/* Error Overlay */}
        {loadError && (
          <div className="absolute inset-0 flex items-center justify-center bg-gray-900/80 backdrop-blur-sm">
            <div className="text-center text-red-400 max-w-md p-6">
              <X className="w-12 h-12 mx-auto mb-4" />
              <p className="font-medium mb-2">Failed to load map</p>
              <p className="text-sm opacity-80">{loadError}</p>
            </div>
          </div>
        )}

        {/* Map Controls */}
        {!isLoading && !loadError && (
          <>
            {/* Top Controls */}
            <div className="absolute top-4 left-4 right-4 flex items-center justify-between gap-2 pointer-events-none">
              {/* Map Style Selector */}
              <div className="flex gap-2 pointer-events-auto">
                {(['roadmap', 'terrain', 'satellite'] as const).map((style) => (
                  <button
                    key={style}
                    onClick={() => handleMapStyleChange(style)}
                    className={`px-4 py-2 rounded-xl font-medium text-sm transition-all shadow-lg backdrop-blur-md ${
                      mapStyle === style
                        ? 'bg-white text-gray-900'
                        : isDarkTheme
                        ? 'bg-gray-900/80 text-white hover:bg-gray-900/90'
                        : 'bg-white/80 text-gray-900 hover:bg-white/90'
                    }`}
                  >
                    {style.charAt(0).toUpperCase() + style.slice(1)}
                  </button>
                ))}
              </div>

              {/* Info Badge */}
              <div className={`px-4 py-2 rounded-xl font-medium text-sm shadow-lg backdrop-blur-md pointer-events-auto ${
                isDarkTheme ? 'bg-gray-900/80 text-white' : 'bg-white/80 text-gray-900'
              }`}>
                {places.length} places nearby
              </div>
            </div>

            {/* Bottom Right Controls */}
            <div className="absolute bottom-4 right-4 flex flex-col gap-2 pointer-events-auto">
              {/* Recenter Button */}
              <button
                onClick={handleRecenter}
                className={`p-3 rounded-xl shadow-lg backdrop-blur-md transition-all hover:scale-105 ${
                  isDarkTheme
                    ? 'bg-gray-900/80 text-white hover:bg-gray-900/90'
                    : 'bg-white/80 text-gray-900 hover:bg-white/90'
                }`}
                title="Recenter on your location"
              >
                <Navigation2 className="w-5 h-5" />
              </button>

              {/* Fullscreen Button */}
              <button
                onClick={toggleFullscreen}
                className={`p-3 rounded-xl shadow-lg backdrop-blur-md transition-all hover:scale-105 ${
                  isDarkTheme
                    ? 'bg-gray-900/80 text-white hover:bg-gray-900/90'
                    : 'bg-white/80 text-gray-900 hover:bg-white/90'
                }`}
                title={isFullscreen ? 'Exit fullscreen' : 'Enter fullscreen'}
              >
                {isFullscreen ? (
                  <Minimize2 className="w-5 h-5" />
                ) : (
                  <Maximize2 className="w-5 h-5" />
                )}
              </button>
            </div>

            {/* Legend */}
            <div className={`absolute bottom-4 left-4 p-4 rounded-xl shadow-lg backdrop-blur-md ${
              isDarkTheme ? 'bg-gray-900/80 text-white' : 'bg-white/80 text-gray-900'
            }`}>
              <h4 className="text-xs font-semibold mb-3 opacity-60 uppercase tracking-wide">
                Match Score
              </h4>
              <div className="space-y-2">
                {[
                  { label: 'Perfect', color: '#f97316', min: 85 },
                  { label: 'Excellent', color: '#eab308', min: 75 },
                  { label: 'Great', color: '#22c55e', min: 65 },
                  { label: 'Good', color: '#3b82f6', min: 55 },
                  { label: 'Fair', color: '#9ca3af', min: 0 },
                ].map((item) => (
                  <div key={item.label} className="flex items-center gap-2">
                    <div
                      className="w-3 h-3 rounded-full"
                      style={{ backgroundColor: item.color }}
                    />
                    <span className="text-xs font-medium">
                      {item.label} ({item.min}+)
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Close Fullscreen Button (when in fullscreen) */}
            {isFullscreen && (
              <button
                onClick={toggleFullscreen}
                className={`absolute top-4 right-4 p-3 rounded-xl shadow-lg backdrop-blur-md transition-all hover:scale-105 ${
                  isDarkTheme
                    ? 'bg-gray-900/80 text-white hover:bg-gray-900/90'
                    : 'bg-white/80 text-gray-900 hover:bg-white/90'
                }`}
              >
                <X className="w-5 h-5" />
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
}