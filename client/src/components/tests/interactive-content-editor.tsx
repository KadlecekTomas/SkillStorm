"use client";

/*
 * Editor obsahu interaktivních otázek (MATCH_PAIRS / ORDER / SORT_BINS)
 * pro builder sady. Limity zrcadlí server (INTERACTIVE_LIMITS v
 * server/src/shared/interactive-content.util.ts) — hloubková validace
 * probíhá i na serveru, tady jen přátelská zpětná vazba.
 */

import type { JSX } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export type InteractiveType = "MATCH_PAIRS" | "ORDER" | "SORT_BINS";

export const INTERACTIVE_TYPES: InteractiveType[] = [
  "MATCH_PAIRS",
  "ORDER",
  "SORT_BINS",
];

export const INTERACTIVE_TYPE_LABELS: Record<InteractiveType, string> = {
  MATCH_PAIRS: "Přiřazování dvojic (tabule)",
  ORDER: "Řazení do řady (tabule)",
  SORT_BINS: "Třídění do košů (tabule)",
};

export const INTERACTIVE_LIMITS = {
  MATCH_PAIRS: { minPairs: 4, maxPairs: 6 },
  ORDER: { minItems: 4, maxItems: 6 },
  SORT_BINS: { minBins: 2, maxBins: 3, minCards: 6, maxCards: 10 },
} as const;

export function isInteractiveType(value: string): value is InteractiveType {
  return (INTERACTIVE_TYPES as string[]).includes(value);
}

let keyCounter = 0;
const nextKey = () => {
  keyCounter += 1;
  return `k${keyCounter}`;
};

export interface InteractiveDraft {
  pairs: Array<{ key: string; left: string; right: string }>;
  items: Array<{ key: string; text: string }>;
  labels: { start: string; end: string };
  bins: Array<{ key: string; label: string }>;
  cards: Array<{ key: string; text: string; binKey: string }>;
}

export function emptyDraft(type: InteractiveType): InteractiveDraft {
  const draft: InteractiveDraft = {
    pairs: [],
    items: [],
    labels: { start: "", end: "" },
    bins: [],
    cards: [],
  };
  if (type === "MATCH_PAIRS") {
    draft.pairs = Array.from({ length: 4 }, () => ({
      key: nextKey(),
      left: "",
      right: "",
    }));
  } else if (type === "ORDER") {
    draft.items = Array.from({ length: 4 }, () => ({
      key: nextKey(),
      text: "",
    }));
  } else {
    draft.bins = [
      { key: nextKey(), label: "" },
      { key: nextKey(), label: "" },
    ];
    draft.cards = Array.from({ length: 6 }, () => ({
      key: nextKey(),
      text: "",
      binKey: "",
    }));
  }
  return draft;
}

/** Naplnění draftu z uloženého Question.content (editace existující otázky). */
export function draftFromContent(
  type: InteractiveType,
  content: unknown,
): InteractiveDraft {
  const draft = emptyDraft(type);
  if (typeof content !== "object" || content === null) return draft;
  const c = content as Record<string, unknown>;
  if (type === "MATCH_PAIRS" && Array.isArray(c.pairs)) {
    draft.pairs = (
      c.pairs as Array<{ left?: string; right?: string }>
    ).map((p) => ({
      key: nextKey(),
      left: p.left ?? "",
      right: p.right ?? "",
    }));
  }
  if (type === "ORDER") {
    if (Array.isArray(c.items)) {
      draft.items = (c.items as Array<{ text?: string }>).map((i) => ({
        key: nextKey(),
        text: i.text ?? "",
      }));
    }
    const labels = (c.labels ?? {}) as { start?: string; end?: string };
    draft.labels = { start: labels.start ?? "", end: labels.end ?? "" };
  }
  if (type === "SORT_BINS" && Array.isArray(c.bins) && Array.isArray(c.cards)) {
    const binKeyById = new Map<string, string>();
    draft.bins = (c.bins as Array<{ id?: string; label?: string }>).map(
      (b) => {
        const key = nextKey();
        if (b.id) binKeyById.set(b.id, key);
        return { key, label: b.label ?? "" };
      },
    );
    draft.cards = (
      c.cards as Array<{ text?: string; binId?: string }>
    ).map((card) => ({
      key: nextKey(),
      text: card.text ?? "",
      binKey: card.binId ? (binKeyById.get(card.binId) ?? "") : "",
    }));
  }
  return draft;
}

