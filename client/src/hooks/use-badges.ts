"use client";

import { useEffect, useState } from "react";
import { httpClient } from "@/lib/http/client";

export type MembershipBadge = {
  code: string;
  name: string;
  description: string | null;
  iconKey: string | null;
  awardedAt: string;
};

export const useBadges = (): { badges: MembershipBadge[]; loading: boolean } => {
  const [badges, setBadges] = useState<MembershipBadge[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    setLoading(true);
    httpClient
      .get<MembershipBadge[]>("/gamification/me/badges")
      .then((data) => {
        if (!active) return;
        setBadges(Array.isArray(data) ? data : []);
      })
      .catch(() => {
        if (!active) return;
        setBadges([]);
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  return { badges, loading };
};
