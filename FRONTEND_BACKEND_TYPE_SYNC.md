# Frontend-Backend Type Synchronization

This document explains the changes made to align the frontend and backend type definitions, particularly for the AI card generation service.

## Issue Addressed

There were several mismatches between frontend and backend types:

1. **Request Schema Mismatches**:
   - **Frontend**: The `GenerateCardsRequestSchema` included fields like `model`, `cardType`, and `numCards`
   - **Backend**: The `GenerateCardsRequest` only had `jobId`, `text`, and an optional `config` field

2. **Config Handling Mismatch**:
   - **Frontend**: Sent fields like `model` directly at the root level
   - **Backend**: Expected a nested `config` object containing settings like `model`

3. **Field Naming Differences**:
   - Card type field differences: `cardType` vs. `type`

These mismatches could lead to runtime errors, especially when adding new features.

## Changes Made

### 1. Updated Backend Schema (ai_tasks.py)

Updated the backend request schema to include all fields from the frontend:

```python
class GenerateCardsRequest(BaseModel):
    """Request schema for card generation endpoint."""
    jobId: str
    text: str
    model: Optional[str] = Field(None, description="AI model to use for generation")
    cardType: Optional[Literal["qa", "cloze"]] = Field("qa", description="Type of flashcards to generate")
    numCards: Optional[int] = Field(10, description="Number of cards to generate", ge=1, le=50)
    config: Optional[Dict] = Field(default_factory=dict, description="Additional configuration options")
```

### 2. Updated API Handler (ai_tasks.py)

Modified the handler to accept parameters from both direct fields and nested config:

```python
async def process_ai_job(job_id: str, input_data: Dict[str, Any]) -> None:
    # Extract input text - required
    text = input_data.get("text")
    if not text:
        raise ValueError("No text provided in input data")
    
    # Extract other parameters, prioritizing direct fields over config
    model = input_data.get("model") or input_data.get("config", {}).get("model", "gpt-3.5-turbo")
    card_type = input_data.get("cardType") or input_data.get("config", {}).get("cardType", "qa")
    num_cards = input_data.get("numCards") or input_data.get("config", {}).get("numCards", 10)
    
    # Ensure num_cards is within reasonable limits
    num_cards = max(1, min(int(num_cards), 50))
```

### 3. Enhanced AI Processing (logic.py and ai_caller.py)

Updated the AI processing logic to handle new parameters:

```python
async def process_card_generation(
    job_id: str,
    input_text: str,
    model: str,
    card_type: str = "qa",
    num_cards: int = 10,
    start_time: float = None
) -> None:
    # ...processing logic...
```

```python
async def generate_cards_with_ai(
    text: str,
    model_name: str,
    system_prompt: str,
    card_type: str = "qa",
    num_cards: int = 10,
    max_retries: int = 3,
    retry_delay: float = 1.0
) -> str:
    # ...AI generation logic...
```

### 4. Updated Frontend Client (ai-client.ts)

Extended the frontend client to work with the updated backend:

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
  // ...rest of function...
  
  // Send both direct fields and config object for backward compatibility
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
}
```

### 5. Updated System Prompt (config.py)

Modified the default system prompt to incorporate templated parameters:

```python
DEFAULT_SYSTEM_PROMPT: str = """You are an expert study assistant. Your task is to generate high-quality flashcards from the provided text. Create {num_cards} flashcards, focusing on {card_type} type cards.

# ... rest of prompt ...
"""
```

## Benefits

These changes provide several benefits:

1. **Type Safety**: Frontend and backend now share consistent type definitions
2. **Backward Compatibility**: Continues to support existing implementations
3. **Feature Extensibility**: Easier to add new parameters in the future
4. **Tailored Output**: AI system prompt now adapts to user preferences

## Future Recommendations

1. **OpenAPI Schema**: Consider using OpenAPI/Swagger to generate types automatically
2. **Shared Type Library**: Create a shared type library for both frontend and backend
3. **Runtime Type Validation**: Implement comprehensive runtime validation on both sides
4. **Automated Tests**: Add integration tests that verify type compatibility