// src/components/ActivityList.tsx
'use client';

import React, { useState, useEffect, useMemo } from 'react';

// Import Types
import type { WeatherData, GooglePlace, Coordinates } from '@/types';

// Import Utils
import { calculateDistance, formatDistance, calculateWeatherSuitability } from '@/lib/geoUtils';

// Import category helper
import { getCategoryForPlace, ActivityCategory } from '@/lib/activityMapper';

// Import Lucide icons
import { 
  MapPin, Star, Clock, Users, DollarSign, Phone, Globe, 
  Navigation, ChevronRight, Sparkles, TrendingUp, Award,
  Coffee, Utensils, ShoppingBag, TreePine, Gamepad2, 
  Palette, Music, Dumbbell, Book, Car, Loader2
} from 'lucide-react';

// Import the ActivityDetailModal
import ActivityDetailModal from './ActivityDetailModal';

// Props interface
interface ActivityListProps {
  places: GooglePlace[];
  placesLoading: boolean;
  placesError: string | null;
  userCoordinates: Coordinates | null;
  weatherData: WeatherData | null;
}

// Enhanced PlaceDetail type
type PlaceDetail = {
    id: string;
    outdoorSeating?: boolean;
    currentOpeningHours?: { openNow?: boolean };
    regularOpeningHours?: { weekdayDescriptions?: string[] };
    rating?: number;
    userRatingCount?: number;
    displayName?: GooglePlace['displayName'];
    types?: GooglePlace['types'];
    formattedAddress?: GooglePlace['formattedAddress'];
    location?: GooglePlace['location'];
    priceLevel?: string;
    websiteUri?: string;
    internationalPhoneNumber?: string;
};

// Category icons mapping
const categoryIcons: Record<string, React.ComponentType<any>> = {
  'Food & Drink': Utensils,
  'Shopping': ShoppingBag,
  'Outdoor Active': TreePine,
  'Outdoor Relax': Coffee,
  'Indoor Active': Gamepad2,
  'Indoor Relax': Book,
  'Culture & Entertainment': Palette,
  'Other Recommendations': Sparkles
};

// Get category color classes
const getCategoryColorClasses = (category: string, isDark: boolean): string => {
  const colorMap: Record<string, { light: string; dark: string }> = {
    'Food & Drink': { 
      light: 'bg-orange-100 text-orange-800 border-orange-200', 
      dark: 'bg-orange-900/30 text-orange-300 border-orange-800/50' 
    },
    'Shopping': { 
      light: 'bg-purple-100 text-purple-800 border-purple-200', 
      dark: 'bg-purple-900/30 text-purple-300 border-purple-800/50' 
    },
    'Outdoor Active': { 
      light: 'bg-green-100 text-green-800 border-green-200', 
      dark: 'bg-green-900/30 text-green-300 border-green-800/50' 
    },
    'Outdoor Relax': { 
      light: 'bg-teal-100 text-teal-800 border-teal-200', 
      dark: 'bg-teal-900/30 text-teal-300 border-teal-800/50' 
    },
    'Indoor Active': { 
      light: 'bg-red-100 text-red-800 border-red-200', 
      dark: 'bg-red-900/30 text-red-300 border-red-800/50' 
    },
    'Indoor Relax': { 
      light: 'bg-blue-100 text-blue-800 border-blue-200', 
      dark: 'bg-blue-900/30 text-blue-300 border-blue-800/50' 
    },
    'Culture & Entertainment': { 
      light: 'bg-indigo-100 text-indigo-800 border-indigo-200', 
      dark: 'bg-indigo-900/30 text-indigo-300 border-indigo-800/50' 
    },
    'Other Recommendations': { 
      light: 'bg-gray-100 text-gray-800 border-gray-200', 
      dark: 'bg-gray-900/30 text-gray-300 border-gray-800/50' 
    }
  };

  const colors = colorMap[category] || colorMap['Other Recommendations'];
  return isDark ? colors.dark : colors.light;
};

// Helper to format price level
const formatPriceLevel = (priceLevel?: string): { text: string; count: number } => {
  switch (priceLevel) {
    case 'PRICE_LEVEL_FREE': return { text: 'Free', count: 0 };
    case 'PRICE_LEVEL_INEXPENSIVE': return { text: '$', count: 1 };
    case 'PRICE_LEVEL_MODERATE': return { text: '$$', count: 2 };
    case 'PRICE_LEVEL_EXPENSIVE': return { text: '$$$', count: 3 };
    case 'PRICE_LEVEL_VERY_EXPENSIVE': return { text: '$$$$', count: 4 };
    default: return { text: '', count: 0 };
  }
};

