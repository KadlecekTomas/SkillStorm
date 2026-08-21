import type { Metadata } from "next";
import { IBM_Plex_Mono, Inter } from "next/font/google";
import "./globals.css";
import { Suspense } from "react";
import { AppErrorBoundary } from "@/components/layout/app-error-boundary";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AppToasts } from "@/components/ui/app-toasts";
import { ServiceWorkerRegistration } from "@/components/pwa/service-worker-registration";
import "react-toastify/dist/ReactToastify.css";
import "@/styles/toasts.css";

const inter = Inter({
  subsets: ["latin", "latin-ext"],
  variable: "--font-inter",
  display: "swap",
});

/** Mono akcent pro terminál/archiv motiv Misí (senior projekce). */
const plexMono = IBM_Plex_Mono({
  subsets: ["latin", "latin-ext"],
  weight: ["400", "600", "700"],
  variable: "--font-plex-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Eduto Platform",
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
    <html lang="cs" className={`${inter.variable} ${plexMono.variable}`}>
      <body className="bg-canvas text-ink">
        <ServiceWorkerRegistration />
        <AppErrorBoundary>
          <TooltipProvider>
            {MswLoader ? <MswLoader /> : null}
            <Suspense fallback={<LoadingSpinner fullScreen />}>
              {children}
            </Suspense>
          </TooltipProvider>
          <AppToasts />
        </AppErrorBoundary>
      </body>
    </html>
  );
}
