import { auth } from "@clerk/nextjs";
import { NextResponse } from "next/server";
import { db } from "@/db";
import { users } from "@/db/schema";
// 'eq' is no longer needed if we rely on onConflictDoNothing
// import { eq } from "drizzle-orm";

export async function GET() {
  try {
    // Fetch user details once
    const { userId, user: clerkUser } = auth();

    if (!userId) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    // --- Modification Start ---
    // Attempt to insert the user.
    // If a user with the same 'id' (primary key) already exists,
    // the database constraint will trigger a conflict, and `onConflictDoNothing()`
    // tells Drizzle/Postgres to simply ignore the insert operation without erroring.
    const result = await db
      .insert(users)
      .values({
        id: userId,
        // Get primary email safely
        email:
          clerkUser?.emailAddresses?.find(
            (e) => e.id === clerkUser.primaryEmailAddressId
          )?.emailAddress ||
          clerkUser?.emailAddresses?.[0]?.emailAddress ||
          `placeholder-${userId}@example.com`, // Ensure a non-null unique fallback
        // Defaults for other columns like aiCreditsRemaining, createdAt, etc.,
        // should be handled by the database schema if defined there.
        // Explicitly set defaults if needed:
        // aiCreditsRemaining: 10,
      })
      .onConflictDoNothing() // <<< KEY CHANGE HERE
      .returning({ id: users.id }); // Optional: see if insert actually happened

    // Check if the insert query actually returned a result (meaning it inserted)
    // If onConflictDoNothing() was triggered, result will be an empty array []
    if (result.length > 0) {
      console.log(`Created new user record for ${userId}`);
      return NextResponse.json({ status: "created" });
    } else {
      console.log(`User ${userId} already exists or insert was conflicted.`);
      return NextResponse.json({ status: "exists" });
    }
    // --- Modification End ---

  } catch (error) {
    // Catch unexpected errors (e.g., DB connection issues)
    console.error("Error ensuring user exists:", error);
    const errorMessage = error instanceof Error ? error.message : "Internal server error";
    return NextResponse.json(
      { error: "Internal server error during user check/creation", details: errorMessage },
      { status: 500 }
    );
  }
}