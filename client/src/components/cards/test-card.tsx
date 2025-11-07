"use client";

import { Card, CardHeader, CardContent, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import type { TestSummary } from "@/types";
import { motion } from "framer-motion";
import { ArrowRight } from "lucide-react";

type TestCardProps = {
  test: TestSummary;
  onView?: (testId: string) => void;
};

export const TestCard = ({ test, onView }: TestCardProps) => (
  <motion.div whileHover={{ y: -4 }}>
    <Card>
      <CardHeader className="mb-0">
        <div className="space-y-1">
          <CardTitle>{test.title}</CardTitle>
          <p className="text-sm text-slate-500">
            {test.subject ?? "General subject"}
          </p>
          <Badge variant="neutral" className="capitalize">
            {test.status.toLowerCase()}
          </Badge>
        </div>
        <Button variant="outline" size="sm" onClick={() => onView?.(test.id)}>
          Details
          <ArrowRight className="h-4 w-4" />
        </Button>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm text-slate-500">
            <span>Completion rate</span>
            <span className="font-semibold text-slate-900">
              {Math.round(test.completionRate)}%
            </span>
          </div>
          <Progress value={test.completionRate} />
        </div>
        <div className="mt-4 grid grid-cols-2 gap-4 text-sm">
          <div className="rounded-2xl bg-slate-50 p-3">
            <p className="text-xs text-slate-500">Avg Score</p>
            <p className="text-lg font-semibold text-slate-900">
              {Math.round(test.avgScore)}%
            </p>
          </div>
          <div className="rounded-2xl bg-slate-50 p-3">
            <p className="text-xs text-slate-500">Submissions</p>
            <p className="text-lg font-semibold text-slate-900">
              {test.submissions}
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  </motion.div>
);
