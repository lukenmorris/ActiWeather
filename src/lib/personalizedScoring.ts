// src/lib/personalizedScoring.ts
import type { GooglePlace, WeatherData } from '@/types';
import type { UserPreferences } from '@/context/UserPreferencesContext';
import { calculateWeatherSuitability, getScoreBreakdown } from './geoUtils';

/**
 * Enhanced scoring system that incorporates user preferences
 */
export interface PersonalizedScoreBreakdown {
  baseScore: number;
  weatherComponent: number;
  distanceComponent: number;
  ratingsComponent: number;
  priceComponent: number;
  noveltyComponent: number;
  favoriteBonus: number;
  moodBonus: number;
  personalizedTotal: number;
  confidence: 'high' | 'medium' | 'low';
  explanation: string[];
}

/**
 * Calculate personalized score based on user preferences
 */
export function calculatePersonalizedScore(
  place: GooglePlace & { distance?: number },
  weatherData: WeatherData,
  preferences: UserPreferences
): PersonalizedScoreBreakdown {
  // Get base score components
  const baseBreakdown = getScoreBreakdown(place, weatherData, place.distance);
  
  // Extract user weights (normalize to sum to 100)
  const weights = preferences.scoringWeights;
  const totalWeight = Object.values(weights).reduce((sum, w) => sum + w, 0) || 100;
  
  const normalizedWeights = {
    weather: (weights.weatherImportance / totalWeight),
    distance: (weights.distanceImportance / totalWeight),
    ratings: (weights.ratingsImportance / totalWeight),
    price: (weights.priceImportance / totalWeight),
    novelty: (weights.noveltyImportance / totalWeight),
  };
  
  // Calculate weighted components
  const weatherComponent = (baseBreakdown.weatherMatch / 30) * normalizedWeights.weather * 100;
  const distanceComponent = (baseBreakdown.distanceScore / 20) * normalizedWeights.distance * 100;
  const ratingsComponent = (baseBreakdown.popularityScore / 15) * normalizedWeights.ratings * 100;
  const noveltyComponent = (baseBreakdown.uniquenessBonus / 10) * normalizedWeights.novelty * 100;
  
  // Price component (inversely related - lower price = higher score)
  let priceComponent = 0;
  const placeWithPriceLevel = place as any; // Type assertion for priceLevel
  if (placeWithPriceLevel.priceLevel) {
    const priceLevel = getPriceLevelNumber(placeWithPriceLevel.priceLevel);
    const maxAllowedPrice = preferences.filters.maxPriceLevel;
    
    if (priceLevel <= maxAllowedPrice) {
      // Score decreases with price
      priceComponent = ((maxAllowedPrice - priceLevel) / maxAllowedPrice) * normalizedWeights.price * 100;
    } else {
      // Penalty for exceeding budget
      priceComponent = -20;
    }
  } else {
    // Unknown price - neutral score
    priceComponent = normalizedWeights.price * 50;
  }
  
  // Calculate bonuses
  let favoriteBonus = 0;
  let moodBonus = 0;
  const explanation: string[] = [];
  
  // Favorite type bonus
  if (place.types && preferences.activityTypes.favorites.length > 0) {
    const isFavorite = place.types.some(type => 
      preferences.activityTypes.favorites.includes(type)
    );
    if (isFavorite) {
      favoriteBonus = 15;
      explanation.push('Favorite activity type (+15)');
    }
  }
  
  // Mood match bonus
  if (preferences.activityTypes.activeMood && place.types) {
    const moodTypes = preferences.activityTypes.moodPresets[preferences.activityTypes.activeMood] || [];
    const moodMatch = place.types.some(type => moodTypes.includes(type));
    if (moodMatch) {
      moodBonus = 10;
      explanation.push(`Matches ${preferences.activityTypes.activeMood} mood (+10)`);
    }
  }
  
  // Calculate total personalized score
  let personalizedTotal = 
    weatherComponent +
    distanceComponent +
    ratingsComponent +
    priceComponent +
    noveltyComponent +
    favoriteBonus +
    moodBonus;
  
  // Apply penalties
  if (preferences.filters.openNowOnly && place.currentOpeningHours?.openNow === false) {
    personalizedTotal -= 30;
    explanation.push('Currently closed (-30)');
  }
  
  if (preferences.filters.familyFriendly && place.types) {
    const notFamilyFriendly = place.types.some(type => 
      ['bar', 'night_club', 'casino'].includes(type)
    );
    if (notFamilyFriendly) {
      personalizedTotal -= 20;
      explanation.push('Not family-friendly (-20)');
    }
  }
  
  // Ensure score is within bounds
  personalizedTotal = Math.max(0, Math.min(100, Math.round(personalizedTotal)));
  
  // Determine confidence
  let confidence: 'high' | 'medium' | 'low' = 'medium';
  if (personalizedTotal >= 75) confidence = 'high';
  else if (personalizedTotal < 50) confidence = 'low';
  
  // Build explanation
  if (normalizedWeights.weather > 0.3) {
    explanation.push('Weather heavily weighted');
  }
  if (normalizedWeights.distance > 0.3) {
    explanation.push('Distance prioritized');
  }
  if (normalizedWeights.ratings > 0.3) {
    explanation.push('Ratings emphasized');
  }
  
  return {
    baseScore: baseBreakdown.totalScore,
    weatherComponent: Math.round(weatherComponent),
    distanceComponent: Math.round(distanceComponent),
    ratingsComponent: Math.round(ratingsComponent),
    priceComponent: Math.round(priceComponent),
    noveltyComponent: Math.round(noveltyComponent),
    favoriteBonus,
    moodBonus,
    personalizedTotal,
    confidence,
    explanation,
  };
}

