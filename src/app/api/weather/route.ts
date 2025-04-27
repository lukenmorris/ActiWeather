// src/app/api/weather/route.ts
import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const lat = searchParams.get('lat');
  const lon = searchParams.get('lon');
  const units = searchParams.get('units') || 'metric';

  if (!lat || !lon) {
    return NextResponse.json({ error: 'Latitude and longitude query parameters are required' }, { status: 400 });
  }

  const apiKey = process.env.OPENWEATHERMAP_API_KEY;

  // --- START DEBUG LOGGING ---
  console.log("Attempting to use API Key:", apiKey); // Log the key value
  // --- END DEBUG LOGGING ---

  if (!apiKey) {
    console.error('Error: OPENWEATHERMAP_API_KEY environment variable is not set.');
    return NextResponse.json({ error: 'Server configuration error - API Key missing' }, { status: 500 }); // More specific error for debugging
  }

  const apiUrl = `https://api.openweathermap.org/data/2.5/weather`
    + `?lat=${encodeURIComponent(lat)}`
    + `&lon=${encodeURIComponent(lon)}`
    + `&appid=${apiKey}`
    + `&units=${encodeURIComponent(units)}`;
  console.log("Calling OpenWeatherMap URL:", apiUrl); // Log the URL being called

  try {
    const response = await fetch(apiUrl, { next: { revalidate: 600 } });

    // --- START DEBUG LOGGING ---
    console.log("OpenWeatherMap Response Status:", response.status); // Log the status code received
    // --- END DEBUG LOGGING ---

    if (!response.ok) {
      const errorData = await response.json();
      console.error('OpenWeatherMap API error response:', errorData);
      return NextResponse.json({ error: errorData.message || 'Failed to fetch weather data from provider' }, { status: response.status });
    }

    const data = await response.json();
    return NextResponse.json(data);

  } catch (error) {
    console.error('Error fetching weather data:', error);
    return NextResponse.json({ error: 'Internal server error while fetching weather data' }, { status: 500 });
  }
}