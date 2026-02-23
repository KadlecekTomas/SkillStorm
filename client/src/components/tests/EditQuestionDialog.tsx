"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { fetchWithAuth } from "@/lib/http/client";

type QuestionType = "TRUE_FALSE" | "FILL_IN_THE_BLANK" | "MULTIPLE_CHOICE";

type QuestionOption = {
  id: string;
  text: string;
};

type TestQuestion = {
  id: string;
  type: string;
  text?: string;
  correctAnswer?: string | null;
  correctAnswers?: string[];
  score?: number;
  options?: QuestionOption[];
};

type EditableOption = {
  key: string;
  id?: string;
  text: string;
  originalText?: string;
};

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  testId: string;
  question: TestQuestion | null;
  onSaved: () => Promise<void> | void;
};

let tempOptionCounter = 0;
const makeTempOptionKey = () => {
  tempOptionCounter += 1;
  return `new-${tempOptionCounter}`;
};

function toQuestionType(value: string | undefined): QuestionType {
  if (value === "MULTIPLE_CHOICE") return "MULTIPLE_CHOICE";
  if (value === "TRUE_FALSE") return "TRUE_FALSE";
  return "FILL_IN_THE_BLANK";
}

function buildInitialOptions(question: TestQuestion | null): EditableOption[] {
  if (!question) return [];
  const existing = (question.options ?? []).map((option) => ({
    key: option.id,
    id: option.id,
    text: option.text,
    originalText: option.text,
  }));
  if (existing.length > 0) return existing;

  const fallbackAnswers =
    question.correctAnswers && question.correctAnswers.length > 0
      ? question.correctAnswers
      : question.correctAnswer
        ? [question.correctAnswer]
        : [];
  if (fallbackAnswers.length > 0) {
    return fallbackAnswers.map((text) => ({
      key: makeTempOptionKey(),
      text,
    }));
  }

  return [
    { key: makeTempOptionKey(), text: "" },
    { key: makeTempOptionKey(), text: "" },
  ];
}

