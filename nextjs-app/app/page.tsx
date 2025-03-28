import { redirect } from "next/navigation";
import { currentUser } from "@clerk/nextjs";

export default async function Home() {
  // Check if user is authenticated
  const user = await currentUser();
  
  // If user is authenticated, redirect to dashboard
  if (user) {
    redirect("/dashboard");
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-8">
      <h1 className="text-3xl font-bold mb-6">Welcome to Memoria</h1>
      <p className="text-center max-w-md mb-8">
        Transform your learning materials into effective spaced repetition flashcards using AI.
      </p>
      <div className="flex gap-4">
        <a 
          href="/sign-in" 
          className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90"
        >
          Sign In
        </a>
        <a 
          href="/sign-up" 
          className="px-4 py-2 bg-secondary text-secondary-foreground rounded-md hover:bg-secondary/90"
        >
          Sign Up
        </a>
      </div>
    </div>
  );
}
