/**
 * Snapshoty interaktivních kol (MATCH_PAIRS / ORDER / SORT_BINS).
 *
 * Při startu bleskovky se autorský obsah otázky (Question.content) překlopí
 * do dvou částí:
 * - contentSnapshot — board-safe: zamíchané položky s ROUND-LOCAL ID (l1/r1/
 *   o1/c1… podle pozice po zamíchání). Autorská ID se sem záměrně nedostanou,
 *   aby network tab na projekci neprozradil řešení (např. seedová ID "i1".."i5"
 *   seřazená podle správného pořadí).
 * - solutionSnapshot — mapování řešení nad round-local ID; NIKDY neopouští
 *   server před dokončením/revealem kola (kontrakt correctKeySnapshot platí dál).
 */
import { QuestionType } from '@prisma/client';
import {
  InteractiveQuestionType,
  MatchPairsContent,
  OrderContent,
  SortBinsContent,
  validateInteractiveContent,
} from '@/shared/interactive-content.util';

export interface BoardCard {
  id: string;
  text: string;
}

export type InteractiveBoardContent =
  | { kind: 'MATCH_PAIRS'; left: BoardCard[]; right: BoardCard[] }
  | {
      kind: 'ORDER';
      items: BoardCard[];
      labels?: { start?: string; end?: string };
    }
  | {
      kind: 'SORT_BINS';
      bins: { id: string; label: string }[];
      cards: BoardCard[];
    };

export type InteractiveSolution =
  | { pairs: Record<string, string> } // leftId → rightId
  | { order: string[] } // item ids ve správném pořadí
  | { assignment: Record<string, string> }; // cardId → binId

export interface InteractiveRoundSnapshot {
  content: InteractiveBoardContent;
  solution: InteractiveSolution;
  /** Počet položek k umístění — jmenovatel prahů auto-outcome. */
  itemCount: number;
}

function shuffle<T>(items: T[]): T[] {
  const arr = [...items];
  for (let i = arr.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    const tmp = arr[i] as T;
    arr[i] = arr[j] as T;
    arr[j] = tmp;
  }
  return arr;
}

/** Vrátí null u nevalidního obsahu — otázka se z bleskovky tiše vynechá
 *  (publish gate ji ale normálně vůbec nepustí). */
export function buildInteractiveSnapshot(
  type: InteractiveQuestionType,
  rawContent: unknown,
): InteractiveRoundSnapshot | null {
  if (validateInteractiveContent(type, rawContent).length > 0) return null;

  if (type === QuestionType.MATCH_PAIRS) {
    const { pairs } = rawContent as MatchPairsContent;
    const leftOrder = shuffle(pairs);
    const rightOrder = shuffle(pairs);
    const rightIdByPair = new Map(
      rightOrder.map((p, i) => [p.id, `r${i + 1}`] as const),
    );
    const solutionPairs: Record<string, string> = {};
    const left = leftOrder.map((p, i) => {
      const leftId = `l${i + 1}`;
      solutionPairs[leftId] = rightIdByPair.get(p.id) as string;
      return { id: leftId, text: p.left };
    });
    const right = rightOrder.map((p, i) => ({
      id: `r${i + 1}`,
      text: p.right,
    }));
    return {
      content: { kind: 'MATCH_PAIRS', left, right },
      solution: { pairs: solutionPairs },
      itemCount: pairs.length,
    };
  }

  if (type === QuestionType.ORDER) {
    const { items, labels } = rawContent as OrderContent;
    let display = shuffle(items);
    // Zamíchání nesmí náhodou trefit správné pořadí — jinak by kolo
    // skončilo prvním Zkontrolovat bez jediného tahu.
    if (display.every((item, i) => item.id === items[i]?.id)) {
      display = [...display.slice(1), display[0] as OrderContent['items'][0]];
    }
    const roundIdByAuthorId = new Map(
      display.map((item, i) => [item.id, `o${i + 1}`] as const),
    );
    return {
      content: {
        kind: 'ORDER',
        items: display.map((item, i) => ({ id: `o${i + 1}`, text: item.text })),
        ...(labels ? { labels } : {}),
      },
      solution: {
        order: items.map((item) => roundIdByAuthorId.get(item.id) as string),
      },
      itemCount: items.length,
    };
  }

  // SORT_BINS
  const { bins, cards } = rawContent as SortBinsContent;
  const binIdByAuthorId = new Map(
    bins.map((b, i) => [b.id, `b${i + 1}`] as const),
  );
  const displayCards = shuffle(cards);
  const assignment: Record<string, string> = {};
  const boardCards = displayCards.map((c, i) => {
    const cardId = `c${i + 1}`;
    assignment[cardId] = binIdByAuthorId.get(c.binId) as string;
    return { id: cardId, text: c.text };
  });
  return {
    content: {
      kind: 'SORT_BINS',
      bins: bins.map((b, i) => ({ id: `b${i + 1}`, label: b.label })),
      cards: boardCards,
    },
    solution: { assignment },
    itemCount: cards.length,
  };
}

/** Cíle, na které lze v daném kole položit kartičku (validace attemptů). */
export function validTargetIds(content: InteractiveBoardContent): Set<string> {
  if (content.kind === 'MATCH_PAIRS') {
    return new Set(content.right.map((c) => c.id));
  }
  if (content.kind === 'SORT_BINS') {
    return new Set(content.bins.map((b) => b.id));
  }
  return new Set();
}

/** Položky (kartičky), které se v kole umisťují. */
export function validItemIds(content: InteractiveBoardContent): Set<string> {
  if (content.kind === 'MATCH_PAIRS') {
    return new Set(content.left.map((c) => c.id));
  }
  if (content.kind === 'SORT_BINS') {
    return new Set(content.cards.map((c) => c.id));
  }
  return new Set(content.items.map((c) => c.id));
}
