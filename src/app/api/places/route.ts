// src/app/api/places/route.ts
import { NextRequest, NextResponse } from 'next/server';

// Define expected structure for the request body sent to Google Places API (New)
interface GooglePlacesRequestBody {
  includedTypes: string[]; // Use includedTypes for broader matching than primary type
  maxResultCount?: number; // Optional: max 20
  locationRestriction: {
    circle: {
      center: {
        latitude: number;
        longitude: number;
      };
      radius: number; // In meters
    };
  };
  // Add other parameters like languageCode, rankPreference etc. if needed
  // rankPreference?: 'DISTANCE' | 'POPULARITY'; // Note: POPULARITY is default
}

// Keep this as GET because page.tsx calls /api/places?params via GET
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const latStr = searchParams.get('lat');
  const lonStr = searchParams.get('lon');
  const radiusStr = searchParams.get('radius') || '5000'; // Default radius 5km
  const type = searchParams.get('type'); // Still expecting a single place type per request from frontend

  // Validate required parameters received from frontend
  if (!latStr || !lonStr) {
    return NextResponse.json({ error: 'Latitude and longitude query parameters are required' }, { status: 400 });
  }
  if (!type) {
    return NextResponse.json({ error: 'Place type query parameter is required' }, { status: 400 });
  }

  // Parse coordinates and radius
  const latitude = parseFloat(latStr);
  const longitude = parseFloat(lonStr);
  const radius = parseInt(radiusStr, 10);

  if (isNaN(latitude) || isNaN(longitude) || isNaN(radius)) {
      return NextResponse.json({ error: 'Invalid latitude, longitude, or radius format' }, { status: 400 });
  }

  // Retrieve Google API Key (Server-side only)
  const apiKey = process.env.Maps_API_KEY;
  if (!apiKey) {
    console.error('Error: Maps_API_KEY environment variable is not set.');
    return NextResponse.json({ error: 'Server configuration error - Maps API Key missing' }, { status: 500 });
  }

  // --- New Places API Configuration ---
  const googleApiUrl = 'https://places.googleapis.com/v1/places:searchNearby';
  // Define the fields we want from the API (controls cost and data)
  const fieldMask = 'places.id,places.displayName,places.types,places.location,places.rating,places.userRatingCount,places.formattedAddress,places.currentOpeningHours.openNow';

  // Construct the request body for the POST request
  const requestBody: GooglePlacesRequestBody = {
    includedTypes: [type], // Search for the specific type passed from frontend
    maxResultCount: 10, // Request up to 10 results (adjust as needed, max 20)
    locationRestriction: {
      circle: {
        center: { latitude, longitude },
        radius: radius,
      },
    },
    // rankPreference: 'DISTANCE', // Optional: uncomment to rank strictly by distance
  };
  // --- End of New Places API Configuration ---


  console.log(`Calling NEW Google Places API for type '${type}'`);
  // Log the request body for debugging (optional)
  // console.log("Request Body:", JSON.stringify(requestBody));

  try {
    // Make the POST request to the NEW Places API endpoint
    const response = await fetch(googleApiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': apiKey, // Use API Key Header
        'X-Goog-FieldMask': fieldMask, // Specify desired fields
      },
      body: JSON.stringify(requestBody),
      next: { revalidate: 3600 } // Optional: Cache results for 1 hour
    });

    const data = await response.json(); // Attempt to parse JSON regardless of status for error details

    if (!response.ok) {
      console.error('Google Places API (New) error response:', data);
      // Forward Google's error status and potentially message
      // The new API often puts error details in data.error.message
      return NextResponse.json({
        error: data?.error?.message || `Google Places API error: ${response.status}`,
        details: data?.error?.status || `Status code: ${response.status}`
      }, { status: response.status });
    }

    // Check if the response contains the expected 'places' array (even if empty)
    // The new API doesn't have a top-level 'status' field like the old one
    if (!data || !Array.isArray(data.places)) {
        console.warn(`Google Places API (New) returned unexpected data format for type '${type}'.`);
        // Treat as finding no results
        return NextResponse.json([]); // Return empty array
    }

    // Return the results array from Google's response
    console.log(`Found ${data.places.length} places for type '${type}'`);
    return NextResponse.json(data.places); // Return the places array

  } catch (error: any) {
    console.error('Error fetching places via proxy (New API):', error);
    return NextResponse.json({ error: 'Internal server error while fetching places', details: error.message }, { status: 500 });
  }
}