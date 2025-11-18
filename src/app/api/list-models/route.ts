import { NextResponse } from 'next/server';

/**
 * GET /api/list-models
 * Lists all available Gemini models using REST API
 */
export async function GET() {
  try {
    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
      return NextResponse.json(
        { error: 'GEMINI_API_KEY not configured' },
        { status: 400 }
      );
    }

    // Call Gemini REST API to list models
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`
    );

    if (!response.ok) {
      throw new Error(`API returned ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();

    // Filter for models that support generateContent
    const generateContentModels = data.models?.filter((model: any) =>
      model.supportedGenerationMethods?.includes('generateContent')
    ) || [];

    return NextResponse.json({
      totalModels: data.models?.length || 0,
      generateContentModels: generateContentModels.length,
      models: generateContentModels.map((model: any) => ({
        name: model.name,
        displayName: model.displayName,
        description: model.description,
        inputTokenLimit: model.inputTokenLimit,
        outputTokenLimit: model.outputTokenLimit,
        supportedMethods: model.supportedGenerationMethods,
      })),
    });
  } catch (error) {
    console.error('Error listing models:', error);

    return NextResponse.json(
      {
        error: 'Failed to list models',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
