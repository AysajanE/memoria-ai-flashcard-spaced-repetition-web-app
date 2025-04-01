/**
 * @file route.ts
 * @description
 *   This file implements a Clerk webhook receiver using Svix for signature verification.
 *   It handles the "user.created" event to ensure that a new user record is synchronized
 *   into our database (`users` table) whenever a user signs up via Clerk.
 *
 *   Primary responsibilities:
 *   1. Validate the request using the Clerk/Svix signature headers
 *   2. Parse the JSON payload and identify the event type
 *   3. If it's "user.created", extract the Clerk user ID and email address
 *   4. Call `syncUser(...)` to create or update the user in our local database
 *   5. Respond with a success or error message
 *
 *   Why we need this:
 *   - Without this webhook, newly registered users wouldn't appear in our `users` table.
 *   - The fallback is an optional approach to ensure user creation if this webhook fails.
 *
 * @dependencies
 *   - "svix": for validating the webhook signature (ensures the request is actually from Clerk)
 *   - "syncUser(...)": a server action that creates/updates user info in the DB
 *   - "CLERK_WEBHOOK_SECRET": must be in `.env.local` to verify authenticity
 *
 * @notes
 *   - If the user doesn't have a valid email, we skip insertion
 *   - If there's another event type (e.g., "user.updated"), we can handle it, or just log it
 *   - Errors get logged and we return appropriate HTTP status codes
 */

import { Webhook } from "svix";
import { WebhookEvent } from "@clerk/nextjs/server";
import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { syncUser } from "../../../actions/db/users";

export const runtime = 'nodejs'; // Use Node.js runtime

export async function POST(req: Request) {
  // Clerk + Svix provide these headers
  const headerPayload = headers();
  const svix_id = headerPayload.get("svix-id");
  const svix_timestamp = headerPayload.get("svix-timestamp");
  const svix_signature = headerPayload.get("svix-signature");

  // If they're missing, we can't verify authenticity
  if (!svix_id || !svix_timestamp || !svix_signature) {
    return new NextResponse("Missing svix headers", { status: 400 });
  }

  try {
    // Read the request body as JSON
    const payload = await req.json();
    const body = JSON.stringify(payload);

    // Create a new Webhook instance using the Clerk signing secret
    // from our .env.local (CLERK_WEBHOOK_SECRET)
    const wh = new Webhook(process.env.CLERK_WEBHOOK_SECRET || "");

    // This call will throw if verification fails
    const evt = wh.verify(body, {
      "svix-id": svix_id,
      "svix-timestamp": svix_timestamp,
      "svix-signature": svix_signature,
    }) as WebhookEvent;

    // Clerk uses 'type' to indicate event type, e.g., "user.created"
    const eventType = evt.type;
    console.log(`Clerk webhook event received: ${eventType}`);

    // Only handle user.created for now
    if (eventType === "user.created") {
      const { id, email_addresses, created_at, updated_at } = evt.data;

      // Grab the first valid email or the "primary" email
      const primaryEmail = email_addresses.find(
        (emailObj: any) => emailObj.email_address && emailObj.email_address.includes("@")
      )?.email_address;

      if (!primaryEmail) {
        console.error("No valid email found for user:", id);
        return new NextResponse("No valid email found", { status: 400 });
      }

      try {
        // syncUser(...) is responsible for either inserting or updating user records
        await syncUser(id, primaryEmail, created_at, updated_at);
        console.log("User synced successfully:", id);
        return new NextResponse("User synced successfully", { status: 200 });
      } catch (error) {
        console.error("Error syncing user:", error);
        return new NextResponse("Error syncing user", { status: 500 });
      }
    }

    // If it's another event type, log and return 200
    console.log(`Received Clerk event type: ${eventType} - No action taken.`);
    return new NextResponse("Webhook received", { status: 200 });
  } catch (err) {
    console.error("Error verifying or processing webhook:", err);
    return new NextResponse("Error verifying webhook", { status: 400 });
  }
}

