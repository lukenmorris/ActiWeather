// src/lib/geoUtils.ts

/**
 * Calculates the great-circle distance between two points
 * on the Earth (specified in decimal degrees) using the Haversine formula.
 *
 * @param lat1 Latitude of the first point.
 * @param lon1 Longitude of the first point.
 * @param lat2 Latitude of the second point.
 * @param lon2 Longitude of the second point.
 * @returns The distance in kilometers.
 */

import type { GooglePlace, WeatherData } from '@/types'; // Import necessary types


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
   * @returns Formatted string (e.g., "5.2 km", "750 m").
   */
  export function formatDistance(distanceInKm: number): string {
      if (isNaN(distanceInKm) || distanceInKm < 0) {
          return 'N/A';
      }
      if (distanceInKm < 1) {
          return `${(distanceInKm * 1000).toFixed(0)} m`;
      }
      return `${distanceInKm.toFixed(1)} km`;
  }

// --- Constants for Weather Suitability ---
const SUITABILITY_SCORE_SCALE = 100; // Score range 0-100
const BASE_SCORE = 50;

// Weather Thresholds (Adjust these based on desired sensitivity)
const TEMP_FREEZING = 0;
const TEMP_COLD = 8;
const TEMP_COOL = 16;
const TEMP_MILD_LOW = 18;
const TEMP_MILD_HIGH = 26;
const TEMP_WARM = 29;
const TEMP_HOT = 33;
const WIND_CALM = 3; // m/s
const WIND_BREEZY = 7; // m/s
const WIND_WINDY = 11; // m/s (Approx 25 mph / 40 kph)
const CLOUDS_OVERCAST = 80; // %
const VISIBILITY_POOR = 1000; // meters
const HUMIDITY_HIGH = 75; // %

// Place Type Classifications (Expand/Refine!)
const INDOOR_HEAVY_TYPES = new Set([
    'museum', 'movie_theater', 'library', 'aquarium', 'shopping_mall', 'gym',
    'bowling_alley', 'spa', 'art_gallery', 'performing_arts_theater',
    'casino', 'beauty_salon', 'hair_care', 'nail_salon'
    // Add more distinctly indoor types
]);

const OUTDOOR_HEAVY_TYPES = new Set([
    'park', 'hiking_area', 'campground', 'zoo', 'amusement_park', 'stadium',
    'golf_course', 'playground', 'garden', 'picnic_ground', 'marina'
    // Add more distinctly outdoor types
    // 'beach' would go here if identified by keyword/AI later
]);

// Types that can often be both or depend heavily on specific venue
const MIXED_ADAPTABLE_TYPES = new Set([
    'restaurant', 'cafe', 'bar', 'tourist_attraction', // Can have indoor/outdoor areas
    // Other types might fall here depending on typical setup
]);


/**
 * Calculates a more detailed weather suitability score for a place.
 * Higher score (0-100) means more suitable for the current weather.
 * @param place The GooglePlace object (potentially including details like outdoorSeating)
 * @param weatherData The current weather data
 * @returns A numerical score between 0 and 100.
 */
