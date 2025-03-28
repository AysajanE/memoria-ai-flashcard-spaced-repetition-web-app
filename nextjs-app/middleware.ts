import { authMiddleware } from "@clerk/nextjs";

// This example protects all routes including api/trpc routes
// Please edit this to allow other routes to be public as needed.
// See https://clerk.com/docs/references/nextjs/auth-middleware for more information about configuring your middleware
export default authMiddleware({
  publicRoutes: [
    "/",
    "/sign-in",
    "/sign-up",
    "/api/webhooks/clerk",
    "/api/webhooks/ai-service-status",
  ],
  async afterAuth(auth, req, evt) {
    // Your custom code here
  },
  ignoredRoutes: [
    "/((?!api|trpc))(_next.*|.+.[w]+$)",
  ],
});

export const config = {
  matcher: ["/((?!.+\\.[\\w]+$|_next).*)", "/", "/(api|trpc)(.*)"],
  runtime: 'nodejs'
};
