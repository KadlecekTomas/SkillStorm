"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { CalendarClock, ChevronRight, Mail, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { usePermissions } from "@/hooks/use-permissions";
import {
  resolveGuardianRelation,
  startStudentSession,
  useChildOverview,
  useGuardianChildren,
  type ChildOverview,
  type GuardianChild,
} from "@/hooks/use-guardian";
import { Input } from "@/components/ui/input";
import { cn } from "@/utils/cn";

/**
 * Rodinný prostor (guardian Etapa B) — první UI pro netechnické dospělé.
 * Pravidla (spec bod 14 + STOP #2): lidský jazyk bez technických pojmů,
 * jedna dominantní akce na obrazovce, velké touch targety (mobil first),
 * basic zobrazení default. Parťák dítěte se tu NIKDY neukazuje.
 */

const dateFormatter = new Intl.DateTimeFormat("cs-CZ", {
  day: "numeric",
  month: "numeric",
});

/** Genitiv dnů („do pátku", „do soboty") — Intl umí jen nominativ. */
const WEEKDAY_GENITIVE = [
  "neděle",
  "pondělí",
  "úterý",
  "středy",
  "čtvrtka",
  "pátku",
  "soboty",
] as const;

/** „Odevzdat do pátku 25. 7." — lidský termín místo timestampu. */
function humanDue(dateIso: string): string {
  const date = new Date(dateIso);
  const today = new Date();
  const diffDays = Math.ceil(
    (date.getTime() - today.getTime()) / (24 * 60 * 60 * 1000),
  );
  if (diffDays <= 0) return "Odevzdat dnes";
  if (diffDays === 1) return "Odevzdat do zítřka";
  return `Odevzdat do ${WEEKDAY_GENITIVE[date.getDay()]} ${dateFormatter.format(date)}`;
}

/** Lidský souhrn místo skóre — žádné srovnávání, žádná čísla v basic. */
function humanResult(score: number | null): string {
  if (score === null) return "Čeká na ohodnocení";
  if (score >= 0.85) return "Povedlo se moc pěkně";
  if (score >= 0.55) return "Zvládnuto";
  return "Chce to ještě společně procvičit";
}

