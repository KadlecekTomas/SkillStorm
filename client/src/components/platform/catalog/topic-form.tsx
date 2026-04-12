"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { CatalogSubjectItem } from "@/components/platform/catalog/types";

type TopicFormProps = {
  loading: boolean;
  subjects: CatalogSubjectItem[];
  selectedSubjectId?: string | undefined;
  onSubmit: (input: {
    subjectId: string;
    name: string;
    order?: number;
  }) => Promise<void>;
};

export function TopicForm({
  loading,
  subjects,
  selectedSubjectId,
  onSubmit,
}: TopicFormProps): React.JSX.Element {
  const [subjectId, setSubjectId] = useState(selectedSubjectId ?? "");
  const [name, setName] = useState("");
  const [order, setOrder] = useState("");

  useEffect(() => {
    if (selectedSubjectId) {
      setSubjectId(selectedSubjectId);
    }
  }, [selectedSubjectId]);

  const handleSubmit = async () => {
    if (!subjectId || !name.trim() || loading) return;
    const input = {
      subjectId,
      name,
      ...(order.trim() ? { order: Number(order) } : {}),
    };
    await onSubmit(input);
    setName("");
    setOrder("");
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>New Catalog Topic</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-3 md:grid-cols-[220px_1fr_120px_auto]">
        <Select
          value={subjectId}
          onValueChange={setSubjectId}
          disabled={loading || subjects.length === 0}
        >
          <SelectTrigger aria-label="Topic subject">
            <SelectValue placeholder="Select subject" />
          </SelectTrigger>
          <SelectContent>
            {subjects.map((subject) => (
              <SelectItem key={subject.id} value={subject.id}>
                {subject.code} · {subject.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Input
          aria-label="Topic name"
          placeholder="Topic name"
          value={name}
          maxLength={255}
          onChange={(event) => setName(event.target.value)}
          disabled={loading}
        />
        <Input
          aria-label="Topic order"
          placeholder="Order"
          inputMode="numeric"
          value={order}
          onChange={(event) =>
            setOrder(event.target.value.replace(/[^\d]/g, ""))
          }
          disabled={loading}
        />
        <Button
          onClick={() => void handleSubmit()}
          disabled={loading || !subjectId || !name.trim()}
        >
          {loading ? "Saving…" : "Create topic"}
        </Button>
      </CardContent>
    </Card>
  );
}
