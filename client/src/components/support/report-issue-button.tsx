"use client";

import { useMemo, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { LifeBuoy, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { createSupportTicket } from "@/lib/api/support";
import { useAuth } from "@/hooks/use-auth";
import { showHttpErrorToastOnce, showToastOnce } from "@/utils/toast";
import { cn } from "@/utils/cn";
import type { SupportCategory } from "@/types";

const CATEGORIES: Array<{ value: SupportCategory; label: string }> = [
  { value: "SUBJECT", label: "Subject" },
  { value: "TEST", label: "Test" },
  { value: "STUDENT", label: "Student" },
  { value: "ASSIGNMENT", label: "Assignment" },
  { value: "TEST_ASSIGNMENT", label: "Test assignment" },
  { value: "OTHER", label: "Other" },
];

type ReportIssueButtonProps = {
  compact?: boolean;
  className?: string;
  label?: string;
  componentContext?: string;
  defaultCategory?: SupportCategory;
  defaultMessage?: string;
};

export function ReportIssueButton({
  compact = false,
  className,
  label,
  componentContext,
  defaultCategory = "OTHER",
  defaultMessage = "",
}: ReportIssueButtonProps): React.JSX.Element {
  const { user, context } = useAuth();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [open, setOpen] = useState(false);
  const [category, setCategory] = useState<SupportCategory>(defaultCategory);
  const [message, setMessage] = useState(defaultMessage);
  const [submitting, setSubmitting] = useState(false);

  const canSubmit = useMemo(
    () => message.trim().length >= 10 && category.length > 0 && !submitting,
    [category, message, submitting],
  );
  const queryString = searchParams?.toString() ?? "";
  const roleLabel =
    user?.organizationRole ??
    user?.systemRole ??
    context?.mode ??
    null;

  const reset = () => {
    setCategory(defaultCategory);
    setMessage(defaultMessage);
    setSubmitting(false);
  };

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    try {
      await createSupportTicket({
        category,
        message: message.trim(),
        page: pathname ?? undefined,
        metadata: {
          routePathname: pathname ?? null,
          queryString: queryString.length > 0 ? `?${queryString}` : "",
          componentContext: componentContext ?? null,
          userAgent: typeof navigator !== "undefined" ? navigator.userAgent : null,
          viewportWidth: typeof window !== "undefined" ? window.innerWidth : null,
          viewportHeight: typeof window !== "undefined" ? window.innerHeight : null,
          uiRole: roleLabel,
          clientTimestamp: new Date().toISOString(),
        },
      });
      showToastOnce("Support request sent.", { type: "success" });
      setOpen(false);
      reset();
    } catch (error) {
      showHttpErrorToastOnce(error);
      setSubmitting(false);
    }
  };

  return (
    <>
      <Button
        type="button"
        variant={compact ? "ghost" : "secondary"}
        size={compact ? "sm" : "md"}
        className={cn(
          compact ? "h-auto rounded-xl px-2 py-1 text-xs text-slate-500 hover:text-slate-700" : "rounded-2xl",
          className,
        )}
        onClick={() => setOpen(true)}
      >
        <LifeBuoy className={compact ? "h-3.5 w-3.5" : "h-4 w-4"} />
        <span>{label ?? (compact ? "Nahlásit problém" : "Report issue")}</span>
      </Button>

      <Dialog
        open={open}
        onOpenChange={(next) => {
          setOpen(next);
          if (!next) reset();
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nahlásit problém</DialogTitle>
            <DialogDescription>
              Support ticket odešleme superadminovi včetně aktuální stránky a technických metadat.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700">Kategorie</label>
              <Select
                value={category}
                onValueChange={(value) => setCategory(value as SupportCategory)}
              >
                <SelectTrigger aria-label="Kategorie support požadavku">
                  <SelectValue placeholder="Vyberte kategorii" />
                </SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map((item) => (
                    <SelectItem key={item.value} value={item.value}>
                      {item.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700">
                Describe the problem
              </label>
              <Textarea
                rows={6}
                value={message}
                onChange={(event) => setMessage(event.target.value)}
                placeholder="Co se stalo, kde a co jste očekávali?"
              />
              <p className="text-xs text-slate-500">
                Aktuální stránka:{" "}
                <span className="font-mono">
                  {pathname ?? "—"}
                  {queryString ? `?${queryString}` : ""}
                </span>
              </p>
              {componentContext ? (
                <p className="text-xs text-slate-500">
                  Kontext komponenty: <span className="font-mono">{componentContext}</span>
                </p>
              ) : null}
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={submitting}>
              Zrušit
            </Button>
            <Button type="button" onClick={handleSubmit} disabled={!canSubmit}>
              {submitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Odesílám…
                </>
              ) : (
                "Odeslat"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
