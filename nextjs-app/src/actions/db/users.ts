'use server';

import { db } from '@/db';
import { users } from '@/db/schema';
import { eq } from 'drizzle-orm';

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