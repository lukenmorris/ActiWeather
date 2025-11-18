// src/lib/scoring/scoringIntegration.ts
/**
 * Integration layer for the industry-standard scoring system
 * Bridges the new scoring system with existing ActiWeather application
 */

import type { GooglePlace, WeatherData } from '@/types';
import type { UserPreferences } from '@/context/UserPreferencesContext';
import {
  calculateIndustryStandardScore,
  rankPlaces,
  getScoreInterpretation,
  type ScoringDimensions,
  type ScoringWeights,
  DEFAULT_WEIGHTS
} from './industryStandardScoring';

/**
 * Convert user preferences to industry-standard scoring weights
 */
export function preferencesToWeights(preferences: UserPreferences): ScoringWeights {
  const userWeights = preferences.scoringWeights;
  const total = Object.values(userWeights).reduce((sum, w) => sum + w, 0) || 100;
  
  // Map user preferences to industry-standard dimensions
  return {
    contextualRelevance: (userWeights.weatherImportance / total) * 0.35,
    spatialProximity: (userWeights.distanceImportance / total) * 0.25,
    qualitySignals: (userWeights.ratingsImportance / total) * 0.20,
    personalRelevance: 0.10, // Fixed weight for favorites/mood matching
    temporalAvailability: 0.05,
    economicFit: (userWeights.priceImportance / total) * 0.03,
    socialProof: 0.01,
    uniquenessScore: (userWeights.noveltyImportance / total) * 0.01
  };
}

/**
 * Enhanced place scoring with backwards compatibility
 */
export function scorePlace(
  place: GooglePlace & { distance?: number },
  weatherData: WeatherData,
  preferences: UserPreferences
): number {
  const weights = preferencesToWeights(preferences);
  const dimensions = calculateIndustryStandardScore(
    place,
    weatherData,
    preferences,
    weights
  );
  
  // Return normalized score (0-100) for backwards compatibility
  return Math.round(dimensions.normalizedScore);
}

/**
 * Get detailed scoring breakdown for UI display
 */
export interface ScoreBreakdownUI {
  totalScore: number;
  interpretation: {
    label: string;
    color: string;
    description: string;
  };
  percentileRank?: number;
  dimensions: {
    name: string;
    value: number;
    weight: number;
    contribution: number;
    icon: string;
    description: string;
  }[];
  confidence: {
    level: number;
    label: string;
  };
}

export function getScoreBreakdownForUI(
  place: GooglePlace & { distance?: number },
  weatherData: WeatherData,
  preferences: UserPreferences
): ScoreBreakdownUI {
  const weights = preferencesToWeights(preferences);
  const dimensions = calculateIndustryStandardScore(
    place,
    weatherData,
    preferences,
    weights
  );
  
  const interpretation = getScoreInterpretation(dimensions.normalizedScore);
  
  return {
    totalScore: Math.round(dimensions.normalizedScore),
    interpretation,
    percentileRank: dimensions.percentileRank,
    dimensions: [
      {
        name: 'Weather & Context',
        value: dimensions.contextualRelevance,
        weight: weights.contextualRelevance,
        contribution: dimensions.contextualRelevance * weights.contextualRelevance * 100,
        icon: 'weather',
        description: 'How well this matches current conditions'
      },
      {
        name: 'Distance',
        value: dimensions.spatialProximity,
        weight: weights.spatialProximity,
        contribution: dimensions.spatialProximity * weights.spatialProximity * 100,
        icon: 'location',
        description: 'Proximity and accessibility'
      },
      {
        name: 'Quality',
        value: dimensions.qualitySignals,
        weight: weights.qualitySignals,
        contribution: dimensions.qualitySignals * weights.qualitySignals * 100,
        icon: 'star',
        description: 'Ratings and reviews'
      },
      {
        name: 'Personal Match',
        value: dimensions.personalRelevance,
        weight: weights.personalRelevance,
        contribution: dimensions.personalRelevance * weights.personalRelevance * 100,
        icon: 'heart',
        description: 'Alignment with your preferences'
      },
      {
        name: 'Availability',
        value: dimensions.temporalAvailability,
        weight: weights.temporalAvailability,
        contribution: dimensions.temporalAvailability * weights.temporalAvailability * 100,
        icon: 'clock',
        description: 'Operating hours and timing'
      },
      {
        name: 'Price Fit',
        value: dimensions.economicFit,
        weight: weights.economicFit,
        contribution: dimensions.economicFit * weights.economicFit * 100,
        icon: 'dollar',
        description: 'Budget alignment'
      }
    ],
    confidence: {
      level: dimensions.confidenceLevel,
      label: getConfidenceLabel(dimensions.confidenceLevel)
    }
  };
}

function getConfidenceLabel(level: number): string {
  if (level >= 0.8) return 'High confidence';
  if (level >= 0.6) return 'Moderate confidence';
  if (level >= 0.4) return 'Low confidence';
  return 'Limited data';
}

/**
 * Batch score and rank places efficiently
 */
