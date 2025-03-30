import { auth } from "@clerk/nextjs";
import { NextResponse } from "next/server";
import { db } from "@/db";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";

export async function GET() {
  try {
    const { userId } = auth();
    
    if (!userId) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }
    
    // Check if user exists in our database
    const existingUser = await db.query.users.findFirst({
      where: eq(users.id, userId),
    });
    
    // If user doesn't exist, create them
    if (!existingUser) {
      const userInfo = auth().user;
      await db.insert(users).values({
        id: userId,
        email: userInfo?.emailAddresses[0]?.emailAddress || '',
        aiCreditsRemaining: 500, // Give new users some free credits
      });
      console.log(`Created new user record for ${userId}`);
      
      return NextResponse.json({ status: "created" });
    }
    
    return NextResponse.json({ status: "exists" });
  } catch (error) {
    console.error("Error ensuring user exists:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
} 