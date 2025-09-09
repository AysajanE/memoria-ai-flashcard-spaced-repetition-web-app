"use client";

import { useState, useEffect } from "react";
import { MarkdownRenderer } from "@/components/shared/markdown-renderer";
import { 
  testSecurityHeaders, 
  testXSSPayloads, 
  generateSecurityReport,
  XSS_TEST_PAYLOADS 
} from "@/src/lib/security-test-utils";

// Only show this page in development
if (process.env.NODE_ENV === "production") {
  throw new Error("Security test page is not available in production");
}

export default function SecurityTestPage() {
  const [securityReport, setSecurityReport] = useState<string>("");
  const [testPayload, setTestPayload] = useState("<script>alert('XSS Test')</script>");
  const [testResults, setTestResults] = useState<string>("");

  useEffect(() => {
    // Test security headers on page load
    const testHeaders = async () => {
      try {
        const response = await fetch(window.location.href);
        const headerResults = testSecurityHeaders(response.headers);
        const report = generateSecurityReport(headerResults);
        setSecurityReport(report);
      } catch (error) {
        setSecurityReport(`Error testing headers: ${error}`);
      }
    };

    testHeaders();
  }, []);

  const runXSSTests = () => {
    const container = document.createElement('div');
    
    const renderFunction = (content: string): Element => {
      container.innerHTML = '';
      // Create a mock MarkdownRenderer element for testing
      const article = document.createElement('article');
      article.innerHTML = content; // This would normally be sanitized by MarkdownRenderer
      container.appendChild(article);
      return container;
    };

    const xssResults = testXSSPayloads(renderFunction, [testPayload]);
    const report = Object.entries(xssResults)
      .map(([test, result]) => `${result.passed ? '✅' : '❌'} ${result.message}`)
      .join('\n');
    
    setTestResults(report);
  };

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 mb-6">
        <div className="flex">
          <div className="ml-3">
            <p className="text-sm text-yellow-700">
              <strong>Development Only:</strong> This page is only available in development mode 
              and provides tools to test security headers and XSS protection.
            </p>
          </div>
        </div>
      </div>

      <h1 className="text-3xl font-bold mb-8">Security Testing Dashboard</h1>

      {/* Security Headers Test */}
      <section className="mb-8">
        <h2 className="text-2xl font-semibold mb-4">Security Headers Test</h2>
        <div className="bg-gray-50 p-4 rounded-lg">
          <pre className="whitespace-pre-wrap text-sm font-mono">
            {securityReport || "Loading security header tests..."}
          </pre>
        </div>
      </section>

      {/* XSS Protection Test */}
      <section className="mb-8">
        <h2 className="text-2xl font-semibold mb-4">XSS Protection Test</h2>
        <div className="space-y-4">
          <div>
            <label htmlFor="xss-payload" className="block text-sm font-medium text-gray-700 mb-2">
              Test Payload:
            </label>
            <textarea
              id="xss-payload"
              value={testPayload}
              onChange={(e) => setTestPayload(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
              rows={4}
              placeholder="Enter XSS payload to test..."
            />
          </div>
          
          <button
            onClick={runXSSTests}
            className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded"
          >
            Test XSS Payload
          </button>

          {testResults && (
            <div className="bg-gray-50 p-4 rounded-lg">
              <h3 className="text-lg font-medium mb-2">Test Results:</h3>
              <pre className="whitespace-pre-wrap text-sm font-mono">
                {testResults}
              </pre>
            </div>
          )}
        </div>
      </section>

      {/* Markdown Renderer Test */}
      <section className="mb-8">
        <h2 className="text-2xl font-semibold mb-4">Markdown Renderer Test</h2>
        <div className="space-y-4">
          <p className="text-sm text-gray-600">
            The content below is rendered using the MarkdownRenderer component with sanitization enabled.
            Any dangerous content should be stripped out.
          </p>
          
          <div className="border border-gray-300 p-4 rounded-lg">
            <h3 className="text-lg font-medium mb-2">Rendered Output:</h3>
            <MarkdownRenderer content={testPayload} />
          </div>
        </div>
      </section>

      {/* Common XSS Payloads Reference */}
      <section className="mb-8">
        <h2 className="text-2xl font-semibold mb-4">Common XSS Test Payloads</h2>
        <div className="bg-gray-50 p-4 rounded-lg">
          <p className="text-sm text-gray-600 mb-2">
            Click on any payload to test it:
          </p>
          <div className="space-y-2">
            {XSS_TEST_PAYLOADS.map((payload, index) => (
              <button
                key={index}
                onClick={() => setTestPayload(payload)}
                className="block w-full text-left px-3 py-2 text-sm bg-white border border-gray-200 rounded hover:bg-gray-100 font-mono"
              >
                {payload}
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* Security Recommendations */}
      <section>
        <h2 className="text-2xl font-semibold mb-4">Security Recommendations</h2>
        <div className="bg-blue-50 p-4 rounded-lg">
          <ul className="list-disc list-inside space-y-2 text-sm">
            <li>All security headers should pass validation</li>
            <li>XSS payloads should be sanitized and not execute</li>
            <li>Links should have proper security attributes (noopener, noreferrer)</li>
            <li>Dangerous HTML tags should be stripped from markdown content</li>
            <li>CSP violations should be logged and monitored</li>
            <li>Regular security audits should be performed</li>
          </ul>
        </div>
      </section>
    </div>
  );
}