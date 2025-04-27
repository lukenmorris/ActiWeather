// src/components/WeatherDisplay.tsx
'use client';

import React from 'react';
import type { WeatherData } from '@/types';

interface WeatherDisplayProps {
  weatherData: WeatherData | null;
  isLoading: boolean;
  error: string | null;
}

const WeatherDisplay: React.FC<WeatherDisplayProps> = ({ weatherData, isLoading, error }) => {
  let content;

  if (isLoading) {
    // Simple loading spinner (requires Tailwind animation setup if not default)
    content = (
      <div className="flex justify-center items-center h-full">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
      </div>
    );
  } else if (error) {
    // Display error message
    content = <p className="text-red-600 text-center font-medium">Error: {error}</p>;
  } else if (weatherData) {
    // Display weather data if available
    const { main, weather, name, wind, sys } = weatherData;
    const currentCondition = weather[0]; // Get the primary weather condition
    // Construct icon URL (Refer to OpenWeatherMap docs for icon usage)
    const iconUrl = `https://openweathermap.org/img/wn/${currentCondition.icon}@2x.png`;

    content = (
      <div className="space-y-3 text-gray-700">
        <h3 className="text-lg font-semibold text-center text-gray-800">Weather in {name}, {sys.country}</h3>
        <div className="flex items-center justify-center text-center flex-wrap">
          <img
              src={iconUrl}
              alt={currentCondition.description}
              className="w-20 h-20 -mt-2 -mb-2" // Adjust size and margin as needed
              width="80"
              height="80"
          />
          <div className="ml-2 text-left">
            <p className="text-4xl font-bold">{main.temp.toFixed(1)}°C</p>
            <p className="capitalize text-sm text-gray-600">{currentCondition.description}</p>
          </div>
        </div>
        <div className="text-sm space-y-1 text-center">
          <p>Feels like: {main.feels_like.toFixed(1)}°C</p>
          <p>Humidity: {main.humidity}%</p>
          <p>Wind: {wind.speed.toFixed(1)} m/s</p>
          {/* Optionally display min/max temps */}
          {/* <p>Min: {main.temp_min.toFixed(1)}°C / Max: {main.temp_max.toFixed(1)}°C</p> */}
        </div>
      </div>
    );
  } else {
    // Default message if no data, loading, or error
    content = <p className="text-gray-500 text-center">Waiting for location...</p>;
  }

  return (
    <div className="p-4 border border-gray-200 rounded-lg shadow-md bg-white/80 backdrop-blur-sm min-h-[200px] flex flex-col justify-center">
      <h2 className="text-xl font-semibold mb-3 text-center text-slate-600 sr-only">Current Weather</h2>
      {content}
    </div>
  );
};

export default WeatherDisplay;