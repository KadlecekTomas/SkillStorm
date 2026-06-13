import type { Metadata } from "next";
import "./globals.css";
import { Suspense } from "react";
import { AppErrorBoundary } from "@/components/layout/app-error-boundary";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";

export const metadata: Metadata = {
  title: "SkillStorm Platform",
  description:
    "Modular learning experience platform for teachers and students built with Next.js 14.",
};

const shouldLoadMsw =
  process.env.NODE_ENV !== "production" ||
  process.env.NEXT_PUBLIC_ENABLE_MSW === "true";

async function getMswLoader(): Promise<React.ComponentType | null> {
  if (!shouldLoadMsw) {
    return null;
  }

  const { MswLoader } = await import("@/components/dev/msw-loader");
  return MswLoader;
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>): Promise<React.JSX.Element> {
  const MswLoader = await getMswLoader();

  return (
    <html lang="en">
      <body className="bg-secondary text-slate-900">
        <AppErrorBoundary>
          <TooltipProvider>
            {MswLoader ? <MswLoader /> : null}
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
