// src/components/ActivityList.tsx
'use client';

import React, { useState, useEffect, useMemo } from 'react';

// Import Types
import type { WeatherData, GooglePlace, Coordinates } from '@/types';

// Import Utils - ensure calculateWeatherSuitability is exported correctly
import { calculateDistance, formatDistance, calculateWeatherSuitability } from '@/lib/geoUtils';

// Import category helper - assuming getCategoryForPlace and enum are in activityMapper
import { getCategoryForPlace, ActivityCategory } from '@/lib/activityMapper';

// Import Lucide icons for card details
import { MapPin, Star } from 'lucide-react';

// Props interface
interface ActivityListProps {
  places: GooglePlace[];          // Initial array of places from Nearby Search
  placesLoading: boolean;         // Loading state for the initial list fetch
  placesError: string | null;     // Error state for the initial list fetch
  userCoordinates: Coordinates | null; // User's current lat/lon (from geolocation)
  weatherData: WeatherData | null;   // Current weather data for scoring context
}

// Represents the subset of details fetched by the /api/placedetails route
// Ensure this matches the fields requested by the field mask in that route
type PlaceDetail = {
    id: string;
    outdoorSeating?: boolean;
    currentOpeningHours?: { openNow?: boolean };
    rating?: number;
    userRatingCount?: number;
    displayName?: GooglePlace['displayName'];
    types?: GooglePlace['types'];
    formattedAddress?: GooglePlace['formattedAddress'];
    location?: GooglePlace['location'];
};


