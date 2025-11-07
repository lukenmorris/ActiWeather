// src/context/UserPreferencesContext.tsx
'use client';

import React, { createContext, useContext, useReducer, useEffect, useCallback, useRef, useState, ReactNode } from 'react';
import { validatePreferences, sanitizePreferences } from '@/lib/preferenceValidation';

// Define types for user preferences
export interface ScoringWeights {
  weatherImportance: number;  // 0-100 (default: 30)
  distanceImportance: number; // 0-100 (default: 20)
  ratingsImportance: number;  // 0-100 (default: 25)
  priceImportance: number;    // 0-100 (default: 15)
  noveltyImportance: number;  // 0-100 (default: 10)
}

export interface ActivityTypePreferences {
  favorites: string[];     // Place types to prioritize
  blacklist: string[];     // Place types to hide
  moodPresets: {
    [key: string]: string[]; // e.g., "adventure" -> ["hiking_area", "park", etc.]
  };
  activeMood: string | null;
}

export interface FilterSettings {
  maxRadius: number;         // In kilometers (default: 5)
  maxPriceLevel: number;     // 0 (free) to 4 ($$$$)
  minRating: number;         // 0-5 (default: 0)
  openNowOnly: boolean;      // Default: true
  accessibilityRequired: boolean; // Wheelchair accessible
  familyFriendly: boolean;   // Filter for family-appropriate venues
}

export interface UserPreferences {
  scoringWeights: ScoringWeights;
  activityTypes: ActivityTypePreferences;
  filters: FilterSettings;
  displayPreferences: {
    showScoreBreakdown: boolean;
    compactView: boolean;
    autoRefresh: boolean;
    metricUnits: boolean; // false = imperial (default)
  };
}

// Default preferences
const DEFAULT_PREFERENCES: UserPreferences = {
  scoringWeights: {
    weatherImportance: 30,
    distanceImportance: 20,
    ratingsImportance: 25,
    priceImportance: 15,
    noveltyImportance: 10,
  },
  activityTypes: {
    favorites: [],
    blacklist: [],
    moodPresets: {
      adventure: ['hiking_area', 'park', 'tourist_attraction', 'zoo', 'amusement_park'],
      relaxation: ['spa', 'library', 'cafe', 'book_store', 'art_gallery', 'museum'],
      social: ['restaurant', 'bar', 'night_club', 'bowling_alley', 'amusement_center'],
      solo: ['library', 'museum', 'art_gallery', 'book_store', 'cafe', 'gym'],
      family: ['park', 'zoo', 'aquarium', 'museum', 'restaurant', 'playground', 'amusement_park'],
      foodie: ['restaurant', 'cafe', 'bakery', 'food_court', 'meal_takeaway', 'bar'],
      shopping: ['shopping_mall', 'clothing_store', 'book_store', 'department_store'],
      culture: ['museum', 'art_gallery', 'library', 'performing_arts_theater', 'tourist_attraction'],
      fitness: ['gym', 'park', 'hiking_area', 'stadium', 'golf_course'],
      nightlife: ['bar', 'night_club', 'casino', 'movie_theater', 'restaurant'],
    },
    activeMood: null,
  },
  filters: {
    maxRadius: 5,
    maxPriceLevel: 4,
    minRating: 0,
    openNowOnly: true,
    accessibilityRequired: false,
    familyFriendly: false,
  },
  displayPreferences: {
    showScoreBreakdown: false,
    compactView: false,
    autoRefresh: false,
    metricUnits: false,
  },
};

// Action types for reducer
type PreferenceAction =
  | { type: 'SET_PREFERENCES'; payload: UserPreferences }
  | { type: 'UPDATE_SCORING_WEIGHT'; payload: { key: keyof ScoringWeights; value: number } }
  | { type: 'TOGGLE_FAVORITE_TYPE'; payload: string }
  | { type: 'TOGGLE_BLACKLIST_TYPE'; payload: string }
  | { type: 'SET_ACTIVE_MOOD'; payload: string | null }
  | { type: 'UPDATE_FILTER'; payload: { key: keyof FilterSettings; value: any } }
  | { type: 'UPDATE_DISPLAY_PREFERENCE'; payload: { key: keyof UserPreferences['displayPreferences']; value: boolean } }
  | { type: 'RESET_PREFERENCES' }
  | { type: 'LOAD_FROM_STORAGE'; payload: UserPreferences };

