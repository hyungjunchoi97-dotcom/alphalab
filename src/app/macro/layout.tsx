import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "매크로 지표",
  description: "CNN Fear & Greed, 기준금리, CPI, VIX, 유동성, 원자재 실시간 매크로 지표 대시보드.",
};

export default function MacroLayout({ children }: { children: React.ReactNode }) {
  return children;
}
