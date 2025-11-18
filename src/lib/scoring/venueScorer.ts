import {
  Venue,
  WeatherContext,
  ScoringWeights,
  VenueScoreComponents,
  UserPreferences,
} from '@/types/recommendation';

/**
 * Calculates the weather appropriateness score for a venue
 * @param venue - The venue to score
 * @param weather - Current weather context
 * @returns Score from 0-100
 */
export function calculateWeatherScore(venue: Venue, weather: WeatherContext): number {
  const types = venue.googlePlaceData.types || [];
  let score = 50; // Neutral baseline

  // Indoor venues score higher in bad weather
  const indoorTypes = [
    'museum',
    'art_gallery',
    'library',
    'shopping_mall',
    'movie_theater',
    'bowling_alley',
    'gym',
    'spa',
    'cafe',
    'restaurant',
    'bar',
    'night_club',
    'aquarium',
    'casino',
  ];

  // Outdoor venues score higher in good weather
  const outdoorTypes = [
    'park',
    'tourist_attraction',
    'amusement_park',
    'zoo',
    'campground',
    'rv_park',
    'stadium',
    'beach',
    'hiking_area',
    'natural_feature',
  ];

  const isIndoor = types.some((type) => indoorTypes.includes(type));
  const isOutdoor = types.some((type) => outdoorTypes.includes(type));

  // Extreme weather logic
  if (weather.severityScore >= 0.7) {
    // Bad weather: strongly prefer indoor
    if (isIndoor) {
      score = 90;
    } else if (isOutdoor) {
      score = 20;
    } else {
      score = 60; // Semi-indoor (e.g., restaurants)
    }
  } else if (weather.severityScore <= 0.3) {
    // Good weather: prefer outdoor
    if (isOutdoor) {
      score = 90;
    } else if (isIndoor) {
      score = 60;
    } else {
      score = 70;
    }
  } else {
    // Moderate weather: balanced
    if (isIndoor) {
      score = 70;
    } else if (isOutdoor) {
      score = 65;
    } else {
      score = 75;
    }
  }

  // Temperature adjustments
  if (weather.temp < 5) {
    // Very cold: boost indoor scores
    if (isIndoor) score = Math.min(100, score + 10);
    if (isOutdoor) score = Math.max(0, score - 15);
  } else if (weather.temp > 32) {
    // Very hot: boost indoor with AC
    if (isIndoor) score = Math.min(100, score + 10);
    if (isOutdoor) score = Math.max(0, score - 15);
  } else if (weather.temp >= 18 && weather.temp <= 25) {
    // Perfect weather: boost outdoor
    if (isOutdoor) score = Math.min(100, score + 10);
  }

  // Rain/snow adjustments
  const precipitationCodes = [
    500, 501, 502, 503, 504, 511, 520, 521, 522, 531, // Rain
    600, 601, 602, 611, 612, 613, 615, 616, 620, 621, 622, // Snow
  ];

  if (precipitationCodes.includes(weather.conditionCode)) {
    if (isIndoor) {
      score = Math.min(100, score + 15);
    } else if (isOutdoor) {
      score = Math.max(0, score - 20);
    }
  }

  return Math.max(0, Math.min(100, score));
}

/**
 * Calculates the time appropriateness score for a venue
 * @param venue - The venue to score
 * @param weather - Current weather context (for time of day)
 * @returns Score from 0-100
 */
export function calculateTimeScore(venue: Venue, weather: WeatherContext): number {
  const types = venue.googlePlaceData.types || [];
  const { timeOfDay } = weather;
  const openNow = venue.googlePlaceData.opening_hours?.open_now;

  let score = 50; // Neutral baseline

  // Penalize closed venues heavily
  if (openNow === false) {
    return 10;
  }

  // Boost if open
  if (openNow === true) {
    score = 70;
  }

  // Time-specific venue preferences
  const morningTypes = ['cafe', 'bakery', 'park', 'gym', 'library'];
  const afternoonTypes = [
    'museum',
    'tourist_attraction',
    'shopping_mall',
    'restaurant',
    'park',
  ];
  const eveningTypes = ['restaurant', 'bar', 'night_club', 'movie_theater', 'casino'];
  const nightTypes = ['bar', 'night_club', 'casino', 'bowling_alley'];

  if (timeOfDay === 'morning' && types.some((t) => morningTypes.includes(t))) {
    score += 20;
  } else if (timeOfDay === 'afternoon' && types.some((t) => afternoonTypes.includes(t))) {
    score += 15;
  } else if (timeOfDay === 'evening' && types.some((t) => eveningTypes.includes(t))) {
    score += 20;
  } else if (timeOfDay === 'night' && types.some((t) => nightTypes.includes(t))) {
    score += 20;
  }

  return Math.max(0, Math.min(100, score));
}