// Enhanced Rating Stars Component
const RatingStars: React.FC<{ rating?: number; count?: number; size?: 'sm' | 'md' }> = ({ 
  rating, 
  count, 
  size = 'sm' 
}) => {
    if (typeof rating !== 'number' || rating <= 0) {
        return <span className="text-xs text-gray-500 opacity-70">No rating</span>;
    }
    
    const starSize = size === 'sm' ? 'w-3 h-3' : 'w-4 h-4';
    const textSize = size === 'sm' ? 'text-xs' : 'text-sm';
    const fullStars = Math.floor(rating);
    const hasHalfStar = rating % 1 >= 0.5;
    
    return (
      <div className="flex items-center gap-1">
        <div className="flex">
          {[...Array(5)].map((_, i) => (
            <Star
              key={i}
              className={`${starSize} ${
                i < fullStars
                  ? 'fill-yellow-400 text-yellow-400'
                  : i === fullStars && hasHalfStar
                  ? 'fill-yellow-400/50 text-yellow-400'
                  : 'text-gray-300/50'
              }`}
            />
          ))}
        </div>
        <span className={`${textSize} opacity-80 ml-1`}>
          {rating.toFixed(1)} {count ? `(${count.toLocaleString()})` : ''}
        </span>
      </div>
    );
};

// Score indicator component
const ScoreIndicator: React.FC<{ score: number }> = ({ score }) => {
  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-green-500';
    if (score >= 60) return 'text-yellow-500';
    if (score >= 40) return 'text-orange-500';
    return 'text-red-500';
  };

  const getScoreLabel = (score: number) => {
    if (score >= 80) return 'Perfect Match';
    if (score >= 60) return 'Good Match';
    if (score >= 40) return 'Fair Match';
    return 'Poor Match';
  };

  return (
    <div className="flex items-center gap-2">
      <div className={`text-2xl font-bold ${getScoreColor(score)}`}>
        {score}
      </div>
      <div className="text-xs opacity-70">
        <div className="font-medium">{getScoreLabel(score)}</div>
        <div>Match Score</div>
      </div>
    </div>
  );
};

