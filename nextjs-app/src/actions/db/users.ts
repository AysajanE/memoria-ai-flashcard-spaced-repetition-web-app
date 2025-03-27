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
) {
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

    return { success: true };
  } catch (error) {
    console.error('Error syncing user:', error);
    return { success: false, error };
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
        totalRecallAccuracy: true,
        consecutiveStudyDays: true,
      },
    });

    if (!user) {
      return {
        isSuccess: false,
        message: "User not found",
      };
    }

    return {
      isSuccess: true,
      data: {
        dailyCount: user.dailyStudyCount,
        weeklyCount: user.weeklyStudyCount,
        accuracy: Number(user.totalRecallAccuracy),
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