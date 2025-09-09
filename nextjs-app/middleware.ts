import { authMiddleware } from "@clerk/nextjs";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getSecurityHeaders, shouldApplySecurityHeaders } from "@/src/lib/security-headers";

// Enhanced middleware that combines Clerk authentication with security headers
export default authMiddleware({
  publicRoutes: [
    "/",
    "/sign-in(.*)",
    "/sign-up(.*)",
    "/articles",
    "/articles/(.*)",
    "/api/webhooks/clerk",
    "/api/webhooks/ai-service-status",
    "/api/auth/ensure-user",
    "/dev/security-test", // Dev-only security testing page
  ],
  ignoredRoutes: [
    "/((?!api|trpc))(_next.*|.+.[w]+$)",
  ],
  
  // Apply security headers after Clerk processes the request
  afterAuth(auth, req: NextRequest) {
    // Get the response from Clerk's default handling
    const response = NextResponse.next();
    
    // Check if we should apply security headers to this path
    if (shouldApplySecurityHeaders(req.nextUrl.pathname)) {
      // Determine if we're in development
      const isDevelopment = process.env.NODE_ENV === "development";
      
      // Get security headers
      const securityHeaders = getSecurityHeaders({ isDevelopment });
      
      // Apply security headers to the response
      Object.entries(securityHeaders).forEach(([key, value]) => {
        response.headers.set(key, value);
      });
    }
    
    return response;
  },
});

export const config = {
  matcher: ["/((?!.+\\.[\\w]+$|_next).*)", "/", "/(api|trpc)(.*)"]
};
