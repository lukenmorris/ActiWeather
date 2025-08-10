// src/lib/geoUtils.ts
import type { GooglePlace, WeatherData } from '@/types';

/**
 * Calculates the great-circle distance between two points
 * on the Earth (specified in decimal degrees) using the Haversine formula.
 * @param lat1 Latitude of the first point.
 * @param lon1 Longitude of the first point.
 * @param lat2 Latitude of the second point.
 * @param lon2 Longitude of the second point.
 * @returns The distance in kilometers.
 */
export function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371; // Radius of the Earth in kilometers
  const dLat = deg2rad(lat2 - lat1);
  const dLon = deg2rad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const distance = R * c; // Distance in km
  return distance;
}

function deg2rad(deg: number): number {
  return deg * (Math.PI / 180);
}

/**
 * Formats a distance in kilometers to a readable string.
 * Shows meters if less than 1 km.
 * @param distanceInKm Distance in kilometers.
 * @returns Formatted string (e.g., "3.2 mi", "800 yd" - adjusted for imperial) or "N/A".
 */
export function formatDistance(distanceInKm: number): string {
    if (isNaN(distanceInKm) || distanceInKm < 0) {
        return 'N/A';
    }
    const distanceInMiles = distanceInKm * 0.621371; // Convert km to miles
    if (distanceInMiles < 0.1) { // Show yards if less than ~176 yards
        const distanceInYards = distanceInMiles * 1760;
        return `${distanceInYards.toFixed(0)} yd`;
    }
    return `${distanceInMiles.toFixed(1)} mi`; // Show miles rounded to 1 decimal
}

// --- Enhanced Scoring System Constants ---

// Temperature Thresholds in Fahrenheit
const TEMP_FREEZING = 32;
const TEMP_COLD = 46;
const TEMP_COOL = 61;
const TEMP_MILD_LOW = 64;
const TEMP_MILD_HIGH = 79;
const TEMP_WARM = 84;
const TEMP_HOT = 91;

// Wind Thresholds in mph
const WIND_CALM_MPH = 7;
const WIND_BREEZY_MPH = 16;
const WIND_WINDY_MPH = 25;

// Other weather thresholds
const CLOUDS_OVERCAST = 80; // %
const VISIBILITY_POOR = 1000; // meters
const HUMIDITY_HIGH = 75; // %
const UV_INDEX_HIGH = 6;

// Place Type Classifications
const INDOOR_HEAVY_TYPES = new Set([
    'museum', 'movie_theater', 'library', 'aquarium', 'shopping_mall', 'gym',
    'bowling_alley', 'spa', 'art_gallery', 'performing_arts_theater',
    'casino', 'beauty_salon', 'hair_care', 'nail_salon', 'skating_rink',
    'amusement_center', 'book_store', 'clothing_store', 'department_store',
    'electronics_store', 'furniture_store', 'home_goods_store', 'jewelry_store',
    'shoe_store', 'pet_store'
]);

const OUTDOOR_HEAVY_TYPES = new Set([
    'park', 'hiking_area', 'campground', 'zoo', 'amusement_park', 'stadium',
    'golf_course', 'playground', 'garden', 'picnic_ground', 'marina', 'beach',
    'swimming_pool', 'tourist_attraction', 'viewpoint', 'plaza'
]);

const MIXED_ADAPTABLE_TYPES = new Set([
    'restaurant', 'cafe', 'bar', 'tourist_attraction', 'food_court',
    'meal_takeaway', 'bakery', 'ice_cream_shop'
]);

// Special place types for specific conditions
const LATE_NIGHT_FRIENDLY = new Set([
    'bar', 'night_club', 'casino', 'convenience_store', 'supermarket',
    'liquor_store', '24_hour_restaurant', 'diner', 'meal_takeaway'
]);

const WEATHER_REFUGE_TYPES = new Set([
    'shopping_mall', 'museum', 'library', 'movie_theater', 'spa',
    'cafe', 'restaurant', 'book_store', 'art_gallery'
]);

/**
 * Enhanced scoring breakdown for transparency
 */
