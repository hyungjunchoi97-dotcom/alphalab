"use client";

import { useLang } from "@/lib/LangContext";
import { KR_SECTORS } from "./HeatmapTreemap";

interface Mover {
  rank: number;
  name: string;
  nameKr?: string;
  ticker: string;
  price: string;
  changePct: number;
}

// Extract all KR stocks, sorted for gainers/losers
function getMovers(): { gainers: Mover[]; losers: Mover[] } {
  const all = KR_SECTORS.flatMap((s) =>
    s.stocks.map((st) => ({
      name: st.name,
      nameKr: st.nameKr,
      ticker: st.ticker,
      price: st.price || "",
      changePct: st.chg,
    }))
  );

  const sorted = [...all].sort((a, b) => b.changePct - a.changePct);
  const gainers = sorted.slice(0, 5).map((m, i) => ({ ...m, rank: i + 1 }));
  const losers = sorted
    .slice(-5)
    .reverse()
    .map((m, i) => ({ ...m, rank: i + 1 }));

  return { gainers, losers };
}

function MoverTable({
  title,
  data,
  lang,
}: {
  title: string;
  data: Mover[];
  lang: "en" | "kr";
}) {
  return (
    <div>
      <h3 className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-muted">
        {title}
      </h3>
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-card-border text-left text-[10px] uppercase tracking-wider text-muted">
              <th className="w-6 pb-1">#</th>
              <th className="pb-1">{lang === "kr" ? "종목" : "Name"}</th>
              <th className="pb-1 text-right">{lang === "kr" ? "가격" : "Price"}</th>
              <th className="pb-1 text-right">{lang === "kr" ? "등락" : "Chg%"}</th>
            </tr>
          </thead>
          <tbody>
            {data.map((m) => (
              <tr
                key={m.ticker}
                className="border-b border-card-border/30 hover:bg-card-border/20"
              >
                <td className="py-1 font-mono text-muted">{m.rank}</td>
                <td className="py-1">
                  <span>{lang === "kr" && m.nameKr ? m.nameKr : m.name}</span>
                </td>
                <td className="py-1 text-right font-mono tabular-nums">
                  {m.price}
                </td>
                <td
                  className={`py-1 text-right tabular-nums font-medium ${
                    m.changePct >= 0 ? "text-gain" : "text-loss"
                  }`}
                >
                  {m.changePct >= 0 ? "+" : ""}
                  {m.changePct.toFixed(1)}%
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default function KoreaMovers() {
  const { lang } = useLang();
  const { gainers, losers } = getMovers();

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
      <MoverTable
        title={lang === "kr" ? "상승 TOP 5" : "Top 5 Gainers"}
        data={gainers}
        lang={lang}
      />
      <MoverTable
        title={lang === "kr" ? "하락 TOP 5" : "Top 5 Losers"}
        data={losers}
        lang={lang}
      />
    </div>
  );
}
