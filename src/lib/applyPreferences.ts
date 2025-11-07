// src/lib/applyPreferences.ts
/**
 * Core preference application logic
 * This is where preferences ACTUALLY affect the results
 */

import type { GooglePlace, WeatherData } from '@/types';
import type { UserPreferences } from '@/context/UserPreferencesContext';
import { calculateWeatherSuitability } from './geoUtils';

export interface FilterResult {
  passed: boolean;
  reason?: string;
}

export interface FilterStats {
  total: number;
  passed: number;
  filtered: number;
  reasons: Record<string, number>;
}

/**
 * Apply all preference filters to a place
 * Returns true if place passes all filters
 */
export function applyFilters(
  place: GooglePlace,
  preferences: UserPreferences,
  distance?: number
): FilterResult {
  // 1. BLACKLIST CHECK (hard filter)
  if (preferences.activityTypes.blacklist.length > 0 && place.types) {
    const isBlacklisted = place.types.some(type =>
      preferences.activityTypes.blacklist.includes(type)
    );
    if (isBlacklisted) {
      return { passed: false, reason: 'blacklisted' };
    }
  }

  // 2. MINIMUM RATING FILTER
  if (preferences.filters.minRating > 0) {
    if (!place.rating || place.rating < preferences.filters.minRating) {
      return { passed: false, reason: 'rating_too_low' };
    }
  }

  // 3. PRICE LEVEL FILTER
  const placeWithPrice = place as any;
  if (placeWithPrice.priceLevel) {
    const priceLevel = getPriceLevelNumber(placeWithPrice.priceLevel);
    if (priceLevel > preferences.filters.maxPriceLevel) {
      return { passed: false, reason: 'too_expensive' };
    }
  }

  // 4. DISTANCE FILTER
  if (distance !== undefined) {
    const maxDistanceKm = preferences.filters.maxRadius;
    if (distance > maxDistanceKm) {
      return { passed: false, reason: 'too_far' };
    }
  }

  // 5. OPEN NOW FILTER
  if (preferences.filters.openNowOnly) {
    // Always-accessible outdoor places
    const alwaysAccessibleTypes = new Set([
      'park', 'playground', 'hiking_area', 'beach', 'viewpoint',
      'tourist_attraction', 'natural_feature', 'campground', 'dog_park',
      'garden', 'plaza', 'picnic_ground', 'marina', 'trail', 'monument',
      'landmark', 'stadium', 'sports_complex', 'golf_course'
    ]);

    const isAlwaysAccessible = place.types?.some(type =>
      alwaysAccessibleTypes.has(type)
    );

    if (!isAlwaysAccessible) {
      const placeDetails = place as any;
      const isOpen = placeDetails.currentOpeningHours?.openNow ||
                     placeDetails.regularOpeningHours?.openNow;

      if (isOpen === false) {
        return { passed: false, reason: 'closed' };
      }
    }
  }

  // 6. ACCESSIBILITY FILTER
  if (preferences.filters.accessibilityRequired) {
    const placeDetails = place as any;
    const hasAccessibility =
      placeDetails.accessibilityOptions?.wheelchairAccessibleEntrance === true;

    if (!hasAccessibility) {
      return { passed: false, reason: 'not_accessible' };
    }
  }

  // 7. FAMILY FRIENDLY FILTER
  if (preferences.filters.familyFriendly && place.types) {
    const notFamilyFriendly = place.types.some(type =>
      ['bar', 'night_club', 'casino', 'liquor_store'].includes(type)
    );

    if (notFamilyFriendly) {
      return { passed: false, reason: 'not_family_friendly' };
    }
  }

  return { passed: true };
}

/**
 * Filter a list of places and return stats
 */
export function filterPlaces(
  places: GooglePlace[],
  preferences: UserPreferences,
  distances?: Map<string, number>
): { filtered: GooglePlace[]; stats: FilterStats } {
  const stats: FilterStats = {
    total: places.length,
    passed: 0,
    filtered: 0,
    reasons: {}
  };

  const filtered = places.filter(place => {
    const distance = distances?.get(place.id);
    const result = applyFilters(place, preferences, distance);

    if (result.passed) {
      stats.passed++;
      return true;
    } else {
      stats.filtered++;
      if (result.reason) {
        stats.reasons[result.reason] = (stats.reasons[result.reason] || 0) + 1;
      }
      return false;
    }
  });

  return { filtered, stats };
}

/**
 * Apply preference-weighted scoring
 */
