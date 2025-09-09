"use server";

import { auth } from "@clerk/nextjs";
import { db } from "@/db";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";
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