"use client";

import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { geoMercator, geoPath } from "d3-geo";

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

const LEGEND_ITEMS = [
  { color: "#1a1a1a", label: "데이터 없음" },
  { color: "#153025", label: "~2,000만" },
  { color: "#1e4a28", label: "2,000~3,000만" },
  { color: "#4a4012", label: "3,000~4,000만" },
  { color: "#5a2e0c", label: "4,000~5,000만" },
  { color: "#6a1010", label: "5,000만+" },
];

function priceColor(avgPricePerPyeong: number): string {
  if (avgPricePerPyeong <= 0) return "#1a1a1a";
  if (avgPricePerPyeong < 2000) return "#153025";
  if (avgPricePerPyeong < 3000) return "#1e4a28";
  if (avgPricePerPyeong < 4000) return "#4a4012";
  if (avgPricePerPyeong < 5000) return "#5a2e0c";
  return "#6a1010";
}

function fmtPrice(manwon: number): string {
  if (!manwon) return "—";
  const ok = manwon / 10000;
  if (ok >= 1) return `${ok.toFixed(1)}억`;
  return `${manwon.toLocaleString()}만`;
}

function fmtPyeong(manwon: number): string {
  if (!manwon) return "—";
  if (manwon >= 10000) return `${(manwon / 10000).toFixed(1)}억/평`;
  return `${manwon.toLocaleString()}만/평`;
}

// Han River in geographic coordinates
const HANGANG_FEATURE = {
  type: "Feature",
  properties: {},
  geometry: {
    type: "Polygon",
    coordinates: [[
      [127.13, 37.537], [127.10, 37.530], [127.06, 37.525],
      [127.02, 37.526], [126.97, 37.530], [126.93, 37.535],
      [126.90, 37.538], [126.86, 37.542],
      [126.86, 37.528], [126.90, 37.525], [126.93, 37.522],
      [126.97, 37.518], [127.02, 37.515], [127.06, 37.513],
      [127.10, 37.517], [127.13, 37.522],
      [127.13, 37.537],
    ]],
  },
};

// SVG viewport
const W = 800;
const H = 600;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type GeoFeature = { type: string; properties: Record<string, any>; geometry: any };
type GeoCollection = { type: string; features: GeoFeature[] };

interface TooltipState {
  name: string;
  avgPrice: number;
  avgPricePerPyeong: number;
  count: number;
  change: number | null;
  x: number;
  y: number;
}

