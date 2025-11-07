"use client";

import type { Classroom } from "@/types";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Users2, Mail } from "lucide-react";
import { motion } from "framer-motion";
import { cn } from "@/utils/cn";

type ClassroomListProps = {
  classrooms: Classroom[];
  onCreate?: () => void;
};

const formatGradeLabel = (grade: Classroom["grade"], label?: string | null) => {
  if (label) return label;
  return grade.replace(/_/g, " ").toLowerCase();
};

export const ClassroomList = ({ classrooms, onCreate }: ClassroomListProps) => (
  <div className="space-y-4">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
          Homerooms
        </p>
        <h2 className="text-xl font-semibold text-slate-900">
          Classrooms overview
        </h2>
        <p className="text-sm text-slate-500">
          Monitor teachers, enrollment and last activity per cohort.
        </p>
      </div>
      <Button onClick={onCreate} className="rounded-2xl">
        <Users2 className="h-4 w-4" />
        Create class
      </Button>
    </div>
    <div className="grid gap-4 md:grid-cols-2">
      {classrooms.map((classroom) => (
        <motion.div
          key={classroom.id}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, ease: "easeOut" }}
        >
          <Card className="space-y-4 rounded-2xl border border-slate-100 p-5 shadow-soft">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="space-y-1">
                <p className="text-xs uppercase tracking-wide text-slate-400">
                  {formatGradeLabel(classroom.grade, classroom.gradeLabel)}
                </p>
                <p className="text-lg font-semibold text-slate-900">
                  {classroom.label ?? `${classroom.grade} • ${classroom.section}`}
                </p>
                <p className="text-sm text-slate-500">
                  Section {classroom.section}
                </p>
              </div>
              <Badge variant="neutral">
                {classroom.studentsCount} students
              </Badge>
            </div>
            <div className="rounded-2xl bg-slate-50 p-3 text-sm text-slate-600">
              <p className="font-medium text-slate-900">
                {classroom.teacherName ?? "Teacher pending"}
              </p>
              <p
                className={cn(
                  "flex items-center gap-1 text-xs",
                  classroom.teacherEmail ? "text-slate-500" : "text-amber-600",
                )}
              >
                <Mail className="h-3 w-3" />
                {classroom.teacherEmail ?? "Email not assigned"}
              </p>
            </div>
            <div className="flex items-center justify-between text-xs text-slate-500">
              <span>Updated {classroom.updatedAt ?? "just now"}</span>
              <Button variant="ghost" size="sm" className="rounded-full px-3">
                Manage
              </Button>
            </div>
          </Card>
        </motion.div>
      ))}
    </div>
  </div>
);
