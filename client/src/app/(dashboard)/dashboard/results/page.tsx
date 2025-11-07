"use client";

import { ResultsChart } from "@/components/charts/results-chart";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Download } from "lucide-react";
import { resultInsights, chartSamples } from "@/utils/sample-data";
import { motion } from "framer-motion";

export default function ResultsPage() {
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-semibold text-slate-900">Results</h2>
          <p className="text-sm text-slate-500">
            Analytics synced with NestJS scoring engine, export ready.
          </p>
        </div>
        <Button className="rounded-2xl">
          <Download className="h-4 w-4" />
          Export PDF
        </Button>
      </div>

      <ResultsChart data={chartSamples} />

      <div className="grid gap-4 md:grid-cols-2">
        {resultInsights.map((insight) => (
          <motion.div key={insight.id} whileHover={{ y: -4 }}>
            <Card className="space-y-2">
              <p className="text-sm text-slate-500">{insight.label}</p>
              <p className="text-3xl font-semibold text-slate-900">
                {insight.value}
              </p>
              <p
                className={
                  insight.trend === "up" ? "text-emerald-600" : "text-red-500"
                }
              >
                {insight.trend === "up" ? "+4.2%" : "-1.8%"} last sprint
              </p>
            </Card>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
