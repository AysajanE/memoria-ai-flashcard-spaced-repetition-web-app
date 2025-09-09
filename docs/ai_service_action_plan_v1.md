## AI Service Improvement Action Plan — Phase-by-Phase, Step-by-Step

**Roles used below:**

* **BE(Py):** Python backend engineer
* **FE(Next):** Next.js engineer
* **DevOps:** Infrastructure/SRE
* **QA:** Quality engineer / test
* **PM:** Coordinator (you can assign yourself)

**Key repos/paths:**

* Python service: `/ai-service/app/...`
* Next.js app: `/nextjs-app/...`

**Guardrails:**

* Feature-flag each major change so we can toggle safely.
* Maintain backward compatibility for webhook payloads and headers.
* Add tests in each PR; do small, focused merges.

---

### Phase 0 — Foundations & Prep

**Objective:** Make the codebase ready for rapid, safe iteration.

1. **Set up CI for `ai-service`**

   * **BE(Py)/DevOps**
   * Add a GitHub Action or similar to run: `flake8`, `black --check`, `pytest --cov=app`.
   * Add `mypy` if desired (optional but recommended).
   * **Acceptance:** CI runs on PRs, fails if style/tests fail.

2. **Introduce feature flags & shared constants**

   * **BE(Py)**
   * Add to `app/config.py`:

     ```python
     from pydantic import Field, field_validator
     class Settings(BaseSettings):
         USE_QUEUE: bool = False
         ENABLE_FALLBACK: bool = False
         ENABLE_PROGRESS_UPDATES: bool = False
         ENABLE_COST_ACCOUNTING: bool = False
         ENABLE_INBOUND_HMAC: bool = False
         OPENAI_MAX_CONCURRENCY: int = 8
         ANTHROPIC_MAX_CONCURRENCY: int = 8
         TOKENS_PER_CARD_BUDGET: int = 128
         REDIS_URL: str = ""
         CORS_ORIGINS: List[str] = Field(default_factory=lambda: ["*"])
         AI_MODELS: Dict[str, Dict[str, Any]] = Field(default_factory=dict)

         @field_validator("AI_MODELS", mode="before")
         @classmethod
         def parse_models(cls, v):
             if isinstance(v, str):
                 import json
                 return json.loads(v)
             return v or {}
     ```
   * Update `.env.example` with these fields.
   * **Acceptance:** Service boots with/without flags; defaults non-breaking.

3. **Unify error taxonomy (optional now, used later)**

   * **BE(Py)**
   * `app/core/errors.py`: centralize `ErrorCategory` and exception base classes; ensure categories match `app/schemas/responses.py`.
   * Refactor callers to use shared categories.
   * **Acceptance:** Existing unit paths still compile; error payloads unchanged.

---

### Phase 1 — Durability & Non‑Blocking I/O

**Objective:** Durable job execution and non-blocking webhooks to enable scale.

1. **Add Redis & queue (RQ) skeleton**

   * **DevOps**
   * Provision Redis (`REDIS_URL`). Local: add Docker Compose service.
   * **BE(Py)**
   * Add `rq` dependency. Create:

     * `app/queue.py`

       ```python
       import os, redis
       from rq import Queue
       from rq.registry import StartedJobRegistry
       r = redis.from_url(os.environ.get("REDIS_URL","redis://localhost:6379/0"))
       q = Queue("memoria-ai", connection=r, default_timeout=600)
       ```
     * Worker entrypoint `workers/ai_worker.py`:

       ```python
       from rq import Connection, Worker
       from app.queue import r
       if __name__ == "__main__":
           with Connection(r):
               Worker(["memoria-ai"]).work()
       ```
   * **Acceptance:** `rq info` shows queue; worker can connect locally.

