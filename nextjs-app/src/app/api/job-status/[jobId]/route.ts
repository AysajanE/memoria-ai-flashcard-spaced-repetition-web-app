import { auth } from "@clerk/nextjs";
import { db } from "@/db";
import { processingJobs } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { NextResponse } from "next/server";

export async function GET(
  request: Request,
  { params }: { params: { jobId: string } }
) {
  try {
    const { userId } = auth();
    if (!userId) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const jobId = params.jobId;
    if (!jobId) {
      return NextResponse.json(
        { error: "Job ID is required" },
        { status: 400 }
      );
    }

    const job = await db.query.processingJobs.findFirst({
      where: and(
        eq(processingJobs.id, jobId),
        eq(processingJobs.userId, userId)
      ),
    });

    if (!job) {
      return NextResponse.json(
        { error: "Job not found or unauthorized" },
        { status: 404 }
      );
    }

    // Return only the necessary data for the client
    return NextResponse.json({
      id: job.id,
      status: job.status,
      jobType: job.jobType,
      createdAt: job.createdAt,
      updatedAt: job.updatedAt,
      resultPayload: job.resultPayload,
      errorMessage: job.errorMessage,
    });
  } catch (error) {
    console.error("Error fetching job status:", error);
    return NextResponse.json(
      { error: "Failed to fetch job status" },
      { status: 500 }
    );
  }
} 