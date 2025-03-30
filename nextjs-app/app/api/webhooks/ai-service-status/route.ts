import { db } from "@/db";
import { processingJobs } from "@/db/schema";
import { eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    // Verify internal API key
    const apiKey = req.headers.get("x-internal-api-key");
    if (apiKey !== process.env.INTERNAL_API_KEY) {
      console.error("Invalid API key in webhook request");
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    // Parse the request body
    const data = await req.json();
    
    const { jobId, status, result, error } = data;
    
    if (!jobId || !status) {
      console.error("Missing required fields in webhook payload", { jobId, status });
      return NextResponse.json(
        { error: "Bad request: missing required fields" },
        { status: 400 }
      );
    }

    console.log(`Processing AI service webhook for job ${jobId} with status ${status}`);

    // Update the job record in the database
    if (status === "completed") {
      // Handle successful job completion
      await db.update(processingJobs)
        .set({
          status: "completed",
          resultPayload: result, // This contains the flashcards from the AI service
          completedAt: new Date()
        })
        .where(eq(processingJobs.id, jobId));
      
      console.log(`Job ${jobId} completed successfully with ${result?.cards?.length || 0} flashcards`);
    } else if (status === "failed") {
      // Handle job failure
      await db.update(processingJobs)
        .set({
          status: "failed",
          errorMessage: error?.message || "Unknown error",
          completedAt: new Date()
        })
        .where(eq(processingJobs.id, jobId));
      
      console.error(`Job ${jobId} failed: ${error?.message || "Unknown error"}`);
    } else {
      // Handle unknown status
      console.warn(`Unknown job status received: ${status}`);
      return NextResponse.json(
        { error: "Invalid status" },
        { status: 400 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error processing AI service webhook:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
} 