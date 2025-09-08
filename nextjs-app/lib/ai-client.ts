import { z } from "zod";

// Form input validation schema (without jobId requirement)
export const FormInputSchema = z.object({
  text: z.string().min(1, "Text is required").max(50000, "Text too long (50k char max)"),
  model: z.enum(["gpt-4o-mini", "claude-haiku-3-5-latest"]).optional(),
  cardType: z.enum(["qa", "cloze"]).optional(),
  numCards: z.number().min(1).max(50).optional(),
});

// Request schema matching Python service
export const GenerateCardsRequestSchema = z.object({
  jobId: z.string().uuid(),
  text: z.string().min(1).max(50000),
  model: z.enum(["gpt-4o-mini", "claude-haiku-3-5-latest"]).optional(),
  cardType: z.enum(["qa", "cloze"]).optional(),
  numCards: z.number().min(1).max(50).optional(),
  config: z.record(z.any()).optional(),
});

export type GenerateCardsRequest = z.infer<typeof GenerateCardsRequestSchema>;

// Response type
export interface GenerateCardsResponse {
  message: string;
  jobId: string;
}

// Model information type
export interface AIModel {
  provider: string;
  description: string;
  maxInputTokens: number;
  maxOutputTokens: number;
  isDefault: boolean;
}

export interface ModelsResponse {
  models: Record<string, AIModel>;
  defaultOpenAI: string;
  defaultAnthropic: string;
}

/**
 * Fetch available AI models from the service
 */
export async function getAvailableModels(): Promise<ModelsResponse> {
  const baseUrl = process.env.AI_SERVICE_BASE_URL;
  const apiKey = process.env.INTERNAL_API_KEY;

  if (!baseUrl || !apiKey) {
    throw new Error("Missing required environment variables: AI_SERVICE_BASE_URL or INTERNAL_API_KEY");
  }

  try {
    const response = await fetch(`${baseUrl}/api/v1/available-models`, {
      method: "GET",
      headers: {
        "Accept": "application/json",
        "X-Internal-Api-Key": apiKey,
      },
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(
        `AI service returned status ${response.status}: ${errorData.detail || "Unknown error"}`
      );
    }

    return await response.json();
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`Failed to fetch available models: ${error.message}`);
    }
    throw new Error("Failed to fetch available models: Unknown error");
  }
}

export async function triggerCardGeneration(payload: { 
  jobId: string; 
  text: string;
  model?: string;
  provider?: "openai" | "anthropic";
  cardType?: "qa" | "cloze";
  numCards?: number;
}): Promise<void> {
  const baseUrl = process.env.AI_SERVICE_BASE_URL;
  const apiKey = process.env.INTERNAL_API_KEY;

  if (!baseUrl || !apiKey) {
    throw new Error("Missing required environment variables: AI_SERVICE_BASE_URL or INTERNAL_API_KEY");
  }

  try {
    // Define model parameter based on provider preference if specified but no specific model
    let model = payload.model;
    if (!model && payload.provider) {
      model = payload.provider === "anthropic" ? "claude-haiku-3-5-latest" : "gpt-4o-mini";
    }
    
    // Set defaults if not provided
    const fullPayload = {
      jobId: payload.jobId,
      text: payload.text,
      model: model || "gpt-4o-mini", // Default to OpenAI's model
      cardType: payload.cardType || "qa",
      numCards: payload.numCards || 10,
      config: {
        provider: payload.provider || "openai",
        cardType: payload.cardType || "qa",
        numCards: payload.numCards || 10
      }
    };

    const response = await fetch(`${baseUrl}/api/v1/generate-cards`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Internal-Api-Key": apiKey,
      },
      body: JSON.stringify(fullPayload),
    });

    if (response.status !== 202) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(
        `AI service returned status ${response.status}: ${errorData.detail || "Unknown error"}`
      );
    }

    const data = await response.json();
    return;
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`Failed to trigger card generation: ${error.message}`);
    }
    throw new Error("Failed to trigger card generation: Unknown error");
  }
} 
