import { auth, clerkClient } from "@clerk/nextjs";
import { NextResponse } from "next/server";
import { db } from "@/db";
import { users } from "@/db/schema";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST() {
  try {
    const { userId } = auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = await clerkClient.users.getUser(userId);
    const primaryEmail = user.emailAddresses.find(
      e => e.id === user.primaryEmailAddressId
    )?.emailAddress ?? user.emailAddresses[0]?.emailAddress;

    if (!primaryEmail) {
      return NextResponse.json({ error: "No email found" }, { status: 400 });
    }

    await db.insert(users)
      .values({ 
        id: userId, 
        email: primaryEmail,
        createdAt: new Date(),
        updatedAt: new Date()
      })
      .onConflictDoUpdate({ 
        target: users.id, 
        set: { 
          email: primaryEmail, 
          updatedAt: new Date() 
        } 
      });

    return NextResponse.json({ status: "ok" });
  } catch (error) {
    console.error("Ensure user error:", error);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}