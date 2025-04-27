// src/lib/activityMapper.ts
import type { GooglePlace, WeatherData } from '@/types'; // Import types

// Define broad activity categories
export enum ActivityCategory {
    OUTDOOR_ACTIVE = 'Outdoor Active',
    OUTDOOR_RELAX = 'Outdoor Relax',
    INDOOR_ACTIVE = 'Indoor Active',
    INDOOR_RELAX = 'Indoor Relax',
    FOOD_DRINK = 'Food & Drink',
    SHOPPING = 'Shopping',
    CULTURE_ENTERTAINMENT = 'Culture & Entertainment',
}

// Define which Google Place Types correspond to our categories
// (Using the expanded list, ensure 'gas_station' is removed)
const categoryToPlaceTypes: Record<ActivityCategory, string[]> = {
    [ActivityCategory.OUTDOOR_ACTIVE]: [ 'park', 'hiking_area', 'tourist_attraction', 'stadium', 'playground', 'golf_course' ],
    [ActivityCategory.OUTDOOR_RELAX]: [ 'park', 'tourist_attraction', 'zoo', 'amusement_park', 'garden', 'picnic_ground', 'plaza', 'marina', 'campground' ],
    [ActivityCategory.INDOOR_ACTIVE]: [ 'gym', 'bowling_alley', 'amusement_center', 'skating_rink', 'aquarium' ], // Aquarium maybe relax?
    [ActivityCategory.INDOOR_RELAX]: [ 'movie_theater', 'library', 'cafe', 'spa', 'art_gallery', 'museum', 'book_store', 'beauty_salon', 'hair_care', 'nail_salon' ],
    [ActivityCategory.FOOD_DRINK]: [ 'restaurant', 'cafe', 'bar', 'meal_takeaway', 'bakery', 'food_court', 'ice_cream_shop'],
    [ActivityCategory.SHOPPING]: [ 'shopping_mall', 'book_store', 'clothing_store', 'department_store', 'electronics_store', 'furniture_store', 'home_goods_store', 'jewelry_store', 'shoe_store', 'pet_store', 'convenience_store', 'supermarket', 'liquor_store' ], // User can refine this list
    [ActivityCategory.CULTURE_ENTERTAINMENT]: [ 'museum', 'art_gallery', 'library', 'movie_theater', 'aquarium', 'zoo', 'tourist_attraction', 'casino', 'night_club', 'performing_arts_theater', 'amusement_park', 'stadium', 'convention_center' ],
};

// Define Fahrenheit/MPH thresholds for use within this file
const TEMP_FREEZING_F = 32;
const TEMP_COLD_F = 46;
const TEMP_COOL_F = 61;
const TEMP_MILD_LOW_F = 64;
const TEMP_MILD_HIGH_F = 79;
const TEMP_WARM_F = 84;
const TEMP_HOT_F = 91;
const WIND_HIGH_MPH = 25; // Equivalent to WIND_WINDY_MPH

