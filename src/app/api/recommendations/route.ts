import { NextRequest, NextResponse } from 'next/server';
import { WeatherData, GooglePlace } from '@/types';
import { convertToWeatherContext } from '@/lib/weatherContext';
import { calculateDynamicWeights } from '@/lib/scoring/dynamicWeights';
import { scoreAndSortVenues } from '@/lib/scoring/venueScorer';
import { rerankWithGemini, createWeatherSummary } from '@/lib/ai/geminiReranker';
import { Venue, UserPreferences } from '@/types/recommendation';

/**
 * POST /api/recommendations
 * Hybrid recommendation endpoint - integrates with existing ActiWeather UI
 * Accepts places from the existing Google Places API and re-scores them using:
 * 1. Dynamic contextual scoring based on weather
 * 2. AI reranking with Gemini
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // Validate request
    if (!body.weatherData || !body.places || !body.userLocation) {
      return NextResponse.json(
        {
          error: 'Missing required fields: weatherData, places, userLocation',
          received: {
            hasWeatherData: !!body.weatherData,
            hasPlaces: !!body.places,
            hasUserLocation: !!body.userLocation,
          },
        },
        { status: 400 }
      );
    }

    const {
      weatherData,
      places,
      userLocation,
      maxResults = 20,
      mood,
    }: {
      weatherData: WeatherData;
      places: GooglePlace[];
      userLocation: { latitude: number; longitude: number };
      maxResults?: number;
      mood?: string;
    } = body;

    console.log(`🎯 Recommendations API: Processing ${places.length} places`);

    // Step 1: Convert weather data to context
    const weatherContext = convertToWeatherContext(weatherData);
    console.log('📊 Weather context:', {
      temp: weatherContext.temp.toFixed(1),
      severity: weatherContext.severityScore.toFixed(2),
      timeOfDay: weatherContext.timeOfDay,
    });

    // Step 2: Calculate dynamic weights
    const weights = calculateDynamicWeights(weatherContext);
    console.log('⚖️  Dynamic weights:', weights);

    // Step 3: Convert GooglePlace to Venue format
    const venues: Venue[] = places.map((place) => convertGooglePlaceToVenue(place));

    // Step 4: Create user preferences
    const userPreferences: UserPreferences = {
      location: {
        lat: userLocation.latitude,
        lng: userLocation.longitude,
      },
      radius: 10000, // 10km default
      mood: mood as any,
    };

    // Step 5: Score and sort venues
    const scoredVenues = scoreAndSortVenues(
      venues,
      weatherContext,
      weights,
      userPreferences
    );

    console.log(`✅ Scored ${scoredVenues.length} venues`);

    // Step 6: Take top N for AI reranking
    const topVenuesForReranking = scoredVenues.slice(0, Math.min(15, scoredVenues.length));

    // Step 7: Apply AI reranking
    const weatherSummary = createWeatherSummary(
      weatherData.main.temp,
      weatherData.weather[0]?.description || 'varied conditions',
      weatherContext.timeOfDay
    );

    const rerankResult = await rerankWithGemini({
      venues: topVenuesForReranking,
      weatherSummary,
      userContext: mood ? `User is feeling ${mood}` : undefined,
    });

    console.log('🤖 AI reranking:', {
      success: rerankResult.success,
      error: rerankResult.error,
    });

    // Step 8: Reorder based on AI ranking
    let finalVenues: Venue[];

    if (rerankResult.success) {
      const venueMap = new Map(topVenuesForReranking.map((v) => [v.id, v]));
      finalVenues = rerankResult.venueIds
        .map((id) => venueMap.get(id))
        .filter((v): v is Venue => v !== undefined);
    } else {
      finalVenues = topVenuesForReranking;
    }

    // Step 9: Convert back to GooglePlace format
    const resultPlaces = finalVenues
      .slice(0, maxResults)
      .map((venue) => convertVenueToGooglePlace(venue));

    console.log(`📍 Returning ${resultPlaces.length} recommendations`);

    return NextResponse.json({
      places: resultPlaces,
      metadata: {
        totalProcessed: places.length,
        returned: resultPlaces.length,
        aiRerankingApplied: rerankResult.success,
        weatherSeverity: weatherContext.severityScore,
        weights,
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error('❌ Error in recommendations API:', error);

    return NextResponse.json(
      {
        error: 'Failed to generate recommendations',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

/**
 * Converts GooglePlace (NEW API format) to Venue
 */
