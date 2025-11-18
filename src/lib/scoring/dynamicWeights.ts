import { WeatherContext, ScoringWeights } from '@/types/recommendation';

/**
 * Standard baseline weights for scoring
 */
const STANDARD_WEIGHTS: ScoringWeights = {
  weather: 0.35,
  time: 0.30,
  distance: 0.20,
  popularity: 0.15,
};

/**
 * Extreme weather weights (weather becomes dominant factor)
 */
const EXTREME_WEATHER_WEIGHTS: ScoringWeights = {
  weather: 0.60,
  time: 0.20,
  distance: 0.12,
  popularity: 0.08,
};

/**
 * Determines if weather conditions are extreme based on severity score and condition codes
 * @param weather - Current weather context
 * @returns true if weather is considered extreme
 */
export function isExtremeWeather(weather: WeatherContext): boolean {
  // Severity score above 0.7 is considered extreme
  if (weather.severityScore >= 0.7) {
    return true;
  }

  // Check specific extreme condition codes from OpenWeatherMap
  const extremeConditionCodes = [
    // Thunderstorm group (200-232)
    200, 201, 202, 210, 211, 212, 221, 230, 231, 232,
    // Heavy rain (502-531)
    502, 503, 504, 511, 522, 531,
    // Snow (600-622)
    600, 601, 602, 611, 612, 613, 615, 616, 620, 621, 622,
    // Extreme atmosphere (781 - Tornado)
    781,
  ];

  if (extremeConditionCodes.includes(weather.conditionCode)) {
    return true;
  }

  // Temperature extremes (below 0°C or above 38°C)
  if (weather.temp <= 0 || weather.temp >= 38) {
    return true;
  }

  return false;
}

/**
 * Calculates dynamic weights based on weather context
 * Adjusts scoring weights to prioritize weather appropriateness during extreme conditions
 *
 * @param weather - Current weather context
 * @returns Dynamically adjusted scoring weights that sum to 1.0
 */
export function calculateDynamicWeights(weather: WeatherContext): ScoringWeights {
  const isExtreme = isExtremeWeather(weather);

  if (isExtreme) {
    // Return extreme weather weights
    return { ...EXTREME_WEATHER_WEIGHTS };
  }

  // For moderate weather, interpolate based on severity score
  // Severity 0.0 = standard weights
  // Severity 0.7 = extreme weights
  const severity = Math.min(weather.severityScore, 0.7);
  const interpolationFactor = severity / 0.7;

  const weights: ScoringWeights = {
    weather:
      STANDARD_WEIGHTS.weather +
      (EXTREME_WEATHER_WEIGHTS.weather - STANDARD_WEIGHTS.weather) *
        interpolationFactor,
    time:
      STANDARD_WEIGHTS.time +
      (EXTREME_WEATHER_WEIGHTS.time - STANDARD_WEIGHTS.time) *
        interpolationFactor,
    distance:
      STANDARD_WEIGHTS.distance +
      (EXTREME_WEATHER_WEIGHTS.distance - STANDARD_WEIGHTS.distance) *
        interpolationFactor,
    popularity:
      STANDARD_WEIGHTS.popularity +
      (EXTREME_WEATHER_WEIGHTS.popularity - STANDARD_WEIGHTS.popularity) *
        interpolationFactor,
  };

  // Ensure weights sum to 1.0 (normalize due to floating point)
  const sum = weights.weather + weights.time + weights.distance + weights.popularity;

  return {
    weather: weights.weather / sum,
    time: weights.time / sum,
    distance: weights.distance / sum,
    popularity: weights.popularity / sum,
  };
}

/**
 * Gets a human-readable explanation of the current weighting strategy
 * @param weather - Current weather context
 * @returns Explanation string
 */
export function getWeightingExplanation(weather: WeatherContext): string {
  const isExtreme = isExtremeWeather(weather);

  if (isExtreme) {
    return `Extreme weather detected (${weather.description}). Prioritizing weather-appropriate venues (60% weather, 20% time, 12% distance, 8% popularity).`;
  }

  if (weather.severityScore > 0.4) {
    return `Moderate weather conditions (${weather.description}). Balancing weather appropriateness with other factors.`;
  }

  return `Pleasant weather conditions (${weather.description}). Using standard balanced scoring (35% weather, 30% time, 20% distance, 15% popularity).`;
}
