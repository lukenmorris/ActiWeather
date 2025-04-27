// src/lib/activityMapper.ts
import type { WeatherData } from '@/types'; // Ensure WeatherData type is imported

// ActivityCategory enum remains the same
export enum ActivityCategory {
    OUTDOOR_ACTIVE = 'Outdoor Active',
    OUTDOOR_RELAX = 'Outdoor Relax',
    INDOOR_ACTIVE = 'Indoor Active',
    INDOOR_RELAX = 'Indoor Relax',
    FOOD_DRINK = 'Food & Drink',
    SHOPPING = 'Shopping',
    CULTURE_ENTERTAINMENT = 'Culture & Entertainment',
}

// categoryToPlaceTypes map remains the same
const categoryToPlaceTypes: Record<ActivityCategory, string[]> = {
  [ActivityCategory.OUTDOOR_ACTIVE]: [
      'park',
      'hiking_area',      // Specific type for hiking
      'tourist_attraction', // Can include viewpoints, landmarks suitable for activity
      'stadium',          // For attending sports events
      'playground',       // Relevant for users with children
      'golf_course',      // Specific activity
      // 'gym' was removed - better fit for indoor? Or add back if outdoor gyms are common?
      // Consider adding 'beach' as a KEYWORD search later if needed, as it's not a type.
  ],
  [ActivityCategory.OUTDOOR_RELAX]: [
      'park',
      'tourist_attraction',
      'zoo',
      'amusement_park',
      'garden',           // More specific than park sometimes
      'picnic_ground',    // Specific area for relaxing/eating
      'plaza',            // Public squares
      'marina',           // Walking around boats/waterfront
      'campground',       // For overnight stays, but also daytime relaxation?
  ],
  [ActivityCategory.INDOOR_ACTIVE]: [
      'gym',
      'bowling_alley',
      'amusement_center', // Arcades, indoor play areas?
      'skating_rink',     // Ice or roller skating
      // 'pool' isn't a specific type, often part of 'gym' or 'lodging'
      // 'climbing_gym' isn't a type, likely needs keyword search or is under 'gym'/'sports_club'
      // 'sports_club' isn't a Table A type, cannot be used for filtering here.
  ],
  [ActivityCategory.INDOOR_RELAX]: [
      'movie_theater',
      'library',
      'cafe',             // Relaxing with coffee/snack
      'spa',
      'art_gallery',
      'museum',
      'book_store',       // Browse books can be relaxing
      'beauty_salon',     // Pampering activities
      'hair_care',        // Pampering activities
      'nail_salon',       // Pampering activities
      'aquarium',         // Moved from INDOOR_ACTIVE, usually more relaxed viewing
  ],
  [ActivityCategory.FOOD_DRINK]: [
      'restaurant',
      'cafe',
      'bar',
      'meal_takeaway',    // For grabbing food to eat elsewhere (e.g., picnic)
      'bakery',
      'food_court',
      'ice_cream_shop',
      // Add specific restaurant types if desired, but broad 'restaurant' covers most.
      // 'liquor_store', 'supermarket' - Included under SHOPPING instead? User choice.
  ],
  [ActivityCategory.SHOPPING]: [
      'shopping_mall',
      'book_store',
      'clothing_store',
      'department_store',
      'electronics_store', // Recreational Browse?
      'furniture_store',  // Browse? Less of an 'activity' maybe.
      'home_goods_store', // Browse?
      'jewelry_store',
      'shoe_store',
      'pet_store',        // Often visited for fun even without buying
      'convenience_store',// Less likely an 'activity', maybe remove?
      'supermarket',      // Useful for picnic supplies etc.
      'liquor_store',
      // Removed 'store' (too generic), 'hardware_store' (utility)
  ],
  [ActivityCategory.CULTURE_ENTERTAINMENT]: [
      'museum',
      'art_gallery',
      'library',
      'movie_theater',
      'aquarium',
      'zoo',
      'tourist_attraction', // Viewpoints, historical sites etc.
      'casino',
      'night_club',
      'performing_arts_theater',
      'amusement_park',   // Overlaps with OUTDOOR_RELAX but fits here too
      'stadium',          // Attending events
      'convention_center',// Attending events/shows
      // 'concert_hall', 'opera_house' - Not distinct Table A types, likely fall under performing_arts_theater or tourist_attraction
  ],
};


