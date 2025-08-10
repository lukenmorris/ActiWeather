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
  MapPin, Star, Clock, Phone, Globe, Navigation, 
  ChevronRight, Sparkles, TrendingUp, Award, Heart,
  Coffee, Utensils, ShoppingBag, TreePine, Gamepad2, 
  Palette, Music, Dumbbell, Book, Car, Loader2,
  Zap, Shield, Flame, Snowflake, Sun, Moon, CloudRain,
  ExternalLink, Info, DollarSign, Users, Bookmark
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

// Category icons and colors
const categoryConfig: Record<string, { 
  icon: React.ComponentType<any>; 
  gradient: string;
  darkGradient: string;
  accentColor: string;
}> = {
  'Food & Drink': { 
    icon: Utensils, 
    gradient: 'from-orange-400 to-red-500',
    darkGradient: 'from-orange-600 to-red-700',
    accentColor: 'orange'
  },
  'Shopping': { 
    icon: ShoppingBag, 
    gradient: 'from-purple-400 to-pink-500',
    darkGradient: 'from-purple-600 to-pink-700',
    accentColor: 'purple'
  },
  'Outdoor Active': { 
    icon: TreePine, 
    gradient: 'from-green-400 to-emerald-500',
    darkGradient: 'from-green-600 to-emerald-700',
    accentColor: 'green'
  },
  'Outdoor Relax': { 
    icon: Coffee, 
    gradient: 'from-teal-400 to-cyan-500',
    darkGradient: 'from-teal-600 to-cyan-700',
    accentColor: 'teal'
  },
  'Indoor Active': { 
    icon: Gamepad2, 
    gradient: 'from-red-400 to-pink-500',
    darkGradient: 'from-red-600 to-pink-700',
    accentColor: 'red'
  },
  'Indoor Relax': { 
    icon: Book, 
    gradient: 'from-blue-400 to-indigo-500',
    darkGradient: 'from-blue-600 to-indigo-700',
    accentColor: 'blue'
  },
  'Culture & Entertainment': { 
    icon: Palette, 
    gradient: 'from-indigo-400 to-purple-500',
    darkGradient: 'from-indigo-600 to-purple-700',
    accentColor: 'indigo'
  },
  'Other Recommendations': { 
    icon: Sparkles, 
    gradient: 'from-gray-400 to-gray-500',
    darkGradient: 'from-gray-600 to-gray-700',
    accentColor: 'gray'
  }
};

// Helper to format price level
const PriceIndicator: React.FC<{ priceLevel?: string }> = ({ priceLevel }) => {
  const getCount = () => {
    switch (priceLevel) {
      case 'PRICE_LEVEL_INEXPENSIVE': return 1;
      case 'PRICE_LEVEL_MODERATE': return 2;
      case 'PRICE_LEVEL_EXPENSIVE': return 3;
      case 'PRICE_LEVEL_VERY_EXPENSIVE': return 4;
      default: return 0;
    }
  };
  
  const count = getCount();
  if (count === 0) return null;
  
  return (
    <div className="flex items-center">
      {[...Array(4)].map((_, i) => (
        <DollarSign
          key={i}
          className={`w-3 h-3 ${
            i < count ? 'text-green-400' : 'text-gray-500/30'
          }`}
        />
      ))}
    </div>
  );
};

// Enhanced Rating Component
const RatingDisplay: React.FC<{ rating?: number; count?: number }> = ({ rating, count }) => {
  if (!rating) return null;
  
  const fullStars = Math.floor(rating);
  const hasHalfStar = rating % 1 >= 0.5;
  
  return (
    <div className="flex items-center gap-2">
      <div className="flex items-center">
        {[...Array(5)].map((_, i) => (
          <Star
            key={i}
            className={`w-4 h-4 ${
              i < fullStars
                ? 'fill-yellow-400 text-yellow-400'
                : i === fullStars && hasHalfStar
                ? 'fill-yellow-400/50 text-yellow-400'
                : 'text-gray-400/30'
            }`}
          />
        ))}
      </div>
      <span className="text-sm font-medium">{rating.toFixed(1)}</span>
      {count && count > 0 && (
        <span className="text-xs opacity-60">({count.toLocaleString()})</span>
      )}
    </div>
  );
};

