"use client";

import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { withGuard } from "@/lib/guard/withGuard";
import { PermissionKey } from "@/types";

function CreateTestPage() {
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <p className="text-sm font-medium uppercase tracking-wide text-slate-400">
          Create policy test
        </p>
        <h1 className="text-3xl font-semibold text-slate-900">
          Create new assessment
        </h1>
        <p className="text-sm text-slate-500">
          Guarded route – dostupná pouze pro role s oprávněním CREATE_TEST.
        </p>
        <div className="mt-3">
          <Badge variant="neutral">TODO</Badge>
        </div>
      </div>
      <Alert
        title="TODO"
        description="Vytváření testů přes UI není implementované. Použij API nebo seed."
        variant="warning"
      />
      <Card className="space-y-4 rounded-3xl border border-slate-100 bg-white/80 p-6 shadow-soft">
        <Input
          placeholder="Název testu"
          value=""
          onChange={() => {}}
          disabled
          title="UI create není implementované."
        />
        <Input
          placeholder="Organization ID (ponech prázdné pro aktuální)"
          value=""
          onChange={() => {}}
          disabled
          title="UI create není implementované."
        />
        <Textarea
          placeholder="Krátký popis"
          value=""
          onChange={() => {}}
          disabled
          title="UI create není implementované."
        />
        <Button
          className="w-full rounded-2xl"
          disabled
          title="UI create není implementované."
        >
          Uložit koncept
        </Button>
      </Card>
    </div>
  );
}

export default withGuard({
  requirePerms: [PermissionKey.CREATE_TEST],
})(CreateTestPage);
