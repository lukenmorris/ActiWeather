// src/components/ActivityList.tsx
'use client';

import React from 'react';
// Import needed types from your central types file
import type { WeatherData, GooglePlace, Coordinates } from '@/types';

// Define the props the component expects to receive
interface ActivityListProps {
  places: GooglePlace[];          // Array of places found
  placesLoading: boolean;         // Loading state for places
  placesError: string | null;     // Error state for places
  userCoordinates: Coordinates | null; // User's current lat/lon
  weatherData: WeatherData | null;   // Current weather (might be useful for context)
}

// Update the function signature to destructure the new props
const ActivityList: React.FC<ActivityListProps> = ({
  places,
  placesLoading,
  placesError,
  userCoordinates,
  weatherData // Keep weatherData if needed, otherwise it can be removed later
}) => {

  // --- We will implement the logic using these props in the NEXT step ---
  // For now, just use the loading/error states for placeholder content:

  let content;

  if (placesLoading) {
    content = (
      <div className="flex justify-center items-center h-full">
        <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-blue-500"></div>
        <p className="ml-3 text-gray-600">Finding nearby activities...</p>
      </div>
    );
  } else if (placesError) {
    content = <p className="text-red-600 text-center font-medium">Error finding activities: {placesError}</p>;
  } else if (places.length === 0) {
      // Check if weatherData exists to differentiate between initial state and no results
      content = <p className="text-gray-500 text-center">{weatherData ? 'No suitable nearby activities found for the current weather.' : 'Waiting for weather data...'}</p>;
  } else {
    // Placeholder until we add the list rendering and sorting
    content = <p className="text-gray-700">Found {places.length} potential activities! (Display logic coming soon)</p>;
  }
  // --- End of temporary placeholder logic ---


  return (
    <div className="p-4 border border-gray-200 rounded-lg shadow-md bg-white/80 backdrop-blur-sm min-h-[300px]">
      <h2 className="text-xl font-semibold mb-3 text-slate-600">Recommended Activities</h2>
      {content}
    </div>
  );
};

export default ActivityList;