// Enhanced Match Score Badge with numeric display
const MatchScoreBadge: React.FC<{ score: number; detailed?: boolean }> = ({ score, detailed = false }) => {
  const getScoreConfig = () => {
    if (score >= 85) return { 
      label: 'Perfect', 
      icon: Flame, 
      gradient: 'from-orange-400 to-red-500',
      bgColor: 'bg-orange-500/20',
      textColor: 'text-orange-400'
    };
    if (score >= 75) return { 
      label: 'Excellent', 
      icon: Zap, 
      gradient: 'from-yellow-400 to-orange-400',
      bgColor: 'bg-yellow-500/20',
      textColor: 'text-yellow-400'
    };
    if (score >= 65) return { 
      label: 'Great', 
      icon: TrendingUp, 
      gradient: 'from-green-400 to-emerald-500',
      bgColor: 'bg-green-500/20',
      textColor: 'text-green-400'
    };
    if (score >= 55) return { 
      label: 'Good', 
      icon: Shield, 
      gradient: 'from-blue-400 to-cyan-500',
      bgColor: 'bg-blue-500/20',
      textColor: 'text-blue-400'
    };
    return { 
      label: 'Fair', 
      icon: Info, 
      gradient: 'from-gray-400 to-gray-500',
      bgColor: 'bg-gray-500/20',
      textColor: 'text-gray-400'
    };
  };
  
  const config = getScoreConfig();
  const Icon = config.icon;
  
  return (
    <div className="flex flex-col items-end gap-1">
      {/* Numeric Score */}
      <div className={`text-2xl font-bold ${config.textColor}`}>
        {score}
        <span className="text-xs opacity-60">/100</span>
      </div>
      {/* Label Badge */}
      <div className={`flex items-center gap-1.5 px-3 py-1 rounded-full ${config.bgColor} backdrop-blur-sm`}>
        <Icon className="w-3.5 h-3.5" />
        <span className="text-xs font-semibold">{config.label}</span>
      </div>
      {detailed && (
        <div className={`mt-1 h-1 w-20 rounded-full bg-gray-700 overflow-hidden`}>
          <div 
            className={`h-full bg-gradient-to-r ${config.gradient} transition-all duration-500`}
            style={{ width: `${score}%` }}
          />
        </div>
      )}
    </div>
  );
};

// Loading state
const LoadingState: React.FC = () => (
  <div className="flex flex-col items-center justify-center py-20">
    <div className="relative">
      <div className="w-20 h-20 rounded-full border-4 border-white/20 border-t-white/60 animate-spin" />
      <Loader2 className="absolute inset-0 m-auto w-8 h-8 animate-pulse" />
    </div>
    <p className="mt-6 text-lg font-medium">Finding perfect activities...</p>
    <p className="mt-2 text-sm opacity-60">Analyzing weather compatibility</p>
  </div>
);

// Empty state
const EmptyState: React.FC<{ reason?: string }> = ({ reason }) => (
  <div className="flex flex-col items-center justify-center py-20">
    <div className="w-20 h-20 rounded-full bg-white/10 flex items-center justify-center mb-6">
      <MapPin className="w-10 h-10 opacity-50" />
    </div>
    <p className="text-lg font-medium mb-2">No activities available</p>
    <p className="text-sm opacity-60 max-w-md text-center">
      {reason || "We couldn't find any suitable activities nearby. Try adjusting your location or check back later."}
    </p>
  </div>
);

