"use client";

import { Sidebar } from "@/components/layout/sidebar";
import { AppHeader } from "@/components/layout/app-header";
import { motion } from "framer-motion";

type MainLayoutProps = {
  children: React.ReactNode;
};

export const MainLayout = ({ children }: MainLayoutProps): React.JSX.Element => (
  <div className="min-h-screen bg-secondary px-4 py-6 sm:px-6 lg:px-8">
    <div className="mx-auto flex max-w-7xl gap-6">
      <Sidebar />
      <motion.main
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex-1 space-y-6"
      >
        <AppHeader />
        <div className="space-y-6">{children}</div>
      </motion.main>
    </div>
  </div>
);
