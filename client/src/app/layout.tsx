import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Suspense } from "react";
import { AppErrorBoundary } from "@/components/layout/app-error-boundary";
import { LoadingSpinner } from "@/components/ui/loading-spinner";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
});

export const metadata: Metadata = {
  title: "SkillStorm · EduTo Platform",
  description:
    "Modular learning experience platform for teachers and students built with Next.js 14.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${inter.variable} bg-secondary text-slate-900`}>
        <AppErrorBoundary>
          <Suspense fallback={<LoadingSpinner fullScreen />}>
            {children}
          </Suspense>
        </AppErrorBoundary>
      </body>
    </html>
  );
}
