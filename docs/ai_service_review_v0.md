## Executive summary

**Strengths**

* Clean FastAPI structure with versioned router (`/api/v1`).
* Clear separation of concerns: config, schemas, AI calling, logic, dependencies.
* Good webhook design with retry and exponential backoff; structured error payloads.
* Sensible default system prompt and explicit token budgeting concepts.
* Uses Pydantic v2 models and settings; background task offloads heavy work.

**Critical issues (must fix)**

1. **Exception name collision breaks OpenAI rate‑limit retries.**
   Your custom `RateLimitError` class shadows OpenAI’s exception of the same name, so OpenAI rate-limit exceptions are **not** caught by the intended `except RateLimitError` block. This silently disables backoff logic.
2. **Anthropic API is called synchronously from an async path.**
   `anthropic_client = anthropic.Anthropic(...)` + `messages.create(...)` is synchronous in an `async` function, blocking the event loop.
3. **ErrorCategory enum mismatches your custom exception `.category` values.**
   Converting strings like `"token_limit_error"` to `ErrorCategory` (`"token_limit"`) raises a validation error, which can mask the original failure and break webhook error reporting.
4. **CORS misconfiguration: `allow_credentials=True` + `allow_origins=["*"]`.**
   This combination is invalid for browsers, and Starlette/FastAPI will refuse it in practice.
5. **Background task raises `HTTPException` (ineffective).**
   Exceptions raised inside `BackgroundTasks` won’t be delivered to the original caller; you already do webhook-based error delivery in `process_card_generation`.
6. **Logging configuration ignores `LOG_LEVEL` and doesn’t handle `extra` metadata correctly.**
   Your JSON formatter looks for a non-standard `record.extra`, so structured fields passed via `extra={...}` aren’t included.

**High-value improvements**

* Enforce JSON outputs with OpenAI (`response_format={"type":"json_object"}`) and robust text-block concatenation for Anthropic.
* Token limits: gate by **model-specific** limits (from `AI_MODELS`) not just global defaults.
* Stricter parsing & validation of AI output (`front`/`back` types and lengths).
* Idempotency & deduplication by `jobId` (especially if the frontend can inadvertently retry).
* Observability: correlation IDs, request duration, and consistent JSON logs with app/route fields.
* Make `available-models` optionally protected (or rate-limited) to avoid unnecessary exposure.

---

## Data flow (current)

1. Next.js calls `POST /api/v1/generate-cards` with `X-Internal-API-Key` → FastAPI accepts 202 → schedules `process_ai_job` as background task.
2. Background extracts params and calls `process_card_generation`.
3. `process_card_generation` does token checks, calls `generate_cards_with_ai` → `_generate_with_openai | _generate_with_anthropic`.
4. Raw text → `parse_ai_response` → structured cards; checks output token budgets.
5. Sends final webhook (success or structured error) to Next.js via `send_webhook_with_retry`.

---

## Critical fixes (with patches)

### 1) Fix exception name collision + improve API clients and JSON mode

**Why:** Your `RateLimitError` class masks OpenAI’s exception, so no retry/backoff occurs for rate limits. Anthropic call is sync in async function. Also add JSON-mode for OpenAI to improve parse reliability.

**Patch — `app/core/ai_caller.py`**

