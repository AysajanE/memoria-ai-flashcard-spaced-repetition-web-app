"use server";

import { auth } from "@clerk/nextjs";
import crypto from "crypto";

export async function simulateWebhookAction(
  jobId: string
): Promise<{ ok: boolean; message: string }> {
  const { userId } = auth();
  if (!userId) {
    return { ok: false, message: "Unauthorized" };
  }
  if (process.env.NODE_ENV === "production") {
    return { ok: false, message: "Disabled in production" };
  }

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  const apiKey = process.env.INTERNAL_API_KEY || "";
  if (!apiKey) {
    return { ok: false, message: "Missing INTERNAL_API_KEY" };
  }

  const payload = {
    jobId,
    status: "completed" as const,
    resultPayload: {
      cards: [
        { front: "What is AI?", back: "AI is intelligence demonstrated by machines." },
        {
          front: "Define SRS.",
          back: "Spaced Repetition System optimizes review scheduling.",
        },
      ],
    },
  };
  const raw = JSON.stringify(payload);

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "x-internal-api-key": apiKey,
  };

  const hmacSecret = process.env.INTERNAL_WEBHOOK_HMAC_SECRET;
  if (hmacSecret) {
    const ts = Date.now().toString();
    const mac = crypto
      .createHmac("sha256", hmacSecret)
      .update(`${ts}.${raw}`)
      .digest("hex");
    headers["x-webhook-timestamp"] = ts;
    headers["x-webhook-signature"] = `sha256=${mac}`;
  }

  const res = await fetch(`${baseUrl}/api/webhooks/ai-service-status`, {
    method: "POST",
    headers,
    body: raw,
  });

  if (!res.ok) {
    let err = `${res.status}`;
    try {
      const j = await res.json();
      err += ` ${j.error || ""}`;
    } catch {}
    return { ok: false, message: `Webhook failed: ${err}` };
  }
  return { ok: true, message: "OK" };
}