// Helper component for displaying rating stars visually
const RatingStars: React.FC<{ rating?: number; count?: number }> = ({ rating, count }) => {
    if (typeof rating !== 'number' || rating <= 0) {
        return <span className="text-xs text-gray-500 opacity-80">No rating</span>;
    }
    const fullStars = Math.floor(rating);
    const halfStar = rating % 1 >= 0.5;
    const emptyStars = 5 - fullStars - (halfStar ? 1 : 0);
    // Ensure React Nodes are returned and add keys
    return (
      <div className="flex items-center">
      {[...Array(fullStars)].map((_, i) => <span key={`f${i}`} className="text-yellow-400 text-sm">★</span>)}
      {halfStar && <span key="h" className="text-yellow-400 text-sm">☆</span>}
      {[...Array(emptyStars)].map((_, i) => <span key={`e${i}`} className="text-gray-300/70 text-sm">☆</span>)}
      {/* Optionally display count */}
      <span className="ml-1.5 text-xs text-gray-600 opacity-90">
          ({rating.toFixed(1)}{count ? ` / ${count} reviews` : ''})
      </span>
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

  // --- Determine which Place IDs need details (Memoized) ---
  const placeIdsToFetchDetails = useMemo(() => {
    if (!places || places.length === 0 || !userCoordinates) return [];
    const MAX_DETAILS_FETCH = 15; // Limit how many details we fetch

    const placesWithDistance = places
        .map(place => {
            let distance = -1;
            if (place.location && typeof userCoordinates.latitude === 'number' && typeof userCoordinates.longitude === 'number' && typeof place.location.latitude === 'number' && typeof place.location.longitude === 'number') {
                 distance = calculateDistance(
                    userCoordinates.latitude, userCoordinates.longitude,
                    place.location.latitude, place.location.longitude
                );
            }
            return { ...place, distance };
        })
        .filter(place => place.distance >= 0);

    placesWithDistance.sort((a, b) => a.distance - b.distance); // Sort by distance ASC

    return placesWithDistance
            .slice(0, MAX_DETAILS_FETCH)
            .map(p => p.id)
            .filter((id): id is string => !!id); // Get IDs, filter out invalid ones

  }, [places, userCoordinates]);


  // --- useEffect to Fetch Details ---
  useEffect(() => {
    if (placeIdsToFetchDetails.length === 0 || !weatherData) {
      setDetailedPlaces({}); // Clear any stale details
      setDetailsLoading(false);
      return;
    }
    const idsToFetchNow = placeIdsToFetchDetails.filter(id => !detailedPlaces[id]);
    if (idsToFetchNow.length === 0) {
      if (detailsLoading) setDetailsLoading(false); // Ensure loading stops if all loaded
      return;
    }

    console.log(`Workspaceing details for ${idsToFetchNow.length} new places...`);
    setDetailsLoading(true);
    setDetailsError(null); // Clear previous detail fetch errors

    const fetchAllDetails = async () => {
      // Create an array of fetch promises
      const detailPromises = idsToFetchNow.map(id =>
        fetch(`/api/placedetails?placeId=${id}`).then(async res => { // Make callback async
          if (!res.ok) {
            let errorMsg = `Details fetch failed (${res.status}) for ${id}`;
            try {
                const errData = await res.json(); // Try to parse error body
                errorMsg = errData.error || errorMsg;
            } catch { /* Ignore if parsing error body fails */ }
            throw new Error(errorMsg); // Throw error to be caught by Promise.allSettled
          }
          return res.json(); // Return parsed JSON on success
        })
      );

      // Wait for all fetches to complete
      const settledDetails = await Promise.allSettled(detailPromises);

      const newDetails: Record<string, PlaceDetail> = {};
      let errorsEncountered: string[] = [];

      // Process the results
      settledDetails.forEach((result, index) => {
        const placeId = idsToFetchNow[index]; // Get corresponding ID
        if (result.status === 'fulfilled') {
            // Check if the fulfilled response has an ID before storing
           if(result.value?.id){
               newDetails[placeId] = result.value as PlaceDetail;
           } else {
                console.warn(`Received details data without ID for ${placeId}`);
                errorsEncountered.push(`Invalid detail data for ${placeId}`);
           }
        } else {
          // Handle rejected promises (network errors, non-OK status from fetch)
          const reason = result.reason?.message || `Unknown error for ${placeId}`;
          console.error(`Failed to fetch/process details for placeId ${placeId}:`, reason);
          errorsEncountered.push(reason);
        }
      });

      // Update the state by merging newly fetched details with any previous ones safely
      setDetailedPlaces(prev => ({ ...prev, ...newDetails }));

      // Set an error message if some detail fetches failed
      if (errorsEncountered.length > 0) {
        setDetailsError(`Could not load all details (${errorsEncountered.length} failed).`);
      }
    };

    // Execute the detail fetching process and handle final loading state
    fetchAllDetails().finally(() => {
      setDetailsLoading(false);
      console.log("Finished fetching details attempt.");
    });

  // Re-run this effect if the list of target IDs changes or weather changes
  }, [placeIdsToFetchDetails, weatherData]);


  // --- Memoize the Final Processed & Grouped List for Rendering ---
  const groupedPlaces = useMemo(() => {
    const groups: Record<string, (GooglePlace & { distance: number, suitabilityScore: number })[]> = {};
    // Return empty groups immediately if essential data is missing
    if (!places || places.length === 0 || !userCoordinates || !weatherData) {
      return groups;
    }

    console.log("Processing final list: Merging details, scoring, filtering, sorting, grouping...");

    // 1. Merge fetched details, calculate distance, and calculate weather suitability score
    const scoredPlaces = places
      .map(place => {
        const details = detailedPlaces[place.id]; // Get details from state if available
        const enhancedPlace = { ...place, ...(details || {}) }; // Merge original place + details

        let distance = -1; // Calculate distance
        // Explicitly check all parts are numbers before calling
        if (enhancedPlace.location &&
            typeof userCoordinates.latitude === 'number' &&
            typeof userCoordinates.longitude === 'number' &&
            typeof enhancedPlace.location.latitude === 'number' &&
            typeof enhancedPlace.location.longitude === 'number')
        {
            distance = calculateDistance(
                userCoordinates.latitude, userCoordinates.longitude,
                enhancedPlace.location.latitude, enhancedPlace.location.longitude
            );
        }

        // Calculate suitability score using the enhanced place data and weather
        const suitabilityScore = calculateWeatherSuitability(enhancedPlace, weatherData);
        // ADDED/MODIFIED: Ensure rating/count are numbers for sorting
        const rating = typeof enhancedPlace.rating === 'number' ? enhancedPlace.rating : 0;
        const userRatingCount = typeof enhancedPlace.userRatingCount === 'number' ? enhancedPlace.userRatingCount : 0;
        return { ...enhancedPlace, distance, suitabilityScore, rating, userRatingCount };
      })
      .filter(place => place.distance >= 0); // Filter out places where distance calculation failed

    // 2. Filter by Open Now Status (Strictly check for === true using fetched details)
    const openPlaces = scoredPlaces.filter(place => {
       const detailData = detailedPlaces[place.id]; // Check details specifically
       // Only include if details were fetched AND openNow is explicitly true
       return detailData?.currentOpeningHours?.openNow === true;
    });
    console.log(`Filtered down to ${openPlaces.length} places confirmed open.`);

    // 3. Sort the filtered list based on NEW criteria
    openPlaces.sort((a, b) => {
      // Primary: Weather Suitability Score (Descending)
      if (a.suitabilityScore !== b.suitabilityScore) {
        return b.suitabilityScore - a.suitabilityScore;
      }
      // Secondary: Rating (Descending)
      // Using rating directly as we ensured it's a number above
      if (a.rating !== b.rating) {
        return b.rating - a.rating;
      }
      // Tertiary: User Rating Count (Descending)
      // Using userRatingCount directly
       if (a.userRatingCount !== b.userRatingCount) {
           return b.userRatingCount - a.userRatingCount; // Higher count first
       }
      // Quaternary: Distance (Ascending)
      if (a.distance !== b.distance) {
        return a.distance - b.distance;
      }
      return 0; // Places are equal if all criteria match
    });

    // 4. Group the final sorted places into categories
    openPlaces.forEach(place => {
        const category = getCategoryForPlace(place); // Use helper to map place types to our category
        const categoryName = category ? category.valueOf() : 'Other Recommendations'; // Get string name or default

        if (!groups[categoryName]) {
            groups[categoryName] = []; // Initialize array for the category if it's the first time
        }
        groups[categoryName].push(place); // Add place to its category group
    });

    console.log("Final grouped places for rendering:", groups);
    return groups; // Return the object containing grouped places

  // Re-calculate this memoized value if any of these dependencies change
  }, [places, userCoordinates, detailedPlaces, weatherData]);


  // --- Render Logic ---
  let content: React.ReactNode = null; // Initialize content variable
  const showLoading = placesLoading || detailsLoading; // Determine overall loading state

  if (showLoading) {
    // Loading state: Render improved skeleton loaders
    content = (
      <div className="space-y-6 animate-pulse">
        {[...Array(2)].map((_, i) => ( // Skeleton for 2 categories
            <div key={`cat-skeleton-${i}`}>
                {/* Skeleton heading */}
                <div className="h-6 bg-gray-400/30 rounded-md w-3/5 mb-4"></div>
                <div className="space-y-4">
                    {[...Array(2)].map((_, j) => ( // Skeleton for 2 cards per category
                        <div key={`card-skeleton-${j}`} className="p-4 rounded-xl border border-gray-400/20 bg-gray-400/10">
                             {/* Mimic Card Structure */}
                             <div className="flex justify-between items-start mb-2">
                                 <div className="space-y-2 flex-1">
                                     <div className="h-5 bg-gray-400/40 rounded w-3/4"></div> {/* Title line */}
                                     <div className="h-3 bg-gray-400/30 rounded w-full"></div> {/* Address line */}
                                 </div>
                                 <div className="h-4 bg-green-300/30 rounded-full w-10 ml-2 mt-1"></div> {/* Open badge */}
                             </div>
                              <div className="flex justify-between items-center mt-3 pt-2 border-t border-gray-400/10">
                                 <div className="h-4 bg-yellow-400/30 rounded w-1/3"></div> {/* Rating */}
                                 <div className="h-4 bg-gray-400/40 rounded w-1/4"></div> {/* Distance */}
                             </div>
                        </div>
                    ))}
                </div>
            </div>
        ))}
      </div>
    );
  } else if (placesError) {
    // Error state for initial places fetch
    content = <p className="text-center py-10 font-medium text-red-500 text-sm">Error finding activities: {placesError}</p>;
  } else if (Object.keys(groupedPlaces).length === 0) {
    // Empty state: Determine why the list is empty
    const noResultsReason = !userCoordinates ? 'Waiting for location...' :
                           !weatherData ? 'Waiting for weather data...' :
                           places.length === 0 && !placesLoading ? 'No initial places matched the suggested types.' :
                           detailsError ? `Found activities, but couldn't load details: ${detailsError}` :
                           'No suitable nearby activities confirmed open were found.';
    content = <p className="text-center py-10 opacity-80 text-sm">{noResultsReason}</p>;
  } else {
    // Success state: Render the grouped list of places
    content = (
      <div className="space-y-6">
        {/* Display non-critical details error if it occurred */}
        {detailsError && !placesError && <p className="text-orange-500 text-xs mb-3 text-center bg-orange-100/20 p-2 rounded-md">Note: {detailsError}</p>}

        {/* Map over each category group */}
        {Object.entries(groupedPlaces).map(([categoryName, placesInCategory]) => (
          <div key={categoryName} className="animate-fade-in-up">
            {/* Category Heading */}
            <h3 className="text-lg md:text-xl font-semibold mb-3 border-b border-white/20 pb-2 opacity-90">
              {categoryName}
            </h3>
            {/* List of Places in Category */}
            <ul className="space-y-4">
              {placesInCategory.slice(0, 3).map((place, index) => (
                // Individual Place Card
                <li
                  key={place.id}
                  className={`p-4 rounded-xl shadow-lg border border-white/10 bg-black/10 backdrop-blur-md hover:bg-black/20 transition duration-300 ease-in-out transform hover:-translate-y-1 animate-fade-in-up cursor-pointer`} // Added cursor-pointer
                  style={{ animationDelay: `${index * 75}ms` }}
                  // TODO: Add onClick, role, tabIndex for Detail View integration
                  // onClick={() => handlePlaceClick(place.id)} // Example
                   role="button"
                   tabIndex={0}
                   onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { /* handlePlaceClick(place.id) */ } }} // Basic keyboard accessibility
                >
                  {/* Card Top: Name, Address, Open Badge */}
                  <div className="flex justify-between items-start mb-1">
                    <div className="flex-1 min-w-0"> {/* Ensure text truncates if needed */}
                      <h4 className="text-md lg:text-lg font-semibold text-inherit pr-2 truncate">
                        {place.displayName?.text || 'Unnamed Place'}
                        <span className="text-xs font-normal opacity-70 ml-2">(Score: {place.suitabilityScore})</span>
                      </h4>
                      <p className="text-xs opacity-70 flex items-center mt-1 leading-snug">
                        <MapPin className="w-3 h-3 mr-1.5 flex-shrink-0 opacity-80" />
                        <span className='truncate'>{place.formattedAddress || 'Address not available'}</span>
                      </p>
                    </div>
                     {/* Open Badge - displayed because we filtered */}
                    <span className="flex-shrink-0 mt-1 px-2 py-0.5 text-xs font-medium text-green-900 bg-green-300/80 rounded-full">Open</span>
                  </div>
                  {/* Card Bottom: Rating, Distance */}
                  <div className="flex justify-between items-center mt-2 pt-2 border-t border-white/10">
                    <RatingStars rating={place.rating} count={place.userRatingCount} />
                    <span className="text-sm font-medium opacity-90">
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

  // --- Final Component Return ---
  // Renders the main container and the content determined above
  return (
    <div className="min-h-[300px]">
      <h2 className="text-xl font-semibold mb-4 opacity-95 text-inherit">Recommended Activities</h2>
      {content}
    </div>
  );
}; // End of ActivityList component function

export default ActivityList;