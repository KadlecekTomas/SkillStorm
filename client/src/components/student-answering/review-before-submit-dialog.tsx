"use client";

import type { JSX } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { SaveStatus } from "@/lib/focus-test/types";
import { cn } from "@/utils/cn";
import { ProgressSummary } from "./progress-summary";

export interface ReviewBeforeSubmitDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  answered: number;
  total: number;
  flagged: number;
  online: boolean;
  hasUnsaved: boolean;
  saveStatus: SaveStatus;
  submitting: boolean;
  submitError: string | null;
  /** Runs the real submit (force-sync + finish). Resolves regardless of outcome. */
  onConfirm: () => void | Promise<unknown>;
}

/**
 * Final confirmation before a submission becomes immutable.
 *
 * The dialog is purely a gate over `onConfirm` (which is `useFocusTest.submit`): it surfaces
 * the current state but does not itself sync or finish. Submit is blocked while offline, and
 * any unsaved answers are force-synced by `submit()` before `finish` is called — if that sync
 * fails, `submit()` keeps the dialog actionable and the error is shown here.
 */
export function ReviewBeforeSubmitDialog({
  open,
  onOpenChange,
  answered,
  total,
  flagged,
  online,
  hasUnsaved,
  saveStatus,
  submitting,
  submitError,
  onConfirm,
}: ReviewBeforeSubmitDialogProps): JSX.Element {
  const unanswered = Math.max(0, total - answered);
  const blockedOffline = !online;
  // A submission must never finalize while answers are not safely persisted on the server.
  const saveFailed = saveStatus === "error";
  const saving = saveStatus === "saving";
  const notSafelySaved = saving || saveFailed || hasUnsaved;
  const submitDisabled = blockedOffline || notSafelySaved || submitting;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent data-testid="review-submit-dialog" className="max-w-md">
        <DialogHeader>
          <DialogTitle>Zkontroluj před odevzdáním</DialogTitle>
          <DialogDescription>
            Po odevzdání už nepůjde odpovědi měnit. Projdi si přehled níže.
          </DialogDescription>
        </DialogHeader>

        <ProgressSummary
          answered={answered}
          total={total}
          flagged={flagged}
          saveStatus={saveStatus}
          hasUnsaved={hasUnsaved}
        />

        {unanswered > 0 && (
          <p
            data-testid="review-unanswered-warning"
            className="rounded-xl bg-amber-50 px-3 py-2 text-sm text-amber-800"
          >
            Máš {unanswered}{" "}
            {unanswered === 1 ? "nezodpovězenou otázku" : "nezodpovězených otázek"}
            . Můžeš se vrátit a doplnit je.
          </p>
        )}

        {flagged > 0 && (
          <p className="rounded-xl bg-slate-50 px-3 py-2 text-sm text-slate-600">
            {flagged}{" "}
            {flagged === 1 ? "otázka je označená" : "otázek je označených"} k
            návratu.
          </p>
        )}

        {blockedOffline && (
          <p
            data-testid="review-offline-warning"
            className="rounded-xl bg-red-50 px-3 py-2 text-sm font-medium text-red-700"
          >
            Jsi offline – test je uložený v zařízení, ale nelze ho odevzdat bez
            připojení k internetu. Připoj se a zkus to znovu.
          </p>
        )}

        {!blockedOffline && saveFailed && (
          <p
            data-testid="review-save-error-warning"
            className="rounded-xl bg-red-50 px-3 py-2 text-sm font-medium text-red-700"
          >
            Odpovědi se nepodařilo uložit. Než budou bezpečně uložené, nelze
            test odevzdat – vrať se do testu a počkej na uložení nebo odpověď
            zadej znovu.
          </p>
        )}

        {!blockedOffline && !saveFailed && (saving || hasUnsaved) && (
          <p
            data-testid="review-unsaved-warning"
            className="rounded-xl bg-amber-50 px-3 py-2 text-sm font-medium text-amber-800"
          >
            Odpovědi se ještě ukládají. Počkej prosím, než budou bezpečně
            uložené – pak půjde test odevzdat.
          </p>
        )}

        {submitError && (
          <p
            data-testid="review-submit-error"
            className="rounded-xl bg-red-50 px-3 py-2 text-sm font-medium text-red-700"
          >
            {submitError}
          </p>
        )}

        <DialogFooter>
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            disabled={submitting}
            className="inline-flex h-11 items-center justify-center rounded-2xl border border-slate-200 bg-white px-5 text-sm font-medium text-slate-900 transition-colors hover:bg-slate-50 disabled:opacity-60"
          >
            Zpět do testu
          </button>
          <button
            type="button"
            data-testid="confirm-submit"
            onClick={() => void onConfirm()}
            disabled={submitDisabled}
            className={cn(
              "inline-flex h-11 items-center justify-center rounded-2xl px-5 text-sm font-semibold text-white shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-emerald-500 disabled:cursor-not-allowed disabled:opacity-60",
              "bg-emerald-600 hover:bg-emerald-700",
            )}
          >
            {submitting ? "Odevzdávám…" : "Odevzdat test"}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