```diff
diff --git a/ai-service/app/core/ai_caller.py b/ai-service/app/core/ai_caller.py
index 5b1b2ab..9f77dcd 100644
--- a/ai-service/app/core/ai_caller.py
+++ b/ai-service/app/core/ai_caller.py
@@ -1,63 +1,66 @@
-import logging
-import asyncio
-from typing import Optional
-
-import openai
-from openai import AsyncOpenAI
-# Updated imports for OpenAI v1.x
-from openai import (
-    APITimeoutError,
-    RateLimitError,
-    APIConnectionError,
-    AuthenticationError,
-    BadRequestError,
-    APIError
-)
-
-# Add Anthropic import
-import anthropic
+import logging
+import asyncio
+from typing import Optional
+
+from openai import AsyncOpenAI
+# Updated imports for OpenAI v1.x (alias to avoid name clashes)
+from openai import (
+    APITimeoutError,
+    RateLimitError as OpenAIRateLimitError,
+    APIConnectionError,
+    AuthenticationError as OpenAIAuthenticationError,
+    BadRequestError,
+    APIError as OpenAIAPIError,
+)
+
+# Anthropic async client
+from anthropic import AsyncAnthropic
+import anthropic
 
 from app.config import settings, get_model_config
 
 logger = logging.getLogger(__name__)
 
 class AIError(Exception):
@@ -93,13 +96,13 @@ class AIServiceError(AIError):
     code = "AI_SERVICE_ERROR"
     suggested_action = "Try again later or contact support."
 
-class AuthError(AIError):
+class AuthError(AIError):
     """Exception for authentication errors."""
     category = "auth_error"
     retryable = False
     code = "AUTH_ERROR"
     suggested_action = "Check API key configuration."
 
-class RateLimitError(AIError):
+class RateLimitExceeded(AIError):
     """Exception for rate limit errors."""
     category = "rate_limit_error"
     retryable = True
     code = "RATE_LIMIT_EXCEEDED"
     suggested_action = "Try again later with exponential backoff."
@@ -123,12 +126,12 @@ class AIModelError(AIError):
     suggested_action = "Try a different model or adjust parameters."
 
 # Initialize OpenAI client
 try:
-    openai_client = AsyncOpenAI(api_key=settings.OPENAI_API_KEY)
+    openai_client = AsyncOpenAI(api_key=settings.OPENAI_API_KEY)
 except Exception as e:
     logger.error(f"Failed to initialize OpenAI client: {str(e)}")
     raise AIServiceError(f"Failed to initialize OpenAI client: {str(e)}")
 
-# Initialize Anthropic client
+# Initialize Anthropic async client
 try:
-    anthropic_client = anthropic.Anthropic(api_key=settings.ANTHROPIC_API_KEY)
+    anthropic_client = AsyncAnthropic(api_key=settings.ANTHROPIC_API_KEY)
 except Exception as e:
     logger.error(f"Failed to initialize Anthropic client: {str(e)}")
     raise AIServiceError(f"Failed to initialize Anthropic client: {str(e)}")
@@ -185,21 +188,26 @@ async def _generate_with_openai(
     messages = [
         {"role": "system", "content": system_prompt},
         {"role": "user", "content": text}
     ]
     
+    # pick a safe output budget based on config
+    from app.config import get_model_config as _get_cfg  # local import to avoid cycles
+    budget = min(settings.MAX_OUTPUT_TOKENS, _get_cfg(model_name)["max_output_tokens"])
+
     # Attempt API call with retries
     for attempt in range(max_retries):
         try:
             response = await openai_client.chat.completions.create(
                 model=model_name,
                 messages=messages,
                 temperature=0.7,
-                max_tokens=2000  # Adjust based on model's context window
+                max_tokens=budget,
+                # enforce structured JSON where supported
+                response_format={"type": "json_object"},
             )
             return response.choices[0].message.content
             
         except BadRequestError as e:
             error_msg = str(e).lower()
             context = {"original_error": str(e)}
@@ -222,9 +230,9 @@ async def _generate_with_openai(
                     context=context
                 )
             
-        except AuthenticationError as e:
+        except OpenAIAuthenticationError as e:
             logger.error(f"Authentication error with OpenAI API: {str(e)}")
-            raise AuthError(
+            raise AuthError(
                 "Failed to authenticate with AI service",
                 context={"original_error": str(e)}
             )
@@ -232,12 +240,12 @@ async def _generate_with_openai(
-        except RateLimitError as e:
+        except OpenAIRateLimitError as e:
             if attempt < max_retries - 1:
                 logger.warning(f"Rate limit hit, retrying in {retry_delay}s...")
                 await asyncio.sleep(retry_delay)
                 continue
             
-            raise RateLimitError(
+            raise RateLimitExceeded(
                 f"Rate limit exceeded after {max_retries} attempts",
-                context={"original_error": str(e), "attempts": max_retries}
+                context={"original_error": str(e), "attempts": max_retries, "provider": "openai"}
             )
             
         except (APITimeoutError, APIConnectionError) as e:
             if attempt < max_retries - 1:
@@ -251,7 +259,7 @@ async def _generate_with_openai(
                 context={"original_error": str(e), "attempts": max_retries}
             )
             
-        except APIError as e:
+        except OpenAIAPIError as e:
             if e.status_code >= 500 and attempt < max_retries - 1:
                 logger.warning(f"Server error, retrying in {retry_delay}s...")
                 await asyncio.sleep(retry_delay)
                 continue
@@ -289,15 +297,21 @@ async def _generate_with_anthropic(
     """Generate cards using Anthropic API"""
     
     # Attempt API call with retries
     for attempt in range(max_retries):
         try:
-            # Anthropic's API is a bit different from OpenAI's
-            response = anthropic_client.messages.create(
+            # Anthropic's async Messages API
+            from app.config import get_model_config as _get_cfg  # local import to avoid cycles
+            budget = min(settings.MAX_OUTPUT_TOKENS, _get_cfg(model_name)["max_output_tokens"])
+
+            response = await anthropic_client.messages.create(
                 model=model_name,
                 system=system_prompt,
                 messages=[{"role": "user", "content": text}],
                 temperature=0.7,
-                max_tokens=2000
+                max_tokens=budget
             )
-            return response.content[0].text
+            # content can contain multiple blocks; collect text blocks
+            parts = [b.text for b in response.content if getattr(b, "type", None) == "text"]
+            return "".join(parts).strip()
             
         except anthropic.APIStatusError as e:
             error_msg = str(e).lower()
             context = {"original_error": str(e)}
@@ -329,14 +343,14 @@ async def _generate_with_anthropic(
                     await asyncio.sleep(retry_delay)
                     continue
                 
-                raise RateLimitError(
+                raise RateLimitExceeded(
                     f"Rate limit exceeded after {max_retries} attempts",
-                    context={"original_error": str(e), "attempts": max_retries}
+                    context={"original_error": str(e), "attempts": max_retries, "provider": "anthropic"}
                 )
             elif e.status_code >= 500:
                 logger.error(f"Unexpected Anthropic API error: {str(e)}")
                 raise AIServiceError(
                     f"Unexpected AI service error: {str(e)}",
                     context={"original_error": str(e)}
                 )
```

