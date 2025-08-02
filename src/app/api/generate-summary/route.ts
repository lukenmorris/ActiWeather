// src/app/api/generate-summary/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';

// Import necessary functions and types from activityMapper
import { getSuitableCategories, getPlaceTypesForCategory, ActivityCategory } from '@/lib/activityMapper';
import type { WeatherData } from '@/types'; // Import WeatherData type

// Initialize AI Client (outside handler for reuse)
// Ensure GOOGLE_AI_API_KEY is set in your .env.local
const genAI = new GoogleGenerativeAI(process.env.GOOGLE_AI_API_KEY || "");
// Consider making the model name an environment variable too for flexibility
const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash"});

// Define expected request body structure from the frontend
interface SummaryRequestBody {
    weatherData: WeatherData;
    // locationName is derived from weatherData inside the handler
}

// Define expected JSON structure we want the AI to return
interface AiResponseFormat {
    summaryText: string;
    suggestedPlaceTypes: string[];
}

// Helper function to get a formatted local time string
function getLocalTimeString(weatherData: WeatherData): string {
    try {
        // Calculate the local time using the UTC timestamp and the timezone offset
        const date = new Date((weatherData.dt + weatherData.timezone) * 1000);
        // Format to something like "3:47 AM on Sunday" using UTC methods after offset adjustment
        return date.toLocaleTimeString('en-US', {
            hour: 'numeric',
            minute: '2-digit',
            timeZone: 'UTC', // Treat the offset-adjusted date as UTC for formatting
            weekday: 'long' // Add the day of the week
        });
    } catch (e) {
        console.error("Error formatting local time", e);
        return "currently"; // Fallback string
    }
}

