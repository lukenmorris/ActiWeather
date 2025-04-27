// src/components/WeatherDisplay.tsx
'use client';

import React from 'react';
import type { WeatherData } from '@/types'; // Import shared type

// Import Lucide icons
import {
    Thermometer,
    Wind,
    Droplets,
    Eye,
    Sunrise,
    Sunset,
    LocateFixed,
    AlertCircle,
    Cloud,
    CloudFog,
    CloudLightning,
    CloudRain,
    CloudSnow,
    ThermometerSun,
    HelpCircle // Fallback icon
} from 'lucide-react';

// Import the missing utility function for formatting distance
import { formatDistance } from '@/lib/geoUtils';

// Define the props the component expects
interface WeatherDisplayProps {
  weatherData: WeatherData | null;
  isLoading: boolean;
  error: string | null;
}

// Placeholder for animated icon component - using static Lucide icons for now
const AnimatedWeatherIcon: React.FC<{ iconCode: string | undefined, condition: string | undefined }> = ({ iconCode, condition }) => {
    // Simple map from OpenWeatherMap icon codes to Lucide icons
    // You would replace this logic if using actual animated icons
    const iconMap: { [key: string]: React.ReactNode } = {
        '01d': <ThermometerSun className="w-16 h-16 text-yellow-300" />, // Clear Day - Adjust icon/color
        '01n': <ThermometerSun className="w-16 h-16 text-indigo-300" />, // Clear Night - Adjust icon/color (Needs Moon icon ideally)
        '02d': <Cloud className="w-16 h-16 text-white opacity-80" />, '02n': <Cloud className="w-16 h-16 text-slate-400" />, // Few clouds
        '03d': <Cloud className="w-16 h-16 text-white opacity-90" />, '03n': <Cloud className="w-16 h-16 text-slate-400" />, // Scattered clouds
        '04d': <Cloud className="w-16 h-16 text-white" />, '04n': <Cloud className="w-16 h-16 text-slate-400" />, // Broken/Overcast clouds
        '09d': <CloudRain className="w-16 h-16 text-blue-300" />, '09n': <CloudRain className="w-16 h-16 text-blue-300" />, // Shower rain
        '10d': <CloudRain className="w-16 h-16 text-blue-300" />, '10n': <CloudRain className="w-16 h-16 text-blue-300" />, // Rain
        '11d': <CloudLightning className="w-16 h-16 text-yellow-400" />, '11n': <CloudLightning className="w-16 h-16 text-yellow-400" />, // Thunderstorm
        '13d': <CloudSnow className="w-16 h-16 text-sky-300" />, '13n': <CloudSnow className="w-16 h-16 text-sky-300" />, // Snow
        '50d': <CloudFog className="w-16 h-16 text-slate-400" />, '50n': <CloudFog className="w-16 h-16 text-slate-400" />, // Mist/Fog/Atmosphere
    };
    // Return the mapped icon or a fallback
    return iconMap[iconCode || ''] || <HelpCircle className="w-16 h-16 text-gray-500" />;
};


const WeatherDisplay: React.FC<WeatherDisplayProps> = ({ weatherData, isLoading, error }) => {
    // Dynamically determine container style based on weather time (approximated)
    // Note: This duplicates theme logic from page.tsx; ideally, pass theme as a prop or use CSS variables
    const isPotentiallyDay = weatherData ? (weatherData.dt > weatherData.sys.sunrise && weatherData.dt < weatherData.sys.sunset) : true;
    const containerClasses = `p-4 md:p-6 rounded-xl shadow-lg relative overflow-hidden min-h-[250px] flex flex-col justify-between
    ${weatherData ? (isPotentiallyDay ? 'bg-black/10 text-inherit' : 'bg-black/20 text-white/90') : 'bg-gray-400/20'}
    backdrop-blur-sm border border-white/10`; // Frosted glass effect

    // Helper to format time from UTC timestamp + offset
    const formatTime = (timestamp: number | undefined, timezoneOffset: number | undefined): string => {
        if (timestamp === undefined || timezoneOffset === undefined) return '--:--';
        try {
            const date = new Date((timestamp + timezoneOffset) * 1000);
            return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', timeZone: 'UTC' });
        } catch {
            return '--:--';
        }
    };

    // --- Loading State ---
    if (isLoading) {
        return (
            <div className={`${containerClasses} items-center justify-center animate-pulse`}>
                <LocateFixed className="w-10 h-10 text-gray-500 animate-spin" />
                <p className="mt-2 text-sm text-gray-500">Fetching weather...</p>
            </div>
        );
    }

    // --- Error State ---
    if (error) {
        return (
            <div className={`${containerClasses} items-center justify-center text-center`}>
                <AlertCircle className="w-10 h-10 text-red-400" />
                <p className="mt-2 text-sm font-medium text-red-400">Weather Error</p>
                <p className="mt-1 text-xs text-red-300 opacity-80">{error}</p>
            </div>
        );
    }

    // --- No Data State ---
    if (!weatherData) {
        return (
            <div className={`${containerClasses} items-center justify-center`}>
                <HelpCircle className="w-10 h-10 text-gray-500 opacity-70"/>
                <p className="mt-2 text-sm text-gray-500">Weather data unavailable.</p>
            </div>
        );
    }

    const { main, weather, name, wind, sys, visibility, timezone } = weatherData!; // Use ! assuming check already happened
    const currentCondition = weather[0];

    return (
        <div className={containerClasses}>
            {/* Top Section */}
            <div className="flex justify-between items-start mb-4">
                <div className="flex-1">
                    {/* Apply Section Heading (slightly smaller H2) */}
                    <h2 className="text-xl font-semibold text-inherit opacity-95">{name}</h2>
                    {/* Apply Body/Supporting Text Style */}
                    <p className="text-sm opacity-80 capitalize">{currentCondition?.description || 'N/A'}</p>
                </div>
                {/* ... Icon ... */}
            </div>

            {/* Temperature Section */}
            <div className="text-center mb-4">
                 {/* Large Temp (already styled well) */}
                <p className="text-6xl md:text-7xl font-bold tracking-tighter">
                    {main?.temp?.toFixed(0) ?? '--'}°<span className="text-3xl align-top opacity-80">F</span>
                </p>
                 {/* Supporting Text */}
                <p className="text-sm opacity-80">
                    Feels like {main?.feels_like?.toFixed(0) ?? '--'}°
                </p>
            </div>

            {/* Bottom Section: Details Grid */}
            <div className="grid grid-cols-3 gap-x-2 gap-y-3 text-xs md:text-sm border-t border-white/20 pt-4">
                 {/* Apply Supporting/Meta Text Style */}
                 <div className="text-center">
                     {/* ... Icon ... */}
                     <p className='font-medium'>{wind?.speed?.toFixed(1) ?? '--'} mph</p>
                     <p className="opacity-70">Wind</p>
                 </div>
                 <div className="text-center">
                     {/* ... Icon ... */}
                     <p className='font-medium'>{main?.humidity ?? '--'}%</p>
                     <p className="opacity-70">Humidity</p>
                 </div>
                 <div className="text-center">
                     {/* ... Icon ... */}
                     <p className='font-medium'>{typeof visibility === 'number' ? formatDistance(visibility / 1000) : '--'}</p>
                     <p className="opacity-70">Visibility</p>
                 </div>
                 {/* ... Optional Sunrise/Sunset ... */}
            </div>
        </div>
    );
};
export default WeatherDisplay;