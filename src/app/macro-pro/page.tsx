"use client";
import AppHeader from "@/components/AppHeader";
import MacroProContent from "@/components/MacroProContent";
export default function MacroProPage() {
  return (
    <div className="min-h-screen bg-background">
      <AppHeader active="macroPro" />
      <MacroProContent />
    </div>
  );
}
