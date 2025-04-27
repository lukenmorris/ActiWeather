// src/lib/geoUtils.ts
import type { GooglePlace, WeatherData } from '@/types'; // Import necessary types

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
const SUITABILITY_SCORE_SCALE = 100; // Score range 0-100
const BASE_SCORE = 50;

// Weather Thresholds in Fahrenheit & mph
const TEMP_FREEZING = 32;
const TEMP_COLD = 46;
const TEMP_COOL = 61;
const TEMP_MILD_LOW = 64;
const TEMP_MILD_HIGH = 79;
const TEMP_WARM = 84;
const TEMP_HOT = 91;

const WIND_CALM_MPH = 7;
const WIND_BREEZY_MPH = 16;
const WIND_WINDY_MPH = 25;

const CLOUDS_OVERCAST = 80; // %
const VISIBILITY_POOR = 1000; // meters (visibility typically still reported in meters)
const HUMIDITY_HIGH = 75; // %

// Helper function to convert Celsius to Fahrenheit if needed
function ensureFahrenheit(temp: number, weatherData: WeatherData): number {
  // Simple heuristic: if temp is low, it's likely Celsius
  const isLikelyCelsius = temp < 50;
  if (isLikelyCelsius) {
    return (temp * 9/5) + 32;
  }
  return temp;
}

// Helper function to convert m/s to mph if needed
function ensureMph(speed: number, weatherData: WeatherData): number {
  // Simple heuristic: if wind speed is low, it's likely m/s
  const isLikelyMS = speed < 10;
  if (isLikelyMS) {
    return speed * 2.237; // Convert m/s to mph
  }
  return speed;
}

// Place Type Classifications (can be shared or kept here)
const INDOOR_HEAVY_TYPES = new Set([
    'museum', 'movie_theater', 'library', 'aquarium', 'shopping_mall', 'gym',
    'bowling_alley', 'spa', 'art_gallery', 'performing_arts_theater',
    'casino', 'beauty_salon', 'hair_care', 'nail_salon'
]);
const OUTDOOR_HEAVY_TYPES = new Set([
    'park', 'hiking_area', 'campground', 'zoo', 'amusement_park', 'stadium',
    'golf_course', 'playground', 'garden', 'picnic_ground', 'marina'
]);
const MIXED_ADAPTABLE_TYPES = new Set([
    'restaurant', 'cafe', 'bar', 'tourist_attraction',
]);


/**
 * Calculates a detailed weather suitability score for a place.
 * Higher score (0-100) means more suitable for the current weather.
 * @param place The GooglePlace object (potentially including details like outdoorSeating)
 * @param weatherData The current weather data (EXPECTS FAHRENHEIT/MPH)
 * @returns A numerical score between 0 and 100.
 */
