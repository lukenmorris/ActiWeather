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

// --- Constants for Weather Suitability ---
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
 * Calculates a detailed weather suitability score for a place.
 * Higher score (0-100) means more suitable for the current weather.
 * @param place The GooglePlace object (potentially including details like outdoorSeating)
 * @param weatherData The current weather data (EXPECTS FAHRENHEIT/MPH)
 * @param debug Optional flag to enable debug logging
 * @returns A numerical score between 0 and 100.
 */
export function calculateWeatherSuitability(
    place: GooglePlace | (GooglePlace & { distance?: number }),
    weatherData: WeatherData | null,
    debug: boolean = false
): number {
    // Start with a higher base score to allow more differentiation
    let score = 70;
    const scoreAdjustments: string[] = []; // Track adjustments for debugging
    
    if (!weatherData || !place?.types) {
        if (debug) console.log(`[Scoring] No weather data or place types for ${place?.displayName?.text || 'Unknown'}`);
        return score;
    }

    // Helper function to adjust score and track changes
    const adjustScore = (amount: number, reason: string) => {
        score += amount;
        if (debug) scoreAdjustments.push(`${amount >= 0 ? '+' : ''}${amount}: ${reason}`);
    };

    // --- Extract Weather Parameters ---
    const conditionId = weatherData.weather[0]?.id ?? 800;
    const weatherMain = weatherData.weather[0]?.main || 'Clear';
    const feelsLike = weatherData.main.feels_like; // Trust imperial units from API
    const windSpeedMph = weatherData.wind.speed;
    const clouds = weatherData.clouds.all;
    const visibility = weatherData.visibility;
    const humidity = weatherData.main.humidity;

    // Determine day/night
    const currentTimeUTC = weatherData.dt;
    const sunriseUTC = weatherData.sys.sunrise;
    const sunsetUTC = weatherData.sys.sunset;
    const isNightTime = !(sunriseUTC && sunsetUTC && currentTimeUTC > sunriseUTC && currentTimeUTC < sunsetUTC);

    // Calculate Local Hour
    const localDate = new Date((weatherData.dt + weatherData.timezone) * 1000);
    const localHour = localDate.getUTCHours();
    const isLateNight = localHour < 6 || localHour >= 23;
    const isEarlyMorning = localHour >= 6 && localHour < 9;
    const isEvening = localHour >= 17 && localHour < 23;

    // --- Categorize Weather Conditions ---
    const isPrecipitating = conditionId && [2, 3, 5, 6].includes(Math.floor(conditionId / 100));
    const isHeavyPrecip = conditionId && [
        202, 212, 221, 232, // Heavy thunderstorm
        502, 503, 504, 522, 531, // Heavy rain
        602, 622 // Heavy snow
    ].includes(conditionId);
    const isLightPrecip = isPrecipitating && !isHeavyPrecip;
    const isThunderstorm = Math.floor(conditionId / 100) === 2;
    const isSnowing = Math.floor(conditionId / 100) === 6;
    
    // Temperature categories
    const isExtremeCold = feelsLike < TEMP_FREEZING;
    const isCold = feelsLike >= TEMP_FREEZING && feelsLike < TEMP_COLD;
    const isCool = feelsLike >= TEMP_COLD && feelsLike < TEMP_COOL;
    const isMild = feelsLike >= TEMP_MILD_LOW && feelsLike <= TEMP_MILD_HIGH;
    const isWarm = feelsLike > TEMP_MILD_HIGH && feelsLike <= TEMP_WARM;
    const isHot = feelsLike > TEMP_WARM && feelsLike <= TEMP_HOT;
    const isExtremeHot = feelsLike > TEMP_HOT;
    
    // Wind categories
    const isCalm = windSpeedMph < WIND_CALM_MPH;
    const isBreezy = windSpeedMph >= WIND_CALM_MPH && windSpeedMph < WIND_BREEZY_MPH;
    const isWindy = windSpeedMph >= WIND_BREEZY_MPH && windSpeedMph < WIND_WINDY_MPH;
    const isVeryWindy = windSpeedMph >= WIND_WINDY_MPH;

    // --- Determine Place Characteristics ---
    const placeTypes = place.types || [];
    const placeName = place.displayName?.text || 'Unknown Place';
    const hasOutdoorSeating = (place as any).outdoorSeating === true;
    
    // More granular place categorization
    const isStrictlyIndoor = placeTypes.some(t => INDOOR_HEAVY_TYPES.has(t)) && 
                             !placeTypes.some(t => OUTDOOR_HEAVY_TYPES.has(t));
    const isStrictlyOutdoor = placeTypes.some(t => OUTDOOR_HEAVY_TYPES.has(t)) && 
                              !placeTypes.some(t => INDOOR_HEAVY_TYPES.has(t));
    const isMixedVenue = !isStrictlyIndoor && !isStrictlyOutdoor;
    
    const isFoodDrink = placeTypes.some(t => ['restaurant', 'cafe', 'bar', 'bakery', 'food_court', 'meal_takeaway'].includes(t));
    const isActiveOutdoor = placeTypes.some(t => ['hiking_area', 'playground', 'golf_course', 'stadium', 'amusement_park'].includes(t));
    const isRelaxedOutdoor = placeTypes.some(t => ['park', 'garden', 'plaza', 'picnic_ground', 'beach'].includes(t));
    const isNightlife = placeTypes.some(t => ['bar', 'night_club', 'casino'].includes(t));
    const isConvenience = placeTypes.some(t => ['convenience_store', 'supermarket', 'liquor_store'].includes(t));
    const isWeatherRefuge = placeTypes.some(t => WEATHER_REFUGE_TYPES.has(t));
    const isLateNightFriendly = placeTypes.some(t => LATE_NIGHT_FRIENDLY.has(t));
    
    // --- Apply Scoring Logic ---
    
    // 1. Weather-Activity Match Bonuses
    if (isPrecipitating) {
        if (isStrictlyIndoor || isWeatherRefuge) {
            adjustScore(25, `Indoor venue during ${isHeavyPrecip ? 'heavy' : 'light'} precipitation`);
            if (isHeavyPrecip) adjustScore(10, 'Extra bonus for heavy precipitation refuge');
            if (isThunderstorm) adjustScore(5, 'Safe from thunderstorm');
        } else if (isStrictlyOutdoor) {
            adjustScore(-30, `Outdoor venue during precipitation`);
            if (isHeavyPrecip) adjustScore(-15, 'Heavy precipitation penalty');
            if (isThunderstorm) adjustScore(-10, 'Thunderstorm danger');
        } else if (isFoodDrink && !hasOutdoorSeating) {
            adjustScore(15, 'Indoor dining during rain');
        } else if (hasOutdoorSeating && isMixedVenue) {
            adjustScore(-10, 'Outdoor seating unusable in rain');
        }
    } else {
        // No precipitation scenarios
        if (isMild && isCalm && !isNightTime) {
            // Perfect outdoor weather
            if (isStrictlyOutdoor) adjustScore(30, 'Outdoor venue in perfect weather');
            if (hasOutdoorSeating) adjustScore(20, 'Outdoor seating in perfect weather');
            if (isRelaxedOutdoor) adjustScore(10, 'Park/garden in ideal conditions');
            if (isStrictlyIndoor && !placeTypes.some(t => ['museum', 'art_gallery'].includes(t))) {
                adjustScore(-10, 'Missing out on perfect weather');
            }
        } else if ((isCool || isWarm) && !isVeryWindy && !isNightTime) {
            // Good outdoor weather
            if (isStrictlyOutdoor) adjustScore(20, 'Outdoor venue in good weather');
            if (hasOutdoorSeating) adjustScore(15, 'Outdoor seating available');
            if (isActiveOutdoor && isCool) adjustScore(10, 'Cool weather ideal for active outdoor');
        } else if (conditionId === 800 && !isNightTime) {
            // Clear sky bonus
            if (isStrictlyOutdoor) adjustScore(5, 'Clear sky bonus');
            if (placeTypes.includes('beach') || placeTypes.includes('pool')) {
                adjustScore(10, 'Beach/pool on clear day');
            }
        }
    }
    
    // 2. Temperature-based adjustments
    if (isExtremeCold || isExtremeHot) {
        if (isStrictlyIndoor || isWeatherRefuge) {
            adjustScore(20, `Indoor refuge from extreme ${isExtremeCold ? 'cold' : 'heat'}`);
        }
        if (isStrictlyOutdoor) {
            adjustScore(-25, `Outdoor in extreme ${isExtremeCold ? 'cold' : 'heat'}`);
        }
        if (hasOutdoorSeating) {
            adjustScore(-15, 'Outdoor seating in extreme temperature');
        }
    } else if (isHot) {
        if (placeTypes.includes('ice_cream_shop')) adjustScore(15, 'Ice cream on hot day!');
        if (placeTypes.includes('swimming_pool') || placeTypes.includes('beach')) {
            adjustScore(20, 'Water activity in hot weather');
        }
        if (isActiveOutdoor) adjustScore(-15, 'Too hot for strenuous activity');
        if (placeTypes.includes('shopping_mall') || placeTypes.includes('movie_theater')) {
            adjustScore(10, 'Air conditioning refuge');
        }
    } else if (isCold) {
        if (placeTypes.includes('cafe') || placeTypes.includes('bakery')) {
            adjustScore(10, 'Warm drinks/food in cold weather');
        }
        if (placeTypes.includes('spa')) adjustScore(15, 'Spa in cold weather');
        if (isRelaxedOutdoor) adjustScore(-10, 'Outdoor relaxation too cold');
        if (isActiveOutdoor && !isSnowing) adjustScore(5, 'Activity keeps you warm');
    }
    
    // 3. Wind adjustments
    if (isVeryWindy) {
        if (isStrictlyOutdoor) adjustScore(-20, 'Very windy outdoor conditions');
        if (hasOutdoorSeating) adjustScore(-15, 'Outdoor seating in high wind');
        if (isStrictlyIndoor) adjustScore(10, 'Sheltered from wind');
        if (placeTypes.includes('golf_course')) adjustScore(-10, 'Golf in high wind');
    } else if (isWindy) {
        if (placeTypes.includes('beach')) adjustScore(-10, 'Beach in windy conditions');
        if (hasOutdoorSeating) adjustScore(-5, 'Outdoor seating less pleasant');
    }
    
    // 4. Visibility adjustments
    if (visibility < VISIBILITY_POOR) {
        if (placeTypes.includes('tourist_attraction') || placeTypes.includes('viewpoint')) {
            adjustScore(-20, 'Poor visibility for sightseeing');
        }
        if (isStrictlyIndoor) adjustScore(5, 'Visibility irrelevant indoors');
        if (placeTypes.includes('hiking_area')) adjustScore(-15, 'Dangerous hiking conditions');
    }
    
    // 5. Time-based adjustments (more nuanced)
    if (isLateNight) {
        if (isLateNightFriendly) {
            adjustScore(15, 'Venue suited for late night');
            if (isNightlife) adjustScore(10, 'Peak nightlife hours');
        } else if (placeTypes.some(t => ['museum', 'library', 'zoo', 'park', 'playground', 
                                        'golf_course', 'hiking_area', 'garden'].includes(t))) {
            adjustScore(-40, 'Definitely closed at this hour');
        } else if (isFoodDrink && !isNightlife) {
            adjustScore(-15, 'Most restaurants closing/closed');
        } else {
            adjustScore(-20, 'Likely closed late night');
        }
    } else if (isEarlyMorning) {
        if (placeTypes.includes('cafe') || placeTypes.includes('bakery')) {
            adjustScore(10, 'Morning coffee/breakfast spot');
        }
        if (isNightlife) adjustScore(-25, 'Closed after late night');
        if (placeTypes.includes('park') || placeTypes.includes('hiking_area')) {
            adjustScore(5, 'Morning outdoor activity');
        }
    } else if (isEvening) {
        if (isFoodDrink || isNightlife) adjustScore(5, 'Peak dining/entertainment time');
        if (isActiveOutdoor && isNightTime) adjustScore(-15, 'Too dark for outdoor activity');
    }
    
    // 6. Special condition bonuses
    if (isSnowing) {
        if (placeTypes.includes('ski_resort') || placeTypes.includes('skating_rink')) {
            adjustScore(25, 'Perfect for winter sports!');
        }
        if (placeTypes.includes('cafe') || placeTypes.includes('library')) {
            adjustScore(10, 'Cozy indoor spot during snow');
        }
    }
    
    if (clouds > CLOUDS_OVERCAST && !isPrecipitating) {
        if (placeTypes.includes('museum') || placeTypes.includes('movie_theater') || 
            placeTypes.includes('shopping_mall')) {
            adjustScore(5, 'Indoor activity on cloudy day');
        }
    }
    
    // 7. Humidity adjustment
    if (humidity > HUMIDITY_HIGH && feelsLike > TEMP_WARM) {
        if (isStrictlyIndoor && !placeTypes.includes('gym')) {
            adjustScore(5, 'Escape from humid conditions');
        }
        if (isActiveOutdoor) adjustScore(-10, 'Strenuous activity in humidity');
        if (placeTypes.includes('swimming_pool') || placeTypes.includes('beach')) {
            adjustScore(5, 'Water activity in humidity');
        }
    }
    
    // 8. Combined condition penalties
    if (isPrecipitating && isVeryWindy) {
        if (isStrictlyOutdoor) adjustScore(-10, 'Storm conditions');
        if (isWeatherRefuge) adjustScore(10, 'Safe haven from storm');
    }
    
    // --- Ensure score stays within bounds ---
    score = Math.max(0, Math.min(100, Math.round(score)));
    
    // Debug logging
    if (debug) {
        console.log(`[Scoring] ${placeName}`);
        console.log(`  Weather: ${weatherMain}, ${feelsLike.toFixed(1)}°F feels like, ${windSpeedMph.toFixed(1)}mph wind`);
        console.log(`  Time: ${isLateNight ? 'Late Night' : isEarlyMorning ? 'Early Morning' : isEvening ? 'Evening' : 'Day'}`);
        console.log(`  Place Type: ${isStrictlyIndoor ? 'Indoor' : isStrictlyOutdoor ? 'Outdoor' : 'Mixed'}`);
        console.log(`  Base Score: 70`);
        scoreAdjustments.forEach(adj => console.log(`  ${adj}`));
        console.log(`  Final Score: ${score}`);
    }
    
    return score;
}

// Export the constants for use in other files if needed
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