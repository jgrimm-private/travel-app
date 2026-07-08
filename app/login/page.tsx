import LoginForm from "@/components/LoginForm";

export const dynamic = "force-dynamic";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string }>;
}) {
  const { from } = await searchParams;
  return (
    <div className="flex justify-center pt-16">
      <div className="w-full max-w-sm rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-6">
        <p className="text-4xl text-center mb-3">✈️</p>
        <h1 className="text-xl font-semibold text-center mb-1">Welcome back</h1>
        <p className="text-sm text-zinc-500 dark:text-zinc-400 text-center mb-6">
          Enter the password to see your trips.
        </p>
        <LoginForm from={from} />
      </div>
    </div>
  );
}
