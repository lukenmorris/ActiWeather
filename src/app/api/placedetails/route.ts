// src/app/api/placedetails/route.ts
import { NextRequest, NextResponse } from 'next/server';

// This route expects a 'placeId' query parameter
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const placeId = searchParams.get('placeId');

  if (!placeId) {
    return NextResponse.json({ error: 'placeId query parameter is required' }, { status: 400 });
  }

  const apiKey = process.env.Maps_API_KEY;
  if (!apiKey) {
    console.error('Error: Maps_API_KEY environment variable is not set.');
    return NextResponse.json({ error: 'Server configuration error - Maps API Key missing' }, { status: 500 });
  }

  // --- Place Details (New) API Configuration ---
  // Note: Place IDs are URL-safe, but encoding might be safer if unsure.
  const googleApiUrl = `https://places.googleapis.com/v1/places/${placeId}`;

  // Define the specific fields we want for detail view / scoring
  // Check SKU/costs! 'outdoorSeating' might be in a higher tier.
  const fieldMask = 'id,displayName,types,location,rating,userRatingCount,formattedAddress,outdoorSeating,currentOpeningHours.openNow';
  // --- End Configuration ---

  console.log(`Calling NEW Google Place Details API for placeId '${placeId}'`);

  try {
    // Make the GET request to the NEW Place Details API endpoint
    // Field mask and API key are passed as headers
    const response = await fetch(googleApiUrl, {
      method: 'GET', // Place Details uses GET
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': apiKey, // Pass API key in header
        'X-Goog-FieldMask': fieldMask, // Specify desired fields via header
      },
      // next: { revalidate: 86400 } // Optional: Cache details for a day (place details change less often)
    });

    const data = await response.json(); // Parse JSON response

    // Check for errors reported by the Google API
    if (!response.ok || data.error) {
      console.error(`Google Place Details API error for placeId ${placeId}:`, data);
      const errorMessage = data?.error?.message || `Google Place Details API error: ${response.status}`;
      const errorDetails = data?.error?.status || `Status code: ${response.status}`;
      return NextResponse.json({ error: errorMessage, details: errorDetails }, { status: response.status });
    }

    // Return the detailed place data
    // The response is the Place object itself, not nested under 'places'
    return NextResponse.json(data);

  } catch (error: any) {
    console.error(`Error fetching place details for placeId ${placeId}:`, error);
    return NextResponse.json({ error: 'Internal server error while fetching place details', details: error.message }, { status: 500 });
  }
}