export interface RankedPlace extends GooglePlace {
  distance?: number;
  score: number;
  rank: number;
  dimensions: ScoringDimensions;
  interpretation: ReturnType<typeof getScoreInterpretation>;
}

export function scoreAndRankPlaces(
  places: (GooglePlace & { distance?: number })[],
  weatherData: WeatherData,
  preferences: UserPreferences
): RankedPlace[] {
  const weights = preferencesToWeights(preferences);
  
  // Use the industry-standard ranking function
  const rankedPlaces = rankPlaces(places, weatherData, preferences, weights);
  
  // Transform to include interpretation
  return rankedPlaces.map(place => ({
    ...place,
    score: Math.round(place.scoringDimensions.normalizedScore),
    dimensions: place.scoringDimensions,
    interpretation: getScoreInterpretation(place.scoringDimensions.normalizedScore)
  }));
}

/**
 * Filter places based on minimum score threshold
 */
export function filterByMinScore(
  places: RankedPlace[],
  minScore: number = 40
): RankedPlace[] {
  return places.filter(place => place.score >= minScore);
}

/**
 * Get top N places with diversity
 */
export function getTopPlacesWithDiversity(
  places: RankedPlace[],
  count: number = 10,
  ensureDiversity: boolean = true
): RankedPlace[] {
  if (!ensureDiversity) {
    return places.slice(0, count);
  }
  
  const selected: RankedPlace[] = [];
  const usedTypes = new Set<string>();
  
  for (const place of places) {
    if (selected.length >= count) break;
    
    // Check if we already have this type
    const placeTypes = place.types || [];
    const primaryType = placeTypes[0];
    
    if (!primaryType || !usedTypes.has(primaryType) || selected.length < count / 2) {
      selected.push(place);
      if (primaryType) usedTypes.add(primaryType);
    }
  }
  
  // Fill remaining slots if needed
  if (selected.length < count) {
    for (const place of places) {
      if (!selected.includes(place)) {
        selected.push(place);
        if (selected.length >= count) break;
      }
    }
  }
  
  return selected;
}

/**
 * Export scoring metadata for analytics
 */
export interface ScoringAnalytics {
  timestamp: number;
  weatherConditions: {
    temp: number;
    condition: string;
    precipitation: boolean;
  };
  userPreferences: {
    hasActiveMood: boolean;
    favoriteTypesCount: number;
    blacklistCount: number;
    maxRadius: number;
    priceLevel: number;
  };
  results: {
    totalPlaces: number;
    averageScore: number;
    scoreDistribution: {
      perfect: number;  // 85+
      excellent: number; // 75-84
      veryGood: number; // 65-74
      good: number;     // 55-64
      fair: number;     // 45-54
      poor: number;     // <45
    };
    topCategories: Array<{
      category: string;
      count: number;
      avgScore: number;
    }>;
  };
}

export function generateScoringAnalytics(
  places: RankedPlace[],
  weatherData: WeatherData,
  preferences: UserPreferences
): ScoringAnalytics {
  const scores = places.map(p => p.score);
  const avgScore = scores.reduce((sum, s) => sum + s, 0) / scores.length || 0;
  
  // Score distribution
  const distribution = {
    perfect: scores.filter(s => s >= 85).length,
    excellent: scores.filter(s => s >= 75 && s < 85).length,
    veryGood: scores.filter(s => s >= 65 && s < 75).length,
    good: scores.filter(s => s >= 55 && s < 65).length,
    fair: scores.filter(s => s >= 45 && s < 55).length,
    poor: scores.filter(s => s < 45).length
  };
  
  // Category analysis
  const categoryMap = new Map<string, { count: number; totalScore: number }>();
  places.forEach(place => {
    const primaryType = place.types?.[0] || 'unknown';
    const current = categoryMap.get(primaryType) || { count: 0, totalScore: 0 };
    categoryMap.set(primaryType, {
      count: current.count + 1,
      totalScore: current.totalScore + place.score
    });
  });
  
  const topCategories = Array.from(categoryMap.entries())
    .map(([category, data]) => ({
      category,
      count: data.count,
      avgScore: data.totalScore / data.count
    }))
    .sort((a, b) => b.avgScore - a.avgScore)
    .slice(0, 5);
  
  return {
    timestamp: Date.now(),
    weatherConditions: {
      temp: weatherData.main.feels_like,
      condition: weatherData.weather[0]?.main || 'Unknown',
      precipitation: [2, 3, 5, 6].includes(Math.floor(weatherData.weather[0]?.id / 100))
    },
    userPreferences: {
      hasActiveMood: !!preferences.activityTypes.activeMood,
      favoriteTypesCount: preferences.activityTypes.favorites.length,
      blacklistCount: preferences.activityTypes.blacklist.length,
      maxRadius: preferences.filters.maxRadius,
      priceLevel: preferences.filters.maxPriceLevel
    },
    results: {
      totalPlaces: places.length,
      averageScore: Math.round(avgScore),
      scoreDistribution: distribution,
      topCategories
    }
  };
}