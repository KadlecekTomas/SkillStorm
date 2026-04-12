"use client";

import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ErrorAlert } from "@/components/ui/alert";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { fetchWithAuth } from "@/lib/http/client";
import { showToastOnce } from "@/utils/toast";
import type { TeacherListItem } from "@/hooks/use-teachers";
import { useTeacherAccess, type TeacherAccessItem, type TeacherAccessLevel } from "@/hooks/use-teacher-access";
import { refreshListAfterMutation } from "@/lib/list-query";

type ClassroomOption = {
  id: string;
  label?: string | null;
  grade: string;
  section: string;
};

type Props = {
  teacher: TeacherListItem;
  classrooms: ClassroomOption[];
};

const levelLabel: Record<TeacherAccessLevel, string> = {
  VIEW: "Pouze náhled",
  EDIT: "Přístup k výuce",
  HOMEROOM: "Třídní učitel",
};

const levelVariant: Record<TeacherAccessLevel, "neutral" | "info" | "success"> = {
  VIEW: "neutral",
  EDIT: "info",
  HOMEROOM: "success",
};

const toDateInputValue = (value?: string | null): string =>
  value ? new Date(value).toISOString().slice(0, 10) : "";

const toIsoDate = (value: string): string | undefined => {
  if (!value) return undefined;
  return new Date(`${value}T00:00:00.000Z`).toISOString();
};

const formatClassLabel = (classroom: ClassroomOption | TeacherAccessItem["classSection"]): string =>
  classroom.label?.trim() || `${classroom.grade.replace("GRADE_", "")}.${classroom.section}`;

