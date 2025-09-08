import { Webhook } from "svix";
import { WebhookEvent } from "@clerk/nextjs/server";
import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { syncUser } from "@/actions/db/users";
import { extractPrimaryEmail } from "@/lib/clerk";

export async function POST(req: Request) {
  // Get the headers
  const headerPayload = headers();
  const svix_id = headerPayload.get("svix-id");
  const svix_timestamp = headerPayload.get("svix-timestamp");
  const svix_signature = headerPayload.get("svix-signature");

  // If there are no headers, error out
  if (!svix_id || !svix_timestamp || !svix_signature) {
    return new NextResponse("Missing svix headers", { status: 400 });
  }

  // Get the body
  const payload = await req.json();
  const body = JSON.stringify(payload);

  // Create a new Svix instance with your secret.
  const secret = process.env.CLERK_WEBHOOK_SECRET;
  if (!secret) {
    console.error("CLERK_WEBHOOK_SECRET is not set");
    return new NextResponse("Server misconfiguration", { status: 500 });
  }
  const wh = new Webhook(secret);

  let evt: WebhookEvent;

  // Verify the payload with the headers
  try {
    evt = wh.verify(body, {
      "svix-id": svix_id,
      "svix-timestamp": svix_timestamp,
      "svix-signature": svix_signature,
    }) as WebhookEvent;
  } catch (err) {
    console.error("Error verifying webhook:", err);
    return new NextResponse("Error verifying webhook", { status: 400 });
  }

  // Handle the webhook
  const eventType = evt.type;

  if (eventType === "user.created" || eventType === "user.updated") {
    const { id, email_addresses, primary_email_address_id, created_at, updated_at } =
      (evt.data as any) || {};

    // Extract primary email using Clerk-provided primary_email_address_id
    const primaryEmail = extractPrimaryEmail({
      emailAddresses: email_addresses as any,
      primaryEmailAddressId: primary_email_address_id as any,
    });

    if (!primaryEmail) {
      console.error("No primary email found for user:", id);
      return new NextResponse("No primary email found", { status: 400 });
    }

    try {
      await syncUser(id as string, primaryEmail, created_at as number, updated_at as number);
      return new NextResponse("User synced successfully", { status: 200 });
    } catch (error) {
      console.error("Error syncing user:", error);
      return new NextResponse("Error syncing user", { status: 500 });
    }
  }

  // Handle other event types gracefully
  console.log(`Received webhook event: ${eventType}`);
  return new NextResponse("Webhook received", { status: 200 });
}