export interface ScoreBreakdown {
    weatherMatch: number;      // 0-30 points
    timeCompatibility: number; // 0-25 points
    distanceScore: number;     // 0-20 points
    popularityScore: number;   // 0-15 points
    uniquenessBonus: number;   // 0-10 points
    totalScore: number;        // 0-100
    confidence: 'high' | 'medium' | 'low';
    primaryFactors: string[];
}

/**
 * Calculate popularity score based on ratings and review count
 */
function calculatePopularityScore(rating?: number, reviewCount?: number): number {
    if (!rating || !reviewCount) return 0;
    
    // Rating score with more granular scaling (out of 1.0)
    let ratingScore = 0;
    if (rating >= 4.8) {
        ratingScore = 0.95 + ((rating - 4.8) / 0.2) * 0.05; // 4.8-5.0 maps to 95-100%
    } else if (rating >= 4.5) {
        ratingScore = 0.85 + ((rating - 4.5) / 0.3) * 0.10; // 4.5-4.8 maps to 85-95%
    } else if (rating >= 4.0) {
        ratingScore = 0.70 + ((rating - 4.0) / 0.5) * 0.15; // 4.0-4.5 maps to 70-85%
    } else if (rating >= 3.5) {
        ratingScore = 0.50 + ((rating - 3.5) / 0.5) * 0.20; // 3.5-4.0 maps to 50-70%
    } else if (rating >= 3.0) {
        ratingScore = 0.30 + ((rating - 3.0) / 0.5) * 0.20; // 3.0-3.5 maps to 30-50%
    } else {
        ratingScore = (rating / 3.0) * 0.30; // Below 3.0 maps to 0-30%
    }
    
    // Review count scoring with better thresholds
    let reviewScore = 0;
    if (reviewCount >= 5000) {
        reviewScore = 1.0; // Extremely popular (rare)
    } else if (reviewCount >= 2000) {
        reviewScore = 0.92; // Very popular
    } else if (reviewCount >= 1000) {
        reviewScore = 0.85; // Popular
    } else if (reviewCount >= 500) {
        reviewScore = 0.78; // Well-established
    } else if (reviewCount >= 200) {
        reviewScore = 0.70; // Well-reviewed
    } else if (reviewCount >= 100) {
        reviewScore = 0.60; // Moderately reviewed
    } else if (reviewCount >= 50) {
        reviewScore = 0.50; // Some reviews
    } else if (reviewCount >= 20) {
        reviewScore = 0.40; // Few reviews
    } else if (reviewCount >= 10) {
        reviewScore = 0.30; // Minimal reviews
    } else {
        // Very few reviews
        reviewScore = (reviewCount / 10) * 0.30;
    }
    
    // Weighted combination: rating quality matters more than quantity
    // 70% weight on rating (quality) and 30% on review count (popularity/trust)
    const combinedScore = (ratingScore * 0.70) + (reviewScore * 0.30);
    
    // Scale to 15 points max
    let finalScore = combinedScore * 15;
    
    // Small bonus for exceptional combinations (but more conservative)
    if (rating >= 4.7 && reviewCount >= 2000) {
        finalScore = Math.min(15, finalScore * 1.05); // 5% boost for truly exceptional
    } else if (rating >= 4.5 && reviewCount >= 1000) {
        finalScore = Math.min(15, finalScore * 1.02); // 2% boost for excellent
    }
    
    return Math.round(finalScore * 10) / 10; // Round to 1 decimal place
}

/**
 * Calculate distance score with decay function
 */
function calculateDistanceScore(distanceKm: number): number {
    if (distanceKm <= 0.5) return 20;  // Walking distance
    if (distanceKm <= 1) return 18;    // Short walk
    if (distanceKm <= 2) return 15;    // Bikeable
    if (distanceKm <= 5) return 10;    // Short drive
    if (distanceKm <= 10) return 5;    // Moderate drive
    return 2; // Far but reachable
}

/**
 * Calculate time compatibility with granular checks
 */