// **REVISED** Function to get suitable categories based on weather
export const getSuitableCategories = (weatherData: WeatherData | null): ActivityCategory[] => {
  if (!weatherData) return [];

  const mainCondition = weatherData.weather[0]?.main.toLowerCase();
  const conditionId = weatherData.weather[0]?.id; // Specific condition code (e.g., 800=clear, 501=moderate rain)
  const temp = weatherData.main.temp; // Actual temperature (Celsius assumed)
  const feelsLike = weatherData.main.feels_like; // 'Feels like' temperature
  const windSpeed = weatherData.wind.speed; // meters/second assumed
  const clouds = weatherData.clouds.all; // Cloudiness percentage

  const suitable: Set<ActivityCategory> = new Set();

  // --- Define Weather Thresholds (Adjust these!) ---
  const TEMP_COLD = 5;
  const TEMP_COOL = 15;
  const TEMP_WARM = 25;
  const TEMP_HOT = 30;
  const WIND_HIGH = 10; // m/s (approx 22 mph / 36 kph)

  // --- Always Suitable (Generally) ---
  suitable.add(ActivityCategory.FOOD_DRINK);
  suitable.add(ActivityCategory.SHOPPING);
  suitable.add(ActivityCategory.CULTURE_ENTERTAINMENT); // Mostly indoors
  suitable.add(ActivityCategory.INDOOR_RELAX);
  suitable.add(ActivityCategory.INDOOR_ACTIVE); // Like gyms

  // --- Condition-Specific Logic ---

  // 1. Precipitation Check (Rain, Snow, Drizzle, Thunderstorm)
  // OWM IDs: 2xx (Thunderstorm), 3xx (Drizzle), 5xx (Rain), 6xx (Snow)
  const isPrecipitating = conditionId && [2, 3, 5, 6].includes(Math.floor(conditionId / 100));

  if (isPrecipitating) {
      // Heavy precipitation generally discourages outdoor activities
      // Keep only the 'Always Suitable' indoor categories added above.
      // We could add logic here for *light* rain/snow if desired.
  } else {
      // 2. No Precipitation - Consider Temp, Wind, Condition
      const isWindy = windSpeed > WIND_HIGH;

      // Outdoor Active
      if (!isWindy && feelsLike >= TEMP_COOL && feelsLike <= TEMP_HOT) {
           // Good temperature range, not too windy
           suitable.add(ActivityCategory.OUTDOOR_ACTIVE);
      } else if (!isWindy && feelsLike > TEMP_HOT && conditionId === 800) {
          // Hot but clear, maybe early/late activity or water related? Still add.
          suitable.add(ActivityCategory.OUTDOOR_ACTIVE); // Requires user caution
      } else if (feelsLike >= TEMP_COLD && feelsLike < TEMP_COOL && !isWindy) {
          // Cool but not freezing, okay for some activity if sunny/calm
           if (conditionId === 800 || clouds < 50) { // Clear or partly cloudy
              suitable.add(ActivityCategory.OUTDOOR_ACTIVE);
           }
      }

       // Outdoor Relax
      if (!isWindy && feelsLike >= TEMP_COOL && feelsLike <= TEMP_WARM) {
           // Pleasant temperature range, not windy
           suitable.add(ActivityCategory.OUTDOOR_RELAX);
      } else if (feelsLike > TEMP_WARM && feelsLike <= TEMP_HOT && (conditionId === 800 || clouds < 75)) {
           // Warm/Hot, okay if not excessively cloudy or windy
           suitable.add(ActivityCategory.OUTDOOR_RELAX);
      } else if (feelsLike >= TEMP_COLD && feelsLike < TEMP_COOL && !isWindy && conditionId === 800) {
           // Cool but sunny and calm might be nice for a short sit outside
           suitable.add(ActivityCategory.OUTDOOR_RELAX);
      }

      // Extreme Conditions Adjustments (Example)
      // OWM IDs: 7xx (Atmosphere like fog, dust), 800 (Clear), 80x (Clouds)
      if (conditionId && Math.floor(conditionId / 100) === 7) { // Fog, Mist, Haze etc.
           // Maybe remove Outdoor Active if visibility is very low? (Need visibility data)
           // Visibility is in weatherData.visibility (in meters)
           if (weatherData.visibility < 1000) { // Less than 1km visibility
               suitable.delete(ActivityCategory.OUTDOOR_ACTIVE);
           }
      }
       if (feelsLike > 35 || feelsLike < 0) { // Extreme feelsLike temps
           suitable.delete(ActivityCategory.OUTDOOR_ACTIVE);
           suitable.delete(ActivityCategory.OUTDOOR_RELAX);
       }
  }

  // --- Final Adjustments (Could add user prefs later) ---

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