2. **Queue integration behind flag**

   * **BE(Py)**
   * In `app/api/v1/ai_tasks.py`:

     * When `settings.USE_QUEUE`:

       * Replace `BackgroundTasks` with enqueue to RQ using `job_id=request.jobId`.
       * Redis set `inflight` for dedup across processes.
     * Else keep current behavior.

     ```python
     from app.queue import q, r
     if settings.USE_QUEUE:
         key = f"inflight:{request.jobId}"
         if not r.setnx(key, "1"):
             logger.info("Duplicate job ignored", extra={"jobId": request.jobId})
         else:
             r.expire(key, 3600)
             q.enqueue("app.core.logic.process_job_entrypoint", {
                 "jobId": request.jobId,
                 "text": request.text,
                 "model": request.model,
                 "cardType": request.cardType,
                 "numCards": request.numCards,
                 "config": request.config or {}
             }, job_id=request.jobId)
     ```
   * In `app/core/logic.py` add synchronous entrypoint:

     ```python
     def process_job_entrypoint(payload: dict):
         import asyncio, time
         asyncio.run(process_card_generation(
             job_id=payload["jobId"],
             input_text=payload["text"],
             model=payload.get("model"),
             card_type=payload.get("cardType","qa"),
             num_cards=payload.get("numCards",10),
             start_time=time.time()
         ))
     ```
   * **Acceptance:** Jobs process correctly both with `USE_QUEUE=false` and `true`.

3. **Make webhook delivery async & non-blocking**

   * **BE(Py)**
   * Add FastAPI lifespan with shared `httpx.AsyncClient` in `app/main.py`.
   * Replace `requests` with `httpx` in `app/core/logic.py`:

     * Implement `async def send_webhook_with_retry_async(app, payload, ...)`.
     * Update `process_card_generation` to `await` it.
   * Keep a minimal synchronous fallback for last‑resort errors.
   * **Acceptance:** Under load test, event loop not blocked; successful delivery visible in Next.js logs.

4. **Inbound request HMAC verification (defense‑in‑depth)**

   * **FE(Next) + BE(Py)**
   * Next.js `actions/ai/submit-text.ts`: sign `{timestamp}.{rawBody}` using `INTERNAL_WEBHOOK_HMAC_SECRET`; send `x-webhook-timestamp` + `x-webhook-signature`.
   * `ai-service/app/dependencies.py`:

     ```python
     from fastapi import Request
     import hmac, hashlib, time
     async def validate_inbound_signature(request: Request):
         if not settings.ENABLE_INBOUND_HMAC: return
         ts = request.headers.get("x-webhook-timestamp"); sig = request.headers.get("x-webhook-signature")
         body = await request.body()
         mac = hmac.new(settings.INTERNAL_WEBHOOK_HMAC_SECRET.encode(), f"{ts}.{body.decode()}".encode(), hashlib.sha256).hexdigest()
         if sig != f"sha256={mac}": raise HTTPException(401, "Invalid signature")
         # (Optional) validate ts drift
     ```
   * Add as a dependency on `/generate-cards` behind flag.
   * **Acceptance:** Valid requests pass; tampered body/signature fails.

5. **Tighten CORS for non‑dev**

   * **BE(Py)**
   * If `ENVIRONMENT!="development"` and `CORS_ORIGINS` not `*`, set explicit origins and keep `allow_credentials=True`.
   * **Acceptance:** Browser preflights succeed for Next.js origin; others blocked.

---

### Phase 2 — Scalability & Quality of Generation

**Objective:** Handle long inputs, improve consistency, scale safely.

1. **Lazy client initialization & strict timeouts**

   * **BE(Py)**
   * Create `app/core/ai_clients.py` with `@lru_cache` getters. Inject timeouts.

     ```python
     from functools import lru_cache
     from openai import AsyncOpenAI
     from anthropic import AsyncAnthropic
     from app.core.errors import AuthError
     @lru_cache
     def get_openai_client(): 
         if not settings.OPENAI_API_KEY: raise AuthError("OPENAI_API_KEY not configured")
         return AsyncOpenAI(api_key=settings.OPENAI_API_KEY, timeout=20)
     @lru_cache
     def get_anthropic_client():
         if not settings.ANTHROPIC_API_KEY: raise AuthError("ANTHROPIC_API_KEY not configured")
         return AsyncAnthropic(api_key=settings.ANTHROPIC_API_KEY, timeout=20)
     ```
   * Update `ai_caller.py` to use these getters.
   * **Acceptance:** App starts without Anthropic key if not used; errors are clear when called.

