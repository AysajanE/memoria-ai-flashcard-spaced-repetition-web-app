import { getUserStatsAction } from "@/actions/db/users";
import { getDecksAction } from "@/actions/db/decks";
import { auth } from "@clerk/nextjs";
import { Suspense } from "react";
import Link from "next/link";
import { ArrowUpRight, Clock, Plus, BarChart2, BookOpen, Brain } from "lucide-react";

// Placeholder components for mockup
function StatsCard({ title, value, icon, trend = null, color = "indigo" }) {
  const colorStyles = {
    indigo: "bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-950 dark:text-indigo-300 dark:border-indigo-800",
    purple: "bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950 dark:text-purple-300 dark:border-purple-800",
    pink: "bg-pink-50 text-pink-700 border-pink-200 dark:bg-pink-950 dark:text-pink-300 dark:border-pink-800",
    blue: "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950 dark:text-blue-300 dark:border-blue-800",
  };

  return (
    <div className="rounded-xl border p-4 shadow-sm bg-white dark:bg-gray-900 dark:border-gray-800">
      <div className="flex items-center justify-between mb-2">
        <div className={`p-2 rounded-lg ${colorStyles[color]}`}>
          {icon}
        </div>
        {trend && (
          <span className={trend.positive ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"}>
            {trend.positive ? "↑" : "↓"} {trend.value}%
          </span>
        )}
      </div>
      <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400">{title}</h3>
      <p className="text-2xl font-bold mt-1">{value}</p>
    </div>
  );
}

function RecentActivity({hasActivity = false}) {
  if (!hasActivity) {
    return (
      <div className="flex flex-col items-center justify-center p-8 rounded-lg border border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900 text-center">
        <div className="p-3 bg-indigo-100 dark:bg-indigo-900/50 text-indigo-700 dark:text-indigo-300 rounded-full mb-4">
          <BookOpen size={24} />
        </div>
        <h4 className="font-medium text-lg mb-2">No activity yet</h4>
        <p className="text-gray-600 dark:text-gray-400 max-w-md">
          Start creating flashcards and studying to see your activity here. 
          Create your first deck to begin your learning journey!
        </p>
        <Link 
          href="/create" 
          className="mt-4 px-4 py-2 bg-primary hover:bg-primary/90 text-white font-medium rounded-lg transition-all shadow-sm hover:shadow inline-flex items-center"
        >
          <Plus className="mr-2 h-5 w-5" />
          Create Cards
        </Link>
      </div>
    );
  }

  // For users with activity, we'd fetch real activity data here
  // This is just a placeholder for now
  const activities = [];
  
  return (
    <div className="space-y-4">
      {activities.length === 0 ? (
        <div className="flex flex-col items-center justify-center p-8 rounded-lg border border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900 text-center">
          <p className="text-gray-600 dark:text-gray-400">No recent activity</p>
        </div>
      ) : (
        activities.map((activity, i) => (
          <div key={i} className="flex items-start p-4 rounded-lg border border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900">
            {/* Activity content would go here */}
          </div>
        ))
      )}
    </div>
  );
}

function QuickActions() {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
      <Link 
        href="/create" 
        className="flex flex-col items-center justify-center p-6 bg-white dark:bg-gray-900 rounded-xl text-center border border-gray-100 dark:border-gray-800 hover:shadow-sm transition-all group"
      >
        <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center mb-4">
          <Plus className="text-primary h-5 w-5" />
        </div>
        <h3 className="font-medium">Create Cards</h3>
      </Link>
      
      <Link 
        href="/decks" 
        className="flex flex-col items-center justify-center p-6 bg-white dark:bg-gray-900 rounded-xl text-center border border-gray-100 dark:border-gray-800 hover:shadow-sm transition-all group"
      >
        <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center mb-4">
          <BookOpen className="text-primary h-5 w-5" />
        </div>
        <h3 className="font-medium">My Decks</h3>
      </Link>
      
      <Link 
        href="/study" 
        className="flex flex-col items-center justify-center p-6 bg-white dark:bg-gray-900 rounded-xl text-center border border-gray-100 dark:border-gray-800 hover:shadow-sm transition-all group"
      >
        <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center mb-4">
          <Brain className="text-primary h-5 w-5" />
        </div>
        <h3 className="font-medium">Study</h3>
      </Link>
      
      <Link 
        href="/articles" 
        className="flex flex-col items-center justify-center p-6 bg-white dark:bg-gray-900 rounded-xl text-center border border-gray-100 dark:border-gray-800 hover:shadow-sm transition-all group"
      >
        <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center mb-4">
          <ArrowUpRight className="text-primary h-5 w-5" />
        </div>
        <h3 className="font-medium">Articles</h3>
      </Link>
    </div>
  );
}

export default async function DashboardPage() {
  const statsResult = await getUserStatsAction();
  const { userId } = await auth();
  
  // Get actual user decks
  const decksResult = await getDecksAction();
  const totalDecks = decksResult.isSuccess ? decksResult.data?.length || 0 : 0;
  
  // Get actual user stats
  const userStats = {
    cardsReviewed: 0,
    currentStreak: 0,
    totalDecks: totalDecks,
    timeStudied: "0h 0m"
  };
  
  // If we have user stats, use them
  if (statsResult.isSuccess && statsResult.data) {
    userStats.cardsReviewed = statsResult.data.dailyCount;
    userStats.currentStreak = statsResult.data.streak;
  }

  return (
    <div className="container max-w-6xl mx-auto space-y-10 py-10">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-6">
        <div>
          <h1 className="text-3xl font-bold">Welcome back!</h1>
          <p className="text-muted-foreground mt-2">
            Continue your learning journey
          </p>
        </div>
        <Link
          href="/create"
          className="px-5 py-2.5 bg-primary hover:bg-primary/90 text-white font-medium rounded-lg transition-all shadow-sm hover:shadow inline-flex items-center self-start sm:self-center"
        >
          <Plus className="mr-2 h-5 w-5" />
          Create Cards
        </Link>
      </div>

      {/* Stats Overview - Simplified */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
        <StatsCard 
          title="Cards Reviewed" 
          value={userStats.cardsReviewed} 
          color="indigo"
          icon={<BookOpen size={18} />}
        />
        <StatsCard 
          title="Current Streak" 
          value={userStats.currentStreak} 
          color="purple"
          icon={<BarChart2 size={18} />}
        />
        <StatsCard 
          title="Total Decks" 
          value={userStats.totalDecks} 
          color="pink"
          icon={<Plus size={18} />}
        />
        <StatsCard 
          title="Time Studied" 
          value={userStats.timeStudied} 
          color="blue"
          icon={<Clock size={18} />}
        />
      </div>
      
      {/* Quick Actions - Simplified */}
      <section>
        <h2 className="text-xl font-semibold mb-5">Quick Actions</h2>
        <QuickActions />
      </section>

      {/* Recent Activity - Simplified */}
      <section className="pt-4">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-xl font-semibold">Recent Activity</h2>
          {totalDecks > 0 && (
            <Link 
              href="/progress" 
              className="text-sm font-medium text-primary hover:text-primary/80 flex items-center"
            >
              View all
              <ArrowUpRight className="ml-1 h-4 w-4" />
            </Link>
          )}
        </div>
        <RecentActivity hasActivity={totalDecks > 0} />
      </section>
    </div>
  );
}