"use client";

import { useEffect, useState } from "react";
import { httpClient } from "@/lib/http/client";

type GamificationSummary = {
  membershipId: string;
  xp: number;
  level: number | null;
  nextLevelXp?: number | null;
  /** Po sobě jdoucí dny s aktivitou (dnešek bez aktivity sérii neláme). */
  streakDays?: number;
  achievements: Array<{
    id: string;
    title: string;
    description?: string | null;
    iconUrl?: string | null;
    achievedAt: string;
  }>;
  events: Array<{
    id: string;
    type: string;
    value: number;
    description?: string | null;
    createdAt: string;
  }>;
};

export const useGamification = (): { summary: GamificationSummary | null; loading: boolean } => {
  const [summary, setSummary] = useState<GamificationSummary | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    setLoading(true);
    httpClient
      .get<GamificationSummary>("/gamification/summary/me")
      .then((data) => {
        if (!active) return;
        setSummary(data);
      })
      .catch(() => undefined)
      .finally(() => active && setLoading(false));

    return () => {
      active = false;
    };
  }, []);

  return { summary, loading };
};
