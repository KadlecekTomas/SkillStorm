"use client";

import { useState } from "react";
import { Card, CardHeader, CardContent, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import type { TestSummary } from "@/types";
import type { TestAssignmentSummary } from "@/hooks/use-test-assignments";
import { motion } from "framer-motion";
import { ArrowRight, Pencil, Send, Users, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { fetchWithAuth } from "@/lib/http/client";
import { formatPercent, formatInt } from "@/utils/format";
import { gradeLabel, normalizeAllowedGrades } from "@/lib/grades";

type TestCardProps = {
  test: TestSummary;
  assignmentSummary?: TestAssignmentSummary | null;
  onView?: (testId: string) => void;
  onAssign?: (testId: string) => void;
  onStatusChange?: () => void;
};

const statusLabel: Record<string, string> = {
  DRAFT: "Koncept",
  PUBLISHED: "Publikováno",
  ARCHIVED: "Archivováno",
};

function assignmentBadgeText(summary: TestAssignmentSummary | null | undefined): string {
  if (!summary || summary.count === 0) return "Nepřiřazen";
  if (summary.count === 1) {
    const label = summary.singleClassLabel ?? "1 třída";
    return summary.activeCount > 0 ? `Zadán: ${label} (aktivní)` : `Zadán: ${label}`;
  }
  return summary.activeCount > 0 ? `Zadán ${summary.count} třídám (aktivní)` : `Zadán ${summary.count} třídám`;
}

export const TestCard = ({ test, assignmentSummary, onView, onAssign, onStatusChange }: TestCardProps): React.JSX.Element => {
  const router = useRouter();
  const [publishLoading, setPublishLoading] = useState(false);

  const handleView = (): void => {
    if (onView) {
      onView(test.id);
      return;
    }
    router.push(`/app/tests/${test.id}`);
  };

  const handleEdit = () => handleView();

  const handlePublishUnpublish = async () => {
    const next = test.status === "PUBLISHED" ? "DRAFT" : "PUBLISHED";
    setPublishLoading(true);
    try {
      await fetchWithAuth("PATCH", `/tests/${test.id}`, { body: { status: next } });
      onStatusChange?.();
    } finally {
      setPublishLoading(false);
    }
  };

  const handleAssign = () => {
    if (onAssign) {
      onAssign(test.id);
    } else {
      router.push(`/app/tests/${test.id}/assign`);
    }
  };

  return (
    <motion.div whileHover={{ y: -4 }}>
      <Card>
        <CardHeader className="mb-0">
          <div className="space-y-1">
            <CardTitle>{test.title}</CardTitle>
            <p className="text-sm text-slate-500">
              {typeof test.subject === "string"
                ? test.subject
                : test.subject != null && typeof test.subject === "object" && "name" in test.subject
                  ? test.subject.name
                  : "General subject"}
            </p>
            <Badge variant="neutral" className="w-fit capitalize">
              {statusLabel[test.status] ?? test.status.toLowerCase()}
            </Badge>
            <Badge variant="outline" className="w-fit text-slate-600">
              {assignmentBadgeText(assignmentSummary)}
            </Badge>
            <div className="flex flex-wrap gap-1">
              {normalizeAllowedGrades(test.allowedGrades).map((grade) => (
                <Badge key={grade} variant="outline" className="w-fit text-slate-600">
                  {gradeLabel(grade)}
                </Badge>
              ))}
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" size="sm" onClick={handleEdit} className="gap-1">
              <Pencil className="h-3.5 w-3.5" />
              Upravit
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handlePublishUnpublish}
              disabled={publishLoading}
              className="gap-1"
            >
              {publishLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
              {test.status === "PUBLISHED" ? "Zrušit publikaci" : "Publikovat"}
            </Button>
            <Button variant="outline" size="sm" onClick={handleAssign} className="gap-1">
              <Users className="h-3.5 w-3.5" />
              Přiřadit třídě
            </Button>
            <Button variant="outline" size="sm" onClick={handleView}>
              Detail
              <ArrowRight className="h-4 w-4" />
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm text-slate-500">
              <span>Completion rate</span>
              <span className="font-semibold text-slate-900">
                {formatPercent(test.completionRate)}
              </span>
            </div>
            <Progress value={test.completionRate ?? 0} />
          </div>
          <div className="mt-4 grid grid-cols-2 gap-4 text-sm">
            <div className="rounded-2xl bg-slate-50 p-3">
              <p className="text-xs text-slate-500">Avg Score</p>
              <p className="text-lg font-semibold text-slate-900">
                {formatPercent(test.avgScore)}
              </p>
            </div>
            <div className="rounded-2xl bg-slate-50 p-3">
              <p className="text-xs text-slate-500">Submissions</p>
              <p className="text-lg font-semibold text-slate-900">
                {formatInt(test.submissions)}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
};
