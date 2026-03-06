"use client";

interface TickerItem {
  type: "NEWS" | "INDEX" | "FX" | "COM";
  label: string;
  value?: string;
  changePct?: number;
  href?: string;
}

const TYPE_COLORS: Record<TickerItem["type"], string> = {
  NEWS: "text-accent",
  INDEX: "text-foreground",
  FX: "text-foreground",
  COM: "text-foreground",
};

const DEFAULT_ITEMS: TickerItem[] = [
  { type: "INDEX", label: "KOSPI", value: "2,687.45", changePct: 0.82 },
  { type: "INDEX", label: "KOSDAQ", value: "868.12", changePct: -0.35 },
  { type: "INDEX", label: "S&P 500", value: "5,954.50", changePct: 1.26 },
  { type: "INDEX", label: "NASDAQ", value: "19,211.10", changePct: 1.58 },
  { type: "FX", label: "USD/KRW", value: "1,378.50", changePct: -0.12 },
  { type: "COM", label: "Gold", value: "2,918.40", changePct: 0.45 },
  { type: "COM", label: "WTI Oil", value: "69.32", changePct: -1.87 },
  { type: "NEWS", label: "NVIDIA beats Q4 estimates on record data center demand" },
  { type: "NEWS", label: "Samsung unveils HBM4 roadmap at investor day" },
  { type: "NEWS", label: "Fed signals potential rate cut in June FOMC meeting" },
  { type: "NEWS", label: "Toyota accelerates solid-state battery timeline to 2027" },
  { type: "NEWS", label: "Microsoft Azure AI revenue surges 40% YoY in cloud push" },
];

function TickerEntry({ item }: { item: TickerItem }) {
  const inner = (
    <span className="inline-flex items-center gap-1.5">
      <span
        className={`rounded px-1 py-px text-[9px] font-semibold uppercase ${
          item.type === "NEWS"
            ? "bg-accent/15 text-accent"
            : "bg-card-border/60 text-muted"
        }`}
      >
        {item.type}
      </span>
      <span className={`text-[11px] ${TYPE_COLORS[item.type]}`}>
        {item.label}
      </span>
      {item.value != null && (
        <span className="text-[11px] tabular-nums text-foreground">
          {item.value}
        </span>
      )}
      {item.changePct != null && (
        <span
          className={`text-[11px] tabular-nums font-medium ${
            item.changePct >= 0 ? "text-gain" : "text-loss"
          }`}
        >
          {item.changePct >= 0 ? "+" : ""}
          {item.changePct.toFixed(2)}%
        </span>
      )}
    </span>
  );

  if (item.href) {
    return (
      <a href={item.href} className="hover:underline">
        {inner}
      </a>
    );
  }
  return inner;
}

export default function TopTickerBar({ items = DEFAULT_ITEMS }: { items?: TickerItem[] }) {
  return (
    <div className="group relative overflow-hidden border-b border-card-border/60 bg-background">
      <div className="ticker-scroll flex w-max items-center gap-6 whitespace-nowrap px-4 py-1.5 group-hover:[animation-play-state:paused]">
        {/* Duplicate items for seamless loop */}
        {[...items, ...items].map((item, i) => (
          <TickerEntry key={i} item={item} />
        ))}
      </div>
    </div>
  );
}
