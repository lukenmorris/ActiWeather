// src/hooks/useGeolocation.ts
'use client';

import { useState, useEffect } from 'react';

// (Keep the Coordinates and GeolocationState interfaces here)
interface Coordinates { latitude: number; longitude: number; }
interface GeolocationState { coordinates: Coordinates | null; error: string | null; loading: boolean; }


const useGeolocation = (options?: PositionOptions): GeolocationState => {
  const [state, setState] = useState<GeolocationState>({
    coordinates: null,
    error: null,
    loading: true,
  });

  // --- DEBUG LOG ---
  console.log("useGeolocation hook rendering/running.");

  useEffect(() => {
    // --- DEBUG LOG ---
    console.log("useGeolocation useEffect triggered.");

    // Check if geolocation is available
    if (!navigator.geolocation) {
      // --- DEBUG LOG ---
      console.log("navigator.geolocation is NOT available.");
      setState({
        coordinates: null,
        error: 'Geolocation is not supported by your browser.',
        loading: false,
       });
      return;
    }

    // --- DEBUG LOG ---
    console.log("navigator.geolocation IS available.");

    const onSuccess = (position: GeolocationPosition) => {
      // --- DEBUG LOG ---
      console.log("Geolocation onSuccess callback triggered:", position);
      setState({
        coordinates: {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        },
        error: null,
        loading: false,
      });
    };

    const onError = (error: GeolocationPositionError) => {
     // --- DEBUG LOG ---
     console.error("Geolocation onError callback triggered:", error); // Log the full error object
      let errorMessage = 'Unknown geolocation error.';
      // (Keep the switch statement here)
      switch(error.code) {
        case error.PERMISSION_DENIED: errorMessage = "User denied the request for Geolocation."; break;
        case error.POSITION_UNAVAILABLE: errorMessage = "Location information is unavailable."; break;
        case error.TIMEOUT: errorMessage = "The request to get user location timed out."; break;
      }
      setState({
        coordinates: null,
        error: errorMessage,
        loading: false,
      });
    };

    // Request the current position
    // --- DEBUG LOG ---
    console.log("Attempting to call navigator.geolocation.getCurrentPosition...");
    try {
        navigator.geolocation.getCurrentPosition(onSuccess, onError, options);
        // --- DEBUG LOG ---
        console.log("Call to getCurrentPosition made successfully.");
    } catch (e) {
        // --- DEBUG LOG ---
        console.error("Error occurred when TRYING to call getCurrentPosition:", e);
        setState({ coordinates: null, error: "Failed to initiate geolocation request.", loading: false });
    }

  }, [options]);

  return state;
};

export default useGeolocation;