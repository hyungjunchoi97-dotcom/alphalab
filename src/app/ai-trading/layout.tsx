import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "AI Trading | Alphalab",
  description:
    "Upload chart images and get AI-powered technical analysis with entry, stop-loss, and target levels.",
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
