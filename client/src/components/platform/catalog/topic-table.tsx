"use client";

import { useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import type {
  CatalogMeta,
  CatalogTopicItem,
} from "@/components/platform/catalog/types";

type TopicTableProps = {
  items: CatalogTopicItem[];
  meta: CatalogMeta;
  loading: boolean;
  savingId: string | null;
  onPageChange: (page: number) => void;
  onSave: (
    id: string,
    input: { name?: string; order?: number; isActive?: boolean },
  ) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
};

export function TopicTable({
  items,
  meta,
  loading,
  savingId,
  onPageChange,
  onSave,
  onDelete,
}: TopicTableProps): React.JSX.Element {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draftName, setDraftName] = useState("");
  const [draftOrder, setDraftOrder] = useState("");
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const deleteTarget = useMemo(
    () => items.find((item) => item.id === deleteId) ?? null,
    [deleteId, items],
  );

  const startEdit = (item: CatalogTopicItem) => {
    setEditingId(item.id);
    setDraftName(item.name);
    setDraftOrder(item.order == null ? "" : String(item.order));
  };

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-100 bg-white">
      <table className="w-full divide-y divide-slate-100">
        <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
          <tr>
            <th className="px-4 py-3">Topic Name</th>
            <th className="px-4 py-3">Subject</th>
            <th className="px-4 py-3">Order</th>
            <th className="px-4 py-3">Usage</th>
            <th className="px-4 py-3">Status</th>
            <th className="px-4 py-3">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100 text-sm">
          {loading ? (
            <tr>
              <td colSpan={6} className="px-4 py-10 text-center text-slate-500">
                Loading topics…
              </td>
            </tr>
          ) : items.length === 0 ? (
            <tr>
              <td colSpan={6} className="px-4 py-10 text-center text-slate-500">
                No catalog topics found.
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
                        aria-label={`Edit topic ${item.name}`}
                        value={draftName}
                        onChange={(event) => setDraftName(event.target.value)}
                        disabled={isSaving}
                      />
                    ) : (
                      item.name
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-col">
                      <span className="font-medium text-slate-900">
                        {item.subjectName}
                      </span>
                      <span className="text-xs text-slate-500">
                        {item.subjectCode}
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    {isEditing ? (
                      <Input
                        aria-label={`Edit order ${item.name}`}
                        value={draftOrder}
                        onChange={(event) =>
                          setDraftOrder(
                            event.target.value.replace(/[^\d]/g, ""),
                          )
                        }
                        disabled={isSaving}
                      />
                    ) : (
                      (item.order ?? "—")
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <Badge variant="secondary">{item.usageCount}</Badge>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <Switch
                        checked={item.isActive}
                        disabled={isSaving}
                        aria-label={`Toggle topic ${item.name}`}
                        onCheckedChange={(checked) =>
                          void onSave(item.id, { isActive: checked })
                        }
                      />
                      <Badge variant={item.isActive ? "success" : "neutral"}>
                        {item.isActive ? "Active" : "Inactive"}
                      </Badge>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex gap-2">
                      {isEditing ? (
                        <>
                          <Button
                            size="sm"
                            disabled={isSaving || !draftName.trim()}
                            onClick={() => {
                              const input = {
                                name: draftName,
                                ...(draftOrder.trim()
                                  ? { order: Number(draftOrder) }
                                  : {}),
                              };
                              void onSave(item.id, input).then(() =>
                                setEditingId(null),
                              );
                            }}
                          >
                            Save
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={isSaving}
                            onClick={() => setEditingId(null)}
                          >
                            Cancel
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
                            Edit
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setDeleteId(item.id)}
                            disabled={isSaving}
                          >
                            Delete
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

      <div className="flex items-center justify-between border-t border-slate-100 px-4 py-3 text-sm text-slate-500">
        <span>
          Page {meta.page} of {meta.pages} · {meta.total} total
        </span>
        <div className="flex gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={() => onPageChange(meta.page - 1)}
            disabled={meta.page <= 1}
          >
            Previous
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => onPageChange(meta.page + 1)}
            disabled={meta.page >= meta.pages}
          >
            Next
          </Button>
        </div>
      </div>

      <ConfirmDialog
        open={deleteTarget !== null}
        onOpenChange={(open) => !open && setDeleteId(null)}
        title="Delete topic?"
        description={
          deleteTarget
            ? `This will remove or deactivate ${deleteTarget.name} depending on existing usage.`
            : undefined
        }
        confirmText="Delete"
        destructive
        loading={savingId === deleteId}
        onConfirm={() =>
          deleteId
            ? onDelete(deleteId).then(() => setDeleteId(null))
            : Promise.resolve()
        }
      />
    </div>
  );
}
