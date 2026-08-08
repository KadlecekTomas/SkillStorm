"use client";

import { useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import type {
  CatalogMeta,
  CatalogSubjectItem,
} from "@/components/platform/catalog/types";

type SubjectTableProps = {
  items: CatalogSubjectItem[];
  meta: CatalogMeta;
  loading: boolean;
  savingId: string | null;
  onPageChange: (page: number) => void;
  onSave: (
    id: string,
    input: { code?: string; name?: string; isActive?: boolean },
  ) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
};

export function SubjectTable({
  items,
  meta,
  loading,
  savingId,
  onPageChange,
  onSave,
  onDelete,
}: SubjectTableProps): React.JSX.Element {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draftCode, setDraftCode] = useState("");
  const [draftName, setDraftName] = useState("");
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const deleteTarget = useMemo(
    () => items.find((item) => item.id === deleteId) ?? null,
    [deleteId, items],
  );

  const startEdit = (item: CatalogSubjectItem) => {
    setEditingId(item.id);
    setDraftCode(item.code);
    setDraftName(item.name);
  };

  const saveEdit = async (item: CatalogSubjectItem) => {
    await onSave(item.id, { code: draftCode, name: draftName });
    setEditingId(null);
  };

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-100 bg-white">
      <div className="divide-y divide-slate-100 sm:hidden">
        {loading ? (
          <div className="px-4 py-10 text-center text-slate-500">Načítám předměty…</div>
        ) : items.length === 0 ? (
          <div className="px-4 py-10 text-center text-slate-500">Žádné předměty.</div>
        ) : (
          items.map((item) => {
            const isEditing = editingId === item.id;
            const isSaving = savingId === item.id;
            return (
              <article key={item.id} className="space-y-4 p-4">
                {isEditing ? (
                  <div className="grid gap-3">
                    <Input
                      aria-label={`Upravit kód ${item.code}`}
                      value={draftCode}
                      onChange={(event) => setDraftCode(event.target.value)}
                      disabled={isSaving}
                    />
                    <Input
                      aria-label={`Upravit název ${item.name}`}
                      value={draftName}
                      onChange={(event) => setDraftName(event.target.value)}
                      disabled={isSaving}
                    />
                  </div>
                ) : (
                  <div>
                    <p className="text-sm font-semibold text-slate-900">{item.name}</p>
                    <p className="mt-0.5 text-xs text-slate-500">Kód {item.code}</p>
                  </div>
                )}

                <div className="flex flex-wrap items-center gap-3 text-sm text-slate-600">
                  <span>{item.topicCount} témat</span>
                  <div className="flex items-center gap-2">
                    <Switch
                      checked={item.isActive}
                      disabled={isSaving}
                      aria-label={`Aktivita ${item.name}`}
                      onCheckedChange={(checked) =>
                        void onSave(item.id, { isActive: checked })
                      }
                    />
                    <Badge variant={item.isActive ? "success" : "neutral"}>
                      {item.isActive ? "Aktivní" : "Neaktivní"}
                    </Badge>
                  </div>
                </div>

                <div className="flex flex-wrap gap-2">
                  {isEditing ? (
                    <>
                      <Button
                        size="sm"
                        disabled={isSaving || !draftCode.trim() || !draftName.trim()}
                        onClick={() => void saveEdit(item)}
                      >
                        Uložit
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={isSaving}
                        onClick={() => setEditingId(null)}
                      >
                        Zrušit
                      </Button>
                    </>
                  ) : (
                    <>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => startEdit(item)}
                        disabled={isSaving}
                      >
                        Upravit
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setDeleteId(item.id)}
                        disabled={isSaving}
                      >
                        Odebrat
                      </Button>
                    </>
                  )}
                </div>
              </article>
            );
          })
        )}
      </div>

      <div className="hidden sm:block">
        <table className="w-full divide-y divide-slate-100">
          <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-3">Kód</th>
              <th className="px-4 py-3">Název</th>
              <th className="px-4 py-3">Témata</th>
              <th className="px-4 py-3">Stav</th>
              <th className="px-4 py-3">Akce</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 text-sm">
            {loading ? (
              <tr>
                <td colSpan={5} className="px-4 py-10 text-center text-slate-500">
                  Načítám předměty…
                </td>
              </tr>
            ) : items.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-10 text-center text-slate-500">
                  Žádné předměty.
                </td>
              </tr>
            ) : (
              items.map((item) => {
                const isEditing = editingId === item.id;
                const isSaving = savingId === item.id;
                return (
                  <tr key={item.id}>
                    <td className="px-4 py-3">
                      {isEditing ? (
                        <Input
                          aria-label={`Upravit kód ${item.code}`}
                          value={draftCode}
                          onChange={(event) => setDraftCode(event.target.value)}
                          disabled={isSaving}
                        />
                      ) : (
                        <span className="font-semibold text-slate-900">{item.code}</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {isEditing ? (
                        <Input
                          aria-label={`Upravit název ${item.name}`}
                          value={draftName}
                          onChange={(event) => setDraftName(event.target.value)}
                          disabled={isSaving}
                        />
                      ) : (
                        item.name
                      )}
                    </td>
                    <td className="px-4 py-3"><Badge variant="secondary">{item.topicCount}</Badge></td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <Switch
                          checked={item.isActive}
                          disabled={isSaving}
                          aria-label={`Aktivita ${item.name}`}
                          onCheckedChange={(checked) => void onSave(item.id, { isActive: checked })}
                        />
                        <Badge variant={item.isActive ? "success" : "neutral"}>
                          {item.isActive ? "Aktivní" : "Neaktivní"}
                        </Badge>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-2">
                        {isEditing ? (
                          <>
                            <Button
                              size="sm"
                              disabled={isSaving || !draftCode.trim() || !draftName.trim()}
                              onClick={() => void saveEdit(item)}
                            >
                              Uložit
                            </Button>
                            <Button size="sm" variant="outline" disabled={isSaving} onClick={() => setEditingId(null)}>
                              Zrušit
                            </Button>
                          </>
                        ) : (
                          <>
                            <Button size="sm" variant="outline" onClick={() => startEdit(item)} disabled={isSaving}>
                              Upravit
                            </Button>
                            <Button size="sm" variant="outline" onClick={() => setDeleteId(item.id)} disabled={isSaving}>
                              Odebrat
                            </Button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between gap-3 border-t border-slate-100 px-4 py-3 text-sm text-slate-500">
        <span>Strana {meta.page} z {meta.pages} · celkem {meta.total}</span>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={() => onPageChange(meta.page - 1)} disabled={meta.page <= 1}>
            Předchozí
          </Button>
          <Button size="sm" variant="outline" onClick={() => onPageChange(meta.page + 1)} disabled={meta.page >= meta.pages}>
            Další
          </Button>
        </div>
      </div>

      <ConfirmDialog
        open={deleteTarget !== null}
        onOpenChange={(open) => !open && setDeleteId(null)}
        title="Odebrat předmět?"
        description={deleteTarget ? `Předmět ${deleteTarget.name} bude odebrán nebo deaktivován podle existujících vazeb.` : undefined}
        confirmText="Odebrat"
        destructive
        loading={savingId === deleteId}
        onConfirm={() =>
          deleteId ? onDelete(deleteId).then(() => setDeleteId(null)) : Promise.resolve()
        }
      />
    </div>
  );
}
