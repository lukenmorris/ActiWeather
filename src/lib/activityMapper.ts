// src/lib/activityMapper.ts

// Re-import or define your WeatherData interface if not globally available
interface WeatherData {
  weather: { id: number; main: string; description: string; icon: string; }[];
  main: { temp: number; /* ... other fields */ };
  // Add other fields used for mapping
}

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
// Reference: https://developers.google.com/maps/documentation/places/web-service/place-types
// Note: Use types from "Table 1" for Nearby Search (GET endpoint)
const categoryToPlaceTypes: Record<ActivityCategory, string[]> = {
  [ActivityCategory.OUTDOOR_ACTIVE]: ['park', 'hiking_area', 'gym', 'tourist_attraction'], // Added gym, tourist_attraction might fit
  [ActivityCategory.OUTDOOR_RELAX]: ['park', 'tourist_attraction', 'zoo', 'amusement_park'], // Beaches are not a type, often part of parks or need keyword search
  [ActivityCategory.INDOOR_ACTIVE]: ['gym', 'bowling_alley', 'museum', 'aquarium'],
  [ActivityCategory.INDOOR_RELAX]: ['movie_theater', 'library', 'cafe', 'spa', 'art_gallery'],
  [ActivityCategory.FOOD_DRINK]: ['restaurant', 'cafe', 'bar', 'meal_takeaway', 'bakery'],
  [ActivityCategory.SHOPPING]: ['shopping_mall', 'store', 'book_store', 'clothing_store', 'department_store', 'electronics_store', 'furniture_store', 'hardware_store', 'home_goods_store', 'jewelry_store', 'shoe_store'],
  [ActivityCategory.CULTURE_ENTERTAINMENT]: ['museum', 'art_gallery', 'library', 'movie_theater', 'aquarium', 'zoo', 'tourist_attraction', 'casino', 'night_club'],
};

// Function to get suitable categories based on weather
export const getSuitableCategories = (weatherData: WeatherData | null): ActivityCategory[] => {
  if (!weatherData) return [];

  const weatherMain = weatherData.weather[0]?.main.toLowerCase();
  const temp = weatherData.main.temp; // Assuming Celsius from earlier setup

  const suitable: Set<ActivityCategory> = new Set();

  // Basic logic - refine this considerably!
  if (weatherMain === 'clear' || weatherMain === 'clouds') {
    if (temp >= 15 && temp <= 30) { // Pleasant weather
      suitable.add(ActivityCategory.OUTDOOR_ACTIVE);
      suitable.add(ActivityCategory.OUTDOOR_RELAX);
      suitable.add(ActivityCategory.FOOD_DRINK); // Outdoor seating? (Places API has limited info on this)
      suitable.add(ActivityCategory.SHOPPING);
      suitable.add(ActivityCategory.CULTURE_ENTERTAINMENT);
    } else if (temp > 30) { // Hot
      suitable.add(ActivityCategory.INDOOR_RELAX);
      suitable.add(ActivityCategory.INDOOR_ACTIVE);
      suitable.add(ActivityCategory.FOOD_DRINK);
      suitable.add(ActivityCategory.SHOPPING);
      suitable.add(ActivityCategory.CULTURE_ENTERTAINMENT);
    } else { // Cold (< 15)
      suitable.add(ActivityCategory.INDOOR_ACTIVE);
      suitable.add(ActivityCategory.INDOOR_RELAX);
      suitable.add(ActivityCategory.FOOD_DRINK);
      suitable.add(ActivityCategory.SHOPPING);
      suitable.add(ActivityCategory.CULTURE_ENTERTAINMENT);
      // Maybe limited outdoor if not too cold?
      if (temp >= 5) suitable.add(ActivityCategory.OUTDOOR_ACTIVE);
    }
  } else if (weatherMain === 'rain' || weatherMain === 'drizzle' || weatherMain === 'thunderstorm' || weatherMain === 'snow') {
    // Wet/Snowy weather - prioritize indoors
    suitable.add(ActivityCategory.INDOOR_ACTIVE);
    suitable.add(ActivityCategory.INDOOR_RELAX);
    suitable.add(ActivityCategory.FOOD_DRINK);
    suitable.add(ActivityCategory.SHOPPING);
    suitable.add(ActivityCategory.CULTURE_ENTERTAINMENT);
  } else { // Atmosphere (fog, mist etc.) - potentially indoor/outdoor depending on severity
    suitable.add(ActivityCategory.INDOOR_ACTIVE);
    suitable.add(ActivityCategory.INDOOR_RELAX);
    suitable.add(ActivityCategory.FOOD_DRINK);
    suitable.add(ActivityCategory.SHOPPING);
    suitable.add(ActivityCategory.CULTURE_ENTERTAINMENT);
    if (temp >= 10) suitable.add(ActivityCategory.OUTDOOR_RELAX); // e.g., a gentle walk in fog?
  }

  return Array.from(suitable);
};

// Function to get Google Place Types for a given category
export const getPlaceTypesForCategory = (category: ActivityCategory): string[] => {
  return categoryToPlaceTypes[category] || [];
};