import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Predictions | Alphalab",
  description:
    "Make and track stock predictions. View the accuracy leaderboard.",
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
