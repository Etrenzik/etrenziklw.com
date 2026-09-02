"use client";

import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { ConfidenceBucketStat } from "@/lib/types";

export function CalibrationChart({ buckets }: { buckets: ConfidenceBucketStat[] }) {
  const data = buckets
    .filter((b) => b.n > 0)
    .map((b) => ({
      predicted: Math.round(b.avgPredictedProb),
      actual: Math.round(b.actualWinRate * 100),
      n: b.n,
      bucket: b.bucket,
    }))
    .sort((a, b) => a.predicted - b.predicted);

  return (
    <div className="h-72 w-full">
      <ResponsiveContainer>
        <LineChart data={data} margin={{ top: 8, right: 16, bottom: 8, left: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
          <XAxis
            dataKey="predicted"
            type="number"
            domain={[50, 100]}
            stroke="#a1a1aa"
            fontSize={12}
            label={{ value: "Predicted win probability (%)", position: "insideBottom", offset: -4, fill: "#a1a1aa", fontSize: 12 }}
          />
          <YAxis
            domain={[0, 100]}
            stroke="#a1a1aa"
            fontSize={12}
            label={{ value: "Actual win rate (%)", angle: -90, position: "insideLeft", fill: "#a1a1aa", fontSize: 12 }}
          />
          <Tooltip
            contentStyle={{ background: "#18181b", border: "1px solid #3f3f46", fontSize: 12 }}
            formatter={(value, name) => [`${value}%`, name]}
            labelFormatter={(label) => `Predicted ${label}%`}
          />
          <Legend wrapperStyle={{ fontSize: 12 }} />
          <Line
            type="monotone"
            dataKey="predicted"
            name="Perfect calibration"
            stroke="#52525b"
            strokeDasharray="4 4"
            dot={false}
          />
          <Line
            type="monotone"
            dataKey="actual"
            name="Actual"
            stroke="#22c55e"
            strokeWidth={2}
            dot={{ r: 4 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
