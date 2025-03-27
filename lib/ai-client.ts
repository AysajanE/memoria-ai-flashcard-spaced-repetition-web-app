import { z } from "zod";

// Request schema matching Python service
export const GenerateCardsRequestSchema = z.object({
  text: z.string().min(1),
  model: z.enum(["gpt-4", "gpt-3.5-turbo", "claude-3-opus-20240229", "claude-3-sonnet-20240229"]),
  cardType: z.enum(["qa", "cloze"]),
  numCards: z.number().min(1).max(50),
});

export type GenerateCardsRequest = z.infer<typeof GenerateCardsRequestSchema>;

// Response type
export interface GenerateCardsResponse {
  message: string;
  jobId: string;
}

export async function triggerCardGeneration(payload: GenerateCardsRequest): Promise<GenerateCardsResponse> {
  const baseUrl = process.env.AI_SERVICE_BASE_URL;
  const apiKey = process.env.INTERNAL_API_KEY;

  if (!baseUrl || !apiKey) {
    throw new Error("Missing required environment variables: AI_SERVICE_BASE_URL or INTERNAL_API_KEY");
  }

  try {
    const response = await fetch(`${baseUrl}/api/v1/generate-cards`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Internal-Api-Key": apiKey,
      },
      body: JSON.stringify(payload),
    });

    if (response.status !== 202) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(
        `AI service returned status ${response.status}: ${errorData.detail || "Unknown error"}`
      );
    }

    return response.json();
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`Failed to trigger card generation: ${error.message}`);
    }
    throw new Error("Failed to trigger card generation: Unknown error");
  }
} 