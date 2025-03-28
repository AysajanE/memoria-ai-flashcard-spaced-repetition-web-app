"use client";

import Link from "next/link";
import { UserButton } from "@clerk/nextjs";
import { usePathname } from "next/navigation";
import { useState, useEffect } from "react";
import { MoonIcon, SunIcon, MenuIcon, XIcon } from "lucide-react";

export function SiteHeader() {
  const pathname = usePathname();
  const [scrolled, setScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [darkMode, setDarkMode] = useState(false);

  useEffect(() => {
    // Check for dark mode preference
    if (typeof window !== 'undefined') {
      setDarkMode(document.documentElement.classList.contains('dark'));
    }

    // Add scroll event listener
    const handleScroll = () => {
      setScrolled(window.scrollY > 10);
    };
    window.addEventListener('scroll', handleScroll);
    
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const toggleDarkMode = () => {
    if (typeof window !== 'undefined') {
      document.documentElement.classList.toggle('dark');
      setDarkMode(!darkMode);
    }
  };

  const isActive = (path: string) => {
    return pathname === path;
  };

  return (
    <header className={`sticky top-0 z-50 w-full transition-all duration-200 ${scrolled ? 'bg-white/95 dark:bg-gray-900/95 shadow-sm backdrop-blur-md' : 'bg-transparent'}`}>
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 items-center justify-between">
          {/* Logo and desktop navigation */}
          <div className="flex items-center">
            <Link href="/" className="flex items-center space-x-2">
              <div className="relative w-8 h-8 overflow-hidden">
                <div className="absolute inset-0 rounded-full bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500"></div>
                <div className="absolute inset-[2px] rounded-full bg-white dark:bg-gray-900 flex items-center justify-center">
                  <span className="text-transparent bg-clip-text bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 font-bold text-lg">M</span>
                </div>
              </div>
              <span className="font-bold text-xl text-gray-900 dark:text-white">Memoria</span>
            </Link>
            <nav className="hidden md:ml-8 md:flex md:items-center md:space-x-4">
              <NavLink href="/dashboard" active={isActive('/dashboard')}>Dashboard</NavLink>
              <NavLink href="/create" active={isActive('/create')}>Create</NavLink>
              <NavLink href="/study" active={isActive('/study')}>Study</NavLink>
              <NavLink href="/progress" active={isActive('/progress')}>Progress</NavLink>
              <NavLink href="/articles" active={isActive('/articles')}>Articles</NavLink>
            </nav>
          </div>

          {/* Right side controls */}
          <div className="flex items-center space-x-4">
            {/* Dark mode toggle */}
            <button 
              onClick={toggleDarkMode}
              className="rounded-full p-2 text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-indigo-500"
              aria-label="Toggle dark mode"
            >
              {darkMode ? (
                <SunIcon className="h-5 w-5" />
              ) : (
                <MoonIcon className="h-5 w-5" />
              )}
            </button>

            {/* User button */}
            <UserButton 
              afterSignOutUrl="/"
              appearance={{
                elements: {
                  avatarBox: "h-8 w-8"
                }
              }}
            />

            {/* Mobile menu button */}
            <button
              type="button"
              className="md:hidden rounded-md p-2 text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-indigo-500"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            >
              <span className="sr-only">Open main menu</span>
              {mobileMenuOpen ? (
                <XIcon className="block h-6 w-6" aria-hidden="true" />
              ) : (
                <MenuIcon className="block h-6 w-6" aria-hidden="true" />
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile menu, show/hide based on menu state */}
      {mobileMenuOpen && (
        <div className="md:hidden">
          <div className="px-2 pt-2 pb-3 space-y-1 sm:px-3 bg-white dark:bg-gray-900 shadow-lg">
            <MobileNavLink href="/dashboard" active={isActive('/dashboard')}>Dashboard</MobileNavLink>
            <MobileNavLink href="/create" active={isActive('/create')}>Create</MobileNavLink>
            <MobileNavLink href="/study" active={isActive('/study')}>Study</MobileNavLink>
            <MobileNavLink href="/progress" active={isActive('/progress')}>Progress</MobileNavLink>
            <MobileNavLink href="/articles" active={isActive('/articles')}>Articles</MobileNavLink>
          </div>
        </div>
      )}
    </header>
  );
}

function NavLink({ href, active, children }: { href: string; active: boolean; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className={`relative px-3 py-2 rounded-md text-sm font-medium transition-colors ${
        active 
          ? 'text-indigo-600 dark:text-indigo-400' 
          : 'text-gray-600 hover:text-indigo-600 dark:text-gray-300 dark:hover:text-indigo-400'
      }`}
    >
      {children}
      {active && (
        <span className="absolute bottom-0 left-0 h-0.5 w-full bg-indigo-600 dark:bg-indigo-400"></span>
      )}
    </Link>
  );
}

function MobileNavLink({ href, active, children }: { href: string; active: boolean; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className={`block px-3 py-2 rounded-md text-base font-medium ${
        active 
          ? 'bg-gradient-to-r from-indigo-50 to-purple-50 dark:from-indigo-900/30 dark:to-purple-900/30 text-indigo-600 dark:text-indigo-400' 
          : 'text-gray-600 hover:bg-gray-50 dark:text-gray-300 dark:hover:bg-gray-800'
      }`}
    >
      {children}
    </Link>
  );
}