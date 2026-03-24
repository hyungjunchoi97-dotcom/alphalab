"use client";

import { useEffect, useRef, useState } from "react";
import * as d3 from "d3";

export interface DistrictData {
  code: string;
  name: string;
  avgPrice: number; // 만원
  avgPricePerPyeong?: number; // 만원/평
  count: number;
  change: number | null;
}

interface Props {
  districts: DistrictData[];
  selected: string | null;
  onSelect: (code: string) => void;
}

const NAME_TO_CODE: Record<string, string> = {
  "종로구": "11110", "중구": "11140", "용산구": "11170", "성동구": "11200",
  "광진구": "11215", "동대문구": "11230", "중랑구": "11260", "성북구": "11290",
  "강북구": "11305", "도봉구": "11320", "노원구": "11350", "은평구": "11380",
  "서대문구": "11410", "마포구": "11440", "양천구": "11470", "강서구": "11500",
  "구로구": "11530", "금천구": "11545", "영등포구": "11560", "동작구": "11590",
  "관악구": "11620", "서초구": "11650", "강남구": "11680", "송파구": "11710",
  "강동구": "11740",
};

function getColorByCount(count: number): string {
  if (!count || count <= 0) return "#374151";
  if (count <= 30) return "#14532d";
  if (count <= 60) return "#166534";
  if (count <= 100) return "#16a34a";
  if (count <= 150) return "#4ade80";
  if (count <= 200) return "#facc15";
  if (count <= 300) return "#f97316";
  return "#ef4444";
}

function fmtPrice(manwon: number): string {
  if (!manwon) return "—";
  const ok = manwon / 10000;
  return ok >= 1 ? `${ok.toFixed(1)}억` : `${manwon.toLocaleString()}만`;
}

interface HoverInfo {
  name: string;
  avgPrice: number;
  count: number;
  change: number | null;
  x: number;
  y: number;
}

const LEGEND = [
  { color: "#ef4444", label: "300건+" },
  { color: "#f97316", label: "201~300건" },
  { color: "#facc15", label: "151~200건" },
  { color: "#4ade80", label: "101~150건" },
  { color: "#16a34a", label: "61~100건" },
  { color: "#166534", label: "31~60건" },
  { color: "#14532d", label: "~30건" },
  { color: "#374151", label: "데이터없음" },
];

