import { NextResponse } from "next/server";
import { db } from "@/db";
import { processingJobs } from "@/db/schema";
import { eq } from "drizzle-orm";
import { z } from "zod";
import crypto from "crypto";
import { isLegalTransition, isTerminal } from "@/lib/job-state";

// Define error detail schema for better error handling
const ErrorCategory = z.enum([
  "invalid_input",
  "token_limit",
  "auth_error",
  "rate_limit",
  "ai_model_error",
  "parse_error",
  "network_error",
  "webhook_error",
  "internal_error",
  "unknown_error"
]);

const ErrorDetailSchema = z.object({
  message: z.string(),
  category: ErrorCategory,
  code: z.string().nullable().optional(),
  context: z.record(z.any()).nullable().optional(),
  retryable: z.boolean().default(false),
  suggestedAction: z.string().nullable().optional()
});

// Define the expected payload schema
const StatusUpdateSchema = z.object({
  jobId: z.string().uuid(),
  status: z.enum(["completed", "failed"]),
  resultPayload: z.any().optional(),
  errorDetail: ErrorDetailSchema.nullable().optional(),
  errorMessage: z.string().nullable().optional(), // Kept for backward compatibility
});

export async function POST(request: Request) {
  try {
    const raw = await request.text();

    // Verify API Key
    const apiKey = request.headers.get("x-internal-api-key");
    if (!apiKey || apiKey !== process.env.INTERNAL_API_KEY) {
      return NextResponse.json(
        { error: "Unauthorized", errorCode: "INVALID_API_KEY" },
        { status: 401 }
      );
    }

    // Optional HMAC verification
    const hmacSecret = process.env.INTERNAL_WEBHOOK_HMAC_SECRET;
    if (hmacSecret) {
      const ts = request.headers.get("x-webhook-timestamp");
      const sig = request.headers.get("x-webhook-signature");
      if (!ts || !sig) {
        return NextResponse.json(
          { error: "Missing signature headers", errorCode: "MISSING_SIGNATURE" },
          { status: 401 }
        );
      }
      const age = Math.abs(Date.now() - Number(ts));
      if (!Number.isFinite(age) || age > 5 * 60 * 1000) {
        return NextResponse.json(
          { error: "Signature timestamp expired", errorCode: "TIMESTAMP_EXPIRED" },
          { status: 401 }
        );
      }
      const expected =
        "sha256=" + crypto.createHmac("sha256", hmacSecret).update(`${ts}.${raw}`).digest("hex");
      const valid =
        expected.length === sig.length &&
        crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(sig));
      if (!valid) {
        return NextResponse.json(
          { error: "Invalid signature", errorCode: "INVALID_SIGNATURE" },
          { status: 401 }
        );
      }
    }

    // Parse and validate payload
    const payload = JSON.parse(raw);
    const validatedPayload = StatusUpdateSchema.parse(payload);

    // Enforce state machine & idempotency
    const result = await db.transaction(async (tx) => {
      const current = await tx.query.processingJobs.findFirst({
        where: eq(processingJobs.id, validatedPayload.jobId),
        columns: { status: true },
      });
      if (!current) {
        return NextResponse.json(
          { error: "Job not found", errorCode: "JOB_NOT_FOUND" },
          { status: 404 }
        );
      }

      if (isTerminal(current.status as any)) {
        return NextResponse.json(
          { message: "Already finalized", status: current.status },
          { status: 200 }
        );
      }

      if (!isLegalTransition(current.status as any, validatedPayload.status)) {
        return NextResponse.json(
          {
            error: "Illegal transition",
            from: current.status,
            to: validatedPayload.status,
            errorCode: "ILLEGAL_TRANSITION",
          },
          { status: 409 }
        );
      }

      const [updated] = await tx
        .update(processingJobs)
        .set({
          status: validatedPayload.status,
          resultPayload: validatedPayload.resultPayload,
          errorMessage:
            validatedPayload.errorDetail?.message || validatedPayload.errorMessage || null,
          errorDetail: validatedPayload.errorDetail ?? null,
          completedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(processingJobs.id, validatedPayload.jobId))
        .returning({ id: processingJobs.id });

      if (!updated) {
        return NextResponse.json(
          { error: "Failed to update job", errorCode: "UPDATE_FAILED" },
          { status: 500 }
        );
      }
      return NextResponse.json(
        { message: "Status updated successfully" },
        { status: 200 }
      );
    });

    return result;
  } catch (error) {
    console.error("Error processing AI service status update:", error);

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        {
          error: "Invalid payload",
          errorCode: "INVALID_PAYLOAD",
          details: error.errors,
        },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: "Internal server error", errorCode: "INTERNAL_ERROR" },
      { status: 500 }
    );
  }
}
