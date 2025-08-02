// src/app/api/placephoto/route.ts
import { NextRequest, NextResponse } from 'next/server';

// This route proxies photo requests to hide the API key from the client
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const photoName = searchParams.get('name'); // e.g., "places/ChIJ.../photos/AdCG..."
  const maxWidthPx = searchParams.get('maxWidthPx') || '400';
  const maxHeightPx = searchParams.get('maxHeightPx');

  if (!photoName) {
    return NextResponse.json({ error: 'Photo name parameter is required' }, { status: 400 });
  }

  const apiKey = process.env.Maps_API_KEY;
  if (!apiKey) {
    console.error('Error: Maps_API_KEY environment variable is not set.');
    return NextResponse.json({ error: 'Server configuration error' }, { status: 500 });
  }

  // Construct the Google Places Photos API URL
  let googlePhotoUrl = `https://places.googleapis.com/v1/${photoName}/media?key=${apiKey}`;
  
  // Add size parameters
  if (maxWidthPx) {
    googlePhotoUrl += `&maxWidthPx=${maxWidthPx}`;
  }
  if (maxHeightPx) {
    googlePhotoUrl += `&maxHeightPx=${maxHeightPx}`;
  }

  try {
    // Fetch the photo from Google
    const response = await fetch(googlePhotoUrl, {
      method: 'GET',
      // The photo endpoint returns a redirect to the actual image
      redirect: 'follow',
    });

    if (!response.ok) {
      console.error(`Google Places Photo API error: ${response.status}`);
      return NextResponse.json(
        { error: `Failed to fetch photo: ${response.status}` },
        { status: response.status }
      );
    }

    // Get the image data
    const imageBuffer = await response.arrayBuffer();
    const contentType = response.headers.get('content-type') || 'image/jpeg';

    // Return the image with appropriate headers
    return new NextResponse(imageBuffer, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=86400', // Cache for 1 day
      },
    });

  } catch (error: any) {
    console.error('Error fetching place photo:', error);
    return NextResponse.json(
      { error: 'Failed to fetch photo', details: error.message },
      { status: 500 }
    );
  }
}