/** Sestaví Question.content z draftu; vrací chybovou hlášku, když nevaliduje. */
export function draftToContent(
  type: InteractiveType,
  draft: InteractiveDraft,
): { content?: object; error?: string } {
  if (type === "MATCH_PAIRS") {
    const { minPairs, maxPairs } = INTERACTIVE_LIMITS.MATCH_PAIRS;
    const pairs = draft.pairs
      .map((p) => ({ left: p.left.trim(), right: p.right.trim() }))
      .filter((p) => p.left || p.right);
    if (pairs.length < minPairs || pairs.length > maxPairs) {
      return { error: `Počet dvojic musí být ${minPairs}–${maxPairs}.` };
    }
    if (pairs.some((p) => !p.left || !p.right)) {
      return { error: "Každá dvojice musí mít vyplněné obě strany." };
    }
    return {
      content: {
        pairs: pairs.map((p, i) => ({ id: `p${i + 1}`, ...p })),
      },
    };
  }

  if (type === "ORDER") {
    const { minItems, maxItems } = INTERACTIVE_LIMITS.ORDER;
    const items = draft.items
      .map((i) => i.text.trim())
      .filter((text) => text.length > 0);
    if (items.length < minItems || items.length > maxItems) {
      return { error: `Počet kartiček musí být ${minItems}–${maxItems}.` };
    }
    const start = draft.labels.start.trim();
    const end = draft.labels.end.trim();
    return {
      content: {
        items: items.map((text, i) => ({ id: `i${i + 1}`, text })),
        ...(start || end
          ? {
              labels: {
                ...(start ? { start } : {}),
                ...(end ? { end } : {}),
              },
            }
          : {}),
      },
    };
  }

  const { minBins, maxBins, minCards, maxCards } = INTERACTIVE_LIMITS.SORT_BINS;
  const bins = draft.bins
    .map((b) => ({ key: b.key, label: b.label.trim() }))
    .filter((b) => b.label.length > 0);
  if (bins.length < minBins || bins.length > maxBins) {
    return { error: `Počet košů musí být ${minBins}–${maxBins}.` };
  }
  const binIdByKey = new Map(bins.map((b, i) => [b.key, `b${i + 1}`] as const));
  const cards = draft.cards
    .map((c) => ({ text: c.text.trim(), binKey: c.binKey }))
    .filter((c) => c.text.length > 0);
  if (cards.length < minCards || cards.length > maxCards) {
    return { error: `Počet kartiček musí být ${minCards}–${maxCards}.` };
  }
  if (cards.some((c) => !binIdByKey.has(c.binKey))) {
    return { error: "Každá kartička musí mít vybraný koš." };
  }
  for (const bin of bins) {
    if (!cards.some((c) => c.binKey === bin.key)) {
      return { error: `Koš „${bin.label}" nemá žádnou kartičku.` };
    }
  }
  return {
    content: {
      bins: bins.map((b) => ({ id: binIdByKey.get(b.key), label: b.label })),
      cards: cards.map((c, i) => ({
        id: `c${i + 1}`,
        text: c.text,
        binId: binIdByKey.get(c.binKey),
      })),
    },
  };
}

