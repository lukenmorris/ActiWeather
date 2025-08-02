// src/components/ActivityList.tsx
'use client';

import React, { useState, useEffect, useMemo } from 'react';

// Import Types
import type { WeatherData, GooglePlace, Coordinates } from '@/types';

// Import Utils
import { calculateDistance, formatDistance, calculateWeatherSuitability } from '@/lib/geoUtils';

// Import category helper
import { getCategoryForPlace, ActivityCategory } from '@/lib/activityMapper';

// Import Lucide icons for card details
import { MapPin, Star } from 'lucide-react';

// Import the new ActivityDetailModal
import ActivityDetailModal from './ActivityDetailModal';

// Props interface
interface ActivityListProps {
  places: GooglePlace[];
  placesLoading: boolean;
  placesError: string | null;
  userCoordinates: Coordinates | null;
  weatherData: WeatherData | null;
}

// Represents the subset of details fetched by the /api/placedetails route
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
    
    return (
      <div className="flex items-center">
        {[...Array(fullStars)].map((_, i) => <span key={`f${i}`} className="text-yellow-400 text-sm">★</span>)}
        {halfStar && <span key="h" className="text-yellow-400 text-sm">☆</span>}
        {[...Array(emptyStars)].map((_, i) => <span key={`e${i}`} className="text-gray-300/70 text-sm">☆</span>)}
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

  // Modal state
  const [selectedPlaceId, setSelectedPlaceId] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);

  // Handlers for opening/closing modal
  const handlePlaceClick = (placeId: string) => {
    console.log('Place clicked:', placeId); // Debug log
    setSelectedPlaceId(placeId);
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    // Keep selectedPlaceId for a moment to avoid flicker during close animation
    setTimeout(() => setSelectedPlaceId(null), 300);
  };

  // --- Determine which Place IDs need details (Memoized) ---
  const placeIdsToFetchDetails = useMemo(() => {
    if (!places || places.length === 0 || !userCoordinates) return [];
    const MAX_DETAILS_FETCH = 15;

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

    placesWithDistance.sort((a, b) => a.distance - b.distance);

    return placesWithDistance
            .slice(0, MAX_DETAILS_FETCH)
            .map(p => p.id)
            .filter((id): id is string => !!id);

  }, [places, userCoordinates]);

  // --- useEffect to Fetch Details ---
  useEffect(() => {
    if (placeIdsToFetchDetails.length === 0 || !weatherData) {
      setDetailedPlaces({});
      setDetailsLoading(false);
      return;
    }
    const idsToFetchNow = placeIdsToFetchDetails.filter(id => !detailedPlaces[id]);
    if (idsToFetchNow.length === 0) {
      if (detailsLoading) setDetailsLoading(false);
      return;
    }

    console.log(`Fetching details for ${idsToFetchNow.length} new places...`);
    setDetailsLoading(true);
    setDetailsError(null);

    const fetchAllDetails = async () => {
      const detailPromises = idsToFetchNow.map(id =>
        fetch(`/api/placedetails?placeId=${id}`).then(async res => {
          if (!res.ok) {
            let errorMsg = `Details fetch failed (${res.status}) for ${id}`;
            try {
                const errData = await res.json();
                errorMsg = errData.error || errorMsg;
            } catch { }
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
        if (result.status === 'fulfilled') {
           if(result.value?.id){
               newDetails[placeId] = result.value as PlaceDetail;
           } else {
                console.warn(`Received details data without ID for ${placeId}`);
                errorsEncountered.push(`Invalid detail data for ${placeId}`);
           }
        } else {
          const reason = result.reason?.message || `Unknown error for ${placeId}`;
          console.error(`Failed to fetch/process details for placeId ${placeId}:`, reason);
          errorsEncountered.push(reason);
        }
      });

      setDetailedPlaces(prev => ({ ...prev, ...newDetails }));

      if (errorsEncountered.length > 0) {
        setDetailsError(`Could not load all details (${errorsEncountered.length} failed).`);
      }
    };

    fetchAllDetails().finally(() => {
      setDetailsLoading(false);
      console.log("Finished fetching details attempt.");
    });

  }, [placeIdsToFetchDetails, weatherData]);

  // --- Memoize the Final Processed & Grouped List for Rendering ---
  const groupedPlaces = useMemo(() => {
    const groups: Record<string, (GooglePlace & { distance: number, suitabilityScore: number })[]> = {};
    if (!places || places.length === 0 || !userCoordinates || !weatherData) {
      return groups;
    }

    console.log("Processing final list: Merging details, scoring, filtering, sorting, grouping...");

    const scoredPlaces = places
      .map(place => {
        const details = detailedPlaces[place.id];
        const enhancedPlace = { ...place, ...(details || {}) };

        let distance = -1;
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

        const suitabilityScore = calculateWeatherSuitability(enhancedPlace, weatherData);
        const rating = typeof enhancedPlace.rating === 'number' ? enhancedPlace.rating : 0;
        const userRatingCount = typeof enhancedPlace.userRatingCount === 'number' ? enhancedPlace.userRatingCount : 0;
        return { ...enhancedPlace, distance, suitabilityScore, rating, userRatingCount };
      })
      .filter(place => place.distance >= 0);

    const openPlaces = scoredPlaces.filter(place => {
       const detailData = detailedPlaces[place.id];
       return detailData?.currentOpeningHours?.openNow === true;
    });
    console.log(`Filtered down to ${openPlaces.length} places confirmed open.`);

    openPlaces.sort((a, b) => {
      if (a.suitabilityScore !== b.suitabilityScore) {
        return b.suitabilityScore - a.suitabilityScore;
      }
      if (a.rating !== b.rating) {
        return b.rating - a.rating;
      }
       if (a.userRatingCount !== b.userRatingCount) {
           return b.userRatingCount - a.userRatingCount;
       }
      if (a.distance !== b.distance) {
        return a.distance - b.distance;
      }
      return 0;
    });

    openPlaces.forEach(place => {
        const category = getCategoryForPlace(place);
        const categoryName = category ? category.valueOf() : 'Other Recommendations';

        if (!groups[categoryName]) {
            groups[categoryName] = [];
        }
        groups[categoryName].push(place);
    });

    console.log("Final grouped places for rendering:", groups);
    return groups;

  }, [places, userCoordinates, detailedPlaces, weatherData]);

  // --- Render Logic ---
  let content: React.ReactNode = null;
  const showLoading = placesLoading || detailsLoading;

  if (showLoading) {
    content = (
      <div className="space-y-6 animate-pulse">
        {[...Array(2)].map((_, i) => (
            <div key={`cat-skeleton-${i}`}>
                <div className="h-6 bg-gray-400/30 rounded-md w-3/5 mb-4"></div>
                <div className="space-y-4">
                    {[...Array(2)].map((_, j) => (
                        <div key={`card-skeleton-${j}`} className="p-4 rounded-xl border border-gray-400/20 bg-gray-400/10">
                             <div className="flex justify-between items-start mb-2">
                                 <div className="space-y-2 flex-1">
                                     <div className="h-5 bg-gray-400/40 rounded w-3/4"></div>
                                     <div className="h-3 bg-gray-400/30 rounded w-full"></div>
                                 </div>
                                 <div className="h-4 bg-green-300/30 rounded-full w-10 ml-2 mt-1"></div>
                             </div>
                              <div className="flex justify-between items-center mt-3 pt-2 border-t border-gray-400/10">
                                 <div className="h-4 bg-yellow-400/30 rounded w-1/3"></div>
                                 <div className="h-4 bg-gray-400/40 rounded w-1/4"></div>
                             </div>
                        </div>
                    ))}
                </div>
            </div>
        ))}
      </div>
    );
  } else if (placesError) {
    content = <p className="text-center py-10 font-medium text-red-500 text-sm">Error finding activities: {placesError}</p>;
  } else if (Object.keys(groupedPlaces).length === 0) {
    const noResultsReason = !userCoordinates ? 'Waiting for location...' :
                           !weatherData ? 'Waiting for weather data...' :
                           places.length === 0 && !placesLoading ? 'No initial places matched the suggested types.' :
                           detailsError ? `Found activities, but couldn't load details: ${detailsError}` :
                           'No suitable nearby activities confirmed open were found.';
    content = <p className="text-center py-10 opacity-80 text-sm">{noResultsReason}</p>;
  } else {
    content = (
      <div className="space-y-6">
        {detailsError && !placesError && <p className="text-orange-500 text-xs mb-3 text-center bg-orange-100/20 p-2 rounded-md">Note: {detailsError}</p>}

        {Object.entries(groupedPlaces).map(([categoryName, placesInCategory]) => (
          <div key={categoryName} className="animate-fade-in-up">
            <h3 className="text-lg md:text-xl font-semibold mb-3 border-b border-white/20 pb-2 opacity-90">
              {categoryName}
            </h3>
            <ul className="space-y-4">
              {placesInCategory.slice(0, 3).map((place, index) => (
                <li
                  key={place.id}
                  className={`p-4 rounded-xl shadow-lg border border-white/10 bg-black/10 backdrop-blur-md hover:bg-black/20 transition duration-300 ease-in-out transform hover:-translate-y-1 animate-fade-in-up cursor-pointer`}
                  style={{ animationDelay: `${index * 75}ms` }}
                  onClick={() => handlePlaceClick(place.id)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => { 
                    if (e.key === 'Enter' || e.key === ' ') { 
                      e.preventDefault();
                      handlePlaceClick(place.id);
                    }
                  }}
                >
                  <div className="flex justify-between items-start mb-1">
                    <div className="flex-1 min-w-0">
                      <h4 className="text-md lg:text-lg font-semibold text-inherit pr-2 truncate">
                        {place.displayName?.text || 'Unnamed Place'}
                        <span className="text-xs font-normal opacity-70 ml-2">(Score: {place.suitabilityScore})</span>
                      </h4>
                      <p className="text-xs opacity-70 flex items-center mt-1 leading-snug">
                        <MapPin className="w-3 h-3 mr-1.5 flex-shrink-0 opacity-80" />
                        <span className='truncate'>{place.formattedAddress || 'Address not available'}</span>
                      </p>
                    </div>
                    <span className="flex-shrink-0 mt-1 px-2 py-0.5 text-xs font-medium text-green-900 bg-green-300/80 rounded-full">Open</span>
                  </div>
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
  return (
    <>
      <div className="min-h-[300px]">
        <h2 className="text-xl font-semibold mb-4 opacity-95 text-inherit">Recommended Activities</h2>
        {content}
      </div>

      {/* Activity Detail Modal */}
      {selectedPlaceId && (
        <ActivityDetailModal
          isOpen={isModalOpen}
          onClose={handleCloseModal}
          placeId={selectedPlaceId}
          initialData={places.find(p => p.id === selectedPlaceId)}
          userCoordinates={userCoordinates}
        />
      )}
    </>
  );
};

export default ActivityList;