export function calculateWeatherSuitability(
    place: GooglePlace | (GooglePlace & { distance?: number }), // Accept place object
    weatherData: WeatherData | null
): number {
    let score = BASE_SCORE;
    if (!weatherData || !place?.types) return score;

    // --- Extract Weather Parameters ---
    const conditionId = weatherData.weather[0]?.id ?? 800; // Default to clear if missing
    
    // Ensure units are in Fahrenheit/mph regardless of what's passed in
    const feelsLike = ensureFahrenheit(weatherData.main.feels_like, weatherData);
    const windSpeedMph = ensureMph(weatherData.wind.speed, weatherData);
    
    const clouds = weatherData.clouds.all;
    const visibility = weatherData.visibility;
    const humidity = weatherData.main.humidity;

    // Determine day/night using sunrise/sunset times
    const currentTimeUTC = weatherData.dt;
    const sunriseUTC = weatherData.sys.sunrise;
    const sunsetUTC = weatherData.sys.sunset;
    const isNightTime = !(sunriseUTC && sunsetUTC && currentTimeUTC > sunriseUTC && currentTimeUTC < sunsetUTC);

    // Calculate Local Hour for potentially more granular logic (optional)
    const localDate = new Date((weatherData.dt + weatherData.timezone) * 1000);
    const localHour = localDate.getUTCHours(); // Hour (0-23) in location's timezone
    const isLateNight = localHour < 6 || localHour >= 23; // Example: Before 6 AM or 11 PM onwards

    // --- Determine Weather Regime ---
    let regime: 'PERFECT' | 'GOOD' | 'POOR' | 'NEUTRAL' = 'NEUTRAL';
    // Precipitation check (OWM IDs: 2xx=Thunder, 3xx=Drizzle, 5xx=Rain, 6xx=Snow)
    const isPrecipitating = conditionId && [2, 3, 5, 6].includes(Math.floor(conditionId / 100));
    const isLightPrecipitation = conditionId && [300, 301, 500, 520, 600, 615, 620].includes(conditionId);

    // Check POOR conditions first (using Fahrenheit and mph)
    if (isPrecipitating && !isLightPrecipitation) {
        regime = 'POOR';
    } else if (feelsLike < TEMP_FREEZING || feelsLike > TEMP_HOT || windSpeedMph > WIND_WINDY_MPH || visibility < VISIBILITY_POOR) {
        regime = 'POOR';
    } else if (!isPrecipitating && feelsLike >= TEMP_MILD_LOW && feelsLike <= TEMP_MILD_HIGH && windSpeedMph < WIND_CALM_MPH && (conditionId === 800 || conditionId === 801)) {
        regime = 'PERFECT'; // Check PERFECT conditions
    } else if (!isPrecipitating && feelsLike >= TEMP_COOL && feelsLike <= TEMP_WARM && windSpeedMph < WIND_BREEZY_MPH) {
         regime = 'GOOD'; // Check GOOD conditions
    } else if (isLightPrecipitation && feelsLike > TEMP_COLD) {
         regime = 'NEUTRAL'; // Light precipitation if not cold is neutral
    }

    // --- Determine Place Leaning ---
    const placeTypes = place.types || [];
    let leaning: 'INDOOR' | 'OUTDOOR' | 'MIXED' = 'MIXED'; // Default to mixed
    if (placeTypes.some(t => INDOOR_HEAVY_TYPES.has(t))) {
        leaning = 'INDOOR';
    }
    // Check outdoor *after* indoor
    if (placeTypes.some(t => OUTDOOR_HEAVY_TYPES.has(t)) && leaning !== 'INDOOR') {
        leaning = 'OUTDOOR';
    }

    // --- Get Optional Details ---
    // Use type assertion assuming details might be merged onto the place object
    const hasOutdoorSeating = (place as any).outdoorSeating === true;
    const lacksOutdoorSeating = (place as any).outdoorSeating === false;


    // --- Apply Score Modifiers ---
    const modifier = (points: number) => score = score + points;

    switch (regime) {
        case 'PERFECT':
            if (leaning === 'OUTDOOR') modifier(35);
            if (leaning === 'MIXED') modifier(20);
            if (leaning === 'INDOOR') modifier(-20); // Penalize indoor on perfect days
            if (hasOutdoorSeating) modifier(15);
            if (conditionId === 800) modifier(5); // Clear sky bonus
            break;

        case 'GOOD':
            if (leaning === 'OUTDOOR') modifier(20);
            if (leaning === 'MIXED') modifier(10);
            if (leaning === 'INDOOR') modifier(-5); // Slight penalty for indoor
            if (hasOutdoorSeating) modifier(10);
            break;

        case 'POOR':
            if (leaning === 'OUTDOOR') modifier(-40);
            if (leaning === 'MIXED') modifier(-25);
            if (hasOutdoorSeating) modifier(-20);
            if (leaning === 'INDOOR') modifier(35);

            // Extra penalties for specific POOR conditions
            if (isPrecipitating && !isLightPrecipitation) modifier(-10); // Heavy precip
            if (windSpeedMph > WIND_WINDY_MPH) modifier(-10); // Very windy
            if (feelsLike < TEMP_FREEZING || feelsLike > TEMP_HOT) modifier(-10); // Extreme temps
            if (visibility < VISIBILITY_POOR) modifier(-10); // Low visibility
            break;

        case 'NEUTRAL':
            if (leaning === 'OUTDOOR') modifier(5);
            if (leaning === 'MIXED') modifier(5);
            if (leaning === 'INDOOR') modifier(5);
            if (hasOutdoorSeating) modifier(5);
            if (clouds > CLOUDS_OVERCAST) modifier(-5); // Penalize heavy overcast
            // Penalize if humid and warm (using F thresholds)
             if (humidity > HUMIDITY_HIGH && feelsLike > TEMP_WARM) modifier(-5);
            break;
    }

    // --- Apply Time-Based Score Modifiers ---
    if (isLateNight) {
        // Penalize types typically closed late
        if (placeTypes.some(t => ['museum', 'library', 'shopping_mall', 'art_gallery', 'zoo', 'amusement_park', 'park', 'hiking_area', 'playground', 'golf_course', 'stadium', 'performing_arts_theater', 'department_store', 'clothing_store', 'book_store', 'spa', 'gym'].includes(t))) {
             modifier(-35); // Heavier penalty
        }
        // Slightly penalize generic restaurants/cafes unless explicitly late-night types
        if (placeTypes.some(t => ['restaurant', 'cafe', 'bakery'].includes(t)) && !placeTypes.some(t => ['bar', 'night_club', 'casino'].includes(t))) {
            modifier(-15);
        }
        // Boost types potentially relevant late?
         if (placeTypes.some(t => ['bar', 'night_club', 'casino', 'convenience_store'].includes(t))) {
             modifier(10); // Stronger boost for late-night options
         }
    } else if (isNightTime) { // Penalize outdoor slightly if it's night but not "late night"
        if (leaning === 'OUTDOOR') modifier(-10);
    }

    // --- Clamp Score ---
    score = Math.max(0, Math.min(SUITABILITY_SCORE_SCALE, Math.round(score)));

    return score;
}