2. **Per‑provider concurrency control**

   * **BE(Py)**
   * In `ai_caller.py` create semaphores:

     ```python
     openai_sem = asyncio.Semaphore(settings.OPENAI_MAX_CONCURRENCY)
     anthropic_sem = asyncio.Semaphore(settings.ANTHROPIC_MAX_CONCURRENCY)
     async with openai_sem: ...
     ```
   * **Acceptance:** Load tests show capped concurrency; no provider overload.

3. **Anthropic JSON strictness & lower temperature**

   * **BE(Py)**
   * For Anthropic calls, append instruction “Output strictly valid JSON, no prose.” Lower `temperature=0.3`. Optionally use `json_schema` if available to your SDK (can be added later).
   * After parse, set `card["type"]=card_type` if missing.
   * **Acceptance:** Parse error rate drops (track via metrics).

4. **Chunked pipeline for long inputs**

   * **BE(Py)**
   * In `app/core/logic.py`, before `generate_cards_with_ai` call:

     * If `count_tokens(input_text)> threshold`, split with `chunk_text(...)`.
     * Allocate `num_cards` across chunks by token weight.
     * Generate per chunk → merge → normalize → deduplicate → cap to `num_cards`.
     * Helper: `normalize(text)` lowercases, strips, collapses spaces; dedup by `front`.
   * **Acceptance:** Large inputs succeed; card count equals requested; duplicates minimized.

5. **Token budget tied to `numCards`**

   * **BE(Py)**
   * In `ai_caller.py`, compute:

     ```python
     per_card = settings.TOKENS_PER_CARD_BUDGET
     budget = min(settings.MAX_OUTPUT_TOKENS, per_card * num_cards)
     ```
   * Use `budget` in provider calls.
   * **Acceptance:** Output tokens roughly bounded; cost variance reduced.

6. **Redis‑backed per‑user rate limiting**

   * **FE(Next) + BE(Py)**
   * FE: on server-to-server call, include `X-User-Id` (from Clerk) and `X-Org-Id` if applicable.
   * BE: replace IP limiter with Redis token bucket:

     ```python
     async def rate_limit(user_key: str, limit=60, window=60):
         key = f"rl:{user_key}:{int(time.time()//window)}"
         # use redis.atomic pipeline
     ```
   * Fallback to IP if header missing.
   * **Acceptance:** Limits apply per user across instances.

7. **Readiness & metrics**

   * **BE(Py)/DevOps**
   * Add `/ready` to test Redis connectivity; keep `/health`.
   * Integrate `prometheus-fastapi-instrumentator`:

     * Expose `/metrics`.
     * Custom counters: `ai_requests_total{provider,model,status}`, histograms for latency.
   * **Acceptance:** Metrics scrapeable; dashboards show per-model success/latency.

---

### Phase 3 — UX & Operational Features

**Objective:** Better user feedback, card quality, and ops tooling.

1. **Progress webhooks (optional, behind flag)**

   * **BE(Py)**
   * When chunking: send status updates:

     * `in_progress` with `phase: "chunk_n_of_m"` and `progressPct`.
   * Payload reuse `WebhookPayload` by adding `status: "in_progress"` (extend schema to allow this) or create a separate `ProgressPayload`.
   * **FE(Next)**
   * Update job UI to display progress if received.
   * **Acceptance:** UI shows progress bars for long jobs.

2. **Post‑processing normalization & validation**

   * **BE(Py)**
   * Add `clean_card()`:

     * Normalize whitespace/punctuation.
     * Ensure question-style fronts end with `?` (for QA).
     * For cloze: ensure exactly one `[...]` and back equals deletion.
   * Reject malformed cards; if < `num_cards`, optionally call provider for a small top-up (behind flag).
   * **Acceptance:** Cards pass validation functions; visible improvement.