function calculateTimeCompatibility(
    placeTypes: string[],
    localHour: number,
    isWeekend: boolean,
    isOpenNow?: boolean
): number {
    let score = 15; // Base score if open
    
    // Heavily penalize if closed
    if (isOpenNow === false) return 0;
    
    // Peak hours bonus
    const isPeakDining = (localHour >= 11 && localHour <= 14) || (localHour >= 18 && localHour <= 21);
    const isPeakShopping = (localHour >= 10 && localHour <= 20);
    const isPeakNightlife = (localHour >= 21 || localHour <= 2);
    const isPeakOutdoor = (localHour >= 6 && localHour <= 18);
    
    // Type-specific time bonuses
    if (placeTypes.some(t => ['restaurant', 'cafe', 'bakery'].includes(t)) && isPeakDining) {
        score += 8;
    }
    if (placeTypes.some(t => ['bar', 'night_club'].includes(t)) && isPeakNightlife) {
        score += 10;
    }
    if (placeTypes.some(t => OUTDOOR_HEAVY_TYPES.has(t)) && isPeakOutdoor) {
        score += 5;
    }
    if (placeTypes.some(t => ['shopping_mall', 'clothing_store'].includes(t)) && isPeakShopping) {
        score += 5;
    }
    
    // Weekend bonus for leisure activities
    if (isWeekend && placeTypes.some(t => ['park', 'zoo', 'museum', 'amusement_park'].includes(t))) {
        score += 5;
    }
    
    return Math.min(25, score);
}

/**
 * Calculate weather match with nuanced conditions
 */
function calculateWeatherMatch(
    place: GooglePlace,
    weatherData: WeatherData,
    hasOutdoorSeating: boolean = false
): number {
    let score = 15; // Base neutral score
    const placeTypes = place.types || [];
    
    // Extract weather parameters
    const conditionId = weatherData.weather[0]?.id ?? 800;
    const feelsLike = weatherData.main.feels_like;
    const windSpeedMph = weatherData.wind.speed;
    const humidity = weatherData.main.humidity;
    const clouds = weatherData.clouds.all;
    
    // Determine weather severity
    const isPrecipitating = conditionId && [2, 3, 5, 6].includes(Math.floor(conditionId / 100));
    const isHeavyPrecip = conditionId && [202, 212, 221, 232, 502, 503, 504, 522, 531, 602, 622].includes(conditionId);
    const isThunderstorm = Math.floor(conditionId / 100) === 2;
    const isSnowing = Math.floor(conditionId / 100) === 6;
    
    // Determine place characteristics
    const isStrictlyIndoor = placeTypes.some(t => INDOOR_HEAVY_TYPES.has(t)) && 
                             !placeTypes.some(t => OUTDOOR_HEAVY_TYPES.has(t));
    const isStrictlyOutdoor = placeTypes.some(t => OUTDOOR_HEAVY_TYPES.has(t)) && 
                              !placeTypes.some(t => INDOOR_HEAVY_TYPES.has(t));
    
    // Temperature scoring
    const isMild = feelsLike >= TEMP_MILD_LOW && feelsLike <= TEMP_MILD_HIGH;
    const isExtreme = feelsLike < TEMP_FREEZING || feelsLike > TEMP_HOT;
    
    // Perfect conditions bonus
    if (isMild && !isPrecipitating && windSpeedMph < WIND_BREEZY_MPH) {
        if (isStrictlyOutdoor || hasOutdoorSeating) {
            score += 15; // Perfect outdoor weather
        } else if (isStrictlyIndoor) {
            score -= 5; // Missing out on nice weather
        }
    }
    
    // Bad weather adjustments
    if (isPrecipitating) {
        if (isStrictlyIndoor || placeTypes.some(t => WEATHER_REFUGE_TYPES.has(t))) {
            score += 12; // Good refuge
            if (isHeavyPrecip) score += 3;
        } else if (isStrictlyOutdoor) {
            score -= 10;
            if (isHeavyPrecip) score -= 5;
            if (isThunderstorm) score -= 3;
        }
    }
    
    // Extreme temperature adjustments
    if (isExtreme) {
        if (isStrictlyIndoor) {
            score += 10; // Climate controlled
        } else if (isStrictlyOutdoor) {
            score -= 12;
        }
    }
    
    // Special conditions
    if (feelsLike > TEMP_WARM && placeTypes.includes('ice_cream_shop')) score += 5;
    if (feelsLike < TEMP_COOL && placeTypes.includes('cafe')) score += 3;
    if (isSnowing && placeTypes.includes('spa')) score += 5;
    if (humidity > HUMIDITY_HIGH && feelsLike > TEMP_WARM) {
        if (placeTypes.includes('swimming_pool')) score += 5;
        else if (isStrictlyOutdoor) score -= 3;
    }
    
    // Wind penalty for outdoor
    if (windSpeedMph > WIND_WINDY_MPH && (isStrictlyOutdoor || hasOutdoorSeating)) {
        score -= 5;
    }
    
    return Math.max(0, Math.min(30, score));
}