function initials(name: string): string {
  return name
    .split(" ")
    .map((n) => n[0] ?? "")
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

/**
 * Klidná obrazovka po „Ne" — vědomě NENÍ chybový stav; škola už o tom ví
 * (DISPUTED vidí třídní). Renderuje ji stránka, ne potvrzovací komponenta:
 * refetch dětí mezitím PENDING vztah odstraní a komponenta by zmizela i se
 * svým stavem.
 */
function DisputeThanksScreen({ onDone }: { onDone: () => void }) {
  return (
    <Card className="mx-auto max-w-md">
      <CardContent className="space-y-4 p-8 text-center">
        <p className="text-4xl">🙏</p>
        <h1 className="text-xl font-extrabold text-ink">Děkujeme za upozornění</h1>
        <p className="text-[15px] leading-relaxed text-ink-muted">
          Kód se k vám nejspíš dostal omylem. Škola už o tom ví — kdyby se
          nic nedělo, dejte prosím vědět třídnímu učiteli.
        </p>
        <Button variant="outline" size="lg" className="w-full" onClick={onDone}>
          Rozumím
        </Button>
      </CardContent>
    </Card>
  );
}

/** Potvrzovací obrazovka — jedna otázka, dvě velká tlačítka, žádný formulář. */
function ConfirmChildScreen({
  child,
  onResolved,
}: {
  child: GuardianChild;
  onResolved: (confirmed: boolean) => void;
}) {
  const [busy, setBusy] = useState(false);

  const answer = async (confirmed: boolean) => {
    setBusy(true);
    try {
      await resolveGuardianRelation(child.relationId, confirmed);
      onResolved(confirmed);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card className="mx-auto max-w-md">
      <CardContent className="space-y-6 p-8 text-center">
        <Avatar className="mx-auto h-16 w-16">
          <AvatarFallback className="text-lg font-bold">
            {initials(child.name)}
          </AvatarFallback>
        </Avatar>
        <div className="space-y-1">
          <h1 className="text-2xl font-extrabold text-ink">
            Je {child.name} vaše dítě?
          </h1>
          {child.classLabel && (
            <p className="text-[15px] text-ink-muted">třída {child.classLabel}</p>
          )}
        </div>
        <div className="space-y-3">
          <Button
            size="lg"
            className="h-14 w-full text-base"
            disabled={busy}
            onClick={() => void answer(true)}
          >
            Ano, je to moje dítě
          </Button>
          <Button
            variant="outline"
            size="lg"
            className="h-14 w-full text-base"
            disabled={busy}
            onClick={() => void answer(false)}
          >
            Ne, to není moje dítě
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function ChildSwitcher({
  children,
  selectedId,
  onSelect,
}: {
  children: GuardianChild[];
  selectedId: string | null;
  onSelect: (studentId: string) => void;
}) {
  if (children.length <= 1) return null;
  return (
    <div className="flex gap-2 overflow-x-auto pb-1">
      {children.map((child) => (
        <button
          key={child.studentId}
          type="button"
          onClick={() => onSelect(child.studentId)}
          className={cn(
            "flex min-h-[48px] shrink-0 items-center gap-2 rounded-full border-2 px-4 py-2 text-[15px] font-bold transition-colors",
            child.studentId === selectedId
              ? "border-accent bg-accent-soft text-accent-deep"
              : "border-line bg-canvas text-ink-muted hover:bg-canvas-alt",
          )}
        >
          <Avatar className="h-8 w-8">
            <AvatarFallback className="text-xs">{initials(child.name)}</AvatarFallback>
          </Avatar>
          {child.name.split(" ")[0]}
        </button>
      ))}
    </div>
  );
}

/**
 * „Spustit pro Matěje" (Etapa C): jedna dominantní akce; PIN jen když ho
 * zadání vyžaduje. Po spuštění jsou cookies dítěte — tvrdá navigace na
 * aktivitu (čistý stav, sourozenci se nepromíchají).
 */
function LaunchActivity({
  child,
  item,
  onClose,
}: {
  child: GuardianChild;
  item: ChildOverview["todo"][number];
  onClose: () => void;
}) {
  const firstName = child.name.split(" ")[0];
  const needsPin = item.guardianLaunchPolicy === "REQUIRE_CHILD_PIN";
  const [pin, setPin] = useState("");
  const [helping, setHelping] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const start = async () => {
    setBusy(true);
    setError(null);
    try {
      await startStudentSession({
        studentId: child.studentId,
        assignmentId: item.assignmentId,
        assistanceDeclared: helping,
        ...(needsPin ? { pin } : {}),
      });
      window.location.href = `/app/assignments/${item.assignmentId}/test`;
    } catch {
      setError(
        needsPin
          ? "To se nepovedlo — zkontrolujte PIN a zkuste to znovu. Kdyby to nešlo, PIN nastavuje škola."
          : "Spuštění se nepovedlo. Zkuste to prosím znovu.",
      );
      setBusy(false);
    }
  };

  return (
    <div className="space-y-3 rounded-xl border border-accent bg-accent-soft/50 p-4">
      <p className="text-[15px] font-bold text-ink">
        Předat zařízení? {firstName} bude pracovat na: {item.title}
      </p>
      {needsPin && (
        <label className="block space-y-1 text-sm font-semibold text-ink-muted">
          PIN, který zná {firstName}
          <Input
            type="password"
            inputMode="numeric"
            autoComplete="off"
            maxLength={6}
            value={pin}
            onChange={(e) => setPin(e.target.value)}
            className="h-12 max-w-[10rem] text-center text-lg tracking-[.3em]"
          />
        </label>
      )}
      <label className="flex min-h-[44px] items-center gap-2 text-[15px] text-ink">
        <input
          type="checkbox"
          checked={helping}
          onChange={(e) => setHelping(e.target.checked)}
          className="h-5 w-5 accent-[rgb(var(--accent))]"
        />
        Budu u toho pomáhat (učitel to uvidí)
      </label>
      {error && <p className="text-sm font-semibold text-danger">{error}</p>}
      <div className="flex flex-wrap gap-2">
        <Button
          size="lg"
          className="h-12"
          disabled={busy || (needsPin && pin.length < 4)}
          onClick={() => void start()}
        >
          {busy ? "Spouštím…" : `Předat zařízení a spustit`}
        </Button>
        <Button variant="ghost" size="lg" className="h-12" onClick={onClose} disabled={busy}>
          Zpět
        </Button>
      </div>
    </div>
  );
}

function FamilyOverview({ child }: { child: GuardianChild }) {
  const { data, isLoading } = useChildOverview(child.studentId);
  const [showDetail, setShowDetail] = useState(false);
  const [launching, setLaunching] = useState<string | null>(null);

  if (isLoading || !data) {
    return (
      <div className="flex justify-center py-16">
        <LoadingSpinner />
      </div>
    );
  }

  const firstName = data.student.name.split(" ")[0];

  return (
    <div className="space-y-5">
      {/* Doporučený další krok — jedna dominantní akce nahoře */}
      {data.nextStep && (
        <Card className="border-accent bg-accent-soft">
          <CardContent className="flex items-center justify-between gap-4 p-5">
            <div className="min-w-0 space-y-0.5">
              <p className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-accent-deep">
                <Sparkles className="h-3.5 w-3.5" /> Doporučený další krok
              </p>
              <p className="truncate text-[17px] font-extrabold text-ink">
                {data.nextStep.title}
              </p>
              <p className="text-sm font-semibold text-ink-muted">
                {humanDue(data.nextStep.dueAt)}
              </p>
            </div>
            <ChevronRight className="h-6 w-6 shrink-0 text-accent-deep" />
          </CardContent>
        </Card>
      )}

      {/* Co je potřeba udělat */}
      <Card>
        <CardContent className="space-y-3 p-5">
          <h2 className="flex items-center gap-2 text-base font-extrabold text-ink">
            <CalendarClock className="h-4.5 w-4.5 text-ink-dim" /> Co je potřeba
            udělat
          </h2>
          {data.todo.length === 0 ? (
            <p className="py-2 text-[15px] text-ink-muted">
              Teď není nic potřeba — vše je hotové. 🎉
            </p>
          ) : (
            <ul className="divide-y divide-line">
              {data.todo.map((item) => (
                <li key={item.assignmentId} className="space-y-3 py-3">
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-[15px] font-bold text-ink">{item.title}</p>
                      <p className="text-sm text-ink-muted">
                        {humanDue(item.dueAt)}
                        {item.started ? " · rozpracováno" : ""}
                      </p>
                    </div>
                    {item.guardianLaunchPolicy !== "DISABLED" && (
                      <Button
                        variant="outline"
                        className="h-11 shrink-0"
                        onClick={() =>
                          setLaunching((cur) =>
                            cur === item.assignmentId ? null : item.assignmentId,
                          )
                        }
                      >
                        Spustit doma
                      </Button>
                    )}
                  </div>
                  {launching === item.assignmentId && (
                    <LaunchActivity
                      child={child}
                      item={item}
                      onClose={() => setLaunching(null)}
                    />
                  )}
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      {/* Jak se dítěti daří */}
      <Card>
        <CardContent className="space-y-3 p-5">
          <h2 className="text-base font-extrabold text-ink">Jak se daří</h2>
          {data.progress.length === 0 ? (
            <p className="py-2 text-[15px] text-ink-muted">
              Zatím tu nic není — jakmile {firstName} něco dokončí, uvidíte to
              tady.
            </p>
          ) : (
            <ul className="divide-y divide-line">
              {data.progress.map((item, i) => (
                <li key={i} className="flex items-center justify-between gap-3 py-3">
                  <p className="min-w-0 truncate text-[15px] font-semibold text-ink">
                    {item.title}
                  </p>
                  <p className="shrink-0 text-sm font-bold text-ink-muted">
                    {humanResult(item.score)}
                    {showDetail && item.score !== null && (
                      <span className="ml-2 font-normal text-ink-dim">
                        {Math.round(item.score * 100)} %
                      </span>
                    )}
                  </p>
                </li>
              ))}
            </ul>
          )}
          {data.progress.length > 0 && (
            <button
              type="button"
              onClick={() => setShowDetail((v) => !v)}
              className="min-h-[44px] text-sm font-bold text-accent-deep hover:underline"
            >
              {showDetail ? "Skrýt podrobnosti" : "Zobrazit více podrobností"}
            </button>
          )}
        </CardContent>
      </Card>

      {/* Zprávy */}
      <Card>
        <CardContent className="space-y-3 p-5">
          <h2 className="flex items-center gap-2 text-base font-extrabold text-ink">
            <Mail className="h-4.5 w-4.5 text-ink-dim" /> Zprávy ze školy
          </h2>
          <p className="py-2 text-[15px] text-ink-muted">
            Zatím žádné zprávy. Až škola něco pošle, najdete to tady.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

export default function FamilyPage() {
  const router = useRouter();
  const { hasRole } = usePermissions();
  const isParent = hasRole("PARENT");
  const { data, isLoading, refetch } = useGuardianChildren(isParent);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [justDisputed, setJustDisputed] = useState(false);

  useEffect(() => {
    if (!isParent) router.replace("/app");
  }, [isParent, router]);

  const children = useMemo(() => data?.children ?? [], [data]);
  const selected =
    children.find((c) => c.studentId === selectedId) ?? children[0] ?? null;

  if (!isParent) return null;
  if (isLoading || !data) {
    return (
      <div className="flex justify-center py-24">
        <LoadingSpinner />
      </div>
    );
  }

  // Poděkování po „Ne" drží stránka — přežije refetch dětí.
  if (justDisputed) {
    return (
      <div className="py-8">
        <DisputeThanksScreen
          onDone={() => {
            setJustDisputed(false);
            void refetch();
          }}
        />
      </div>
    );
  }

  // Potvrzovací obrazovka má přednost — jedna věc naráz.
  const pending = data.pendingConfirmation[0];
  if (pending) {
    return (
      <div className="py-8">
        <ConfirmChildScreen
          child={pending}
          onResolved={(confirmed) => {
            if (!confirmed) setJustDisputed(true);
            void refetch();
          }}
        />
      </div>
    );
  }

  if (children.length === 0) {
    return (
      <Card className="mx-auto mt-8 max-w-md">
        <CardContent className="space-y-3 p-8 text-center">
          <p className="text-4xl">👋</p>
          <h1 className="text-xl font-extrabold text-ink">Zatím tu nikoho nemáte</h1>
          <p className="text-[15px] leading-relaxed text-ink-muted">
            Až od školy dostanete kód pro rodiče, propojíte se s vaším dítětem
            během chvilky. Kdybyste kód neměli, řekněte si třídnímu učiteli.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <div className="space-y-3">
        <h1 className="text-2xl font-extrabold text-ink">
          {selected && children.length === 1
            ? `${selected.name.split(" ")[0]}${selected.classLabel ? ` · ${selected.classLabel}` : ""}`
            : "Moje děti"}
        </h1>
        <ChildSwitcher
          children={children}
          selectedId={selected?.studentId ?? null}
          onSelect={setSelectedId}
        />
      </div>
      {selected && <FamilyOverview child={selected} />}
    </div>
  );
}
