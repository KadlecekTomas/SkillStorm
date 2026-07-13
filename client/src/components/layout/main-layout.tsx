"use client";

import { Sidebar } from "@/components/layout/sidebar";
import { AppHeader } from "@/components/layout/app-header";
import { BottomTabs } from "@/components/layout/bottom-tabs";
import { motion } from "framer-motion";

type MainLayoutProps = {
  children: React.ReactNode;
};

export const MainLayout = ({ children }: MainLayoutProps): React.JSX.Element => (
  <div className="min-h-screen bg-canvas">
    <div className="mx-auto flex max-w-7xl">
      <Sidebar />
      <motion.main
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="min-w-0 flex-1 space-y-6 px-4 pb-28 pt-6 sm:px-6 md:pb-12 lg:px-8"
      >
        <AppHeader />
        <div className="space-y-6">{children}</div>
      </motion.main>
    </div>
    <BottomTabs />
  </div>
);
