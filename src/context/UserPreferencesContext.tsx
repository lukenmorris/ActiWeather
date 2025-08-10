// src/context/UserPreferencesContext.tsx
'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';

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

// Create context
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
}

const UserPreferencesContext = createContext<UserPreferencesContextType | undefined>(undefined);

// Local storage key
const STORAGE_KEY = 'actiweather_user_preferences';

// Provider component
export function UserPreferencesProvider({ children }: { children: ReactNode }) {
  const [preferences, setPreferences] = useState<UserPreferences>(DEFAULT_PREFERENCES);
  const [isLoaded, setIsLoaded] = useState(false);
  const [isClient, setIsClient] = useState(false);

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
        // Merge with defaults to handle missing keys from older versions
        setPreferences(prevPrefs => ({
          ...DEFAULT_PREFERENCES,
          ...parsed,
          scoringWeights: { ...DEFAULT_PREFERENCES.scoringWeights, ...parsed.scoringWeights },
          activityTypes: { 
            ...DEFAULT_PREFERENCES.activityTypes, 
            ...parsed.activityTypes,
            moodPresets: { ...DEFAULT_PREFERENCES.activityTypes.moodPresets, ...parsed.activityTypes?.moodPresets }
          },
          filters: { ...DEFAULT_PREFERENCES.filters, ...parsed.filters },
          displayPreferences: { ...DEFAULT_PREFERENCES.displayPreferences, ...parsed.displayPreferences },
        }));
      }
    } catch (error) {
      console.error('Failed to load user preferences:', error);
    } finally {
      setIsLoaded(true);
    }
  }, [isClient]);

  // Save preferences to localStorage whenever they change (client-side only)
  useEffect(() => {
    if (isLoaded && isClient) {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(preferences));
      } catch (error) {
        console.error('Failed to save user preferences:', error);
      }
    }
  }, [preferences, isLoaded, isClient]);

  // Update scoring weight
  const updateScoringWeight = (key: keyof ScoringWeights, value: number) => {
    setPreferences(prev => ({
      ...prev,
      scoringWeights: {
        ...prev.scoringWeights,
        [key]: Math.max(0, Math.min(100, value)),
      },
    }));
  };

  // Toggle favorite place type
  const toggleFavoriteType = (placeType: string) => {
    setPreferences(prev => {
      const favorites = prev.activityTypes.favorites.includes(placeType)
        ? prev.activityTypes.favorites.filter(t => t !== placeType)
        : [...prev.activityTypes.favorites, placeType];
      
      // Remove from blacklist if adding to favorites
      const blacklist = favorites.includes(placeType)
        ? prev.activityTypes.blacklist.filter(t => t !== placeType)
        : prev.activityTypes.blacklist;

      return {
        ...prev,
        activityTypes: {
          ...prev.activityTypes,
          favorites,
          blacklist,
        },
      };
    });
  };

  // Toggle blacklist place type
  const toggleBlacklistType = (placeType: string) => {
    setPreferences(prev => {
      const blacklist = prev.activityTypes.blacklist.includes(placeType)
        ? prev.activityTypes.blacklist.filter(t => t !== placeType)
        : [...prev.activityTypes.blacklist, placeType];
      
      // Remove from favorites if adding to blacklist
      const favorites = blacklist.includes(placeType)
        ? prev.activityTypes.favorites.filter(t => t !== placeType)
        : prev.activityTypes.favorites;

      return {
        ...prev,
        activityTypes: {
          ...prev.activityTypes,
          favorites,
          blacklist,
        },
      };
    });
  };

  // Set active mood
  const setActiveMood = (mood: string | null) => {
    setPreferences(prev => ({
      ...prev,
      activityTypes: {
        ...prev.activityTypes,
        activeMood: mood,
      },
    }));
  };

  // Update filter setting
  const updateFilter = (key: keyof FilterSettings, value: any) => {
    setPreferences(prev => ({
      ...prev,
      filters: {
        ...prev.filters,
        [key]: value,
      },
    }));
  };

  // Update display preference
  const updateDisplayPreference = (key: keyof UserPreferences['displayPreferences'], value: boolean) => {
    setPreferences(prev => ({
      ...prev,
      displayPreferences: {
        ...prev.displayPreferences,
        [key]: value,
      },
    }));
  };

  // Reset all preferences to defaults
  const resetPreferences = () => {
    setPreferences(DEFAULT_PREFERENCES);
    localStorage.removeItem(STORAGE_KEY);
  };

  // Export preferences as JSON string
  const exportPreferences = (): string => {
    return JSON.stringify(preferences, null, 2);
  };

  // Import preferences from JSON string
  const importPreferences = (jsonString: string): boolean => {
    try {
      const imported = JSON.parse(jsonString);
      setPreferences({
        ...DEFAULT_PREFERENCES,
        ...imported,
        scoringWeights: { ...DEFAULT_PREFERENCES.scoringWeights, ...imported.scoringWeights },
        activityTypes: { 
          ...DEFAULT_PREFERENCES.activityTypes, 
          ...imported.activityTypes,
          moodPresets: { ...DEFAULT_PREFERENCES.activityTypes.moodPresets, ...imported.activityTypes?.moodPresets }
        },
        filters: { ...DEFAULT_PREFERENCES.filters, ...imported.filters },
        displayPreferences: { ...DEFAULT_PREFERENCES.displayPreferences, ...imported.displayPreferences },
      });
      return true;
    } catch (error) {
      console.error('Failed to import preferences:', error);
      return false;
    }
  };

  // Get effective place types based on mood and preferences
  const getEffectivePlaceTypes = (): { included: string[]; excluded: string[] } => {
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
  };

  // Check if a place type is allowed
  const isPlaceTypeAllowed = (placeType: string): boolean => {
    const { blacklist } = preferences.activityTypes;
    return !blacklist.includes(placeType);
  };

  // Calculate personalized score based on user weights
  const getPersonalizedScore = (baseScore: number, placeData: any): number => {
    const weights = preferences.scoringWeights;
    const totalWeight = Object.values(weights).reduce((sum, w) => sum + w, 0);
    
    if (totalWeight === 0) return baseScore;
    
    // Normalize weights to sum to 100
    const normalizedWeights = {
      weatherImportance: (weights.weatherImportance / totalWeight) * 100,
      distanceImportance: (weights.distanceImportance / totalWeight) * 100,
      ratingsImportance: (weights.ratingsImportance / totalWeight) * 100,
      priceImportance: (weights.priceImportance / totalWeight) * 100,
      noveltyImportance: (weights.noveltyImportance / totalWeight) * 100,
    };
    
    // Apply personalized weights to score components
    // This would integrate with the scoring system in geoUtils.ts
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
  };

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
    // console.warn('useUserPreferences: No provider found, using defaults');
    // Return a default context that won't break the app
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
    } as UserPreferencesContextType;
  }
  
  return context;
}