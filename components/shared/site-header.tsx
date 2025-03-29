"use client"

import Link from "next/link"
import { UserButton } from "@clerk/nextjs"
import { Brain } from "lucide-react"

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/90 backdrop-blur supports-[backdrop-filter]:bg-background/70 shadow-sm">
      <div className="container flex h-16 items-center">
        <div className="mr-4 flex">
          <Link href="/" className="flex items-center space-x-2 hover:opacity-90 transition-opacity">
            <Brain className="h-5 w-5 text-primary" />
            <span className="font-bold text-lg">Memoria</span>
          </Link>
        </div>
        <div className="flex flex-1 items-center justify-end">
          <nav className="flex items-center space-x-8">
            <Link
              href="/dashboard"
              className="text-sm font-medium text-foreground/80 hover:text-primary transition-colors"
            >
              Dashboard
            </Link>
            <Link
              href="/study"
              className="text-sm font-medium text-foreground/80 hover:text-primary transition-colors"
            >
              Study
            </Link>
            <Link
              href="/articles"
              className="text-sm font-medium text-foreground/80 hover:text-primary transition-colors"
            >
              Articles
            </Link>
            <UserButton afterSignOutUrl="/" />
          </nav>
        </div>
      </div>
    </header>
  )
} 