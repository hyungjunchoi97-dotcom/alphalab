import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "파이낸셜 분석",
  description: "미국·한국 주식 재무제표, 밸류에이션, PER, EV/EBITDA, 현금흐름 분석.",
};

export default function FinancialsLayout({ children }: { children: React.ReactNode }) {
  return children;
}
