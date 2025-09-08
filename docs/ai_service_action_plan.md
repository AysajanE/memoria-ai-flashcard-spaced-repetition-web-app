# AI Service – Actionable Implementation Plan

This plan converts the findings in `docs/ai_service_review.md` into precise, step‑by‑step tasks. Each task lists concrete code changes, files to touch, and validations/tests.

## P0: Critical Fixes

### 1) Fix exception collision, add JSON mode, and make Anthropic fully async

Goal: Ensure OpenAI rate limit retries run, enforce JSON responses where supported, and avoid blocking the event loop for Anthropic.

Steps
- Update `ai-service/app/core/ai_caller.py`:
  - Alias OpenAI exceptions to avoid name collisions:
    - `from openai import RateLimitError as OpenAIRateLimitError, AuthenticationError as OpenAIAuthenticationError, APIError as OpenAIAPIError`.
  - Rename our custom `RateLimitError` → `RateLimitExceeded`.
  - Initialize Anthropic async client: `from anthropic import AsyncAnthropic` and `anthropic_client = AsyncAnthropic(api_key=...)`.
  - In `_generate_with_openai(...)`:
    - Compute `budget = min(settings.MAX_OUTPUT_TOKENS, get_model_config(model_name)["max_output_tokens"])`.
    - Pass `response_format={"type": "json_object"}` to `chat.completions.create`.
    - Catch `OpenAIRateLimitError` and rethrow `RateLimitExceeded` with `{provider: 'openai'}` in context.
  - In `_generate_with_anthropic(...)`:
    - Compute `budget` as above; call `await anthropic_client.messages.create(...)`.
    - Join all text blocks: `"".join(b.text for b in response.content if getattr(b,'type',None)=='text').strip()`.
    - Catch Anthropic rate-limit and rethrow `RateLimitExceeded` with `{provider: 'anthropic'}`.
- Update imports in `ai-service/app/core/logic.py` to use `RateLimitExceeded` instead of `RateLimitError`.

Validation
- Unit tests: mock OpenAI client to throw `RateLimitError`; ensure retry then `RateLimitExceeded` classification.
- Simulate Anthropic response with multiple text blocks; ensure concatenation is returned.
- Manual run: generate small input with both providers to confirm behavior.

### 2) Map internal exception categories → public ErrorCategory enum

Goal: Avoid Pydantic `Enum` validation errors when converting custom `.category` strings to `ErrorCategory`.

Steps
- In `ai-service/app/core/logic.py`:
  - Add `_CATEGORY_MAP` from strings (e.g., `token_limit_error`) to `ErrorCategory` (e.g., `TOKEN_LIMIT`).
  - Add helper `_map_category(cat: str) -> ErrorCategory` with a default to `UNKNOWN_ERROR`.
  - When building `ErrorDetail(...)`, compute `category=_map_category(getattr(e, 'category', 'unknown_error'))`.
  - Replace `RateLimitError` with `RateLimitExceeded` in the caught exceptions tuple.

Validation
- Unit test `_map_category` for all supported values and an unknown fallback.
- Simulate a ParseError and RateLimitExceeded; verify webhook sends valid enum values.

### 3) Correct CORS configuration

Goal: Avoid invalid combination `allow_credentials=True` with wildcard origins.

Steps
- In `ai-service/app/main.py`:
  - Load `allow_origins = settings.CORS_ORIGINS or []`.
  - Set `allow_credentials = True` by default.
  - If `allow_credentials` is true and origins are `['*']` or empty, set `allow_credentials = False` and default `allow_origins=['*']` for dev.
  - Add a code comment about production: set explicit origins and keep credentials enabled.
- In `ai-service/app/config.py`: document CORS semantics; ensure `CORS_ORIGINS` accepts list of strings from env.

Validation
- Run server; confirm CORS preflight is valid.
- For production, set `CORS_ORIGINS=["https://your.app"]` and verify cookies/credentials.

### 4) Do not raise HTTPException from background jobs; validate earlier

Goal: Ensure request-time validation returns fast; background errors go via webhook.

Steps
- In `ai-service/app/api/v1/ai_tasks.py`:
  - Keep request validation in `trigger_generate_cards` (already protected via `Depends(validate_internal_api_key)` + Pydantic body schema).
  - Ensure `process_ai_job(...)` does not raise `HTTPException`; convert operational errors to `ErrorDetail` via the existing webhook mechanism (already done by `process_card_generation`).
  - Remove any raise paths of `HTTPException` from background tasks.

Validation
- POST invalid body returns 422 at request time.
- Provider errors do not bubble to the 202 response; they are delivered via webhook instead.

### 5) Logging improvements honoring LOG_LEVEL and capturing extra

Goal: Respect `LOG_LEVEL` and include `extra` structured fields consistently in JSON logs.

Steps
- In `ai-service/app/main.py`:
  - In `setup_logging()`, set logger level from `settings.LOG_LEVEL`.
  - Update `JSONFormatter` to merge `record.__dict__` keys that don’t start with `_` and are not standard attributes to capture `extra` fields; keep exception info.
  - Document standard `log.extra={"jobId":..., "model":...}` usage.

Validation
- Manually log with `logger.info('msg', extra={'jobId': '...','model': '...'})` and confirm presence in output JSON.
- Switch `LOG_LEVEL` to `DEBUG` for local runs and verify verbosity.

## P1: High‑Value Improvements

