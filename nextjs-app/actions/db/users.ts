"use server";

import { auth } from "@clerk/nextjs";
import { db } from "@/db";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";

export type UserStats = {
  dailyCount: number;
  streak: number;
  totalReviews: number;
  correctRate: number;
};

export async function getUserStatsAction() {
  try {
    const { userId } = await auth();
    
    if (!userId) {
      return {
        isSuccess: false,
        message: "Not authenticated",
        error: { auth: ["You must be signed in to view user stats"] }
      };
    }

    const userResults = await db.query.users.findFirst({
      where: eq(users.id, userId),
    });

    if (!userResults) {
      return {
        isSuccess: false,
        message: "User not found",
        error: { user: ["User not found in database"] }
      };
    }

    const correctRate = userResults.totalReviews > 0
      ? Math.round((userResults.totalCorrectReviews / userResults.totalReviews) * 100)
      : 0;

    return {
      isSuccess: true,
      data: {
        dailyCount: userResults.dailyStudyCount,
        streak: userResults.consecutiveStudyDays,
        totalReviews: userResults.totalReviews,
        correctRate
      } as UserStats
    };
  } catch (error) {
    console.error("Error fetching user stats:", error);
    return {
      isSuccess: false,
      message: "Failed to fetch user statistics",
      error: { server: ["An unexpected error occurred"] }
    };
  }
} 