export function EditQuestionDialog({
  open,
  onOpenChange,
  testId,
  question,
  onSaved,
}: Props): React.JSX.Element {
  const [text, setText] = useState("");
  const [type, setType] = useState<QuestionType>("FILL_IN_THE_BLANK");
  const [score, setScore] = useState<number>(1);
  const [correctAnswer, setCorrectAnswer] = useState("");
  const [options, setOptions] = useState<EditableOption[]>([]);
  const [selectedCorrectOptionKey, setSelectedCorrectOptionKey] = useState<string>("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !question) return;
    const nextType = toQuestionType(question.type);
    const nextOptions = buildInitialOptions(question);
    const answerFromQuestion =
      question.correctAnswer ??
      (question.correctAnswers && question.correctAnswers.length > 0
        ? question.correctAnswers[0] ?? ""
        : "");
    const selected =
      nextOptions.find((option) => option.text === answerFromQuestion)?.key ??
      nextOptions[0]?.key ??
      "";

    setText(question.text ?? "");
    setType(nextType);
    setScore(Math.max(1, Number(question.score ?? 1) || 1));
    setCorrectAnswer(answerFromQuestion);
    setOptions(nextOptions);
    setSelectedCorrectOptionKey(selected);
    setError(null);
  }, [open, question]);

  const normalizedOptions = useMemo(
    () =>
      options
        .map((option) => ({
          ...option,
          text: option.text.trim(),
        }))
        .filter((option) => option.text.length > 0),
    [options],
  );

  const addOption = () => {
    setOptions((prev) => [...prev, { key: makeTempOptionKey(), text: "" }]);
  };

  const removeOption = (key: string) => {
    setOptions((prev) => prev.filter((option) => option.key !== key));
    if (selectedCorrectOptionKey === key) {
      const fallback = options.find((option) => option.key !== key);
      setSelectedCorrectOptionKey(fallback?.key ?? "");
    }
  };

  const updateOptionText = (key: string, value: string) => {
    setOptions((prev) =>
      prev.map((option) =>
        option.key === key ? { ...option, text: value } : option,
      ),
    );
  };

  const syncMultipleChoiceOptions = async (
    nextOptions: EditableOption[],
    questionId: string,
  ) => {
    const previous = question?.options ?? [];
    const previousById = new Map(previous.map((option) => [option.id, option]));
    const keptIds = new Set(
      nextOptions.map((option) => option.id).filter((id): id is string => !!id),
    );

    for (const previousOption of previous) {
      if (!keptIds.has(previousOption.id)) {
        await fetchWithAuth(
          "DELETE",
          `/tests/${testId}/questions/${questionId}/options/${previousOption.id}`,
        );
      }
    }

    for (const option of nextOptions) {
      if (option.id) {
        const original = previousById.get(option.id);
        if (original && original.text !== option.text) {
          await fetchWithAuth(
            "PATCH",
            `/tests/${testId}/questions/${questionId}/options/${option.id}`,
            { body: { text: option.text } },
          );
        }
      } else {
        await fetchWithAuth(
          "POST",
          `/tests/${testId}/questions/${questionId}/options`,
          { body: { text: option.text } },
        );
      }
    }
  };

  const handleSave = async () => {
    if (!question) return;
    const normalizedText = text.trim();
    const normalizedScore = Math.max(1, Number(score) || 1);

    if (!normalizedText) {
      setError("Text otázky je povinný.");
      return;
    }

    setSaving(true);
    setError(null);
    try {
      let payload: Record<string, unknown> = {
        text: normalizedText,
        type,
        score: normalizedScore,
      };

      if (type === "MULTIPLE_CHOICE") {
        if (normalizedOptions.length === 0) {
          throw new Error("Přidej alespoň jednu možnost.");
        }
        const selectedOption =
          normalizedOptions.find(
            (option) => option.key === selectedCorrectOptionKey,
          ) ?? normalizedOptions[0];
        if (!selectedOption || !selectedOption.text) {
          throw new Error("Vyber správnou možnost.");
        }

        await syncMultipleChoiceOptions(normalizedOptions, question.id);
        payload = {
          ...payload,
          correctAnswer: selectedOption.text,
        };
      } else {
        const normalizedAnswer = correctAnswer.trim();
        if (!normalizedAnswer) {
          throw new Error("Správná odpověď je povinná.");
        }
        payload = {
          ...payload,
          correctAnswer: normalizedAnswer,
        };
      }

      await fetchWithAuth(
        "PATCH",
        `/tests/${testId}/questions/${question.id}`,
        { body: payload },
      );
      await onSaved();
      onOpenChange(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Uložení otázky se nepodařilo.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Upravit otázku</DialogTitle>
        </DialogHeader>

        {!question ? null : (
          <div className="space-y-4">
            <label className="space-y-1 text-sm text-slate-600">
              Text otázky
              <Textarea
                value={text}
                onChange={(event) => setText(event.target.value)}
                rows={3}
              />
            </label>

            <div className="grid gap-3 sm:grid-cols-2">
              <label className="space-y-1 text-sm text-slate-600">
                Typ otázky
                <select
                  className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm"
                  value={type}
                  onChange={(event) => {
                    const nextType = toQuestionType(event.target.value);
                    setType(nextType);
                  }}
                >
                  <option value="TRUE_FALSE">TRUE_FALSE</option>
                  <option value="FILL_IN_THE_BLANK">FILL_IN_THE_BLANK</option>
                  <option value="MULTIPLE_CHOICE">MULTIPLE_CHOICE</option>
                </select>
              </label>
              <label className="space-y-1 text-sm text-slate-600">
                Body
                <Input
                  type="number"
                  min={1}
                  value={score}
                  onChange={(event) => setScore(Math.max(1, Number(event.target.value) || 1))}
                />
              </label>
            </div>

            {type === "MULTIPLE_CHOICE" ? (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium text-slate-700">Možnosti</p>
                  <Button type="button" variant="outline" size="sm" onClick={addOption}>
                    Přidat možnost
                  </Button>
                </div>
                <div className="space-y-2">
                  {options.map((option) => (
                    <div key={option.key} className="flex items-center gap-2">
                      <input
                        type="radio"
                        checked={selectedCorrectOptionKey === option.key}
                        onChange={() => setSelectedCorrectOptionKey(option.key)}
                        aria-label="Správná možnost"
                      />
                      <Input
                        value={option.text}
                        onChange={(event) => updateOptionText(option.key, event.target.value)}
                        placeholder="Text možnosti"
                      />
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => removeOption(option.key)}
                      >
                        Smazat
                      </Button>
                    </div>
                  ))}
                </div>
                <p className="text-xs text-slate-500">Radiobutton označuje správnou možnost.</p>
              </div>
            ) : (
              <label className="space-y-1 text-sm text-slate-600">
                Správná odpověď
                {type === "TRUE_FALSE" ? (
                  <select
                    className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm"
                    value={correctAnswer}
                    onChange={(event) => setCorrectAnswer(event.target.value)}
                  >
                    <option value="">Vyber odpověď</option>
                    <option value="true">true</option>
                    <option value="false">false</option>
                  </select>
                ) : (
                  <Input
                    value={correctAnswer}
                    onChange={(event) => setCorrectAnswer(event.target.value)}
                    placeholder="Správná odpověď"
                  />
                )}
              </label>
            )}

            {error && <p className="text-sm text-red-600">{error}</p>}
          </div>
        )}

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={saving}
          >
            Zrušit
          </Button>
          <Button type="button" onClick={() => void handleSave()} disabled={saving || !question}>
            {saving ? "Ukládám…" : "Uložit"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