// Place Card Component
const PlaceCard: React.FC<{
  place: GooglePlace & { distance: number; suitabilityScore: number; isTopPick?: boolean };
  details?: PlaceDetail;
  isDark: boolean;
  index: number;
  category: string;
  onClick: () => void;
}> = ({ place, details, isDark, index, category, onClick }) => {
  const [isLiked, setIsLiked] = useState(false);
  const [isBookmarked, setIsBookmarked] = useState(false);
  const config = categoryConfig[category] || categoryConfig['Other Recommendations'];
  const Icon = config.icon;
  
  return (
    <div
      className={`group relative cursor-pointer transform transition-all duration-500 hover:scale-[1.02] hover:-translate-y-1`}
      style={{ animationDelay: `${index * 100}ms` }}
      onClick={onClick}
    >
      {/* Top Pick Badge */}
      {place.isTopPick && (
        <div className="absolute -top-3 left-4 z-20">
          <div className={`flex items-center gap-1.5 px-4 py-1.5 rounded-full bg-gradient-to-r ${config.gradient} text-white text-xs font-bold shadow-lg`}>
            <Sparkles className="w-3.5 h-3.5" />
            TOP PICK
          </div>
        </div>
      )}
      
      {/* Card */}
      <div className={`relative overflow-hidden rounded-2xl backdrop-blur-xl transition-all duration-500 ${
        isDark ? 'bg-white/10 hover:bg-white/15' : 'bg-white/40 hover:bg-white/50'
      } border border-white/20 shadow-xl`}>
        {/* Gradient Accent Line */}
        <div className={`absolute top-0 left-0 right-0 h-1 bg-gradient-to-r ${isDark ? config.darkGradient : config.gradient}`} />
        
        {/* Content */}
        <div className="p-6">
          {/* Header */}
          <div className="flex items-start justify-between mb-4">
            <div className="flex-1 pr-4">
              <div className="flex items-center gap-3 mb-2">
                <div className={`p-2 rounded-xl bg-gradient-to-br ${config.gradient} text-white shadow-lg`}>
                  <Icon className="w-5 h-5" />
                </div>
                <div className="flex-1">
                  <h3 className="text-lg font-bold line-clamp-1">
                    {place.displayName?.text || 'Unnamed Place'}
                  </h3>
                  <div className="flex items-center gap-3 mt-1">
                    <span className="px-2 py-0.5 text-xs font-medium bg-green-400/20 text-green-400 rounded-full">
                      Open Now
                    </span>
                    <PriceIndicator priceLevel={details?.priceLevel} />
                  </div>
                </div>
              </div>
              
              {/* Rating */}
              <div className="mt-3">
                <RatingDisplay rating={place.rating} count={place.userRatingCount} />
              </div>
              
              {/* Address */}
              <div className="flex items-start gap-2 mt-3 text-sm opacity-70">
                <MapPin className="w-4 h-4 mt-0.5 flex-shrink-0" />
                <span className="line-clamp-1">{place.formattedAddress}</span>
              </div>
            </div>
            
            {/* Score Display - Enhanced */}
            <MatchScoreBadge score={place.suitabilityScore} detailed={false} />
          </div>
          
          {/* Stats Row */}
          <div className="flex items-center justify-between pt-4 border-t border-white/10">
            <div className="flex items-center gap-4 text-sm">
              <div className="flex items-center gap-1.5">
                <Car className="w-4 h-4 opacity-60" />
                <span className="font-medium">{formatDistance(place.distance)}</span>
              </div>
              {details?.regularOpeningHours?.weekdayDescriptions && (
                <div className="flex items-center gap-1.5">
                  <Clock className="w-4 h-4 opacity-60" />
                  <span className="text-xs opacity-70">View hours</span>
                </div>
              )}
            </div>
            
            {/* Action Buttons */}
            <div className="flex items-center gap-2">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setIsLiked(!isLiked);
                }}
                className={`p-2 rounded-full transition-all ${
                  isLiked 
                    ? 'bg-red-500/20 text-red-400' 
                    : 'hover:bg-white/10'
                }`}
              >
                <Heart className={`w-4 h-4 ${isLiked ? 'fill-current' : ''}`} />
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setIsBookmarked(!isBookmarked);
                }}
                className={`p-2 rounded-full transition-all ${
                  isBookmarked 
                    ? 'bg-blue-500/20 text-blue-400' 
                    : 'hover:bg-white/10'
                }`}
              >
                <Bookmark className={`w-4 h-4 ${isBookmarked ? 'fill-current' : ''}`} />
              </button>
              <button className="p-2 rounded-full hover:bg-white/10 transition-all">
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
        
        {/* Hover Gradient Effect */}
        <div className={`absolute inset-0 bg-gradient-to-br ${config.gradient} opacity-0 group-hover:opacity-5 transition-opacity duration-500 pointer-events-none`} />
      </div>
    </div>
  );
};

