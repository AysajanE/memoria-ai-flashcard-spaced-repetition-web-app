import { SignIn } from "@clerk/nextjs";

export default function SignInPage() {
  return (
    <div className="flex flex-col items-center justify-center space-y-4">
      <h1 className="text-2xl font-semibold">Welcome back</h1>
      <p className="text-muted-foreground">
        Sign in to your account to continue
      </p>
      <SignIn
        appearance={{
          elements: {
            rootBox: "mx-auto",
            card: "shadow-none",
          },
        }}
      />
    </div>
  );
}