/**
 * Convert price level string to number
 */
function getPriceLevelNumber(priceLevel: string): number {
  switch (priceLevel) {
    case 'PRICE_LEVEL_FREE': return 0;
    case 'PRICE_LEVEL_INEXPENSIVE': return 1;
    case 'PRICE_LEVEL_MODERATE': return 2;
    case 'PRICE_LEVEL_EXPENSIVE': return 3;
    case 'PRICE_LEVEL_VERY_EXPENSIVE': return 4;
    default: return 2; // Default to moderate
  }
}

/**
 * Filter places based on user preferences
 */
export function filterPlacesByPreferences(
  places: GooglePlace[],
  preferences: UserPreferences
): GooglePlace[] {
  return places.filter(place => {
    // Check blacklist
    if (place.types && preferences.activityTypes.blacklist.length > 0) {
      const isBlacklisted = place.types.some(type => 
        preferences.activityTypes.blacklist.includes(type)
      );
      if (isBlacklisted) return false;
    }
    
    // Check minimum rating
    if (preferences.filters.minRating > 0) {
      if (!place.rating || place.rating < preferences.filters.minRating) {
        return false;
      }
    }
    
    // Check price level
    const placeWithPriceLevel = place as any;
    if (placeWithPriceLevel.priceLevel) {
      const priceLevel = getPriceLevelNumber(placeWithPriceLevel.priceLevel);
      if (priceLevel > preferences.filters.maxPriceLevel) {
        return false;
      }
    }
    
    // Check open now
    if (preferences.filters.openNowOnly) {
      if (place.currentOpeningHours?.openNow === false) {
        return false;
      }
    }
    
    // Check accessibility
    if (preferences.filters.accessibilityRequired) {
      // This would need additional data from place details
      // For now, we'll assume all places pass unless we have specific data
    }
    
    // Check family friendly
    if (preferences.filters.familyFriendly && place.types) {
      const notFamilyFriendly = place.types.some(type => 
        ['bar', 'night_club', 'casino', 'liquor_store'].includes(type)
      );
      if (notFamilyFriendly) return false;
    }
    
    return true;
  });
}

/**
 * Sort places with favorites and mood preferences
 */
export function sortPlacesByPreference(
  places: (GooglePlace & { personalizedScore?: number })[],
  preferences: UserPreferences
): (GooglePlace & { personalizedScore?: number })[] {
  return places.sort((a, b) => {
    // First, prioritize favorites
    const aIsFavorite = a.types?.some(type => 
      preferences.activityTypes.favorites.includes(type)
    ) || false;
    const bIsFavorite = b.types?.some(type => 
      preferences.activityTypes.favorites.includes(type)
    ) || false;
    
    if (aIsFavorite && !bIsFavorite) return -1;
    if (!aIsFavorite && bIsFavorite) return 1;
    
    // Then, prioritize mood matches
    if (preferences.activityTypes.activeMood) {
      const moodTypes = preferences.activityTypes.moodPresets[preferences.activityTypes.activeMood] || [];
      const aMoodMatch = a.types?.some(type => moodTypes.includes(type)) || false;
      const bMoodMatch = b.types?.some(type => moodTypes.includes(type)) || false;
      
      if (aMoodMatch && !bMoodMatch) return -1;
      if (!aMoodMatch && bMoodMatch) return 1;
    }
    
    // Finally, sort by personalized score
    const aScore = a.personalizedScore || 0;
    const bScore = b.personalizedScore || 0;
    return bScore - aScore;
  });
}

