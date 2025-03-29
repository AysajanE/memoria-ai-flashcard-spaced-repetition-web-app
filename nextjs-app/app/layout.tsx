import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { ClerkProvider } from "@clerk/nextjs";
import { Toaster } from "sonner";
import { ThemeProvider } from "@/components/providers/theme-provider";
import { SiteHeader } from "@/components/shared/site-header";
import "./globals.css";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";

// The GeistSans and GeistMono are not functions to be called with options
// They're already font objects with variables
const geistSans = GeistSans;
const geistMono = GeistMono;

export const metadata: Metadata = {
  title: "Memoria - AI-Powered Flashcard Creation",
  description:
    "Transform your learning materials into effective spaced repetition flashcards using AI.",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} bg-background min-h-screen antialiased`}
      >
        <ClerkProvider>
          <ThemeProvider
            attribute="class"
            defaultTheme="system"
            enableSystem
            disableTransitionOnChange
          >
            <div className="relative flex min-h-screen flex-col">
              <a href="#main-content" className="skip-link">
                Skip to main content
              </a>
              <SiteHeader />
              <main id="main-content" className="flex-1 pb-16" tabIndex={-1}>
                {children}
              </main>
              <footer className="py-6 border-t border-border/50">
                <div className="container text-center text-sm text-muted-foreground">
                  <p>Memoria - AI-powered flashcard learning</p>
                </div>
              </footer>
            </div>
            <Toaster richColors closeButton position="top-center" />
          </ThemeProvider>
        </ClerkProvider>
      </body>
    </html>
  );
}
