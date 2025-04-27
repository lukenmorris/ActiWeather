// src/app/page.tsx
'use client';

import React, { useState, useEffect } from 'react'; // Removed useCallback

// Import Components
import WeatherDisplay from '@/components/WeatherDisplay';
import ActivityList from '@/components/ActivityList';
import LocationSelector from '@/components/LocationSelector';

// Import Hooks and Utils
import useGeolocation from '@/hooks/useGeolocation';
import { getSuitableCategories, getPlaceTypesForCategory } from '@/lib/activityMapper';

// Import Types
import type { Coordinates, WeatherData, GooglePlace } from '@/types';

// --- Constants ---
const DEFAULT_RADIUS_METERS = 5000; // 5km fixed search radius

export default function Home() {
  // --- State Management (Simplified) ---

  // Geolocation State - This is now the ONLY location source
  const { coordinates: geoCoordinates, error: geoError, loading: geoLoading } = useGeolocation();

  // Weather State
  const [weatherData, setWeatherData] = useState<WeatherData | null>(null);
  const [weatherLoading, setWeatherLoading] = useState<boolean>(false);
  const [weatherError, setWeatherError] = useState<string | null>(null);

  // Places State
  const [places, setPlaces] = useState<GooglePlace[]>([]);
  const [placesLoading, setPlacesLoading] = useState<boolean>(false);
  const [placesError, setPlacesError] = useState<string | null>(null);

  // Preferences Modal State
  const [isPrefsModalOpen, setIsPrefsModalOpen] = useState(false);

  // --- Effect for Fetching Weather (Uses only geoCoordinates) ---
  useEffect(() => {
    const latitude = geoCoordinates?.latitude;
    const longitude = geoCoordinates?.longitude;

    // Fetch only if we have valid geolocation coordinates
    if (typeof latitude === 'number' && typeof longitude === 'number') {
      console.log("Weather Effect: Geolocation coordinates available.");
      setWeatherLoading(true);
      setWeatherData(null);
      setWeatherError(null);
      setPlaces([]); // Clear places when weather refetches due to location change
      setPlacesError(null);

      const fetchWeather = async () => {
        try {
          const response = await fetch(`/api/weather?lat=${latitude}&lon=${longitude}&units=metric`);
          if (!response.ok) {
            let errorMsg = `Weather Error: ${response.status}`;
            try { const d = await response.json(); errorMsg = d.error || errorMsg; } catch {}
            throw new Error(errorMsg);
          }
          const data: WeatherData = await response.json();
          setWeatherData(data);
        } catch (err: any) {
          console.error("Failed to fetch weather:", err);
          setWeatherError(err.message || 'Could not fetch weather data.');
          setWeatherData(null);
        } finally {
          setWeatherLoading(false);
        }
      };
      fetchWeather();
    } else {
      // No valid geolocation coordinates yet
      console.log("Weather Effect: Waiting for geolocation coordinates.");
      setWeatherData(null);
      setWeatherError(null);
      setWeatherLoading(false); // Ensure loading is false if no coords
    }
  // Depend ONLY on the primitive values from the geolocation hook
  }, [geoCoordinates?.latitude, geoCoordinates?.longitude]);


  // --- Effect for Fetching Places (Uses only geoCoordinates and fixed radius) ---
  useEffect(() => {
    const latitude = geoCoordinates?.latitude;
    const longitude = geoCoordinates?.longitude;
    const radius = DEFAULT_RADIUS_METERS; // Use fixed radius

    // Fetch only if we have weather AND valid geolocation coordinates
    if (weatherData && typeof latitude === 'number' && typeof longitude === 'number') {
      console.log("Places Effect: Weather data available, fetching places...");
      setPlacesLoading(true);
      setPlaces([]);
      setPlacesError(null);

      const fetchPlacesForWeather = async () => {
        try {
          const suitableCategories = getSuitableCategories(weatherData);
          if (suitableCategories.length === 0) {
            console.log("No suitable activity categories for current weather.");
            setPlaces([]); setPlacesLoading(false); return;
          }
          const uniquePlaceTypes = new Set<string>();
          suitableCategories.forEach(category => {
            getPlaceTypesForCategory(category).forEach(type => uniquePlaceTypes.add(type));
          });
          if (uniquePlaceTypes.size === 0) {
             console.log("No specific place types found for suitable categories.");
             setPlaces([]); setPlacesLoading(false); return;
          }

          // Use fixed radius in the API call
          const fetchPromises = Array.from(uniquePlaceTypes).map(type => {
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
                    } else {
                        let errorMsg = `API route failed (${response.status})`;
                         try { const d = await response.json(); errorMsg = d.error || errorMsg; } catch {}
                         if (response.status !== 200 || (response.status === 200 && errorMsg !== 'ZERO_RESULTS')) { // Log non-ZERO_RESULTS errors
                             fetchErrors.push(errorMsg);
                         }
                    }
                } catch (e) { fetchErrors.push('Failed to process place results.'); console.error(e); }
             } else {
                fetchErrors.push(`Network error: ${result.reason?.message || 'Failed to fetch'}`);
                console.error("Fetch promise rejected:", result.reason);
             }
          } // End processing loop

          setPlaces(aggregatedPlaces);
          if (aggregatedPlaces.length === 0 && fetchErrors.length > 0) {
            setPlacesError(`Could not fetch recommendations. ${fetchErrors.slice(0,1).join('; ')}`);
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
      fetchPlacesForWeather();
    } else {
      // Clear places if weather or geo coordinates become invalid/unavailable
       console.log("Places Effect: Weather or geolocation coords invalid, clearing places.");
       setPlaces([]);
       setPlacesLoading(false);
       setPlacesError(null);
    }
  // Depend on weatherData object ref and geolocation coords primitives
  }, [weatherData, geoCoordinates?.latitude, geoCoordinates?.longitude]);


  // --- Determine Overall Loading / Error State for UI (Simplified) ---
  const isLoading = geoLoading || weatherLoading; // Loading if getting geo location OR fetching weather
  const displayError = geoError || weatherError; // Show geo error first, then weather error

  return (
    <main className="flex min-h-screen flex-col items-center p-6 md:p-12 lg:p-24 bg-gradient-to-b from-sky-100 to-gray-100">
      {/* Header Section */}
      <div className="z-10 w-full max-w-5xl items-center justify-between font-mono text-sm lg:flex mb-6">
        <h1 className="text-3xl md:text-4xl font-bold text-center lg:text-left text-slate-700 drop-shadow">
          ActiWeather
        </h1>
        {/* Preferences Button */}
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
          {/* Location Selector only needs disabled prop now */}
          <LocationSelector disabled={geoLoading} />
          <WeatherDisplay
            weatherData={weatherData}
            isLoading={isLoading} // Show loading if getting geo or weather
            error={displayError} // Show relevant error
          />
        </div>

        {/* Right Column */}
        <div className="md:col-span-2">
          <ActivityList
            places={places}
            placesLoading={placesLoading}
            placesError={placesError}
            // Pass the geolocation coordinates (or null)
            userCoordinates={geoCoordinates}
            weatherData={weatherData}
          />
        </div>
      </div>
    </main>
  );
}