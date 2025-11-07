"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { motion } from "framer-motion";
import { ArrowRight, ShieldCheck, Sparkles } from "lucide-react";

const highlights = [
  {
    title: "Adaptive classrooms",
    description: "Create hybrid cohorts, monitor attendance and share assets.",
  },
  {
    title: "Assessment engine",
    description: "Auto-graded tests with instant analytics and PDF exports.",
  },
  {
    title: "Content lab",
    description: "Reusable lesson blocks curated by the EduTo community.",
  },
];

export default function Home() {
  return (
    <div className="min-h-screen bg-secondary">
      <section className="relative isolate overflow-hidden px-6 py-24 sm:px-12 lg:px-16">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mx-auto max-w-4xl text-center"
        >
          <p className="inline-flex items-center rounded-full border border-emerald-200 bg-white px-4 py-1 text-xs font-semibold uppercase tracking-wide text-emerald-600">
            <ShieldCheck className="mr-1 h-3 w-3" />
            EduTo certified beta
          </p>
          <h1 className="mt-6 text-4xl font-semibold text-slate-900 sm:text-5xl">
            The SkillStorm operating system for modern classrooms.
          </h1>
          <p className="mt-4 text-lg text-slate-600">
            One Next.js 14 dashboard for teachers, students and admins. Manage
            classes, publish interactive tests, and sync learning analytics in
            real time.
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <Button asChild className="rounded-2xl px-6 py-3 text-base">
              <Link href="/login">
                Launch dashboard
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
            <Button
              asChild
              variant="outline"
              className="rounded-2xl px-6 py-3 text-base"
            >
              <Link href="/register">Create organization</Link>
            </Button>
          </div>
        </motion.div>

        <div className="mx-auto mt-16 grid max-w-5xl gap-4 md:grid-cols-3">
          {highlights.map((item) => (
            <motion.div key={item.title} whileHover={{ y: -6 }}>
              <Card className="h-full space-y-3">
                <Sparkles className="h-5 w-5 text-primary" />
                <p className="text-lg font-semibold text-slate-900">
                  {item.title}
                </p>
                <p className="text-sm text-slate-600">{item.description}</p>
              </Card>
            </motion.div>
          ))}
        </div>
      </section>
    </div>
  );
}
