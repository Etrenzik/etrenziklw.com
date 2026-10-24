import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { LeagueNav } from "@/components/nav/LeagueNav";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "The Spread — CFB & NFL Predictor",
  description:
    "College and pro football win-probability models and season grids, backed by CollegeFootballData and nflverse.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-neutral-950 text-neutral-100">
        <header className="border-b border-neutral-800 bg-neutral-950/95 backdrop-blur sticky top-0 z-40">
          <LeagueNav />
        </header>
        <main className="flex-1 flex flex-col">{children}</main>
        <footer className="border-t border-neutral-800 px-4 py-3 text-xs text-neutral-500">
          Model output for personal reference only. College data from
          CollegeFootballData.com; NFL data from nflverse. Not affiliated with
          picks.cbssports.com.
        </footer>
      </body>
    </html>
  );
}
