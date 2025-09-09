# Security Implementation

This document describes the security measures implemented in the Memoria application.

## Overview

Phase 7 implementation includes comprehensive security headers and markdown sanitization to protect against XSS attacks, clickjacking, and other common web vulnerabilities.

## Security Headers

### Implemented Headers

All pages receive the following security headers via middleware:

- **Content-Security-Policy (CSP)**: Comprehensive policy allowing necessary domains for Clerk, Stripe, and other services
- **X-Frame-Options**: Set to `DENY` to prevent clickjacking
- **X-Content-Type-Options**: Set to `nosniff` to prevent MIME type sniffing
- **Referrer-Policy**: Set to `strict-origin-when-cross-origin`
- **X-XSS-Protection**: Set to `1; mode=block` for older browser protection
- **Permissions-Policy**: Restricts access to sensitive browser features
- **Strict-Transport-Security**: Enforces HTTPS in production (automatic)

### CSP Configuration

The Content Security Policy is configured to allow:

**Script Sources:**
- `'self'` - Application scripts
- Clerk domains for authentication
- Stripe for payments
- `'unsafe-eval'` in development only
- `'unsafe-inline'` (consider removing in production after testing)

**Style Sources:**
- `'self'` - Application styles
- `'unsafe-inline'` - Required for Tailwind CSS
- Google Fonts

**Image Sources:**
- `'self'` - Application images
- `data:` and `blob:` URLs
- Clerk profile images
- GitHub and Google avatars
- Supabase storage (if used)

**Connect Sources:**
- `'self'` - API calls to same origin
- Clerk API endpoints
- Stripe API
- Local AI service in development

**Frame Sources:**
- Clerk authentication frames
- Stripe checkout

### Header Application Logic

Headers are applied via `middleware.ts` using the `afterAuth` callback to ensure compatibility with Clerk authentication. Headers are skipped for:

- Webhook endpoints (`/api/webhooks/`)
- Next.js internal assets (`/_next/`)
- Static files (favicon.ico, robots.txt, etc.)

## Markdown Sanitization

### Implementation

The `MarkdownRenderer` component uses `rehype-sanitize` to prevent XSS attacks in user-generated content.

**Allowed HTML Tags:**
- Text formatting: `p`, `br`, `strong`, `em`, `u`, `s`, `del`, `ins`, `mark`, `small`
- Headings: `h1` through `h6`
- Lists: `ul`, `ol`, `li`
- Links: `a` (with restrictions)
- Code: `code`, `pre`
- Tables: `table`, `thead`, `tbody`, `tr`, `th`, `td`
- Other: `blockquote`, `hr`, `div`, `span`

**Security Measures:**
- Dangerous tags are stripped: `script`, `style`, `iframe`, `object`, `embed`, `form`, `input`, `textarea`, `button`
- Event handlers (onclick, onmouseover, etc.) are removed
- `javascript:` protocols are blocked
- Links automatically get security attributes: `target="_blank"`, `rel="noopener noreferrer nofollow"`

**Usage:**

```tsx
import { MarkdownRenderer } from "@/components/shared/markdown-renderer";

// Safe rendering (default)
<MarkdownRenderer content={userContent} />

// Allow dangerous HTML (trusted content only)
<MarkdownRenderer content={trustedContent} allowDangerousHtml={true} />
```

### Bypassing Sanitization

The `allowDangerousHtml` prop can be used to bypass sanitization for trusted content, but should be used with extreme caution and only for content from trusted sources.

## Testing

### Security Headers Testing

Test security headers using curl:

```bash
# Test main page headers
curl -I http://localhost:3000/

# Check for specific headers
curl -H "Accept: application/json" -I http://localhost:3000/ | grep -i "x-frame-options\|content-security-policy"
```

### XSS Protection Testing

Test payloads that should be sanitized:

```html
<script>alert("XSS")</script>
<img src="x" onerror="alert('XSS')">
<iframe src="javascript:alert('XSS')"></iframe>
<div onmouseover="alert('XSS')">Hover me</div>
<a href="javascript:alert('XSS')">Click me</a>
```

### Development Testing Page

In development mode, visit `/dev/security-test` for an interactive security testing interface (automatically blocked in production).

## CSP Violation Monitoring

Monitor the browser console for CSP violations. In production, consider implementing CSP violation reporting:

```javascript
// Add to CSP header
report-uri /api/csp-violations
```

## Browser Compatibility

- **Modern Browsers**: Full support for all security headers
- **Older Browsers**: X-XSS-Protection provides basic protection
- **IE/Legacy**: Limited CSP support, relies on other headers

## Maintenance

### Regular Updates

1. **Review CSP Policy**: Regularly review and tighten CSP directives
2. **Update Sanitization Rules**: Keep rehype-sanitize updated
3. **Monitor Violations**: Track and address CSP violations
4. **Security Audits**: Perform regular security assessments

### Adding New Domains

When adding new third-party services, update the CSP configuration in `src/lib/security-headers.ts`:

```typescript
// Add to appropriate directive
"script-src": [
  // existing sources...
  "https://new-service.com",
],
```

### Performance Considerations

- CSP parsing adds minimal overhead
- Markdown sanitization processes content at render time
- Headers are cached by middleware for better performance

## Security Checklist

- [ ] All pages have security headers applied
- [ ] CSP policy allows only necessary domains
- [ ] Markdown content is sanitized by default
- [ ] Links have security attributes
- [ ] Webhooks correctly bypass security headers
- [ ] Production removes development-specific policies
- [ ] CSP violations are monitored
- [ ] Regular security audits are performed

## Incident Response

If XSS or other security issues are discovered:

1. **Immediate**: Disable affected functionality
2. **Assessment**: Evaluate scope and impact
3. **Mitigation**: Apply security patches
4. **Monitoring**: Increase security monitoring
5. **Review**: Update security policies as needed

## References

- [OWASP CSP Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Content_Security_Policy_Cheat_Sheet.html)
- [MDN Security Headers](https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers#Security)
- [Clerk Security Documentation](https://clerk.com/docs/security)
- [Next.js Security Headers](https://nextjs.org/docs/advanced-features/security-headers)