// Reducer function
function preferencesReducer(state: UserPreferences, action: PreferenceAction): UserPreferences {
  switch (action.type) {
    case 'SET_PREFERENCES':
      return sanitizePreferences(action.payload);

    case 'UPDATE_SCORING_WEIGHT':
      return {
        ...state,
        scoringWeights: {
          ...state.scoringWeights,
          [action.payload.key]: Math.max(0, Math.min(100, action.payload.value)),
        },
      };

    case 'TOGGLE_FAVORITE_TYPE': {
      const isFavorite = state.activityTypes.favorites.includes(action.payload);
      return {
        ...state,
        activityTypes: {
          ...state.activityTypes,
          favorites: isFavorite
            ? state.activityTypes.favorites.filter(t => t !== action.payload)
            : [...state.activityTypes.favorites, action.payload],
          // Remove from blacklist if adding to favorites
          blacklist: isFavorite
            ? state.activityTypes.blacklist
            : state.activityTypes.blacklist.filter(t => t !== action.payload),
        },
      };
    }

    case 'TOGGLE_BLACKLIST_TYPE': {
      const isBlacklisted = state.activityTypes.blacklist.includes(action.payload);
      return {
        ...state,
        activityTypes: {
          ...state.activityTypes,
          blacklist: isBlacklisted
            ? state.activityTypes.blacklist.filter(t => t !== action.payload)
            : [...state.activityTypes.blacklist, action.payload],
          // Remove from favorites if adding to blacklist
          favorites: isBlacklisted
            ? state.activityTypes.favorites
            : state.activityTypes.favorites.filter(t => t !== action.payload),
        },
      };
    }

    case 'SET_ACTIVE_MOOD':
      return {
        ...state,
        activityTypes: {
          ...state.activityTypes,
          activeMood: action.payload,
        },
      };

    case 'UPDATE_FILTER':
      return {
        ...state,
        filters: {
          ...state.filters,
          [action.payload.key]: action.payload.value,
        },
      };

    case 'UPDATE_DISPLAY_PREFERENCE':
      return {
        ...state,
        displayPreferences: {
          ...state.displayPreferences,
          [action.payload.key]: action.payload.value,
        },
      };

    case 'RESET_PREFERENCES':
      return DEFAULT_PREFERENCES;

    case 'LOAD_FROM_STORAGE':
      return action.payload;

    default:
      return state;
  }
}

// Context type
interface UserPreferencesContextType {
  preferences: UserPreferences;
  updateScoringWeight: (key: keyof ScoringWeights, value: number) => void;
  toggleFavoriteType: (placeType: string) => void;
  toggleBlacklistType: (placeType: string) => void;
  setActiveMood: (mood: string | null) => void;
  updateFilter: (key: keyof FilterSettings, value: any) => void;
  updateDisplayPreference: (key: keyof UserPreferences['displayPreferences'], value: boolean) => void;
  resetPreferences: () => void;
  exportPreferences: () => string;
  importPreferences: (jsonString: string) => boolean;
  getEffectivePlaceTypes: () => { included: string[]; excluded: string[] };
  isPlaceTypeAllowed: (placeType: string) => boolean;
  getPersonalizedScore: (baseScore: number, placeData: any) => number;
  // New: Change notification
  onPreferencesChange: (callback: (prefs: UserPreferences) => void) => () => void;
  hasUnsavedChanges: boolean;
}

const UserPreferencesContext = createContext<UserPreferencesContextType | undefined>(undefined);

// Local storage key
const STORAGE_KEY = 'actiweather_user_preferences';
const STORAGE_VERSION = 1;

// Debounce utility
function debounce<T extends (...args: any[]) => any>(func: T, wait: number): T {
  let timeout: NodeJS.Timeout;
  return ((...args: Parameters<T>) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
  }) as T;
}

