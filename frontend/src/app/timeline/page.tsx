"use client";

import AppLayout from "@/components/layout/AppLayout";
import { motion } from "framer-motion";
import { Clock, ArrowRight } from "lucide-react";

const timelineEvents = [
  {
    date: "18 Jan 2024",
    title: "WhatsApp Discussion",
    desc: "Team discussed final demo preparations",
    color: "#25d366",
  },
  {
    date: "15 Jan 2024",
    title: "Final Report Submitted",
    desc: "PDF report uploaded to Google Drive",
    color: "#e84393",
  },
  {
    date: "13 Jan 2024",
    title: "GitHub Commit: Add AI Module",
    desc: "Pushed AI integration code to SilentGuard repo",
    color: "#f0f0f0",
  },
  {
    date: "12 Jan 2024",
    title: "Meeting with Prof. Sharma",
    desc: "Discussed AI integration into emergency detection module",
    color: "#f0a500",
  },
  {
    date: "10 Jan 2024",
    title: "SilentGuard Project Created",
    desc: "Repository initialized and first commit pushed",
    color: "#00d68f",
  },
  {
    date: "8 Jan 2024",
    title: "Hackathon Registration",
    desc: "Team registered for the hackathon event",
    color: "#6c5ce7",
  },
];

export default function TimelinePage() {
  return (
    <AppLayout>
      <div className="p-8 max-w-[900px] mx-auto">
        <motion.div
          className="mb-10"
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <h1 className="text-2xl font-bold text-white">Timeline</h1>
          <p className="text-sm mt-1" style={{ color: "var(--text-secondary)" }}>
            Chronological view of your memories and events
          </p>
        </motion.div>

        {/* Timeline */}
        <div className="relative">
          {/* Vertical line */}
          <div
            className="absolute left-6 top-0 bottom-0 w-px"
            style={{ background: "var(--border)" }}
          />

          <div className="space-y-6">
            {timelineEvents.map((event, i) => (
              <motion.div
                key={i}
                className="relative flex gap-6 items-start pl-14"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.1, duration: 0.4 }}
              >
                {/* Dot on timeline */}
                <div
                  className="absolute left-[18px] w-4 h-4 rounded-full border-2 z-10"
                  style={{
                    borderColor: event.color,
                    background: "var(--bg-primary)",
                    boxShadow: `0 0 10px ${event.color}44`,
                  }}
                />

                {/* Card */}
                <div className="card p-5 flex-1 cursor-pointer">
                  <div className="flex items-center gap-2 mb-2">
                    <Clock size={12} style={{ color: "var(--text-muted)" }} />
                    <span className="text-[11px] font-medium" style={{ color: event.color }}>
                      {event.date}
                    </span>
                  </div>
                  <h3 className="text-sm font-semibold text-white">{event.title}</h3>
                  <p className="text-xs mt-1" style={{ color: "var(--text-secondary)" }}>
                    {event.desc}
                  </p>
                  <button
                    className="flex items-center gap-1 mt-3 text-[11px] font-medium"
                    style={{ color: "var(--accent)" }}
                  >
                    View details <ArrowRight size={11} />
                  </button>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
