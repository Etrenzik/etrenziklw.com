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
  title: "The Spread — CFB Predictor",
  description: "A college football win-probability model and season grid, backed by CFBD data.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-neutral-950 text-neutral-100">
        <header className="border-b border-neutral-800 bg-neutral-950/95 backdrop-blur sticky top-0 z-40">
          <div className="mx-auto max-w-[1600px] px-4 py-3 flex items-center gap-6">
            <span className="font-semibold tracking-tight text-lg">
              The Spread <span className="text-neutral-500 font-normal">CFB</span>
            </span>
            <nav className="flex gap-4 text-sm">
              <Link href="/grid" className="text-neutral-300 hover:text-white transition-colors">
                Season Grid
              </Link>
              <Link href="/dashboard" className="text-neutral-300 hover:text-white transition-colors">
                History &amp; Accuracy
              </Link>
            </nav>
          </div>
        </header>
        <main className="flex-1 flex flex-col">{children}</main>
        <footer className="border-t border-neutral-800 px-4 py-3 text-xs text-neutral-500">
          Model output for personal reference only. Data from CollegeFootballData.com. Not affiliated
          with picks.cbssports.com.
        </footer>
      </body>
    </html>
  );
}
