import { WeatherData } from '@/types';
import { WeatherContext } from '@/types/recommendation';

/**
 * Calculates weather severity score (0-1) based on various factors
 * Higher score = more severe/extreme weather
 */
export function calculateWeatherSeverity(weather: WeatherData): number {
  let severity = 0;

  const conditionId = weather.weather[0]?.id || 800;
  const temp = weather.main.temp;
  const windSpeed = weather.wind.speed;
  const humidity = weather.main.humidity;

  // Temperature severity (convert Fahrenheit to Celsius for calculation)
  const tempC = ((temp - 32) * 5) / 9;
  if (tempC <= 0) severity += 0.3; // Freezing
  else if (tempC <= 5) severity += 0.2; // Very cold
  else if (tempC >= 38) severity += 0.3; // Extreme heat
  else if (tempC >= 32) severity += 0.2; // Very hot
  else if (tempC >= 18 && tempC <= 25) severity -= 0.1; // Perfect weather (reduces severity)

  // Weather condition severity based on OpenWeatherMap codes
  if (conditionId >= 200 && conditionId < 300) {
    // Thunderstorm
    severity += 0.4;
  } else if (conditionId >= 300 && conditionId < 400) {
    // Drizzle
    severity += 0.1;
  } else if (conditionId >= 500 && conditionId < 600) {
    // Rain
    if (conditionId >= 502) severity += 0.3; // Heavy rain
    else severity += 0.2; // Light/moderate rain
  } else if (conditionId >= 600 && conditionId < 700) {
    // Snow
    severity += 0.3;
  } else if (conditionId >= 700 && conditionId < 800) {
    // Atmosphere (fog, mist, etc)
    if (conditionId === 781) severity += 0.5; // Tornado
    else severity += 0.15;
  } else if (conditionId === 800) {
    // Clear
    severity += 0;
  } else if (conditionId > 800) {
    // Clouds
    const cloudiness = weather.clouds?.all || 0;
    if (cloudiness > 75) severity += 0.1;
  }

  // Wind severity
  if (windSpeed > 25) severity += 0.2; // Strong wind (mph)
  else if (windSpeed > 15) severity += 0.1; // Moderate wind

  // Humidity extremes
  if (humidity > 90) severity += 0.1; // Very humid
  else if (humidity < 20) severity += 0.1; // Very dry

  // Visibility
  if (weather.visibility < 1000) severity += 0.2; // Poor visibility

  // Clamp between 0 and 1
  return Math.max(0, Math.min(1, severity));
}

/**
 * Determines time of day based on current timestamp and sunrise/sunset
 */
export function getTimeOfDay(weather: WeatherData): 'morning' | 'afternoon' | 'evening' | 'night' {
  const currentTime = weather.dt;
  const sunrise = weather.sys.sunrise;
  const sunset = weather.sys.sunset;

  // If we don't have sun data, use rough estimates based on timestamp
  if (!sunrise || !sunset) {
    const hour = new Date(currentTime * 1000).getHours();
    if (hour >= 6 && hour < 12) return 'morning';
    if (hour >= 12 && hour < 17) return 'afternoon';
    if (hour >= 17 && hour < 21) return 'evening';
    return 'night';
  }

  // Calculate based on actual sunrise/sunset
  if (currentTime < sunrise) {
    return 'night';
  } else if (currentTime < sunrise + 3 * 3600) {
    // Within 3 hours of sunrise
    return 'morning';
  } else if (currentTime < sunset - 2 * 3600) {
    // More than 2 hours before sunset
    return 'afternoon';
  } else if (currentTime < sunset) {
    // Within 2 hours of sunset
    return 'evening';
  } else {
    return 'night';
  }
}

/**
 * Converts OpenWeatherMap WeatherData to our recommendation system's WeatherContext
 */
export function convertToWeatherContext(weather: WeatherData): WeatherContext {
  const tempF = weather.main.temp;
  const tempC = ((tempF - 32) * 5) / 9; // Convert F to C

  return {
    temp: tempC,
    conditionCode: weather.weather[0]?.id || 800,
    severityScore: calculateWeatherSeverity(weather),
    timeOfDay: getTimeOfDay(weather),
    description: weather.weather[0]?.description || 'unknown',
    timestamp: new Date(weather.dt * 1000),
  };
}

/**
 * Gets a human-readable weather summary for AI context
 */
export function getWeatherSummary(weather: WeatherData): string {
  const tempC = ((weather.main.temp - 32) * 5) / 9;
  const timeOfDay = getTimeOfDay(weather);
  const description = weather.weather[0]?.description || 'variable conditions';

  return `${description}, ${tempC.toFixed(0)}°C, ${timeOfDay}`;
}
