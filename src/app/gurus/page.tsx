"use client";
import AppHeader from "@/components/AppHeader";
import GuruContent from "@/components/GuruContent";
export default function GurusPage() {
  return (
    <div className="min-h-screen bg-background">
      <AppHeader active="ideas" />
      <GuruContent />
    </div>
  );
}
