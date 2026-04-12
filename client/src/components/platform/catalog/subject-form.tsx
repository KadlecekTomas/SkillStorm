"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

type SubjectFormProps = {
  loading: boolean;
  onSubmit: (input: { code: string; name: string }) => Promise<void>;
};

export function SubjectForm({
  loading,
  onSubmit,
}: SubjectFormProps): React.JSX.Element {
  const [code, setCode] = useState("");
  const [name, setName] = useState("");

  const handleSubmit = async () => {
    if (!code.trim() || !name.trim() || loading) return;
    await onSubmit({ code, name });
    setCode("");
    setName("");
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>New Catalog Subject</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-3 md:grid-cols-[180px_1fr_auto]">
        <Input
          aria-label="Subject code"
          placeholder="Code"
          value={code}
          maxLength={32}
          onChange={(event) => setCode(event.target.value)}
          disabled={loading}
        />
        <Input
          aria-label="Subject name"
          placeholder="Subject name"
          value={name}
          maxLength={255}
          onChange={(event) => setName(event.target.value)}
          disabled={loading}
        />
        <Button
          onClick={() => void handleSubmit()}
          disabled={loading || !code.trim() || !name.trim()}
        >
          {loading ? "Saving…" : "Create subject"}
        </Button>
      </CardContent>
    </Card>
  );
}