export default function SeoulMap({ districts, selected, onSelect }: Props) {
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [hover, setHover] = useState<HoverInfo | null>(null);

  useEffect(() => {
    const svg = svgRef.current;
    const container = containerRef.current;
    if (!svg || !container) return;

    const W = container.clientWidth || 700;
    const H = container.clientHeight || 600;

    const root = d3.select(svg);
    root.selectAll("*").remove();
    root.attr("viewBox", `0 0 ${W} ${H}`).attr("preserveAspectRatio", "xMidYMid meet");

    const g = root.append("g");
    const byName = new Map(districts.map(d => [d.name, d]));

    fetch("/maps/seoul.json")
      .then(r => r.json())
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .then((geo: any) => {
        const features = geo.features;

        const projection = d3.geoMercator()
          .fitExtent([[20, 20], [W - 20, H - 20]], { type: "FeatureCollection", features });
        const pathGen = d3.geoPath().projection(projection);

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const getFill = (f: any) => {
          const name: string = f.properties?.name ?? "";
          const code = NAME_TO_CODE[name];
          const dist = byName.get(name);
          return code === selected ? "#2a1f05" : getColorByCount(dist?.count ?? 0);
        };
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const getStroke = (f: any) => NAME_TO_CODE[f.properties?.name ?? ""] === selected ? "#f59e0b" : "#2e2e2e";
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const getStrokeW = (f: any) => NAME_TO_CODE[f.properties?.name ?? ""] === selected ? 2 : 0.5;

        g.selectAll<SVGPathElement, unknown>("path.d")
          .data(features)
          .join("path")
          .attr("class", "d")
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          .attr("d", (f: any) => pathGen(f) ?? "")
          .attr("fill", getFill)
          .attr("stroke", getStroke)
          .attr("stroke-width", getStrokeW)
          .style("cursor", "pointer")
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          .on("mouseover", function(event: MouseEvent, f: any) {
            const name: string = f.properties?.name ?? "";
            const code = NAME_TO_CODE[name];
            if (code !== selected) {
              d3.select(this).attr("stroke", "#666").attr("stroke-width", 1.2);
            }
            const rect = container.getBoundingClientRect();
            const dist = byName.get(name);
            setHover({
              name,
              avgPrice: dist?.avgPrice ?? 0,
              count: dist?.count ?? 0,
              change: dist?.change ?? null,
              x: event.clientX - rect.left,
              y: event.clientY - rect.top,
            });
          })
          .on("mousemove", function(event: MouseEvent) {
            const rect = container.getBoundingClientRect();
            setHover(prev => prev ? { ...prev, x: event.clientX - rect.left, y: event.clientY - rect.top } : null);
          })
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          .on("mouseout", function(_e: MouseEvent, f: any) {
            const name: string = f.properties?.name ?? "";
            const code = NAME_TO_CODE[name];
            const dist = byName.get(name);
            d3.select(this)
              .attr("fill", code === selected ? "#2a1f05" : getColorByCount(dist?.count ?? 0))
              .attr("stroke", code === selected ? "#f59e0b" : "#2e2e2e")
              .attr("stroke-width", code === selected ? 2 : 0.5);
            setHover(null);
          })
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          .on("click", (_e: MouseEvent, f: any) => {
            const code = NAME_TO_CODE[f.properties?.name ?? ""];
            if (code) onSelect(code);
          });

        // Labels
        g.selectAll<SVGTextElement, unknown>("text.lbl")
          .data(features)
          .join("text")
          .attr("class", "lbl")
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          .attr("transform", (f: any) => {
            const [cx, cy] = pathGen.centroid(f);
            return `translate(${cx},${cy})`;
          })
          .attr("text-anchor", "middle")
          .attr("dominant-baseline", "middle")
          .attr("pointer-events", "none")
          .attr("fill", "#ffffff")
          .attr("font-size", "9px")
          .attr("font-family", "'IBM Plex Mono', monospace")
          .attr("font-weight", "600")
          .attr("letter-spacing", "0.4px")
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          .text((f: any) => {
            const name: string = f.properties?.name ?? "";
            const dist = byName.get(name);
            const short = name.replace("구", "");
            return dist?.count ? `${short} ${dist.count}건` : short;
          });
      });
  }, [districts, selected, onSelect]);

  return (
    <div ref={containerRef} style={{ position: "relative", width: "100%", height: "100%" }}>
      <svg
        ref={svgRef}
        preserveAspectRatio="xMidYMid meet"
        style={{ width: "100%", height: "100%", display: "block", background: "#0a0a0a" }}
      />

      {/* Tooltip */}
      {hover && (
        <div style={{
          position: "absolute",
          left: hover.x + 12,
          top: Math.max(4, hover.y - 8),
          background: "#111",
          border: "1px solid #2e2e2e",
          padding: "8px 12px",
          fontFamily: "'IBM Plex Mono', monospace",
          fontSize: 11,
          color: "#e0e0e0",
          pointerEvents: "none",
          zIndex: 100,
          whiteSpace: "nowrap",
        }}>
          <div style={{ fontWeight: 700, marginBottom: 4 }}>{hover.name}</div>
          {hover.avgPrice > 0 ? (
            <>
              <div style={{ color: "#f59e0b", fontSize: 15, fontWeight: 800, marginBottom: 2 }}>
                {fmtPrice(hover.avgPrice)}
              </div>
              <div style={{ color: "#444", fontSize: 10 }}>거래 {hover.count}건</div>
              {hover.change != null && (
                <div style={{ color: hover.change >= 0 ? "#22c55e" : "#ef4444", fontSize: 10, marginTop: 2 }}>
                  전월비 {hover.change >= 0 ? "+" : ""}{hover.change}%
                </div>
              )}
            </>
          ) : (
            <div style={{ color: "#333", fontSize: 10 }}>데이터 없음</div>
          )}
        </div>
      )}

      {/* Legend */}
      <div style={{ position: "absolute", bottom: 8, left: 8, display: "flex", flexDirection: "column", gap: 3 }}>
        {LEGEND.map(({ color, label }) => (
          <div key={label} style={{ display: "flex", alignItems: "center", gap: 5 }}>
            <div style={{ width: 8, height: 8, background: color, border: "1px solid #2a2a2a" }} />
            <span style={{ fontSize: 12, color: "#ffffff", fontFamily: "monospace", fontWeight: 500 }}>{label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
