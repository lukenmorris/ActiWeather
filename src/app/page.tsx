// src/app/page.tsx
'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';

// Import Components
import ActivityList from '@/components/ActivityList';
import PreferencesPanel from '@/components/PreferencesPanel';
import PreferencesIndicator from '@/components/PreferencesIndicator';
import MapView from '@/components/MapView';
import ToastNotification, { useToast } from '@/components/ToastNotification';

// Import Hooks and Utils
import useGeolocation from '@/hooks/useGeolocation';
import { getSuitableCategories, getPlaceTypesForCategory } from '@/lib/activityMapper';
import { useUserPreferences } from '@/context/UserPreferencesContext';
import { calculateWeatherSuitability, calculateDistance } from '@/lib/geoUtils';
import { 
  filterPlaces, 
  applyPreferenceScoring,
  getSuggestedPlaceTypes,
} from '@/lib/applyPreferences';

// Import Types
import type { Coordinates, WeatherData, GooglePlace } from '@/types';

// Import Lucide icons
import { 
  Activity, MapPin, Sparkles, TrendingUp, 
  Sun, Moon, CloudRain, CloudSnow, Cloud,
  Loader2, AlertCircle, Settings, Map as MapIcon, List
} from 'lucide-react';

// --- Constants ---
const DEFAULT_RADIUS_METERS = 5000;

