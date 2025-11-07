"use client";

import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { motion } from "framer-motion";

type StudentProgressProps = {
  items: { id: string; name: string; progress: number; trend: number }[];
};

export const StudentProgress = ({ items }: StudentProgressProps) => (
  <Card>
    <div className="mb-4 flex items-center justify-between">
      <div>
        <p className="text-sm text-slate-500">Student focus</p>
        <p className="text-lg font-semibold text-slate-900">
          Progress overview
        </p>
      </div>
    </div>
    <div className="space-y-4">
      {items.map((student) => (
        <motion.div
          key={student.id}
          initial={{ opacity: 0, x: -10 }}
          animate={{ opacity: 1, x: 0 }}
          className="space-y-2"
        >
          <div className="flex items-center justify-between text-sm">
            <p className="font-medium text-slate-900">{student.name}</p>
            <p
              className={
                student.trend >= 0 ? "text-emerald-600" : "text-red-500"
              }
            >
              {student.trend >= 0 ? "+" : ""}
              {student.trend}%
            </p>
          </div>
          <Progress value={student.progress} />
        </motion.div>
      ))}
    </div>
  </Card>
);
