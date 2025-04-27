// src/app/page.tsx
'use client';

import { useState, useEffect } from 'react';
import WeatherDisplay from '@/components/WeatherDisplay';
import ActivityList from '@/components/ActivityList';
import LocationSelector from '@/components/LocationSelector';
import useGeolocation from '@/hooks/useGeolocation';
// Import types
import type { WeatherData, GooglePlace } from '@/types'; // Adjust path if needed
// Import mapping functions
import { getSuitableCategories, getPlaceTypesForCategory } from '@/lib/activityMapper';

export default function Home() {
  // --- Existing State ---
  const { coordinates, error: geoError, loading: geoLoading } = useGeolocation();
  const [weatherData, setWeatherData] = useState<WeatherData | null>(null);
  const [weatherLoading, setWeatherLoading] = useState<boolean>(false);
  const [weatherError, setWeatherError] = useState<string | null>(null);

  // --- NEW State for Places ---
  const [places, setPlaces] = useState<GooglePlace[]>([]); // Initialize as empty array
  const [placesLoading, setPlacesLoading] = useState<boolean>(false);
  const [placesError, setPlacesError] = useState<string | null>(null);

  // --- Existing useEffect for Weather ---
  useEffect(() => {
    const latitude = coordinates?.latitude;
    const longitude = coordinates?.longitude;

    if (typeof latitude === 'number' && typeof longitude === 'number') {
      setWeatherLoading(true);
      setWeatherData(null);
      setWeatherError(null);
      // Also clear places when location changes
      setPlaces([]);
      setPlacesError(null);
      setPlacesLoading(false); // Ensure places loading stops if location changes mid-fetch

      const fetchWeather = async () => {
        try {
          const response = await fetch(`/api/weather?lat=${latitude}&lon=${longitude}&units=metric`);
          if (!response.ok) { /* ... error handling ... */ throw new Error(/* ... */); }
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
    }
  }, [coordinates?.latitude, coordinates?.longitude]); // Depend on primitive coords

  // --- NEW useEffect for Places (depends on weather and coordinates) ---
  useEffect(() => {
    const latitude = coordinates?.latitude;
    const longitude = coordinates?.longitude;

    // Only proceed if we have weather data AND valid coordinates
    if (weatherData && typeof latitude === 'number' && typeof longitude === 'number') {
      console.log("Weather data available, fetching places...");
      setPlacesLoading(true);
      setPlaces([]); // Clear previous places
      setPlacesError(null);

      const fetchPlacesForWeather = async () => {
        try {
          // 1. Determine suitable activity categories
          const suitableCategories = getSuitableCategories(weatherData);
          if (suitableCategories.length === 0) {
            console.log("No suitable activity categories for current weather.");
            setPlacesLoading(false);
            return; // Nothing to search for
          }
          console.log("Suitable Categories:", suitableCategories);

          // 2. Get all unique place types for these categories
          const uniquePlaceTypes = new Set<string>();
          suitableCategories.forEach(category => {
            const types = getPlaceTypesForCategory(category);
            types.forEach(type => uniquePlaceTypes.add(type));
          });
          console.log("Unique Place Types to Search:", Array.from(uniquePlaceTypes));

          if (uniquePlaceTypes.size === 0) {
             console.log("No specific place types found for suitable categories.");
             setPlacesLoading(false);
             return;
          }

          // 3. Prepare fetch promises for each type
          const radius = 5000; // 5km radius - make configurable later
          const fetchPromises = Array.from(uniquePlaceTypes).map(type => {
            const apiUrl = `/api/places`
            + `?lat=${latitude}`
            + `&lon=${longitude}`
            + `&radius=${radius}`
            + `&type=${encodeURIComponent(type)}`;
            console.log(`Preparing fetch for type: ${type}`);
            return fetch(apiUrl); // Returns a Promise<Response>
          });

          // 4. Execute fetches in parallel and settle all
          const settledResponses = await Promise.allSettled(fetchPromises);
          console.log("Places API responses settled:", settledResponses);

          // 5. Process results
          const aggregatedPlaces: GooglePlace[] = [];
          const uniquePlaceIds = new Set<string>();
          let fetchErrors: string[] = [];

          for (const result of settledResponses) {
            if (result.status === 'fulfilled') {
              const response = result.value; // This is the Response object
              try {
                if (response.ok) {
                    // Our /api/places route now returns the array of GooglePlace objects directly
                    const placesOfType: GooglePlace[] = await response.json();
                    console.log(`Response OK, received ${placesOfType.length} places.`); // DEBUG Log
                    placesOfType.forEach(place => {
                      // **FIX:** Use place.id (from the new API structure) instead of place.place_id
                      if (place.id && !uniquePlaceIds.has(place.id)) {
                        uniquePlaceIds.add(place.id);
                        aggregatedPlaces.push(place);
                      } else if (!place.id) {
                          console.warn("Received place without an ID:", place); // Log if a place lacks an ID
                      }
                    });
                } else {
                   // Handle non-OK response from our /api/places route
                   let errorMsg = `API route failed (${response.status})`;
                   try {
                    const errorData = await response.json();
                    errorMsg = errorData.error || errorMsg;
                    console.warn(`API route non-OK response: ${errorMsg}`, errorData); // Log the specific error
                    // Don't treat ZERO_RESULTS from Google (which our route might return as 200 OK with empty array) as critical frontend error here.
                    // Only track errors explicitly returned from our route
                    if (response.status !== 200 || errorData.error) { // Check if it was a real error status or had an error payload
                       fetchErrors.push(errorMsg);
                    }
                } catch {
                    fetchErrors.push(errorMsg); // Add generic message if error parsing failed
                }
                }
              } catch (parseError) {
                  console.error("Error parsing JSON response from /api/places", parseError);
                  fetchErrors.push("Failed to process place results.");
              }
            } else {
              // Handle rejected promises (network errors, etc.)
              console.error("Fetch promise rejected:", result.reason);
              fetchErrors.push(`Network error: ${result.reason?.message || 'Failed to fetch'}`);
            }
          }

          console.log(`Aggregated ${aggregatedPlaces.length} unique places.`);
          setPlaces(aggregatedPlaces); // Update state with found places

          // Set error state if any fetch failed critically (optional)
          if (aggregatedPlaces.length === 0 && fetchErrors.length > 0) {
            setPlacesError(`Could not fetch recommendations. ${fetchErrors.join('; ')}`);
          } else if (fetchErrors.length > 0) {
             // Optionally set a non-blocking warning if some requests failed but others succeeded
             console.warn("Some place searches failed:", fetchErrors);
             setPlacesError(null); // Or set a mild warning message
          }

        } catch (err: any) {
          console.error("Error fetching places data:", err);
          setPlacesError(err.message || "An error occurred while finding activities.");
          setPlaces([]);
        } finally {
          setPlacesLoading(false);
          console.log("Finished fetching places.");
        }
      };

      fetchPlacesForWeather();
    } else {
         // Reset places if weather data becomes unavailable
         if (!weatherData) {
             setPlaces([]);
             setPlacesError(null);
             setPlacesLoading(false);
         }
    }

  // Depend on weatherData object reference and primitive coordinates
  // Re-run when weather changes OR location changes
  }, [weatherData, coordinates?.latitude, coordinates?.longitude]);

  // --- Component Return ---
  const isLoading = geoLoading || weatherLoading; // Still loading location or initial weather?
  const displayError = geoError || weatherError; // Prioritize geo/weather errors

  return (
    <main className="flex min-h-screen flex-col items-center p-6 md:p-12 lg:p-24 bg-gradient-to-b from-sky-100 to-gray-100">
      {/* ... Header ... */}
      <div className="z-10 w-full max-w-5xl items-center justify-between font-mono text-sm lg:flex mb-8">
         <h1 className="text-3xl md:text-4xl font-bold text-center lg:text-left text-slate-700 drop-shadow">
           ActiWeather
         </h1>
      </div>

      <div className="container mx-auto grid grid-cols-1 md:grid-cols-3 gap-6 w-full max-w-5xl">
        {/* Left Column */}
        <div className="md:col-span-1 space-y-4">
          <LocationSelector />
          <WeatherDisplay
            weatherData={weatherData}
            isLoading={isLoading} // Pass combined loading state
            error={displayError} // Pass combined error state
          />
        </div>

        {/* Right Column */}
        <div className="md:col-span-2">
          {/* Pass places data and loading/error states to ActivityList */}
          <ActivityList
             places={places}
             placesLoading={placesLoading} // Pass places loading state
             placesError={placesError}     // Pass places error state
             userCoordinates={coordinates} // Pass user coords for distance calculation
             weatherData={weatherData} // Keep passing weather if needed for display context
          />
        </div>
      </div>
    </main>
  );
}