export function calculateWeatherSuitability(
    place: GooglePlace | (GooglePlace & { distance?: number }), // Accept place object
    weatherData: WeatherData | null
): number {
    let score = BASE_SCORE;
    // Return base score if essential data is missing
    if (!weatherData || !place?.types) return score;

    // --- Extract Weather Parameters ---
    const conditionId = weatherData.weather[0]?.id ?? 800; // Default to clear if missing
    const feelsLike = weatherData.main.feels_like;
    const windSpeed = weatherData.wind.speed;
    const clouds = weatherData.clouds.all;
    const visibility = weatherData.visibility;
    const humidity = weatherData.main.humidity;
    const isDay = weatherData.dt > weatherData.sys.sunrise && weatherData.dt < weatherData.sys.sunset;

    // --- Determine Weather Regime ---
    let regime: 'PERFECT' | 'GOOD' | 'POOR' | 'NEUTRAL' = 'NEUTRAL';

    // Precipitation check (OWM IDs: 2xx=Thunder, 3xx=Drizzle, 5xx=Rain, 6xx=Snow)
    const isPrecipitating = [2, 3, 5, 6].includes(Math.floor(conditionId / 100));
    const isLightPrecipitation = [300, 301, 500, 520, 600, 615, 620].includes(conditionId); // Examples

    if (isPrecipitating && !isLightPrecipitation) {
        regime = 'POOR'; // Heavy precipitation is generally poor for most outdoor
    } else if (feelsLike < TEMP_FREEZING || feelsLike > TEMP_HOT || windSpeed > WIND_WINDY || visibility < VISIBILITY_POOR) {
        regime = 'POOR'; // Extreme cold/heat, very windy, or very poor visibility
    } else if (!isPrecipitating && feelsLike >= TEMP_MILD_LOW && feelsLike <= TEMP_MILD_HIGH && windSpeed < WIND_CALM && (conditionId === 800 || conditionId === 801)) {
        regime = 'PERFECT'; // Clear/few clouds, mild temp, calm wind
    } else if (!isPrecipitating && feelsLike >= TEMP_COOL && feelsLike <= TEMP_WARM && windSpeed < WIND_BREEZY) {
         regime = 'GOOD'; // Decent temps, not precipitating, not too windy
    } else if (isLightPrecipitation && feelsLike > TEMP_COLD) {
         regime = 'NEUTRAL'; // Light rain might be okay for some things if not cold
    }
    // Note: More conditions could define 'GOOD' or 'POOR'

    // --- Determine Place Leaning ---
    const placeTypes = place.types || [];
    let leaning: 'INDOOR' | 'OUTDOOR' | 'MIXED' = 'MIXED'; // Default to mixed
    if (placeTypes.some(t => INDOOR_HEAVY_TYPES.has(t))) {
        leaning = 'INDOOR';
    }
    // Check outdoor *after* indoor, allowing places with both types (like a museum in a park) to lean indoor if specified
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
            if (leaning === 'INDOOR') modifier(-20);
            if (hasOutdoorSeating) modifier(15);
            // Bonus for clear sky?
            if (conditionId === 800) modifier(5);
            break;

        case 'GOOD':
            if (leaning === 'OUTDOOR') modifier(20);
            if (leaning === 'MIXED') modifier(10);
            if (leaning === 'INDOOR') modifier(-5);
            if (hasOutdoorSeating) modifier(10);
            break;

        case 'POOR':
            if (leaning === 'OUTDOOR') modifier(-40);
            if (leaning === 'MIXED') modifier(-25); // Penalize adaptable places too
            if (hasOutdoorSeating) modifier(-20); // Having outdoor seating is bad in poor weather
            if (leaning === 'INDOOR') modifier(35);

            // Extra penalties for specific poor conditions
            if (isPrecipitating && !isLightPrecipitation) modifier(-10); // Heavy precip
            if (windSpeed > WIND_WINDY) modifier(-10); // Very windy
            if (feelsLike < TEMP_FREEZING || feelsLike > TEMP_HOT) modifier(-10); // Extreme temps
            if (visibility < VISIBILITY_POOR) modifier(-10); // Low visibility
            break;

        case 'NEUTRAL':
            // Less strong adjustments for neutral weather
            if (leaning === 'OUTDOOR') modifier(5);
            if (leaning === 'MIXED') modifier(5);
            if (leaning === 'INDOOR') modifier(5); // Indoor is always fine
            if (hasOutdoorSeating) modifier(5); // Slight bonus for options
            // Penalize if very overcast?
            if (clouds > CLOUDS_OVERCAST) modifier(-5);
             // Penalize if humid and warm?
             if (humidity > HUMIDITY_HIGH && feelsLike > TEMP_WARM) modifier(-5);
            break;
    }

    // --- Clamp Score ---
    score = Math.max(0, Math.min(SUITABILITY_SCORE_SCALE, Math.round(score)));

    // --- DEBUG LOG ---
    // console.log(`Place: ${place.displayName?.text}, Types: ${place.types?.join(',')}, Leaning: ${leaning}, HasOutdoor: ${hasOutdoorSeating}, WeatherRegime: ${regime}, Score: ${score}`);

    return score;
}