/**
 * Calculates the distance score for a venue (closer is better)
 * @param venue - The venue to score
 * @param userLocation - User's current location
 * @returns Score from 0-100
 */
export function calculateDistanceScore(
  venue: Venue,
  userLocation: { lat: number; lng: number }
): number {
  const venueLocation = venue.googlePlaceData.geometry.location;

  // Calculate distance in meters using Haversine formula
  const distance = calculateDistance(
    userLocation.lat,
    userLocation.lng,
    venueLocation.lat,
    venueLocation.lng
  );

  // Store distance on venue for reference
  venue.distanceMeters = distance;

  // Score based on distance
  // 0-500m: 100 points
  // 500m-1km: 90 points
  // 1-2km: 75 points
  // 2-5km: 50 points
  // 5-10km: 25 points
  // 10km+: 10 points

  if (distance <= 500) return 100;
  if (distance <= 1000) return 90;
  if (distance <= 2000) return 75;
  if (distance <= 5000) return 50;
  if (distance <= 10000) return 25;
  return 10;
}

/**
 * Calculates the popularity score for a venue based on ratings
 * @param venue - The venue to score
 * @returns Score from 0-100
 */
export function calculatePopularityScore(venue: Venue): number {
  const rating = venue.googlePlaceData.rating || 0;
  const reviewCount = venue.googlePlaceData.user_ratings_total || 0;

  // Base score from rating (0-5 stars -> 0-100)
  let score = (rating / 5) * 100;

  // Boost based on review count (more reviews = more confidence)
  if (reviewCount >= 1000) {
    score = Math.min(100, score + 10);
  } else if (reviewCount >= 500) {
    score = Math.min(100, score + 7);
  } else if (reviewCount >= 100) {
    score = Math.min(100, score + 5);
  } else if (reviewCount >= 50) {
    score = Math.min(100, score + 3);
  } else if (reviewCount < 10) {
    // Penalize venues with very few reviews
    score = Math.max(0, score - 10);
  }

  return Math.max(0, Math.min(100, score));
}

/**
 * Calculates the overall score for a venue using dynamic weights
 * @param venue - The venue to score
 * @param weather - Current weather context
 * @param weights - Scoring weights
 * @param userPreferences - User preferences
 * @returns Score components and final score
 */
export function calculateVenueScore(
  venue: Venue,
  weather: WeatherContext,
  weights: ScoringWeights,
  userPreferences: UserPreferences
): VenueScoreComponents {
  const weatherScore = calculateWeatherScore(venue, weather);
  const timeScore = calculateTimeScore(venue, weather);
  const distanceScore = calculateDistanceScore(venue, userPreferences.location);
  const popularityScore = calculatePopularityScore(venue);

  const finalScore =
    weatherScore * weights.weather +
    timeScore * weights.time +
    distanceScore * weights.distance +
    popularityScore * weights.popularity;

  // Update venue's computed score
  venue.computedScore = finalScore;

  return {
    weatherScore,
    timeScore,
    distanceScore,
    popularityScore,
    finalScore,
  };
}

/**
 * Calculates distance between two coordinates using Haversine formula
 * @returns Distance in meters
 */
function calculateDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371e3; // Earth's radius in meters
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const Δφ = ((lat2 - lat1) * Math.PI) / 180;
  const Δλ = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c;
}

/**
 * Scores multiple venues and sorts them by score
 * @param venues - Venues to score
 * @param weather - Current weather context
 * @param weights - Scoring weights
 * @param userPreferences - User preferences
 * @returns Sorted venues with scores
 */
export function scoreAndSortVenues(
  venues: Venue[],
  weather: WeatherContext,
  weights: ScoringWeights,
  userPreferences: UserPreferences
): Venue[] {
  // Score all venues
  venues.forEach((venue) => {
    calculateVenueScore(venue, weather, weights, userPreferences);
  });

  // Sort by computed score (descending)
  return venues.sort((a, b) => b.computedScore - a.computedScore);
}
