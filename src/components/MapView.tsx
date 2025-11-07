// src/components/MapView.tsx
'use client';

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
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
  DollarSign, Users, Eye, EyeOff, Settings, List
} from 'lucide-react';

interface MapViewProps {
  places: GooglePlace[];
  userCoordinates: Coordinates | null;
  weatherData: WeatherData | null;
  isDarkTheme?: boolean;
  onViewModeChange?: () => void;
  onOpenPreferences?: () => void;
  onFullscreenChange?: (isFullscreen: boolean) => void;
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
  onViewModeChange,
  onOpenPreferences,
  onFullscreenChange,
}: MapViewProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const googleMapRef = useRef<google.maps.Map | null>(null);
  const markersRef = useRef<google.maps.marker.AdvancedMarkerElement[]>([]);
  const userMarkerRef = useRef<google.maps.marker.AdvancedMarkerElement | null>(null);
  const customOverlayRef = useRef<any | null>(null);
  
  // Store the marker library reference
  const markerLibRef = useRef<google.maps.MarkerLibrary | null>(null);
  
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [selectedPlaceId, setSelectedPlaceId] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [mapStyle, setMapStyle] = useState<'roadmap' | 'terrain' | 'satellite'>('roadmap');
  const [isMapReady, setIsMapReady] = useState(false);
  const [overlayPlace, setOverlayPlace] = useState<{place: GooglePlace, score: number, category: string, distance: number} | null>(null);

  // NEW: Determine if it's nighttime based on weather data
  const isNightTime = useMemo(() => {
    if (!weatherData) return false;
    const { dt, sys } = weatherData;
    const { sunrise, sunset } = sys;
    // It's night if current time is before sunrise or after sunset
    return dt < sunrise || dt > sunset;
  }, [weatherData]);

  // NEW: Use night mode map ID if it's nighttime
  const mapId = useMemo(() => {
    return isNightTime ? 'DEMO_MAP_ID_DARK' : 'DEMO_MAP_ID';
  }, [isNightTime]);

  // NEW: Helper for UI theme classes
  const getUIThemeClasses = useCallback(() => {
    return isNightTime
      ? 'bg-gray-900/80 text-white hover:bg-gray-900/90'
      : isDarkTheme
      ? 'bg-gray-900/80 text-white hover:bg-gray-900/90'
      : 'bg-white/80 text-gray-900 hover:bg-white/90';
  }, [isNightTime, isDarkTheme]);

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

        // Create map with dynamic mapId based on time of day
        const map = new Map(mapRef.current, {
          center: { lat: userCoordinates.latitude, lng: userCoordinates.longitude },
          zoom: 14,
          mapId: mapId, // Use dynamic mapId
          disableDefaultUI: true,
          zoomControl: true,
          mapTypeControl: false,
          streetViewControl: false,
          fullscreenControl: false,
          gestureHandling: 'greedy',
        });

        googleMapRef.current = map;
        console.log(`✅ Map created with ${isNightTime ? 'dark' : 'light'} theme`);

        // Close overlay when map is clicked
        map.addListener('click', () => {
          setOverlayPlace(null);
        });

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

        // Define Custom Overlay Class
        class CustomInfoOverlay extends google.maps.OverlayView {
          position: google.maps.LatLng;
          containerDiv: HTMLDivElement;

          constructor(position: google.maps.LatLng) {
            super();
            this.position = position;
            this.containerDiv = document.createElement('div');
            this.containerDiv.style.position = 'absolute';
          }

          onAdd() {
            const panes = this.getPanes();
            panes?.floatPane.appendChild(this.containerDiv);
          }

          draw() {
            const overlayProjection = this.getProjection();
            const pos = overlayProjection.fromLatLngToDivPixel(this.position);
            
            if (pos) {
              this.containerDiv.style.left = pos.x + 'px';
              this.containerDiv.style.top = pos.y + 'px';
              this.containerDiv.style.transform = 'translate(-50%, -100%)';
              this.containerDiv.style.marginTop = '-20px';
            }
          }

          onRemove() {
            if (this.containerDiv.parentElement) {
              this.containerDiv.parentElement.removeChild(this.containerDiv);
            }
          }

          setContent(content: string) {
            this.containerDiv.innerHTML = content;
          }

          hide() {
            this.containerDiv.style.display = 'none';
          }

          show() {
            this.containerDiv.style.display = 'block';
          }
        }

        // Store overlay class for later use
        (window as any).CustomInfoOverlay = CustomInfoOverlay;

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
  }, [userCoordinates?.latitude, userCoordinates?.longitude, mapId, isNightTime]);

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
    console.log('Sample place data:', places[0]);

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
            return true;
          }
          
          // For businesses with hours, check if they're open
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
          // The enum value IS the string (e.g., "Food & Drink")
          const categoryName = category || 'Other';
          
          console.log(`📍 Place: ${place.displayName?.text}`);
          console.log(`   Types:`, place.types);
          console.log(`   Category:`, category);
          console.log(`   Category name:`, categoryName);
          
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

          // Add click listener - set overlay state with correct category
          marker.addListener('click', () => {
            setOverlayPlace({ place, score, category: categoryName, distance });
          });

          markersRef.current.push(marker);
          createdCount++;
        });

        console.log('✅ Created', createdCount, 'markers successfully');
      } catch (error) {
        console.error('❌ Error updating markers:', error);
      }
    };

    updateMarkers();
  }, [places, weatherData, isMapReady]);

  // Manage custom overlay
  useEffect(() => {
    if (!googleMapRef.current || !overlayPlace) {
      // Hide overlay if it exists
      if (customOverlayRef.current) {
        customOverlayRef.current.setMap(null);
        customOverlayRef.current = null;
      }
      return;
    }

    const { place, score, category, distance } = overlayPlace;
    
    // Always create a new overlay instance for the new position
    // Remove old overlay first
    if (customOverlayRef.current) {
      customOverlayRef.current.setMap(null);
      customOverlayRef.current = null;
    }

    // Create new overlay at the new marker position
    if ((window as any).CustomInfoOverlay && place.location) {
      const position = new google.maps.LatLng(
        place.location.latitude,
        place.location.longitude
      );
      customOverlayRef.current = new (window as any).CustomInfoOverlay(position);
      customOverlayRef.current.setMap(googleMapRef.current);
      
      // Set content
      const content = createInfoWindowContent(place, score, category, distance);
      customOverlayRef.current.setContent(content);
      customOverlayRef.current.show();
    }

  }, [overlayPlace]);

  // Create enhanced info window content with modern design
  const createInfoWindowContent = (
    place: GooglePlace, 
    score: number, 
    category: string,
    distance: number
  ): string => {
    const placeDetails = place as any;
    const markerColor = getMarkerColor(score);
    const scoreLabel = getScoreLabel(score);
    
    // Build the Top Rated badge conditionally
    const topRatedBadge = place.rating && place.rating >= 4.7 
      ? `<div style="
          margin-left: auto;
          padding: 4px 10px;
          background: rgba(255, 255, 255, 0.6);
          border-radius: 8px;
          font-size: 10px;
          font-weight: 800;
          color: #92400e;
          text-transform: uppercase;
          letter-spacing: 0.4px;
        ">
          Top Rated
        </div>`
      : '';
    
    return `
      <div class="map-info-window" style="
        width: 360px;
        max-width: 90vw;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Inter', system-ui, sans-serif;
        background: linear-gradient(180deg, #ffffff 0%, #fafafa 100%);
        border-radius: 20px;
        overflow: hidden;
        box-shadow: 0 24px 48px -12px rgba(0, 0, 0, 0.25), 
                    0 0 0 1px rgba(0, 0, 0, 0.08),
                    0 12px 24px -8px rgba(0, 0, 0, 0.15);
        position: relative;
      ">
        <!-- Close button - top right, clean design -->
        <button 
          onclick="window.dispatchEvent(new CustomEvent('close-overlay'))"
          style="
            position: absolute;
            top: 12px;
            right: 12px;
            z-index: 20;
            width: 32px;
            height: 32px;
            border-radius: 50%;
            border: 2px solid rgba(255, 255, 255, 0.9);
            background: linear-gradient(135deg, rgba(255, 255, 255, 0.95) 0%, rgba(248, 250, 252, 0.95) 100%);
            backdrop-filter: blur(12px);
            color: #64748b;
            cursor: pointer;
            display: flex;
            align-items: center;
            justify-content: center;
            transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15), inset 0 1px 2px rgba(255, 255, 255, 0.8);
          "
          onmouseover="
            this.style.background='linear-gradient(135deg, rgba(239, 68, 68, 0.95) 0%, rgba(220, 38, 38, 1) 100%)'; 
            this.style.color='white';
            this.style.transform='scale(1.1) rotate(90deg)';
            this.style.borderColor='rgba(255, 255, 255, 1)';
            this.style.boxShadow='0 6px 16px rgba(239, 68, 68, 0.4), inset 0 1px 2px rgba(255, 255, 255, 0.3)';
          "
          onmouseout="
            this.style.background='linear-gradient(135deg, rgba(255, 255, 255, 0.95) 0%, rgba(248, 250, 252, 0.95) 100%)'; 
            this.style.color='#64748b';
            this.style.transform='scale(1) rotate(0deg)';
            this.style.borderColor='rgba(255, 255, 255, 0.9)';
            this.style.boxShadow='0 4px 12px rgba(0, 0, 0, 0.15), inset 0 1px 2px rgba(255, 255, 255, 0.8)';
          "
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" style="pointer-events: none;">
            <path d="M18 6L6 18M6 6l12 12"></path>
          </svg>
        </button>
        
        <!-- Decorative gradient border on top edge -->
        <div style="
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          height: 4px;
          background: linear-gradient(90deg, ${markerColor}CC 0%, ${markerColor} 15%, ${markerColor} 85%, ${markerColor}CC 100%);
          z-index: 10;
        "></div>
        
        <!-- Header section with gradient background -->
        <div style="
          background: linear-gradient(135deg, ${markerColor}15 0%, ${markerColor}08 50%, ${markerColor}15 100%);
          padding: 20px;
          padding-top: 24px;
          position: relative;
          z-index: 5;
        ">
          <!-- Floating score badge - top right -->
          <div style="
            position: absolute;
            top: 16px;
            right: 16px;
            display: flex;
            flex-direction: column;
            align-items: center;
            gap: 6px;
            padding: 12px 14px;
            background: linear-gradient(135deg, ${markerColor}18 0%, ${markerColor}08 100%);
            backdrop-filter: blur(12px);
            border-radius: 16px;
            border: 2px solid ${markerColor}40;
            box-shadow: 0 8px 16px -4px ${markerColor}25, inset 0 1px 2px rgba(255, 255, 255, 0.3);
          ">
            <div style="
              font-size: 32px;
              font-weight: 900;
              color: ${markerColor};
              line-height: 1;
              letter-spacing: -1.2px;
              text-shadow: 0 2px 4px ${markerColor}20;
            ">${score}</div>
            <div style="
              font-size: 9px;
              font-weight: 800;
              color: ${markerColor};
              text-transform: uppercase;
              letter-spacing: 0.8px;
              opacity: 0.9;
            ">${scoreLabel}</div>
          </div>
          
          <!-- Category badge -->
          <div style="
            display: inline-flex;
            align-items: center;
            gap: 8px;
            padding: 8px 16px;
            background: linear-gradient(135deg, #ffffff 0%, #f9fafb 100%);
            border-radius: 12px;
            font-size: 11px;
            font-weight: 700;
            color: #374151;
            text-transform: uppercase;
            letter-spacing: 0.8px;
            box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06), inset 0 1px 1px rgba(255, 255, 255, 0.8);
            border: 1px solid rgba(0, 0, 0, 0.04);
            margin-bottom: 16px;
          ">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="${markerColor}" stroke-width="2.5" stroke-linecap="round">
              <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path>
              <circle cx="12" cy="10" r="3"></circle>
            </svg>
            ${category || 'Other'}
          </div>
          
          <!-- Place name with better hierarchy -->
          <h3 style="
            margin: 0 80px 12px 0;
            font-size: 20px;
            font-weight: 800;
            color: #111827;
            line-height: 1.3;
            letter-spacing: -0.4px;
          ">${place.displayName?.text || 'Unknown Place'}</h3>
          
          <!-- Status badges with modern styling -->
          <div style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap;">
            ${place.currentOpeningHours?.openNow !== false ? `
              <span style="
                display: inline-flex;
                align-items: center;
                gap: 6px;
                padding: 6px 12px;
                background: linear-gradient(135deg, #d1fae5 0%, #a7f3d0 100%);
                color: #065f46;
                border-radius: 10px;
                font-size: 11px;
                font-weight: 800;
                border: 1.5px solid #6ee7b7;
                box-shadow: 0 2px 4px rgba(16, 185, 129, 0.15);
                letter-spacing: 0.3px;
              ">
                <svg width="8" height="8" viewBox="0 0 24 24" fill="#10b981">
                  <circle cx="12" cy="12" r="12"/>
                </svg>
                OPEN
              </span>
            ` : ''}
            ${placeDetails.priceLevel ? `
              <span style="
                display: inline-flex;
                align-items: center;
                padding: 6px 12px;
                background: linear-gradient(135deg, #ecfccb 0%, #d9f99d 100%);
                border: 1.5px solid #bef264;
                border-radius: 10px;
                font-size: 11px;
                font-weight: 800;
                color: #365314;
                box-shadow: 0 2px 4px rgba(132, 204, 22, 0.15);
                letter-spacing: 0.3px;
              ">
                ${getPriceLevelSymbols(placeDetails.priceLevel)}
              </span>
            ` : ''}
          </div>
        </div>
        
        <!-- Main content with improved spacing -->
        <div style="padding: 20px;">
          <!-- Enhanced rating display -->
          ${place.rating ? `
            <div style="
              display: flex;
              align-items: center;
              gap: 12px;
              margin-bottom: 16px;
              padding: 14px 16px;
              background: linear-gradient(135deg, #fef3c7 0%, #fde68a 100%);
              border-radius: 14px;
              border: 2px solid #fbbf24;
              box-shadow: 0 4px 12px rgba(251, 191, 36, 0.15);
            ">
              <div style="display: flex; align-items: center; gap: 3px;">
                ${generateStars(place.rating)}
              </div>
              <span style="
                font-weight: 900;
                font-size: 18px;
                color: #78350f;
                letter-spacing: -0.3px;
              ">${place.rating.toFixed(1)}</span>
              <span style="
                font-size: 12px;
                color: #92400e;
                opacity: 0.85;
                font-weight: 700;
              ">(${place.userRatingCount?.toLocaleString() || 0})</span>
              ${topRatedBadge}
            </div>
          ` : ''}
          
          <!-- Distance card with modern design -->
          ${distance > 0 ? `
            <div style="
              display: flex;
              align-items: center;
              gap: 14px;
              padding: 14px 16px;
              background: linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%);
              border-radius: 14px;
              border: 2px solid #e2e8f0;
              margin-bottom: 16px;
              box-shadow: 0 2px 8px rgba(0, 0, 0, 0.04);
            ">
              <div style="
                width: 40px;
                height: 40px;
                display: flex;
                align-items: center;
                justify-content: center;
                background: linear-gradient(135deg, #dbeafe 0%, #bfdbfe 100%);
                border-radius: 12px;
                flex-shrink: 0;
              ">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#2563eb" stroke-width="2.5">
                  <path d="M9 11a3 3 0 1 0 6 0a3 3 0 0 0 -6 0"></path>
                  <path d="M17.657 16.657l-4.243 4.243a2 2 0 0 1 -2.827 0l-4.244 -4.243a8 8 0 1 1 11.314 0z"></path>
                </svg>
              </div>
              <div style="flex: 1;">
                <div style="
                  font-size: 10px; 
                  color: #64748b; 
                  font-weight: 700; 
                  text-transform: uppercase; 
                  letter-spacing: 0.6px; 
                  margin-bottom: 4px;
                ">Distance</div>
                <div style="
                  font-size: 17px; 
                  color: #0f172a; 
                  font-weight: 900; 
                  letter-spacing: -0.3px;
                ">${formatDistance(distance)} away</div>
              </div>
            </div>
          ` : ''}
          
          <!-- Address with improved readability -->
          ${place.formattedAddress ? `
            <div style="
              display: flex;
              align-items: start;
              gap: 12px;
              padding: 14px 16px;
              background: linear-gradient(135deg, #fafafa 0%, #f5f5f5 100%);
              border-radius: 14px;
              margin-bottom: 18px;
              border: 2px solid #e5e7eb;
              box-shadow: 0 2px 8px rgba(0, 0, 0, 0.03);
            ">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#6b7280" stroke-width="2.5" style="flex-shrink: 0; margin-top: 3px;">
                <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path>
                <circle cx="12" cy="10" r="3"></circle>
              </svg>
              <p style="
                margin: 0;
                font-size: 13px;
                color: #374151;
                line-height: 1.6;
                font-weight: 500;
              ">${place.formattedAddress}</p>
            </div>
          ` : ''}
          
          <!-- Enhanced CTA button with hover state -->
          <button 
            onclick="window.dispatchEvent(new CustomEvent('place-select', { detail: '${place.id}' }))"
            style="
              width: 100%;
              padding: 15px 24px;
              background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
              color: white;
              border: none;
              border-radius: 14px;
              font-weight: 800;
              font-size: 15px;
              cursor: pointer;
              transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
              box-shadow: 0 10px 20px -5px rgba(102, 126, 234, 0.4), 
                          0 0 0 1px rgba(102, 126, 234, 0.1),
                          inset 0 1px 2px rgba(255, 255, 255, 0.2);
              display: flex;
              align-items: center;
              justify-content: center;
              gap: 10px;
              letter-spacing: 0.3px;
              position: relative;
              overflow: hidden;
            "
            onmouseover="
              this.style.transform='translateY(-2px) scale(1.01)'; 
              this.style.boxShadow='0 16px 28px -8px rgba(102, 126, 234, 0.55), 0 0 0 1px rgba(102, 126, 234, 0.15)';
            "
            onmouseout="
              this.style.transform='translateY(0) scale(1)'; 
              this.style.boxShadow='0 10px 20px -5px rgba(102, 126, 234, 0.4), 0 0 0 1px rgba(102, 126, 234, 0.1)';
            "
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
              <circle cx="12" cy="12" r="10"></circle>
              <path d="M12 8v8"></path>
              <path d="M8 12h8"></path>
            </svg>
            <span>View Full Details</span>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
              <path d="M5 12h14"></path>
              <path d="m12 5 7 7-7 7"></path>
            </svg>
          </button>
        </div>
        
        <!-- Decorative gradient border wrapping bottom edges -->
        <div style="
          position: absolute;
          bottom: 0;
          left: 0;
          right: 0;
          height: 6px;
          background: linear-gradient(90deg, transparent 0%, ${markerColor}15 10%, ${markerColor}25 50%, ${markerColor}15 90%, transparent 100%);
          z-index: 10;
        "></div>
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

    const handleCloseOverlay = () => {
      setOverlayPlace(null);
    };

    window.addEventListener('place-select' as any, handlePlaceSelect);
    window.addEventListener('close-overlay' as any, handleCloseOverlay);
    
    return () => {
      window.removeEventListener('place-select' as any, handlePlaceSelect);
      window.removeEventListener('close-overlay' as any, handleCloseOverlay);
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
    setIsFullscreen(prev => {
      const newState = !prev;
      onFullscreenChange?.(newState);
      return newState;
    });
  }, [onFullscreenChange]);

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

  // Count available places
  const availableCount = places.filter(p => {
    const details = p as any;
    const alwaysAccessibleTypes = new Set([
      'park', 'playground', 'hiking_area', 'beach', 'viewpoint',
      'tourist_attraction', 'natural_feature', 'campground', 'dog_park',
      'garden', 'plaza', 'picnic_ground', 'marina', 'trail', 'monument', 
      'landmark', 'stadium', 'sports_complex', 'golf_course'
    ]);
    
    if (p.types?.some(type => alwaysAccessibleTypes.has(type))) {
      return true;
    }
    
    if (details.currentOpeningHours !== undefined) {
      if (details.currentOpeningHours?.openNow === true) return true;
      if (details.currentOpeningHours?.openNow === false) return false;
    }
    if (details.regularOpeningHours !== undefined) {
      if (details.regularOpeningHours?.openNow === true) return true;
      if (details.regularOpeningHours?.openNow === false) return false;
    }
    
    return true;
  }).length;

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
                          : getUIThemeClasses()
                      }`}
                    >
                      {style.charAt(0).toUpperCase() + style.slice(1)}
                    </button>
                  ))}
                </div>
              </div>

              {/* Top Right Button Group - ONLY IN FULLSCREEN */}
              {isFullscreen && (
                <div className="absolute top-4 right-4 flex flex-col gap-2 pointer-events-auto z-10">
                  <div className="flex gap-2">
                    {/* List Button */}
                    {onViewModeChange && (
                      <button
                        onClick={onViewModeChange}
                        className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-medium text-sm shadow-lg backdrop-blur-md transition-all ${getUIThemeClasses()}`}
                      >
                        <List className="w-4 h-4" />
                        <span className="text-sm font-medium">List</span>
                      </button>
                    )}

                    {/* Close Fullscreen Button */}
                    <button
                      onClick={toggleFullscreen}
                      className={`p-2.5 rounded-xl shadow-lg backdrop-blur-md transition-all flex items-center justify-center ${getUIThemeClasses()}`}
                      style={{ height: '40px', width: '40px' }}
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>

                  {/* Settings Button - below the row */}
                  {onOpenPreferences && (
                    <button
                      onClick={onOpenPreferences}
                      className={`p-2.5 rounded-xl shadow-lg backdrop-blur-md transition-all self-end flex items-center justify-center ${getUIThemeClasses()}`}
                      style={{ height: '40px', width: '40px' }}
                    >
                      <Settings className="w-4 h-4" />
                    </button>
                  )}
                </div>
              )}

              {/* Bottom Right Controls */}
              <div className="absolute bottom-4 right-4 flex flex-col gap-2 pointer-events-auto z-10">
                {/* Recenter Button */}
                <button
                  onClick={handleRecenter}
                  className={`p-3 rounded-xl shadow-lg backdrop-blur-md transition-all hover:scale-105 ${getUIThemeClasses()}`}
                  title="Recenter on your location"
                >
                  <Navigation2 className="w-5 h-5" />
                </button>

                {/* Fullscreen Button */}
                <button
                  onClick={toggleFullscreen}
                  className={`p-3 rounded-xl shadow-lg backdrop-blur-md transition-all hover:scale-105 ${getUIThemeClasses()}`}
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
                isNightTime ? 'bg-gray-900/90 text-white' : isDarkTheme ? 'bg-gray-900/90 text-white' : 'bg-white/90 text-gray-900'
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