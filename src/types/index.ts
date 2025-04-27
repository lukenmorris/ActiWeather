// Interface for WeatherData (from OpenWeatherMap)
export interface WeatherData {
    coord: { lon: number; lat: number };
    weather: {
      id: number;
      main: string;
      description: string;
      icon: string;
    }[];
    main: {
      temp: number;
      feels_like: number;
      temp_min: number;
      temp_max: number;
      pressure: number;
      humidity: number;
      sea_level?: number;
      grnd_level?: number;
    };
    visibility: number;
    wind: {
      speed: number;
      deg: number;
      gust?: number;
    };
    rain?: {
      '1h'?: number;
      '3h'?: number;
    };
    clouds: {
      all: number;
    };
    dt: number; // Timestamp
    sys: {
      type?: number;
      id?: number;
      country: string;
      sunrise: number;
      sunset: number;
    };
    timezone: number;
    id: number; // City ID
    name: string; // City name
    cod: number;
  }
  
 // Interface for Google Place result using NEW Places API fields
export interface GooglePlace {
    id: string; // The unique place ID
    displayName?: { // Object containing text and language code
      text: string;
      languageCode?: string;
    };
    types?: string[]; // Array of types associated with the place
    location?: { // The latitude/longitude
      latitude: number;
      longitude: number;
    };
    rating?: number; // The place's rating from 1.0 to 5.0
    userRatingCount?: number; // Number of user ratings
    formattedAddress?: string; // The structured address
    // Calculated distance property (added later in ActivityList)
    distance?: number; // In meters or km
  }
  
  // We can also define the Coordinates type here if used often
  export interface Coordinates {
      latitude: number;
      longitude: number;
  }
  