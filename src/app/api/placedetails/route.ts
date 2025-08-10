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
  const googleApiUrl = `https://places.googleapis.com/v1/places/${placeId}`;

  // Enhanced field mask for detailed view
  // Note: Photos and reviews require additional API calls in the new Places API
const fieldMask = [
    // Basic Information
    'id',
    'displayName',
    'types',
    'location',
    'rating',
    'userRatingCount',
    'formattedAddress',
    'businessStatus',
    'priceLevel',
    
    // Contact Information
    'internationalPhoneNumber',
    'nationalPhoneNumber',
    'websiteUri',
    'googleMapsUri',
    
    // Opening Hours - Request full structure
    'currentOpeningHours.openNow',
    'currentOpeningHours.periods',
    'currentOpeningHours.weekdayDescriptions',
    'regularOpeningHours.openNow',
    'regularOpeningHours.periods',
    'regularOpeningHours.weekdayDescriptions',
    
    // Features
    'outdoorSeating',
    'delivery',
    'dineIn',
    'curbsidePickup',
    'reservable',
    'servesBreakfast',
    'servesLunch',
    'servesDinner',
    'servesBeer',
    'servesWine',
    'servesVegetarianFood',
    'takeout',
    
    // Accessibility
    'accessibilityOptions',
    
    // Payment
    'paymentOptions',
    
    // Photos (returns photo resource names, not actual images)
    'photos',
    
    // Reviews
    'reviews',
    
    // Additional Info
    'userRatingCount',
    'utcOffsetMinutes',
    'adrFormatAddress',
    'editorialSummary',
    'primaryType',
    'primaryTypeDisplayName',
    'subDestinations',
    'parkingOptions',
    'plusCode',
    'viewport'
  ].join(',');
  
  // --- End Configuration ---

  console.log(`Calling NEW Google Place Details API for placeId '${placeId}' with enhanced fields`);

  try {
    // Make the GET request to the NEW Place Details API endpoint
    const response = await fetch(googleApiUrl, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': apiKey,
        'X-Goog-FieldMask': fieldMask,
      },
      next: { revalidate: 86400 } // Cache details for a day
    });

    const data = await response.json();

    // Check for errors
    if (!response.ok || data.error) {
      console.error(`Google Place Details API error for placeId ${placeId}:`, data);
      const errorMessage = data?.error?.message || `Google Place Details API error: ${response.status}`;
      const errorDetails = data?.error?.status || `Status code: ${response.status}`;
      return NextResponse.json({ error: errorMessage, details: errorDetails }, { status: response.status });
    }

    // Process photos to include proper URLs
    if (data.photos && Array.isArray(data.photos)) {
      // Limit to first 10 photos to avoid too much data
      data.photos = data.photos.slice(0, 10);
    }

    // Process reviews if available
    if (data.reviews && Array.isArray(data.reviews)) {
      // Sort by most recent and limit to 10
      data.reviews = data.reviews
        .sort((a: any, b: any) => {
          const dateA = new Date(a.publishTime || 0).getTime();
          const dateB = new Date(b.publishTime || 0).getTime();
          return dateB - dateA;
        })
        .slice(0, 10);
    }

    // Return the enhanced place data
    return NextResponse.json(data);

  } catch (error: any) {
    console.error(`Error fetching place details for placeId ${placeId}:`, error);
    return NextResponse.json({ 
      error: 'Internal server error while fetching place details', 
      details: error.message 
    }, { status: 500 });
  }
}