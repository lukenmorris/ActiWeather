import { GoogleGenerativeAI } from '@google/generative-ai';
import { Venue, GeminiRerankRequest, GeminiRerankResponse } from '@/types/recommendation';

// Initialize Gemini AI
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

/**
 * Reranks venues using Google Gemini AI for semantic understanding
 * Provides a graceful fallback if the AI service fails
 *
 * @param request - Reranking request with venues and context
 * @returns Reranked venue IDs or original order on failure
 */
export async function rerankWithGemini(
  request: GeminiRerankRequest
): Promise<GeminiRerankResponse> {
  const { venues, weatherSummary, userContext } = request;

  // Fallback: return original order if no API key
  if (!process.env.GEMINI_API_KEY) {
    console.warn('GEMINI_API_KEY not configured. Skipping AI reranking.');
    return {
      venueIds: venues.map((v) => v.id),
      success: false,
      error: 'API key not configured',
    };
  }

  // Fallback: return original order if no venues
  if (venues.length === 0) {
    return {
      venueIds: [],
      success: true,
    };
  }

  try {
    // Build the prompt
    const prompt = buildRerankingPrompt(venues, weatherSummary, userContext);

    // Use Gemini 2.5 Flash-Lite
    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash-lite' });

    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();

    // Parse the JSON response
    const parsedResponse = parseGeminiResponse(text);

    if (!parsedResponse.success) {
      console.warn('Failed to parse Gemini response:', parsedResponse.error);
      return {
        venueIds: venues.map((v) => v.id),
        success: false,
        error: parsedResponse.error,
      };
    }

    // Validate that all returned IDs exist in original venues
    const validIds = validateVenueIds(parsedResponse.venueIds, venues);

    return {
      venueIds: validIds,
      success: true,
    };
  } catch (error) {
    console.error('Error calling Gemini API for reranking:', error);

    // Graceful fallback: return original order
    return {
      venueIds: venues.map((v) => v.id),
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Builds the reranking prompt for Gemini
 */
function buildRerankingPrompt(
  venues: Venue[],
  weatherSummary: string,
  userContext?: string
): string {
  const venueDescriptions = venues.map((venue, index) => {
    const placeData = venue.googlePlaceData;
    const rating = placeData.rating ? `${placeData.rating}⭐` : 'No rating';
    const priceLevel = placeData.price_level
      ? '$'.repeat(placeData.price_level)
      : 'Price unknown';
    const types = placeData.types?.slice(0, 3).join(', ') || 'N/A';
    const openNow = placeData.opening_hours?.open_now ? 'Open now' : 'Closed';
    const tags = venue.semanticTags.join(', ') || 'N/A';

    return `${index + 1}. **${venue.name}** (ID: ${venue.id})
   - Address: ${placeData.formatted_address || 'N/A'}
   - Rating: ${rating} (${placeData.user_ratings_total || 0} reviews)
   - Price: ${priceLevel}
   - Types: ${types}
   - Status: ${openNow}
   - Tags: ${tags}
   - Score: ${venue.computedScore.toFixed(2)}`;
  });

  const userContextSection = userContext
    ? `\n**User Context:** ${userContext}\n`
    : '';

  return `You are a local activity recommendation expert. Given the current weather conditions, re-order these venues based on which would offer the BEST EXPERIENCE for the user right now.

**Current Weather:** ${weatherSummary}
${userContextSection}
**Venues to Rank:**
${venueDescriptions.join('\n\n')}

**Instructions:**
1. Consider the weather conditions and how they affect each venue's appeal
2. Prioritize indoor venues during bad weather (rain, extreme cold/heat)
3. Prioritize outdoor/scenic venues during pleasant weather
4. Consider practical factors like whether the place is currently open
5. Balance weather appropriateness with overall quality (ratings)
6. Think about the vibe and experience each venue offers in the current conditions

**IMPORTANT:** Respond with ONLY a JSON array of venue IDs in your preferred order. No explanation, no markdown formatting, just the JSON array.

Example response format:
["venue_id_1", "venue_id_2", "venue_id_3"]

Your response:`;
}

/**
 * Parses Gemini's response and extracts venue IDs
 */
function parseGeminiResponse(
  text: string
): { success: true; venueIds: string[] } | { success: false; error: string } {
  try {
    // Remove potential markdown code blocks
    let cleanedText = text.trim();
    cleanedText = cleanedText.replace(/```json\s*/g, '');
    cleanedText = cleanedText.replace(/```\s*/g, '');
    cleanedText = cleanedText.trim();

    // Parse JSON
    const parsed = JSON.parse(cleanedText);

    // Validate it's an array
    if (!Array.isArray(parsed)) {
      return {
        success: false,
        error: 'Response is not an array',
      };
    }

    // Validate all elements are strings
    if (!parsed.every((item) => typeof item === 'string')) {
      return {
        success: false,
        error: 'Array contains non-string elements',
      };
    }

    return {
      success: true,
      venueIds: parsed,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Parse error',
    };
  }
}

/**
 * Validates venue IDs and ensures they match original venues
 * Fills in any missing IDs from the original list
 */
function validateVenueIds(geminiIds: string[], originalVenues: Venue[]): string[] {
  const originalIds = originalVenues.map((v) => v.id);
  const idSet = new Set(originalIds);

  // Filter to only valid IDs that exist in original list
  const validIds = geminiIds.filter((id) => idSet.has(id));

  // Add any missing IDs at the end (in original order)
  const returnedIdSet = new Set(validIds);
  const missingIds = originalIds.filter((id) => !returnedIdSet.has(id));

  return [...validIds, ...missingIds];
}

/**
 * Creates a concise weather summary for the prompt
 */
export function createWeatherSummary(
  temperature: number,
  description: string,
  timeOfDay: string
): string {
  return `${description}, ${temperature}°C, ${timeOfDay}`;
}
