import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Community | Alphalab",
  description:
    "Join the investment community. Share ideas, discuss strategies, and learn from other traders.",
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
