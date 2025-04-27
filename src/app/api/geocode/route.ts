// src/app/api/geocode/route.ts
import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const address = searchParams.get('address');
  const placeId = searchParams.get('placeId');

  // Require either address or placeId
  if (!address && !placeId) {
    return NextResponse.json({ error: 'Either address or placeId query parameter is required' }, { status: 400 });
  }

  const apiKey = process.env.Maps_API_KEY; // Use the server-side key
  if (!apiKey) {
    console.error('Error: Maps_API_KEY environment variable is not set.');
    return NextResponse.json({ error: 'Server configuration error - Geocoding Key missing' }, { status: 500 });
  }

  // Build the Geocoding API URL
  let googleApiUrl = `https://maps.googleapis.com/maps/api/geocode/json?key=${apiKey}`;
  if (placeId) {
      googleApiUrl += `&place_id=${encodeURIComponent(placeId)}`;
      console.log(`Calling Geocoding API with placeId: ${placeId}`);
  } else if (address) {
      googleApiUrl += `&address=${encodeURIComponent(address)}`;
       console.log(`Calling Geocoding API with address: ${address}`);
  }

  try {
    const response = await fetch(googleApiUrl, {
        // Caching might be less useful here unless addresses are often repeated
         // next: { revalidate: 86400 } // Cache for a day?
    });
    const data = await response.json();

    if (!response.ok || data.status !== 'OK') {
      console.error('Google Geocoding API error response:', data);
      return NextResponse.json({
        error: data.error_message || data.status || 'Failed to geocode address',
        details: data.status // e.g., ZERO_RESULTS, INVALID_REQUEST
      }, { status: response.status === 200 ? 400 : response.status }); // Return 400 if Google status is bad but HTTP was 200
    }

    // Extract lat/lng from the first result
    const location = data.results?.[0]?.geometry?.location; // e.g., { lat: 36.97, lng: -122.03 }
    if (!location || typeof location.lat !== 'number' || typeof location.lng !== 'number') {
         return NextResponse.json({ error: 'Could not extract coordinates from Geocoding response' }, { status: 500 });
    }

    // Return just the coordinates
    return NextResponse.json({ lat: location.lat, lng: location.lng });

  } catch (error: any) {
    console.error('Error during geocoding:', error);
    return NextResponse.json({ error: 'Internal server error during geocoding', details: error.message }, { status: 500 });
  }
}