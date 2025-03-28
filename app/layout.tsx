import type { Metadata } from "next"
import { Inter } from "next/font/google"
import { ClerkProvider } from "@clerk/nextjs"
import { Toaster } from "sonner"
import { ThemeProvider } from "@/components/providers/theme-provider"
import { SiteHeader } from "@/components/shared/site-header"
import "./globals.css"

const inter = Inter({
  variable: "--font-sans",
  subsets: ["latin"],
})

export const metadata: Metadata = {
  title: "Memoria - AI-Powered Flashcard Creation",
  description: "Transform your learning materials into effective spaced repetition flashcards using AI.",
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${inter.variable} bg-background min-h-screen antialiased`}>
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
  )
} 