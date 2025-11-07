"use client";

import { useMemo, useState } from "react";
import { ContentLibraryList } from "@/components/content/content-library-list";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { gradeFilters, subjectFilters } from "@/utils/constants";
import { contentSamples } from "@/utils/sample-data";

export default function LibraryPage() {
  const [grade, setGrade] = useState("All");
  const [subject, setSubject] = useState("All");
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    return contentSamples.filter((item) => {
      const matchGrade = grade === "All" || item.schoolGrade === grade;
      const matchSubject = subject === "All" || item.subject === subject;
      const matchSearch = item.title.toLowerCase().includes(search.toLowerCase());
      return matchGrade && matchSubject && matchSearch;
    });
  }, [grade, subject, search]);

  return (
    <div className="space-y-6">
      <div className="rounded-3xl border border-slate-100 bg-white p-6 shadow-soft">
        <div className="flex flex-wrap items-center gap-4">
          <Input
            placeholder="Search lesson plans..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="max-w-sm"
          />
          <Select value={grade} onValueChange={setGrade}>
            <SelectTrigger className="w-48">
              <SelectValue placeholder="Grade" />
            </SelectTrigger>
            <SelectContent>
              {gradeFilters.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={subject} onValueChange={setSubject}>
            <SelectTrigger className="w-48">
              <SelectValue placeholder="Subject" />
            </SelectTrigger>
            <SelectContent>
              {["All", ...subjectFilters].map((option) => (
                <SelectItem key={option} value={option}>
                  {option}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <ContentLibraryList items={filtered} />
    </div>
  );
}
