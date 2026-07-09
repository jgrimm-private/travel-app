import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { cookies } from "next/headers";
import Link from "next/link";
import LogoutButton from "@/components/LogoutButton";
import { authEnabled, SESSION_COOKIE, verifySessionToken } from "@/lib/auth";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Misty and Jon's Adventures!",
  description: "Track your travels — dates, places, and the photos that go with them.",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const authed =
    !authEnabled() ||
    (await verifySessionToken((await cookies()).get(SESSION_COOKIE)?.value));
  const showLogout = authEnabled() && authed;

  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="app-backdrop min-h-full flex flex-col text-zinc-900 dark:text-zinc-100">
        <header className="border-b border-zinc-900/5 dark:border-white/10 bg-white/70 dark:bg-zinc-950/60 backdrop-blur-md sticky top-0 z-10">
          <div className="mx-auto max-w-5xl px-4 py-3 flex items-center justify-between">
            <Link href="/" className="group flex items-center gap-2.5 font-semibold text-lg tracking-tight">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-amber-400 via-rose-500 to-violet-500 text-base shadow-md shadow-rose-500/20 group-hover:scale-105 transition-transform">
                ✈️
              </span>
              <span>Adventures</span>
            </Link>
            {authed && (
              <div className="flex items-center gap-2">
                <Link
                  href="/settings"
                  className="rounded-lg px-3 py-1.5 text-sm text-zinc-500 hover:text-zinc-900 hover:bg-zinc-900/5 dark:text-zinc-400 dark:hover:text-zinc-100 dark:hover:bg-white/10 transition-colors"
                >
                  ⚙️ Settings
                </Link>
                <Link
                  href="/trips/new"
                  className="rounded-lg bg-gradient-to-r from-amber-500 via-rose-500 to-violet-500 text-white px-3.5 py-1.5 text-sm font-medium shadow-sm shadow-rose-500/30 hover:shadow-md hover:shadow-rose-500/40 hover:brightness-105 transition-all"
                >
                  + Add trip
                </Link>
                {showLogout && <LogoutButton />}
              </div>
            )}
          </div>
        </header>
        <main className="mx-auto w-full max-w-5xl px-4 py-10 flex-1">{children}</main>
      </body>
    </html>
  );
}
