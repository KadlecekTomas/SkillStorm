"use client";

import { useEffect, useMemo, useState } from "react";
import {
  ContentLibraryList,
  subjectLabel,
} from "@/components/content/content-library-list";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { formatGradeLong, gradeNumber, isHighSchoolGrade } from "@/lib/class-label";
import type { ContentItem } from "@/types";
import { fetchWithAuth } from "@/lib/http/client";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { useAuth } from "@/hooks/use-auth";
import { withGuard } from "@/lib/guard/withGuard";
import { InfoAlert } from "@/components/ui/alert";
import Link from "next/link";

function LibraryPage(): React.JSX.Element {
  const [grade, setGrade] = useState("All");
  const [subject, setSubject] = useState("All");
  const [search, setSearch] = useState("");
  const [items, setItems] = useState<ContentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const { org, context } = useAuth();

  useEffect(() => {
    let active = true;
    setLoading(true);
    fetchWithAuth<{ items: ContentItem[] }>("GET", "/learning-materials")
      .then((data) => {
        if (!active) return;
        setItems(data?.items ?? []);
      })
      .catch(() => setItems([]))
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [org?.id]);

  // Filtry se skládají z reálně dostupných materiálů — žádný pevný seznam.
  const gradeOptions = useMemo(() => {
    const grades = Array.from(
      new Set(items.map((item) => item.schoolGrade).filter((g): g is string => !!g)),
    );
    grades.sort((a, b) => {
      const highDiff = Number(isHighSchoolGrade(a)) - Number(isHighSchoolGrade(b));
      if (highDiff !== 0) return highDiff;
      return (gradeNumber(a) ?? 0) - (gradeNumber(b) ?? 0);
    });
    return grades;
  }, [items]);
  const subjectOptions = useMemo(
    () =>
      Array.from(
        new Set(
          items
            .map((item) => subjectLabel(item.subject))
            .filter((label): label is string => !!label),
        ),
      ).sort((a, b) => a.localeCompare(b, "cs")),
    [items],
  );

  const filtered = useMemo(() => {
    return items.filter((item) => {
      const matchGrade = grade === "All" || item.schoolGrade === grade;
      const matchSubject =
        subject === "All" || subjectLabel(item.subject) === subject;
      const matchSearch = item.title.toLowerCase().includes(search.toLowerCase());
      return matchGrade && matchSubject && matchSearch;
    });
  }, [grade, subject, search, items]);

  return (
    <div className="space-y-6">
      <div className="rounded-3xl border border-slate-100 bg-white p-6 shadow-soft">
        <div className="flex flex-wrap items-center gap-4">
          <Input
            placeholder="Hledat materiály…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="max-w-sm"
          />
          <Select value={grade} onValueChange={setGrade}>
            <SelectTrigger className="w-48">
              <SelectValue placeholder="Ročník" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="All">Všechny ročníky</SelectItem>
              {gradeOptions.map((option) => (
                <SelectItem key={option} value={option}>
                  {formatGradeLong(option)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={subject} onValueChange={setSubject}>
            <SelectTrigger className="w-48">
              <SelectValue placeholder="Předmět" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="All">Všechny předměty</SelectItem>
              {subjectOptions.map((option) => (
                <SelectItem key={option} value={option}>
                  {option}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
      {context?.mode === "personal" && (
        <InfoAlert
          title="Osobní režim"
          description={
            <span>
              Sdílená školní knihovna se aktivuje po připojení ke škole.{" "}
              <Link className="font-semibold text-emerald-700 underline" href="/app/onboarding">
                Založit nebo se připojit
              </Link>
            </span>
          }
        />
      )}

      {loading ? (
        <LoadingSpinner label="Načítám knihovnu" />
      ) : (
        <>
          <div
            data-testid="library-loaded"
            aria-hidden="true"
            style={{ position: "absolute", width: 0, height: 0, overflow: "hidden" }}
          />
          <ContentLibraryList items={filtered} />
        </>
      )}
    </div>
  );
}

export default withGuard()(LibraryPage);
