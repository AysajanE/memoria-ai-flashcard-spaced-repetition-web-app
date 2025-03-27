'use server';

import { db } from '@/db';
import { users } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { auth } from "@clerk/nextjs";
import { ActionState } from "@/types";

export async function syncUser(
  userId: string,
  email: string,
  clerkCreatedAt: number,
  clerkUpdatedAt: number
): Promise<ActionState> {
  try {
    await db
      .insert(users)
      .values({
        id: userId,
        email,
        createdAt: new Date(clerkCreatedAt),
        updatedAt: new Date(clerkUpdatedAt),
      })
      .onConflictDoUpdate({
        target: users.id,
        set: {
          email,
          updatedAt: new Date(clerkUpdatedAt),
        },
      });

    return { isSuccess: true, message: "User synced successfully" };
  } catch (error) {
    console.error('Error syncing user:', error);
    return { 
      isSuccess: false, 
      message: "Failed to sync user",
      error: { sync: ["Failed to sync user data"] }
    };
  }
}

export async function getUserStatsAction(): Promise<ActionState<{
  dailyCount: number;
  weeklyCount: number;
  accuracy: number;
  streak: number;
}>> {
  try {
    const { userId } = auth();
    if (!userId) {
      return {
        isSuccess: false,
        message: "Unauthorized",
      };
    }

    // Fetch user record
    const user = await db.query.users.findFirst({
      where: eq(users.id, userId),
      columns: {
        dailyStudyCount: true,
        weeklyStudyCount: true,
        totalReviews: true,
        totalCorrectReviews: true,
        consecutiveStudyDays: true,
      },
    });

    if (!user) {
      return {
        isSuccess: false,
        message: "User not found",
      };
    }

    // Calculate accuracy percentage, handling division by zero
    const accuracy = user.totalReviews > 0 
      ? (user.totalCorrectReviews / user.totalReviews) * 100 
      : 0;

    return {
      isSuccess: true,
      data: {
        dailyCount: user.dailyStudyCount,
        weeklyCount: user.weeklyStudyCount,
        accuracy: Number(accuracy.toFixed(2)),
        streak: user.consecutiveStudyDays,
      },
    };
  } catch (error) {
    console.error("Error fetching user stats:", error);
    return {
      isSuccess: false,
      message: "Failed to fetch user stats",
    };
  }
} 