export default function Home() {
  const { coordinates: geoCoordinates, error: geoError, loading: geoLoading } = useGeolocation();

  // Weather State
  const [weatherData, setWeatherData] = useState<WeatherData | null>(null);
  const [weatherLoading, setWeatherLoading] = useState<boolean>(false);
  const [weatherError, setWeatherError] = useState<string | null>(null);

  // AI Summary State
  const [summaryText, setSummaryText] = useState<string | null>(null);
  const [suggestedTypes, setSuggestedTypes] = useState<string[] | null>(null);
  const [summaryLoading, setSummaryLoading] = useState<boolean>(false);
  const [summaryError, setSummaryError] = useState<string | null>(null);

  // Places State
  const [places, setPlaces] = useState<GooglePlace[]>([]);
  const [placesLoading, setPlacesLoading] = useState<boolean>(false);
  const [placesError, setPlacesError] = useState<string | null>(null);

  // Theme State
  const [theme, setTheme] = useState('theme-default');

  // View State
  const [viewMode, setViewMode] = useState<'list' | 'map'>('list');
  const [isMapFullscreen, setIsMapFullscreen] = useState(false);

  // Preferences
  const { preferences, getEffectivePlaceTypes, isPlaceTypeAllowed, onPreferencesChange } = useUserPreferences();
  const [showPreferences, setShowPreferences] = useState(false);
  
  // Toast notifications
  const toast = useToast();
  
  // Stabilize toast functions
  const showInfo = useCallback((msg: string) => {
    toast.info(msg);
  }, []);
  
  const showSuccess = useCallback((msg: string) => {
    toast.success(msg);
  }, []);

  // Listen for preference changes and show notifications
  useEffect(() => {
    const unsubscribe = onPreferencesChange((newPrefs) => {
      console.log('✅ Preferences changed, results will update');
      // We don't show toast on every change to avoid spam
      // Toast will show when filters significantly change results
    });
    return unsubscribe;
  }, [onPreferencesChange]);

  // --- Helper Functions for Theme ---
  const getWeatherTheme = (weather: WeatherData | null): string => {
    if (!weather) return 'theme-default';
    const condition = weather.weather[0]?.main.toLowerCase();
    const isDay = (weather.sys?.sunrise && weather.sys?.sunset && weather.dt)
                  ? (weather.dt > weather.sys.sunrise && weather.dt < weather.sys.sunset)
                  : true;
    const cloudiness = weather.clouds?.all ?? 0;

    switch (condition) {
      case 'clear': return isDay ? 'theme-clear-day' : 'theme-clear-night';
      case 'clouds':
        if (cloudiness > 75) return isDay ? 'theme-overcast-day' : 'theme-cloudy-night';
        return isDay ? 'theme-cloudy-day' : 'theme-cloudy-night';
      case 'rain': case 'drizzle': case 'thunderstorm': return 'theme-rainy';
      case 'snow': return 'theme-snowy';
      case 'atmosphere': return 'theme-foggy';
      default: return 'theme-default';
    }
  };

  const getThemeClasses = (currentTheme: string): string => {
    switch(currentTheme) {
      case 'theme-clear-day': return 'bg-gradient-to-br from-amber-200 via-sky-300 to-blue-500';
      case 'theme-clear-night': return 'bg-gradient-to-br from-indigo-950 via-purple-900 to-slate-900';
      case 'theme-cloudy-day': return 'bg-gradient-to-br from-gray-300 via-slate-400 to-gray-500';
      case 'theme-overcast-day': return 'bg-gradient-to-br from-slate-500 via-gray-600 to-slate-700';
      case 'theme-cloudy-night': return 'bg-gradient-to-br from-slate-800 via-gray-900 to-black';
      case 'theme-rainy': return 'bg-gradient-to-br from-slate-600 via-blue-800 to-slate-900';
      case 'theme-snowy': return 'bg-gradient-to-br from-white via-blue-100 to-gray-300';
      case 'theme-foggy': return 'bg-gradient-to-br from-gray-400 via-slate-500 to-gray-600';
      default: return 'bg-gradient-to-br from-blue-500 via-purple-600 to-pink-500';
    }
  };

  const getWeatherIcon = (weather: WeatherData | null) => {
    if (!weather) return <Cloud className="w-8 h-8" />;
    const condition = weather.weather[0]?.main.toLowerCase();
    const isDay = weather.dt > weather.sys.sunrise && weather.dt < weather.sys.sunset;
    
    switch (condition) {
      case 'clear': return isDay ? <Sun className="w-8 h-8 text-yellow-300" /> : <Moon className="w-8 h-8 text-blue-200" />;
      case 'rain': case 'drizzle': return <CloudRain className="w-8 h-8 text-blue-300" />;
      case 'snow': return <CloudSnow className="w-8 h-8 text-white" />;
      default: return <Cloud className="w-8 h-8 text-gray-300" />;
    }
  };

  // --- Effect for Updating Theme ---
  useEffect(() => {
    const newTheme = getWeatherTheme(weatherData);
    setTheme(newTheme);
  }, [weatherData]);

  // --- Effect for Fetching Weather AND THEN AI Summary ---
  useEffect(() => {
    const latitude = geoCoordinates?.latitude;
    const longitude = geoCoordinates?.longitude;

    if (typeof latitude === 'number' && typeof longitude === 'number') {
      console.log("Weather/Summary Effect: Geolocation coordinates available. Fetching weather...");
      setWeatherLoading(true);
      setWeatherData(null); 
      setWeatherError(null);
      setPlaces([]); 
      setPlacesError(null);
      setSummaryText(null); 
      setSuggestedTypes(null); 
      setSummaryError(null); 
      setSummaryLoading(false);

      const fetchWeatherAndSummary = async () => {
        let fetchedWeatherData: WeatherData | null = null;
        try {
          const weatherResponse = await fetch(`/api/weather?lat=${latitude}&lon=${longitude}&units=imperial`);
          if (!weatherResponse.ok) {
            let errorMsg = `Weather Error: ${weatherResponse.status}`;
            try { const d = await weatherResponse.json(); errorMsg = d.error || errorMsg; } catch {}
            throw new Error(errorMsg);
          }
          fetchedWeatherData = await weatherResponse.json();
          setWeatherData(fetchedWeatherData);
          setWeatherLoading(false);

          if (fetchedWeatherData) {
            setSummaryLoading(true);
            const summaryResponse = await fetch('/api/generate-summary', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                weatherData: fetchedWeatherData,
                locationName: fetchedWeatherData.name || 'your current location'
              })
            });
            const summaryData = await summaryResponse.json();
            if (!summaryResponse.ok || summaryData.error) {
              throw new Error(summaryData.error || `Failed to generate summary (${summaryResponse.status})`);
            }
            if (!summaryData.summaryText || !Array.isArray(summaryData.suggestedPlaceTypes)) {
                throw new Error("AI response format invalid.");
            }
            setSummaryText(summaryData.summaryText);
            setSuggestedTypes(summaryData.suggestedPlaceTypes);
            setSummaryError(null);
          }
        } catch (err: any) {
          console.error("Failed during Weather/Summary fetch:", err);
          if (!fetchedWeatherData) {
            setWeatherError(err.message || 'Could not fetch weather data.');
            setWeatherData(null); 
            setWeatherLoading(false);
          } else {
            setSummaryError(err.message || 'Could not generate suggestions.');
            const fallbackSummary = `Couldn't get specific suggestions, but the weather is ${fetchedWeatherData.weather[0]?.description || 'varied'}.`;
            setSummaryText(fallbackSummary);
            console.log("AI Summary failed, using fallback types.");
            const fallbackCategories = getSuitableCategories(fetchedWeatherData);
            const fallbackTypes = new Set<string>();
            fallbackCategories.forEach(cat => getPlaceTypesForCategory(cat).forEach(t => fallbackTypes.add(t)));
            setSuggestedTypes(Array.from(fallbackTypes));
          }
        } finally {
          setSummaryLoading(false);
        }
      };
      fetchWeatherAndSummary();
    } else {
      setWeatherData(null); 
      setWeatherError(null); 
      setWeatherLoading(false);
      setPlaces([]); 
      setPlacesError(null); 
      setPlacesLoading(false);
      setSummaryText(null); 
      setSuggestedTypes(null); 
      setSummaryError(null); 
      setSummaryLoading(false);
    }
  }, [geoCoordinates?.latitude, geoCoordinates?.longitude]);

  // Create stable reference for preferences that only changes when values actually change
  const preferencesKey = useMemo(() => {
    return JSON.stringify({
      filters: preferences.filters,
      favorites: preferences.activityTypes.favorites,
      blacklist: preferences.activityTypes.blacklist,
      mood: preferences.activityTypes.activeMood,
      weights: preferences.scoringWeights
    });
  }, [
    preferences.filters,
    preferences.activityTypes.favorites,
    preferences.activityTypes.blacklist,
    preferences.activityTypes.activeMood,
    preferences.scoringWeights
  ]);

  // --- Effect for Fetching Places with FULL PREFERENCE INTEGRATION ---
  // Memoize preference values to avoid infinite loops
  const preferencesHash = useMemo(() => {
    return JSON.stringify({
      filters: preferences.filters,
      favorites: preferences.activityTypes.favorites,
      blacklist: preferences.activityTypes.blacklist,
      activeMood: preferences.activityTypes.activeMood,
      scoringWeights: preferences.scoringWeights,
    });
  }, [
    preferences.filters,
    preferences.activityTypes.favorites,
    preferences.activityTypes.blacklist,
    preferences.activityTypes.activeMood,
    preferences.scoringWeights,
  ]);
  
  // Create stable preferences object for use in effect
  const stablePreferences = useMemo(() => preferences, [preferencesHash]);

  useEffect(() => {
    const latitude = geoCoordinates?.latitude;
    const longitude = geoCoordinates?.longitude;
    const radius = stablePreferences.filters.maxRadius * 1000; // Convert km to meters

    if (suggestedTypes && suggestedTypes.length > 0 && typeof latitude === 'number' && typeof longitude === 'number') {
      console.log("🔍 Places Effect: Starting place fetch with preferences...");
      console.log("📋 Active filters:", preferences.filters);
      console.log("❤️  Favorites:", preferences.activityTypes.favorites);
      console.log("🚫 Blacklist:", preferences.activityTypes.blacklist);
      console.log("🎭 Active mood:", preferences.activityTypes.activeMood);
      
      setPlacesLoading(true);
      setPlaces([]);
      setPlacesError(null);

      const fetchPlacesForSuggestions = async () => {
        try {
          // Get suggested types combined with user preferences
          const typesToFetch = getSuggestedPlaceTypes(stablePreferences, suggestedTypes);
          
          console.log(`📍 Fetching ${typesToFetch.length} place types:`, typesToFetch);
          console.log('🔍 Debug - suggestedTypes:', suggestedTypes);
          console.log('🔍 Debug - preferences:', stablePreferences);

          if (typesToFetch.length === 0) {
            console.log("⚠️  No place types to fetch after applying preferences");
            setPlaces([]); 
            setPlacesLoading(false); 
            showInfo('No activities match your current preferences');
            return;
          }

          const fetchPromises = typesToFetch.map(type => {
            const apiUrl = `/api/places?lat=${latitude}&lon=${longitude}&radius=${radius}&type=${type}`;
            return fetch(apiUrl);
          });

          const settledResponses = await Promise.allSettled(fetchPromises);
          const aggregatedPlaces: GooglePlace[] = [];
          const uniquePlaceIds = new Set<string>();
          let fetchErrors: string[] = [];

          console.log("Processing places responses...");
          for (const result of settledResponses) {
            if (result.status === 'fulfilled') {
              const response = result.value;
              try {
                const placesOfType: GooglePlace[] | { error?: string, details?: string } = await response.json();
                if (response.ok && Array.isArray(placesOfType)) {
                  placesOfType.forEach(place => {
                    if (place.id && !uniquePlaceIds.has(place.id)) {
                      uniquePlaceIds.add(place.id);
                      aggregatedPlaces.push(place);
                    }
                  });
                } else if (!response.ok) {
                  const errorData = placesOfType as { error?: string, details?: string };
                  const errorMsg = errorData?.error || `API route failed (${response.status})`;
                  const errorDetails = errorData?.details;
                  if (errorDetails !== 'ZERO_RESULTS') {
                    fetchErrors.push(`${errorMsg}`);
                    console.warn(`Places API route error: ${errorMsg}`, errorData);
                  }
                }
              } catch (e) {
                fetchErrors.push('Failed to process place results.'); 
                console.error("Failed to parse places response:", e);
              }
            } else {
              fetchErrors.push(`Network error: ${result.reason?.message || 'Failed to fetch'}`);
              console.error("Fetch promise to /api/places rejected:", result.reason);
            }
          }

          console.log(`✅ Fetched ${aggregatedPlaces.length} total places`);

          // If no places at all, stop here
          if (aggregatedPlaces.length === 0) {
            console.log('⚠️  No places fetched from API');
            setPlaces([]);
            setPlacesLoading(false);
            return;
          }

          // Calculate distances for all places
          const distanceMap = new Map<string, number>();
          aggregatedPlaces.forEach(place => {
            if (place.location) {
              const distance = calculateDistance(
                latitude,
                longitude,
                place.location.latitude,
                place.location.longitude
              );
              distanceMap.set(place.id, distance);
            }
          });

          // **STEP 1: APPLY FILTERS** 
          console.log("🔧 Applying preference filters...");
          const { filtered: filteredPlaces, stats } = filterPlaces(
            aggregatedPlaces,
            stablePreferences,
            distanceMap
          );
          
          console.log(`📊 Filter results: ${stats.passed}/${stats.total} passed`);
          console.log("Filter breakdown:", stats.reasons);

          // Show notification if many places were filtered
          if (stats.filtered > stats.passed && stats.filtered > 10) {
            showInfo(`${stats.filtered} places hidden by your filters`);
          }

          // **STEP 2: APPLY HYBRID RECOMMENDATION ENGINE (Dynamic Scoring + AI Reranking)**
          console.log("🚀 Applying Hybrid Recommendation Engine...");

          let scoredPlaces: GooglePlace[] = [];

          try {
            // Call the new recommendation API
            const recommendationResponse = await fetch('/api/recommendations', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                weatherData,
                places: filteredPlaces,
                userLocation: { latitude, longitude },
                maxResults: 50,
                mood: stablePreferences.activityTypes.activeMood,
              }),
            });

            if (!recommendationResponse.ok) {
              throw new Error('Recommendation API failed');
            }

            const recommendationData = await recommendationResponse.json();

            console.log('🤖 AI Recommendation metadata:', recommendationData.metadata);

            // Use the AI-reranked and scored places
            scoredPlaces = recommendationData.places;

            console.log(`🎯 Final results: ${scoredPlaces.length} AI-ranked places`);
            console.log(`   Weather severity: ${recommendationData.metadata.weatherSeverity.toFixed(2)}`);
            console.log(`   AI reranking: ${recommendationData.metadata.aiRerankingApplied ? 'Yes ✅' : 'No (fallback to math)'}`);
            console.log(`   Weights used:`, recommendationData.metadata.weights);

            setPlaces(scoredPlaces);
          } catch (error) {
            console.error('❌ Recommendation API failed, falling back to simple rating sort:', error);

            // Simple fallback: Sort by rating and distance
            scoredPlaces = filteredPlaces.map(place => {
              const distance = distanceMap.get(place.id);
              return { ...place, distance };
            });

            // Sort by rating (primary) and distance (secondary)
            scoredPlaces.sort((a, b) => {
              const ratingA = a.rating || 0;
              const ratingB = b.rating || 0;

              // First sort by rating
              if (ratingB !== ratingA) {
                return ratingB - ratingA;
              }

              // If ratings equal, sort by distance (closer is better)
              const distanceA = a.distance || 999999;
              const distanceB = b.distance || 999999;
              return distanceA - distanceB;
            });

            console.log(`🎯 Fallback results: ${scoredPlaces.length} places (sorted by rating)`);
            setPlaces(scoredPlaces);
          }

          if (scoredPlaces.length === 0 && fetchErrors.length > 0) {
            setPlacesError(`Could not fetch activities. ${fetchErrors.slice(0, 1).join('; ')}`);
          } else if (fetchErrors.length > 0) {
            console.warn("Some place searches failed:", fetchErrors);
          }

        } catch (err: any) {
          console.error("❌ Error fetching places data:", err);
          setPlacesError(err.message || "An error occurred while finding activities.");
          setPlaces([]);
        } finally {
          setPlacesLoading(false);
        }
      };
      fetchPlacesForSuggestions();
    } else {
      setPlaces([]);
      setPlacesLoading(false);
      setPlacesError(null);
    }
  }, [
    suggestedTypes, 
    geoCoordinates?.latitude, 
    geoCoordinates?.longitude, 
    preferencesHash
    // Note: weatherData is used inside but not a dependency because:
    // - We only want to refetch when location/suggestions/preferences change
    // - weatherData changing shouldn't trigger a refetch (causes infinite loop)
    // - The weatherData object is available in closure when the effect runs
  ]);

  // --- Determine Overall Loading / Error State for UI ---
  const isPageLoading = geoLoading || weatherLoading || summaryLoading;
  const displayError = geoError || weatherError || summaryError;

  // Determine if theme is dark
  const isDarkTheme = theme.includes('night') || theme.includes('rainy') || theme === 'theme-overcast-day' || theme === 'theme-cloudy-night';

  // --- Component Return ---
  return (
    <main className={`min-h-screen ${getThemeClasses(theme)} transition-all duration-1000 ease-in-out relative overflow-hidden`}>
      {/* Toast Notifications */}
      <ToastNotification toasts={toast.toasts} onRemove={toast.removeToast} />
      
      {/* Map button */}
      {viewMode === 'list' && !isMapFullscreen && !isPageLoading && !displayError && weatherData && places.length > 0 && (
        <button
          onClick={() => setViewMode('map')}
          className={`fixed top-4 right-[68px] z-40 flex items-center gap-2 px-4 py-2.5 rounded-xl backdrop-blur-md transition-all duration-200 ${
            isDarkTheme 
              ? 'bg-white/10 hover:bg-white/20 text-white' 
              : 'bg-black/10 hover:bg-black/20 text-gray-900'
          } shadow-lg hover:shadow-xl transform hover:scale-105`}
          aria-label="Switch to map view"
        >
          <MapIcon className="w-4 h-4" />
          <span className="text-sm font-medium">Map</span>
        </button>
      )}

      {/* List button */}
      {viewMode === 'map' && !isMapFullscreen && !isPageLoading && !displayError && weatherData && places.length > 0 && (
        <button
          onClick={() => setViewMode('list')}
          className={`fixed top-4 right-[68px] z-40 flex items-center gap-2 px-4 py-2.5 rounded-xl backdrop-blur-md transition-all duration-200 ${
            isDarkTheme 
              ? 'bg-white/10 hover:bg-white/20 text-white' 
              : 'bg-black/10 hover:bg-black/20 text-gray-900'
          } shadow-lg hover:shadow-xl transform hover:scale-105`}
          aria-label="Switch to list view"
        >
          <List className="w-4 h-4" />
          <span className="text-sm font-medium">List</span>
        </button>
      )}

      {/* Settings Button */}
      {!isMapFullscreen && (
        <button
          onClick={() => setShowPreferences(true)}
          className={`fixed top-4 right-4 z-40 p-2.5 rounded-xl backdrop-blur-md transition-all duration-200 flex items-center justify-center ${
            isDarkTheme 
              ? 'bg-white/10 hover:bg-white/20 text-white' 
              : 'bg-black/10 hover:bg-black/20 text-gray-900'
          } shadow-lg hover:shadow-xl transform hover:scale-105`}
          style={{ height: '40px', width: '40px' }}
          aria-label="Open preferences"
        >
          <Settings className="w-4 h-4" />
        </button>
      )}

      {/* Mood indicator */}
      {preferences.activityTypes.activeMood && (
        <div className={`fixed top-20 right-4 z-30 px-4 py-2 rounded-full backdrop-blur-md ${
          isDarkTheme ? 'bg-white/10 text-white' : 'bg-black/10 text-gray-900'
        }`}>
          <span className="text-sm font-medium capitalize">
            Mood: {preferences.activityTypes.activeMood}
          </span>
        </div>
      )}

      {/* Weather-Adaptive Animated Background */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute inset-0 opacity-30">
          <div className={`absolute inset-0 bg-gradient-to-t from-black/50 to-transparent`} />
        </div>
      </div>

      {/* Content Container */}
      <div className="relative z-10">
        {/* Hero Header */}
        <header className={`relative overflow-hidden ${isDarkTheme ? 'text-white' : 'text-gray-900'}`}>
          <div className="absolute inset-0 bg-gradient-to-b from-black/20 to-transparent" />
          <div className="relative container mx-auto px-4 pt-8 pb-12 md:pt-12 md:pb-16">
            {/* Logo and Title */}
            <div className="text-center mb-8 animate-fade-in-down">
              <div className="inline-flex items-center justify-center p-3 bg-white/10 backdrop-blur-md rounded-2xl mb-4">
                <Activity className="w-10 h-10" />
              </div>
              <h1 className="text-4xl md:text-6xl font-bold mb-2 bg-clip-text text-transparent bg-gradient-to-r from-white to-white/80">
                ActiWeather
              </h1>
              <p className="text-lg md:text-xl opacity-90">Discover perfect activities for any weather</p>
            </div>

            {/* Weather Summary Card */}
            {weatherData && (
              <div className="max-w-4xl mx-auto animate-fade-in-up animation-delay-200">
                <div className={`relative p-6 md:p-8 rounded-3xl backdrop-blur-xl border ${
                  isDarkTheme 
                    ? 'bg-white/5 border-white/10' 
                    : 'bg-white/30 border-white/40'
                } shadow-2xl`}>
                  <div className="relative">
                    {/* Location and Weather */}
                    <div className="flex flex-col md:flex-row items-center justify-between gap-6">
                      <div className="text-center md:text-left">
                        <div className="flex items-center gap-3 justify-center md:justify-start mb-2">
                          {getWeatherIcon(weatherData)}
                          <div>
                            <h2 className="text-2xl md:text-3xl font-bold">{weatherData.name}</h2>
                            <p className="text-sm opacity-80 capitalize">{weatherData.weather[0]?.description}</p>
                          </div>
                        </div>
                        <div className="flex items-baseline gap-2 mt-4">
                          <span className="text-5xl md:text-7xl font-bold">{Math.round(weatherData.main.temp)}°</span>
                          <span className="text-xl opacity-70">Feels like {Math.round(weatherData.main.feels_like)}°</span>
                        </div>
                      </div>

                      {/* Weather Stats */}
                      <div className="grid grid-cols-3 gap-4 text-center">
                        <div className="p-3 rounded-xl bg-white/10 backdrop-blur">
                          <p className="text-2xl font-bold">{weatherData.wind.speed.toFixed(0)}</p>
                          <p className="text-xs opacity-70">mph wind</p>
                        </div>
                        <div className="p-3 rounded-xl bg-white/10 backdrop-blur">
                          <p className="text-2xl font-bold">{weatherData.main.humidity}</p>
                          <p className="text-xs opacity-70">% humidity</p>
                        </div>
                        <div className="p-3 rounded-xl bg-white/10 backdrop-blur">
                          <p className="text-2xl font-bold">{(weatherData.visibility / 1000).toFixed(0)}</p>
                          <p className="text-xs opacity-70">km visibility</p>
                        </div>
                      </div>
                    </div>

                    {/* AI Summary */}
                    {summaryText && (
                      <div className="mt-6 pt-6 border-t border-white/10">
                        <div className="flex items-start gap-3">
                          <Sparkles className="w-5 h-5 mt-1 text-yellow-400 flex-shrink-0" />
                          <p className="text-lg leading-relaxed">{summaryText}</p>
                        </div>
                        {places.length > 0 && (
                          <div className="flex items-center gap-4 mt-4 text-sm opacity-70">
                            <span className="flex items-center gap-2">
                              <TrendingUp className="w-4 h-4" />
                              {places.length} activities shown
                            </span>
                            <span className="flex items-center gap-2">
                              <MapPin className="w-4 h-4" />
                              Within {preferences.filters.maxRadius}km radius
                            </span>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Loading State */}
            {isPageLoading && (
              <div className="max-w-4xl mx-auto">
                <div className="p-12 text-center">
                  <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-white/10 backdrop-blur-md mb-6">
                    <Loader2 className="w-10 h-10 animate-spin" />
                  </div>
                  <p className="text-xl font-medium mb-2">Analyzing conditions...</p>
                  <p className="text-sm opacity-70">
                    {geoLoading && "Getting your location"}
                    {weatherLoading && "Checking weather"}
                    {summaryLoading && "Finding perfect activities"}
                  </p>
                </div>
              </div>
            )}

            {/* Error State */}
            {displayError && !isPageLoading && (
              <div className="max-w-4xl mx-auto">
                <div className="p-6 rounded-2xl bg-red-500/20 backdrop-blur-md border border-red-500/30 text-center">
                  <AlertCircle className="w-12 h-12 mx-auto mb-3 text-red-400" />
                  <p className="font-medium text-lg mb-2">Unable to load recommendations</p>
                  <p className="text-sm opacity-80">{displayError}</p>
                </div>
              </div>
            )}
          </div>
        </header>

        {/* Main Content Area */}
        {!isPageLoading && !displayError && weatherData && (
          <div className="container mx-auto px-4 pb-12">
            {/* Conditional Rendering: List or Map View */}
            {viewMode === 'list' ? (
              <ActivityList
                places={places}
                placesLoading={placesLoading}
                placesError={placesError}
                userCoordinates={geoCoordinates}
                weatherData={weatherData}
              />
            ) : (
              <MapView
                places={places}
                userCoordinates={geoCoordinates}
                weatherData={weatherData}
                isDarkTheme={isDarkTheme}
                onViewModeChange={() => setViewMode('list')}
                onOpenPreferences={() => setShowPreferences(true)}
                onFullscreenChange={setIsMapFullscreen}
              />
            )}
          </div>
        )}
      </div>

      {/* Preferences Indicator */}
      <PreferencesIndicator 
        isDarkTheme={isDarkTheme}
        onOpenPreferences={() => setShowPreferences(true)}
      />

      {/* Preferences Panel */}
      <PreferencesPanel 
        isOpen={showPreferences} 
        onClose={() => setShowPreferences(false)}
        isDarkTheme={isDarkTheme}
      />
    </main>
  );
}