**Also update imports of the renamed class** (`RateLimitExceeded`) where used:

**`app/core/logic.py`**

```diff
- from app.core.ai_caller import generate_cards_with_ai, TokenLimitError, AIServiceError, AuthError, RateLimitError, NetworkError, AIModelError
+ from app.core.ai_caller import generate_cards_with_ai, TokenLimitError, AIServiceError, AuthError, RateLimitExceeded, NetworkError, AIModelError
```

**`app/api/v1/ai_tasks.py`**

```diff
- from app.core.ai_caller import TokenLimitError, AIServiceError
+ from app.core.ai_caller import TokenLimitError, AIServiceError
# (no further change needed here since exceptions are handled lower in logic)
```

> If you prefer to keep your custom class name, alias OpenAI's exception on import (`as OpenAIRateLimitError`) and change the `except` to catch the aliased type. The patch above renames your custom class instead—clearer and safer.

---

### 2) Map exception categories to your `ErrorCategory` enum

**Why:** Many `.category` strings on your exceptions don’t match the enum values (`token_limit_error` vs `token_limit`), causing `ErrorDetail(category=ErrorCategory(...))` to raise and interrupt error reporting.

**Patch — `app/core/logic.py`**

```diff
@@
 from app.core.text_processing import count_tokens
 from app.schemas.responses import WebhookPayload, GenerateCardsResult, ErrorDetail, ErrorCategory
 
 logger = logging.getLogger(__name__)
 
+# Map internal error category strings to public enum
+_CATEGORY_MAP = {
+    "token_limit_error": ErrorCategory.TOKEN_LIMIT,
+    "service_error":     ErrorCategory.INTERNAL_ERROR,
+    "auth_error":        ErrorCategory.AUTH_ERROR,
+    "rate_limit_error":  ErrorCategory.RATE_LIMIT,
+    "network_error":     ErrorCategory.NETWORK_ERROR,
+    "model_error":       ErrorCategory.AI_MODEL_ERROR,
+    "parse_error":       ErrorCategory.PARSE_ERROR,
+    "webhook_error":     ErrorCategory.WEBHOOK_ERROR,
+    "unknown_error":     ErrorCategory.UNKNOWN_ERROR,
+}
+
+def _map_category(cat: str) -> ErrorCategory:
+    return _CATEGORY_MAP.get(cat, ErrorCategory.UNKNOWN_ERROR)
@@
-    except (TokenLimitError, ParseError, AuthError, RateLimitError, 
+    except (TokenLimitError, ParseError, AuthError, RateLimitExceeded, 
             NetworkError, AIModelError, AIServiceError) as e:
@@
-        error_detail = ErrorDetail(
-            message=str(e),
-            category=ErrorCategory(getattr(e, "category", "unknown_error")),
+        error_detail = ErrorDetail(
+            message=str(e),
+            category=_map_category(getattr(e, "category", "unknown_error")),
             code=getattr(e, "code", None),
             context=getattr(e, "context", None),
             retryable=getattr(e, "retryable", False),
             suggestedAction=getattr(e, "suggested_action", None)
         )
```

