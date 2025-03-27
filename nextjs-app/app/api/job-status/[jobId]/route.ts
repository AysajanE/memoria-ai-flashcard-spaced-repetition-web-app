import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs";
import { db } from "@/db";
import { processingJobs } from "@/db/schema";
import { eq, and } from "drizzle-orm";

export async function GET(
  request: Request,
  { params }: { params: { jobId: string } }
) {
  try {
    // Get authenticated user
    const { userId } = auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Validate jobId
    const { jobId } = params;
    if (!jobId) {
      return NextResponse.json({ error: "Job ID is required" }, { status: 400 });
    }

    // Query job from database
    const job = await db.query.processingJobs.findFirst({
      where: and(
        eq(processingJobs.id, jobId),
        eq(processingJobs.userId, userId)
      ),
    });

    // Check if job exists and belongs to user
    if (!job) {
      return NextResponse.json(
        { error: "Not Found or Forbidden" },
        { status: 404 }
      );
    }

    // Return job details
    return NextResponse.json({
      id: job.id,
      status: job.status,
      resultPayload: job.resultPayload,
      errorMessage: job.errorMessage,
      createdAt: job.createdAt,
      updatedAt: job.updatedAt,
    });
  } catch (error) {
    console.error("Error fetching job status:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
} 