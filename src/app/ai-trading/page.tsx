"use client";
import AppHeader from "@/components/AppHeader";
import AiTradingContent from "@/components/AiTradingContent";
export default function AiTradingPage() {
  return (
    <div className="min-h-screen bg-background">
      <AppHeader active="ideas" />
      <AiTradingContent />
    </div>
  );
}
