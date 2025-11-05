// src/components/MapView.tsx
'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Loader } from '@googlemaps/js-api-loader';
import type { GooglePlace, Coordinates, WeatherData } from '@/types';
import { calculateWeatherSuitability, formatDistance } from '@/lib/geoUtils';
import { getCategoryForPlace } from '@/lib/activityMapper';
import ActivityDetailModal from './ActivityDetailModal';
import {
  Map as MapIcon, Layers, Maximize2, Minimize2, Navigation2,
  MapPin, Star, TrendingUp, X, ChevronRight, Sparkles,
  Utensils, Coffee, ShoppingBag, TreePine, Gamepad2, Book,
  Palette, Heart, Flame, Zap, Shield, Info, Award, Clock,
  DollarSign, Users, Eye
} from 'lucide-react';

interface MapViewProps {
  places: GooglePlace[];
  userCoordinates: Coordinates | null;
  weatherData: WeatherData | null;
  isDarkTheme?: boolean;
}

// Category icon mapping
const categoryIcons: Record<string, React.ComponentType<any>> = {
  'Food & Drink': Utensils,
  'Shopping': ShoppingBag,
  'Outdoor Active': TreePine,
  'Outdoor Relax': Coffee,
  'Indoor Active': Gamepad2,
  'Indoor Relax': Book,
  'Culture & Entertainment': Palette,
  'Other': Sparkles,
};

// Score-based marker colors with enhanced palette
const getMarkerColor = (score: number): string => {
  if (score >= 85) return '#f97316'; // orange-500 (perfect)
  if (score >= 75) return '#eab308'; // yellow-500 (excellent)
  if (score >= 65) return '#22c55e'; // green-500 (great)
  if (score >= 55) return '#3b82f6'; // blue-500 (good)
  return '#9ca3af'; // gray-400 (fair)
};

const getScoreGradient = (score: number): string => {
  if (score >= 85) return 'from-orange-400 to-red-500';
  if (score >= 75) return 'from-yellow-400 to-orange-400';
  if (score >= 65) return 'from-green-400 to-emerald-500';
  if (score >= 55) return 'from-blue-400 to-cyan-500';
  return 'from-gray-400 to-gray-500';
};

const getScoreLabel = (score: number): string => {
  if (score >= 85) return 'Perfect Match';
  if (score >= 75) return 'Excellent';
  if (score >= 65) return 'Great';
  if (score >= 55) return 'Good';
  return 'Fair';
};

const getScoreIcon = (score: number): React.ComponentType<any> => {
  if (score >= 85) return Flame;
  if (score >= 75) return Zap;
  if (score >= 65) return Award;
  if (score >= 55) return TrendingUp;
  return Shield;
};

// Price level indicator
const PriceIndicator: React.FC<{ priceLevel?: string }> = ({ priceLevel }) => {
  const getCount = () => {
    switch (priceLevel) {
      case 'PRICE_LEVEL_FREE': return 0;
      case 'PRICE_LEVEL_INEXPENSIVE': return 1;
      case 'PRICE_LEVEL_MODERATE': return 2;
      case 'PRICE_LEVEL_EXPENSIVE': return 3;
      case 'PRICE_LEVEL_VERY_EXPENSIVE': return 4;
      default: return 0;
    }
  };
  
  const count = getCount();
  if (count === 0 && priceLevel !== 'PRICE_LEVEL_FREE') return null;
  
  return (
    <div className="flex items-center gap-1">
      {priceLevel === 'PRICE_LEVEL_FREE' ? (
        <span className="px-2 py-0.5 bg-green-500/20 text-green-600 rounded-full text-xs font-bold">
          FREE
        </span>
      ) : (
        <div className="flex items-center">
          {[...Array(4)].map((_, i) => (
            <DollarSign
              key={i}
              className={`w-3 h-3 ${
                i < count ? 'text-green-500' : 'text-gray-400/30'
              }`}
            />
          ))}
        </div>
      )}
    </div>
  );
};

