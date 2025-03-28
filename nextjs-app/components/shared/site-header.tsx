"use client";

import Link from "next/link";
import { UserButton } from "@clerk/nextjs";

export function SiteHeader() {
  return (
    <header className="bg-background/95 supports-[backdrop-filter]:bg-background/60 sticky top-0 z-50 w-full border-b backdrop-blur">
      <div className="container flex h-14 items-center">
        <div className="mr-4 flex">
          <Link href="/" className="mr-6 flex items-center space-x-2">
            <span className="font-bold">Memoria</span>
          </Link>
          <nav className="flex items-center space-x-4">
            <Link href="/dashboard" className="text-sm font-medium transition-colors hover:text-primary">
              Dashboard
            </Link>
            <Link href="/create" className="text-sm font-medium transition-colors hover:text-primary">
              Create
            </Link>
            <Link href="/progress" className="text-sm font-medium transition-colors hover:text-primary">
              Progress
            </Link>
          </nav>
        </div>
        <div className="flex flex-1 items-center justify-between space-x-2 md:justify-end">
          <div className="w-full flex-1 md:w-auto md:flex-none">
            {/* Search will go here */}
          </div>
          <nav className="flex items-center space-x-2">
            <UserButton afterSignOutUrl="/" />
          </nav>
        </div>
      </div>
    </header>
  );
}
