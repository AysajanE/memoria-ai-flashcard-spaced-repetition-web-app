import { NextResponse } from "next/server";
import { db } from "@/db";
import { processingJobs } from "@/db/schema";
import { eq } from "drizzle-orm";
import { z } from "zod";

// Define the expected payload schema
const StatusUpdateSchema = z.object({
  jobId: z.string().uuid(),
  status: z.enum(["completed", "failed"]),
  resultPayload: z.any().optional(),
  errorMessage: z.string().optional(),
});

export async function POST(request: Request) {
  try {
    // Verify API Key
    const apiKey = request.headers.get("x-internal-api-key");
    if (!apiKey || apiKey !== process.env.INTERNAL_API_KEY) {
      return NextResponse.json(
        { error: "Unauthorized", errorCode: "INVALID_API_KEY" },
        { status: 401 }
      );
    }

    // Parse and validate payload
    const payload = await request.json();
    const validatedPayload = StatusUpdateSchema.parse(payload);

    // Update job record
    const [updatedJob] = await db
      .update(processingJobs)
      .set({
        status: validatedPayload.status,
        resultPayload: validatedPayload.resultPayload,
        errorMessage: validatedPayload.errorMessage,
        completedAt: new Date(),
      })
      .where(eq(processingJobs.id, validatedPayload.jobId))
      .returning();

    if (!updatedJob) {
      console.warn(`Job not found: ${validatedPayload.jobId}`);
      return NextResponse.json(
        { error: "Job not found", errorCode: "JOB_NOT_FOUND" },
        { status: 404 }
      );
    }

    return NextResponse.json(
      { message: "Status updated successfully" },
      { status: 200 }
    );
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