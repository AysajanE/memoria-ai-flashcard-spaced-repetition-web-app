"use server";

import { auth } from "@clerk/nextjs";

// Define the ActionState type if not already defined elsewhere
interface ActionState<T> {
  isSuccess: boolean;
  message?: string;
  error?: Record<string, string[]>;
  data?: T;
}

// Define the type for user stats that matches what StatsDisplay expects
interface UserStats {
  dailyCount: number;
  weeklyCount: number;
  accuracy: number;
  streak: number;
}

/**
 * Retrieves the current user's learning statistics
 */
export async function getUserStatsAction(): Promise<ActionState<UserStats>> {
  try {
    // Get user authentication information
    const { userId } = auth();
    
    if (!userId) {
      return {
        isSuccess: false,
        message: "Authentication required",
        error: { auth: ["User is not authenticated"] }
      };
    }

    // In a real implementation, we would fetch this data from the database
    // For now, we'll return placeholder data
    const stats: UserStats = {
      dailyCount: 0,
      weeklyCount: 0,
      accuracy: 0,
      streak: 0
    };

    return {
      isSuccess: true,
      data: stats
    };
  } catch (error) {
    console.error("Failed to get user stats:", error);
    return {
      isSuccess: false,
      message: "Failed to retrieve user statistics",
      error: { server: ["An unexpected error occurred"] }
    };
  }
} 