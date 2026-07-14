"use client";

import { useMemo, useState } from "react";
import type { JSX } from "react";
import { useRouter } from "next/navigation";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { ErrorAlert } from "@/components/ui/alert";
import { useTestsList } from "@/hooks/use-tests-list";
import { useClassroomStructure } from "@/hooks/use-classroom-structure";
import {
  resolveLiveAgeMode,
  toServerLiveAgeMode,
  type LiveAgeMode,
} from "@/config/live-age-mode";
import { createLiveSession, startLiveSession } from "@/lib/api/live-sessions";
import { cn } from "@/utils/cn";

const AGE_MODE_LABELS: Record<LiveAgeMode, { label: string; hint: string }> = {
  young: { label: "1.–3. třída", hint: "velké dlaždice, parťák, bez odpočtu" },
  middle: { label: "4.–9. třída", hint: "kompaktní, odpočet zapnutý" },
  senior: { label: "Střední škola", hint: "quiz night — tempo a streak" },
};

const DEFAULT_COUNTDOWN_SEC = 20;

interface BleskovkaSetupDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/**
 * Krok 1 flow Bleskovky: výběr sady + třídy + věkové úrovně → SPUSTIT.
 * SPUSTIT = create + start jedním klikem; pak přesměrování na projekci.
 */
export function BleskovkaSetupDialog({
  open,
  onOpenChange,
}: BleskovkaSetupDialogProps): JSX.Element {
  const router = useRouter();
  const { tests, loading: testsLoading } = useTestsList({
    enabled: open,
    status: "PUBLISHED",
  });
  const { data: structure } = useClassroomStructure({ enabled: open });

  const [testId, setTestId] = useState<string>("");
  const [classSectionId, setClassSectionId] = useState<string>("");
  const [ageModeOverride, setAgeModeOverride] = useState<LiveAgeMode | null>(
    null,
  );
  const [countdownOn, setCountdownOn] = useState<boolean | null>(null);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const classes = useMemo(() => {
    if (!structure) return [];
    const all = [
      ...(structure.homeroom ? [structure.homeroom] : []),
      ...structure.teachingClasses,
      ...structure.otherClasses,
    ];
    return all.filter(
      (cls, i) => all.findIndex((other) => other.id === cls.id) === i,
    );
  }, [structure]);

  const selectedClass = classes.find((cls) => cls.id === classSectionId);
  const detectedMode = resolveLiveAgeMode(selectedClass?.grade ?? null);
  const ageMode = ageModeOverride ?? detectedMode;
  // young defaultně bez odpočtu, ostatní s odpočtem; učitel může přepnout
  const countdownEnabled = countdownOn ?? ageMode !== "young";

  const handleStart = async () => {
    if (!testId) return;
    setStarting(true);
    setError(null);
    try {
      const session = await createLiveSession({
        testId,
        ...(classSectionId ? { classSectionId } : {}),
        ageMode: toServerLiveAgeMode(ageMode),
        ...(countdownEnabled ? { countdownSec: DEFAULT_COUNTDOWN_SEC } : {}),
      });
      await startLiveSession(session.id);
      router.push(`/app/live/${session.id}/board`);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Bleskovku se nepodařilo spustit.",
      );
      setStarting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg" data-testid="bleskovka-setup">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-ink">
            <span aria-hidden>⚡</span> Bleskovka
          </DialogTitle>
          <DialogDescription>
            Živé cvičení pro celou třídu na tabuli. Vyber sadu otázek a třídu.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <label className="block">
            <span className="text-sm font-semibold text-ink">Sada otázek</span>
            <select
              data-testid="bleskovka-test-select"
              className="mt-1 h-11 w-full rounded-xl border border-line-strong bg-canvas px-3 text-[15px] text-ink"
              value={testId}
              onChange={(e) => setTestId(e.target.value)}
              disabled={testsLoading}
            >
              <option value="">
                {testsLoading ? "Načítám sady…" : "— vyber sadu —"}
              </option>
              {tests.map((test) => (
                <option key={test.id} value={test.id}>
                  {test.title}
                </option>
              ))}
            </select>
          </label>

          <label className="block">
            <span className="text-sm font-semibold text-ink">Třída</span>
            <select
              data-testid="bleskovka-class-select"
              className="mt-1 h-11 w-full rounded-xl border border-line-strong bg-canvas px-3 text-[15px] text-ink"
              value={classSectionId}
              onChange={(e) => {
                setClassSectionId(e.target.value);
                setAgeModeOverride(null);
              }}
            >
              <option value="">Bez třídy (jen na zkoušku, bez parťáka)</option>
              {classes.map((cls) => (
                <option key={cls.id} value={cls.id}>
                  {cls.label ?? `${cls.grade} ${cls.section}`}
                </option>
              ))}
            </select>
          </label>

          <fieldset>
            <legend className="text-sm font-semibold text-ink">
              Věková úroveň projekce
            </legend>
            <div className="mt-1 grid grid-cols-3 gap-2">
              {(Object.keys(AGE_MODE_LABELS) as LiveAgeMode[]).map((mode) => (
                <button
                  key={mode}
                  type="button"
                  data-testid={`bleskovka-age-${mode}`}
                  aria-pressed={ageMode === mode}
                  onClick={() => setAgeModeOverride(mode)}
                  className={cn(
                    "rounded-xl border-2 px-2 py-2 text-center text-sm font-bold transition-colors",
                    ageMode === mode
                      ? "border-accent bg-accent-soft text-accent-deep"
                      : "border-line bg-canvas text-ink-muted hover:border-accent/50",
                  )}
                >
                  {AGE_MODE_LABELS[mode].label}
                </button>
              ))}
            </div>
            <p className="mt-1 text-xs text-ink-dim">
              {AGE_MODE_LABELS[ageMode].hint}
              {ageModeOverride === null && selectedClass
                ? " · odvozeno z ročníku třídy"
                : ""}
            </p>
          </fieldset>

          <label className="flex items-center justify-between rounded-xl border border-line bg-canvas-alt px-4 py-3">
            <span className="text-sm font-semibold text-ink">
              Odpočet na otázku ({DEFAULT_COUNTDOWN_SEC} s)
            </span>
            <Switch
              checked={countdownEnabled}
              onCheckedChange={(checked: boolean) => setCountdownOn(checked)}
            />
          </label>

          {error ? <ErrorAlert title="Chyba" description={error} /> : null}

          <Button
            data-testid="bleskovka-start"
            className="w-full"
            size="lg"
            disabled={!testId || starting}
            onClick={() => void handleStart()}
          >
            {starting ? "Spouštím…" : "SPUSTIT"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
