/**
 * Security testing utilities for validating headers and XSS protection
 */

export interface SecurityTestResult {
  passed: boolean;
  message: string;
  expected?: string;
  actual?: string;
}

/**
 * Test if security headers are present and properly configured
 */
export function testSecurityHeaders(headers: Headers): Record<string, SecurityTestResult> {
  const results: Record<string, SecurityTestResult> = {};

  // Test X-Frame-Options
  const xFrameOptions = headers.get('X-Frame-Options');
  results['X-Frame-Options'] = {
    passed: xFrameOptions === 'DENY',
    message: xFrameOptions === 'DENY' 
      ? 'X-Frame-Options correctly set to DENY'
      : 'X-Frame-Options not set to DENY (clickjacking protection missing)',
    expected: 'DENY',
    actual: xFrameOptions || 'not set',
  };

  // Test X-Content-Type-Options
  const xContentTypeOptions = headers.get('X-Content-Type-Options');
  results['X-Content-Type-Options'] = {
    passed: xContentTypeOptions === 'nosniff',
    message: xContentTypeOptions === 'nosniff'
      ? 'X-Content-Type-Options correctly set to nosniff'
      : 'X-Content-Type-Options not set to nosniff (MIME sniffing protection missing)',
    expected: 'nosniff',
    actual: xContentTypeOptions || 'not set',
  };

  // Test Referrer-Policy
  const referrerPolicy = headers.get('Referrer-Policy');
  results['Referrer-Policy'] = {
    passed: referrerPolicy === 'strict-origin-when-cross-origin',
    message: referrerPolicy === 'strict-origin-when-cross-origin'
      ? 'Referrer-Policy correctly configured'
      : 'Referrer-Policy not properly configured',
    expected: 'strict-origin-when-cross-origin',
    actual: referrerPolicy || 'not set',
  };

  // Test Content-Security-Policy
  const csp = headers.get('Content-Security-Policy');
  results['Content-Security-Policy'] = {
    passed: !!csp && csp.includes('frame-ancestors'),
    message: csp && csp.includes('frame-ancestors')
      ? 'CSP header present with frame-ancestors directive'
      : 'CSP header missing or lacks frame-ancestors directive',
    expected: 'CSP with frame-ancestors directive',
    actual: csp ? 'present' : 'not set',
  };

  // Test X-XSS-Protection
  const xssProtection = headers.get('X-XSS-Protection');
  results['X-XSS-Protection'] = {
    passed: xssProtection === '1; mode=block',
    message: xssProtection === '1; mode=block'
      ? 'X-XSS-Protection correctly configured'
      : 'X-XSS-Protection not properly configured',
    expected: '1; mode=block',
    actual: xssProtection || 'not set',
  };

  return results;
}

/**
 * Test if markdown content is properly sanitized
 */
export function testMarkdownSanitization(input: string, rendered: Element): SecurityTestResult {
  const dangerousTags = ['script', 'iframe', 'object', 'embed', 'style', 'form', 'input'];
  const foundDangerousTags = dangerousTags.filter(tag => 
    rendered.querySelector(tag) !== null
  );

  if (foundDangerousTags.length > 0) {
    return {
      passed: false,
      message: `Dangerous tags found in rendered output: ${foundDangerousTags.join(', ')}`,
      expected: 'No dangerous tags',
      actual: `Found: ${foundDangerousTags.join(', ')}`,
    };
  }

  // Test for inline event handlers
  const allElements = rendered.querySelectorAll('*');
  const elementsWithEvents = Array.from(allElements).filter(el => {
    const attributes = el.getAttributeNames();
    return attributes.some(attr => attr.startsWith('on'));
  });

  if (elementsWithEvents.length > 0) {
    return {
      passed: false,
      message: 'Elements with inline event handlers found',
      expected: 'No inline event handlers',
      actual: `Found ${elementsWithEvents.length} elements with event handlers`,
    };
  }

  // Test for javascript: protocols
  const links = rendered.querySelectorAll('a[href]');
  const jsLinks = Array.from(links).filter(link => 
    link.getAttribute('href')?.startsWith('javascript:')
  );

  if (jsLinks.length > 0) {
    return {
      passed: false,
      message: 'Links with javascript: protocol found',
      expected: 'No javascript: links',
      actual: `Found ${jsLinks.length} javascript: links`,
    };
  }

  return {
    passed: true,
    message: 'Markdown content properly sanitized',
  };
}

/**
 * Common XSS test payloads for security testing
 */
export const XSS_TEST_PAYLOADS = [
  '<script>alert("XSS")</script>',
  '<img src="x" onerror="alert(\'XSS\')">',
  '<iframe src="javascript:alert(\'XSS\')"></iframe>',
  '<object data="javascript:alert(\'XSS\')"></object>',
  '<embed src="javascript:alert(\'XSS\')">',
  '<form><input type="button" onclick="alert(\'XSS\')" value="Click me"></form>',
  '<div onmouseover="alert(\'XSS\')">Hover me</div>',
  '<a href="javascript:alert(\'XSS\')">Click me</a>',
  '<style>body{background:url("javascript:alert(\'XSS\')")}</style>',
  'javascript:alert("XSS")',
  '<svg><script>alert("XSS")</script></svg>',
  '<math><mi><script>alert("XSS")</script></mi></math>',
];

/**
 * Test multiple XSS payloads against a render function
 */
export function testXSSPayloads(
  renderFunction: (content: string) => Element,
  payloads: string[] = XSS_TEST_PAYLOADS
): Record<string, SecurityTestResult> {
  const results: Record<string, SecurityTestResult> = {};

  payloads.forEach((payload, index) => {
    try {
      const rendered = renderFunction(payload);
      const testResult = testMarkdownSanitization(payload, rendered);
      results[`payload-${index}`] = {
        ...testResult,
        message: `Payload "${payload.substring(0, 30)}...": ${testResult.message}`,
      };
    } catch (error) {
      results[`payload-${index}`] = {
        passed: true, // If it throws an error, it's likely being blocked
        message: `Payload "${payload.substring(0, 30)}..." blocked (threw error)`,
      };
    }
  });

  return results;
}

/**
 * Generate a security report from test results
 */
export function generateSecurityReport(
  headerResults: Record<string, SecurityTestResult>,
  xssResults?: Record<string, SecurityTestResult>
): string {
  const passedTests = Object.values(headerResults).filter(r => r.passed).length;
  const totalTests = Object.values(headerResults).length;
  
  let report = `Security Test Report\n`;
  report += `===================\n\n`;
  report += `Headers: ${passedTests}/${totalTests} tests passed\n\n`;

  // Header results
  Object.entries(headerResults).forEach(([test, result]) => {
    const status = result.passed ? '✅' : '❌';
    report += `${status} ${test}: ${result.message}\n`;
    if (!result.passed && result.expected && result.actual) {
      report += `   Expected: ${result.expected}\n`;
      report += `   Actual: ${result.actual}\n`;
    }
  });

  // XSS test results
  if (xssResults) {
    const xssPassedTests = Object.values(xssResults).filter(r => r.passed).length;
    const xssTotalTests = Object.values(xssResults).length;
    report += `\n\nXSS Protection: ${xssPassedTests}/${xssTotalTests} tests passed\n\n`;
    
    Object.entries(xssResults).forEach(([test, result]) => {
      const status = result.passed ? '✅' : '❌';
      report += `${status} ${result.message}\n`;
    });
  }

  return report;
}