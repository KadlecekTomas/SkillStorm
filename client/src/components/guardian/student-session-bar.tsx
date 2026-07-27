"use client";

import { useEffect, useState } from "react";
import { LogOut } from "lucide-react";
import {
  endStudentSession,
  readStudentSessionMarker,
  type LearningSessionInfo,
} from "@/hooks/use-guardian";

const timeFormatter = new Intl.DateTimeFormat("cs-CZ", {
  hour: "numeric",
  minute: "2-digit",
});

/**
 * Trvalý pruh žákovského režimu (guardian Etapa C, spec bod 5):
 * „Režim žáka: Matěj · Spuštěno rodičem · Ukončit". Nesmí překrývat
 * parťáka — proto úzký pruh NAD obsahem (sticky top), ne overlay.
 * Zdroj pravdy je server (token relace); marker je jen pro zobrazení —
 * po ukončení/expiraci server vrací 401 a aplikace končí na přihlášení.
 */
export function StudentSessionBar(): React.JSX.Element | null {
  const [session, setSession] = useState<LearningSessionInfo | null>(null);
  const [ending, setEnding] = useState(false);

  useEffect(() => {
    setSession(readStudentSessionMarker());
  }, []);

  if (!session) return null;

  const firstName = session.studentName.split(" ")[0];

  const endNow = async () => {
    setEnding(true);
    try {
      await endStudentSession(session.id);
    } catch {
      // I když server selže (relace už expirovala), pokračujeme na
      // přihlášení — cookies jsou mrtvé a stav je vyčištěný.
    }
    window.location.href = "/login?po-zakovskem-rezimu=1";
  };

  return (
    <div className="sticky top-0 z-[60] flex min-h-[44px] items-center justify-between gap-3 bg-accent-deep px-4 py-1.5 text-white">
      <p className="min-w-0 truncate text-sm font-bold">
        Režim žáka: {session.studentName}
        <span className="mx-1.5 font-normal opacity-80">·</span>
        <span className="font-semibold opacity-90">Spuštěno rodičem</span>
        <span className="mx-1.5 font-normal opacity-80">·</span>
        <span className="font-normal opacity-90">
          do {timeFormatter.format(new Date(session.expiresAt))}
        </span>
      </p>
      <button
        type="button"
        onClick={() => void endNow()}
        disabled={ending}
        className="flex min-h-[36px] shrink-0 items-center gap-1.5 rounded-full bg-white/15 px-4 text-sm font-bold hover:bg-white/25"
      >
        <LogOut className="h-3.5 w-3.5" />
        {ending ? "Ukončuji…" : `Ukončit režim žáka`}
      </button>
    </div>
  );
}
