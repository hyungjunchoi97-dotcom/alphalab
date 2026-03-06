import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Portfolio | Alphalab",
  description:
    "Track your investment portfolio with holdings management and allocation charts.",
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
