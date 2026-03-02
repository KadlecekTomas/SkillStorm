"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { PostAuthResolver } from "@/components/auth/PostAuthResolver";

export default function AuthLayout({ children }: { children: ReactNode }): React.JSX.Element {
  return (
    <>
      <PostAuthResolver />
      <div className="grid min-h-screen grid-cols-1 lg:grid-cols-[480px_1fr]">
      <motion.section
        initial={{ opacity: 0, x: -20 }}
        animate={{ opacity: 1, x: 0 }}
        className="flex flex-col gap-8 bg-white px-8 py-10 shadow-2xl lg:px-12"
      >
        <Link href="/" className="text-xl font-semibold text-slate-900">
          SkillStorm
        </Link>
        <div className="my-auto">
          <h2 className="text-3xl font-semibold text-slate-900">
            EduTo access center
          </h2>
          <p className="mt-3 text-slate-500">
            Secure login gateway for teachers, students and administrators.
            Syncs directly with the NestJS backend and Prisma RBAC.
          </p>
          <ul className="mt-6 space-y-3 text-sm text-slate-600">
            <li>• OAuth-ready REST endpoints</li>
            <li>• Audit-friendly activity tracking</li>
            <li>• GDPR-safe consent flow</li>
          </ul>
        </div>
        <div className="flex items-center gap-3 text-sm text-slate-500">
          <Button variant="ghost" asChild className="text-slate-600">
            <Link href="/register">Create or join an organization</Link>
          </Button>
        </div>
      </motion.section>
      <div className="flex items-center justify-center bg-secondary px-6 py-16">
        <div className="w-full max-w-lg space-y-6 rounded-3xl border border-slate-100 bg-white p-8 shadow-2xl">
          {children}
        </div>
      </div>
    </div>
    </>
  );
}
