// src/components/ActivityList.tsx
'use client';

import React, { useState, useEffect, useMemo } from 'react';
// Import types
import type { WeatherData, GooglePlace, Coordinates } from '@/types';
// Import utils - ensure calculateWeatherSuitability is exported correctly
import { calculateDistance, formatDistance, calculateWeatherSuitability } from '@/lib/geoUtils';
// Import category helper - assuming getCategoryForPlace and enum are in activityMapper
import { getCategoryForPlace, ActivityCategory } from '@/lib/activityMapper';

// Define the props the component expects to receive from page.tsx
interface ActivityListProps {
  places: GooglePlace[];          // Initial array of places found via Nearby Search
  placesLoading: boolean;         // Loading state for the initial list fetch
  placesError: string | null;     // Error state for the initial list fetch
  userCoordinates: Coordinates | null; // User's current lat/lon for distance calculation
  weatherData: WeatherData | null;   // Current weather data for scoring
}

// Represents the subset of details fetched by the /api/placedetails route
// Ensure this matches the fields requested by the field mask in that route
type PlaceDetail = {
    id: string; // Essential to match back
    outdoorSeating?: boolean; // Used in suitability score
    currentOpeningHours?: { openNow?: boolean }; // Used for filtering open places
    // Include other fields fetched by details if needed (e.g., rating, userRatingCount)
    rating?: number;
    userRatingCount?: number;
    // Add displayName, types, formattedAddress, location if re-fetching them for consistency
    displayName?: GooglePlace['displayName'];
    types?: GooglePlace['types'];
    formattedAddress?: GooglePlace['formattedAddress'];
    location?: GooglePlace['location'];
};


// Helper component for displaying rating stars visually
const RatingStars: React.FC<{ rating?: number }> = ({ rating }) => {
    if (typeof rating !== 'number' || rating <= 0) {
        return <span className="text-xs text-gray-500">No rating</span>;
    }
    const fullStars = Math.floor(rating);
    const halfStar = rating % 1 >= 0.5;
    const emptyStars = 5 - fullStars - (halfStar ? 1 : 0);
    return (
        <div className="flex items-center">
            {[...Array(fullStars)].map((_, i) => <span key={`f${i}`} className="text-yellow-500 text-sm">★</span>)}
            {halfStar && <span className="text-yellow-500 text-sm">☆</span>} {/* Simple outline for half */}
            {[...Array(emptyStars)].map((_, i) => <span key={`e${i}`} className="text-gray-300 text-sm">☆</span>)}
            <span className="ml-1 text-xs text-gray-600">({rating.toFixed(1)})</span>
        </div>
    );
};