3. **Cost accounting (behind flag)**

   * **BE(Py)**
   * Add simple pricing table in config; compute `costUSD` from input/output token counts; include in `resultPayload`.
   * **Acceptance:** Webhook contains `costUSD`; FE can show in debug view.

4. **Admin & preview endpoints (internal-key protected)**

   * **BE(Py)**
   * `/api/v1/preview-cards` (no webhook; returns parsed cards for small text).
   * `/api/v1/tokenize` (returns token counts & chunk preview).
   * `/api/v1/admin/retry-webhook/{jobId}` (best-effort re-post of last payload if stored; optional if you persist).
   * **Acceptance:** Tools usable by devs; require `X-Internal-API-Key`.

5. **Docker hardening**

   * **DevOps**
   * Run as non-root; set workers; lower keep-alive.
   * Update Dockerfile:

     ```dockerfile
     RUN useradd -m appuser
     USER appuser
     CMD ["uvicorn","app.main:app","--host","0.0.0.0","--port","80","--workers","2","--timeout-keep-alive","20"]
     ```
   * **Acceptance:** Container runs as non-root; no capability warnings.

---

### Phase 4 — Reliability Patterns & Fallbacks

**Objective:** Improve resilience to provider issues and spikes.

1. **Model fallback (behind flag)**

   * **BE(Py)**
   * In `generate_cards_with_ai`, wrap provider call:

     ```python
     try:
         return await _generate_with_anthropic(...)
     except (RateLimitExceeded, NetworkError, AIServiceError) as e:
         if settings.ENABLE_FALLBACK:
             logger.warning("Fallback to OpenAI", extra={"reason": type(e).__name__})
             return await _generate_with_openai(...)
         raise
     ```
   * **Acceptance:** Simulated Anthropic outage still yields cards (when flag enabled).

2. **Circuit breaker (lightweight)**

   * **BE(Py)**
   * Use a sliding counter in Redis for provider failures; if threshold exceeded, short-circuit for `cooldown` window.
   * **Acceptance:** During repeated failures, calls avoid failing provider temporarily.

---

### Phase 5 — Tests, Observability & Docs

**Objective:** Lock in quality and make operations easy.

1. **Test suites**

   * **QA/BE(Py)**
   * **Unit:** `parse_ai_response`, `count_tokens`, `chunk_text`, `format_for_anki`, rate limiter, HMAC.
   * **Contract:** Webhook payload shapes for `completed`, `failed`, `in_progress`.
   * **Provider mocks:** Patch OpenAI/Anthropic to return canned responses.
   * **Load tests:** Simple `locust`/k6 against `/generate-cards`.
   * **Acceptance:** Coverage threshold met; load tests green for target RPS.

2. **Observability**

   * **DevOps**
   * Sentry for exceptions; OpenTelemetry spans: HTTP in → AI call → webhook out.
   * Dashboards for latencies, error rates, cost per job.
   * **Acceptance:** Alerts for error spikes and provider latency.

3. **Docs & runbooks**

   * **PM/BE(Py)**
   * Update `ai-service/README.md` with:

     * Env var reference.
     * Queue/worker operations.
     * Feature flags.
     * Metrics endpoints.
     * Troubleshooting and rollback steps.
   * **Acceptance:** New team member can run locally with Redis and complete a job.

---

### Phase 6 — Stretch Quality Enhancements (Optional)

**Objective:** Push card quality and diversity further.

1. **Embeddings-based dedup & topic balancing**

   * **BE(Py)**
   * Use inexpensive embeddings (OpenAI small) to cluster fronts; drop near-duplicates; ensure coverage of clusters.
   * Cache embeddings by normalized sentence.
   * **Acceptance:** Duplicate rate decreases; qualitative review confirms variety.

