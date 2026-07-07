import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Link from "next/link";
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
  title: "Trips",
  description: "Track your travels — dates, places, and the photos that go with them.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-zinc-50 text-zinc-900 dark:bg-zinc-950 dark:text-zinc-100">
        <header className="border-b border-zinc-200 dark:border-zinc-800 bg-white/70 dark:bg-zinc-900/70 backdrop-blur sticky top-0 z-10">
          <div className="mx-auto max-w-4xl px-4 py-3 flex items-center justify-between">
            <Link href="/" className="font-semibold text-lg tracking-tight">
              ✈️ Trips
            </Link>
            <div className="flex items-center gap-3">
              <Link
                href="/settings"
                className="text-sm text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors"
              >
                ⚙️ Settings
              </Link>
              <Link
                href="/trips/new"
                className="rounded-lg bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 px-3 py-1.5 text-sm font-medium hover:opacity-85 transition-opacity"
              >
                + Add trip
              </Link>
            </div>
          </div>
        </header>
        <main className="mx-auto w-full max-w-4xl px-4 py-8 flex-1">{children}</main>
      </body>
    </html>
  );
}
