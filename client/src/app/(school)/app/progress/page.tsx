"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  BookOpenCheck,
  Check,
  ClipboardCheck,
  CloudOff,
  Download,
  GraduationCap,
  HeartHandshake,
  Plus,
  RefreshCw,
  School,
  Sparkles,
  UserRound,
  UsersRound,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { usePermissions } from "@/hooks/use-permissions";
import { useAuthStore } from "@/store/use-auth-store";
import { cn } from "@/utils/cn";
import {
  progressApi,
  type AttendanceStatus,
  type CreateProgressEntryInput,
  type ProgressContext,
  type ProgressDashboard,
  type StudentProgressDetail,
} from "@/lib/progress-api";
import {
  buildProgressOfflineScope,
  cacheProgressContext,
  listQueuedProgressEntries,
  queueProgressEntry,
  readCachedProgressContext,
  removeQueuedProgressEntries,
} from "@/lib/progress-offline";
import { downloadProgressDashboardPdf } from "@/lib/reports/progress-dashboard-pdf";

type WorkspaceMode = "ASSESSMENT" | "ATTENDANCE" | "SUPPORT";
type LeadershipView = "DASHBOARD" | "WRITE";

const attendanceOptions: Array<{
  value: AttendanceStatus;
  label: string;
  hint: string;
}> = [
  { value: "PRESENT", label: "Přítomen", hint: "Žák je ve výuce" },
  { value: "ABSENT", label: "Chybí", hint: "Neomluvená / zatím neomluvená absence" },
  { value: "EXCUSED", label: "Omluven", hint: "Omluvená absence" },
  { value: "LATE", label: "Přišel pozdě", hint: "Pozdní příchod" },
];

