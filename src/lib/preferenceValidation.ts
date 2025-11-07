// src/lib/preferenceValidation.ts
/**
 * Preference validation and schema
 */

import type { UserPreferences } from '@/context/UserPreferencesContext';

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

/**
 * Validate user preferences object
 */
export function validatePreferences(preferences: any): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Check structure
  if (!preferences || typeof preferences !== 'object') {
    errors.push('Preferences must be an object');
    return { valid: false, errors, warnings };
  }

  // Validate scoringWeights
  if (preferences.scoringWeights) {
    const weights = preferences.scoringWeights;
    
    ['weatherImportance', 'distanceImportance', 'ratingsImportance', 'priceImportance', 'noveltyImportance'].forEach(key => {
      const value = weights[key];
      if (typeof value !== 'number' || value < 0 || value > 100) {
        errors.push(`${key} must be between 0 and 100`);
      }
    });

    const total = Object.values(weights).reduce((sum: number, w: any) => sum + (w || 0), 0);
    if (total === 0) {
      warnings.push('All scoring weights are 0 - results will not be ranked');
    }
  } else {
    errors.push('Missing scoringWeights');
  }

  // Validate activityTypes
  if (preferences.activityTypes) {
    const { favorites, blacklist, moodPresets, activeMood } = preferences.activityTypes;

    if (!Array.isArray(favorites)) {
      errors.push('favorites must be an array');
    }
    if (!Array.isArray(blacklist)) {
      errors.push('blacklist must be an array');
    }

    // Check for overlap
    if (Array.isArray(favorites) && Array.isArray(blacklist)) {
      const overlap = favorites.filter(type => blacklist.includes(type));
      if (overlap.length > 0) {
        warnings.push(`${overlap.length} types are both favorited and blacklisted`);
      }
    }

    if (activeMood && typeof activeMood !== 'string') {
      errors.push('activeMood must be a string or null');
    }

    if (moodPresets && typeof moodPresets !== 'object') {
      errors.push('moodPresets must be an object');
    }
  } else {
    errors.push('Missing activityTypes');
  }

  // Validate filters
  if (preferences.filters) {
    const filters = preferences.filters;

    if (typeof filters.maxRadius !== 'number' || filters.maxRadius < 1 || filters.maxRadius > 50) {
      errors.push('maxRadius must be between 1 and 50 km');
    }

    if (typeof filters.maxPriceLevel !== 'number' || filters.maxPriceLevel < 0 || filters.maxPriceLevel > 4) {
      errors.push('maxPriceLevel must be between 0 and 4');
    }

    if (typeof filters.minRating !== 'number' || filters.minRating < 0 || filters.minRating > 5) {
      errors.push('minRating must be between 0 and 5');
    }

    ['openNowOnly', 'accessibilityRequired', 'familyFriendly'].forEach(key => {
      if (typeof filters[key] !== 'boolean') {
        errors.push(`${key} must be a boolean`);
      }
    });
  } else {
    errors.push('Missing filters');
  }

  // Validate displayPreferences
  if (preferences.displayPreferences) {
    const display = preferences.displayPreferences;
    ['showScoreBreakdown', 'compactView', 'autoRefresh', 'metricUnits'].forEach(key => {
      if (typeof display[key] !== 'boolean') {
        errors.push(`displayPreferences.${key} must be a boolean`);
      }
    });
  } else {
    errors.push('Missing displayPreferences');
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings
  };
}

/**
 * Sanitize and fix common preference issues
 */
export function sanitizePreferences(preferences: any): UserPreferences {
  // Deep clone to avoid mutations
  const sanitized = JSON.parse(JSON.stringify(preferences));

  // Fix scoring weights
  if (sanitized.scoringWeights) {
    Object.keys(sanitized.scoringWeights).forEach(key => {
      const value = sanitized.scoringWeights[key];
      sanitized.scoringWeights[key] = Math.max(0, Math.min(100, Number(value) || 0));
    });
  }

  // Fix filters
  if (sanitized.filters) {
    sanitized.filters.maxRadius = Math.max(1, Math.min(50, Number(sanitized.filters.maxRadius) || 5));
    sanitized.filters.maxPriceLevel = Math.max(0, Math.min(4, Number(sanitized.filters.maxPriceLevel) || 4));
    sanitized.filters.minRating = Math.max(0, Math.min(5, Number(sanitized.filters.minRating) || 0));
  }

  // Remove overlap between favorites and blacklist
  if (sanitized.activityTypes) {
    const { favorites, blacklist } = sanitized.activityTypes;
    if (Array.isArray(favorites) && Array.isArray(blacklist)) {
      // Blacklist wins in conflicts
      sanitized.activityTypes.favorites = favorites.filter((type: string) => !blacklist.includes(type));
    }
  }

  return sanitized as UserPreferences;
}

/**
 * Check if preferences have been significantly changed
 */
export function preferencesChanged(
  oldPrefs: UserPreferences,
  newPrefs: UserPreferences
): boolean {
  // Check if any meaningful preference has changed
  const oldStr = JSON.stringify({
    ...oldPrefs,
    // Ignore display preferences for this check
    displayPreferences: undefined
  });
  const newStr = JSON.stringify({
    ...newPrefs,
    displayPreferences: undefined
  });

  return oldStr !== newStr;
}