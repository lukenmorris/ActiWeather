/**
 * Weather context for recommendation scoring
 */
export interface WeatherContext {
  /** Temperature in Celsius */
  temp: number;
  /** OpenWeatherMap weather condition code */
  conditionCode: number;
  /** Severity score (0-1, where 1 is most severe/extreme) */
  severityScore: number;
  /** Time of day (morning, afternoon, evening, night) */
  timeOfDay: 'morning' | 'afternoon' | 'evening' | 'night';
  /** Human-readable weather description */
  description: string;
  /** Timestamp of weather data */
  timestamp: Date;
}

/**
 * Venue with scoring data
 */
export interface Venue {
  /** Unique venue identifier */
  id: string;
  /** Venue name */
  name: string;
  /** Google Place data (raw from Places API) */
  googlePlaceData: GooglePlaceData;
  /** Base score before contextual adjustments (0-100) */
  baseScore: number;
  /** Computed score after dynamic weighting (0-100) */
  computedScore: number;
  /** Semantic tags for AI processing */
  semanticTags: string[];
  /** Distance from user in meters */
  distanceMeters?: number;
}

/**
 * Google Place data structure
 */
export interface GooglePlaceData {
  place_id: string;
  name: string;
  formatted_address?: string;
  rating?: number;
  user_ratings_total?: number;
  geometry: {
    location: {
      lat: number;
      lng: number;
    };
  };
  types?: string[];
  opening_hours?: {
    open_now?: boolean;
    weekday_text?: string[];
  };
  price_level?: number;
  photos?: Array<{
    photo_reference: string;
    height: number;
    width: number;
  }>;
  editorial_summary?: {
    overview?: string;
  };
}

/**
 * User preferences for recommendations
 */
export interface UserPreferences {
  /** User's current mood/intent */
  mood?: 'adventurous' | 'relaxed' | 'social' | 'productive' | 'romantic';
  /** Budget level (1-4, where 1 is cheapest) */
  budget?: 1 | 2 | 3 | 4;
  /** Search radius in meters */
  radius: number;
  /** Preferred venue types */
  preferredTypes?: string[];
  /** User location */
  location: {
    lat: number;
    lng: number;
  };
}

/**
 * Scoring weights for different factors
 */
export interface ScoringWeights {
  /** Weather appropriateness weight (0-1) */
  weather: number;
  /** Time of day appropriateness weight (0-1) */
  time: number;
  /** Distance/proximity weight (0-1) */
  distance: number;
  /** Popularity/rating weight (0-1) */
  popularity: number;
}

/**
 * Recommendation request payload
 */
export interface RecommendationRequest {
  weather: WeatherContext;
  userPreferences: UserPreferences;
  /** Maximum number of results to return */
  maxResults?: number;
}

/**
 * Recommendation response payload
 */
export interface RecommendationResponse {
  venues: Venue[];
  /** Weather context used for recommendations */
  weatherContext: WeatherContext;
  /** Weights used for scoring */
  weightsUsed: ScoringWeights;
  /** Whether AI reranking was applied */
  aiRerankingApplied: boolean;
  /** Timestamp of recommendation generation */
  timestamp: Date;
}

/**
 * Gemini reranking request
 */
export interface GeminiRerankRequest {
  venues: Venue[];
  weatherSummary: string;
  userContext?: string;
}

/**
 * Gemini reranking response
 */
export interface GeminiRerankResponse {
  /** Reordered venue IDs */
  venueIds: string[];
  /** Whether reranking succeeded */
  success: boolean;
  /** Error message if failed */
  error?: string;
}

/**
 * Individual scoring components for a venue
 */
export interface VenueScoreComponents {
  weatherScore: number;
  timeScore: number;
  distanceScore: number;
  popularityScore: number;
  finalScore: number;
}
