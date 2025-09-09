/**
 * Security headers configuration for the application
 * Provides CSP and other security headers while maintaining compatibility with Clerk, Stripe, and other services
 */

export interface SecurityHeadersOptions {
  isDevelopment?: boolean;
  nonce?: string;
}

/**
 * Generate Content Security Policy (CSP) header value
 */
export function generateCSP(options: SecurityHeadersOptions = {}): string {
  const { isDevelopment = false, nonce } = options;
  
  // Base CSP directives
  const csp = {
    "default-src": ["'self'"],
    "script-src": [
      "'self'",
      // Clerk authentication
      "https://clerk.dev",
      "https://*.clerk.dev",
      "https://clerk.accounts.dev",
      // Stripe (if using)
      "https://js.stripe.com",
      // Next.js runtime
      isDevelopment ? "'unsafe-eval'" : "",
      nonce ? `'nonce-${nonce}'` : "",
      // Allow inline scripts with hash for specific cases
      "'unsafe-inline'", // Consider removing this for production after testing
    ].filter(Boolean),
    "style-src": [
      "'self'",
      "'unsafe-inline'", // Required for Tailwind CSS and many UI libraries
      // Google Fonts
      "https://fonts.googleapis.com",
    ],
    "font-src": [
      "'self'",
      "https://fonts.gstatic.com",
      "data:",
    ],
    "img-src": [
      "'self'",
      "data:",
      "blob:",
      // Clerk profile images
      "https://img.clerk.com",
      "https://*.clerk.com",
      // Allow user avatars from various providers
      "https://avatars.githubusercontent.com",
      "https://lh3.googleusercontent.com",
      // If using external image services
      "https://*.supabase.co",
    ],
    "connect-src": [
      "'self'",
      // Clerk API endpoints
      "https://api.clerk.dev",
      "https://*.clerk.accounts.dev",
      // Stripe
      "https://api.stripe.com",
      // Your AI service (adjust URL as needed)
      isDevelopment ? "http://localhost:8000" : "",
      // WebSocket connections if used
      "ws://localhost:*",
      "wss://localhost:*",
    ].filter(Boolean),
    "frame-src": [
      // Clerk sign-in/sign-up frames
      "https://clerk.dev",
      "https://*.clerk.dev",
      "https://clerk.accounts.dev",
      // Stripe checkout
      "https://checkout.stripe.com",
      "https://js.stripe.com",
    ],
    "frame-ancestors": ["'none'"], // Prevent clickjacking
    "base-uri": ["'self'"],
    "form-action": ["'self'"],
    "upgrade-insecure-requests": isDevelopment ? [] : [""],
  };

  // Convert CSP object to string
  return Object.entries(csp)
    .filter(([_, values]) => values.length > 0)
    .map(([directive, values]) => `${directive} ${values.join(" ")}`)
    .join("; ");
}

/**
 * Generate security headers object for Next.js middleware
 */
export function getSecurityHeaders(options: SecurityHeadersOptions = {}): Record<string, string> {
  const { isDevelopment = false } = options;
  
  return {
    // Content Security Policy
    "Content-Security-Policy": generateCSP(options),
    
    // Prevent clickjacking
    "X-Frame-Options": "DENY",
    
    // Prevent MIME type sniffing
    "X-Content-Type-Options": "nosniff",
    
    // Control referrer information
    "Referrer-Policy": "strict-origin-when-cross-origin",
    
    // Prevent XSS attacks in older browsers
    "X-XSS-Protection": "1; mode=block",
    
    // HTTPS enforcement (only in production)
    ...(isDevelopment 
      ? {} 
      : {
          "Strict-Transport-Security": "max-age=63072000; includeSubDomains; preload"
        }
    ),
    
    // Permissions Policy (formerly Feature Policy)
    "Permissions-Policy": [
      "camera=()",
      "microphone=()",
      "geolocation=()",
      "interest-cohort=()"
    ].join(", "),
  };
}

/**
 * Check if a path should have security headers applied
 */
export function shouldApplySecurityHeaders(pathname: string): boolean {
  // Skip security headers for certain paths
  const skipPaths = [
    "/api/webhooks/", // Webhook endpoints might need different CSP
    "/_next/", // Next.js internal assets
    "/favicon.ico",
    "/robots.txt",
    "/sitemap.xml",
  ];
  
  return !skipPaths.some(path => pathname.startsWith(path));
}