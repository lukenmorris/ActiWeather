// src/app/api/generate-summary/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';
// Import mappers AND the ActivityCategory enum
import { getSuitableCategories, getPlaceTypesForCategory, ActivityCategory, getAllMappedPlaceTypes } from '@/lib/activityMapper';
import type { WeatherData } from '@/types';

// Initialize AI Client (outside handler for reuse)
const genAI = new GoogleGenerativeAI(process.env.GOOGLE_AI_API_KEY || "");
const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash"}); // Use appropriate model

// Define expected request body structure
interface SummaryRequestBody {
    weatherData: WeatherData;
    // locationName is now derived from weatherData.name inside the handler
}

// Define expected response structure from AI
interface AiResponseFormat {
    summaryText: string;
    suggestedPlaceTypes: string[];
}

// Helper to get local time string
function getLocalTimeString(weatherData: WeatherData): string {
    try {
        const date = new Date((weatherData.dt + weatherData.timezone) * 1000);
        // Format like "3:18 AM on Sunday"
        return date.toLocaleTimeString('en-US', {
            hour: 'numeric',
            minute: '2-digit',
            timeZone: 'UTC', // IMPORTANT: We already adjusted for timezone offset, so treat the date as UTC now for formatting
            weekday: 'long'
        });
    } catch (e) {
        console.error("Error formatting local time", e);
        return "currently"; // Fallback
    }
}


export async function POST(request: NextRequest) {
    const apiKey = process.env.GOOGLE_AI_API_KEY;
    if (!apiKey) {
        return NextResponse.json({ error: "AI service not configured." }, { status: 500 });
    }

    let requestBody: SummaryRequestBody;
    try {
        requestBody = await request.json();
    } catch (error) {
        return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 });
    }

    const { weatherData } = requestBody;
    const locationName = weatherData?.name || "your area"; // Get location name from weather data

    if (!weatherData) {
        return NextResponse.json({ error: 'WeatherData is required.' }, { status: 400 });
    }

    try {
        // --- Step 1: Determine suitable types using OUR logic ---
        const suitableCategories = getSuitableCategories(weatherData); // This function now considers time
        const potentialPlaceTypes = new Set<string>();
        if (suitableCategories.length > 0) {
            suitableCategories.forEach(category => {
                getPlaceTypesForCategory(category).forEach(type => potentialPlaceTypes.add(type));
            });
        }
        const potentialTypesArray = Array.from(potentialPlaceTypes);

        // --- Step 2: Handle case where OUR logic finds nothing suitable ---
        if (potentialTypesArray.length === 0) {
            console.log("No suitable categories/types found by rule-based logic for this time/weather.");
            // Provide a specific message and empty types array
            return NextResponse.json({
                summaryText: `It's ${getLocalTimeString(weatherData)} in ${locationName}. Conditions aren't ideal for most listed activities right now.`,
                suggestedPlaceTypes: []
            });
        }

        // --- Step 3: Construct the NEW prompt for the AI ---
        const localTimeStr = getLocalTimeString(weatherData);
        const weatherDescription = weatherData.weather[0]?.description || 'varied';
        const feelsLikeTemp = weatherData.main.feels_like?.toFixed(1);

        const prompt = `
            Context:
            - Location: ${locationName}
            - Current Local Time: Approximately ${localTimeStr}
            - Current Weather: ${weatherDescription}, feels like ${feelsLikeTemp}°C.
            - Based on the time and weather, the following Google Place Types are considered generally suitable: [${potentialTypesArray.join(', ')}]

            Task:
            1. From the list of suitable Place Types provided above, select only the 2 or 3 types that represent the MOST appealing or relevant activity suggestions for someone at this specific time (${localTimeStr}). Prioritize options that might realistically be open or relevant now.
            2. Generate a short, friendly, and natural-sounding summary (1-2 sentences max) that briefly mentions the current conditions/time and suggests the specific activity types you selected. Frame it as a suggestion.
            3. Respond ONLY with a valid JSON object containing two keys:
            - "summaryText": The generated sentence string.
            - "suggestedPlaceTypes": An array containing only the 2-3 Google Place Type strings you selected from the provided list. Ensure these types EXACTLY match valid types from the input list.

            Example Input Suitable Types: [restaurant, cafe, bar, convenience_store, library, movie_theater]
            Example Response for Late Night:
            {
              "summaryText": "It's quite late and ${weatherDescription} in ${locationName}. Perhaps a late-night restaurant or a convenience store if you need something?",
              "suggestedPlaceTypes": ["restaurant", "convenience_store"]
            }
            Example Response for Rainy Afternoon:
             {
              "summaryText": "With ${weatherDescription} this afternoon in ${locationName}, maybe visit a library or catch a movie?",
              "suggestedPlaceTypes": ["library", "movie_theater"]
            }
        `;

        console.log("Sending revised prompt to AI:", prompt);

        // --- Step 4: Call AI Model ---
        const result = await model.generateContent(prompt);
        const response = result.response;
        const aiTextOutput = response.text();
        console.log("Received raw AI response:", aiTextOutput);

        // --- Step 5: Parse and Validate AI Response ---
        let parsedResponse: AiResponseFormat;
        try {
            let jsonString = aiTextOutput;
    
            // Attempt to extract JSON block more robustly
            const jsonStart = jsonString.indexOf('{');
            const jsonEnd = jsonString.lastIndexOf('}');
    
            if (jsonStart !== -1 && jsonEnd !== -1 && jsonEnd > jsonStart) {
                jsonString = jsonString.substring(jsonStart, jsonEnd + 1).trim();
            } else {
                 // If no '{' or '}' found, try cleaning potential markdown wrappers as fallback
                 jsonString = jsonString.replace(/^```json\s*|```$/g, '').trim();
            }
    
            // **DEBUG LOG:** Log the exact string before parsing
            console.log("Attempting to parse cleaned JSON string:", JSON.stringify(jsonString)); // Use JSON.stringify to see hidden chars like \n
    
            // Attempt to parse the potentially cleaned string
            parsedResponse = JSON.parse(jsonString);
    
             // Basic validation (remains the same)
             if (!parsedResponse.summaryText || !Array.isArray(parsedResponse.suggestedPlaceTypes)) {
                 throw new Error("AI response missing required keys or invalid format.");
             }
             // Validation against potential types (remains the same)
             const validSuggestedTypes = parsedResponse.suggestedPlaceTypes.filter(type => potentialPlaceTypes.has(type));
             if (validSuggestedTypes.length !== parsedResponse.suggestedPlaceTypes.length) {
                  console.warn("AI suggested types not present in the provided suitable list. Filtering to valid ones.");
             }
             parsedResponse.suggestedPlaceTypes = validSuggestedTypes;
             if(parsedResponse.suggestedPlaceTypes.length === 0) {
                  throw new Error("AI returned valid structure but no valid suggested types from the provided list.");
             }
    
        } catch (parseError: any) {
            console.error("Failed to parse or validate AI JSON response:", parseError, "Attempted to parse:", jsonString); // Log the string that failed
            // **FALLBACK**: (remains the same)
             return NextResponse.json({
               summaryText: `The weather in ${locationName} is ${weatherDescription}. Here are some generally suitable options based on conditions:`,
               suggestedPlaceTypes: potentialTypesArray
            });
        }
    
        // 6. Return Parsed Response (remains the same)
        return NextResponse.json(parsedResponse);

    } catch (error: any) {
        console.error("Error in generate-summary route:", error);
        return NextResponse.json({
            summaryText: `Sorry, couldn't generate specific suggestions right now for ${locationName}.`,
            suggestedPlaceTypes: []
        }, { status: 500 });
    }
}