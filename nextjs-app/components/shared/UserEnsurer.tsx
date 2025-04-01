/**
 * @file UserEnsurer.tsx
 * @description
 *   This client component acts as a fallback to ensure that a user record
 *   exists in our local database. If the Clerk webhook fails or is never set up,
 *   when a user logs in, we call the `/api/auth/ensure-user` endpoint to create
 *   or update the user record in the DB.
 *
 *   Primary responsibilities:
 *   1. On client-side mount, check if user is authenticated (Clerk).
 *   2. If so, do a simple fetch to /api/auth/ensure-user
 *   3. If that endpoint is successful, the user is guaranteed in the DB
 *   4. If it fails, log an error
 *
 *   Why we need this fallback:
 *   - Ideally, Clerk's "user.created" webhook populates the DB record.
 *   - However, if the webhook is misconfigured or there's an edge case
 *     (e.g., the user existed in Clerk but not in the DB), we still want
 *     to ensure the user is present so that server actions won't fail.
 *
 * @notes
 *   - This component is invisible on the page
 *   - The ensure-user route is similarly minimal, just a server action that calls:
 *       await db.insert(users).values(...).onConflictDoUpdate( ... )
 *   - In production, you may want to handle errors or re-tries more gracefully
 */

"use client";

import { useEffect } from "react";
import { useAuth } from "@clerk/nextjs";

export function UserEnsurer() {
  const { userId, isLoaded } = useAuth();

  useEffect(() => {
    if (isLoaded && userId) {
      // Attempt to create or confirm the user in our DB
      // This fetch calls an API route that does the actual DB logic server-side
      fetch("/api/auth/ensure-user")
        .then((res) => {
          if (!res.ok) {
            console.error("Failed to ensure user exists in DB");
          }
        })
        .catch((err) => {
          console.error("Error calling ensure-user endpoint:", err);
        });
    }
  }, [isLoaded, userId]);

  // This is a headless component that doesn't render anything.
  // It just triggers a side effect to ensure the user is created server-side.
  return null;
}
