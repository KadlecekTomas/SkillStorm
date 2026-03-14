"use client";

import { useRouter } from "next/navigation";
import { Star, ChevronRight, BookOpen } from "lucide-react";
import type { ClassroomStructure } from "@/hooks/use-classroom-structure";

const gradeLabel = (grade: string) => {
  if (grade.startsWith("GRADE_")) return grade.replace("GRADE_", "");
  if (grade.startsWith("HIGH_SCHOOL_YEAR_")) return `S${grade.replace("HIGH_SCHOOL_YEAR_", "")}`;
  return grade;
};

type Props = {
  structure: ClassroomStructure | null;
};

/**
 * Shows the teacher's assigned classes (static school assignment, not a timetable).
 * Structure is fetched once in TeacherCommandCenter and passed as a prop.
 */
export function MyClasses({ structure }: Props): React.JSX.Element {
  const router = useRouter();

  const myClasses = structure
    ? [
        ...(structure.homeroom ? [{ ...structure.homeroom, isHomeroom: true }] : []),
        ...structure.teachingClasses.map((c) => ({ ...c, isHomeroom: false })),
      ]
    : [];

  return (
    <div className="flex flex-col rounded-xl border border-slate-100 bg-white shadow-sm">
      {/* Section header */}
      <div className="border-b border-slate-100 px-6 py-4">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
          Moje třídy
        </h3>
      </div>

      <div className="flex-1 p-3">
        {myClasses.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-10 text-center">
            <BookOpen className="h-8 w-8 text-slate-200" />
            <p className="text-sm text-slate-400">Nemáte přiřazené žádné třídy.</p>
          </div>
        ) : (
          <ul>
            {myClasses.map((cls) => {
              const label = cls.label ?? `${gradeLabel(cls.grade)}.${cls.section}`;
              const count = cls.studentCount ?? 0;
              const roleLabel = cls.isHomeroom ? "třídní" : "výuka";
              return (
                <li key={cls.id}>
                  <button
                    type="button"
                    className="flex w-full items-center justify-between gap-3 rounded-md px-3 py-3 text-left hover:bg-gray-50"
                    onClick={() => router.push(`/app/classrooms?highlight=${cls.id}`)}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      {cls.isHomeroom ? (
                        <Star className="h-3.5 w-3.5 shrink-0 text-amber-400" />
                      ) : (
                        <span className="h-3.5 w-3.5 shrink-0" />
                      )}
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-slate-900">{label}</p>
                        <p className="text-xs text-slate-400">
                          {roleLabel} · {count} žáků
                        </p>
                      </div>
                    </div>
                    <ChevronRight className="h-4 w-4 shrink-0 text-slate-300" />
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
