"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { Alert } from "@/components/ui/alert";
import { fetchWithAuth } from "@/lib/http/client";
import { withGuard } from "@/lib/guard/withGuard";
import { PermissionKey } from "@/types";
import { AssignToClassModal } from "@/components/tests/AssignToClassModal";
import { useAcademicYears } from "@/hooks/use-academic-years";

type TestDetail = {
  id: string;
  title: string;
  description?: string | null;
  subject?: { id: string; name: string } | string | null;
  allowedGrades: string[];
  status: "DRAFT" | "PUBLISHED" | "ARCHIVED";
};

function TestDetailPage(): React.JSX.Element {
  const params = useParams<{ testId: string }>();
  const testId = params?.testId ?? null;
  const [test, setTest] = useState<TestDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [assignOpen, setAssignOpen] = useState(false);
  const [publishLoading, setPublishLoading] = useState(false);
  const { selectedYearId } = useAcademicYears();

  const fetchTest = useCallback(async () => {
    if (!testId) return;
    try {
      const data = await fetchWithAuth<TestDetail>("GET", `/tests/${testId}`);
      setTest(data ?? null);
    } catch {
      setTest(null);
    } finally {
      setLoading(false);
    }
  }, [testId]);

  useEffect(() => {
    if (!testId) {
      setLoading(false);
      return;
    }
    fetchTest();
  }, [testId, fetchTest]);

  if (!testId) {
    return (
      <div className="space-y-4">
        <Alert title="Chyba" description="Chybí ID testu." variant="warning" />
        <Link href="/dashboard/tests">
          <Button variant="outline">Zpět na testy</Button>
        </Link>
      </div>
    );
  }

  if (loading) {
    return <LoadingSpinner label="Načítám test" />;
  }

  if (!test) {
    return (
      <div className="space-y-4">
        <Alert title="Test nenalezen" description="Test neexistuje nebo k němu nemáš přístup." variant="warning" />
        <Link href="/dashboard/tests">
          <Button variant="outline">Zpět na testy</Button>
        </Link>
      </div>
    );
  }

  const isPublished = test.status === "PUBLISHED";
  const subjectName = typeof test.subject === "string" ? test.subject : test.subject?.name;
  const subjectId = typeof test.subject === "string" ? null : test.subject?.id ?? null;

  const handlePrimaryCta = async () => {
    if (isPublished) {
      setAssignOpen(true);
      return;
    }
    setPublishLoading(true);
    try {
      await fetchWithAuth("PATCH", `/tests/${testId}`, { body: { status: "PUBLISHED" } });
      await fetchTest();
      setAssignOpen(true);
    } finally {
      setPublishLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <Link href="/dashboard/tests" className="text-sm text-slate-500 hover:text-slate-700">
          ← Zpět na testy
        </Link>
        <h1 className="mt-2 text-2xl font-semibold text-slate-900">{test.title}</h1>
        {test.description && (
          <p className="mt-1 text-sm text-slate-500">{test.description}</p>
        )}
      </div>

      <Card className="p-6">
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-sm text-slate-600">
            {subjectName ?? "Předmět neuveden"} · {test.status === "DRAFT" ? "Koncept" : test.status === "PUBLISHED" ? "Publikováno" : "Archivováno"}
          </span>
          <div className="ml-auto flex gap-2">
            <Button
              onClick={handlePrimaryCta}
              disabled={publishLoading}
              className="bg-slate-900 hover:bg-slate-800"
            >
              {publishLoading ? "Publikuji…" : isPublished ? "Přiřadit třídě" : "Publikovat a přiřadit"}
            </Button>
          </div>
        </div>
      </Card>

      <AssignToClassModal
        open={assignOpen}
        onOpenChange={setAssignOpen}
        testId={testId}
        subjectId={subjectId}
        allowedGrades={test?.allowedGrades ?? []}
        yearId={selectedYearId}
        onSuccess={fetchTest}
      />
    </div>
  );
}

export default withGuard({
  requirePerms: [PermissionKey.CREATE_TEST, PermissionKey.EDIT_TEST],
})(TestDetailPage);