export default function MapView({
  places,
  userCoordinates,
  weatherData,
  isDarkTheme = false,
}: MapViewProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const googleMapRef = useRef<google.maps.Map | null>(null);
  const markersRef = useRef<google.maps.marker.AdvancedMarkerElement[]>([]);
  const userMarkerRef = useRef<google.maps.marker.AdvancedMarkerElement | null>(null);
  const infoWindowRef = useRef<google.maps.InfoWindow | null>(null);
  
  // Store the marker library reference
  const markerLibRef = useRef<google.maps.MarkerLibrary | null>(null);
  
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [selectedPlaceId, setSelectedPlaceId] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [mapStyle, setMapStyle] = useState<'roadmap' | 'terrain' | 'satellite'>('roadmap');
  const [isMapReady, setIsMapReady] = useState(false);

  // Initialize Google Maps once
  useEffect(() => {
    let mounted = true;

    const initMap = async () => {
      if (!mapRef.current || !userCoordinates || googleMapRef.current) {
        return;
      }
      
      try {
        setIsLoading(true);
        const apiKey = process.env.NEXT_PUBLIC_MAPS_API_KEY;
        
        if (!apiKey) {
          throw new Error('Google Maps API key not found');
        }
        
        console.log('🗺️ Starting map initialization...');
        
        const loader = new Loader({
          apiKey: apiKey,
          version: 'weekly',
          libraries: ['marker'],
        });
        
        await loader.load();
        console.log('✅ Google Maps script loaded');
        
        const { Map } = await google.maps.importLibrary('maps') as google.maps.MapsLibrary;
        const markerLib = await google.maps.importLibrary('marker') as google.maps.MarkerLibrary;
        
        // Store marker library reference for later use
        markerLibRef.current = markerLib;
        console.log('✅ Marker library loaded');

        if (!mounted) return;

        // Create map
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
        console.log('✅ Map created');

        // Create user location marker
        const { PinElement, AdvancedMarkerElement } = markerLib;
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
        console.log('✅ User marker created');

        // Create info window
        infoWindowRef.current = new google.maps.InfoWindow();

        setIsLoading(false);
        setIsMapReady(true);
        console.log('✅ Map initialization complete - Ready for markers');
      } catch (error) {
        console.error('❌ Error initializing map:', error);
        if (mounted) {
          setLoadError(`Failed to load map: ${error instanceof Error ? error.message : 'Unknown error'}`);
          setIsLoading(false);
        }
      }
    };

    initMap();

    return () => {
      mounted = false;
    };
  }, [userCoordinates?.latitude, userCoordinates?.longitude, isDarkTheme]);

  // Update markers when places change
  useEffect(() => {
    if (!isMapReady || !googleMapRef.current || !markerLibRef.current || !weatherData || places.length === 0) {
      console.log('⏸️ Skipping marker update:', {
        isMapReady,
        hasMap: !!googleMapRef.current,
        hasMarkerLib: !!markerLibRef.current,
        hasWeather: !!weatherData,
        placesCount: places.length,
      });
      return;
    }

    console.log('🎯 Starting marker update for', places.length, 'places');
    console.log('Sample place data:', places[0]); // Debug: see structure

    const updateMarkers = () => {
      try {
        const { AdvancedMarkerElement, PinElement } = markerLibRef.current!;

        // Clear existing markers
        console.log('🧹 Clearing', markersRef.current.length, 'existing markers');
        markersRef.current.forEach(marker => {
          marker.map = null;
        });
        markersRef.current = [];

        // Place types that are typically always accessible (no opening hours needed)
        const alwaysAccessibleTypes = new Set([
          'park',
          'playground',
          'hiking_area',
          'beach',
          'viewpoint',
          'tourist_attraction',
          'natural_feature',
          'campground',
          'dog_park',
          'garden',
          'plaza',
          'picnic_ground',
          'marina',
          'trail',
          'monument',
          'landmark',
          'stadium',
          'sports_complex',
          'golf_course'
        ]);

        // Filter to only show open places or always-accessible venues
        const openPlaces = places.filter(place => {
          const placeDetails = place as any;
          
          // Debug: log place info
          console.log(`Checking place: ${place.displayName?.text}`);
          console.log(`  Types:`, place.types);
          console.log(`  currentOpeningHours:`, placeDetails.currentOpeningHours);
          console.log(`  regularOpeningHours:`, placeDetails.regularOpeningHours);
          
          // Check if this is an always-accessible type (like parks, outdoor spaces)
          const isAlwaysAccessible = place.types?.some(type => 
            alwaysAccessibleTypes.has(type)
          );
          
          if (isAlwaysAccessible) {
            const accessibleType = place.types?.find(t => alwaysAccessibleTypes.has(t));
            console.log(`  ✅ Always accessible: ${accessibleType}`);
            return true; // Always show parks, outdoor spaces, etc.
          }
          
          // For businesses with hours, check if they're open
          // Check currentOpeningHours first (most accurate for "right now")
          if (placeDetails.currentOpeningHours !== undefined) {
            const isOpen = placeDetails.currentOpeningHours?.openNow;
            console.log(`  Current hours - openNow:`, isOpen);
            if (isOpen === true) {
              console.log(`  ✅ Currently open`);
              return true;
            } else if (isOpen === false) {
              console.log(`  ❌ Currently closed`);
              return false;
            }
          }
          
          // Fallback to regularOpeningHours if available
          if (placeDetails.regularOpeningHours !== undefined) {
            const isOpen = placeDetails.regularOpeningHours?.openNow;
            console.log(`  Regular hours - openNow:`, isOpen);
            if (isOpen === true) {
              console.log(`  ✅ Open (regular hours)`);
              return true;
            } else if (isOpen === false) {
              console.log(`  ❌ Closed (regular hours)`);
              return false;
            }
          }
          
          // If no opening hours data for a non-outdoor venue, be permissive and show it
          // (Better to show than hide - user can see "no hours" in popup)
          console.log(`  ⚠️ No opening hours data - showing anyway`);
          return true;
        });

        console.log(`✅ Filtered to ${openPlaces.length} available places (from ${places.length} total)`);

        // Create markers for open places only
        let createdCount = 0;
        openPlaces.forEach((place, index) => {
          if (!place.location) {
            console.log(`⚠️ Place ${index} missing location`, place.displayName?.text);
            return;
          }

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
            map: googleMapRef.current!,
            position: { lat: place.location.latitude, lng: place.location.longitude },
            content: pin.element,
            title: place.displayName?.text || 'Unknown',
          });

          // Add click listener - only show info window
          marker.addListener('click', () => {
            // Show info window
            if (infoWindowRef.current) {
              const content = createInfoWindowContent(place, score, categoryName, distance);
              infoWindowRef.current.setContent(content);
              infoWindowRef.current.open(googleMapRef.current!, marker);
            }
          });

          markersRef.current.push(marker);
          createdCount++;
        });

        console.log('✅ Created', createdCount, 'markers successfully');
      } catch (error) {
        console.error('❌ Error updating markers:', error);
      }
    };

    // Run marker update
    updateMarkers();
  }, [places, weatherData, isMapReady]);

  // Create enhanced info window content
  const createInfoWindowContent = (
    place: GooglePlace, 
    score: number, 
    category: string,
    distance: number
  ): string => {
    const ScoreIcon = getScoreIcon(score);
    const CategoryIcon = categoryIcons[category] || Sparkles;
    const gradient = getScoreGradient(score);
    const scoreLabel = getScoreLabel(score);
    const placeDetails = place as any;
    
    return `
      <div class="map-info-window" style="
        width: 320px;
        font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
        background: #ffffff;
        border-radius: 16px;
        overflow: hidden;
        box-shadow: 0 20px 40px -10px rgba(0, 0, 0, 0.2), 0 0 0 1px rgba(0, 0, 0, 0.05);
      ">
        <!-- Header with gradient -->
        <div style="
          background: linear-gradient(135deg, ${getMarkerColor(score)}12 0%, ${getMarkerColor(score)}06 100%);
          padding: 16px;
          border-bottom: 2px solid ${getMarkerColor(score)}35;
        ">
          <!-- Score badge -->
          <div style="
            display: flex;
            align-items: center;
            justify-content: space-between;
            margin-bottom: 12px;
          ">
            <div style="
              display: inline-flex;
              align-items: center;
              gap: 7px;
              padding: 7px 14px;
              background: white;
              border-radius: 20px;
              font-size: 12px;
              font-weight: 700;
              color: #4b5563;
              text-transform: uppercase;
              letter-spacing: 0.6px;
              box-shadow: 0 2px 4px rgba(0, 0, 0, 0.08);
            ">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="${getMarkerColor(score)}" stroke-width="2.5">
                <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path>
                <circle cx="12" cy="10" r="3"></circle>
              </svg>
              ${category}
            </div>
            
            <div style="
              display: flex;
              flex-direction: column;
              align-items: flex-end;
              gap: 5px;
              padding: 10px 16px;
              background: ${getMarkerColor(score)}12;
              border-radius: 12px;
              border: 2px solid ${getMarkerColor(score)};
            ">
              <div style="
                font-size: 28px;
                font-weight: 900;
                color: ${getMarkerColor(score)};
                line-height: 1;
                letter-spacing: -0.8px;
              ">${score}</div>
              <div style="
                font-size: 10px;
                font-weight: 800;
                color: ${getMarkerColor(score)};
                text-transform: uppercase;
                letter-spacing: 0.6px;
              ">${scoreLabel}</div>
            </div>
          </div>
          
          <!-- Place name -->
          <h3 style="
            margin: 0;
            font-size: 18px;
            font-weight: 800;
            color: #111827;
            line-height: 1.3;
            margin-bottom: 10px;
            letter-spacing: -0.2px;
          ">${place.displayName?.text || 'Unknown Place'}</h3>
          
          <!-- Status and price -->
          <div style="display: flex; align-items: center; gap: 10px; flex-wrap: wrap;">
            ${place.currentOpeningHours?.openNow !== false ? `
              <span style="
                display: inline-flex;
                align-items: center;
                gap: 6px;
                padding: 6px 14px;
                background: #10b98120;
                color: #047857;
                border-radius: 12px;
                font-size: 12px;
                font-weight: 700;
                border: 1.5px solid #10b98135;
              ">
                <svg width="9" height="9" viewBox="0 0 24 24" fill="#10b981">
                  <circle cx="12" cy="12" r="12"/>
                </svg>
                Open Now
              </span>
            ` : ''}
            ${placeDetails.priceLevel ? `
              <span style="
                display: inline-flex;
                align-items: center;
                padding: 6px 14px;
                background: #f0fdf4;
                border: 1.5px solid #86efac;
                border-radius: 12px;
                font-size: 12px;
                font-weight: 700;
                color: #16a34a;
              ">
                ${getPriceLevelSymbols(placeDetails.priceLevel)}
              </span>
            ` : ''}
          </div>
        </div>
        
        <!-- Body -->
        <div style="padding: 16px;">
          <!-- Rating -->
          ${place.rating ? `
            <div style="
              display: flex;
              align-items: center;
              gap: 10px;
              margin-bottom: 14px;
              padding: 12px;
              background: linear-gradient(135deg, #fef3c7 0%, #fde68a 100%);
              border-radius: 12px;
              border: 1.5px solid #fbbf2435;
            ">
              <div style="display: flex; align-items: center; gap: 4px;">
                ${generateStars(place.rating)}
              </div>
              <span style="
                font-weight: 800;
                font-size: 16px;
                color: #92400e;
                letter-spacing: -0.2px;
              ">${place.rating.toFixed(1)}</span>
              <span style="
                font-size: 13px;
                color: #92400e;
                opacity: 0.75;
                font-weight: 600;
              ">(${place.userRatingCount?.toLocaleString() || 0})</span>
            </div>
          ` : ''}
          
          <!-- Info grid -->
          <div style="
            display: grid;
            grid-template-columns: 1fr;
            gap: 10px;
            margin-bottom: 14px;
          ">
            ${distance > 0 ? `
              <div style="
                display: flex;
                align-items: center;
                gap: 10px;
                padding: 12px;
                background: #f8fafc;
                border-radius: 10px;
                border: 1.5px solid #e2e8f0;
              ">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#64748b" stroke-width="2.5">
                  <path d="M9 11a3 3 0 1 0 6 0a3 3 0 0 0 -6 0"></path>
                  <path d="M17.657 16.657l-4.243 4.243a2 2 0 0 1 -2.827 0l-4.244 -4.243a8 8 0 1 1 11.314 0z"></path>
                </svg>
                <div>
                  <div style="font-size: 10px; color: #94a3b8; font-weight: 600; text-transform: uppercase; letter-spacing: 0.4px; margin-bottom: 3px;">Distance</div>
                  <div style="font-size: 15px; color: #0f172a; font-weight: 800; letter-spacing: -0.2px;">${formatDistance(distance)}</div>
                </div>
              </div>
            ` : ''}
          </div>
          
          <!-- Address -->
          ${place.formattedAddress ? `
            <div style="
              display: flex;
              align-items: start;
              gap: 10px;
              padding: 12px;
              background: #f1f5f9;
              border-radius: 10px;
              margin-bottom: 14px;
              border: 1.5px solid #cbd5e1;
            ">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#475569" stroke-width="2.5" style="flex-shrink: 0; margin-top: 2px;">
                <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path>
                <circle cx="12" cy="10" r="3"></circle>
              </svg>
              <p style="
                margin: 0;
                font-size: 13px;
                color: #334155;
                line-height: 1.5;
                font-weight: 500;
              ">${place.formattedAddress}</p>
            </div>
          ` : ''}
          
          <!-- CTA Button -->
          <button 
            onclick="window.dispatchEvent(new CustomEvent('place-select', { detail: '${place.id}' }))"
            style="
              width: 100%;
              padding: 13px 20px;
              background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
              color: white;
              border: none;
              border-radius: 12px;
              font-weight: 800;
              font-size: 15px;
              cursor: pointer;
              transition: all 0.2s;
              box-shadow: 0 8px 16px -4px rgba(102, 126, 234, 0.4), 0 0 0 1px rgba(102, 126, 234, 0.1);
              display: flex;
              align-items: center;
              justify-content: center;
              gap: 10px;
              letter-spacing: 0.2px;
            "
            onmouseover="this.style.transform='translateY(-2px)'; this.style.boxShadow='0 12px 20px -4px rgba(102, 126, 234, 0.5)'"
            onmouseout="this.style.transform='translateY(0)'; this.style.boxShadow='0 8px 16px -4px rgba(102, 126, 234, 0.4)'"
          >
            <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
              <circle cx="12" cy="12" r="10"></circle>
              <path d="M12 16v-4"></path>
              <path d="M12 8h.01"></path>
            </svg>
            View Full Details
            <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
              <path d="M5 12h14"></path>
              <path d="m12 5 7 7-7 7"></path>
            </svg>
          </button>
        </div>
      </div>
    `;
  };

  // Helper functions for info window
  const generateStars = (rating: number): string => {
    const fullStars = Math.floor(rating);
    const hasHalfStar = rating % 1 >= 0.5;
    let starsHtml = '';
    
    for (let i = 0; i < 5; i++) {
      if (i < fullStars) {
        starsHtml += `<svg width="16" height="16" viewBox="0 0 24 24" fill="#fbbf24" stroke="#fbbf24" stroke-width="2"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon></svg>`;
      } else if (i === fullStars && hasHalfStar) {
        starsHtml += `<svg width="16" height="16" viewBox="0 0 24 24" fill="url(#halfGrad)" stroke="#fbbf24" stroke-width="2"><defs><linearGradient id="halfGrad"><stop offset="50%" stop-color="#fbbf24"/><stop offset="50%" stop-color="transparent"/></linearGradient></defs><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon></svg>`;
      } else {
        starsHtml += `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#d1d5db" stroke-width="2"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon></svg>`;
      }
    }
    
    return starsHtml;
  };

  const getPriceLevelSymbols = (priceLevel: string): string => {
    const count = {
      'PRICE_LEVEL_FREE': 0,
      'PRICE_LEVEL_INEXPENSIVE': 1,
      'PRICE_LEVEL_MODERATE': 2,
      'PRICE_LEVEL_EXPENSIVE': 3,
      'PRICE_LEVEL_VERY_EXPENSIVE': 4,
    }[priceLevel] || 0;
    
    if (count === 0) return 'FREE';
    return '$'.repeat(count);
  };

  // Listen for place selection from info window
  useEffect(() => {
    const handlePlaceSelect = (event: CustomEvent) => {
      setSelectedPlaceId(event.detail);
      setIsModalOpen(true);
    };

    window.addEventListener('place-select' as any, handlePlaceSelect);
    return () => {
      window.removeEventListener('place-select' as any, handlePlaceSelect);
    };
  }, []);

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
    <>
      <div className={containerClasses}>
        {/* Map Container */}
        <div className={`relative ${heightClasses} w-full`}>
          <div ref={mapRef} className="absolute inset-0" />

          {/* Loading Overlay */}
          {isLoading && (
            <div className="absolute inset-0 flex items-center justify-center bg-gray-900/80 backdrop-blur-sm z-10">
              <div className="text-center">
                <div className="w-16 h-16 border-4 border-white/20 border-t-white/60 rounded-full animate-spin mx-auto mb-4" />
                <p className="text-white font-medium">Loading map...</p>
              </div>
            </div>
          )}

          {/* Error Overlay */}
          {loadError && (
            <div className="absolute inset-0 flex items-center justify-center bg-gray-900/80 backdrop-blur-sm z-10">
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
              <div className="absolute top-4 left-4 right-4 flex items-center justify-between gap-2 pointer-events-none z-10">
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
                  <div className="flex items-center gap-2">
                    <Eye className="w-4 h-4" />
                    <span>
                      {places.filter(p => {
                        const details = p as any;
                        const alwaysAccessibleTypes = new Set([
                          'park', 'playground', 'hiking_area', 'beach', 'viewpoint',
                          'tourist_attraction', 'natural_feature', 'campground', 'dog_park',
                          'garden', 'plaza', 'picnic_ground', 'marina', 'trail', 'monument', 
                          'landmark', 'stadium', 'sports_complex', 'golf_course'
                        ]);
                        
                        // Always show outdoor/public spaces
                        if (p.types?.some(type => alwaysAccessibleTypes.has(type))) {
                          return true;
                        }
                        
                        // For businesses, check if open
                        if (details.currentOpeningHours !== undefined) {
                          if (details.currentOpeningHours?.openNow === true) return true;
                          if (details.currentOpeningHours?.openNow === false) return false;
                        }
                        if (details.regularOpeningHours !== undefined) {
                          if (details.regularOpeningHours?.openNow === true) return true;
                          if (details.regularOpeningHours?.openNow === false) return false;
                        }
                        
                        // If no hours data, show it (permissive)
                        return true;
                      }).length} available
                    </span>
                  </div>
                </div>
              </div>

              {/* Bottom Right Controls */}
              <div className="absolute bottom-4 right-4 flex flex-col gap-2 pointer-events-auto z-10">
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

              {/* Enhanced Legend */}
              <div className={`absolute bottom-4 left-4 rounded-xl shadow-lg backdrop-blur-md z-10 overflow-hidden ${
                isDarkTheme ? 'bg-gray-900/90 text-white' : 'bg-white/90 text-gray-900'
              }`}>
                <div className="p-4">
                  <h4 className="text-xs font-bold mb-3 opacity-60 uppercase tracking-wider flex items-center gap-2">
                    <Sparkles className="w-3 h-3" />
                    Match Score
                  </h4>
                  <div className="space-y-2">
                    {[
                      { label: 'Perfect', color: '#f97316', min: 85, icon: Flame },
                      { label: 'Excellent', color: '#eab308', min: 75, icon: Zap },
                      { label: 'Great', color: '#22c55e', min: 65, icon: Award },
                      { label: 'Good', color: '#3b82f6', min: 55, icon: TrendingUp },
                      { label: 'Fair', color: '#9ca3af', min: 0, icon: Shield },
                    ].map((item) => {
                      const Icon = item.icon;
                      return (
                        <div key={item.label} className="flex items-center gap-2">
                          <div
                            className="w-3 h-3 rounded-full flex items-center justify-center"
                            style={{ backgroundColor: item.color }}
                          >
                            <div className="w-1.5 h-1.5 bg-white rounded-full"></div>
                          </div>
                          <span className="text-xs font-semibold flex-1">
                            {item.label}
                          </span>
                          <span className="text-xs opacity-60 font-medium">
                            {item.min}+
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* Close Fullscreen Button (when in fullscreen) */}
              {isFullscreen && (
                <button
                  onClick={toggleFullscreen}
                  className={`absolute top-4 right-4 p-3 rounded-xl shadow-lg backdrop-blur-md transition-all hover:scale-105 z-10 ${
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

      {/* Activity Detail Modal */}
      {selectedPlaceId && (
        <ActivityDetailModal
          isOpen={isModalOpen}
          onClose={() => {
            setIsModalOpen(false);
            setSelectedPlaceId(null);
          }}
          placeId={selectedPlaceId}
          initialData={places.find(p => p.id === selectedPlaceId)}
          userCoordinates={userCoordinates}
          weatherData={weatherData}
        />
      )}
    </>
  );
}