---

### 3) Fix CORS configuration

**Why:** `allow_credentials=True` cannot be combined with `["*"]` origins.

**Patch — `app/main.py`**

```diff
@@ def create_app() -> FastAPI:
-    app.add_middleware(
-        CORSMiddleware,
-        allow_origins=settings.CORS_ORIGINS,
-        allow_credentials=True,
-        allow_methods=["*"],
-        allow_headers=["*"],
-    )
+    allow_origins = settings.CORS_ORIGINS or []
+    allow_credentials = True
+    # If credentials are allowed, cannot use wildcard origins
+    if allow_credentials and ("*" in allow_origins or not allow_origins):
+        # fall back to credentials disabled when wildcard
+        allow_credentials = False
+        if not allow_origins:
+            allow_origins = ["*"]
+
+    app.add_middleware(
+        CORSMiddleware,
+        allow_origins=allow_origins,
+        allow_credentials=allow_credentials,
+        allow_methods=["*"],
+        allow_headers=["*"],
+    )
```

> Also consider reading `CORS_ORIGINS` from env as a comma‑separated list of trusted origins and defaulting to credentials enabled for those known origins in production.

---

### 4) Don’t raise HTTPException in a background task; validate earlier

**Why:** `HTTPException` from `BackgroundTasks` is never returned to the client. Input validation should happen in the route; errors in processing should be reported via webhook (which you already do).

**Patch — `app/api/v1/ai_tasks.py`**

```diff
@@ async def process_ai_job(job_id: str, input_data: Dict[str, Any]) -> None:
-    try:
-        # Extract input text - required
-        text = input_data.get("text")
-        if not text:
-            raise ValueError("No text provided in input data")
+    try:
+        # Extract input text - required (already validated by pydantic in the route)
+        text = input_data.get("text")
+        if not text:
+            logger.error(f"Job {job_id}: empty text unexpectedly reached background worker")
+            return
@@
-    except TokenLimitError as e:
-        logger.error(f"Token limit error for job {job_id}: {str(e)}")
-        raise HTTPException(
-            status_code=status.HTTP_400_BAD_REQUEST,
-            detail=str(e)
-        )
-        
-    except AIServiceError as e:
-        logger.error(f"AI service error for job {job_id}: {str(e)}")
-        raise HTTPException(
-            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
-            detail=str(e)
-        )
-        
-    except ValueError as e:
-        logger.error(f"Validation error for job {job_id}: {str(e)}")
-        raise HTTPException(
-            status_code=status.HTTP_400_BAD_REQUEST,
-            detail=str(e)
-        )
-        
-    except Exception as e:
-        logger.error(f"Unexpected error processing job {job_id}: {str(e)}")
-        raise HTTPException(
-            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
-            detail="An unexpected error occurred"
-        )
+    except Exception as e:
+        # All error delivery happens in process_card_generation; just log here.
+        logger.exception(f"Unexpected error in background job {job_id}: {e}")
+        return
```

> Route-level validation is already enforced by `GenerateCardsRequest` (required `text`), so this is safe.

---

### 5) Respect model-specific token limits (input & output)

**Why:** You gate inputs by a global `MAX_INPUT_TOKENS` only. If a selected model has a smaller max, you can still hit provider limits. Also harmonize output budgets.

**Patch — `app/core/logic.py` (snippet)**

