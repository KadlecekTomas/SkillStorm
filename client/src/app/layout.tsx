import type { Metadata } from "next";
import "./globals.css";
import { Suspense } from "react";
import { AppErrorBoundary } from "@/components/layout/app-error-boundary";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import { MswLoader } from "@/components/dev/msw-loader";

export const metadata: Metadata = {
  title: "SkillStorm Platform",
  description:
    "Modular learning experience platform for teachers and students built with Next.js 14.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>): React.JSX.Element {
  return (
    <html lang="en">
      <body className="bg-secondary text-slate-900">
        <AppErrorBoundary>
          <TooltipProvider>
            <MswLoader />
            <Suspense fallback={<LoadingSpinner fullScreen />}>
              {children}
            </Suspense>
          </TooltipProvider>
          <ToastContainer
            position="top-right"
            autoClose={2500}
            hideProgressBar={false}
            newestOnTop
            closeOnClick
            theme="dark"
          />
        </AppErrorBoundary>
      </body>
    </html>
  );
}
