"use client";

import { Progress } from "@/components/ui/progress";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { motion } from "framer-motion";

type GamificationPanelProps = {
  xp: number;
  level: number | null;
  nextLevelXp?: number | null;
  achievements?: Array<{ id: string; title: string; iconUrl?: string | null }>;
};

export const GamificationPanel = ({
  xp,
  level,
  nextLevelXp,
  achievements = [],
}: GamificationPanelProps): React.JSX.Element => {
  const progress =
    nextLevelXp && nextLevelXp > 0 ? Math.min((xp / nextLevelXp) * 100, 100) : 100;

  return (
    <Card className="space-y-4 rounded-3xl border border-slate-100 bg-gradient-to-br from-indigo-50 to-white p-6 shadow-soft">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-slate-500">Gamifikace</p>
          <h3 className="text-lg font-semibold text-slate-900">Úroveň {level ?? 1}</h3>
        </div>
        <Badge className="rounded-full bg-indigo-600 text-white">XP {xp}</Badge>
      </div>
      <div>
        <Progress value={progress} className="h-3 rounded-full bg-indigo-100" />
        <p className="mt-2 text-xs text-slate-500">
          {nextLevelXp
            ? `Do další úrovně zbývá ${Math.max(nextLevelXp - xp, 0)} XP (${nextLevelXp})`
            : "Jsi na nejvyšší sledované úrovni"}
        </p>
      </div>
      {achievements.length > 0 && (
        <div>
          <p className="text-xs uppercase tracking-wide text-slate-500">Poslední úspěchy</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {achievements.slice(0, 3).map((achievement) => (
              <motion.span
                key={achievement.id}
                className="inline-flex items-center gap-2 rounded-full bg-white px-3 py-1 text-xs font-medium text-slate-700 shadow-sm"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
              >
                {achievement.iconUrl ? (
                  <img src={achievement.iconUrl} alt={achievement.title} className="h-4 w-4" />
                ) : (
                  <span>🏅</span>
                )}
                {achievement.title}
              </motion.span>
            ))}
          </div>
        </div>
      )}
    </Card>
  );
};