```diff
@@ async def process_card_generation(...):
-        input_tokens = count_tokens(input_text, model)
-        if input_tokens > MAX_INPUT_TOKENS:
+        input_tokens = count_tokens(input_text, model)
+        model_cfg = get_model_config(model)
+        input_limit = min(MAX_INPUT_TOKENS, model_cfg.get("max_input_tokens", MAX_INPUT_TOKENS))
+        if input_tokens > input_limit:
             error_msg = (
-                f"Input text exceeds maximum token limit of {MAX_INPUT_TOKENS}. "
+                f"Input text exceeds maximum token limit of {input_limit}. "
                 f"Current token count: {input_tokens}. "
                 "Please reduce the input text length or split it into smaller chunks."
             )
@@
-        output_tokens = sum(count_tokens(card["front"] + card["back"], model) for card in parsed_result["cards"])
-        if output_tokens > MAX_OUTPUT_TOKENS:
+        output_tokens = sum(count_tokens(str(card.get("front","")) + str(card.get("back","")), model)
+                            for card in parsed_result["cards"])
+        output_limit = min(MAX_OUTPUT_TOKENS, model_cfg.get("max_output_tokens", MAX_OUTPUT_TOKENS))
+        if output_tokens > output_limit:
             error_msg = (
-                f"Generated content exceeds maximum output token limit of {MAX_OUTPUT_TOKENS}. "
+                f"Generated content exceeds maximum output token limit of {output_limit}. "
                 f"Current token count: {output_tokens}. "
                 "Please try with a shorter input text."
             )
```

---

### 6) Logging: honor LOG\_LEVEL and include structured extras

**Why:** Current JSON formatter ignores `settings.LOG_LEVEL` and won’t capture `extra={...}` fields (Python logging flattens extras onto the record, not as `record.extra`).

**Patch — `app/main.py`**

```diff
@@
 class JSONFormatter(logging.Formatter):
     """Custom JSON formatter for structured logging"""
     def format(self, record):
         log_data = {
             "timestamp": datetime.utcnow().isoformat(),
             "level": record.levelname,
             "message": record.getMessage(),
             "module": record.module,
             "function": record.funcName,
             "line": record.lineno,
         }
-        
-        # Add extra fields if they exist
-        if hasattr(record, "extra"):
-            log_data.update(record.extra)
+        # Merge in any extra attributes that aren't standard LogRecord fields
+        standard = set(vars(logging.makeLogRecord({})).keys())
+        for k, v in vars(record).items():
+            if k not in standard and k not in log_data:
+                log_data[k] = v
@@
 def setup_logging():
     """Configure structured JSON logging"""
-    # Create logger
-    logger = logging.getLogger()
-    logger.setLevel(logging.INFO)
+    logger = logging.getLogger()
+    if logger.handlers:
+        # Avoid duplicate handlers on reload
+        return
+    # Respect configured log level
+    level = getattr(logging, settings.LOG_LEVEL.upper(), logging.INFO)
+    logger.setLevel(level)
@@
-    logging.getLogger("uvicorn").setLevel(logging.WARNING)
-    logging.getLogger("uvicorn.access").setLevel(logging.WARNING)
+    logging.getLogger("uvicorn").setLevel(level)
+    logging.getLogger("uvicorn.access").setLevel(level)
```

---

## Additional recommended improvements

### A) Improve tokenizer selection for OpenAI models (esp. 4o/4o-mini)

Current heuristic:

* If `"gpt-4"` in model → `encoding_for_model("gpt-4")`
* else if `"gpt-3.5-turbo"` → that encoding
* else → `cl100k_base`

This works but is imprecise for newer families. Prefer:

* Try `tiktoken.encoding_for_model(model)` first; fallback to known bases (`o200k_base` for 4o-family; `cl100k_base` otherwise). Handle exceptions gracefully.
  *(No patch shown to keep changes minimal; can supply if you’d like.)*

### B) Harden `parse_ai_response`

Add type checks for `front`/`back` (both strings, non-empty). You already validate presence but not type:

```diff
@@ def parse_ai_response(...):
-        for i, card in enumerate(result["cards"]):
+        for i, card in enumerate(result["cards"]):
             if not isinstance(card, dict):
                 ...
             if "front" not in card:
                 ...
             if "back" not in card:
                 ...
+            if not isinstance(card["front"], str) or not isinstance(card["back"], str):
+                raise ParseError(
+                    f"Card at index {i} must have string 'front' and 'back'",
+                    code="INVALID_CARD_FIELD_TYPES",
+                    context={"index": i, "front_type": type(card.get("front")).__name__,
+                             "back_type": type(card.get("back")).__name__}
+                )
```

### C) Enforce model selection & defaults tighter

* If client passes a model name unknown to `AI_MODELS`, your fallback is okay, but consider **whitelisting** to avoid typos leading to untested models. Optionally allow `"provider": "openai|anthropic"` with default model per provider.

### D) Endpoint surface

* Consider protecting `/available-models` with the same internal API key (or rate-limit), especially if it might reveal internal defaults/capabilities you’d rather not expose publicly.

### E) Webhook robustness

