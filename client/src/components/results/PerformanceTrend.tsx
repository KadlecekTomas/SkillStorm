"use client";

import {
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip as RechartsTooltip,
  XAxis,
  YAxis,
  CartesianGrid,
} from "recharts";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cn } from "@/utils/cn";

export type TrendDataPoint = {
  date: string;
  averagePercent: number;
};

export type PeriodOption = "7d" | "30d" | "year";

type PerformanceTrendProps = {
  data: TrendDataPoint[];
  period: PeriodOption;
  onPeriodChange: (period: PeriodOption) => void;
};

const PERIODS: { key: PeriodOption; label: string }[] = [
  { key: "7d", label: "7 dní" },
  { key: "30d", label: "30 dní" },
  { key: "year", label: "Celý rok" },
];

export function PerformanceTrend({
  data,
  period,
  onPeriodChange,
}: PerformanceTrendProps): React.JSX.Element {
  return (
    <section aria-label="Trend výkonnosti">
      <Card className="rounded-2xl border border-slate-100 p-4 shadow-sm">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h3 className="text-sm font-semibold text-slate-700">Trend průměrné úspěšnosti třídy</h3>
          <div className="flex gap-1 rounded-xl border border-slate-200 p-1">
            {PERIODS.map((p) => (
              <Button
                key={p.key}
                variant={period === p.key ? "default" : "ghost"}
                size="sm"
                className={cn(
                  "rounded-lg",
                  period === p.key && "bg-emerald-600 text-white hover:bg-emerald-700",
                )}
                onClick={() => onPeriodChange(p.key)}
              >
                {p.label}
              </Button>
            ))}
          </div>
        </div>
        <div className="h-72">
          {data.length ? (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                <XAxis dataKey="date" stroke="#94a3b8" fontSize={12} />
                <YAxis
                  stroke="#94a3b8"
                  fontSize={12}
                  domain={[0, 100]}
                  tickFormatter={(v) => `${v}%`}
                />
                <RechartsTooltip
                  contentStyle={{ borderRadius: 12, borderColor: "#E5E7EB" }}
                  formatter={(value: number) => [`${Math.round(value)} %`, "Průměr"]}
                  labelFormatter={(label) => `Datum: ${label}`}
                />
                <Line
                  type="monotone"
                  dataKey="averagePercent"
                  name="Průměr"
                  stroke="#16A34A"
                  strokeWidth={2}
                  dot={{ fill: "#16A34A", r: 3 }}
                  activeDot={{ r: 5 }}
                />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex h-full items-center justify-center text-sm text-slate-500">
              Pro zvolené období nejsou data.
            </div>
          )}
        </div>
      </Card>
    </section>
  );
}
