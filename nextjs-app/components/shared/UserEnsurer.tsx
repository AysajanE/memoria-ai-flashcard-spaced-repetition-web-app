"use client";

import { useEffect } from "react";
import { useAuth } from "@clerk/nextjs";

export function UserEnsurer() {
  const { userId, isLoaded } = useAuth();

  useEffect(() => {
    if (isLoaded && userId) {
      // Call our API endpoint to ensure the user record exists
      fetch("/api/auth/ensure-user")
        .then((res) => {
          if (!res.ok) {
            console.error("Failed to ensure user exists");
          }
        })
        .catch((err) => {
          console.error("Error calling ensure-user endpoint:", err);
        });
    }
  }, [isLoaded, userId]);

  // This component doesn't render anything visible
  return null;
} 