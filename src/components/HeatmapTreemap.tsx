"use client";

import { useState } from "react";
import { ResponsiveContainer, Treemap } from "recharts";

interface HeatmapItem {
  ticker: string;
  name: string;
  weight: number;
  changePct: number;
}

const MOCK_KR: HeatmapItem[] = [
  { ticker: "005930", name: "Samsung", weight: 25, changePct: 1.2 },
  { ticker: "000660", name: "SK Hynix", weight: 15, changePct: -0.8 },
  { ticker: "373220", name: "LG Energy", weight: 10, changePct: 2.1 },
  { ticker: "035420", name: "Naver", weight: 8, changePct: -1.5 },
  { ticker: "051910", name: "LG Chem", weight: 7, changePct: 0.3 },
  { ticker: "006400", name: "Samsung SDI", weight: 6, changePct: -2.0 },
  { ticker: "035720", name: "Kakao", weight: 5, changePct: 0.9 },
  { ticker: "068270", name: "Celltrion", weight: 5, changePct: 1.8 },
];

const MOCK_US: HeatmapItem[] = [
  { ticker: "AAPL", name: "Apple", weight: 20, changePct: 0.8 },
  { ticker: "MSFT", name: "Microsoft", weight: 18, changePct: 1.5 },
  { ticker: "NVDA", name: "NVIDIA", weight: 15, changePct: 3.2 },
  { ticker: "GOOGL", name: "Alphabet", weight: 12, changePct: -0.3 },
  { ticker: "AMZN", name: "Amazon", weight: 10, changePct: -1.1 },
  { ticker: "META", name: "Meta", weight: 8, changePct: 2.0 },
  { ticker: "TSLA", name: "Tesla", weight: 7, changePct: -2.5 },
  { ticker: "BRK.B", name: "Berkshire", weight: 5, changePct: 0.4 },
];

const MOCK_JP: HeatmapItem[] = [
  { ticker: "7203", name: "Toyota", weight: 20, changePct: 0.5 },
  { ticker: "6758", name: "Sony", weight: 15, changePct: 1.2 },
  { ticker: "6861", name: "Keyence", weight: 10, changePct: -0.7 },
  { ticker: "8306", name: "MUFG", weight: 8, changePct: 0.3 },
  { ticker: "6098", name: "Recruit", weight: 7, changePct: -1.8 },
  { ticker: "9984", name: "SoftBank", weight: 7, changePct: 2.4 },
  { ticker: "6501", name: "Hitachi", weight: 6, changePct: 0.9 },
  { ticker: "7741", name: "HOYA", weight: 5, changePct: -0.2 },
];

type Market = "KR" | "US" | "JP";

const MARKET_DATA: Record<Market, HeatmapItem[]> = {
  KR: MOCK_KR,
  US: MOCK_US,
  JP: MOCK_JP,
};

/* eslint-disable @typescript-eslint/no-explicit-any */
function CustomContent(props: any) {
  const { x, y, width, height, depth, name, ticker, changePct } = props;

  if (depth === 0) return <g />;

  const pct = changePct as number;
  const alpha = Math.min(0.25 + Math.abs(pct) * 0.12, 0.85);
  const fill =
    pct >= 0 ? `rgba(34, 197, 94, ${alpha})` : `rgba(239, 68, 68, ${alpha})`;

  const showText = width > 45 && height > 28;

  return (
    <g>
      <rect
        x={x}
        y={y}
        width={width}
        height={height}
        fill={fill}
        stroke="#0b0f14"
        strokeWidth={1}
        rx={2}
      />
      {showText && (
        <>
          <text
            x={x + width / 2}
            y={y + height / 2 - 10}
            textAnchor="middle"
            fill="#fff"
            fontSize={10}
            fontWeight={600}
            fontFamily="ui-monospace, monospace"
          >
            {name}
          </text>
          <text
            x={x + width / 2}
            y={y + height / 2 + 2}
            textAnchor="middle"
            fill="rgba(255,255,255,0.7)"
            fontSize={9}
            fontWeight={500}
            fontFamily="ui-monospace, monospace"
          >
            {ticker}
          </text>
          <text
            x={x + width / 2}
            y={y + height / 2 + 14}
            textAnchor="middle"
            fill="rgba(255,255,255,0.85)"
            fontSize={9}
            fontWeight={500}
            fontFamily="ui-monospace, monospace"
          >
            {pct >= 0 ? "+" : ""}
            {pct.toFixed(1)}%
          </text>
        </>
      )}
      {/* Invisible rect for tooltip hover area */}
      <title>
        {name} ({ticker}) {pct >= 0 ? "+" : ""}
        {pct.toFixed(2)}%
      </title>
    </g>
  );
}
/* eslint-enable @typescript-eslint/no-explicit-any */

export default function HeatmapTreemap() {
  const [activeMarket, setActiveMarket] = useState<Market>("KR");

  const items = MARKET_DATA[activeMarket];
  const treemapData = items.map((item) => ({
    name: item.name,
    value: item.weight,
    ticker: item.ticker,
    changePct: item.changePct,
  }));

  return (
    <div>
      <div className="mb-3 inline-flex gap-px rounded bg-card-border p-px">
        {(["KR", "US", "JP"] as const).map((m) => (
          <button
            key={m}
            onClick={() => setActiveMarket(m)}
            className={`px-3 py-1 text-xs font-medium transition-colors ${
              activeMarket === m
                ? "bg-accent text-white"
                : "bg-card-bg text-muted hover:text-foreground"
            }`}
          >
            {m}
          </button>
        ))}
      </div>
      <ResponsiveContainer width="100%" height={300}>
        <Treemap
          data={treemapData}
          dataKey="value"
          content={<CustomContent />}
          isAnimationActive={false}
        />
      </ResponsiveContainer>
      <div className="mt-2 flex items-center gap-3 text-[10px] text-muted">
        <span className="flex items-center gap-1">
          <span className="inline-block h-2 w-3 rounded-sm bg-gain/60" />
          Up
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block h-2 w-3 rounded-sm bg-loss/60" />
          Down
        </span>
        <span className="ml-auto">Hover for details</span>
      </div>
    </div>
  );
}
