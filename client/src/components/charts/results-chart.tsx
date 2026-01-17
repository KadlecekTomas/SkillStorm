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

type ResultsChartProps = {
  data: { label: string; teacher: number; student: number }[];
};

export const ResultsChart = ({ data }: ResultsChartProps): React.JSX.Element => (
  <Card>
    <div className="mb-4 flex items-center justify-between">
      <div>
        <p className="text-sm text-slate-500">Performance trend</p>
        <p className="text-lg font-semibold text-slate-900">Results overview</p>
      </div>
    </div>
    <div className="h-72">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
          <XAxis dataKey="label" stroke="#94a3b8" />
          <YAxis stroke="#94a3b8" />
          <RechartsTooltip
            contentStyle={{
              borderRadius: 16,
              borderColor: "#E5E7EB",
            }}
          />
          <Line
            type="monotone"
            dataKey="teacher"
            stroke="#16A34A"
            strokeWidth={3}
            dot={false}
          />
          <Line
            type="monotone"
            dataKey="student"
            stroke="#0ea5e9"
            strokeWidth={3}
            dot={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  </Card>
);
