"use server";

import { db } from "@/db";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";
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
    console.error("Error syncing user:", error);
    return {
      isSuccess: false,
      message: "Failed to sync user",
      error: { sync: ["Failed to sync user data"] },
    };
  }
}

export async function getUserStatsAction(): Promise<
  ActionState<{
    dailyCount: number;
    weeklyCount: number;
    accuracy: number;
    streak: number;
  }>
> {
  try {
    const { userId } = auth();
    if (!userId) {
      return {
        isSuccess: false,
        message: "Unauthorized",
      };
    }

    // Fetch user record - with only existing columns
    const user = await db.query.users.findFirst({
      where: eq(users.id, userId),
    });

    if (!user) {
      return {
        isSuccess: false,
        message: "User not found",
      };
    }

    // Return default values for stats since they're not in the schema yet
    return {
      isSuccess: true,
      data: {
        dailyCount: 0,
        weeklyCount: 0,
        accuracy: 0,
        streak: 0,
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