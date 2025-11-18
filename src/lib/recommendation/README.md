# Hybrid Recommendation Engine

A sophisticated, weather-aware activity recommendation system that combines **Dynamic Contextual Scoring** with **AI Reranking** using Google Gemini.

## Architecture Overview

```
┌─────────────────┐
│ User Request    │
│ (location,      │
│  weather prefs) │
└────────┬────────┘
         │
         ▼
┌─────────────────────────────┐
│ 1. Dynamic Weight           │
│    Calculation              │
│    • Analyzes weather       │
│    • Adjusts importance of  │
│      scoring factors        │
└────────┬────────────────────┘
         │
         ▼
┌─────────────────────────────┐
│ 2. Venue Fetching           │
│    • Google Places API      │
│    • Filtered by type/range │
└────────┬────────────────────┘
         │
         ▼
┌─────────────────────────────┐
│ 3. Mathematical Scoring     │
│    • Weather appropriateness│
│    • Time of day fit        │
│    • Distance proximity     │
│    • Popularity/ratings     │
└────────┬────────────────────┘
         │
         ▼
┌─────────────────────────────┐
│ 4. AI Reranking (Gemini)    │
│    • Semantic understanding │
│    • Contextual reasoning   │
│    • Experience optimization│
└────────┬────────────────────┘
         │
         ▼
┌─────────────────────────────┐
│ Final Ranked Results        │
└─────────────────────────────┘
```

## Key Components

### 1. Type Definitions ([types/recommendation.ts](../../types/recommendation.ts))

Comprehensive TypeScript interfaces for:
- `WeatherContext` - Weather data and severity scoring
- `Venue` - Place data with scoring metadata
- `UserPreferences` - User inputs (mood, budget, location)
- `ScoringWeights` - Dynamic weight allocation

### 2. Dynamic Weighting ([lib/scoring/dynamicWeights.ts](../scoring/dynamicWeights.ts))

**Standard Weights (Pleasant Weather):**
- Weather: 35%
- Time: 30%
- Distance: 20%
- Popularity: 15%

**Extreme Weather Weights:**
- Weather: 60% ⬆️
- Time: 20%
- Distance: 12%
- Popularity: 8%

**Triggers for Extreme Mode:**
- Severity score ≥ 0.7
- Thunderstorms, heavy rain, snow
- Temperature < 0°C or > 38°C

### 3. Venue Scoring ([lib/scoring/venueScorer.ts](../scoring/venueScorer.ts))

Four scoring dimensions (0-100 each):

**Weather Score:**
- Indoor venues boost in bad weather
- Outdoor venues boost in good weather
- Temperature-based adjustments

**Time Score:**
- Cafes → morning preference
- Museums → afternoon preference
- Bars/clubs → evening/night preference
- Closed venues heavily penalized

**Distance Score:**
- 0-500m: 100 points
- 500m-1km: 90 points
- 1-2km: 75 points
- 2-5km: 50 points
- 5km+: 25 points or less

**Popularity Score:**
- Based on Google ratings (0-5 stars)
- Review count boosts confidence
- High ratings + many reviews = maximum score

### 4. AI Reranking ([lib/ai/geminiReranker.ts](../ai/geminiReranker.ts))

**Purpose:** Semantic understanding beyond math

**Process:**
1. Takes top 15 mathematically-scored venues
2. Sends structured prompt to Gemini 1.5 Flash
3. Asks AI to reorder based on "best experience" given weather
4. Validates and merges AI response

**Graceful Fallbacks:**
- No API key → returns original order
- API error → returns original order
- Invalid response → returns original order
- Missing venue IDs → fills in from original order

### 5. Main Controller ([app/api/recommendations/route.ts](../../app/api/recommendations/route.ts))

**API Endpoint:** `POST /api/recommendations`

**Request Body:**
```typescript
{
  weather: {
    temp: 15,
    conditionCode: 800,
    severityScore: 0.2,
    timeOfDay: "afternoon",
    description: "Clear sky",
    timestamp: "2025-01-17T14:30:00Z"
  },
  userPreferences: {
    location: { lat: 40.7128, lng: -74.0060 },
    radius: 5000,
    mood: "adventurous",
    budget: 2,
    preferredTypes: ["museum", "park", "restaurant"]
  },
  maxResults: 10
}
```

**Response:**
```typescript
{
  venues: Venue[], // Top N ranked venues
  weatherContext: WeatherContext,
  weightsUsed: ScoringWeights,
  aiRerankingApplied: boolean,
  timestamp: Date
}
```

## Usage Example

### From a Next.js Component

