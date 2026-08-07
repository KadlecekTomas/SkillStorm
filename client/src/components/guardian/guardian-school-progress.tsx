"use client";

import { Award, BookOpenCheck, CalendarCheck, Mail, Sparkles } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import type { ChildOverview } from "@/hooks/use-guardian";

const dateFormatter = new Intl.DateTimeFormat("cs-CZ", {
  day: "numeric",
  month: "numeric",
  year: "numeric",
});

function valueOrDash(value: number | null, suffix = ""): string {
  return value === null ? "—" : `${value}${suffix}`;
}

export function GuardianSchoolProgress({
  data,
}: {
  data: ChildOverview;
}): React.JSX.Element {
  const progress = data.schoolProgress;

  return (
    <>
      <Card>
        <CardContent className="space-y-4 p-5">
          <div>
            <p className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-accent-deep">
              <Sparkles className="h-3.5 w-3.5" /> Přehled ze školy
            </p>
            <h2 className="mt-1 text-base font-extrabold text-ink">
              Jak se dítěti průběžně daří
            </h2>
          </div>

          {progress ? (
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-xl border border-line bg-canvas-alt p-4">
                <div className="flex items-center gap-2 text-ink-muted">
                  <BookOpenCheck className="h-4 w-4" />
                  <span className="text-sm font-bold">Průměrná známka</span>
                </div>
                <p className="mt-2 text-2xl font-black text-ink">
                  {progress.averageGrade?.toFixed(2) ?? "—"}
                </p>
              </div>
              <div className="rounded-xl border border-line bg-canvas-alt p-4">
                <div className="flex items-center gap-2 text-ink-muted">
                  <Award className="h-4 w-4" />
                  <span className="text-sm font-bold">Kompetence</span>
                </div>
                <p className="mt-2 text-2xl font-black text-ink">
                  {valueOrDash(progress.competencyMasteryPercent, " %")}
                </p>
              </div>
              <div className="rounded-xl border border-line bg-canvas-alt p-4">
                <div className="flex items-center gap-2 text-ink-muted">
                  <CalendarCheck className="h-4 w-4" />
                  <span className="text-sm font-bold">Docházka</span>
                </div>
                <p className="mt-2 text-2xl font-black text-ink">
                  {valueOrDash(progress.attendanceRate, " %")}
                </p>
              </div>
            </div>
          ) : (
            <p className="text-[15px] text-ink-muted">
              Škola zatím nezapsala průběžné hodnocení.
            </p>
          )}

          {progress && progress.competencyMap.length > 0 && (
            <div className="space-y-2">
              <h3 className="text-sm font-extrabold text-ink">Co už se daří</h3>
              {progress.competencyMap.slice(0, 6).map((item) => {
                const denominator = Math.max(1, item.scaleMax - item.scaleMin);
                const percent = Math.max(
                  0,
                  Math.min(100, ((item.level - item.scaleMin) / denominator) * 100),
                );
                return (
                  <div key={item.id} className="rounded-xl border border-line p-3">
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate text-[15px] font-bold text-ink">{item.name}</p>
                        {item.subjectName && (
                          <p className="text-xs text-ink-muted">{item.subjectName}</p>
                        )}
                      </div>
                      <span className="shrink-0 text-sm font-black text-accent-deep">
                        {item.level}/{item.scaleMax}
                      </span>
                    </div>
                    <div
                      className="mt-2 h-2 overflow-hidden rounded-full bg-canvas-alt"
                      role="progressbar"
                      aria-valuemin={item.scaleMin}
                      aria-valuemax={item.scaleMax}
                      aria-valuenow={item.level}
                      aria-label={`${item.name}: úroveň ${item.level} z ${item.scaleMax}`}
                    >
                      <div
                        className="h-full rounded-full bg-accent"
                        style={{ width: `${Math.max(4, percent)}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="space-y-3 p-5">
          <h2 className="flex items-center gap-2 text-base font-extrabold text-ink">
            <Mail className="h-4.5 w-4.5 text-ink-dim" /> Zprávy ze školy
          </h2>
          {data.messages.length === 0 ? (
            <p className="py-2 text-[15px] text-ink-muted">
              Zatím žádné nové poznámky ani pochvaly.
            </p>
          ) : (
            <ul className="divide-y divide-line">
              {data.messages.slice(0, 8).map((message) => (
                <li key={message.id} className="space-y-1 py-3">
                  <div className="flex items-start justify-between gap-3">
                    <p className="font-bold text-ink">
                      {message.kind === "PRAISE" ? "🌟 " : ""}
                      {message.title}
                    </p>
                    <time className="shrink-0 text-xs text-ink-dim">
                      {dateFormatter.format(new Date(message.occurredAt))}
                    </time>
                  </div>
                  {message.body && (
                    <p className="text-[15px] leading-relaxed text-ink-muted">
                      {message.body}
                    </p>
                  )}
                  {message.authorName && (
                    <p className="text-xs font-semibold text-ink-dim">
                      {message.authorName}
                    </p>
                  )}
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </>
  );
}
