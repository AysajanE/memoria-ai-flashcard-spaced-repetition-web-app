import { getUserStatsAction } from "@/actions/tracking";
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

function RecentActivity() {
  // Placeholder data
  const activities = [
    { 
      type: "study_session", 
      deck: "Medical Terminology", 
      cards: 32, 
      time: "2 hours ago",
      performance: 85
    },
    { 
      type: "new_deck", 
      deck: "Organic Chemistry", 
      cards: 45, 
      time: "Yesterday"
    },
    { 
      type: "achievement", 
      name: "7-Day Streak", 
      time: "2 days ago"
    }
  ];

  return (
    <div className="space-y-4">
      {activities.map((activity, i) => (
        <div key={i} className="flex items-start p-4 rounded-lg border border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900">
          <div className="mr-4">
            {activity.type === "study_session" && (
              <div className="p-2 bg-indigo-100 dark:bg-indigo-900/50 text-indigo-700 dark:text-indigo-300 rounded-full">
                <BookOpen size={20} />
              </div>
            )}
            {activity.type === "new_deck" && (
              <div className="p-2 bg-green-100 dark:bg-green-900/50 text-green-700 dark:text-green-300 rounded-full">
                <Plus size={20} />
              </div>
            )}
            {activity.type === "achievement" && (
              <div className="p-2 bg-yellow-100 dark:bg-yellow-900/50 text-yellow-700 dark:text-yellow-300 rounded-full">
                <BarChart2 size={20} />
              </div>
            )}
          </div>
          <div className="flex-1">
            <div className="flex justify-between">
              <h4 className="font-medium">
                {activity.type === "study_session" && "Studied"}
                {activity.type === "new_deck" && "Created deck"}
                {activity.type === "achievement" && "Achievement unlocked"}
              </h4>
              <span className="text-gray-500 dark:text-gray-400 text-sm">{activity.time}</span>
            </div>
            <p className="text-gray-700 dark:text-gray-300 mt-1">
              {activity.type === "study_session" && (
                <>
                  <span className="font-medium">{activity.deck}</span> - Reviewed {activity.cards} cards with {activity.performance}% accuracy
                </>
              )}
              {activity.type === "new_deck" && (
                <>
                  <span className="font-medium">{activity.deck}</span> with {activity.cards} cards
                </>
              )}
              {activity.type === "achievement" && (
                <span className="font-medium">{activity.name}</span>
              )}
            </p>
          </div>
        </div>
      ))}
    </div>
  );
}

function QuickActions() {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      <Link 
        href="/create" 
        className="flex flex-col items-center justify-center p-6 bg-gradient-to-br from-indigo-50 to-purple-50 dark:from-indigo-900/30 dark:to-purple-900/30 rounded-xl text-center border border-indigo-100 dark:border-indigo-800 hover:shadow-md transition-all group"
      >
        <div className="w-12 h-12 rounded-full bg-white dark:bg-gray-800 flex items-center justify-center shadow-sm mb-4 group-hover:scale-110 transition-transform">
          <Plus className="text-indigo-600 dark:text-indigo-400" />
        </div>
        <h3 className="font-semibold mb-1">Create Cards</h3>
        <p className="text-sm text-gray-600 dark:text-gray-400">Generate new flashcards from text</p>
      </Link>
      
      <Link 
        href="/decks" 
        className="flex flex-col items-center justify-center p-6 bg-gradient-to-br from-purple-50 to-pink-50 dark:from-purple-900/30 dark:to-pink-900/30 rounded-xl text-center border border-purple-100 dark:border-purple-800 hover:shadow-md transition-all group"
      >
        <div className="w-12 h-12 rounded-full bg-white dark:bg-gray-800 flex items-center justify-center shadow-sm mb-4 group-hover:scale-110 transition-transform">
          <BookOpen className="text-purple-600 dark:text-purple-400" />
        </div>
        <h3 className="font-semibold mb-1">My Decks</h3>
        <p className="text-sm text-gray-600 dark:text-gray-400">Browse all your flashcard decks</p>
      </Link>
      
      <Link 
        href="/study" 
        className="flex flex-col items-center justify-center p-6 bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-900/30 dark:to-indigo-900/30 rounded-xl text-center border border-blue-100 dark:border-blue-800 hover:shadow-md transition-all group"
      >
        <div className="w-12 h-12 rounded-full bg-white dark:bg-gray-800 flex items-center justify-center shadow-sm mb-4 group-hover:scale-110 transition-transform">
          <Brain className="text-blue-600 dark:text-blue-400" />
        </div>
        <h3 className="font-semibold mb-1">Study Now</h3>
        <p className="text-sm text-gray-600 dark:text-gray-400">Continue where you left off</p>
      </Link>
      
      <Link 
        href="/articles" 
        className="flex flex-col items-center justify-center p-6 bg-gradient-to-br from-pink-50 to-rose-50 dark:from-pink-900/30 dark:to-rose-900/30 rounded-xl text-center border border-pink-100 dark:border-pink-800 hover:shadow-md transition-all group"
      >
        <div className="w-12 h-12 rounded-full bg-white dark:bg-gray-800 flex items-center justify-center shadow-sm mb-4 group-hover:scale-110 transition-transform">
          <ArrowUpRight className="text-pink-600 dark:text-pink-400" />
        </div>
        <h3 className="font-semibold mb-1">Learn More</h3>
        <p className="text-sm text-gray-600 dark:text-gray-400">Read articles about spaced repetition</p>
      </Link>
    </div>
  );
}

export default async function DashboardPage() {
  const statsResult = await getUserStatsAction();
  
  // Placeholder stats data
  const stats = {
    cardsReviewed: 234,
    currentStreak: 7,
    totalDecks: 5,
    timeStudied: "4h 32m"
  };

  return (
    <div className="container space-y-8 py-8">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">Welcome back!</h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            Track your progress and continue your learning journey
          </p>
        </div>
        <Link
          href="/create"
          className="px-4 py-2 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white font-medium rounded-lg transition-all shadow-md hover:shadow-lg inline-flex items-center self-start sm:self-center"
        >
          <Plus className="mr-2 h-5 w-5" />
          Generate Cards
        </Link>
      </div>

      {/* Stats Overview */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatsCard 
          title="Cards Reviewed" 
          value={stats.cardsReviewed} 
          color="indigo"
          icon={<BookOpen size={18} />}
          trend={{ positive: true, value: 12 }}
        />
        <StatsCard 
          title="Current Streak" 
          value={stats.currentStreak} 
          color="purple"
          icon={<BarChart2 size={18} />}
        />
        <StatsCard 
          title="Total Decks" 
          value={stats.totalDecks} 
          color="pink"
          icon={<Plus size={18} />}
        />
        <StatsCard 
          title="Time Studied" 
          value={stats.timeStudied} 
          color="blue"
          icon={<Clock size={18} />}
        />
      </div>
      
      {/* Quick Actions */}
      <section>
        <h2 className="text-xl font-bold mb-4">Quick Actions</h2>
        <QuickActions />
      </section>

      {/* Recent Activity */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold">Recent Activity</h2>
          <Link 
            href="/progress" 
            className="text-sm font-medium text-indigo-600 dark:text-indigo-400 hover:text-indigo-800 dark:hover:text-indigo-300 flex items-center"
          >
            View all
            <ArrowUpRight className="ml-1 h-4 w-4" />
          </Link>
        </div>
        <RecentActivity />
      </section>
    </div>
  );
}