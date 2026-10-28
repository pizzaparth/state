import * as React from "react";
import { Sidebar } from "@/components/navigation/sidebar";
import { Topbar } from "@/components/navigation/topbar";

export default function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex h-screen w-screen overflow-hidden bg-[#D9D9D5] text-[#171717]">
      {/* Left Vertical Rail */}
      <Sidebar />

      {/* Main Work Area */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <Topbar />
        <main className="flex-1 overflow-y-auto p-8">
          <div className="max-w-6xl mx-auto space-y-8">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
