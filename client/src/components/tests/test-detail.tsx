"use client";

import { useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

export type TestQuestion =
  | {
      id: string;
      type: "single";
      prompt: string;
      options: string[];
    }
  | {
      id: string;
      type: "numeric";
      prompt: string;
    }
  | {
    id: string;
    type: "text";
    prompt: string;
  };

export type TestDetailProps = {
  title: string;
  description?: string;
  questions: TestQuestion[];
  onSubmit?: (answers: Record<string, string>) => void;
  submitting?: boolean;
  showSubmit?: boolean;
};

export const TestDetail = ({
  title,
  description,
  questions,
  onSubmit,
  submitting,
  showSubmit = true,
}: TestDetailProps) => {
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});

  const requiredQuestions = useMemo(
    () => new Set(questions.map((question) => question.id)),
    [questions],
  );

  const updateAnswer = (questionId: string, value: string) => {
    setAnswers((prev) => ({ ...prev, [questionId]: value }));
    setErrors((prev) => {
      const updated = { ...prev };
      delete updated[questionId];
      return updated;
    });
  };

  const validate = () => {
    const newErrors: Record<string, string> = {};
    Array.from(requiredQuestions).forEach((questionId) => {
      const value = answers[questionId];
      if (!value || value.trim().length === 0) {
        newErrors[questionId] = "Vyžadována odpověď";
      }
    });
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = () => {
    if (!validate()) return;
    onSubmit?.(answers);
  };

  return (
    <Card className="space-y-5 rounded-3xl border border-slate-100 bg-white p-6 shadow-soft">
      <div>
        <h2 className="text-2xl font-semibold text-slate-900">{title}</h2>
        {description && (
          <p className="text-sm text-slate-500">{description}</p>
        )}
      </div>
      <div className="space-y-4">
        {questions.map((question, index) => (
          <div key={question.id} className="space-y-2 rounded-2xl border border-slate-100 bg-slate-50/60 p-4">
            <p className="text-sm font-medium text-slate-700">
              {index + 1}. {question.prompt}
            </p>
            {question.type === "single" && (
              <div className="space-y-2">
                {question.options.map((option) => (
                  <label
                    key={option}
                    className="flex cursor-pointer items-center gap-2 rounded-2xl bg-white px-3 py-2 text-sm text-slate-600 shadow-sm"
                  >
                    <input
                      type="radio"
                      name={question.id}
                      value={option}
                      checked={answers[question.id] === option}
                      onChange={(event) =>
                        updateAnswer(question.id, event.target.value)
                      }
                    />
                    {option}
                  </label>
                ))}
              </div>
            )}
            {question.type === "numeric" && (
              <Input
                type="number"
                inputMode="numeric"
                value={answers[question.id] ?? ""}
                onChange={(event) => updateAnswer(question.id, event.target.value)}
                placeholder="Zadej číslo"
              />
            )}
            {question.type === "text" && (
              <Textarea
                value={answers[question.id] ?? ""}
                onChange={(event) => updateAnswer(question.id, event.target.value)}
                placeholder="Tvoje odpověď"
              />
            )}
            {errors[question.id] && (
              <p className="text-sm text-rose-600">{errors[question.id]}</p>
            )}
          </div>
        ))}
      </div>
      {showSubmit && (
        <Button
          className="w-full rounded-2xl"
          onClick={handleSubmit}
          disabled={submitting}
        >
          {submitting ? "Odesílám…" : "Odeslat odpovědi"}
        </Button>
      )}
    </Card>
  );
};
