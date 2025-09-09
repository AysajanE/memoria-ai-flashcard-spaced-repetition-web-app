<review>
1. Summary of the current AI service implementation

The `ai-service` is a FastAPI microservice that receives text and metadata from the Next.js app, calls OpenAI or Anthropic to generate flashcards, parses/validates the model’s JSON output, and posts results (or structured errors) back to the Next.js app via a signed webhook. Key traits:

* **Endpoints:** `POST /api/v1/generate-cards` (protected by `X-Internal-API-Key`) and `GET /api/v1/available-models`. Root and `/health` are public.
* **Processing model:** In-process FastAPI `BackgroundTasks` for async job execution; per-process dedup via `_IN_FLIGHT` set; simple per-IP in-memory rate limiter.
* **AI integration:** Global async clients for OpenAI/Anthropic; retry/backoff on provider errors; OpenAI uses `response_format={"type": "json_object"}`; Anthropic returns free text.
* **Parsing & constraints:** Strong JSON parsing with fallbacks, token counting via `tiktoken` (OpenAI) and heuristic (Anthropic), output token budget checks, and structured error payloads.
* **Security & observability:** API key header for inbound calls; optional HMAC signing for webhooks; JSON structured logging. CORS defaults to `*` with credentials disabled.
* **Packaging:** Dockerfile (python:3.11-slim), pinned requirements, flake8/black configs.

Overall, the service is cleanly organized with good error hygiene and a clear contract to the Next.js app. The main gaps are **durability/scalability** (in-process queue/rate limiters), **non-async webhook I/O** inside async code, **lazy resource initialization**, **model routing/quality features**, and **test/observability coverage**.

