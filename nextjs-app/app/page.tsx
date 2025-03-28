import { redirect } from "next/navigation";
import { currentUser } from "@clerk/nextjs";
import Image from "next/image";
import Link from "next/link";

export default async function Home() {
  // Check if user is authenticated
  const user = await currentUser();
  
  // If user is authenticated, redirect to dashboard
  if (user) {
    redirect("/dashboard");
  }

  return (
    <div className="flex flex-col min-h-screen">
      {/* Hero Section */}
      <section className="bg-gradient-to-br from-indigo-50 via-purple-50 to-pink-50 dark:from-indigo-950 dark:via-purple-950 dark:to-pink-950">
        <div className="container flex flex-col-reverse lg:flex-row items-center justify-between py-16 lg:py-24 gap-12">
          <div className="flex flex-col max-w-lg">
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold tracking-tight mb-4 bg-clip-text text-transparent bg-gradient-to-r from-indigo-500 to-purple-600 dark:from-indigo-400 dark:to-purple-400">
              Remember Everything with Memoria
            </h1>
            <p className="text-lg md:text-xl text-gray-700 dark:text-gray-300 mb-8">
              Transform your learning materials into intelligent flashcards using AI-powered spaced repetition.
            </p>
            <div className="flex gap-4">
              <Link 
                href="/sign-in" 
                className="px-6 py-3 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white font-medium rounded-lg transition-all shadow-md hover:shadow-lg"
              >
                Get Started
              </Link>
              <Link 
                href="/articles/what-is-srs" 
                className="px-6 py-3 bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-200 font-medium rounded-lg border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700 transition-all"
              >
                Learn More
              </Link>
            </div>
          </div>
          <div className="relative w-full max-w-lg">
            <div className="absolute top-0 -left-4 w-72 h-72 bg-purple-300 dark:bg-purple-900 rounded-full mix-blend-multiply dark:mix-blend-soft-light filter blur-xl opacity-70 animate-blob"></div>
            <div className="absolute top-0 -right-4 w-72 h-72 bg-indigo-300 dark:bg-indigo-900 rounded-full mix-blend-multiply dark:mix-blend-soft-light filter blur-xl opacity-70 animate-blob animation-delay-2000"></div>
            <div className="absolute -bottom-8 left-20 w-72 h-72 bg-pink-300 dark:bg-pink-900 rounded-full mix-blend-multiply dark:mix-blend-soft-light filter blur-xl opacity-70 animate-blob animation-delay-4000"></div>
            <div className="relative">
              <Image 
                src="/brain-neural.svg" 
                alt="Memoria brain visualization" 
                width={500} 
                height={500}
                className="mx-auto"
                priority
              />
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-16 bg-white dark:bg-gray-900">
        <div className="container">
          <h2 className="text-3xl font-bold text-center mb-12">Learn Smarter, Not Harder</h2>
          <div className="grid md:grid-cols-3 gap-8">
            <div className="bg-gray-50 dark:bg-gray-800 p-6 rounded-xl">
              <div className="w-12 h-12 bg-indigo-100 dark:bg-indigo-900 rounded-lg flex items-center justify-center mb-4">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-indigo-600 dark:text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              </div>
              <h3 className="text-xl font-semibold mb-2">AI-Powered</h3>
              <p className="text-gray-600 dark:text-gray-400">
                Our advanced AI transforms your notes, textbooks, and articles into high-quality flashcards.
              </p>
            </div>
            <div className="bg-gray-50 dark:bg-gray-800 p-6 rounded-xl">
              <div className="w-12 h-12 bg-purple-100 dark:bg-purple-900 rounded-lg flex items-center justify-center mb-4">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-purple-600 dark:text-purple-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <h3 className="text-xl font-semibold mb-2">Spaced Repetition</h3>
              <p className="text-gray-600 dark:text-gray-400">
                Study cards at optimal intervals based on the proven Anki algorithm for maximum retention.
              </p>
            </div>
            <div className="bg-gray-50 dark:bg-gray-800 p-6 rounded-xl">
              <div className="w-12 h-12 bg-pink-100 dark:bg-pink-900 rounded-lg flex items-center justify-center mb-4">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-pink-600 dark:text-pink-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
              </div>
              <h3 className="text-xl font-semibold mb-2">Track Progress</h3>
              <p className="text-gray-600 dark:text-gray-400">
                Monitor your learning journey with detailed analytics and insightful performance metrics.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Testimonial */}
      <section className="py-16 bg-gray-50 dark:bg-gray-800">
        <div className="container max-w-4xl">
          <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-lg p-8 relative">
            <svg className="absolute text-indigo-500 fill-current w-12 h-12 left-8 -top-6" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 125">
              <path d="M30.7 42c0 6.1 12.6 7 12.6 22 0 11-7.9 19.2-18.9 19.2C12.7 83.1 5 72.6 5 61.5c0-19.2 18-44.6 29.2-44.6 2.8 0 7.9 2 7.9 5.4S30.7 31.6 30.7 42zM82.4 42c0 6.1 12.6 7 12.6 22 0 11-7.9 19.2-18.9 19.2-11.8 0-19.5-10.5-19.5-21.6 0-19.2 18-44.6 29.2-44.6 2.8 0 7.9 2 7.9 5.4S82.4 31.6 82.4 42z"/>
            </svg>
            <p className="text-xl text-gray-700 dark:text-gray-300 mb-6 mt-4">
              Memoria has completely transformed how I study for medical school. The AI-generated flashcards capture key concepts perfectly, and the spaced repetition system ensures I retain the information long-term.
            </p>
            <div className="flex items-center">
              <div className="w-12 h-12 bg-gradient-to-br from-purple-400 to-indigo-500 rounded-full flex items-center justify-center text-white font-bold">JS</div>
              <div className="ml-4">
                <h4 className="font-semibold">Jamie S.</h4>
                <p className="text-gray-600 dark:text-gray-400 text-sm">Medical Student</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-16 bg-gradient-to-br from-indigo-600 to-purple-700 text-white">
        <div className="container text-center">
          <h2 className="text-3xl font-bold mb-4">Ready to enhance your learning?</h2>
          <p className="max-w-2xl mx-auto mb-8 text-indigo-100">
            Join thousands of students, professionals, and lifelong learners who have transformed their study habits with Memoria.
          </p>
          <Link 
            href="/sign-up" 
            className="px-8 py-3 bg-white text-indigo-700 font-medium rounded-lg hover:bg-indigo-50 transition-all shadow-md hover:shadow-lg"
          >
            Create Your Account
          </Link>
        </div>
      </section>
    </div>
  );
}