export function InteractiveContentEditor({
  type,
  draft,
  onChange,
}: {
  type: InteractiveType;
  draft: InteractiveDraft;
  onChange: (draft: InteractiveDraft) => void;
}): JSX.Element {
  if (type === "MATCH_PAIRS") {
    const { maxPairs } = INTERACTIVE_LIMITS.MATCH_PAIRS;
    return (
      <div className="space-y-2" data-testid="editor-match-pairs">
        <div className="flex items-center justify-between">
          <p className="text-sm font-medium text-slate-700">
            Dvojice (levá strana zůstává, pravá se přiřazuje)
          </p>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={draft.pairs.length >= maxPairs}
            onClick={() =>
              onChange({
                ...draft,
                pairs: [
                  ...draft.pairs,
                  { key: nextKey(), left: "", right: "" },
                ],
              })
            }
          >
            Přidat dvojici
          </Button>
        </div>
        {draft.pairs.map((pair, i) => (
          <div key={pair.key} className="flex items-center gap-2">
            <Input
              value={pair.left}
              placeholder={`Pojem ${i + 1}`}
              onChange={(e) =>
                onChange({
                  ...draft,
                  pairs: draft.pairs.map((p) =>
                    p.key === pair.key ? { ...p, left: e.target.value } : p,
                  ),
                })
              }
            />
            <span className="text-slate-400">↔</span>
            <Input
              value={pair.right}
              placeholder="Přiřazená odpověď"
              onChange={(e) =>
                onChange({
                  ...draft,
                  pairs: draft.pairs.map((p) =>
                    p.key === pair.key ? { ...p, right: e.target.value } : p,
                  ),
                })
              }
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() =>
                onChange({
                  ...draft,
                  pairs: draft.pairs.filter((p) => p.key !== pair.key),
                })
              }
            >
              Smazat
            </Button>
          </div>
        ))}
        <p className="text-xs text-slate-500">
          4–6 dvojic; na tabuli se obě strany zamíchají.
        </p>
      </div>
    );
  }

  if (type === "ORDER") {
    const { maxItems } = INTERACTIVE_LIMITS.ORDER;
    const move = (index: number, delta: -1 | 1) => {
      const target = index + delta;
      if (target < 0 || target >= draft.items.length) return;
      const items = [...draft.items];
      const tmp = items[index]!;
      items[index] = items[target]!;
      items[target] = tmp;
      onChange({ ...draft, items });
    };
    return (
      <div className="space-y-2" data-testid="editor-order">
        <div className="flex items-center justify-between">
          <p className="text-sm font-medium text-slate-700">
            Kartičky ve SPRÁVNÉM pořadí (shora dolů)
          </p>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={draft.items.length >= maxItems}
            onClick={() =>
              onChange({
                ...draft,
                items: [...draft.items, { key: nextKey(), text: "" }],
              })
            }
          >
            Přidat kartičku
          </Button>
        </div>
        {draft.items.map((item, i) => (
          <div key={item.key} className="flex items-center gap-2">
            <span className="w-5 text-sm text-slate-400">{i + 1}.</span>
            <Input
              value={item.text}
              placeholder={`Kartička ${i + 1}`}
              onChange={(e) =>
                onChange({
                  ...draft,
                  items: draft.items.map((it) =>
                    it.key === item.key ? { ...it, text: e.target.value } : it,
                  ),
                })
              }
            />
            <Button type="button" variant="outline" size="sm" onClick={() => move(i, -1)}>
              ↑
            </Button>
            <Button type="button" variant="outline" size="sm" onClick={() => move(i, 1)}>
              ↓
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() =>
                onChange({
                  ...draft,
                  items: draft.items.filter((it) => it.key !== item.key),
                })
              }
            >
              Smazat
            </Button>
          </div>
        ))}
        <div className="grid gap-2 sm:grid-cols-2">
          <label className="space-y-1 text-xs text-slate-600">
            Popisek začátku osy (volitelné)
            <Input
              value={draft.labels.start}
              placeholder="např. nejmenší"
              onChange={(e) =>
                onChange({
                  ...draft,
                  labels: { ...draft.labels, start: e.target.value },
                })
              }
            />
          </label>
          <label className="space-y-1 text-xs text-slate-600">
            Popisek konce osy (volitelné)
            <Input
              value={draft.labels.end}
              placeholder="např. největší"
              onChange={(e) =>
                onChange({
                  ...draft,
                  labels: { ...draft.labels, end: e.target.value },
                })
              }
            />
          </label>
        </div>
        <p className="text-xs text-slate-500">
          4–6 kartiček; na tabuli se zamíchají a děti je řadí zpět.
        </p>
      </div>
    );
  }

  // SORT_BINS
  const { maxBins, maxCards } = INTERACTIVE_LIMITS.SORT_BINS;
  return (
    <div className="space-y-3" data-testid="editor-sort-bins">
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <p className="text-sm font-medium text-slate-700">Koše</p>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={draft.bins.length >= maxBins}
            onClick={() =>
              onChange({
                ...draft,
                bins: [...draft.bins, { key: nextKey(), label: "" }],
              })
            }
          >
            Přidat koš
          </Button>
        </div>
        {draft.bins.map((bin, i) => (
          <div key={bin.key} className="flex items-center gap-2">
            <Input
              value={bin.label}
              placeholder={`Koš ${i + 1}`}
              onChange={(e) =>
                onChange({
                  ...draft,
                  bins: draft.bins.map((b) =>
                    b.key === bin.key ? { ...b, label: e.target.value } : b,
                  ),
                })
              }
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() =>
                onChange({
                  ...draft,
                  bins: draft.bins.filter((b) => b.key !== bin.key),
                  cards: draft.cards.map((c) =>
                    c.binKey === bin.key ? { ...c, binKey: "" } : c,
                  ),
                })
              }
            >
              Smazat
            </Button>
          </div>
        ))}
      </div>
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <p className="text-sm font-medium text-slate-700">
            Kartičky + správný koš
          </p>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={draft.cards.length >= maxCards}
            onClick={() =>
              onChange({
                ...draft,
                cards: [
                  ...draft.cards,
                  { key: nextKey(), text: "", binKey: "" },
                ],
              })
            }
          >
            Přidat kartičku
          </Button>
        </div>
        {draft.cards.map((card, i) => (
          <div key={card.key} className="flex items-center gap-2">
            <Input
              value={card.text}
              placeholder={`Kartička ${i + 1}`}
              onChange={(e) =>
                onChange({
                  ...draft,
                  cards: draft.cards.map((c) =>
                    c.key === card.key ? { ...c, text: e.target.value } : c,
                  ),
                })
              }
            />
            <select
              className="rounded-md border border-slate-200 px-2 py-2 text-sm"
              value={card.binKey}
              onChange={(e) =>
                onChange({
                  ...draft,
                  cards: draft.cards.map((c) =>
                    c.key === card.key ? { ...c, binKey: e.target.value } : c,
                  ),
                })
              }
            >
              <option value="">Vyber koš</option>
              {draft.bins.map((bin, bi) => (
                <option key={bin.key} value={bin.key}>
                  {bin.label.trim() || `Koš ${bi + 1}`}
                </option>
              ))}
            </select>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() =>
                onChange({
                  ...draft,
                  cards: draft.cards.filter((c) => c.key !== card.key),
                })
              }
            >
              Smazat
            </Button>
          </div>
        ))}
      </div>
      <p className="text-xs text-slate-500">
        2–3 koše, 6–10 kartiček; každý koš musí mít aspoň jednu kartičku.
      </p>
    </div>
  );
}