// Main Component
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
  const [selectedPlaceId, setSelectedPlaceId] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

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

  // Fetch details for places
  const placeIdsToFetchDetails = useMemo(() => {
    if (!places || places.length === 0 || !userCoordinates) return [];
    return places.slice(0, 20).map(p => p.id).filter((id): id is string => !!id);
  }, [places, userCoordinates]);

  useEffect(() => {
    if (placeIdsToFetchDetails.length === 0) return;

    const idsToFetch = placeIdsToFetchDetails.filter(id => !detailedPlaces[id]);
    if (idsToFetch.length === 0) return;

    setDetailsLoading(true);
    
    const fetchDetails = async () => {
      const promises = idsToFetch.map(id =>
        fetch(`/api/placedetails?placeId=${id}`).then(res => res.json())
      );
      
      const results = await Promise.allSettled(promises);
      const newDetails: Record<string, PlaceDetail> = {};
      
      results.forEach((result, index) => {
        if (result.status === 'fulfilled' && result.value?.id) {
          newDetails[idsToFetch[index]] = result.value;
        }
      });
      
      setDetailedPlaces(prev => ({ ...prev, ...newDetails }));
      setDetailsLoading(false);
    };
    
    fetchDetails();
  }, [placeIdsToFetchDetails]);

  // Process and group places
  const { groupedPlaces, categories } = useMemo(() => {
    const groups: Record<string, (GooglePlace & { 
      distance: number; 
      suitabilityScore: number;
      isTopPick?: boolean;
    })[]> = {};
    
    if (!places || places.length === 0 || !userCoordinates || !weatherData) {
      return { groupedPlaces: groups, categories: [] };
    }

    // Score and categorize places
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
        
        return { ...enhancedPlace, distance, suitabilityScore };
      })
      .filter(place => place.distance >= 0 && detailedPlaces[place.id]?.currentOpeningHours?.openNow === true);

    // Group by category
    scoredPlaces.forEach(place => {
      const category = getCategoryForPlace(place);
      const categoryName = category ? category.valueOf() : 'Other Recommendations';
      
      if (!groups[categoryName]) {
        groups[categoryName] = [];
      }
      
      groups[categoryName].push(place);
    });

    // Sort within each category and mark top picks
    Object.keys(groups).forEach(category => {
      groups[category].sort((a, b) => {
        if (Math.abs(a.suitabilityScore - b.suitabilityScore) > 5) {
          return b.suitabilityScore - a.suitabilityScore;
        }
        return a.distance - b.distance;
      });
      
      // Mark first item as top pick if it has good score
      if (groups[category][0] && groups[category][0].suitabilityScore >= 70) {
        groups[category][0].isTopPick = true;
      }
    });

    const categoryList = Object.keys(groups);
    return { groupedPlaces: groups, categories: categoryList };
  }, [places, userCoordinates, detailedPlaces, weatherData]);

  // Filter by selected category
  const displayedGroups = selectedCategory 
    ? { [selectedCategory]: groupedPlaces[selectedCategory] }
    : groupedPlaces;

  // Render
  if (placesLoading || detailsLoading) {
    return <LoadingState />;
  }

  if (placesError) {
    return <EmptyState reason={placesError} />;
  }

  if (Object.keys(groupedPlaces).length === 0) {
    return <EmptyState />;
  }

  return (
    <>
      <div className="space-y-8">
        {/* Section Header */}
        <div className="text-center">
          <h2 className={`text-3xl md:text-4xl font-bold mb-3 ${isDarkTheme ? 'text-white' : 'text-gray-900'}`}>
            Your Personalized Activities
          </h2>
          <p className={`text-lg ${isDarkTheme ? 'text-white/70' : 'text-gray-600'}`}>
            Activities perfectly matched to current conditions
          </p>
        </div>

        {/* Category Filters */}
        {categories.length > 1 && (
          <div className="flex flex-wrap justify-center gap-3">
            <button
              onClick={() => setSelectedCategory(null)}
              className={`px-4 py-2 rounded-full font-medium transition-all ${
                !selectedCategory 
                  ? 'bg-white/20 backdrop-blur-md text-white shadow-lg' 
                  : 'bg-white/10 backdrop-blur-sm hover:bg-white/15'
              }`}
            >
              All Categories
            </button>
            {categories.map(cat => {
              const config = categoryConfig[cat] || categoryConfig['Other Recommendations'];
              const Icon = config.icon;
              const count = groupedPlaces[cat]?.length || 0;
              
              return (
                <button
                  key={cat}
                  onClick={() => setSelectedCategory(cat)}
                  className={`flex items-center gap-2 px-4 py-2 rounded-full font-medium transition-all ${
                    selectedCategory === cat 
                      ? 'bg-white/20 backdrop-blur-md text-white shadow-lg' 
                      : 'bg-white/10 backdrop-blur-sm hover:bg-white/15'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  <span>{cat}</span>
                  <span className="px-2 py-0.5 text-xs bg-white/20 rounded-full">
                    {count}
                  </span>
                </button>
              );
            })}
          </div>
        )}

        {/* Activity Cards */}
        <div className="space-y-12">
          {Object.entries(displayedGroups).map(([categoryName, categoryPlaces]) => {
            const config = categoryConfig[categoryName] || categoryConfig['Other Recommendations'];
            const CategoryIcon = config.icon;
            
            return (
              <div key={categoryName} className="space-y-6">
                {/* Category Header */}
                <div className="flex items-center gap-4">
                  <div className={`p-3 rounded-xl bg-gradient-to-br ${config.gradient} text-white shadow-xl`}>
                    <CategoryIcon className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className={`text-2xl font-bold ${isDarkTheme ? 'text-white' : 'text-gray-900'}`}>
                      {categoryName}
                    </h3>
                    <p className={`text-sm ${isDarkTheme ? 'text-white/60' : 'text-gray-500'}`}>
                      {categoryPlaces.length} perfect {categoryPlaces.length === 1 ? 'match' : 'matches'} nearby
                    </p>
                  </div>
                </div>

                {/* Cards Grid */}
                <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                  {categoryPlaces.slice(0, 6).map((place, index) => (
                    <PlaceCard
                      key={place.id}
                      place={place}
                      details={detailedPlaces[place.id]}
                      isDark={isDarkTheme || false}
                      index={index}
                      category={categoryName}
                      onClick={() => handlePlaceClick(place.id)}
                    />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Activity Detail Modal */}
      {selectedPlaceId && (
        <ActivityDetailModal
          isOpen={isModalOpen}
          onClose={handleCloseModal}
          placeId={selectedPlaceId}
          initialData={places.find(p => p.id === selectedPlaceId)}
          userCoordinates={userCoordinates}
          weatherData={weatherData}
        />
      )}
    </>
  );
};

export default ActivityList;