/**
 * Get suggested place types based on user preferences and mood
 */
export function getSuggestedPlaceTypes(
  preferences: UserPreferences,
  weatherSuggestions: string[] = []
): string[] {
  const suggested = new Set<string>();
  
  // Add weather-based suggestions (filtered by blacklist)
  weatherSuggestions.forEach(type => {
    if (!preferences.activityTypes.blacklist.includes(type)) {
      suggested.add(type);
    }
  });
  
  // Add favorites
  preferences.activityTypes.favorites.forEach(type => {
    suggested.add(type);
  });
  
  // Add mood-based types
  if (preferences.activityTypes.activeMood) {
    const moodTypes = preferences.activityTypes.moodPresets[preferences.activityTypes.activeMood] || [];
    moodTypes.forEach(type => {
      if (!preferences.activityTypes.blacklist.includes(type)) {
        suggested.add(type);
      }
    });
  }
  
  return Array.from(suggested);
}

/**
 * Get preference-based search radius in meters
 */
export function getSearchRadius(preferences: UserPreferences): number {
  return preferences.filters.maxRadius * 1000; // Convert km to meters
}

/**
 * Format distance based on user preference
 */
export function formatDistanceWithPreference(
  distanceKm: number,
  useMetric: boolean
): string {
  if (useMetric) {
    if (distanceKm < 1) {
      return `${Math.round(distanceKm * 1000)}m`;
    }
    return `${distanceKm.toFixed(1)}km`;
  } else {
    const miles = distanceKm * 0.621371;
    if (miles < 0.1) {
      const yards = miles * 1760;
      return `${Math.round(yards)}yd`;
    }
    return `${miles.toFixed(1)}mi`;
  }
}

/**
 * Get preference summary for display
 */
export function getPreferenceSummary(preferences: UserPreferences): string[] {
  const summary: string[] = [];
  
  // Active mood
  if (preferences.activityTypes.activeMood) {
    summary.push(`Mood: ${preferences.activityTypes.activeMood}`);
  }
  
  // Favorites count
  if (preferences.activityTypes.favorites.length > 0) {
    summary.push(`${preferences.activityTypes.favorites.length} favorite types`);
  }
  
  // Blacklist count
  if (preferences.activityTypes.blacklist.length > 0) {
    summary.push(`${preferences.activityTypes.blacklist.length} hidden types`);
  }
  
  // Budget
  if (preferences.filters.maxPriceLevel < 4) {
    const priceSymbols = ['Free', '$', '$$', '$$$', '$$$$'];
    summary.push(`Budget: ${priceSymbols[preferences.filters.maxPriceLevel]}`);
  }
  
  // Distance
  if (preferences.filters.maxRadius !== 5) {
    summary.push(`${preferences.filters.maxRadius}km radius`);
  }
  
  // Special filters
  if (preferences.filters.minRating > 0) {
    summary.push(`${preferences.filters.minRating}+ stars`);
  }
  if (preferences.filters.familyFriendly) {
    summary.push('Family-friendly');
  }
  if (preferences.filters.accessibilityRequired) {
    summary.push('Accessible');
  }
  
  return summary;
}

/**
 * Validate and migrate preferences from older versions
 */
export function migratePreferences(stored: any): UserPreferences {
  const migrated = { ...stored };
  
  // Ensure all required fields exist
  if (!migrated.scoringWeights) {
    migrated.scoringWeights = {
      weatherImportance: 30,
      distanceImportance: 20,
      ratingsImportance: 25,
      priceImportance: 15,
      noveltyImportance: 10,
    };
  }
  
  if (!migrated.activityTypes) {
    migrated.activityTypes = {
      favorites: [],
      blacklist: [],
      moodPresets: {},
      activeMood: null,
    };
  }
  
  if (!migrated.filters) {
    migrated.filters = {
      maxRadius: 5,
      maxPriceLevel: 4,
      minRating: 0,
      openNowOnly: true,
      accessibilityRequired: false,
      familyFriendly: false,
    };
  }
  
  if (!migrated.displayPreferences) {
    migrated.displayPreferences = {
      showScoreBreakdown: false,
      compactView: false,
      autoRefresh: false,
      metricUnits: false,
    };
  }
  
  return migrated as UserPreferences;
}