/**
 * Calculate uniqueness bonus based on special features
 */
function calculateUniquenessBonus(
    place: GooglePlace,
    weatherData: WeatherData,
    placeDetails?: any
): number {
    let bonus = 0;
    const placeTypes = place.types || [];
    const hour = new Date((weatherData.dt + weatherData.timezone) * 1000).getUTCHours();
    
    // Rare or special venue types
    if (placeTypes.includes('aquarium') || placeTypes.includes('planetarium')) bonus += 3;
    if (placeTypes.includes('rooftop_bar') && weatherData.weather[0]?.main === 'Clear') bonus += 5;
    
    // Special features from details
    if (placeDetails?.outdoorSeating && weatherData.main.feels_like >= TEMP_MILD_LOW && 
        weatherData.main.feels_like <= TEMP_WARM && !weatherData.rain) bonus += 3;
    
    // Time-specific uniqueness
    if (hour < 7 && placeTypes.includes('bakery')) bonus += 4; // Early morning bakery
    if (hour >= 22 && placeTypes.includes('night_club')) bonus += 3; // Late night venue
    
    // Weather-specific perfect matches
    if (weatherData.snow && placeTypes.includes('ski_resort')) bonus += 5;
    if (weatherData.main.temp > TEMP_HOT && placeTypes.includes('water_park')) bonus += 5;
    
    return Math.min(10, bonus);
}

/**
 * Enhanced weather suitability scoring system
 * Returns a score from 0-100 with detailed breakdown
 */
export function calculateWeatherSuitability(
    place: GooglePlace | (GooglePlace & { distance?: number }),
    weatherData: WeatherData | null,
    debug: boolean = false
): number {
    if (!weatherData || !place?.types) {
        return 50; // Default neutral score
    }
    
    // Get place details if available
    const placeDetails = (place as any);
    const hasOutdoorSeating = placeDetails.outdoorSeating === true;
    const isOpenNow = placeDetails.currentOpeningHours?.openNow;
    
    // Calculate time parameters
    const localDate = new Date((weatherData.dt + weatherData.timezone) * 1000);
    const localHour = localDate.getUTCHours();
    const dayOfWeek = localDate.getUTCDay();
    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
    
    // Calculate distance if available
    const distanceKm = (place as any).distance || 5; // Default 5km if not provided
    
    // Calculate individual score components
    const weatherMatch = calculateWeatherMatch(place, weatherData, hasOutdoorSeating);
    const timeCompatibility = calculateTimeCompatibility(place.types, localHour, isWeekend, isOpenNow);
    const distanceScore = calculateDistanceScore(distanceKm);
    const popularityScore = calculatePopularityScore(place.rating, place.userRatingCount);
    const uniquenessBonus = calculateUniquenessBonus(place, weatherData, placeDetails);
    
    // Calculate total with weights
    const totalScore = Math.round(
        weatherMatch +           // 30% weight
        timeCompatibility +      // 25% weight
        distanceScore +          // 20% weight
        popularityScore +        // 15% weight
        uniquenessBonus          // 10% weight
    );
    
    // Ensure score is within bounds
    const finalScore = Math.max(0, Math.min(100, totalScore));
    
    // Debug logging
    if (debug) {
        const breakdown: ScoreBreakdown = {
            weatherMatch,
            timeCompatibility,
            distanceScore,
            popularityScore,
            uniquenessBonus,
            totalScore: finalScore,
            confidence: finalScore >= 70 ? 'high' : finalScore >= 50 ? 'medium' : 'low',
            primaryFactors: []
        };
        
        // Identify primary factors
        if (weatherMatch >= 20) breakdown.primaryFactors.push('Perfect weather match');
        if (timeCompatibility >= 20) breakdown.primaryFactors.push('Ideal timing');
        if (distanceScore >= 15) breakdown.primaryFactors.push('Very close');
        if (popularityScore >= 12) breakdown.primaryFactors.push('Highly rated');
        if (uniquenessBonus >= 5) breakdown.primaryFactors.push('Special features');
        
        console.log(`[Enhanced Scoring] ${place.displayName?.text || 'Unknown'}`);
        console.log(`  Weather Match: ${weatherMatch}/30`);
        console.log(`  Time Compatibility: ${timeCompatibility}/25`);
        console.log(`  Distance Score: ${distanceScore}/20`);
        console.log(`  Popularity: ${popularityScore.toFixed(1)}/15`);
        console.log(`  Uniqueness: ${uniquenessBonus}/10`);
        console.log(`  TOTAL: ${finalScore}/100 (${breakdown.confidence} confidence)`);
        if (breakdown.primaryFactors.length > 0) {
            console.log(`  Key Factors: ${breakdown.primaryFactors.join(', ')}`);
        }
    }
    
    return finalScore;
}

