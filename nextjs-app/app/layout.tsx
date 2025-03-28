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
              <SiteHeader />
              <main className="flex-1">{children}</main>
            </div>
            <Toaster richColors closeButton position="top-center" />
          </ThemeProvider>
        </ClerkProvider>
      </body>
    </html>
  );
}