export function applyPreferenceScoring(
  place: GooglePlace & { distance?: number },
  weatherData: WeatherData,
  preferences: UserPreferences
): number {
  // Get base weather suitability score (0-100)
  let score = calculateWeatherSuitability(place, weatherData);

  // Apply preference weights by adjusting component importance
  const weights = preferences.scoringWeights;
  const totalWeight = Object.values(weights).reduce((sum, w) => sum + w, 0) || 100;

  // Normalize weights
  const normalized = {
    weather: weights.weatherImportance / totalWeight,
    distance: weights.distanceImportance / totalWeight,
    ratings: weights.ratingsImportance / totalWeight,
    price: weights.priceImportance / totalWeight,
    novelty: weights.noveltyImportance / totalWeight,
  };

  // Weight adjustments (multiply score by weight emphasis)
  // If user cares more about weather (e.g., 50% instead of 30%), boost weather-appropriate places
  const weatherWeight = normalized.weather / 0.3; // 0.3 is default weather weight
  score = score * (0.7 + (weatherWeight * 0.3)); // Adjust between 0.7x and 1.3x based on weather preference

  // Distance bonus/penalty
  if (place.distance !== undefined) {
    const distanceWeight = normalized.distance / 0.2; // 0.2 is default
    const distanceKm = place.distance;

    if (distanceKm <= 1) {
      score += 10 * distanceWeight; // Close places get bonus if distance matters
    } else if (distanceKm > 5) {
      score -= 5 * distanceWeight; // Far places get penalty if distance matters
    }
  }

  // Rating bonus
  if (place.rating) {
    const ratingWeight = normalized.ratings / 0.25; // 0.25 is default
    const ratingBonus = (place.rating - 3.5) * 4 * ratingWeight; // 4.5 rating = +4 points
    score += ratingBonus;
  }

  // Price preference
  const placeWithPrice = place as any;
  if (placeWithPrice.priceLevel) {
    const priceWeight = normalized.price / 0.15; // 0.15 is default
    const priceLevel = getPriceLevelNumber(placeWithPrice.priceLevel);
    const maxPrice = preferences.filters.maxPriceLevel;

    // Reward budget-friendly choices if price matters
    if (priceLevel <= maxPrice - 1) {
      score += (maxPrice - priceLevel) * 3 * priceWeight;
    }
  }

  // FAVORITE TYPE BOOST (BIG BONUS!)
  if (place.types && preferences.activityTypes.favorites.length > 0) {
    const isFavorite = place.types.some(type =>
      preferences.activityTypes.favorites.includes(type)
    );
    if (isFavorite) {
      score += 20; // Significant boost for favorites
    }
  }

  // MOOD MATCH BOOST
  if (preferences.activityTypes.activeMood && place.types) {
    const moodTypes = preferences.activityTypes.moodPresets[preferences.activityTypes.activeMood] || [];
    const moodMatch = place.types.some(type => moodTypes.includes(type));
    if (moodMatch) {
      score += 15; // Good boost for mood matches
    }
  }

  // Ensure score stays in bounds
  return Math.max(0, Math.min(100, Math.round(score)));
}

/**
 * Get suggested place types based on preferences and weather
 */
export function getSuggestedPlaceTypes(
  preferences: UserPreferences,
  weatherSuggestions: string[] = []
): string[] {
  const suggested = new Set<string>();

  // 1. Add favorites (highest priority)
  preferences.activityTypes.favorites.forEach(type => {
    suggested.add(type);
  });

  // 2. Add mood types if mood is active
  if (preferences.activityTypes.activeMood) {
    const moodTypes = preferences.activityTypes.moodPresets[preferences.activityTypes.activeMood] || [];
    moodTypes.forEach(type => {
      if (!preferences.activityTypes.blacklist.includes(type)) {
        suggested.add(type);
      }
    });
  }

  // 3. Add weather suggestions (filtered by blacklist)
  weatherSuggestions.forEach(type => {
    if (!preferences.activityTypes.blacklist.includes(type)) {
      suggested.add(type);
    }
  });

  // 4. If we have too few types, add some defaults
  if (suggested.size < 3) {
    const defaults = ['restaurant', 'cafe', 'park', 'museum', 'shopping_mall'];
    defaults.forEach(type => {
      if (!preferences.activityTypes.blacklist.includes(type)) {
        suggested.add(type);
      }
    });
  }

  return Array.from(suggested);
}

/**
 * Helper: Convert price level string to number
 */
function getPriceLevelNumber(priceLevel: string): number {
  switch (priceLevel) {
    case 'PRICE_LEVEL_FREE': return 0;
    case 'PRICE_LEVEL_INEXPENSIVE': return 1;
    case 'PRICE_LEVEL_MODERATE': return 2;
    case 'PRICE_LEVEL_EXPENSIVE': return 3;
    case 'PRICE_LEVEL_VERY_EXPENSIVE': return 4;
    default: return 2;
  }
}

/**
 * Get human-readable filter summary
 */
export function getFilterSummary(stats: FilterStats): string[] {
  const summary: string[] = [];

  if (stats.filtered === 0) {
    return ['All places match your preferences'];
  }

  summary.push(`${stats.filtered} places hidden by filters`);

  const reasons = stats.reasons;
  if (reasons.blacklisted) summary.push(`${reasons.blacklisted} blacklisted`);
  if (reasons.rating_too_low) summary.push(`${reasons.rating_too_low} below rating minimum`);
  if (reasons.too_expensive) summary.push(`${reasons.too_expensive} exceed budget`);
  if (reasons.too_far) summary.push(`${reasons.too_far} too far away`);
  if (reasons.closed) summary.push(`${reasons.closed} currently closed`);
  if (reasons.not_accessible) summary.push(`${reasons.not_accessible} not wheelchair accessible`);
  if (reasons.not_family_friendly) summary.push(`${reasons.not_family_friendly} not family-friendly`);

  return summary;
}