/**
 * Get score breakdown for UI display
 */
export function getScoreBreakdown(
    place: GooglePlace,
    weatherData: WeatherData,
    distance?: number
): ScoreBreakdown {
    const placeWithDistance = { ...place, distance };
    const totalScore = calculateWeatherSuitability(placeWithDistance, weatherData, false);
    
    // Recalculate components for breakdown
    const placeDetails = (place as any);
    const hasOutdoorSeating = placeDetails.outdoorSeating === true;
    const isOpenNow = placeDetails.currentOpeningHours?.openNow;
    
    const localDate = new Date((weatherData.dt + weatherData.timezone) * 1000);
    const localHour = localDate.getUTCHours();
    const dayOfWeek = localDate.getUTCDay();
    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
    const distanceKm = distance || 5;
    
    const breakdown: ScoreBreakdown = {
        weatherMatch: calculateWeatherMatch(place, weatherData, hasOutdoorSeating),
        timeCompatibility: calculateTimeCompatibility(place.types || [], localHour, isWeekend, isOpenNow),
        distanceScore: calculateDistanceScore(distanceKm),
        popularityScore: calculatePopularityScore(place.rating, place.userRatingCount),
        uniquenessBonus: calculateUniquenessBonus(place, weatherData, placeDetails),
        totalScore,
        confidence: totalScore >= 70 ? 'high' : totalScore >= 50 ? 'medium' : 'low',
        primaryFactors: []
    };
    
    // Identify primary factors
    if (breakdown.weatherMatch >= 20) breakdown.primaryFactors.push('Perfect weather');
    if (breakdown.timeCompatibility >= 20) breakdown.primaryFactors.push('Great timing');
    if (breakdown.distanceScore >= 15) breakdown.primaryFactors.push('Very close');
    if (breakdown.popularityScore >= 12) breakdown.primaryFactors.push('Highly rated');
    if (breakdown.uniquenessBonus >= 5) breakdown.primaryFactors.push('Unique features');
    
    return breakdown;
}

// Export the thresholds for use in other files
export const WEATHER_THRESHOLDS = {
    TEMP_FREEZING,
    TEMP_COLD,
    TEMP_COOL,
    TEMP_MILD_LOW,
    TEMP_MILD_HIGH,
    TEMP_WARM,
    TEMP_HOT,
    WIND_CALM_MPH,
    WIND_BREEZY_MPH,
    WIND_WINDY_MPH,
    CLOUDS_OVERCAST,
    VISIBILITY_POOR,
    HUMIDITY_HIGH
};