export function TeacherAccessManager({ teacher, classrooms }: Props): React.JSX.Element {
  const [open, setOpen] = useState(false);
  const [selectedClassSectionId, setSelectedClassSectionId] = useState("");
  const [selectedAccessLevel, setSelectedAccessLevel] = useState<TeacherAccessLevel>("EDIT");
  const [validFrom, setValidFrom] = useState("");
  const [validTo, setValidTo] = useState("");
  const [saving, setSaving] = useState(false);
  const [drafts, setDrafts] = useState<Record<string, { accessLevel: TeacherAccessLevel; validFrom: string; validTo: string }>>({});

  const teacherId = teacher.id;
  const accessQuery = useTeacherAccess(teacherId, open);

  useEffect(() => {
    setDrafts(
      Object.fromEntries(
        accessQuery.items.map((item) => [
          item.id,
          {
            accessLevel: item.accessLevel,
            validFrom: toDateInputValue(item.validFrom),
            validTo: toDateInputValue(item.validTo),
          },
        ]),
      ),
    );
  }, [accessQuery.items]);

  useEffect(() => {
    if (!open) return;
    const availableClassroom = classrooms[0];
    if (availableClassroom && !selectedClassSectionId) {
      setSelectedClassSectionId(availableClassroom.id);
    }
  }, [classrooms, open, selectedClassSectionId]);

  const accessCountLabel = useMemo(() => {
    if (accessQuery.loading) return "Načítám…";
    if (!accessQuery.items.length) return "Bez přístupů";
    return `${accessQuery.items.length} přístupů`;
  }, [accessQuery.items.length, accessQuery.loading]);

  const invalidate = async () => {
    await refreshListAfterMutation({
      resource: "teachers",
      invalidatePrefixes: [
        ["teacher-access", teacherId],
        ["classrooms"],
        ["classroom-detail"],
        ["dashboard"],
      ],
    });
  };

  const createAccess = async () => {
    if (!selectedClassSectionId) {
      showToastOnce("Vyber třídu.", { type: "error" });
      return;
    }
    setSaving(true);
    try {
      await fetchWithAuth("POST", "/teacher-access", {
        body: {
          teacherId,
          classSectionId: selectedClassSectionId,
          accessLevel: selectedAccessLevel,
          ...(toIsoDate(validFrom) ? { validFrom: toIsoDate(validFrom) } : {}),
          ...(toIsoDate(validTo) ? { validTo: toIsoDate(validTo) } : {}),
        },
      });
      await invalidate();
      await accessQuery.refetch();
      setValidFrom("");
      setValidTo("");
      showToastOnce("Přístup byl uložen.", { type: "success" });
    } catch (error) {
      showToastOnce(error instanceof Error ? error.message : "Přístup se nepodařilo uložit.", { type: "error" });
    } finally {
      setSaving(false);
    }
  };

  const updateAccess = async (accessId: string) => {
    const draft = drafts[accessId];
    if (!draft) return;
    setSaving(true);
    try {
      await fetchWithAuth("PATCH", `/teacher-access/${accessId}`, {
        body: {
          accessLevel: draft.accessLevel,
          validFrom: draft.validFrom ? toIsoDate(draft.validFrom) : null,
          validTo: draft.validTo ? toIsoDate(draft.validTo) : null,
        },
      });
      await invalidate();
      await accessQuery.refetch();
      showToastOnce("Přístup byl upraven.", { type: "success" });
    } catch (error) {
      showToastOnce(error instanceof Error ? error.message : "Přístup se nepodařilo upravit.", { type: "error" });
    } finally {
      setSaving(false);
    }
  };

  const deleteAccess = async (accessId: string) => {
    setSaving(true);
    try {
      await fetchWithAuth("DELETE", `/teacher-access/${accessId}`);
      await invalidate();
      await accessQuery.refetch();
      showToastOnce("Přístup byl odebrán.", { type: "success" });
    } catch (error) {
      showToastOnce(error instanceof Error ? error.message : "Přístup se nepodařilo odebrat.", { type: "error" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <div className="flex items-center gap-2">
        <Badge variant="outline">{accessCountLabel}</Badge>
        <Button type="button" variant="outline" size="sm" onClick={() => setOpen(true)}>
          Přístupy ke třídám
        </Button>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>Přístupy ke třídám</DialogTitle>
            <DialogDescription>
              {teacher.membership?.user?.name ?? "Učitel"} uvidí a upraví jen třídy, ke kterým má aktivní přístup.
            </DialogDescription>
          </DialogHeader>

          {accessQuery.error && (
            <ErrorAlert title="Nepodařilo se načíst přístupy" description={accessQuery.error} />
          )}

          <div className="grid gap-3 rounded-2xl border border-slate-200 bg-slate-50/70 p-4 md:grid-cols-[minmax(0,1.3fr)_180px_140px_140px_auto]">
            <select
              aria-label="Třída"
              className="rounded-2xl border border-slate-200 px-3 py-2 text-sm"
              value={selectedClassSectionId}
              onChange={(event) => setSelectedClassSectionId(event.target.value)}
            >
              <option value="">Vyber třídu</option>
              {classrooms.map((classroom) => (
                <option key={classroom.id} value={classroom.id}>
                  {formatClassLabel(classroom)}
                </option>
              ))}
            </select>
            <select
              aria-label="Role přístupu"
              className="rounded-2xl border border-slate-200 px-3 py-2 text-sm"
              value={selectedAccessLevel}
              onChange={(event) => setSelectedAccessLevel(event.target.value as TeacherAccessLevel)}
            >
              {(["VIEW", "EDIT", "HOMEROOM"] as TeacherAccessLevel[]).map((level) => (
                <option key={level} value={level}>
                  {levelLabel[level]}
                </option>
              ))}
            </select>
            <Input aria-label="Platnost od" type="date" value={validFrom} onChange={(event) => setValidFrom(event.target.value)} />
            <Input aria-label="Platnost do" type="date" value={validTo} onChange={(event) => setValidTo(event.target.value)} />
            <Button type="button" onClick={() => void createAccess()} disabled={saving || !selectedClassSectionId}>
              Přidat
            </Button>
          </div>

          <div className="overflow-hidden rounded-2xl border border-slate-100">
            <table className="w-full divide-y divide-slate-100 text-sm">
              <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-3">Třída</th>
                  <th className="px-4 py-3">Role</th>
                  <th className="px-4 py-3">Platnost</th>
                  <th className="px-4 py-3">Akce</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {accessQuery.loading ? (
                  <tr>
                    <td colSpan={4} className="px-4 py-6 text-slate-500">
                      Načítám přístupy…
                    </td>
                  </tr>
                ) : accessQuery.items.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-4 py-6 text-slate-500">
                      Učitel zatím nemá žádný scoped access.
                    </td>
                  </tr>
                ) : (
                  accessQuery.items.map((item) => {
                    const draft = drafts[item.id] ?? {
                      accessLevel: item.accessLevel,
                      validFrom: toDateInputValue(item.validFrom),
                      validTo: toDateInputValue(item.validTo),
                    };
                    return (
                      <tr key={item.id}>
                        <td className="px-4 py-3 text-slate-700">{formatClassLabel(item.classSection)}</td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <Badge variant={levelVariant[draft.accessLevel]}>{levelLabel[draft.accessLevel]}</Badge>
                            <select
                              aria-label={`Role ${item.id}`}
                              className="rounded-xl border border-slate-200 px-2 py-1 text-sm"
                              value={draft.accessLevel}
                              onChange={(event) =>
                                setDrafts((prev) => ({
                                  ...prev,
                                  [item.id]: {
                                    ...draft,
                                    accessLevel: event.target.value as TeacherAccessLevel,
                                  },
                                }))
                              }
                            >
                              {(["VIEW", "EDIT", "HOMEROOM"] as TeacherAccessLevel[]).map((level) => (
                                <option key={level} value={level}>
                                  {levelLabel[level]}
                                </option>
                              ))}
                            </select>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <div className="grid gap-2 md:grid-cols-2">
                            <Input
                              aria-label={`Platnost od ${item.id}`}
                              type="date"
                              value={draft.validFrom}
                              onChange={(event) =>
                                setDrafts((prev) => ({
                                  ...prev,
                                  [item.id]: {
                                    ...draft,
                                    validFrom: event.target.value,
                                  },
                                }))
                              }
                            />
                            <Input
                              aria-label={`Platnost do ${item.id}`}
                              type="date"
                              value={draft.validTo}
                              onChange={(event) =>
                                setDrafts((prev) => ({
                                  ...prev,
                                  [item.id]: {
                                    ...draft,
                                    validTo: event.target.value,
                                  },
                                }))
                              }
                            />
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex gap-2">
                            <Button type="button" variant="outline" size="sm" disabled={saving} onClick={() => void updateAccess(item.id)}>
                              Uložit
                            </Button>
                            <Button type="button" variant="outline" size="sm" disabled={saving} onClick={() => void deleteAccess(item.id)}>
                              Odebrat
                            </Button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Zavřít
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