function convertGooglePlaceToVenue(place: GooglePlace): Venue {
  return {
    id: place.id,
    name: place.displayName?.text || 'Unknown Place',
    googlePlaceData: {
      place_id: place.id,
      name: place.displayName?.text || 'Unknown Place',
      formatted_address: place.formattedAddress,
      rating: place.rating,
      user_ratings_total: place.userRatingCount || 0,
      geometry: {
        location: {
          lat: place.location?.latitude || 0,
          lng: place.location?.longitude || 0,
        },
      },
      types: place.types,
      opening_hours: {
        open_now:
          place.currentOpeningHours?.openNow ??
          place.regularOpeningHours?.openNow,
        weekday_text:
          place.currentOpeningHours?.weekdayDescriptions ??
          place.regularOpeningHours?.weekdayDescriptions,
      },
      editorial_summary: place.editorialSummary
        ? { overview: place.editorialSummary.text }
        : undefined,
    },
    baseScore: 50,
    computedScore: 0,
    semanticTags: extractSemanticTags(place),
  };
}

/**
 * Converts Venue back to GooglePlace format
 */
function convertVenueToGooglePlace(venue: Venue): GooglePlace {
  return {
    id: venue.id,
    displayName: {
      text: venue.name,
    },
    types: venue.googlePlaceData.types,
    location: {
      latitude: venue.googlePlaceData.geometry.location.lat,
      longitude: venue.googlePlaceData.geometry.location.lng,
    },
    rating: venue.googlePlaceData.rating,
    userRatingCount: venue.googlePlaceData.user_ratings_total,
    formattedAddress: venue.googlePlaceData.formatted_address,
    editorialSummary: venue.googlePlaceData.editorial_summary
      ? { text: venue.googlePlaceData.editorial_summary.overview || '' }
      : undefined,
    currentOpeningHours: venue.googlePlaceData.opening_hours?.open_now !== undefined
      ? {
          openNow: venue.googlePlaceData.opening_hours.open_now,
          weekdayDescriptions: venue.googlePlaceData.opening_hours.weekday_text,
        }
      : undefined,
    distance: venue.distanceMeters ? venue.distanceMeters / 1000 : undefined, // Convert to km
    // @ts-ignore - Add suitability score for UI
    suitabilityScore: venue.computedScore,
  };
}

/**
 * Extracts semantic tags from GooglePlace
 */
function extractSemanticTags(place: GooglePlace): string[] {
  const tags: string[] = [];

  // Add types
  if (place.types && Array.isArray(place.types)) {
    tags.push(...place.types);
  }

  // Add rating category
  if (place.rating) {
    if (place.rating >= 4.5) tags.push('highly-rated');
    else if (place.rating >= 4.0) tags.push('well-rated');
    else if (place.rating >= 3.5) tags.push('moderately-rated');
  }

  // Add open/closed status
  const openNow =
    place.currentOpeningHours?.openNow ?? place.regularOpeningHours?.openNow;
  if (openNow !== undefined) {
    tags.push(openNow ? 'open-now' : 'closed');
  }

  // Add indoor/outdoor hints
  const indoorTypes = [
    'museum',
    'shopping_mall',
    'library',
    'cafe',
    'restaurant',
    'art_gallery',
  ];
  const outdoorTypes = ['park', 'beach', 'hiking_area', 'zoo', 'tourist_attraction'];

  if (place.types?.some((t) => indoorTypes.includes(t))) {
    tags.push('indoor');
  }
  if (place.types?.some((t) => outdoorTypes.includes(t))) {
    tags.push('outdoor');
  }

  return [...new Set(tags)]; // Remove duplicates
}