// API Route Handler for POST requests
export async function POST(request: NextRequest) {
    // Check if AI key is configured (essential)
    const apiKey = process.env.GOOGLE_AI_API_KEY;
    if (!apiKey) {
        console.error("AI API Key (GOOGLE_AI_API_KEY) is not configured.");
        return NextResponse.json({ error: "AI service not configured properly." }, { status: 500 });
    }

    // --- Parse Request Body ---
    let requestBody: SummaryRequestBody;
    try {
        requestBody = await request.json();
    } catch (error) {
        return NextResponse.json({ error: 'Invalid request body. Expecting JSON.' }, { status: 400 });
    }

    const { weatherData } = requestBody;
    const locationName = weatherData?.name || "your area"; // Use location name from weather data

    if (!weatherData) {
        return NextResponse.json({ error: 'WeatherData object is required in the request body.' }, { status: 400 });
    }

    // Declare jsonString variable outside the try block for accessibility in catch
    let jsonString: string = '';

    try {
        // --- Step 1: Determine suitable types using rule-based logic ---
        const suitableCategories = getSuitableCategories(weatherData); // Includes time check now
        const potentialPlaceTypes = new Set<string>();
        if (suitableCategories.length > 0) {
            suitableCategories.forEach(category => {
                getPlaceTypesForCategory(category).forEach(type => potentialPlaceTypes.add(type));
            });
        }
        const potentialTypesArray = Array.from(potentialPlaceTypes);

        // --- Step 2: Handle case where rule-based logic finds nothing suitable ---
        if (potentialTypesArray.length === 0) {
            console.log("Rule-based logic found no suitable categories/types for this time/weather.");
            const timeStr = getLocalTimeString(weatherData);
            return NextResponse.json({
                summaryText: `It's ${timeStr} in ${locationName}. Conditions aren't ideal for listed activities right now.`,
                suggestedPlaceTypes: [] // Return empty array
            });
        }

        // --- Step 3: Construct the prompt for the AI Model ---
        const localTimeStr = getLocalTimeString(weatherData);
        const weatherDescription = weatherData.weather[0]?.description || 'varied';
        const feelsLikeTemp = weatherData.main.feels_like?.toFixed(1) ?? 'N/A';

        // Revised prompt focusing on categories derived from types
        const prompt = `
            Context:
            - Location: ${locationName}
            - Current Local Time: Approximately ${localTimeStr}
            - Current Weather: ${weatherDescription}, feels like ${feelsLikeTemp}°F.
            - Based on the time and weather, the following Google Place Types are considered generally suitable: [${potentialTypesArray.join(', ')}]

            Task:
            1. From the list of suitable Place Types provided above, select only the 2 or 3 types that represent the MOST appealing or relevant activity suggestions for someone right now (consider the time: ${localTimeStr}). Prioritize options that might realistically be open or relevant.
            2. Generate a short, friendly, natural-sounding summary (1-2 sentences max) briefly mentioning the current conditions/time and suggesting the specific activity types you selected. Frame it as a suggestion (e.g., "Maybe try...", "Consider...").
            3. Respond ONLY with a valid JSON object containing exactly two keys:
               - "summaryText": The generated sentence string (string).
               - "suggestedPlaceTypes": An array containing only the 2-3 Google Place Type strings you selected from the provided suitable list (string[]). Ensure these types EXACTLY match valid types from the input list. Do not add types not in the list.

            Example Input Suitable Types: [restaurant, cafe, bar, convenience_store, library, movie_theater]
            Example Response for Late Night:
            {
              "summaryText": "It's quite late (${localTimeStr}) and ${weatherDescription} in ${locationName}. Perhaps find a late-night restaurant or grab something from a convenience store?",
              "suggestedPlaceTypes": ["restaurant", "convenience_store"]
            }
            Example Response for Rainy Afternoon:
             {
              "summaryText": "With ${weatherDescription} this afternoon in ${locationName}, maybe visit a cozy library or catch a movie?",
              "suggestedPlaceTypes": ["library", "movie_theater"]
            }
            Strictly adhere to the JSON format with only the two specified keys.
        `;

        console.log("Sending revised prompt to AI:", prompt.substring(0, 500) + "..."); // Log beginning of prompt

        // --- Step 4: Call AI Model ---
        const result = await model.generateContent(prompt);
        const response = result.response;
        const aiTextOutput = response.text();
        console.log("Received raw AI response:", aiTextOutput);

        // --- Step 5: Parse and Validate AI Response ---
        let parsedResponse: AiResponseFormat | null = null; // Initialize as null instead of using type annotation only
        // Assign raw output before attempting cleanup/parsing
        jsonString = aiTextOutput;

        // Attempt to extract JSON block robustly
        const jsonStart = jsonString.indexOf('{');
        const jsonEnd = jsonString.lastIndexOf('}');

        if (jsonStart !== -1 && jsonEnd !== -1 && jsonEnd > jsonStart) {
            jsonString = jsonString.substring(jsonStart, jsonEnd + 1).trim();
        } else {
             // Fallback to regex clean if {} not found directly
             jsonString = jsonString.replace(/^```json\s*|```$/g, '').trim();
        }

        console.log("Attempting to parse cleaned JSON string:", JSON.stringify(jsonString)); // Log the cleaned string

        // Attempt parsing
        parsedResponse = JSON.parse(jsonString);

        // Validate structure
        if (!parsedResponse || !parsedResponse.summaryText || !Array.isArray(parsedResponse.suggestedPlaceTypes)) {
            throw new Error("AI response missing required keys (summaryText, suggestedPlaceTypes) or invalid array format.");
        }

        // Validate suggested types against the potential list
        const validSuggestedTypes = parsedResponse.suggestedPlaceTypes.filter(type => potentialPlaceTypes.has(type));
        if (validSuggestedTypes.length !== parsedResponse.suggestedPlaceTypes.length) {
             console.warn("AI suggested types not present in the provided suitable list. Filtering to valid ones only.");
        }

        // Ensure we have at least one valid suggested type if the structure was okay
        if (validSuggestedTypes.length === 0) {
             throw new Error("AI returned valid structure but no valid suggested types from the provided list.");
        }
        parsedResponse.suggestedPlaceTypes = validSuggestedTypes; // Use only the valid subset


        // --- Step 6: Return Parsed Response ---
        console.log("Successfully parsed AI response:", parsedResponse);
        return NextResponse.json(parsedResponse);

    // --- Catch block for all errors within the main try (including AI call, parsing, validation) ---
    } catch (error: any) {
        console.error("Error in AI Summary Generation Process:", error);
        // Log the string that potentially caused a parse error if `jsonString` has content
        if(jsonString && error instanceof SyntaxError){
             console.error("String that failed JSON parsing:", jsonString);
        }

        // Fallback logic: Determine suitable types again (in case they weren't calculated before error)
        const suitableCategories = getSuitableCategories(weatherData);
        const potentialPlaceTypes = new Set<string>();
         if (suitableCategories.length > 0) {
            suitableCategories.forEach(category => {
                getPlaceTypesForCategory(category).forEach(type => potentialPlaceTypes.add(type));
            });
         }
        const potentialTypesArray = Array.from(potentialPlaceTypes);
        const weatherDescription = weatherData?.weather[0]?.description || 'varied';

        // Return a more informative fallback response
        return NextResponse.json({
           summaryText: `Couldn't generate specific suggestions for ${locationName} (${weatherDescription}). Showing general options suitable for the conditions:`,
           suggestedPlaceTypes: potentialTypesArray // Return ALL rule-based types if AI fails
        });
        // Note: We don't return a 500 error here, allowing the frontend to proceed with fallback types
    }
}