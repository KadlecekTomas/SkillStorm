"use client";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { WarningAlert } from "@/components/ui/alert";
import type { StudentImportCommitResponse } from "@/lib/api/student-imports";

type Props = {
  result: StudentImportCommitResponse | null;
  onClose: () => void;
};

export function StudentImportCredentialsDialog({
  result,
  onClose,
}: Props): React.JSX.Element {
  const credentials =
    result?.results.filter(
      (row) => row.status === "IMPORTED" && row.temporaryPassword,
    ) ?? [];

  return (
    <Dialog open={result !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-4xl">
        <DialogHeader>
          <DialogTitle>Jednorázové přihlašovací údaje</DialogTitle>
          <DialogDescription>
            Předejte každému žákovi pouze jeho vlastní údaje bezpečným kanálem.
          </DialogDescription>
        </DialogHeader>

        <WarningAlert
          title="Uložte údaje nyní"
          description="Dočasná hesla se po zavření tohoto okna už nezobrazí a nejsou uložená v systému."
        />

        <div className="max-h-[55vh] overflow-auto rounded-xl border border-slate-200">
          <table className="min-w-full border-collapse text-sm">
            <thead className="sticky top-0 bg-white">
              <tr className="border-b border-slate-200">
                <th className="px-3 py-2 text-left font-semibold text-slate-700">Řádek</th>
                <th className="px-3 py-2 text-left font-semibold text-slate-700">Přihlášení</th>
                <th className="px-3 py-2 text-left font-semibold text-slate-700">Dočasné heslo</th>
                <th className="px-3 py-2 text-left font-semibold text-slate-700">První přihlášení</th>
              </tr>
            </thead>
            <tbody>
              {credentials.map((credential) => (
                <tr key={credential.rowNumber} className="border-b border-slate-100">
                  <td className="px-3 py-2 text-slate-600">{credential.rowNumber}</td>
                  <td className="px-3 py-2 font-medium text-slate-900">
                    {credential.email ?? credential.username}
                  </td>
                  <td className="px-3 py-2 font-mono text-slate-900">
                    {credential.temporaryPassword}
                  </td>
                  <td className="px-3 py-2 text-slate-600">
                    {credential.mustChangePassword ? "Změna hesla povinná" : "Bez povinné změny"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <DialogFooter>
          <Button type="button" onClick={onClose}>Mám údaje bezpečně uložené</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