// Helper function to convert Celsius to Fahrenheit if needed
function ensureFahrenheit(temp: number, weatherData: WeatherData): number {
  // Simple heuristic: if tempMax is low, it's likely Celsius
  const isLikelyCelsius = weatherData.main.temp_max && weatherData.main.temp_max < 50;
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

/**
 * Gets suitable ActivityCategories based on weather and time.
 * Uses Fahrenheit thresholds internally now.
 * @param weatherData Weather data (EXPECTS FAHRENHEIT/MPH)
 * @returns Array of suitable ActivityCategory enums.
 */
export const getSuitableCategories = (weatherData: WeatherData | null): ActivityCategory[] => {
    if (!weatherData) return [];

    const conditionId = weatherData.weather[0]?.id;
    
    // Ensure units are in Fahrenheit/mph regardless of what's passed in
    const feelsLike = ensureFahrenheit(weatherData.main.feels_like, weatherData);
    const windSpeedMph = ensureMph(weatherData.wind.speed, weatherData);
    
    const visibility = weatherData.visibility;
    const currentTimeUTC = weatherData.dt;
    const sunriseUTC = weatherData.sys.sunrise;
    const sunsetUTC = weatherData.sys.sunset;
    const timezoneOffset = weatherData.timezone;

    const isNightTime = !(sunriseUTC && sunsetUTC && currentTimeUTC > sunriseUTC && currentTimeUTC < sunsetUTC);
    const localDate = new Date((currentTimeUTC + timezoneOffset) * 1000);
    const localHour = localDate.getUTCHours();
    const isLateNight = localHour < 6 || localHour >= 23;

    const suitable: Set<ActivityCategory> = new Set();

    // --- Base Categories - Adjust based on time ---
    suitable.add(ActivityCategory.FOOD_DRINK); // Usually relevant
    if (!isLateNight) { // Add these only if NOT late night
        suitable.add(ActivityCategory.SHOPPING);
        suitable.add(ActivityCategory.CULTURE_ENTERTAINMENT);
        suitable.add(ActivityCategory.INDOOR_RELAX);
        suitable.add(ActivityCategory.INDOOR_ACTIVE);
    } else { // If late night, maybe add specific indoor relax/entertainment back?
        suitable.add(ActivityCategory.INDOOR_RELAX); // e.g., cafe?
        suitable.add(ActivityCategory.CULTURE_ENTERTAINMENT); // e.g., casino, night_club
    }


    // --- Weather Condition Logic ---
    const isPrecipitating = conditionId && [2, 3, 5, 6].includes(Math.floor(conditionId / 100));
    const isWindy = windSpeedMph > WIND_HIGH_MPH;

    if (isPrecipitating) {
       // Remove outdoor categories if precipitating
       suitable.delete(ActivityCategory.OUTDOOR_ACTIVE);
       suitable.delete(ActivityCategory.OUTDOOR_RELAX);
    } else if (!isNightTime) { // Only consider adding outdoor if it's daytime and not precipitating
        // Outdoor Active
        if (!isWindy && feelsLike >= TEMP_COOL_F && feelsLike <= TEMP_HOT_F) {
            suitable.add(ActivityCategory.OUTDOOR_ACTIVE);
        } else if (feelsLike >= TEMP_COLD_F && feelsLike < TEMP_COOL_F && !isWindy && conditionId === 800) {
             suitable.add(ActivityCategory.OUTDOOR_ACTIVE); // Cool but clear/calm
        }

         // Outdoor Relax
        if (!isWindy && feelsLike >= TEMP_MILD_LOW_F && feelsLike <= TEMP_WARM_F) {
             suitable.add(ActivityCategory.OUTDOOR_RELAX);
        } else if (feelsLike >= TEMP_COOL_F && feelsLike < TEMP_MILD_LOW_F && !isWindy && conditionId === 800) {
             suitable.add(ActivityCategory.OUTDOOR_RELAX); // Cool but clear/calm
        }
    }

    // --- Final Filtering ---
    // Remove outdoor categories definitively if visibility is poor or temp is extreme
    if (feelsLike < TEMP_FREEZING_F || feelsLike > TEMP_HOT_F) {
         suitable.delete(ActivityCategory.OUTDOOR_ACTIVE);
         suitable.delete(ActivityCategory.OUTDOOR_RELAX);
    }
    // Ensure late night filtering is applied (redundant given initial add logic, but safe)
    if (isLateNight) {
        suitable.delete(ActivityCategory.SHOPPING);
        suitable.delete(ActivityCategory.OUTDOOR_ACTIVE);
        suitable.delete(ActivityCategory.OUTDOOR_RELAX);
        suitable.delete(ActivityCategory.INDOOR_ACTIVE);
        // Re-think if museum/library should be removed from CULTURE/INDOOR_RELAX late night
        // This is handled by scoring now, maybe keep categories broader here?
    }

    return Array.from(suitable);
};

// Function to get Google Place Types for a given category (no change needed here yet)
export const getPlaceTypesForCategory = (category: ActivityCategory): string[] => {
    return categoryToPlaceTypes[category] || [];
};

// Define a potential priority order for categories if a place fits multiple
// (e.g., we might prefer categorizing a cafe/bookstore as FOOD_DRINK over SHOPPING)
// Adjust this order based on your preference.
const categoryPriority: ActivityCategory[] = [
  ActivityCategory.FOOD_DRINK,
  ActivityCategory.CULTURE_ENTERTAINMENT,
  ActivityCategory.INDOOR_ACTIVE,
  ActivityCategory.INDOOR_RELAX,
  ActivityCategory.OUTDOOR_ACTIVE,
  ActivityCategory.OUTDOOR_RELAX,
  ActivityCategory.SHOPPING,
];

/**
* Tries to map a GooglePlace back to one of our ActivityCategory enums.
* Uses the categoryPriority list for tie-breaking.
* @param place The GooglePlace object
* @returns The most relevant ActivityCategory or null if no match found.
*/
export function getCategoryForPlace(place: GooglePlace): ActivityCategory | null {
  if (!place.types || place.types.length === 0) {
      return null; // Cannot categorize without types
  }

  const placeTypesSet = new Set(place.types);
  let bestMatch: ActivityCategory | null = null;
  let bestMatchPriority = categoryPriority.length; // Start with lowest priority

  // Iterate through our defined priority order
  for (const category of categoryPriority) {
      const typesForCategory = categoryToPlaceTypes[category] || [];
      // Check if any of the place's types match this category's types
      if (typesForCategory.some(type => placeTypesSet.has(type))) {
           // Found a match. Is it higher priority than the current best match?
           const currentPriority = categoryPriority.indexOf(category);
           if (currentPriority < bestMatchPriority) {
               bestMatch = category;
               bestMatchPriority = currentPriority;
           }
      }
  }

  return bestMatch;
}

export function getAllMappedPlaceTypes(): string[] {
  const allTypes = new Set<string>();
  Object.values(categoryToPlaceTypes).forEach(typeArray => {
      typeArray.forEach(type => allTypes.add(type));
  });
  return Array.from(allTypes).sort(); // Return sorted array
}