* Consider signing webhook bodies with an HMAC (e.g., `X-Signature` computed over the JSON body) rather than shared secret header only. On the Next.js side, verify HMAC in addition to `X-Internal-API-Key`.

### F) Idempotency & dedup

* If the same `jobId` can be submitted twice, deduplicate in memory (e.g., an `asyncio`-safe cache for in-flight jobs) or via Redis. Return 202 for duplicates but skip duplicate processing; rely on the existing webhook signal.

### G) Rate limiting your own API

* Protect the `/generate-cards` endpoint with a modest per-IP or per-user rate limit (e.g., with `slowapi` or `fastapi-limiter`) to defend against accidental floods and control cost.

---

## Security review

* **Auth between services:** Good use of `X-Internal-API-Key`. Recommend **separate keys** for (a) inbound Next.js→AI service and (b) outbound AI service→Next.js webhook, or add **HMAC** on the webhook body as above.
* **CORS:** Fix as above; set explicit origins in production.
* **Secrets management:** `.env.local` is fine for dev; in prod use container secrets or environment variables via your orchestrator.
* **Logs & PII:** Avoid logging raw AI responses in INFO; your current debug log truncates to 500 chars—good. Keep it at DEBUG only.
* **Model abuse handling:** You already catch content filter errors. Consider returning a specific `ErrorCategory.AI_MODEL_ERROR` with an actionable message (you do).

---

## Observability

* **JSON logs:** Fixed to include `extra` fields (e.g., `jobId`, `model`).
* **Correlation:** Consider always logging `jobId` as an extra field at each stage; propagate into webhook payload logs.
* **Metrics (optional):** If you add Prometheus or StatsD, emit counters for `jobs_started`, `jobs_completed`, `jobs_failed{category=...}`, latencies, and token totals.

---

## Performance & resilience

* **No durable queue:** If the process restarts, background tasks are lost. For higher reliability, consider Celery/RQ/Arq or a Cloud queue (but your webhook-first stateless approach is fine for MVP).
* **Async everywhere:** Fixed Anthropic blocking call; this will improve concurrency immediately.
* **Token limits:** Using per-model caps reduces 400s from providers.

---

## Documentation

* README model names: it mentions `claude-3-haiku` but your default is `claude-haiku-3-5-latest`. Update docs for consistency.
* Document `CORS_ORIGINS` semantics and production defaults.

---

## Test plan (minimal but effective)

1. **Unit tests**

   * `count_tokens()` for representative models (gpt-4o-mini, claude-haiku-3-5-latest) with small, large texts.
   * `parse_ai_response()`:

     * Valid JSON, fenced JSON code block, JSON embedded in text, Q/A fallback extraction.
     * Malformed objects (non-list `cards`, missing `front`/`back`, wrong types).
   * `_map_category()` for all internal strings.
   * `send_webhook_with_retry()` simulate: 200, 401, 404, 429 (retry), 500 (retry then fail).

2. **Integration tests (with provider mocks)**

   * OpenAI: simulate success (valid JSON), BadRequest content filter, RateLimit (ensure backoff and final classification), Timeout (retry).
   * Anthropic: simulate same classes of errors; ensure async path works.

3. **Route tests**

   * `POST /api/v1/generate-cards` with/without header; 202 on valid; 401 on missing/invalid key.
   * `GET /api/v1/available-models` shape and defaults.

4. **CORS**

   * Verify preflight and credentialed requests pass for configured origins and are blocked for others.

---

## Quick checklists

**Production readiness**

* [ ] Apply the patch set (exceptions, Anthropic async, CORS, logging, category map, token limits).
* [ ] Set `CORS_ORIGINS` to explicit origins in prod.
* [ ] Ensure `INTERNAL_API_KEY` is unique per service direction or add webhook HMAC.
* [ ] Turn DEBUG logs off in prod; keep structured JSON logs.
* [ ] Pin versions in `requirements.txt` (already pinned—good).

**Reliability**

* [ ] Decide whether you need durable job processing (queue).
* [ ] Add idempotency guard on `jobId`.
* [ ] Add modest rate limit on `/generate-cards`.

**Docs**

* [ ] Align README model names/defaults.
* [ ] Document environment flags and CORS configuration.

---

## Small polish

* In `text_processing.format_for_anki`, consider sanitizing newlines and tabs to avoid CSV/TSV import gotchas.
* In `ai_tasks.get_available_models`, optionally include whether a model is “json-preferred” so the frontend can suggest it in UI.