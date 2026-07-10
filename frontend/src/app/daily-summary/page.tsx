"use client";

import AppLayout from "@/components/layout/AppLayout";
import { motion } from "framer-motion";
import {
  Brain,
  TrendingUp,
  FileText,
  MessageSquare,
  Mail,
  GitCommit,
  Calendar,
  Sparkles,
} from "lucide-react";

const highlights = [
  {
    icon: FileText,
    title: "3 new documents processed",
    desc: "SilentGuard Report, AI Plan, and Meeting Notes were added to your memory.",
    color: "#4facfe",
  },
  {
    icon: MessageSquare,
    title: "12 new WhatsApp messages indexed",
    desc: "Team chat about demo preparations was analyzed and linked.",
    color: "#25d366",
  },
  {
    icon: Mail,
    title: "5 important emails found",
    desc: "Prof. Sharma's feedback email was tagged as high-priority.",
    color: "#ea4335",
  },
  {
    icon: GitCommit,
    title: "2 new GitHub commits",
    desc: "AI module integration and bug fixes pushed to SilentGuard repo.",
    color: "#f0f0f0",
  },
  {
    icon: Calendar,
    title: "1 upcoming meeting",
    desc: "Project review with Prof. Sharma scheduled for 20 Jan 2024.",
    color: "#f0a500",
  },
];

const insights = [
  "Your most active data source this week is WhatsApp (142 messages).",
  "You've referenced 'SilentGuard' 47 times across all platforms.",
  "Prof. Sharma appears in 12 connected memories.",
  "3 tasks from the hackathon checklist are still pending.",
];

export default function DailySummaryPage() {
  return (
    <AppLayout>
      <div className="p-8 max-w-[1000px] mx-auto">
        <motion.div
          className="mb-8"
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <div className="flex items-center gap-3 mb-2">
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center"
              style={{
                background: "linear-gradient(135deg, var(--accent), #a29bfe)",
                boxShadow: "0 0 16px rgba(108,92,231,0.4)",
              }}
            >
              <Brain size={20} className="text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white">Daily Summary</h1>
              <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
                Friday, 18 January 2024
              </p>
            </div>
          </div>
        </motion.div>

        {/* Stats Row */}
        <motion.div
          className="grid grid-cols-3 gap-4 mb-8"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15, duration: 0.5 }}
        >
          {[
            { label: "New Memories", value: "+23", icon: Brain, color: "#6c5ce7" },
            { label: "Connections Made", value: "+14", icon: TrendingUp, color: "#00d68f" },
            { label: "Sources Active", value: "6/8", icon: Sparkles, color: "#f0a500" },
          ].map((stat, i) => {
            const Icon = stat.icon;
            return (
              <div key={i} className="card p-5 flex items-center gap-4">
                <div
                  className="w-11 h-11 rounded-xl flex items-center justify-center"
                  style={{ background: stat.color + "18" }}
                >
                  <Icon size={20} style={{ color: stat.color }} />
                </div>
                <div>
                  <p className="text-xl font-bold text-white">{stat.value}</p>
                  <p className="text-xs" style={{ color: "var(--text-secondary)" }}>
                    {stat.label}
                  </p>
                </div>
              </div>
            );
          })}
        </motion.div>

        {/* Highlights */}
        <motion.div
          className="mb-8"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3, duration: 0.5 }}
        >
          <h2 className="text-lg font-semibold text-white mb-4">
            Today&apos;s Highlights
          </h2>
          <div className="space-y-3">
            {highlights.map((item, i) => {
              const Icon = item.icon;
              return (
                <motion.div
                  key={i}
                  className="card p-4 flex items-start gap-4 cursor-pointer"
                  initial={{ opacity: 0, x: -15 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.35 + i * 0.08, duration: 0.4 }}
                >
                  <div
                    className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5"
                    style={{ background: item.color + "18" }}
                  >
                    <Icon size={18} style={{ color: item.color }} />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-white">{item.title}</p>
                    <p className="text-xs mt-0.5" style={{ color: "var(--text-secondary)" }}>
                      {item.desc}
                    </p>
                  </div>
                </motion.div>
              );
            })}
          </div>
        </motion.div>

        {/* AI Insights */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6, duration: 0.5 }}
        >
          <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
            <Sparkles size={18} style={{ color: "var(--accent)" }} />
            AI Insights
          </h2>
          <div className="card p-5 space-y-3">
            {insights.map((insight, i) => (
              <div key={i} className="flex items-start gap-3">
                <div
                  className="w-1.5 h-1.5 rounded-full mt-1.5 flex-shrink-0"
                  style={{ background: "var(--accent)" }}
                />
                <p className="text-xs" style={{ color: "var(--text-secondary)" }}>
                  {insight}
                </p>
              </div>
            ))}
          </div>
        </motion.div>
      </div>
    </AppLayout>
  );
}