2. **A/B levers**

   * **BE(Py)/FE(Next)**
   * Add inputs to tweak `temperature`, `numCards`, model choice; record results to analyze quality.
   * **Acceptance:** Toggle levers via feature flags or query params in admin UI.

---

## Integration Work with Next.js

* **Headers:** Ensure Next.js sends `X-Internal-API-Key`, `X-User-Id`, optional `x-webhook-timestamp`/`x-webhook-signature` for inbound HMAC.
* **Webhook verify:** `/api/webhooks/ai-service-status` should already verify `x-internal-api-key` and, if present, HMAC/time skew.
* **UI updates:** Progress bar for `in_progress`; show `costUSD` in debug; display error `category` and `suggestedAction`.

---

## Rollout & Risk Management

* **Feature flags first:** Deploy with flags off; enable per environment.
* **Shadow mode:** For queueing, dual‑run `BackgroundTasks` and RQ in staging to compare outcomes; then switch flag.
* **Rollback:** Keep old path guarded by flag; revert by toggling `USE_QUEUE=false`.
* **Config validation:** On startup, log all derived settings and warn if misconfigured (e.g., missing Redis when `USE_QUEUE=true`).

---

## PR Breakdown (suggested order)

1. Phase 0: CI + flags + config validator.
2. Phase 1: Redis + RQ (flagged) + async webhook.
3. Phase 2: Lazy clients + semaphores + Anthropic JSON strictness.
4. Phase 2: Chunked pipeline + token budgets + per-user rate limiting.
5. Phase 2: Readiness + Prometheus metrics.
6. Phase 3: Progress webhooks + cleanup/normalization.
7. Phase 3: Cost accounting + admin/preview endpoints.
8. Phase 4: Fallback + circuit breaker.
9. Phase 5: Tests, load test harness, docs.
10. Phase 6: Embeddings dedup + A/B toggles (optional).

---

## Acceptance Criteria Summary (per capability)

* **Durable queue:** Jobs persist across restarts; worker scaling increases throughput linearly.
* **Async webhooks:** No event loop blocking; retries with jitter; HMAC on outgoing.
* **Chunking pipeline:** Long inputs complete; duplicates minimized; card count met.
* **Rate limits:** Enforced per user across instances; safe under NAT.
* **Observability:** Metrics by provider/model; dashboards and alerts.
* **Security:** Inbound and outbound HMAC (when enabled); non-root container; strict CORS in prod.
* **Quality:** JSON parse errors rare; normalized, validated cards; optional fallback reduces failures.
* **Testing:** Unit/contract/load tests in CI; coverage threshold configured.

---

## Environment Variables (add to `.env.example`)

```
# Infra & Flags
REDIS_URL=redis://localhost:6379/0
USE_QUEUE=false
ENABLE_FALLBACK=false
ENABLE_PROGRESS_UPDATES=false
ENABLE_COST_ACCOUNTING=false
ENABLE_INBOUND_HMAC=false

# Concurrency & Budgets
OPENAI_MAX_CONCURRENCY=8
ANTHROPIC_MAX_CONCURRENCY=8
TOKENS_PER_CARD_BUDGET=128

# CORS
CORS_ORIGINS=["http://localhost:3000"]

# Observability (optional)
SENTRY_DSN=
OTEL_EXPORTER_OTLP_ENDPOINT=
```

---

## Done Checklist (before enabling all flags in production)

* [ ] Queue and workers healthy; Redis monitored.
* [ ] Async webhooks delivering; retries observed in logs.
* [ ] Readiness/metrics in place; dashboards live.
* [ ] Rate limits verified with multiple users.
* [ ] Chunked jobs produce high-quality, deduped cards at requested count.
* [ ] Fallback exercised in staging; circuit breaker tested.
* [ ] Security checks: inbound/outbound HMAC, CORS, non-root container.
* [ ] Tests green in CI; load tests meet target RPS and latency SLOs.
* [ ] Docs updated; runbooks available.

This plan enables safe, incremental delivery of the high‑impact improvements while keeping the current contract with the Next.js app stable and observable at every step.