2. List of proposed improvements and enhancements

   **\[P1] Replace in‑process background tasks with a durable job queue (Redis-based)**

   * **Description:** Move job execution from FastAPI `BackgroundTasks` to a process-safe, distributed queue (e.g., **RQ**, **Dramatiq**, or **Arq** with Redis). This enables horizontal scaling, resilient retries, delayed jobs, and prevents loss on process restarts/deploys.
   * **Benefits:** Horizontal scalability, durability, better retry semantics, safer deploys; per-worker concurrency control; observability (dashboards).
   * **Implementation considerations:**

     * Add `REDIS_URL` env and a worker deployment. Keep the HTTP surface the same (Next.js still creates a `processingJobs` record and posts to `/generate-cards`).
     * Push a job (idempotent key = `jobId`) to the queue; the worker consumes and runs `process_card_generation`.
     * Use Redis for `_IN_FLIGHT` (a set keyed by `jobId`) to ensure cross-process dedup.
   * **Pseudocode:**

     ```python
     # ai-service/app/queue.py
     import os, redis
     from rq import Queue
     r = redis.from_url(os.environ["REDIS_URL"])
     q = Queue("memoria-ai", connection=r, default_timeout=600)

     # in /api/v1/ai_tasks.py
     from app.queue import q
     ...
     if not r.sismember("inflight", request.jobId):
         r.sadd("inflight", request.jobId)
         q.enqueue("app.core.logic.process_job_entrypoint", {
             "jobId": request.jobId,
             "text": request.text,
             "model": request.model,
             "cardType": request.cardType,
             "numCards": request.numCards,
             "config": request.config,
         }, job_id=request.jobId)
     ```

     ```python
     # app/core/logic.py
     def process_job_entrypoint(payload: dict):
         asyncio.run(process_card_generation(
             job_id=payload["jobId"], 
             input_text=payload["text"],
             model=payload.get("model"),
             card_type=payload.get("cardType", "qa"),
             num_cards=payload.get("numCards", 10),
             start_time=time.time()
         ))
     ```

   **\[P1] Make webhook delivery fully async and non-blocking**

   * **Description:** `send_webhook_with_retry` uses `requests` synchronously from inside async code, blocking the event loop. Replace with `httpx.AsyncClient` plus exponential backoff with jitter.
   * **Benefits:** Better concurrency and throughput, fewer latency spikes under load.
   * **Implementation considerations:** Share a single `AsyncClient` via FastAPI lifespan; ensure proper timeouts and retries with jitter.
   * **Code snippet:**

     ```python
     # app/main.py
     from contextlib import asynccontextmanager
     import httpx

     @asynccontextmanager
     async def lifespan(app: FastAPI):
         app.state.httpx = httpx.AsyncClient(timeout=httpx.Timeout(10, connect=5))
         try:
             yield
         finally:
             await app.state.httpx.aclose()

     app = FastAPI(..., lifespan=lifespan)
     ```

     ```python
     # app/core/logic.py
     import random
     import httpx
     from fastapi import Request

     async def send_webhook_with_retry_async(app: FastAPI, payload: WebhookPayload, 
                                            max_retries=3, base_delay=0.75, max_delay=5.0):
         raw = json.dumps(payload.model_dump(mode="json"), separators=(",", ":"))
         headers = { "x-internal-api-key": settings.INTERNAL_API_KEY, "content-type": "application/json" }
         if settings.INTERNAL_WEBHOOK_HMAC_SECRET:
             ts = str(int(time.time() * 1000))
             mac = hmac.new(settings.INTERNAL_WEBHOOK_HMAC_SECRET.encode(), f"{ts}.{raw}".encode(), hashlib.sha256).hexdigest()
             headers["x-webhook-timestamp"] = ts
             headers["x-webhook-signature"] = f"sha256={mac}"

         for attempt in range(1, max_retries+1):
             try:
                 resp = await app.state.httpx.post(settings.NEXTJS_APP_STATUS_WEBHOOK_URL, content=raw, headers=headers)
                 resp.raise_for_status()
                 return
             except httpx.HTTPStatusError as e:
                 if resp.status_code in (401,403,404):  # non-retryable
                     raise WebhookError("Webhook client error", code=f"HTTP_{resp.status_code}", context={"body": resp.text})
             except httpx.RequestError as e:
                 pass
             await asyncio.sleep(min(max_delay, base_delay * (2 ** (attempt-1)) + random.random()))
         raise WebhookError("Webhook delivery failed", code="MAX_RETRIES_EXCEEDED")
     ```

     And call `await send_webhook_with_retry_async(app, webhook_payload)` from `process_card_generation`.

   **\[P1] Lazy, provider‑scoped client initialization and stricter timeout control**

   * **Description:** Clients are created at import time with env keys; missing keys raise at module import, taking down the app. Make clients lazy per provider, inject timeouts, and validate presence of the provider key only when used.
   * **Benefits:** App starts even if one provider is misconfigured, clearer error messages, easier ops.
   * **Code snippet:**

     ```python
     # app/core/ai_clients.py
     from functools import lru_cache
     from openai import AsyncOpenAI
     from anthropic import AsyncAnthropic

     @lru_cache
     def get_openai_client() -> AsyncOpenAI:
         if not settings.OPENAI_API_KEY:
             raise AuthError("OPENAI_API_KEY not configured")
         return AsyncOpenAI(api_key=settings.OPENAI_API_KEY, timeout=20)

     @lru_cache
     def get_anthropic_client() -> AsyncAnthropic:
         if not settings.ANTHROPIC_API_KEY:
             raise AuthError("ANTHROPIC_API_KEY not configured")
         return AsyncAnthropic(api_key=settings.ANTHROPIC_API_KEY, timeout=20)
     ```

     Update `ai_caller.py` to call `get_openai_client()`/`get_anthropic_client()` when needed.

   **\[P1] Robust JSON-mode for Anthropic + guaranteed per-card `type`**

   * **Description:** You already enforce JSON on OpenAI. For Anthropic, use the model’s JSON guidance (supported via `anthropic.messages.create` with a strict system prompt or `json_schema` where available) and ensure every card includes `type` derived from `card_type`.
   * **Benefits:** Fewer parse errors; consistent downstream behavior (cloze vs QA).
   * **Code snippet:**

     ```python
     # ai_caller._generate_with_anthropic
     response = await anthropic_client.messages.create(
         model=model_name,
         system=system_prompt + "\n\nIMPORTANT: Output strictly valid JSON only. No prose.",
         messages=[{"role": "user", "content": text}],
         temperature=0.3,
         max_tokens=budget,
     )
     # After parse, enforce type:
     parsed = parse_ai_response("".join(b.text for b in response.content if getattr(b,"type",None)=="text"))
     for c in parsed["cards"]:
         c.setdefault("type", card_type)  # ensure type alignment
     ```

     Also set `temperature` lower (e.g., `0.3`) to reduce format drift for JSON tasks.

   **\[P1] Turn the currently unused `chunk_text` into a full, high‑quality multi‑chunk pipeline**

   * **Description:** For long inputs, automatically:

     1. chunk by tokens,
     2. generate a few cards per chunk (e.g., `ceil(num_cards * (tokens_in_chunk / total_tokens))`),
     3. merge, normalize, and **deduplicate**,
     4. cap to `num_cards`.
   * **Benefits:** Supports long articles; avoids hard failures; better recall coverage; predictable runtime/costs.
   * **Implementation considerations:** Deduplicate by normalized fronts (and optionally using embeddings later).
   * **Pseudocode:**

     ```python
     chunks = chunk_text(input_text, max_tokens=MAX_INPUT_TOKENS//2, model_name=model)
     weights = [count_tokens(c, model) for c in chunks]
     total = sum(weights) or 1
     allocated = [max(1, round(num_cards * w/total)) for w in weights]

     all_cards = []
     for c, k in zip(chunks, allocated):
         raw = await generate_cards_with_ai(text=c, model_name=model, card_type=card_type, num_cards=k)
         parsed = parse_ai_response(raw)
         for card in parsed["cards"]:
             card["type"] = card_type
             all_cards.append(clean_card(card))

     # simple dedup by normalized fronts
     seen = set(); deduped=[]
     for card in all_cards:
         key = normalize(card["front"])
         if key not in seen:
             seen.add(key); deduped.append(card)
     final = deduped[:num_cards]
     ```

   **\[P1] Improve rate limiting using Redis, keyed by user, not IP**

   * **Description:** Replace in-memory, per-process IP limiter with a Redis token bucket keyed by `x-user-id` (Clerk user) propagated by Next.js. This avoids abuse by NAT’d users and scales horizontally.
   * **Benefits:** Fairness, multi-instance safety, strong abuse control.
   * **Implementation considerations:** Have Next.js forward a trusted `X-User-Id` header (since the call is internal + API key protected). Fall back to IP if absent.
   * **Code snippet:**

     ```python
     # ai_tasks.py
     async def _rate_limit(redis, user_id: str, limit=60, window=60):
         key = f"rl:{user_id}:{int(time.time()//window)}"
         cnt = await redis.incr(key)
         if cnt == 1:
             await redis.expire(key, window)
         if cnt > limit:
             raise HTTPException(429, "Rate limit exceeded")
     ```

   **\[P2] Unify error taxonomy and surfaces**

   * **Description:** Your custom exceptions have `category` strings that later map to `ErrorCategory`. Make the category values identical to avoid drift and missed mappings.
   * **Benefits:** Simpler mapping, fewer edge cases; easier analytics by category.
   * **Implementation considerations:** Define a single `ErrorCategory` (Python enum) in one module and reference it from exception classes. Example:

     ```python
     # app/core/errors.py
     class AIError(Exception):
         def __init__(self, message, category: ErrorCategory, code=None, ...): ...
     class TokenLimitError(AIError):
         def __init__(self, msg, **kw): super().__init__(msg, ErrorCategory.TOKEN_LIMIT, code="TOKEN_LIMIT_EXCEEDED", **kw)
     ```

   **\[P2] Harden configuration parsing for `AI_MODELS` & defaults**

   * **Description:** `.env.example` uses a JSON string for `AI_MODELS`, but the Settings field is typed as a dict. Add a validator to safely parse strings, validate keys, and support comments/whitespace.
   * **Benefits:** Fewer boot-time surprises; easier ops.
   * **Code snippet (Pydantic v2):**

     ```python
     # app/config.py
     from pydantic import field_validator

     class Settings(BaseSettings):
         AI_MODELS: Dict[str, Dict[str, Any]] = Field(default_factory=dict)
         @field_validator("AI_MODELS", mode="before")
         @classmethod
         def _parse_models(cls, v):
             if isinstance(v, str):
                 import json
                 return json.loads(v)
             return v or {}
     ```

   **\[P2] Add readiness/diagnostic endpoints and Prometheus metrics**

   * **Description:** Keep `/health` (liveness). Add `/ready` for dependencies (e.g., Redis, ability to sign a webhook). Expose Prometheus metrics (`prometheus-fastapi-instrumentator`) with counters and latencies by model/provider/status.
   * **Benefits:** Production-grade observability; safer rollouts and autoscaling.
   * **Code snippet:**

     ```python
     # app/main.py
     from prometheus_fastapi_instrumentator import Instrumentator
     def create_app():
         ...
         Instrumentator().instrument(app).expose(app, endpoint="/metrics")

     @app.get("/ready")
     async def ready():
         return {"ok": True, "redis": await ping_redis(), "models_loaded": bool(settings.AI_MODELS)}
     ```

   **\[P2] Concurrency control & circuit breaking**

   * **Description:** Limit concurrent calls to each provider (e.g., `Semaphore( N )` per provider) and add a circuit breaker (e.g., track failures over time and temporarily short-circuit to the other provider or fail fast).
   * **Benefits:** Prevents thundering herds on provider outages; protects quota.
   * **Pseudocode:**

     ```python
     openai_sem = asyncio.Semaphore(int(os.getenv("OPENAI_MAX_CONCURRENCY", 8)))
     anthropic_sem = asyncio.Semaphore(int(os.getenv("ANTHROPIC_MAX_CONCURRENCY", 8)))

     async with openai_sem:
         return await _generate_with_openai(...)
     ```

   **\[P2] Model routing and fallback**

   * **Description:** If chosen model fails with retryable errors, optionally fallback to a secondary model (e.g., haiku → gpt-4o-mini), controlled by env flag `ENABLE_FALLBACK=true`.
   * **Benefits:** Higher success rate; fewer manual retries for users.
   * **Pseudocode:**

     ```python
     try:
         return await _generate_with_anthropic(...)
     except (RateLimitExceeded, NetworkError, AIServiceError) as e:
         if settings.ENABLE_FALLBACK:
             return await _generate_with_openai(...)
         raise
     ```

   **\[P2] Strict timeouts and budgets tied to `numCards`**

   * **Description:** Set provider call timeouts explicitly and scale `max_tokens` with `num_cards` to cap cost (e.g., `per_card_budget = 128 tokens`).
   * **Benefits:** Cost predictability; faster failures.
   * **Code snippet:**

     ```python
     per_card = int(os.getenv("TOKENS_PER_CARD_BUDGET", "128"))
     budget = min(settings.MAX_OUTPUT_TOKENS, per_card * num_cards)
     # Use in provider calls
     ```

   **\[P3] Security: inbound HMAC and stricter CORS**

   * **Description:** Add optional HMAC verification on `/generate-cards` (Next.js can sign body using the same shared secret). Tighten CORS to specific Next.js origin(s) in non-dev.
   * **Benefits:** Defense-in-depth; mitigates accidental exposure if API key leaks.
   * **Code snippet:**

     ```python
     # dependencies.py
     async def validate_signature(request: Request):
         if not settings.INTERNAL_WEBHOOK_HMAC_SECRET: return
         ts = request.headers.get("x-webhook-timestamp")
         sig = request.headers.get("x-webhook-signature")
         body = await request.body()
         mac = hmac.new(settings.INTERNAL_WEBHOOK_HMAC_SECRET.encode(), f"{ts}.{body.decode()}".encode(), hashlib.sha256).hexdigest()
         if sig != f"sha256={mac}":
             raise HTTPException(401, "Invalid signature")
     ```

     Wire it as a dependency for `/generate-cards` in production.

   **\[P3] Results enrichment: quality filters & normalization**

   * **Description:** After parsing, run small post-processing:

     * normalize whitespace/punctuation,
     * enforce end punctuation on questions,
     * collapse duplicate/near-duplicate cards,
     * ensure cloze cards contain exactly one deletion.
   * **Benefits:** Higher card quality; fewer noisy cards.
   * **Pseudocode:**

     ```python
     def clean_card(c):
         c["front"] = normalize_spaces(c["front"]).strip()
         c["back"]  = normalize_spaces(c["back"]).strip()
         return c
     ```

   **\[P3] Structured progress updates**

   * **Description:** Emit interim webhook statuses—`started` → `generating` (per chunk) → `merging` → `completed/failed`—so the Next.js UI can show fine-grained progress.
   * **Benefits:** Better UX on large inputs.
   * **Implementation considerations:** Add `status: "in_progress"` payloads with `progressPct`.

   **\[P3] Add a small “cost accounting” and token usage report**

   * **Description:** Track input/output token counts and compute rough USD cost per job by model (env-configured pricing table). Include in webhook result.
   * **Benefits:** Transparency and future billing controls.
   * **Snippet:**

     ```python
     PRICING = {"gpt-4o-mini": {"in": 0.00015/1000, "out": 0.0006/1000}, ...}
     cost = PRICING[model]["in"]*input_tokens + PRICING[model]["out"]*output_tokens
     result_payload.costUSD = round(cost, 6)
     ```

   **\[P3] Testing: unit, contract, and e2e**

   * **Description:**

     * **Unit tests:** `parse_ai_response`, `count_tokens`, `chunk_text`, `format_for_anki`.
     * **Contract tests:** Verify webhook HMAC; verify error payload shape for each error class.
     * **Provider mocks:** Patch OpenAI/Anthropic clients to return canned JSON.
     * **CI:** Add `pytest` with coverage threshold; include static type checks (mypy).
   * **Benefits:** Safer refactors; fewer regressions.
   * **Snippet:**

     ```python
     # tests/test_parse.py
     def test_parse_valid_json():
         raw = '{"cards":[{"front":"Q?","back":"A"}]}'
         assert parse_ai_response(raw)["cards"][0]["front"] == "Q?"
     ```

   **\[P3] Improve Docker hardening & runtime profile**

   * **Description:**

     * Run as non-root user; restrict permissions.
     * Use `UVICORN_WORKERS` env to scale workers; set `--timeout-keep-alive`.
     * Optionally add `GUNICORN` with `uvicorn.workers.UvicornWorker` for pre-forking in container if needed.
   * **Benefits:** Security best practices; better resource utilization.
   * **Docker snippet:**

     ```dockerfile
     RUN useradd -m appuser
     USER appuser
     ENV UVICORN_WORKERS=2
     CMD ["uvicorn","app.main:app","--host","0.0.0.0","--port","80","--workers","2","--timeout-keep-alive","20"]
     ```

   **\[P3] Add admin endpoints guarded by internal key**

   * **Description:** `/admin/retry-webhook/{jobId}`, `/admin/ping-providers`, `/admin/flush-inflight` to assist ops.
   * **Benefits:** Faster incident response.

   **\[P3] Extend API surface for client UX**

   * **Description:**

     * `/api/v1/tokenize` → returns token counts & chunk preview.
     * `/api/v1/preview-cards` → dry-run on first N chars; no webhook.
     * `/api/v1/format-anki` → server-side Anki formatting using `format_for_anki`.
   * **Benefits:** Better UI affordances, especially in “create” flow.

   **\[P4] Optional: embeddings-based deduplication and topic balancing**

   * **Description:** Use inexpensive embeddings (`text-embedding-3-small`) to cluster and dedup across chunks; balance cards by subtopic headings (simple regex/title extraction).
   * **Benefits:** Noticeably better card diversity and less redundancy.
   * **Trade-offs:** Extra API calls and cost; add caching.

   **\[P4] Sentry / OpenTelemetry integration**

   * **Description:** Add error reporting (Sentry) and traces (OTel) across request → model call → webhook.
   * **Benefits:** Root-cause analysis in production.

3. Conclusion and overall recommendations

   The service already has solid foundations: clean FastAPI design, structured logging, a clear webhook contract, and careful parsing/error handling. To make it production-grade for scale and reliability, prioritize (1) **durable queuing**, (2) **async, non-blocking webhooks**, (3) **lazy client init with strict timeouts**, (4) **chunked generation pipeline with dedup**, and (5) **Redis-backed per-user rate limits**. These changes will materially improve throughput, resilience, and user experience without disrupting the current Next.js integration. Follow with observability (metrics/readiness), taxonomy unification, and test coverage to support safe iteration. The later-stage features (fallback routing, cost accounting, embeddings dedup, and admin/preview endpoints) will enhance quality, control, and operability as you grow.

</review>
