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
import { chartColor } from "@/lib/chart-colors";

type ResultsChartProps = {
  data: { label: string; teacher: number; student: number }[];
};

export const ResultsChart = ({ data }: ResultsChartProps): React.JSX.Element => (
  <Card>
    <div className="mb-4 flex items-center justify-between">
      <div>
        <p className="text-sm text-slate-500">Trend výkonnosti</p>
        <p className="text-lg font-semibold text-slate-900">Přehled výsledků</p>
      </div>
    </div>
    <div className="h-72">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke={chartColor("line")} />
          <XAxis dataKey="label" stroke={chartColor("ink-dim")} />
          <YAxis stroke={chartColor("ink-dim")} />
          <RechartsTooltip
            contentStyle={{
              borderRadius: 16,
              borderColor: chartColor("line"),
            }}
          />
          <Line
            type="monotone"
            dataKey="teacher"
            stroke={chartColor("accent-deep")}
            strokeWidth={3}
            dot={false}
          />
          <Line
            type="monotone"
            dataKey="student"
            stroke={chartColor("xp")}
            strokeWidth={3}
            dot={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  </Card>
);