export default function SeoulMap({ districts, selected, onSelect }: Props) {
  const [seoulGeo, setSeoulGeo] = useState<GeoCollection | null>(null);
  const [koreaGeo, setKoreaGeo] = useState<GeoCollection | null>(null);
  const [tooltip, setTooltip] = useState<TooltipState | null>(null);
  const [transform, setTransform] = useState({ k: 1, x: 0, y: 0 });

  const svgRef = useRef<SVGSVGElement>(null);
  const transformRef = useRef({ k: 1, x: 0, y: 0 });
  const dragRef = useRef({ active: false, startX: 0, startY: 0, startTx: 0, startTy: 0 });

  // Keep transformRef in sync
  useEffect(() => { transformRef.current = transform; }, [transform]);

  const districtMap = useMemo(() => new Map(districts.map(d => [d.code, d])), [districts]);

  // Projection: d3 geoMercator, no react-simple-maps
  const projection = useMemo(() =>
    geoMercator()
      .center([127.0, 37.55])
      .scale(65000)
      .translate([W / 2, H / 2]),
    []
  );
  const pathGen = useMemo(() => geoPath().projection(projection), [projection]);

  // Projected label positions (geographic → SVG pixel)
  const labelPositions = useMemo(() => {
    const proj = (lon: number, lat: number) => projection([lon, lat]) ?? [0, 0];
    return {
      seoul: proj(126.975, 37.570),
      gyeonggi: proj(127.25, 37.80),
      incheon: proj(126.62, 37.47),
      hangang: proj(126.965, 37.524),
    };
  }, [projection]);

  const hangangPath = useMemo(() => pathGen(HANGANG_FEATURE as Parameters<typeof pathGen>[0]) ?? "", [pathGen]);

  // Load GeoJSON
  useEffect(() => {
    fetch("/maps/seoul.json").then(r => r.json()).then(setSeoulGeo).catch(() => {});
    fetch("/maps/korea.json").then(r => r.json()).then(setKoreaGeo).catch(() => {});
  }, []);

  // Wheel zoom (passive: false to allow preventDefault)
  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const factor = e.deltaY > 0 ? 0.8 : 1.25;
      setTransform(prev => {
        const newK = Math.max(1, Math.min(8, prev.k * factor));
        const rect = svg.getBoundingClientRect();
        const mx = (e.clientX - rect.left) / rect.width * W;
        const my = (e.clientY - rect.top) / rect.height * H;
        return {
          k: newK,
          x: mx - (mx - prev.x) * (newK / prev.k),
          y: my - (my - prev.y) * (newK / prev.k),
        };
      });
    };
    svg.addEventListener("wheel", onWheel, { passive: false });
    return () => svg.removeEventListener("wheel", onWheel);
  }, []);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    dragRef.current = {
      active: true,
      startX: e.clientX,
      startY: e.clientY,
      startTx: transformRef.current.x,
      startTy: transformRef.current.y,
    };
  }, []);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!dragRef.current.active) return;
    setTransform(prev => ({
      ...prev,
      x: dragRef.current.startTx + (e.clientX - dragRef.current.startX),
      y: dragRef.current.startTy + (e.clientY - dragRef.current.startY),
    }));
  }, []);

  const handleMouseUp = useCallback(() => { dragRef.current.active = false; }, []);

  // Korea background paths (경기/인천)
  const koreaPaths = useMemo(() => {
    if (!koreaGeo) return [];
    return koreaGeo.features
      .filter(f => {
        const code = String(f.properties?.code ?? "");
        return code.startsWith("23") || code.startsWith("31");
      })
      .map(f => {
        const centroid = pathGen.centroid(f as Parameters<typeof pathGen.centroid>[0]);
        return {
          key: String(f.properties?.code ?? Math.random()),
          d: pathGen(f as Parameters<typeof pathGen>[0]) ?? "",
          name: String(f.properties?.name ?? ""),
          isIncheon: String(f.properties?.code ?? "").startsWith("23"),
          cx: isNaN(centroid[0]) ? -999 : centroid[0],
          cy: isNaN(centroid[1]) ? -999 : centroid[1],
        };
      });
  }, [koreaGeo, pathGen]);

  // Seoul district paths
  const seoulPaths = useMemo(() => {
    if (!seoulGeo) return [];
    return seoulGeo.features.map(f => {
      const geoName: string = String(f.properties?.name ?? "");
      const code = NAME_TO_CODE[geoName];
      const data = code ? districtMap.get(code) : undefined;
      const isSelected = selected === code;
      const fillColor = data ? priceColor(data.avgPricePerPyeong ?? 0) : "#1a1a1a";
      const shortName = geoName.replace("구", "");
      const centroid = pathGen.centroid(f as Parameters<typeof pathGen.centroid>[0]);
      return {
        key: String(f.properties?.code ?? geoName),
        d: pathGen(f as Parameters<typeof pathGen>[0]) ?? "",
        cx: isNaN(centroid[0]) ? -999 : centroid[0],
        cy: isNaN(centroid[1]) ? -999 : centroid[1],
        geoName,
        code,
        data,
        isSelected,
        fillColor,
        shortName,
      };
    });
  }, [seoulGeo, pathGen, districtMap, selected]);

  const k = transform.k;

  return (
    <div className="relative w-full" style={{ aspectRatio: "4 / 3", background: "#0f0f0f" }}>
      {/* Legend */}
      <div className="absolute top-2 left-2 z-10 space-y-0.5">
        {LEGEND_ITEMS.map(item => (
          <div key={item.label} className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-sm" style={{ background: item.color }} />
            <span className="text-xs font-mono" style={{ color: "#888888" }}>{item.label}</span>
          </div>
        ))}
      </div>

      <svg
        ref={svgRef}
        viewBox={`0 0 ${W} ${H}`}
        style={{ width: "100%", height: "100%", background: "#0f0f0f", display: "block" }}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
      >
        {/* Explicit background rect — no projection artifact */}
        <rect width={W} height={H} fill="#0f0f0f" />

        <g transform={`translate(${transform.x},${transform.y}) scale(${k})`}>
          {/* 경기/인천 background */}
          {koreaPaths.map(p => (
            <g key={p.key}>
              <path d={p.d} fill="#1a1a1a" stroke="#2a2a2a" strokeWidth={0.5 / k} />
              {p.name && p.cx > -999 && (
                <text
                  x={p.cx} y={p.cy}
                  textAnchor="middle" dominantBaseline="middle"
                  fontSize={7 / k}
                  stroke="rgba(0,0,0,0.8)" strokeWidth={1.5 / k} paintOrder="stroke"
                  fill={p.isIncheon ? "#7a9a9a" : "#8a8aaa"}
                  style={{ pointerEvents: "none", fontFamily: "monospace" }}
                >
                  {p.name}
                </text>
              )}
            </g>
          ))}

          {/* Han River */}
          <path d={hangangPath} fill="#1a3a6a" opacity={0.85} style={{ pointerEvents: "none" }} />
          <text
            x={labelPositions.hangang[0]} y={labelPositions.hangang[1]}
            textAnchor="middle" dominantBaseline="middle"
            fontSize={9 / k} fill="#60a5fa" opacity={0.9}
            style={{ pointerEvents: "none", fontFamily: "monospace" }}
          >
            한강
          </text>

          {/* Seoul 25 districts */}
          {seoulPaths.map(p => (
            <g key={p.key}>
              <path
                d={p.d}
                fill={p.fillColor}
                stroke={p.isSelected ? "#ffffff" : "rgba(255,255,255,0.25)"}
                strokeWidth={(p.isSelected ? 1.5 : 0.4) / k}
                style={{ cursor: p.code ? "pointer" : "default" }}
                onClick={() => { if (p.code) onSelect(p.code); }}
                onMouseEnter={(e) => {
                  if (!p.data) return;
                  const rect = svgRef.current?.getBoundingClientRect();
                  setTooltip({
                    name: p.geoName,
                    avgPrice: p.data.avgPrice,
                    avgPricePerPyeong: p.data.avgPricePerPyeong ?? 0,
                    count: p.data.count,
                    change: p.data.change,
                    x: e.clientX - (rect?.left ?? 0),
                    y: e.clientY - (rect?.top ?? 0),
                  });
                }}
                onMouseMove={(e) => {
                  const rect = svgRef.current?.getBoundingClientRect();
                  setTooltip(prev => prev
                    ? { ...prev, x: e.clientX - (rect?.left ?? 0), y: e.clientY - (rect?.top ?? 0) }
                    : null);
                }}
                onMouseLeave={() => setTooltip(null)}
              />
              {p.geoName && p.cx > -999 && (
                <text
                  x={p.cx} y={p.cy}
                  textAnchor="middle" dominantBaseline="middle"
                  fontSize={9 / k}
                  stroke="rgba(0,0,0,0.95)" strokeWidth={2.5 / k} paintOrder="stroke"
                  fill="rgba(255,255,255,0.92)"
                  style={{ pointerEvents: "none", fontFamily: "monospace" }}
                >
                  {p.shortName}
                </text>
              )}
            </g>
          ))}

          {/* Region labels */}
          <text
            x={labelPositions.seoul[0]} y={labelPositions.seoul[1]}
            textAnchor="middle" dominantBaseline="middle"
            fontSize={14 / k} fontWeight="bold"
            fill="rgba(255,255,255,0.22)" style={{ pointerEvents: "none" }}
          >
            서울
          </text>
          <text
            x={labelPositions.gyeonggi[0]} y={labelPositions.gyeonggi[1]}
            textAnchor="middle" dominantBaseline="middle"
            fontSize={13 / k}
            fill="rgba(200,200,200,0.28)" style={{ pointerEvents: "none" }}
          >
            경기
          </text>
          <text
            x={labelPositions.incheon[0]} y={labelPositions.incheon[1]}
            textAnchor="middle" dominantBaseline="middle"
            fontSize={12 / k}
            fill="rgba(200,200,200,0.28)" style={{ pointerEvents: "none" }}
          >
            인천
          </text>
        </g>
      </svg>

      {/* Tooltip */}
      {tooltip && (
        <div
          className="pointer-events-none absolute z-20 rounded px-3 py-2 font-mono"
          style={{
            left: tooltip.x + 14,
            top: tooltip.y - 14,
            fontSize: 12,
            background: "#1a1a1a",
            border: "1px solid #2e2e2e",
            color: "#e8e8e8",
            minWidth: 140,
            boxShadow: "0 4px 12px rgba(0,0,0,0.6)",
          }}
        >
          <div className="font-semibold mb-1" style={{ color: "#e8e8e8", fontSize: 13 }}>{tooltip.name}</div>
          <div style={{ color: "#f5a623" }}>평당 {fmtPyeong(tooltip.avgPricePerPyeong)}</div>
          <div style={{ color: "#888888" }}>거래 {tooltip.count}건</div>
          {tooltip.change != null && (
            <div style={{ color: tooltip.change >= 0 ? "#22c55e" : "#ef4444" }}>
              전월比 {tooltip.change >= 0 ? "+" : ""}{tooltip.change}%
            </div>
          )}
        </div>
      )}
    </div>
  );
}
