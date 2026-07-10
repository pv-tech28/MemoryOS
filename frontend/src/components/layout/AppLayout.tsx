"use client";

import Sidebar from "./Sidebar";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen" style={{ background: "var(--bg-primary)" }}>
      <Sidebar />
      <main
        className="flex-1 min-h-screen overflow-y-auto"
        style={{ marginLeft: 240 }}
      >
        {children}
      </main>
    </div>
  );
}
