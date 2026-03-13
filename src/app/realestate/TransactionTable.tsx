"use client";

interface Trade {
  date: string;
  district: string;
  dong: string;
  aptName: string;
  area: number;
  floor: number;
  price: number;
}

interface Props {
  trades: Trade[];
  selectedDistrict: string | null;
  onSelectDistrict: (code: string | null) => void;
  districtNameToCode: Map<string, string>;
}

function fmtPrice(manwon: number): string {
  if (!manwon || manwon <= 0) return "—";
  const ok = manwon / 10000;
  return ok >= 1 ? `${ok.toFixed(1)}억` : `${manwon.toLocaleString()}만`;
}

const COLS = [
  { label: "자치구", align: "left" as const },
  { label: "단지명", align: "left" as const },
  { label: "전용면적", align: "right" as const },
  { label: "층", align: "right" as const },
  { label: "거래금액", align: "right" as const },
  { label: "계약일", align: "left" as const },
];

export default function TransactionTable({
  trades, selectedDistrict, onSelectDistrict, districtNameToCode,
}: Props) {
  const codeToName = new Map([...districtNameToCode.entries()].map(([name, code]) => [code, name]));
  const selectedName = selectedDistrict ? codeToName.get(selectedDistrict) ?? null : null;
  const displayed = selectedName ? trades.filter(t => t.district === selectedName) : trades;
  const tradeDistricts = [...new Set(trades.map(t => t.district))].sort();

  const btnBase: React.CSSProperties = {
    padding: "1px 6px", fontSize: 9, cursor: "pointer",
    fontFamily: "'IBM Plex Mono', monospace", letterSpacing: "0.3px",
    border: "1px solid #1e1e1e",
  };

  return (
    <div style={{ background: "#111111", borderTop: "1px solid #222" }}>
      {/* Header + filter buttons */}
      <div style={{ padding: "8px 14px 6px", borderBottom: "1px solid #1e1e1e" }}>
        <div style={{
          fontSize: 13, fontFamily: "'IBM Plex Mono', monospace", color: "#f59e0b", fontWeight: 700,
          letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 6,
        }}>
          실거래 내역 {displayed.length > 0 ? `· ${displayed.length}건` : ""}
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 3 }}>
          <button
            onClick={() => onSelectDistrict(null)}
            style={{
              ...btnBase,
              background: !selectedDistrict ? "#f59e0b" : "#141414",
              color: !selectedDistrict ? "#000" : "#555",
              border: "1px solid #2a2a2a",
            }}
          >전체</button>
          {tradeDistricts.map(name => {
            const code = districtNameToCode.get(name) ?? "";
            const isActive = selectedDistrict === code;
            return (
              <button
                key={name}
                onClick={() => onSelectDistrict(isActive ? null : code)}
                style={{
                  ...btnBase,
                  border: `1px solid ${isActive ? "#f59e0b50" : "#1e1e1e"}`,
                  background: isActive ? "#f59e0b12" : "#0e0e0e",
                  color: isActive ? "#f59e0b" : "#3a3a3a",
                }}
              >{name.replace("구", "")}</button>
            );
          })}
        </div>
      </div>

      {/* Table */}
      {displayed.length === 0 ? (
        <div style={{
          padding: "24px 16px", fontSize: 11,
          fontFamily: "'IBM Plex Mono', monospace", color: "#333",
        }}>
          거래 내역 없음
        </div>
      ) : (
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ borderBottom: "1px solid #1e1e1e" }}>
                {COLS.map(({ label, align }) => (
                  <th key={label} style={{
                    padding: "6px 14px", textAlign: align,
                    fontSize: 9, color: "#999999",
                    fontFamily: "'IBM Plex Mono', monospace",
                    textTransform: "uppercase", letterSpacing: "0.8px",
                    fontWeight: 600, whiteSpace: "nowrap",
                    background: "#111",
                  }}>{label}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {displayed.map((t, i) => (
                <tr
                  key={i}
                  style={{ borderBottom: "1px solid #161616" }}
                  onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = "#161616"; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = ""; }}
                >
                  <td style={{ padding: "5px 14px", fontSize: 11, color: "#ffffff", fontWeight: 500, fontFamily: "monospace", whiteSpace: "nowrap" }}>
                    {t.district}
                  </td>
                  <td style={{ padding: "5px 14px", fontSize: 11, color: "#ffffff", fontWeight: 500, fontFamily: "monospace", maxWidth: 200, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {t.aptName || t.dong}
                  </td>
                  <td style={{ padding: "5px 14px", fontSize: 11, color: "#ffffff", fontWeight: 500, fontFamily: "monospace", textAlign: "right", whiteSpace: "nowrap" }}>
                    {t.area.toFixed(0)}㎡
                  </td>
                  <td style={{ padding: "5px 14px", fontSize: 11, color: "#ffffff", fontWeight: 500, fontFamily: "monospace", textAlign: "right" }}>
                    {t.floor}F
                  </td>
                  <td style={{ padding: "5px 14px", fontSize: 12, color: "#f59e0b", fontFamily: "'IBM Plex Mono', monospace", fontWeight: 700, textAlign: "right", whiteSpace: "nowrap" }}>
                    {fmtPrice(t.price)}
                  </td>
                  <td style={{ padding: "5px 14px", fontSize: 11, color: "#ffffff", fontWeight: 500, fontFamily: "monospace", whiteSpace: "nowrap" }}>
                    {t.date}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
