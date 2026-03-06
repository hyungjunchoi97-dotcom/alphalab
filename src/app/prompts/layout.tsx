import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Prompts | Alphalab",
  description:
    "Browse and create analysis prompt templates for AI-powered chart analysis.",
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
