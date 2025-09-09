"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeSanitize from "rehype-sanitize";
import { cn } from "@/lib/utils";

interface MarkdownRendererProps {
  content: string;
  className?: string;
  /**
   * Allow additional HTML tags and attributes beyond the default safe list.
   * Use with caution and only for trusted content.
   */
  allowDangerousHtml?: boolean;
}

export function MarkdownRenderer({ 
  content, 
  className, 
  allowDangerousHtml = false 
}: MarkdownRendererProps) {
  // Configure rehype plugins for security
  const rehypePlugins = allowDangerousHtml 
    ? [] 
    : [rehypeSanitize];

  return (
    <article className={cn("prose prose-slate dark:prose-invert max-w-none", className)}>
      <ReactMarkdown 
        remarkPlugins={[remarkGfm]}
        rehypePlugins={rehypePlugins}
        components={{
          // Ensure links open in new tab and have security attributes
          a: ({ href, children, ...props }) => (
            <a
              href={href}
              target="_blank"
              rel="noopener noreferrer nofollow"
              {...props}
            >
              {children}
            </a>
          ),
          // Prevent code injection in code blocks
          code: ({ children, ...props }) => (
            <code {...props}>
              {String(children).replace(/\n$/, '')}
            </code>
          ),
        }}
      >
        {content}
      </ReactMarkdown>
    </article>
  );
} 