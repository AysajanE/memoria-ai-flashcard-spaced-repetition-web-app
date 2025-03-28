import { z } from "zod";

// Request schema matching Python service
export const GenerateCardsRequestSchema = z.object({
  jobId: z.string().uuid(),
  text: z.string().min(1),
  model: z.enum(["gpt-4", "gpt-3.5-turbo", "claude-3-opus-20240229", "claude-3-sonnet-20240229"]).optional(),
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

export async function triggerCardGeneration(payload: { 
  jobId: string; 
  text: string;
  model?: string;
  cardType?: "qa" | "cloze";
  numCards?: number;
}): Promise<void> {
  const baseUrl = process.env.AI_SERVICE_BASE_URL;
  const apiKey = process.env.INTERNAL_API_KEY;

  if (!baseUrl || !apiKey) {
    throw new Error("Missing required environment variables: AI_SERVICE_BASE_URL or INTERNAL_API_KEY");
  }

  try {
    // Set defaults if not provided
    const fullPayload = {
      jobId: payload.jobId,
      text: payload.text,
      model: payload.model || "gpt-4",
      cardType: payload.cardType || "qa",
      numCards: payload.numCards || 10,
      // Include config object for backward compatibility
      config: {
        model: payload.model || "gpt-4",
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