```typescript
'use client';

import { useState } from 'react';
import { RecommendationRequest, RecommendationResponse } from '@/types/recommendation';

export function RecommendationButton() {
  const [loading, setLoading] = useState(false);
  const [recommendations, setRecommendations] = useState<RecommendationResponse | null>(null);

  async function fetchRecommendations() {
    setLoading(true);

    const request: RecommendationRequest = {
      weather: {
        temp: 22,
        conditionCode: 800, // Clear sky
        severityScore: 0.1,
        timeOfDay: 'afternoon',
        description: 'Clear sky',
        timestamp: new Date(),
      },
      userPreferences: {
        location: { lat: 40.7128, lng: -74.0060 },
        radius: 5000,
        mood: 'relaxed',
        budget: 2,
      },
      maxResults: 10,
    };

    try {
      const response = await fetch('/api/recommendations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(request),
      });

      const data: RecommendationResponse = await response.json();
      setRecommendations(data);
    } catch (error) {
      console.error('Failed to fetch recommendations:', error);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <button onClick={fetchRecommendations} disabled={loading}>
        {loading ? 'Loading...' : 'Get Recommendations'}
      </button>

      {recommendations && (
        <div>
          <h2>Top Recommendations</h2>
          <p>AI Reranking: {recommendations.aiRerankingApplied ? 'Yes' : 'No'}</p>

          <ul>
            {recommendations.venues.map((venue) => (
              <li key={venue.id}>
                <strong>{venue.name}</strong>
                <br />
                Score: {venue.computedScore.toFixed(1)}
                <br />
                {venue.distanceMeters && `Distance: ${(venue.distanceMeters / 1000).toFixed(1)}km`}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
```

### From a Server Action

```typescript
'use server';

import { calculateDynamicWeights } from '@/lib/scoring/dynamicWeights';
import { scoreAndSortVenues } from '@/lib/scoring/venueScorer';
import { rerankWithGemini } from '@/lib/ai/geminiReranker';

export async function getRecommendationsAction(
  lat: number,
  lng: number,
  weatherData: any
) {
  const weather = {
    temp: weatherData.main.temp,
    conditionCode: weatherData.weather[0].id,
    severityScore: calculateSeverity(weatherData),
    timeOfDay: getTimeOfDay(),
    description: weatherData.weather[0].description,
    timestamp: new Date(),
  };

  const weights = calculateDynamicWeights(weather);

  // ... fetch and score venues
  // ... apply AI reranking

  return recommendations;
}
```

## Environment Variables Required

```bash
# Google Places API (for venue fetching)
NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=your_google_api_key

# Google Gemini AI (for reranking)
GEMINI_API_KEY=your_gemini_api_key
```

## Installation

This project uses **pnpm** for package management.

```bash
# Install dependencies
pnpm install

# Development server
pnpm dev

# Build for production
pnpm build

# Start production server
pnpm start

# Run linter
pnpm lint
```

## Error Handling

The system is designed to **never fail completely**:

1. **Missing Gemini API Key** → Skips AI reranking, uses math scores only
2. **Gemini API Error** → Falls back to original mathematical ranking
3. **Invalid AI Response** → Falls back to original ranking
4. **Google Places API Error** → Returns empty results with error message
5. **Network Issues** → Caught and logged, returns appropriate error response

## Testing

### Unit Test Example

```typescript
import { calculateDynamicWeights } from '@/lib/scoring/dynamicWeights';
import { WeatherContext } from '@/types/recommendation';

describe('Dynamic Weights', () => {
  it('should increase weather weight in extreme conditions', () => {
    const extremeWeather: WeatherContext = {
      temp: -5,
      conditionCode: 600, // Snow
      severityScore: 0.8,
      timeOfDay: 'afternoon',
      description: 'Heavy snow',
      timestamp: new Date(),
    };

    const weights = calculateDynamicWeights(extremeWeather);

    expect(weights.weather).toBeGreaterThan(0.55);
    expect(weights.weather + weights.time + weights.distance + weights.popularity).toBe(1.0);
  });
});
```

## Performance Considerations

- **Google Places API**: Fetches multiple types in parallel, deduplicates results
- **Scoring**: O(n) complexity for n venues
- **AI Reranking**: Only top 15 venues sent to Gemini (reduces tokens and latency)
- **Caching**: Consider implementing Redis cache for popular locations

## Future Enhancements

- [ ] User preference learning (collaborative filtering)
- [ ] Time-based cache warming for popular areas
- [ ] Multi-model AI ensemble (Gemini + Claude)
- [ ] Real-time weather monitoring and push notifications
- [ ] Venue category specialization (food vs. activities)
