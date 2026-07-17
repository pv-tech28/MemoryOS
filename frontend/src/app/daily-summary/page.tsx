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
import { useEffect, useState } from "react";
import { getDailySummary, DailySummaryResponse } from "@/lib/api";

// Map icon names to components
const iconMap: Record<string, any> = {
  FileText,
  MessageSquare,
  Mail,
  GitCommit,
  Calendar,
};

export default function DailySummaryPage() {
  const [data, setData] = useState<DailySummaryResponse | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      try {
        const summary = await getDailySummary();
        setData(summary);
      } catch (error) {
        console.error("Failed to load daily summary", error);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, []);

  const stats = data?.stats || {
    new_documents: 0,
    emails_found: 0,
    upcoming_meetings: 0,
    connections_made: 0,
    sources_active: 0,
  };
  const highlights = data?.highlights || [];
  const insights = data?.insights || [];

  // Get today's date for display
  const today = new Date().toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });

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
                {today}
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
            { label: "New Documents", value: `+${stats.new_documents}`, icon: FileText, color: "#4facfe" },
            { label: "Connections Made", value: `+${stats.connections_made}`, icon: TrendingUp, color: "#00d68f" },
            { label: "Sources Active", value: `${stats.sources_active}`, icon: Sparkles, color: "#f0a500" },
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
            Today's Highlights
          </h2>
          <div className="space-y-3">
            {loading ? (
              <div className="card p-4">Loading highlights...</div>
            ) : highlights.length > 0 ? (
              highlights.map((item, i) => {
                const Icon = iconMap[item.icon] || FileText;
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
              })
            ) : (
              <div className="card p-4">No highlights for today yet. Upload some documents or sync your sources!</div>
            )}
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
            {loading ? (
              <div>Loading insights...</div>
            ) : insights.length > 0 ? (
              insights.map((insight, i) => (
                <div key={i} className="flex items-start gap-3">
                  <div
                    className="w-1.5 h-1.5 rounded-full mt-1.5 flex-shrink-0"
                    style={{ background: "var(--accent)" }}
                  />
                  <p className="text-xs" style={{ color: "var(--text-secondary)" }}>
                    {insight}
                  </p>
                </div>
              ))
            ) : (
              <div className="flex items-start gap-3">
                <div
                  className="w-1.5 h-1.5 rounded-full mt-1.5 flex-shrink-0"
                  style={{ background: "var(--accent)" }}
                />
                <p className="text-xs" style={{ color: "var(--text-secondary)" }}>
                  No AI insights yet! Upload some documents to start discovering patterns.
                </p>
              </div>
            )}
          </div>
        </motion.div>
      </div>
    </AppLayout>
  );
}