// Provider component
export function UserPreferencesProvider({ children }: { children: ReactNode }) {
  const [preferences, dispatch] = useReducer(preferencesReducer, DEFAULT_PREFERENCES);
  const [isClient, setIsClient] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const listenersRef = useRef<Set<(prefs: UserPreferences) => void>>(new Set());
  const savedPrefsRef = useRef<string>(JSON.stringify(DEFAULT_PREFERENCES));

  // Check if we're on the client
  useEffect(() => {
    setIsClient(true);
  }, []);

  // Load preferences from localStorage on mount (client-side only)
  useEffect(() => {
    if (!isClient) return;

    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);

        // Validate
        const validation = validatePreferences(parsed);
        if (validation.valid) {
          const sanitized = sanitizePreferences(parsed);
          dispatch({ type: 'LOAD_FROM_STORAGE', payload: sanitized });
          savedPrefsRef.current = JSON.stringify(sanitized);
        } else {
          console.warn('Invalid preferences in storage, using defaults:', validation.errors);
          localStorage.removeItem(STORAGE_KEY);
        }
      }
    } catch (error) {
      console.error('Failed to load user preferences:', error);
      localStorage.removeItem(STORAGE_KEY);
    } finally {
      setIsLoaded(true);
    }
  }, [isClient]);

  // Debounced save to localStorage
  const saveToStorage = useCallback(
    debounce((prefs: UserPreferences) => {
      if (!isClient) return;

      try {
        const toSave = {
          version: STORAGE_VERSION,
          preferences: prefs,
          savedAt: Date.now(),
        };
        localStorage.setItem(STORAGE_KEY, JSON.stringify(toSave.preferences));
        savedPrefsRef.current = JSON.stringify(prefs);
        setHasUnsavedChanges(false);
        console.log('✅ Preferences saved to localStorage');
      } catch (error) {
        console.error('Failed to save preferences:', error);
      }
    }, 500),
    [isClient]
  );

  // Save preferences whenever they change
  useEffect(() => {
    if (isLoaded && isClient) {
      const currentPrefsStr = JSON.stringify(preferences);
      if (currentPrefsStr !== savedPrefsRef.current) {
        setHasUnsavedChanges(true);
        saveToStorage(preferences);

        // Notify listeners
        listenersRef.current.forEach(listener => {
          try {
            listener(preferences);
          } catch (error) {
            console.error('Error in preference change listener:', error);
          }
        });
      }
    }
  }, [preferences, isLoaded, isClient, saveToStorage]);

  // Context methods
  const updateScoringWeight = useCallback((key: keyof ScoringWeights, value: number) => {
    dispatch({ type: 'UPDATE_SCORING_WEIGHT', payload: { key, value } });
  }, []);

  const toggleFavoriteType = useCallback((placeType: string) => {
    dispatch({ type: 'TOGGLE_FAVORITE_TYPE', payload: placeType });
  }, []);

  const toggleBlacklistType = useCallback((placeType: string) => {
    dispatch({ type: 'TOGGLE_BLACKLIST_TYPE', payload: placeType });
  }, []);

  const setActiveMood = useCallback((mood: string | null) => {
    dispatch({ type: 'SET_ACTIVE_MOOD', payload: mood });
  }, []);

  const updateFilter = useCallback((key: keyof FilterSettings, value: any) => {
    dispatch({ type: 'UPDATE_FILTER', payload: { key, value } });
  }, []);

  const updateDisplayPreference = useCallback(
    (key: keyof UserPreferences['displayPreferences'], value: boolean) => {
      dispatch({ type: 'UPDATE_DISPLAY_PREFERENCE', payload: { key, value } });
    },
    []
  );

  const resetPreferences = useCallback(() => {
    dispatch({ type: 'RESET_PREFERENCES' });
    if (isClient) {
      localStorage.removeItem(STORAGE_KEY);
    }
  }, [isClient]);

  const exportPreferences = useCallback((): string => {
    return JSON.stringify(preferences, null, 2);
  }, [preferences]);

  const importPreferences = useCallback((jsonString: string): boolean => {
    try {
      const imported = JSON.parse(jsonString);
      const validation = validatePreferences(imported);

      if (!validation.valid) {
        console.error('Invalid preferences:', validation.errors);
        return false;
      }

      const sanitized = sanitizePreferences(imported);
      dispatch({ type: 'SET_PREFERENCES', payload: sanitized });
      return true;
    } catch (error) {
      console.error('Failed to import preferences:', error);
      return false;
    }
  }, []);

  const getEffectivePlaceTypes = useCallback((): { included: string[]; excluded: string[] } => {
    const { activeMood, favorites, blacklist, moodPresets } = preferences.activityTypes;

    let included: string[] = [];

    // If mood is active, use mood types
    if (activeMood && moodPresets[activeMood]) {
      included = [...moodPresets[activeMood]];
    }

    // Always include favorites (override mood)
    favorites.forEach(type => {
      if (!included.includes(type)) {
        included.push(type);
      }
    });

    // Filter out blacklisted types
    included = included.filter(type => !blacklist.includes(type));

    return {
      included,
      excluded: blacklist,
    };
  }, [preferences.activityTypes]);

  const isPlaceTypeAllowed = useCallback(
    (placeType: string): boolean => {
      return !preferences.activityTypes.blacklist.includes(placeType);
    },
    [preferences.activityTypes.blacklist]
  );

  const getPersonalizedScore = useCallback(
    (baseScore: number, placeData: any): number => {
      // This is a simplified version - full implementation is in applyPreferences.ts
      const weights = preferences.scoringWeights;
      const totalWeight = Object.values(weights).reduce((sum, w) => sum + w, 0) || 100;

      if (totalWeight === 0) return baseScore;

      let personalizedScore = baseScore;

      // Bonus for favorite types
      if (placeData.types && preferences.activityTypes.favorites.some((fav: string) =>
        placeData.types.includes(fav))) {
        personalizedScore += 10;
      }

      // Apply price preference
      if (placeData.priceLevel && weights.priceImportance > 0) {
        const pricePenalty = (placeData.priceLevel / 4) * (weights.priceImportance / 100) * 20;
        personalizedScore -= pricePenalty;
      }

      return Math.max(0, Math.min(100, personalizedScore));
    },
    [preferences.scoringWeights, preferences.activityTypes.favorites]
  );

  // Change notification system
  const onPreferencesChange = useCallback(
    (callback: (prefs: UserPreferences) => void): (() => void) => {
      listenersRef.current.add(callback);
      return () => {
        listenersRef.current.delete(callback);
      };
    },
    []
  );

  const contextValue: UserPreferencesContextType = {
    preferences,
    updateScoringWeight,
    toggleFavoriteType,
    toggleBlacklistType,
    setActiveMood,
    updateFilter,
    updateDisplayPreference,
    resetPreferences,
    exportPreferences,
    importPreferences,
    getEffectivePlaceTypes,
    isPlaceTypeAllowed,
    getPersonalizedScore,
    onPreferencesChange,
    hasUnsavedChanges,
  };

  return (
    <UserPreferencesContext.Provider value={contextValue}>
      {children}
    </UserPreferencesContext.Provider>
  );
}

// Custom hook to use preferences with safe fallback
export function useUserPreferences() {
  const context = useContext(UserPreferencesContext);

  // Return default context if provider is not found (for SSR compatibility)
  if (context === undefined) {
    console.warn('useUserPreferences: No provider found, using defaults');
    return {
      preferences: DEFAULT_PREFERENCES,
      updateScoringWeight: () => {},
      toggleFavoriteType: () => {},
      toggleBlacklistType: () => {},
      setActiveMood: () => {},
      updateFilter: () => {},
      updateDisplayPreference: () => {},
      resetPreferences: () => {},
      exportPreferences: () => JSON.stringify(DEFAULT_PREFERENCES),
      importPreferences: () => false,
      getEffectivePlaceTypes: () => ({ included: [], excluded: [] }),
      isPlaceTypeAllowed: () => true,
      getPersonalizedScore: (baseScore: number) => baseScore,
      onPreferencesChange: () => () => {},
      hasUnsavedChanges: false,
    } as UserPreferencesContextType;
  }

  return context;
}