// src/app/page.tsx
'use client';

import React, { useState, useEffect } from 'react';

// Import Components
import WeatherDisplay from '@/components/WeatherDisplay';
import ActivityList from '@/components/ActivityList';
import LocationSelector from '@/components/LocationSelector'; // Used for geo status display
// Removed PreferencesModal import

// Import Hooks and Utils
import useGeolocation from '@/hooks/useGeolocation';
import { getSuitableCategories, getPlaceTypesForCategory } from '@/lib/activityMapper'; // For AI fallback

// Import Types
import type { Coordinates, WeatherData, GooglePlace } from '@/types';

// --- Constants ---
const DEFAULT_RADIUS_METERS = 5000; // 5km fixed search radius

export default function Home() {
  // --- State Management ---

  // Geolocation State
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

  // Removed Preferences Modal State

  // Theme State
  const [theme, setTheme] = useState('theme-default');

  // --- Helper Functions for Theme ---
  const getWeatherTheme = (weather: WeatherData | null): string => {
      if (!weather) return 'theme-default';
      const condition = weather.weather[0]?.main.toLowerCase();
      const isDay = (weather.sys?.sunrise && weather.sys?.sunset && weather.dt)
                    ? (weather.dt > weather.sys.sunrise && weather.dt < weather.sys.sunset)
                    : true; // Default to day
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
          case 'theme-clear-day': return 'bg-gradient-to-br from-sky-400 via-blue-500 to-blue-600 text-white';
          case 'theme-clear-night': return 'bg-gradient-to-br from-slate-800 via-indigo-900 to-black text-slate-100';
          case 'theme-cloudy-day': return 'bg-gradient-to-br from-slate-300 via-gray-400 to-slate-500 text-slate-800';
          case 'theme-overcast-day': return 'bg-gradient-to-br from-gray-400 via-slate-500 to-slate-600 text-white';
          case 'theme-cloudy-night': return 'bg-gradient-to-br from-slate-600 via-slate-700 to-slate-800 text-slate-200';
          case 'theme-rainy': return 'bg-gradient-to-br from-blue-600 via-slate-700 to-gray-800 text-blue-50';
          case 'theme-snowy': return 'bg-gradient-to-br from-sky-100 via-slate-200 to-gray-300 text-slate-700';
          case 'theme-foggy': return 'bg-gradient-to-br from-gray-400 via-slate-400 to-gray-500 text-slate-800';
          default: return 'bg-slate-100 text-slate-800';
      }
  };

  // --- Effect for Updating Theme ---
  useEffect(() => {
    const newTheme = getWeatherTheme(weatherData);
    setTheme(newTheme);
  }, [weatherData]);


  // --- Effect for Fetching Weather AND THEN AI Summary (Uses only geoCoordinates) ---
  useEffect(() => {
    const latitude = geoCoordinates?.latitude;
    const longitude = geoCoordinates?.longitude;

    if (typeof latitude === 'number' && typeof longitude === 'number') {
      console.log("Weather/Summary Effect: Geolocation coordinates available. Fetching weather...");
      setWeatherLoading(true);
      setWeatherData(null); setWeatherError(null);
      setPlaces([]); setPlacesError(null);
      setSummaryText(null); setSuggestedTypes(null); setSummaryError(null); setSummaryLoading(false);

      const fetchWeatherAndSummary = async () => {
        let fetchedWeatherData: WeatherData | null = null;
        try {
          // Fetch Weather - Updated to use imperial units
          const weatherResponse = await fetch(`/api/weather?lat=${latitude}&lon=${longitude}&units=imperial`);
          if (!weatherResponse.ok) {
            let errorMsg = `Weather Error: ${weatherResponse.status}`;
            try { const d = await weatherResponse.json(); errorMsg = d.error || errorMsg; } catch {}
            throw new Error(errorMsg);
          }
          fetchedWeatherData = await weatherResponse.json();
          setWeatherData(fetchedWeatherData);
          setWeatherLoading(false);

          // Fetch AI Summary
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
            setWeatherData(null); setWeatherLoading(false);
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
      // Clear states if no valid coordinates
      setWeatherData(null); setWeatherError(null); setWeatherLoading(false);
      setPlaces([]); setPlacesError(null); setPlacesLoading(false);
      setSummaryText(null); setSuggestedTypes(null); setSummaryError(null); setSummaryLoading(false);
    }
  }, [geoCoordinates?.latitude, geoCoordinates?.longitude]);


  // --- Effect for Fetching Places (Depends on AI suggestedTypes) ---
  useEffect(() => {
    const latitude = geoCoordinates?.latitude;
    const longitude = geoCoordinates?.longitude;
    const radius = DEFAULT_RADIUS_METERS;

    if (suggestedTypes && suggestedTypes.length > 0 && typeof latitude === 'number' && typeof longitude === 'number') {
      console.log("Places Effect: Suggested types available, fetching places...");
      setPlacesLoading(true);
      setPlaces([]);
      setPlacesError(null);

      const fetchPlacesForSuggestions = async () => {
        try {
          const typesToFetch = Array.from(new Set(suggestedTypes));
          if (typesToFetch.length === 0) {
             setPlaces([]); setPlacesLoading(false); return;
          }
          console.log("Fetching places for types:", typesToFetch);

          const fetchPromises = typesToFetch.map(type => {
            const apiUrl = `/api/places?lat=${latitude}&lon=${longitude}&radius=${radius}&type=${type}`;
            return fetch(apiUrl);
          });

          const settledResponses = await Promise.allSettled(fetchPromises);
          const aggregatedPlaces: GooglePlace[] = [];
          const uniquePlaceIds = new Set<string>();
          let fetchErrors: string[] = [];

          // Process settled results
          console.log("Processing settled places responses...");
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
                  if (errorDetails !== 'ZERO_RESULTS') { // Log non-ZERO_RESULTS errors
                    fetchErrors.push(`${errorMsg}`);
                    console.warn(`Places API route error: ${errorMsg}`, errorData);
                  }
                }
              } catch (e) {
                 fetchErrors.push('Failed to process place results.'); console.error("Failed to parse places response:", e);
              }
            } else {
              fetchErrors.push(`Network error: ${result.reason?.message || 'Failed to fetch'}`);
              console.error("Fetch promise to /api/places rejected:", result.reason);
            }
          } // End processing loop

          console.log(`Aggregated ${aggregatedPlaces.length} unique places.`);
          setPlaces(aggregatedPlaces);

          if (aggregatedPlaces.length === 0 && fetchErrors.length > 0) {
            setPlacesError(`Could not fetch activities. ${fetchErrors.slice(0, 1).join('; ')}`);
          } else if (fetchErrors.length > 0) {
            console.warn("Some place searches failed:", fetchErrors);
          }

        } catch (err: any) {
          console.error("Error fetching places data:", err);
          setPlacesError(err.message || "An error occurred while finding activities.");
          setPlaces([]);
        } finally {
          setPlacesLoading(false);
        }
      };
      fetchPlacesForSuggestions();
    } else {
      // Clear places if no suggested types or coords invalid
      setPlaces([]);
      setPlacesLoading(false);
      setPlacesError(null);
    }
  }, [suggestedTypes, geoCoordinates?.latitude, geoCoordinates?.longitude]);


  // --- Determine Overall Loading / Error State for UI ---
  const isPageLoading = geoLoading || weatherLoading || summaryLoading;
  const displayError = geoError || weatherError || summaryError;

  // --- Component Return ---
  return (
    <main className={`flex min-h-screen flex-col items-center ${getThemeClasses(theme)} transition-colors duration-700 ease-in-out`}>
      {/* Header Section */}
      <header className={`sticky top-0 z-40 w-full border-b backdrop-blur-md transition-colors duration-500 ease-in-out ${
           theme.includes('night') || theme.includes('rainy') || theme === 'theme-overcast-day'
           ? 'border-white/20 bg-black/10 text-white'
           : 'border-gray-200/50 bg-white/20 text-inherit'
       }`}>
        <div className="container mx-auto flex h-16 max-w-5xl items-center justify-between px-4">
          <h1 className="text-xl md:text-2xl font-bold tracking-tight">
            ActiWeather
          </h1>
          {/* Preferences button removed */}
        </div>
      </header>

      {/* Main Content Area */}
      <div className="container mx-auto w-full max-w-5xl flex-grow p-4 md:p-6 lg:p-8">
         {isPageLoading && (
            <div className="flex justify-center items-center py-10 text-lg font-medium opacity-80">
                Loading Weather & Suggestions...
            </div>
         )}
         {displayError && !isPageLoading && (
             <div className="p-4 mb-6 rounded-md bg-red-100/80 text-red-700 text-center">
                Error: {displayError}
             </div>
         )}

        {!isPageLoading && !displayError && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Left Column */}
            <div className="lg:col-span-1 space-y-6">
              <LocationSelector disabled={geoLoading} />
              <WeatherDisplay
                weatherData={weatherData}
                isLoading={false}
                error={null}
              />
            </div>

            {/* Right Column */}
            <div className="lg:col-span-2 space-y-6">
              {/* AI Summary Display */}
              <div className={`p-4 rounded-xl shadow-lg min-h-[70px] flex items-center justify-center ${theme.includes('night') || theme.includes('rainy') || theme === 'theme-overcast-day' ? 'bg-black/20 text-white/90' : 'bg-white/30 backdrop-blur-sm text-inherit' }`}>
                  {summaryLoading && <p className="text-sm italic opacity-80">Generating suggestions...</p>}
                  {summaryError && !summaryLoading && <p className="text-sm text-orange-400">{summaryError}</p>}
                  {summaryText && !summaryLoading && !summaryError && <p className="text-md text-center font-medium">{summaryText}</p>}
                  {!summaryLoading && !summaryError && !summaryText && weatherData && <p className="text-sm italic opacity-70">Checking for suggestions...</p>}
                  {!weatherData && !geoError && <p className="text-sm italic opacity-70">Waiting for location and weather...</p>}
              </div>

              {/* Activity List */}
              <ActivityList
                places={places}
                placesLoading={placesLoading}
                placesError={placesError}
                userCoordinates={geoCoordinates} // Pass the geolocation coordinates
                weatherData={weatherData}
              />
            </div>
          </div>
        )}
      </div>

      {/* Preferences Modal Removed */}
    </main>
  );
}