// The main ActivityList component
const ActivityList: React.FC<ActivityListProps> = ({
  places,
  placesLoading,
  placesError,
  userCoordinates,
  weatherData,
}) => {
  // State to store fetched details (keyed by place ID)
  const [detailedPlaces, setDetailedPlaces] = useState<Record<string, PlaceDetail>>({});
  const [detailsLoading, setDetailsLoading] = useState<boolean>(false);
  const [detailsError, setDetailsError] = useState<string | null>(null);

  // --- Determine which Place IDs need details (e.g., top N closest) ---
  const placeIdsToFetchDetails = useMemo(() => {
    if (!places || places.length === 0 || !userCoordinates) return [];
    const MAX_DETAILS_FETCH = 15; // Limit how many details we fetch

    const placesWithDistance = places
        .map(place => ({
            ...place,
            distance: place.location ? calculateDistance(
                userCoordinates.latitude, userCoordinates.longitude,
                place.location.latitude, place.location.longitude
            ) : -1
        }))
        .filter(place => place.distance >= 0);

    placesWithDistance.sort((a, b) => a.distance - b.distance); // Sort by distance ASC

    return placesWithDistance
            .slice(0, MAX_DETAILS_FETCH)
            .map(p => p.id)
            .filter((id): id is string => !!id); // Get IDs, filter out invalid ones

  }, [places, userCoordinates]);


  // --- useEffect to Fetch Details when target IDs change ---
  useEffect(() => {
    // Only run if we have target IDs and weather data (needed for context/scoring)
    if (placeIdsToFetchDetails.length === 0 || !weatherData) {
      setDetailedPlaces({}); // Clear details if no targets or weather context
      setDetailsLoading(false);
      return;
    }

    const idsToFetchNow = placeIdsToFetchDetails.filter(id => !detailedPlaces[id]);

    if (idsToFetchNow.length === 0) {
      if (detailsLoading) setDetailsLoading(false); // Ensure loading stops if all loaded
      return;
    }

    console.log(`Workspaceing details for ${idsToFetchNow.length} places...`);
    setDetailsLoading(true);
    setDetailsError(null);

    const fetchAllDetails = async () => {
      const detailPromises = idsToFetchNow.map(id =>
        fetch(`/api/placedetails?placeId=${id}`).then(async res => {
          if (!res.ok) {
            let errorMsg = `Details fetch failed (${res.status}) for ${id}`;
            try { const errData = await res.json(); errorMsg = errData.error || errorMsg; } catch { /* Ignore */ }
            throw new Error(errorMsg);
          }
          return res.json();
        })
      );

      const settledDetails = await Promise.allSettled(detailPromises);
      const newDetails: Record<string, PlaceDetail> = {};
      let errorsEncountered: string[] = [];

      settledDetails.forEach((result, index) => {
        const placeId = idsToFetchNow[index];
        if (result.status === 'fulfilled' && result.value?.id) {
            newDetails[placeId] = result.value as PlaceDetail;
        } else {
          const reason = result.status === 'rejected' ? result.reason?.message : `Invalid detail data for ${placeId}`;
          console.error(`Failed to fetch/process details for placeId ${placeId}:`, reason);
          errorsEncountered.push(reason || `Unknown error for ${placeId}`);
        }
      });

      setDetailedPlaces(prev => ({ ...prev, ...newDetails })); // Merge new details safely
      if (errorsEncountered.length > 0) {
        setDetailsError(`Could not load all details (${errorsEncountered.length} failed).`);
      }
    };

    fetchAllDetails().finally(() => {
      setDetailsLoading(false);
      console.log("Finished fetching details attempt.");
    });

  }, [placeIdsToFetchDetails, weatherData]); // Rerun if target IDs or weather change


  // --- Memoize the Final Processed & Grouped List ---
  const groupedPlaces = useMemo(() => {
    const groups: Record<string, (GooglePlace & { distance: number, suitabilityScore: number })[]> = {};

    if (!places || places.length === 0 || !userCoordinates || !weatherData) {
      return groups;
    }
    console.log("Processing final list: Merging, scoring, filtering, sorting, grouping...");

    // 1. Merge details, calculate distance & suitability score
    const scoredPlaces = places
      .map(place => {
        const details = detailedPlaces[place.id];
        const enhancedPlace = { ...place, ...(details || {}) }; // Merge place + details
        const distance = enhancedPlace.location ? calculateDistance(
          userCoordinates.latitude, userCoordinates.longitude,
          enhancedPlace.location.latitude, enhancedPlace.location.longitude
        ) : -1;
        const suitabilityScore = calculateWeatherSuitability(enhancedPlace, weatherData);
        return { ...enhancedPlace, distance, suitabilityScore };
      })
      .filter(place => place.distance >= 0);

    // 2. Filter by Open Now Status (use details if available, otherwise keep?)
    // Let's adjust to filter strictly based on details if available, otherwise keep
    const openPlaces = scoredPlaces.filter(place => {
      const detailData = detailedPlaces[place.id];
      return detailData?.currentOpeningHours?.openNow === true;
  });
   console.log(`Filtered down to ${openPlaces.length} places confirmed open.`);


    // 3. Sort the filtered list
    openPlaces.sort((a, b) => {
      if (a.suitabilityScore !== b.suitabilityScore) return b.suitabilityScore - a.suitabilityScore; // DESC Suitability
      if (a.distance !== b.distance) return a.distance - b.distance; // ASC Distance
      const ratingA = a.rating ?? 0;
      const ratingB = b.rating ?? 0;
      return ratingB - ratingA; // DESC Rating
    });

    // 4. Group the sorted places by category
    openPlaces.forEach(place => {
      const category = getCategoryForPlace(place);
      const categoryName = category ? category.valueOf() : 'Other Recommendations'; // Default group name

      if (!groups[categoryName]) {
        groups[categoryName] = [];
      }
      groups[categoryName].push(place);
    });

    console.log("Final grouped places:", groups);
    return groups;

  }, [places, userCoordinates, detailedPlaces, weatherData]);


  // --- Render Logic ---
  let content;
  const showLoading = placesLoading || detailsLoading; // Combined loading state

  if (showLoading) {
    content = (
        <div className="flex justify-center items-center h-full py-10">
            <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-blue-500"></div>
            <p className="ml-3 text-gray-600">Finding and refining activities...</p>
        </div>
    );
  } else if (placesError) {
    content = <p className="text-red-600 text-center font-medium py-10">Error finding activities: {placesError}</p>;
  } else if (Object.keys(groupedPlaces).length === 0) {
    // Determine reason for no results
    const noResultsReason = !userCoordinates ? 'Waiting for location...' :
                           !weatherData ? 'Waiting for weather data...' :
                           places.length === 0 ? 'No suitable nearby activities found for the current weather.' :
                           detailsError ? `Found activities, but couldn't load details: ${detailsError}` :
                           'No suitable nearby activities confirmed open were found.'; // Default if non-empty places resulted in empty groups
    content = <p className="text-gray-500 text-center py-10">{noResultsReason}</p>;
  } else {
    // Display the grouped list
    content = (
      <div className="space-y-6">
        {detailsError && <p className="text-orange-600 text-sm mb-3 text-center">Note: {detailsError}</p>}
        {Object.entries(groupedPlaces).map(([categoryName, placesInCategory]) => (
          <div key={categoryName}>
            <h3 className="text-lg font-semibold text-slate-700 mb-2 border-b border-slate-300 pb-1">
              {categoryName}
            </h3>
            <ul className="space-y-3">
              {placesInCategory.map((place) => (
                <li key={place.id} className="p-3 border border-gray-200 rounded-md shadow-sm bg-white hover:shadow-md transition-shadow duration-200">
                  <div className="flex justify-between items-start mb-1">
                    <div>
                      <h4 className="text-md font-semibold text-blue-700 pr-2">
                        {place.displayName?.text || 'Unnamed Place'}
                        {/* DEBUG: Optional score display */}
                         <span className="text-xs font-normal text-gray-500 ml-2">(Score: {place.suitabilityScore})</span>
                      </h4>
                      <p className="text-sm text-gray-600">
                        {place.formattedAddress || 'Address not available'}
                      </p>
                    </div>
                     {/* Assume shown places are open based on filter */}
                     <span className="flex-shrink-0 px-2 py-0.5 text-xs font-medium text-green-800 bg-green-100 rounded-full">Open</span>
                  </div>
                  <div className="flex justify-between items-center mt-1">
                    <RatingStars rating={place.rating} />
                    <span className="text-sm font-medium text-gray-800">
                      {formatDistance(place.distance)} away
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="p-4 border border-gray-200 rounded-lg shadow-md bg-white/80 backdrop-blur-sm min-h-[300px]">
      <h2 className="text-xl font-semibold mb-4 text-slate-600">Recommended Activities</h2>
      {content}
    </div>
  );
};

export default ActivityList;