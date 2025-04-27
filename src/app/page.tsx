// src/app/page.tsx
'use client';

import React, { useState, useEffect } from 'react'; // Removed useCallback

// Import Components
import WeatherDisplay from '@/components/WeatherDisplay';
import ActivityList from '@/components/ActivityList';
import LocationSelector from '@/components/LocationSelector'; // Still needed for placeholder/status
import PreferencesModal from '@/components/PreferencesModal';

// Import Hooks and Utils
import useGeolocation from '@/hooks/useGeolocation';
import { getSuitableCategories, getPlaceTypesForCategory } from '@/lib/activityMapper'; // For AI fallback

// Import Types
import type { Coordinates, WeatherData, GooglePlace } from '@/types';

// --- Constants ---
const DEFAULT_RADIUS_METERS = 5000; // 5km fixed search radius

export default function Home() {
  // --- State Management (Simplified - Geolocation Only) ---

  // Geolocation State
  const { coordinates: geoCoordinates, error: geoError, loading: geoLoading } = useGeolocation();

  // Weather State
  const [weatherData, setWeatherData] = useState<WeatherData | null>(null);
  const [weatherLoading, setWeatherLoading] = useState<boolean>(false);
  const [weatherError, setWeatherError] = useState<string | null>(null);

  // AI Summary State
  const [summaryText, setSummaryText] = useState<string | null>(null);
  const [suggestedTypes, setSuggestedTypes] = useState<string[] | null>(null); // Types suggested by AI
  const [summaryLoading, setSummaryLoading] = useState<boolean>(false);
  const [summaryError, setSummaryError] = useState<string | null>(null);

  // Places State
  const [places, setPlaces] = useState<GooglePlace[]>([]);
  const [placesLoading, setPlacesLoading] = useState<boolean>(false);
  const [placesError, setPlacesError] = useState<string | null>(null);

  // Preferences Modal State
  const [isPrefsModalOpen, setIsPrefsModalOpen] = useState(false);

  // --- Effect for Fetching Weather AND THEN AI Summary ---
  useEffect(() => {
    const latitude = geoCoordinates?.latitude;
    const longitude = geoCoordinates?.longitude;

    // Fetch only if we have valid geolocation coordinates
    if (typeof latitude === 'number' && typeof longitude === 'number') {
      console.log("Weather/Summary Effect: Geolocation coordinates available.");
      setWeatherLoading(true);
      setWeatherData(null); setWeatherError(null);
      setPlaces([]); setPlacesError(null); // Clear dependent data
      setSummaryText(null); setSuggestedTypes(null); setSummaryError(null); setSummaryLoading(false); // Reset AI state

      const fetchWeatherAndSummary = async () => {
        let fetchedWeatherData: WeatherData | null = null;
        try {
          // Fetch Weather
          const weatherResponse = await fetch(`/api/weather?lat=${latitude}&lon=${longitude}&units=metric`);
          if (!weatherResponse.ok) {
            let errorMsg = `Weather Error: ${weatherResponse.status}`;
            try { const d = await weatherResponse.json(); errorMsg = d.error || errorMsg; } catch {}
            throw new Error(errorMsg);
          }
          fetchedWeatherData = await weatherResponse.json();
          setWeatherData(fetchedWeatherData);
          setWeatherLoading(false); // Weather loading done

          // --- Now Fetch AI Summary ---
          if (fetchedWeatherData) {
            setSummaryLoading(true);
            console.log("Weather loaded, fetching AI summary...");
            const summaryResponse = await fetch('/api/generate-summary', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                weatherData: fetchedWeatherData,
                locationName: fetchedWeatherData.name || 'your current location' // Use name from weather data
              })
            });

            const summaryData = await summaryResponse.json();
            if (!summaryResponse.ok || summaryData.error) {
              throw new Error(summaryData.error || 'Failed to generate activity summary.');
            }
            console.log("AI Summary received:", summaryData);
            setSummaryText(summaryData.summaryText);
            setSuggestedTypes(summaryData.suggestedPlaceTypes); // Set types suggested by AI
            setSummaryError(null);
          }
          // --- End Fetch AI Summary ---

        } catch (err: any) {
          console.error("Failed during Weather/Summary fetch:", err);
          if (!fetchedWeatherData) {
            setWeatherError(err.message || 'Could not fetch weather data.');
            setWeatherData(null);
            setWeatherLoading(false);
          } else { // Error was during summary fetch
            setSummaryError(err.message || 'Could not generate suggestions.');
            setSummaryText(`Couldn't get specific suggestions, but the weather is ${fetchedWeatherData.weather[0]?.description || 'varied'}.`);
            // **FALLBACK**: Use original category logic
            console.log("AI Summary failed, using fallback types.");
            const fallbackCategories = getSuitableCategories(fetchedWeatherData);
            const fallbackTypes = new Set<string>();
            fallbackCategories.forEach(cat => getPlaceTypesForCategory(cat).forEach(t => fallbackTypes.add(t)));
            setSuggestedTypes(Array.from(fallbackTypes));
            // End Fallback
          }
        } finally {
          setSummaryLoading(false); // Ensure summary loading stops
        }
      };
      fetchWeatherAndSummary();

    } else {
      // No valid geolocation coordinates yet
      console.log("Weather/Summary Effect: Waiting for geolocation coordinates.");
      setWeatherData(null); setWeatherError(null); setWeatherLoading(false);
      setPlaces([]); setPlacesError(null); setPlacesLoading(false);
      setSummaryText(null); setSuggestedTypes(null); setSummaryError(null); setSummaryLoading(false);
    }
  // Depend only on the primitive values from the geolocation hook
  }, [geoCoordinates?.latitude, geoCoordinates?.longitude]);


  // --- Effect for Fetching Places (Depends on AI suggestedTypes) ---
  useEffect(() => {
    const latitude = geoCoordinates?.latitude;
    const longitude = geoCoordinates?.longitude;
    const radius = DEFAULT_RADIUS_METERS; // Use fixed radius

    // Fetch only if we have AI suggested types AND valid geolocation coordinates
    if (suggestedTypes && suggestedTypes.length > 0 && typeof latitude === 'number' && typeof longitude === 'number') {
      console.log("Places Effect: Suggested types available, fetching places...");
      setPlacesLoading(true);
      setPlaces([]);
      setPlacesError(null);

      const fetchPlacesForSuggestions = async () => {
        try {
          const typesToFetch = Array.from(new Set(suggestedTypes)); // Ensure unique

          if (typesToFetch.length === 0) {
             console.log("No types suggested by AI (or fallback), skipping place fetch.");
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

          // Process results (same logic as before)
           for (const result of settledResponses) {
             if (result.status === 'fulfilled') {
                const response = result.value;
                try {
                    if(response.ok){
                         const placesOfType: GooglePlace[] = await response.json();
                         placesOfType.forEach(place => {
                             if (place.id && !uniquePlaceIds.has(place.id)) {
                                 uniquePlaceIds.add(place.id);
                                 aggregatedPlaces.push(place);
                             }
                         });
                    } else { /* Handle non-OK response */ }
                } catch (e) { /* Handle parse error */ fetchErrors.push('Failed to process place results.'); console.error(e); }
             } else { /* Handle rejected promise */ fetchErrors.push(`Network error: ${result.reason?.message || 'Failed to fetch'}`); console.error("Fetch promise rejected:", result.reason); }
           } // End processing loop

          setPlaces(aggregatedPlaces);
          if (aggregatedPlaces.length === 0 && fetchErrors.length > 0) {
            setPlacesError(`Could not fetch activities. ${fetchErrors.slice(0,1).join('; ')}`);
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
      // Clear places if no suggested types or geo coords invalid
      console.log("Places Effect: No suggested types or geo coords invalid, clearing places.");
      setPlaces([]);
      setPlacesLoading(false);
      setPlacesError(null);
    }
  // Depend on suggestedTypes array ref and geolocation coords primitives
  }, [suggestedTypes, geoCoordinates?.latitude, geoCoordinates?.longitude]);


  // --- Determine Overall Loading / Error State for UI ---
  const isLoading = geoLoading || weatherLoading || summaryLoading;
  const displayError = geoError || weatherError || summaryError;

  // --- Component Return ---
  return (
    <main className="flex min-h-screen flex-col items-center p-6 md:p-12 lg:p-24 bg-gradient-to-b from-sky-100 to-gray-100">
      {/* Header Section */}
      <div className="z-10 w-full max-w-5xl items-center justify-between font-mono text-sm lg:flex mb-6">
        <h1 className="text-3xl md:text-4xl font-bold text-center lg:text-left text-slate-700 drop-shadow">
          ActiWeather
        </h1>
        <button
          onClick={() => setIsPrefsModalOpen(true)}
          className="mt-2 lg:mt-0 px-3 py-1.5 bg-white border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
        >
          Preferences
        </button>
      </div>

      {/* Main Content Grid */}
      <div className="container mx-auto grid grid-cols-1 md:grid-cols-3 gap-6 w-full max-w-5xl">
        {/* Left Column */}
        <div className="md:col-span-1 space-y-4">
          {/* Location Selector only shows geo status */}
          <LocationSelector disabled={geoLoading} />
          <WeatherDisplay
            weatherData={weatherData}
            isLoading={geoLoading || weatherLoading} // Loading if getting geo or weather
            error={geoError || weatherError} // Show geo or weather errors
          />
        </div>

        {/* Right Column */}
        <div className="md:col-span-2 space-y-4">
          {/* AI Summary Display */}
           <div className="p-4 border border-gray-200 rounded-lg shadow-md bg-blue-50/50 backdrop-blur-sm min-h-[60px] flex items-center justify-center">
               {summaryLoading && <p className="text-sm text-gray-600 italic">Generating suggestions...</p>}
               {summaryError && !summaryLoading && <p className="text-sm text-red-600">{summaryError}</p>}
               {summaryText && !summaryLoading && !summaryError && <p className="text-md text-center text-gray-800">{summaryText}</p>}
               {!summaryLoading && !summaryError && !summaryText && weatherData && <p className="text-sm text-gray-500 italic">Checking for suggestions...</p>}
               {!weatherData && !geoError && !weatherError && <p className="text-sm text-gray-500 italic">Waiting for location and weather...</p>}
           </div>

          {/* Activity List */}
          <ActivityList
            places={places}
            placesLoading={placesLoading} // Pass places loading state
            placesError={placesError}     // Pass places error state
            userCoordinates={geoCoordinates} // Pass the geolocation coordinates
            weatherData={weatherData}
          />
        </div>
      </div>

      {/* Preferences Modal (Rendered conditionally) */}
      <PreferencesModal
        isOpen={isPrefsModalOpen}
        onClose={() => setIsPrefsModalOpen(false)}
      />
    </main>
  );
}