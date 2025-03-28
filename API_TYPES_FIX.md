# API Type Mismatches Resolution

This document describes the changes needed to fix type mismatches between the frontend and backend API schema definitions.

## Issue

The frontend and backend have mismatched schema definitions:

1. **Request Schema Mismatch**
   - **Frontend**: Defines fields `model`, `cardType`, and `numCards` at the root level
   - **Backend**: Only accepts `jobId`, `text`, and an optional nested `config` object

2. **Nested Config vs. Flat Structure**
   - **Frontend**: Sends configuration fields directly at the root level
   - **Backend**: Expects configuration in a nested `config` object

3. **Field Naming Differences**
   - Card type field differences: `cardType` vs. `type`

## Solution Approach

We will use a comprehensive approach to fix these mismatches:

1. **Update Backend Schema** to be more specific and match frontend expectations
2. **Standardize Request Handling** to ensure proper field mapping
3. **Create Shared Type Definitions** where possible

## Implementation Steps

### 1. Update Backend Schema (ai-service)

Update the `GenerateCardsRequest` in `ai_tasks.py`:

```python
from pydantic import BaseModel, Field
from typing import Dict, Optional, Literal

class GenerateCardsRequest(BaseModel):
    """Request schema for card generation endpoint."""
    jobId: str
    text: str
    model: Optional[str] = Field(None, description="AI model to use for generation")
    cardType: Optional[Literal["qa", "cloze"]] = Field("qa", description="Type of flashcards to generate")
    numCards: Optional[int] = Field(10, description="Number of cards to generate", ge=1, le=50)
    config: Optional[Dict] = Field({}, description="Additional configuration options")
```

### 2. Update Backend Request Handler (ai_tasks.py)

Modify the processing function to handle both direct fields and the config field:

```python
async def process_ai_job(job_id: str, input_data: Dict[str, Any]) -> None:
    try:
        # Extract input text and settings - allow direct fields or config
        text = input_data.get("text")
        
        # Primary fields - check direct fields first, then fall back to config
        model = input_data.get("model") or input_data.get("config", {}).get("model", "gpt-3.5-turbo")
        card_type = input_data.get("cardType") or input_data.get("config", {}).get("cardType", "qa")
        num_cards = input_data.get("numCards") or input_data.get("config", {}).get("numCards", 10)
        
        # Process card generation with all parameters
        await process_card_generation(
            job_id=job_id,
            input_text=text,
            model=model,
            card_type=card_type,
            num_cards=num_cards,
            start_time=time.time()
        )
        
        # ... rest of the function remains the same
```

### 3. Update Frontend Client (ai-client.ts)

Modify the frontend client to structure the request properly:

```typescript
export const GenerateCardsRequestSchema = z.object({
  jobId: z.string().uuid(),
  text: z.string().min(1),
  model: z.enum(["gpt-4", "gpt-3.5-turbo", "claude-3-opus-20240229", "claude-3-sonnet-20240229"]).optional(),
  cardType: z.enum(["qa", "cloze"]).optional(),
  numCards: z.number().min(1).max(50).optional(),
  config: z.record(z.any()).optional(),
});

export async function triggerCardGeneration(payload: { 
  jobId: string; 
  text: string;
  model?: string;
  cardType?: "qa" | "cloze";
  numCards?: number;
}): Promise<void> {
  // ... existing code

  try {
    // Set defaults if not provided
    const fullPayload = {
      jobId: payload.jobId,
      text: payload.text,
      model: payload.model || "gpt-4",
      cardType: payload.cardType || "qa", 
      numCards: payload.numCards || 10,
      // Include a config object for backward compatibility
      config: {
        model: payload.model || "gpt-4",
        cardType: payload.cardType || "qa",
        numCards: payload.numCards || 10
      }
    };

    // ... rest of function remains the same
```

### 4. Update Core Processing Logic (logic.py)

Update the `process_card_generation` function to accept additional parameters:

```python
async def process_card_generation(
    job_id: str,
    input_text: str,
    model: str,
    card_type: str = "qa",
    num_cards: int = 10,
    start_time: float = None
) -> None:
    """Process card generation and send webhook with retries"""
    start_time = start_time or time.time()
    
    try:
        # ... token check logic

        # Generate cards using AI - pass all parameters
        result = await generate_cards_with_ai(
            text=input_text,
            model_name=model,
            card_type=card_type,
            num_cards=num_cards,
            system_prompt=settings.DEFAULT_SYSTEM_PROMPT
        )
        
        # ... rest of function remains the same
```

### 5. Update AI Caller Function (ai_caller.py)

Modify the AI caller to use all provided parameters:

```python
async def generate_cards_with_ai(
    text: str,
    model_name: str = "gpt-3.5-turbo",
    card_type: str = "qa",
    num_cards: int = 10,
    system_prompt: str = None
) -> str:
    # Adjust system prompt to include card type and number
    adjusted_prompt = system_prompt.format(
        card_type=card_type,
        num_cards=min(num_cards, 50)  # Cap at 50 for safety
    ) if system_prompt else "Generate flashcards from the given text."
    
    # ... existing AI calling logic
```

## Testing Plan

1. **Automated Tests**: Create integration tests for API communication
2. **Manual Testing**: Test frontend-backend communication with various parameters
3. **Backward Compatibility**: Ensure existing jobs continue to work with the updated schema

## Future Considerations

1. **OpenAPI Integration**: Consider generating TypeScript types from OpenAPI schema
2. **Shared Type Libraries**: Create a shared type library that both frontend and backend can reference
3. **Validation Library**: Adopt a common validation approach across frontend and backend