// Loading skeleton component
const LoadingSkeleton: React.FC = () => (
  <div className="space-y-8 animate-pulse">
    {[...Array(2)].map((_, categoryIndex) => (
      <div key={`cat-skeleton-${categoryIndex}`}>
        <div className="flex items-center gap-3 mb-4">
          <div className="w-8 h-8 bg-gray-400/20 rounded-lg"></div>
          <div className="h-6 bg-gray-400/20 rounded-md w-40"></div>
        </div>
        <div className="space-y-4">
          {[...Array(2)].map((_, cardIndex) => (
            <div key={`card-skeleton-${cardIndex}`} className="relative">
              <div className="p-6 rounded-2xl border border-gray-400/10 bg-gray-400/5 backdrop-blur-sm">
                <div className="flex justify-between items-start mb-4">
                  <div className="space-y-3 flex-1">
                    <div className="h-6 bg-gray-400/20 rounded w-3/4"></div>
                    <div className="h-4 bg-gray-400/15 rounded w-full"></div>
                    <div className="flex gap-4">
                      <div className="h-4 bg-gray-400/15 rounded w-20"></div>
                      <div className="h-4 bg-gray-400/15 rounded w-24"></div>
                    </div>
                  </div>
                  <div className="w-20 h-16 bg-gray-400/20 rounded-lg ml-4"></div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    ))}
  </div>
);

// The main ActivityList component
const ActivityList: React.FC<ActivityListProps> = ({
  places,
  placesLoading,
  placesError,
  userCoordinates,
  weatherData,
}) => {
  // State management
  const [detailedPlaces, setDetailedPlaces] = useState<Record<string, PlaceDetail>>({});
  const [detailsLoading, setDetailsLoading] = useState<boolean>(false);
  const [detailsError, setDetailsError] = useState<string | null>(null);
  const [selectedPlaceId, setSelectedPlaceId] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);

  // Theme detection
  const isDarkTheme = weatherData && (
    weatherData.weather[0]?.main.toLowerCase().includes('rain') ||
    weatherData.weather[0]?.main.toLowerCase().includes('cloud') ||
    (weatherData.dt > weatherData.sys.sunset || weatherData.dt < weatherData.sys.sunrise)
  );

  // Handlers
  const handlePlaceClick = (placeId: string) => {
    setSelectedPlaceId(placeId);
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setTimeout(() => setSelectedPlaceId(null), 300);
  };

  // Determine which places need details
  const placeIdsToFetchDetails = useMemo(() => {
    if (!places || places.length === 0 || !userCoordinates) return [];
    const MAX_DETAILS_FETCH = 20;

    const placesWithDistance = places
      .map(place => {
        let distance = -1;
        if (place.location && typeof userCoordinates.latitude === 'number' && typeof userCoordinates.longitude === 'number') {
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

  // Fetch details effect
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

    setDetailsLoading(true);
    setDetailsError(null);

    const fetchAllDetails = async () => {
      const detailPromises = idsToFetchNow.map(id =>
        fetch(`/api/placedetails?placeId=${id}`).then(async res => {
          if (!res.ok) {
            throw new Error(`Details fetch failed for ${id}`);
          }
          return res.json();
        })
      );

      const settledDetails = await Promise.allSettled(detailPromises);
      const newDetails: Record<string, PlaceDetail> = {};

      settledDetails.forEach((result, index) => {
        const placeId = idsToFetchNow[index];
        if (result.status === 'fulfilled' && result.value?.id) {
          newDetails[placeId] = result.value as PlaceDetail;
        }
      });

      setDetailedPlaces(prev => ({ ...prev, ...newDetails }));
    };

    fetchAllDetails().finally(() => {
      setDetailsLoading(false);
    });
  }, [placeIdsToFetchDetails, weatherData]);

  // Process and group places
  const groupedPlaces = useMemo(() => {
    const groups: Record<string, (GooglePlace & { 
      distance: number; 
      suitabilityScore: number;
      isTopPick?: boolean;
    })[]> = {};
    
    if (!places || places.length === 0 || !userCoordinates || !weatherData) {
      return groups;
    }

    const scoredPlaces = places
      .map(place => {
        const details = detailedPlaces[place.id];
        const enhancedPlace = { ...place, ...(details || {}) };

        let distance = -1;
        if (enhancedPlace.location && userCoordinates) {
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

    // Filter open places
    const openPlaces = scoredPlaces.filter(place => {
      const detailData = detailedPlaces[place.id];
      return detailData?.currentOpeningHours?.openNow === true;
    });

    // Sort by score, rating, and distance
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
      return a.distance - b.distance;
    });

    // Mark top picks (highest scoring in each category)
    const categoryTopScores: Record<string, number> = {};
    
    openPlaces.forEach(place => {
      const category = getCategoryForPlace(place);
      const categoryName = category ? category.valueOf() : 'Other Recommendations';

      if (!groups[categoryName]) {
        groups[categoryName] = [];
      }

      // Mark as top pick if it's the first (highest scoring) in its category
      const isTopPick = groups[categoryName].length === 0 && place.suitabilityScore >= 70;
      
      groups[categoryName].push({ ...place, isTopPick });
    });

    return groups;
  }, [places, userCoordinates, detailedPlaces, weatherData]);

  // Render logic
  let content: React.ReactNode = null;
  const showLoading = placesLoading || detailsLoading;

  if (showLoading) {
    content = <LoadingSkeleton />;
  } else if (placesError) {
    content = (
      <div className="text-center py-16">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-red-100/20 mb-4">
          <MapPin className="w-8 h-8 text-red-400" />
        </div>
        <p className="font-medium text-red-400 mb-2">Unable to find activities</p>
        <p className="text-sm opacity-70">{placesError}</p>
      </div>
    );
  } else if (Object.keys(groupedPlaces).length === 0) {
    const noResultsReason = !userCoordinates ? 'Waiting for location...' :
                           !weatherData ? 'Waiting for weather data...' :
                           places.length === 0 ? 'No places found for the suggested activity types.' :
                           'No suitable activities are open right now. Try expanding your search radius.';
    content = (
      <div className="text-center py-16">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gray-100/20 mb-4">
          <Clock className="w-8 h-8 opacity-50" />
        </div>
        <p className="text-lg font-medium opacity-80 mb-2">No Activities Available</p>
        <p className="text-sm opacity-60">{noResultsReason}</p>
      </div>
    );
  } else {
    // Calculate stats
    const totalPlaces = Object.values(groupedPlaces).flat().length;
    const avgScore = Math.round(
      Object.values(groupedPlaces).flat().reduce((sum, p) => sum + p.suitabilityScore, 0) / totalPlaces
    );

    content = (
      <div className="space-y-8">
        {/* Summary Stats */}
        <div className="flex items-center justify-between p-4 rounded-xl bg-white/10 backdrop-blur-sm border border-white/20">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <Award className="w-5 h-5 text-yellow-400" />
              <span className="text-sm font-medium">
                {totalPlaces} activities found
              </span>
            </div>
            <div className="flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-green-400" />
              <span className="text-sm font-medium">
                Avg. match: {avgScore}%
              </span>
            </div>
          </div>
        </div>

        {/* Category Groups */}
        {Object.entries(groupedPlaces).map(([categoryName, placesInCategory]) => {
          const CategoryIcon = categoryIcons[categoryName] || Sparkles;
          
          return (
            <div key={categoryName} className="animate-fade-in-up">
              {/* Category Header */}
              <div className="flex items-center gap-3 mb-4">
                <div className={`p-2 rounded-lg ${getCategoryColorClasses(categoryName, isDarkTheme || false)}`}>
                  <CategoryIcon className="w-5 h-5" />
                </div>
                <h3 className="text-xl font-semibold opacity-90">{categoryName}</h3>
                <span className="text-sm opacity-60">({placesInCategory.length} options)</span>
              </div>

              {/* Places Grid */}
              <div className="space-y-4">
                {placesInCategory.slice(0, 4).map((place, index) => (
                  <div key={place.id} className="relative">
                    {/* Top Pick Badge */}
                    {place.isTopPick && (
                      <div className="absolute -top-2 left-4 z-10">
                        <div className="flex items-center gap-1 px-3 py-1 bg-gradient-to-r from-yellow-400 to-orange-400 text-white text-xs font-semibold rounded-full shadow-lg">
                          <Sparkles className="w-3 h-3" />
                          TOP PICK
                        </div>
                      </div>
                    )}

                    <div
                      className={`
                        relative p-6 rounded-2xl border backdrop-blur-sm 
                        ${place.isTopPick ? 'border-yellow-400/30 bg-yellow-400/5' : 'border-white/10 bg-white/5'}
                        hover:bg-white/10 transition-all duration-300 cursor-pointer
                        transform hover:-translate-y-1 hover:shadow-xl
                        animate-fade-in-up
                      `}
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
                      <div className="flex justify-between items-start">
                        {/* Main Content */}
                        <div className="flex-1 min-w-0">
                          {/* Title and Status */}
                          <div className="flex items-start justify-between mb-2">
                            <h4 className="text-lg font-semibold pr-2">
                              {place.displayName?.text || 'Unnamed Place'}
                            </h4>
                            <span className="flex-shrink-0 px-3 py-1 text-xs font-medium text-green-900 bg-green-300/80 rounded-full">
                              Open Now
                            </span>
                          </div>

                          {/* Address */}
                          <p className="text-sm opacity-70 flex items-start gap-2 mb-3">
                            <MapPin className="w-4 h-4 mt-0.5 flex-shrink-0" />
                            <span className="line-clamp-1">{place.formattedAddress || 'Address not available'}</span>
                          </p>

                          {/* Info Row */}
                          <div className="flex flex-wrap items-center gap-4 text-sm">
                            {/* Rating */}
                            <RatingStars rating={place.rating} count={place.userRatingCount} size="sm" />
                            
                            {/* Distance */}
                            <div className="flex items-center gap-1">
                              <Car className="w-4 h-4 opacity-60" />
                              <span className="font-medium">{formatDistance(place.distance)}</span>
                            </div>

                            {/* Price Level */}
                            {detailedPlaces[place.id]?.priceLevel && (
                              <div className="flex items-center gap-1">
                                {[...Array(4)].map((_, i) => (
                                  <DollarSign
                                    key={i}
                                    className={`w-3 h-3 ${
                                      i < formatPriceLevel(detailedPlaces[place.id]?.priceLevel).count
                                        ? 'text-green-500'
                                        : 'text-gray-300/50'
                                    }`}
                                  />
                                ))}
                              </div>
                            )}

                            {/* Quick Actions */}
                            {detailedPlaces[place.id]?.internationalPhoneNumber && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  window.location.href = `tel:${detailedPlaces[place.id]?.internationalPhoneNumber}`;
                                }}
                                className="flex items-center gap-1 text-blue-400 hover:text-blue-300"
                              >
                                <Phone className="w-3 h-3" />
                                <span>Call</span>
                              </button>
                            )}
                          </div>

                          {/* Opening Hours Preview */}
                          {detailedPlaces[place.id]?.regularOpeningHours?.weekdayDescriptions && (
                            <div className="mt-3 text-xs opacity-60">
                              <Clock className="w-3 h-3 inline mr-1" />
                              {detailedPlaces[place.id]?.regularOpeningHours?.weekdayDescriptions[new Date().getDay()]}
                            </div>
                          )}
                        </div>

                        {/* Score Display */}
                        <div className="ml-4 text-right">
                          <ScoreIndicator score={place.suitabilityScore} />
                        </div>
                      </div>

                      {/* View Details Link */}
                      <div className="mt-4 pt-4 border-t border-white/10 flex items-center justify-between">
                        <span className="text-sm opacity-60">Click for photos, reviews & more</span>
                        <ChevronRight className="w-4 h-4 opacity-60" />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    );
  }

  return (
    <>
      <div className="min-h-[400px]">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-2xl font-bold opacity-95">Your Personalized Activities</h2>
            <p className="text-sm opacity-70 mt-1">
              Recommendations based on current weather and what's open now
            </p>
          </div>
          {!showLoading && Object.keys(groupedPlaces).length > 0 && (
            <div className="flex items-center gap-2 text-sm">
              <Loader2 className="w-4 h-4 animate-spin opacity-50" />
              <span className="opacity-70">Live updating</span>
            </div>
          )}
        </div>
        
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