### 6) Stricter AI output parsing & validation

Goal: Reduce parse errors and ensure each card has valid types and reasonable sizes.

Steps
- In `ai-service/app/core/logic.py` → `parse_ai_response(...)`:
  - After assembling `result = {"cards": [...]}`, validate:
    - `cards` is a list; each element has `front` and `back` as strings.
    - Enforce length bounds, e.g., `1..1000` chars for both fields; trim whitespace.
  - On violation, raise `ParseError` with code and context (`index`, `front_len`, `back_len`).
- In `ai-service/app/schemas/responses.py`:
  - Ensure `Card` model constraints reflect these bounds to keep success payloads consistent.

Validation
- Unit tests covering: valid JSON, fenced code block JSON, embedded JSON, Q/A fallback extraction, wrong types, and overlong fields.

### 7) Per‑model token budgeting

Goal: Lower provider 400s by using the smaller of global and model‑specific token limits.

Steps
- Already partially covered in P0 step 1: compute `budget = min(settings.MAX_OUTPUT_TOKENS, get_model_config(model_name)["max_output_tokens"])` for both providers.
- Ensure `count_tokens()` uses the correct encoder for each model (verify in `text_processing` or document approximations).

Validation
- Unit tests for long inputs: when input exceeds `MAX_INPUT_TOKENS` for chosen model, receive `TokenLimitError` with context.

### 8) Idempotency and de‑duplication by jobId

Goal: Avoid duplicate work if the same jobId is sent twice.

Steps
- Add a lightweight in‑process guard in `ai-service/app/api/v1/ai_tasks.py`:
  - Maintain an `asyncio`‑safe set of in‑flight jobIds with TTL.
  - On repeated submission of a jobId while in‑flight, return 202 but skip re‑queuing.
- Optional: For multi‑instance deployments, use Redis with a short TTL key (e.g., `SETNX ai:job:{jobId} 1 EX 300`).

Validation
- Submit the same jobId twice quickly; confirm only a single background task runs and only one webhook is sent.

### 9) Protect or rate‑limit public endpoints

Goal: Reduce surface area and cost exposure.

Steps
- `/api/v1/available-models`:
  - Option A: Require `X-Internal-API-Key` (same validator as `generate-cards`).
  - Option B: Keep public but add naïve per‑IP rate limit using a small in‑memory token bucket (or `slowapi`/`fastapi-limiter`).
- `/api/v1/generate-cards`:
  - Add per‑key or per‑IP rate limiting (e.g., 30 req/min).

Validation
- Route tests: missing/invalid headers 401; rate limit returns 429.

## P2: Security & Observability Enhancements

### 10) Webhook HMAC signing (already implemented on this repo)

Goal: Sign webhook payloads to Next.js (body HMAC) in addition to the shared secret header.

Steps
- Confirm `INTERNAL_WEBHOOK_HMAC_SECRET` is used in `send_webhook_with_retry()` to compute:
  - `x-webhook-timestamp` and `x-webhook-signature` over `${ts}.${raw_body}`.
- Ensure Next.js verifies these (already implemented in `/api/webhooks/ai-service-status`).

Validation
- Tamper with body/signature during dev to verify 401.

### 11) Observability & correlation

Goal: Easier tracing and incident debugging.

Steps
- Include `jobId`, `provider`, and `model` in `extra` for all logs.
- Log durations and token counts in success path; log category/code in error path.
- Optionally add a request ID middleware (e.g., inject `X-Request-ID`), and log it.

Validation
- Inspect logs across a job’s lifecycle; confirm consistent fields.

## P3: Documentation & DX

### 12) Update docs and examples

Steps
- In `ai-service/README.md` and `.env.example`:
  - Document `CORS_ORIGINS` behavior and production defaults.
  - Ensure model names in docs match defaults (`claude-haiku-3-5-latest`).
  - Document `INTERNAL_WEBHOOK_HMAC_SECRET` usage.

Validation
- Manual review of README; keep short and accurate.

## Test Plan (to implement alongside changes)

- Unit tests
  - `count_tokens()` for typical models and sizes.
  - `parse_ai_response()` happy/edge cases; invalid types/lengths.
  - `_map_category()` mapping.
  - `send_webhook_with_retry()` behaviors (200/401/404/429/500) using a test HTTP server or `responses`.
- Integration tests (mock providers)
  - OpenAI: JSON mode success; BadRequest content filter; rate limit (ensure retries/backoff); timeouts.
  - Anthropic: async client path, multi-block response, same error classes.
- Route tests
  - `POST /api/v1/generate-cards` 202 with valid key; 401 missing/invalid.
  - `GET /api/v1/available-models` guarded or rate-limited as configured.
- CORS
  - Preflight for configured origins; deny wildcard+credentials combos.

## Rollout Checklist

- [ ] Implement P0 fixes (exceptions, async Anthropic, category mapping, CORS, logging).
- [ ] Add tests; run full suite locally.
- [ ] Configure `CORS_ORIGINS` in prod to explicit origins.
- [ ] Ensure `INTERNAL_WEBHOOK_HMAC_SECRET` is set and distinct from `INTERNAL_API_KEY`.
- [ ] Optionally deploy idempotency guard (Redis) and rate limiting for multi-instance setups.

---

This plan provides deterministic edits with clear file paths, validation points, and tests to land the ai-service improvements safely and incrementally.

