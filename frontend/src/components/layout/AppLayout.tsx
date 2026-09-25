"use client";

import Sidebar from "./Sidebar";
import { motion } from "framer-motion";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen noise-overlay relative overflow-hidden" style={{ background: "var(--bg-primary)" }}>
      {/* ─── Living Ambient Aurora Mesh ─── */}
      <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden">
        {/* Violet Synapse Orb */}
        <motion.div
          className="absolute rounded-full"
          style={{
            top: "-15%",
            left: "18%",
            width: "650px",
            height: "650px",
            background: "radial-gradient(circle, rgba(139, 92, 246, 0.14) 0%, rgba(139, 92, 246, 0.02) 50%, transparent 70%)",
            filter: "blur(90px)",
          }}
          animate={{
            x: [0, 40, -30, 0],
            y: [0, -35, 25, 0],
            scale: [1, 1.12, 0.95, 1],
          }}
          transition={{
            duration: 22,
            repeat: Infinity,
            ease: "easeInOut",
          }}
        />

        {/* Quantum Cyan Data Orb */}
        <motion.div
          className="absolute rounded-full"
          style={{
            bottom: "-10%",
            right: "12%",
            width: "600px",
            height: "600px",
            background: "radial-gradient(circle, rgba(6, 182, 212, 0.12) 0%, rgba(6, 182, 212, 0.02) 50%, transparent 70%)",
            filter: "blur(95px)",
          }}
          animate={{
            x: [0, -50, 30, 0],
            y: [0, 40, -30, 0],
            scale: [1, 1.08, 0.96, 1],
          }}
          transition={{
            duration: 26,
            repeat: Infinity,
            ease: "easeInOut",
          }}
        />

        {/* Radiant Rose Accent Orb */}
        <motion.div
          className="absolute rounded-full"
          style={{
            top: "45%",
            right: "35%",
            width: "420px",
            height: "420px",
            background: "radial-gradient(circle, rgba(244, 63, 94, 0.07) 0%, transparent 70%)",
            filter: "blur(80px)",
          }}
          animate={{
            x: [0, 35, -45, 0],
            y: [0, -25, 35, 0],
            scale: [0.9, 1.15, 0.9],
          }}
          transition={{
            duration: 20,
            repeat: Infinity,
            ease: "easeInOut",
          }}
        />

        {/* Architectural Subtle Grid */}
        <div
          className="absolute inset-0 opacity-[0.025]"
          style={{
            backgroundImage: `linear-gradient(rgba(255, 255, 255, 0.25) 1px, transparent 1px),
                              linear-gradient(90deg, rgba(255, 255, 255, 0.25) 1px, transparent 1px)`,
            backgroundSize: "64px 64px",
          }}
        />
      </div>

      <Sidebar />

      <main
        className="flex-1 min-h-screen overflow-y-auto relative z-10"
        style={{ marginLeft: 264 }}
      >
        {children}
      </main>
    </div>
  );
}