const dateTime = new Intl.DateTimeFormat("cs-CZ", {
  day: "numeric",
  month: "numeric",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

const isBrowserOnline = (): boolean =>
  typeof navigator === "undefined" ? true : navigator.onLine;

function useOnlineStatus(): boolean {
  const [online, setOnline] = useState(isBrowserOnline);

  useEffect(() => {
    const sync = () => setOnline(navigator.onLine);
    window.addEventListener("online", sync);
    window.addEventListener("offline", sync);
    sync();
    return () => {
      window.removeEventListener("online", sync);
      window.removeEventListener("offline", sync);
    };
  }, []);

  return online;
}

function MetricCard({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint: string;
}) {
  return (
    <Card>
      <CardContent className="p-5">
        <p className="text-sm font-bold text-ink-muted">{label}</p>
        <p className="mt-2 text-3xl font-black tracking-tight text-ink">{value}</p>
        <p className="mt-1 text-sm text-ink-muted">{hint}</p>
      </CardContent>
    </Card>
  );
}

function EmptyValue({ children }: { children: string }) {
  return <span className="text-ink-dim">{children}</span>;
}

function TeacherWorkspace({
  context,
  onContextRefresh,
  largeText,
  offlineScope,
}: {
  context: ProgressContext;
  onContextRefresh: () => Promise<void>;
  largeText: boolean;
  offlineScope: string;
}) {
  const online = useOnlineStatus();
  const [mode, setMode] = useState<WorkspaceMode>("ASSESSMENT");
  const [classId, setClassId] = useState(context.classes[0]?.id ?? "");
  const selectedClass = useMemo(
    () => context.classes.find((item) => item.id === classId) ?? context.classes[0] ?? null,
    [classId, context.classes],
  );
  const [studentId, setStudentId] = useState(selectedClass?.students[0]?.id ?? "");
  const [subjectId, setSubjectId] = useState(context.subjects[0]?.id ?? "");
  const [competencyId, setCompetencyId] = useState("none");
  const [gradeValue, setGradeValue] = useState<number | null>(null);
  const [competencyLevel, setCompetencyLevel] = useState<number | null>(null);
  const [comment, setComment] = useState("");
  const [attendanceStatus, setAttendanceStatus] = useState<AttendanceStatus>("PRESENT");
  const [minutesLate, setMinutesLate] = useState("");
  const [attendanceNote, setAttendanceNote] = useState("");
  const [interventionTitle, setInterventionTitle] = useState("");
  const [interventionNote, setInterventionNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [queuedCount, setQueuedCount] = useState(0);
  const [studentDetail, setStudentDetail] = useState<StudentProgressDetail | null>(null);
  const [detailBusy, setDetailBusy] = useState(false);

  const selectedStudent = selectedClass?.students.find((item) => item.id === studentId) ?? null;
  const selectedCompetency = context.competencies.find((item) => item.id === competencyId) ?? null;
  const competencies = context.competencies.filter(
    (item) => item.subjectId === null || item.subjectId === subjectId,
  );

  useEffect(() => {
    const next = selectedClass?.students[0]?.id ?? "";
    if (!selectedClass?.students.some((item) => item.id === studentId)) setStudentId(next);
  }, [selectedClass, studentId]);

  useEffect(() => {
    if (competencyId !== "none" && !competencies.some((item) => item.id === competencyId)) {
      setCompetencyId("none");
      setCompetencyLevel(null);
    }
  }, [competencies, competencyId]);

  useEffect(() => {
    if (!context.subjects.some((item) => item.id === subjectId)) {
      setSubjectId(context.subjects[0]?.id ?? "");
    }
  }, [context.subjects, subjectId]);

  const loadStudent = useCallback(async () => {
    if (!studentId || !online) {
      setStudentDetail(null);
      return;
    }
    setDetailBusy(true);
    try {
      setStudentDetail(await progressApi.student(studentId));
    } catch {
      setStudentDetail(null);
    } finally {
      setDetailBusy(false);
    }
  }, [online, studentId]);

  useEffect(() => {
    void loadStudent();
  }, [loadStudent]);

  const refreshQueueCount = useCallback(async () => {
    const queue = await listQueuedProgressEntries(offlineScope);
    setQueuedCount(queue.length);
  }, [offlineScope]);

  const flushQueue = useCallback(async () => {
    if (!online) return;
    const queue = await listQueuedProgressEntries(offlineScope);
    if (!queue.length) {
      setQueuedCount(0);
      return;
    }
    try {
      const result = await progressApi.syncEntries(queue);
      const synced = result.results
        .filter((item) => item.status === "SYNCED" && item.clientMutationId)
        .map((item) => item.clientMutationId as string);
      await removeQueuedProgressEntries(offlineScope, synced);
      await refreshQueueCount();
      if (synced.length) {
        setMessage(`${synced.length} offline záznamů bylo synchronizováno.`);
        await loadStudent();
      }
    } catch {
      // Fronta zůstává lokálně. Další pokus proběhne po novém online eventu.
    }
  }, [loadStudent, offlineScope, online, refreshQueueCount]);

  useEffect(() => {
    void refreshQueueCount();
    void flushQueue();
  }, [flushQueue, refreshQueueCount]);

  const resetAssessment = () => {
    setGradeValue(null);
    setCompetencyLevel(null);
    setComment("");
  };

  const saveAssessment = async () => {
    if (!selectedStudent) {
      setError("Nejdříve vyberte žáka.");
      return;
    }
    if (gradeValue === null && competencyLevel === null && !comment.trim()) {
      setError("Zadejte známku, kompetenci nebo komentář.");
      return;
    }
    const input: CreateProgressEntryInput = {
      studentId: selectedStudent.id,
      ...(subjectId ? { subjectId } : {}),
      ...(competencyId !== "none" ? { competencyId } : {}),
      ...(gradeValue !== null ? { gradeValue } : {}),
      ...(competencyLevel !== null ? { competencyLevel } : {}),
      ...(comment.trim() ? { comment: comment.trim() } : {}),
      clientMutationId: crypto.randomUUID(),
      occurredAt: new Date().toISOString(),
    };

    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      if (!online) {
        await queueProgressEntry(offlineScope, input);
        setMessage("Uloženo do tohoto zařízení. Po připojení se záznam automaticky odešle.");
        resetAssessment();
        await refreshQueueCount();
        return;
      }
      await progressApi.createEntry(input);
      setMessage(`Hodnocení pro ${selectedStudent.name} je uložené.`);
      resetAssessment();
      await loadStudent();
    } catch {
      if (!online) {
        await queueProgressEntry(offlineScope, input);
        setMessage("Připojení vypadlo. Záznam je bezpečně ve frontě k odeslání.");
        resetAssessment();
        await refreshQueueCount();
      } else {
        setError("Hodnocení se nepodařilo uložit. Zkontrolujte údaje a zkuste to znovu.");
      }
    } finally {
      setBusy(false);
    }
  };

  const saveAttendance = async () => {
    if (!selectedStudent) {
      setError("Nejdříve vyberte žáka.");
      return;
    }
    if (attendanceStatus === "LATE") {
      const parsedMinutes = Number(minutesLate);
      if (!minutesLate || !Number.isInteger(parsedMinutes) || parsedMinutes < 1 || parsedMinutes > 1440) {
        setError("Zadejte počet minut zpoždění jako celé číslo od 1 do 1440.");
        return;
      }
    }
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      await progressApi.createAttendance({
        studentId: selectedStudent.id,
        ...(subjectId ? { subjectId } : {}),
        status: attendanceStatus,
        ...(attendanceStatus === "LATE" && minutesLate
          ? { minutesLate: Number(minutesLate) }
          : {}),
        ...(attendanceNote.trim() ? { note: attendanceNote.trim() } : {}),
      });
      setMessage(`Docházka pro ${selectedStudent.name} je uložená.`);
      setAttendanceNote("");
      setMinutesLate("");
      await loadStudent();
    } catch {
      setError(
        online
          ? "Docházku se nepodařilo uložit. Zkuste to znovu."
          : "Docházku lze v této verzi uložit po připojení k internetu.",
      );
    } finally {
      setBusy(false);
    }
  };

  const saveIntervention = async () => {
    if (!selectedStudent || !interventionTitle.trim()) {
      setError("Napište stručný název podpůrného opatření.");
      return;
    }
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      await progressApi.createIntervention({
        studentId: selectedStudent.id,
        ...(subjectId ? { subjectId } : {}),
        title: interventionTitle.trim(),
        ...(interventionNote.trim() ? { note: interventionNote.trim() } : {}),
      });
      setMessage(`Podpůrné opatření pro ${selectedStudent.name} je uložené.`);
      setInterventionTitle("");
      setInterventionNote("");
      await loadStudent();
    } catch {
      setError(
        online
          ? "Podpůrné opatření se nepodařilo uložit."
          : "Podpůrné opatření lze v této verzi uložit po připojení k internetu.",
      );
    } finally {
      setBusy(false);
    }
  };

  if (!context.classes.length) {
    return (
      <Card>
        <CardContent className="p-8 text-center">
          <UsersRound className="mx-auto h-10 w-10 text-ink-dim" />
          <h2 className="mt-3 text-xl font-black text-ink">Nemáte přiřazenou třídu</h2>
          <p className="mt-2 text-ink-muted">
            Vedení školy musí nejdříve přiřadit učitele ke třídě v aktuálním školním roce.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-5">
      <Card className="overflow-hidden border-2 border-accent/30">
        <CardHeader className="border-b border-line bg-accent-soft/50">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-sm font-bold uppercase tracking-wide text-accent-deep">Jednoduchý zápis</p>
              <CardTitle className={cn("mt-1 font-black", largeText ? "text-3xl" : "text-2xl")}>
                Co chcete právě udělat?
              </CardTitle>
            </div>
            {queuedCount > 0 && (
              <div className="flex items-center gap-2 rounded-full bg-warning-soft px-4 py-2 text-sm font-bold text-warning-strong">
                <CloudOff className="h-4 w-4" /> {queuedCount} čeká na synchronizaci
              </div>
            )}
          </div>
          <div className="mt-4 grid gap-2 sm:grid-cols-3" role="tablist" aria-label="Typ zápisu">
            {([
              ["ASSESSMENT", "Hodnocení", BookOpenCheck],
              ["ATTENDANCE", "Docházka", ClipboardCheck],
              ["SUPPORT", "Podpora žáka", HeartHandshake],
            ] as const).map(([value, label, Icon]) => (
              <button
                key={value}
                type="button"
                role="tab"
                aria-selected={mode === value}
                onClick={() => {
                  setMode(value);
                  setError(null);
                  setMessage(null);
                }}
                className={cn(
                  "flex min-h-[56px] items-center justify-center gap-2 rounded-xl border-2 px-4 font-extrabold transition",
                  mode === value
                    ? "border-accent bg-canvas text-accent-deep shadow-sm"
                    : "border-transparent bg-canvas-alt text-ink-muted hover:border-line-strong",
                )}
              >
                <Icon className="h-5 w-5" /> {label}
              </button>
            ))}
          </div>
        </CardHeader>

        <CardContent className="space-y-6 p-5 sm:p-7">
          <div className="grid gap-4 md:grid-cols-3">
            <label className="space-y-2">
              <span className="text-base font-extrabold text-ink">1. Třída</span>
              <Select value={selectedClass?.id ?? ""} onValueChange={setClassId}>
                <SelectTrigger className="h-14 text-base" aria-label="Vyberte třídu">
                  <SelectValue placeholder="Vyberte třídu" />
                </SelectTrigger>
                <SelectContent>
                  {context.classes.map((item) => (
                    <SelectItem key={item.id} value={item.id} className="min-h-[48px] text-base">
                      {item.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </label>

            <label className="space-y-2">
              <span className="text-base font-extrabold text-ink">2. Žák</span>
              <Select value={studentId} onValueChange={setStudentId}>
                <SelectTrigger className="h-14 text-base" aria-label="Vyberte žáka">
                  <SelectValue placeholder="Vyberte žáka" />
                </SelectTrigger>
                <SelectContent>
                  {(selectedClass?.students ?? []).map((item) => (
                    <SelectItem key={item.id} value={item.id} className="min-h-[48px] text-base">
                      {item.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </label>

            <label className="space-y-2">
              <span className="text-base font-extrabold text-ink">3. Předmět</span>
              <Select value={subjectId} onValueChange={setSubjectId}>
                <SelectTrigger className="h-14 text-base" aria-label="Vyberte předmět">
                  <SelectValue placeholder="Vyberte předmět" />
                </SelectTrigger>
                <SelectContent>
                  {context.subjects.map((item) => (
                    <SelectItem key={item.id} value={item.id} className="min-h-[48px] text-base">
                      {item.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </label>
          </div>

          {selectedClass && selectedClass.students.length === 0 && (
            <div role="status" className="rounded-xl border border-warning/40 bg-warning-soft p-4 font-semibold text-ink">
              V této třídě zatím nejsou žádní aktivní žáci. Vyberte jinou třídu, nebo požádejte vedení o kontrolu zařazení žáků.
            </div>
          )}

          {mode === "ASSESSMENT" && (
            <div className="space-y-6">
              <section aria-labelledby="grade-heading" className="space-y-3">
                <div>
                  <h2 id="grade-heading" className="text-lg font-black text-ink">Známka</h2>
                  <p className="text-sm text-ink-muted">Nepovinné. Klikněte na jedno velké číslo.</p>
                </div>
                <div className="grid grid-cols-5 gap-2 sm:max-w-xl">
                  {[1, 2, 3, 4, 5].map((grade) => (
                    <button
                      key={grade}
                      type="button"
                      aria-pressed={gradeValue === grade}
                      onClick={() => setGradeValue((current) => (current === grade ? null : grade))}
                      className={cn(
                        "min-h-[64px] rounded-xl border-2 text-2xl font-black transition focus:outline-none focus:ring-4 focus:ring-accent/30",
                        gradeValue === grade
                          ? "border-accent bg-accent text-white"
                          : "border-line bg-canvas hover:border-accent/60",
                      )}
                    >
                      {grade}
                    </button>
                  ))}
                </div>
              </section>

              <section className="grid gap-4 md:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
                <label className="space-y-2">
                  <span className="text-lg font-black text-ink">Kompetence</span>
                  <Select value={competencyId} onValueChange={(value) => {
                    setCompetencyId(value);
                    setCompetencyLevel(null);
                  }}>
                    <SelectTrigger className="h-14 text-base" aria-label="Vyberte kompetenci">
                      <SelectValue placeholder="Bez kompetence" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none" className="min-h-[48px] text-base">Bez kompetence</SelectItem>
                      {competencies.map((item) => (
                        <SelectItem key={item.id} value={item.id} className="min-h-[48px] text-base">
                          {item.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </label>

                <div className="space-y-2">
                  <span className="text-lg font-black text-ink">Úroveň zvládnutí</span>
                  {selectedCompetency ? (
                    <div className="flex flex-wrap gap-2">
                      {Array.from(
                        { length: selectedCompetency.scaleMax - selectedCompetency.scaleMin + 1 },
                        (_, index) => selectedCompetency.scaleMin + index,
                      ).map((level) => (
                        <button
                          key={level}
                          type="button"
                          aria-pressed={competencyLevel === level}
                          onClick={() => setCompetencyLevel(level)}
                          className={cn(
                            "min-h-[56px] min-w-[70px] rounded-xl border-2 px-4 text-lg font-black",
                            competencyLevel === level
                              ? "border-accent bg-accent text-white"
                              : "border-line bg-canvas hover:border-accent/60",
                          )}
                        >
                          {level}/{selectedCompetency.scaleMax}
                        </button>
                      ))}
                    </div>
                  ) : (
                    <div className="flex min-h-[56px] items-center rounded-xl border border-dashed border-line px-4 text-ink-muted">
                      Nejdříve vyberte kompetenci.
                    </div>
                  )}
                </div>
              </section>

              <label className="block space-y-2">
                <span className="text-lg font-black text-ink">Komentář</span>
                <Textarea
                  value={comment}
                  onChange={(event) => setComment(event.target.value)}
                  placeholder="Např. Výborně pracuje samostatně. Ještě procvičit převody jednotek."
                  className="min-h-[140px] text-base leading-relaxed"
                />
              </label>

              <Button
                size="lg"
                className="h-16 w-full text-lg font-black sm:max-w-md"
                disabled={busy || !selectedStudent}
                onClick={() => void saveAssessment()}
              >
                {busy ? <RefreshCw className="mr-2 h-5 w-5 animate-spin" /> : <Check className="mr-2 h-5 w-5" />}
                {busy ? "Ukládám…" : "Uložit hodnocení"}
              </Button>
            </div>
          )}

          {mode === "ATTENDANCE" && (
            <div className="space-y-5">
              {!online && (
                <div role="status" className="flex items-start gap-3 rounded-xl border border-warning/40 bg-warning-soft p-4 font-semibold text-ink">
                  <CloudOff className="mt-0.5 h-5 w-5 shrink-0" />
                  Docházka se ukládá přímo do školního systému a vyžaduje připojení k internetu. Hodnocení můžete dál zapisovat offline.
                </div>
              )}
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                {attendanceOptions.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    aria-pressed={attendanceStatus === option.value}
                    onClick={() => setAttendanceStatus(option.value)}
                    className={cn(
                      "min-h-[88px] rounded-xl border-2 p-4 text-left transition",
                      attendanceStatus === option.value
                        ? "border-accent bg-accent-soft"
                        : "border-line bg-canvas hover:border-accent/60",
                    )}
                  >
                    <span className="block text-lg font-black text-ink">{option.label}</span>
                    <span className="mt-1 block text-sm text-ink-muted">{option.hint}</span>
                  </button>
                ))}
              </div>
              {attendanceStatus === "LATE" && (
                <label className="block max-w-xs space-y-2">
                  <span className="font-extrabold text-ink">Kolik minut?</span>
                  <Input
                    type="number"
                    min={1}
                    max={1440}
                    step={1}
                    inputMode="numeric"
                    value={minutesLate}
                    onChange={(event) => setMinutesLate(event.target.value)}
                    className="h-14 text-lg"
                  />
                </label>
              )}
              <label className="block space-y-2">
                <span className="font-extrabold text-ink">Poznámka (nepovinná)</span>
                <Textarea
                  value={attendanceNote}
                  onChange={(event) => setAttendanceNote(event.target.value)}
                  className="min-h-[110px] text-base"
                />
              </label>
              <Button size="lg" className="h-16 w-full text-lg font-black sm:max-w-md" disabled={busy || !selectedStudent || !online} onClick={() => void saveAttendance()}>
                <Check className="mr-2 h-5 w-5" /> Uložit docházku
              </Button>
            </div>
          )}

          {mode === "SUPPORT" && (
            <div className="space-y-5">
              {!online && (
                <div role="status" className="flex items-start gap-3 rounded-xl border border-warning/40 bg-warning-soft p-4 font-semibold text-ink">
                  <CloudOff className="mt-0.5 h-5 w-5 shrink-0" />
                  Podpůrná opatření vyžadují připojení k internetu. Rozpracovaný text na této obrazovce nemažte, po připojení ho můžete uložit.
                </div>
              )}
              <div className="rounded-xl border border-warning/40 bg-warning-soft p-4 text-sm leading-relaxed text-ink">
                Podpůrné opatření je interní školní záznam. Rodič ho automaticky neuvidí; v rodičovském prostoru se zobrazují jen běžné výsledky a komentáře určené ke sdílení.
              </div>
              <label className="block space-y-2">
                <span className="text-lg font-black text-ink">Co budeme dělat?</span>
                <Input
                  value={interventionTitle}
                  onChange={(event) => setInterventionTitle(event.target.value)}
                  placeholder="Např. Individuálně procvičit vyjmenovaná slova"
                  className="h-14 text-base"
                />
              </label>
              <label className="block space-y-2">
                <span className="font-extrabold text-ink">Poznámka</span>
                <Textarea
                  value={interventionNote}
                  onChange={(event) => setInterventionNote(event.target.value)}
                  placeholder="Co jsme domluvili, kdo pomůže, kdy zkontrolujeme posun…"
                  className="min-h-[140px] text-base"
                />
              </label>
              <Button size="lg" className="h-16 w-full text-lg font-black sm:max-w-md" disabled={busy || !selectedStudent || !interventionTitle.trim() || !online} onClick={() => void saveIntervention()}>
                <HeartHandshake className="mr-2 h-5 w-5" /> Uložit podporu žáka
              </Button>
            </div>
          )}

          {message && (
            <div role="status" className="flex items-start gap-3 rounded-xl border border-success/30 bg-success-soft p-4 font-bold text-success-strong">
              <Check className="mt-0.5 h-5 w-5 shrink-0" /> {message}
            </div>
          )}
          {error && (
            <div role="alert" className="flex items-start gap-3 rounded-xl border border-danger/30 bg-danger-soft p-4 font-bold text-danger">
              <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" /> {error}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-sm font-bold text-ink-muted">Rychlá kontrola</p>
              <CardTitle className="mt-1">{selectedStudent?.name ?? "Žák"}</CardTitle>
            </div>
            <Button variant="outline" onClick={() => void loadStudent()} disabled={detailBusy || !online}>
              <RefreshCw className={cn("mr-2 h-4 w-4", detailBusy && "animate-spin")} /> Aktualizovat
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {!online ? (
            <p className="text-ink-muted">Detail se načte po připojení. Nové hodnocení můžete dál zapisovat offline.</p>
          ) : detailBusy ? (
            <div className="flex justify-center py-8"><LoadingSpinner /></div>
          ) : studentDetail ? (
            <div className="space-y-5">
              <div className="grid gap-3 sm:grid-cols-3">
                <MetricCard label="Průměrná známka" value={studentDetail.summary.averageGrade?.toFixed(2) ?? "—"} hint="z ručních hodnocení" />
                <MetricCard label="Kompetence" value={studentDetail.summary.competencyMasteryPercent !== null ? `${studentDetail.summary.competencyMasteryPercent} %` : "—"} hint="zvládnutí sledovaných dovedností" />
                <MetricCard label="Docházka" value={studentDetail.summary.attendanceRate !== null ? `${studentDetail.summary.attendanceRate} %` : "—"} hint="přítomnost + pozdní příchody" />
              </div>

              {studentDetail.competencyMap.length > 0 && (
                <div>
                  <h3 className="text-lg font-black text-ink">Kompetenční mapa</h3>
                  <div className="mt-3 grid gap-3 sm:grid-cols-2">
                    {studentDetail.competencyMap.map((item) => {
                      const percent = item.scaleMax === item.scaleMin ? 100 : ((item.level - item.scaleMin) / (item.scaleMax - item.scaleMin)) * 100;
                      return (
                        <div key={item.id} className="rounded-xl border border-line p-4">
                          <div className="flex items-center justify-between gap-3">
                            <div>
                              <p className="font-extrabold text-ink">{item.name}</p>
                              <p className="text-sm text-ink-muted">{item.subjectName ?? "Obecná kompetence"}</p>
                            </div>
                            <span className="text-lg font-black text-accent-deep">{item.level}/{item.scaleMax}</span>
                          </div>
                          <div className="mt-3 h-2 overflow-hidden rounded-full bg-canvas-alt" aria-label={`${Math.round(percent)} procent`}>
                            <div className="h-full rounded-full bg-accent" style={{ width: `${Math.max(4, Math.min(100, percent))}%` }} />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              <div>
                <h3 className="text-lg font-black text-ink">Poslední události</h3>
                <ol className="mt-3 space-y-2">
                  {studentDetail.timeline.slice(0, 8).map((item) => (
                    <li key={item.id} className="rounded-xl border border-line p-4">
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <p className="font-extrabold text-ink">{item.title}</p>
                        <time className="text-sm text-ink-dim">{dateTime.format(new Date(item.occurredAt))}</time>
                      </div>
                      {item.detail && <p className="mt-2 leading-relaxed text-ink-muted">{item.detail}</p>}
                    </li>
                  ))}
                  {studentDetail.timeline.length === 0 && <li className="text-ink-muted">Zatím bez záznamů.</li>}
                </ol>
              </div>
            </div>
          ) : (
            <EmptyValue>Zatím nemáme detailní data.</EmptyValue>
          )}
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button variant="ghost" onClick={() => void onContextRefresh()}>
          <RefreshCw className="mr-2 h-4 w-4" /> Obnovit seznam tříd a žáků
        </Button>
      </div>
    </div>
  );
}

function LeadershipDashboard({
  dashboard,
  context,
  onDashboardRefresh,
  onContextRefresh,
}: {
  dashboard: ProgressDashboard;
  context: ProgressContext;
  onDashboardRefresh: () => Promise<void>;
  onContextRefresh: () => Promise<void>;
}) {
  const [creatingCompetency, setCreatingCompetency] = useState(false);
  const [subjectId, setSubjectId] = useState(context.subjects[0]?.id ?? "none");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [error, setError] = useState<string | null>(null);

  const createCompetency = async () => {
    if (!name.trim()) return;
    setCreatingCompetency(true);
    setError(null);
    try {
      await progressApi.createCompetency({
        ...(subjectId !== "none" ? { subjectId } : {}),
        name: name.trim(),
        ...(description.trim() ? { description: description.trim() } : {}),
        scaleMin: 1,
        scaleMax: 4,
      });
      setName("");
      setDescription("");
      await onContextRefresh();
    } catch {
      setError("Kompetenci se nepodařilo vytvořit. Zkontrolujte, zda už neexistuje.");
    } finally {
      setCreatingCompetency(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        <MetricCard label="Žáků" value={String(dashboard.summary.studentCount)} hint="v aktuálním školním roce" />
        <MetricCard label="Průměrná známka" value={dashboard.summary.averageGrade?.toFixed(2) ?? "—"} hint="z ručních hodnocení" />
        <MetricCard label="Kompetence" value={dashboard.summary.averageCompetency?.toFixed(2) ?? "—"} hint="průměrná úroveň" />
        <MetricCard label="Docházka" value={dashboard.summary.attendanceRate !== null ? `${dashboard.summary.attendanceRate} %` : "—"} hint="přítomnost + pozdní příchody" />
        <MetricCard label="Otevřená podpora" value={String(dashboard.summary.openInterventions)} hint="aktivní podpůrná opatření" />
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-sm font-bold text-ink-muted">Od celku k detailu</p>
              <CardTitle className="mt-1">Srovnání tříd</CardTitle>
            </div>
            <div className="flex w-full flex-wrap gap-2 sm:w-auto">
              <Button className="w-full sm:w-auto" variant="outline" onClick={() => downloadProgressDashboardPdf({ dashboard, academicYear: context.academicYear.label })}>
                <Download className="mr-2 h-4 w-4" /> Stáhnout PDF
              </Button>
              <Button className="w-full sm:w-auto" variant="ghost" onClick={() => void onDashboardRefresh()}>
                <RefreshCw className="mr-2 h-4 w-4" /> Obnovit
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 md:hidden" aria-label="Srovnání tříd">
            {dashboard.classes.map((item) => (
              <article key={item.classSectionId} className="rounded-xl border border-line bg-canvas p-4">
                <div className="flex items-center justify-between gap-3">
                  <h3 className="text-lg font-black text-ink">{item.classLabel}</h3>
                  <span className="rounded-full bg-canvas-alt px-3 py-1 text-sm font-bold text-ink-muted">
                    {item.studentCount} žáků
                  </span>
                </div>
                <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
                  <div><dt className="font-bold text-ink-muted">Známka</dt><dd className="mt-1 text-base font-black text-ink">{item.averageGrade?.toFixed(2) ?? "—"}</dd></div>
                  <div><dt className="font-bold text-ink-muted">Kompetence</dt><dd className="mt-1 text-base font-black text-ink">{item.averageCompetency?.toFixed(2) ?? "—"}</dd></div>
                  <div><dt className="font-bold text-ink-muted">Docházka</dt><dd className="mt-1 text-base font-black text-ink">{item.attendanceRate !== null ? `${item.attendanceRate} %` : "—"}</dd></div>
                  <div><dt className="font-bold text-ink-muted">Podpora</dt><dd className="mt-1 text-base font-black text-ink">{item.openInterventions}</dd></div>
                </dl>
              </article>
            ))}
          </div>
          <div className="hidden overflow-x-auto rounded-xl border border-line md:block">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-canvas-alt text-ink-muted">
                <tr>
                  <th className="px-4 py-3 font-extrabold">Třída</th>
                  <th className="px-4 py-3 font-extrabold">Žáků</th>
                  <th className="px-4 py-3 font-extrabold">Známka</th>
                  <th className="px-4 py-3 font-extrabold">Kompetence</th>
                  <th className="px-4 py-3 font-extrabold">Docházka</th>
                  <th className="px-4 py-3 font-extrabold">Podpora</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {dashboard.classes.map((item) => (
                  <tr key={item.classSectionId}>
                    <td className="px-4 py-3 font-extrabold text-ink">{item.classLabel}</td>
                    <td className="px-4 py-3">{item.studentCount}</td>
                    <td className="px-4 py-3">{item.averageGrade?.toFixed(2) ?? "—"}</td>
                    <td className="px-4 py-3">{item.averageCompetency?.toFixed(2) ?? "—"}</td>
                    <td className="px-4 py-3">{item.attendanceRate !== null ? `${item.attendanceRate} %` : "—"}</td>
                    <td className="px-4 py-3">{item.openInterventions}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Sparkles className="h-5 w-5 text-accent-deep" /> Kompetence školy</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-ink-muted">Kompetence se používají v jednoduchém učitelském zápisu. Standardní škála je 1–4.</p>
          <div className="grid gap-3 lg:grid-cols-[220px_minmax(0,1fr)_minmax(0,1.4fr)_auto]">
            <Select value={subjectId} onValueChange={setSubjectId}>
              <SelectTrigger className="h-12"><SelectValue placeholder="Předmět" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Obecná kompetence</SelectItem>
                {context.subjects.map((subject) => <SelectItem key={subject.id} value={subject.id}>{subject.name}</SelectItem>)}
              </SelectContent>
            </Select>
            <Input className="h-12" value={name} onChange={(event) => setName(event.target.value)} placeholder="Název kompetence" />
            <Input className="h-12" value={description} onChange={(event) => setDescription(event.target.value)} placeholder="Krátký popis (nepovinný)" />
            <Button className="h-12" disabled={creatingCompetency || !name.trim()} onClick={() => void createCompetency()}>
              <Plus className="mr-2 h-4 w-4" /> Přidat
            </Button>
          </div>
          {error && <p role="alert" className="font-bold text-danger">{error}</p>}
          <div className="flex flex-wrap gap-2">
            {context.competencies.map((item) => (
              <span key={item.id} className="rounded-full border border-line bg-canvas-alt px-3 py-2 text-sm font-semibold text-ink">
                {item.name} · {item.scaleMin}–{item.scaleMax}
              </span>
            ))}
            {context.competencies.length === 0 && <EmptyValue>Zatím nejsou vytvořené žádné kompetence.</EmptyValue>}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default function ProgressPage(): React.JSX.Element | null {
  const router = useRouter();
  const { hasRole } = usePermissions();
  const online = useOnlineStatus();
  const authUserId = useAuthStore((state) => state.user?.id ?? null);
  const activeOrgId = useAuthStore((state) => state.org?.id ?? null);
  const offlineScope = useMemo(
    () => buildProgressOfflineScope(authUserId, activeOrgId),
    [activeOrgId, authUserId],
  );
  const isTeacher = hasRole("TEACHER");
  const isLeadership = hasRole("DIRECTOR") || hasRole("OWNER");
  const isStaff = isTeacher || isLeadership;
  const [context, setContext] = useState<ProgressContext | null>(null);
  const [dashboard, setDashboard] = useState<ProgressDashboard | null>(null);
  const [dashboardError, setDashboardError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [offline, setOffline] = useState(false);
  const [largeText, setLargeText] = useState(false);
  const [highContrast, setHighContrast] = useState(false);
  const [leadershipView, setLeadershipView] = useState<LeadershipView>(
    isLeadership ? "DASHBOARD" : "WRITE",
  );

  useEffect(() => {
    if (!isStaff) router.replace("/app");
  }, [isStaff, router]);

  const loadContext = useCallback(async () => {
    if (!offlineScope) throw new Error("PROGRESS_OFFLINE_SCOPE_REQUIRED");
    try {
      const fresh = await progressApi.context();
      setContext(fresh);
      setOffline(false);
      await cacheProgressContext(offlineScope, fresh);
    } catch {
      const cached = await readCachedProgressContext(offlineScope);
      if (cached) {
        setContext(cached);
        setOffline(true);
      } else {
        throw new Error("PROGRESS_CONTEXT_UNAVAILABLE");
      }
    }
  }, [offlineScope]);

  const loadDashboard = useCallback(async () => {
    if (!isLeadership) return;
    if (!online) {
      setDashboardError(null);
      return;
    }
    try {
      setDashboard(await progressApi.dashboard());
      setDashboardError(null);
    } catch {
      setDashboard(null);
      setDashboardError("Přehled školy se nepodařilo načíst. Zkuste obnovení.");
    }
  }, [isLeadership, online]);

  const loadPageData = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      await Promise.all([loadContext(), loadDashboard()]);
    } catch {
      setLoadError("Pokrok se nepodařilo načíst ani z bezpečně uložených offline dat.");
    } finally {
      setLoading(false);
    }
  }, [loadContext, loadDashboard]);

  useEffect(() => {
    if (!isStaff || !offlineScope) return;
    void loadPageData();
  }, [isStaff, loadPageData, offlineScope]);

  if (!isStaff) return null;
  if (!offlineScope || loading) {
    return <div className="flex justify-center py-24"><LoadingSpinner /></div>;
  }
  if (!context) {
    return (
      <Card className="mx-auto max-w-xl">
        <CardContent className="space-y-4 p-6 text-center sm:p-8">
          <AlertTriangle className="mx-auto h-10 w-10 text-warning-strong" />
          <h1 className="text-2xl font-black text-ink">Pokrok teď nejde načíst</h1>
          <p className="text-ink-muted">
            {loadError ?? "Zkontrolujte připojení a zkuste to znovu."}
          </p>
          <Button size="lg" className="min-h-[52px] w-full sm:w-auto" onClick={() => void loadPageData()}>
            <RefreshCw className="mr-2 h-5 w-5" /> Zkusit znovu
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div
      className={cn(
        "mx-auto max-w-7xl space-y-6",
        largeText && "[&_p]:text-[1.05em] [&_label]:text-[1.05em]",
        highContrast && "contrast-125",
      )}
    >
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-1">
          <p className="flex items-center gap-2 text-sm font-extrabold uppercase tracking-wide text-accent-deep">
            {isLeadership ? <School className="h-4 w-4" /> : <GraduationCap className="h-4 w-4" />}
            {context.academicYear.label}
          </p>
          <h1 className={cn("font-black tracking-tight text-ink", largeText ? "text-4xl" : "text-3xl")}>
            {isLeadership && leadershipView === "DASHBOARD" ? "Pokrok školy" : "Zapsat pokrok žáka"}
          </h1>
          <p className="max-w-2xl text-ink-muted">
            {isLeadership && leadershipView === "DASHBOARD"
              ? "Rychlý přehled školy bez zbytečných tabulek. Z celku můžete přejít k jednotlivým třídám a žákům."
              : "Vyberte žáka, zapište hodnocení a potvrďte. Nic dalšího dělat nemusíte."}
          </p>
        </div>

        <div className="flex w-full flex-wrap gap-2 sm:w-auto">
          {isLeadership && (
            <div className="grid w-full grid-cols-2 rounded-xl border border-line bg-canvas-alt p-1 sm:w-auto">
              <Button className="min-h-[48px] min-w-0 px-3 sm:px-4" variant={leadershipView === "DASHBOARD" ? "default" : "ghost"} onClick={() => setLeadershipView("DASHBOARD")}>
                <School className="mr-2 h-4 w-4" /> Přehled
              </Button>
              <Button className="min-h-[48px] min-w-0 px-3 sm:px-4" variant={leadershipView === "WRITE" ? "default" : "ghost"} onClick={() => setLeadershipView("WRITE")}>
                <UserRound className="mr-2 h-4 w-4" /> Zapsat hodnocení
              </Button>
            </div>
          )}
          <Button className="min-h-[48px] flex-1 sm:flex-none" variant={largeText ? "default" : "outline"} onClick={() => setLargeText((value) => !value)} aria-pressed={largeText}>
            A+ Velké písmo
          </Button>
          <Button className="min-h-[48px] flex-1 sm:flex-none" variant={highContrast ? "default" : "outline"} onClick={() => setHighContrast((value) => !value)} aria-pressed={highContrast}>
            Kontrast
          </Button>
        </div>
      </header>

      {(offline || !online) && (
        <div className="flex items-start gap-3 rounded-xl border border-warning/40 bg-warning-soft p-4 font-semibold text-ink">
          <CloudOff className="mt-0.5 h-5 w-5 shrink-0" />
          Pracujete s posledním uloženým seznamem tříd a žáků. Hodnocení se uloží do zařízení a odešle po obnovení připojení.
        </div>
      )}

      {isLeadership && leadershipView === "DASHBOARD" ? (
        dashboard ? (
          <LeadershipDashboard dashboard={dashboard} context={context} onDashboardRefresh={loadDashboard} onContextRefresh={loadContext} />
        ) : (
          <Card>
            <CardContent className="space-y-4 p-6 text-center sm:p-8">
              <p className="text-ink-muted">
                {!online
                  ? "Dashboard se načte po připojení k internetu."
                  : dashboardError ?? "Dashboard zatím nemá data k zobrazení."}
              </p>
              {online && dashboardError && (
                <Button variant="outline" className="min-h-[48px] w-full sm:w-auto" onClick={() => void loadDashboard()}>
                  <RefreshCw className="mr-2 h-4 w-4" /> Obnovit přehled
                </Button>
              )}
            </CardContent>
          </Card>
        )
      ) : (
        <TeacherWorkspace context={context} onContextRefresh={loadContext} largeText={largeText} offlineScope={offlineScope} />
      )}
    </div>
  );
}
