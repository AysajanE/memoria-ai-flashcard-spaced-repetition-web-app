import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { processingJobs } from "@/db/schema";
import { eq } from "drizzle-orm";

export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    console.log("AI service webhook received");
    
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
    const body = await req.text();
    console.log("Request body:", body);
    
    let data;
    try {
      data = JSON.parse(body);
      console.log("Parsed data:", JSON.stringify(data, null, 2));
    } catch (parseError) {
      console.error("Failed to parse JSON body:", parseError);
      return NextResponse.json(
        { error: "Invalid JSON body" },
        { status: 400 }
      );
    }
    
    const { jobId, status } = data;
    
    if (!jobId || !status) {
      console.error("Missing required fields in webhook payload", { jobId, status });
      return NextResponse.json(
        { error: "Bad request: missing required fields" },
        { status: 400 }
      );
    }

    console.log(`Processing AI service webhook for job ${jobId} with status ${status}`);

    try {
      // Find the job in the database first
      const existingJob = await db.query.processingJobs.findFirst({
        where: eq(processingJobs.id, jobId)
      });
      
      if (!existingJob) {
        console.error(`Job ${jobId} not found in database`);
        return NextResponse.json(
          { error: "Job not found" },
          { status: 404 }
        );
      }

      // Update the job record in the database
      if (status === "completed") {
        // Handle successful job completion
        const result = data.result || data.resultPayload;
        
        if (!result) {
          console.error("Completed status but no result provided");
          return NextResponse.json(
            { error: "No result payload found for completed job" },
            { status: 400 }
          );
        }
        
        await db.update(processingJobs)
          .set({
            status: "completed",
            resultPayload: result,
            completedAt: new Date()
          })
          .where(eq(processingJobs.id, jobId));
        
        console.log(`Job ${jobId} updated to completed successfully`);
      } else if (status === "failed") {
        // Handle job failure
        const errorMessage = data.errorMessage || 
                            (data.error?.message) || 
                            (data.errorDetail?.message) || 
                            "Unknown error";
        
        await db.update(processingJobs)
          .set({
            status: "failed",
            errorMessage: errorMessage,
            completedAt: new Date()
          })
          .where(eq(processingJobs.id, jobId));
        
        console.error(`Job ${jobId} updated to failed: ${errorMessage}`);
      } else {
        // Handle unknown status
        console.warn(`Unknown job status received: ${status}`);
        return NextResponse.json(
          { error: "Invalid status" },
          { status: 400 }
        );
      }
    } catch (dbError) {
      console.error(`Database error updating job ${jobId}:`, dbError);
      return NextResponse.json(
        { error: "Database error", message: String(dbError) },
        { status: 500 }
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