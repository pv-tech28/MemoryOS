"use client";

import AppLayout from "@/components/layout/AppLayout";
import { motion } from "framer-motion";
import {
  Search,
  Send,
  Bell,
  Plus,
  Mail,
  HardDrive,
  Calendar,
  GitBranch,
  BookOpen,
  Brain,
  FileText,
  MessageSquare,
  Image,
  Mic,
} from "lucide-react";

const connectedSources = [
  {
    name: "Gmail",
    count: "2,134",
    label: "Emails",
    icon: Mail,
    color: "#ea4335",
    bg: "rgba(234,67,53,0.12)",
  },
  {
    name: "Google Drive",
    count: "1,089",
    label: "Files",
    icon: HardDrive,
    color: "#4285f4",
    bg: "rgba(66,133,244,0.12)",
  },
  {
    name: "Calendar",
    count: "248",
    label: "Events",
    icon: Calendar,
    color: "#34a853",
    bg: "rgba(52,168,83,0.12)",
  },
  {
    name: "GitHub",
    count: "143",
    label: "Repositories",
    icon: GitBranch,
    color: "#f0f0f0",
    bg: "rgba(240,240,240,0.08)",
  },
  {
    name: "Notion",
    count: "328",
    label: "Pages",
    icon: BookOpen,
    color: "#ffffff",
    bg: "rgba(255,255,255,0.06)",
  },
];

const memoryStats = [
  { label: "Total Memories", value: "5,972", icon: Brain, color: "#6c5ce7" },
  { label: "Documents", value: "3,487", icon: FileText, color: "#4facfe" },
  {
    label: "Conversations",
    value: "1,256",
    icon: MessageSquare,
    color: "#00d68f",
  },
  { label: "Images", value: "845", icon: Image, color: "#e84393" },
  { label: "Recordings", value: "384", icon: Mic, color: "#f0a500" },
];

const quickPrompts = [
  "When did we first discuss SilentGuard?",
  "Who suggested adding AI to the project?",
  "Show all documents related to Hackathon",
];

const fadeUp = {
  hidden: { opacity: 0, y: 20 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.08, duration: 0.5, ease: "easeOut" as const },
  }),
};

export default function DashboardPage() {
  return (
    <AppLayout>
      <div className="p-8 max-w-[1200px] mx-auto">
        {/* Header */}
        <motion.div
          className="flex items-center justify-between mb-8"
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <div>
            <h1 className="text-3xl font-bold text-white">
              Good evening, Siddh! 👋
            </h1>
            <p
              className="text-sm mt-1"
              style={{ color: "var(--text-secondary)" }}
            >
              Your <span className="gradient-text font-semibold">second brain</span> is ready.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button
              className="w-10 h-10 rounded-xl flex items-center justify-center transition-colors"
              style={{
                background: "var(--bg-card)",
                border: "1px solid var(--border)",
                color: "var(--text-secondary)",
              }}
            >
              <Search size={18} />
            </button>
            <button
              className="relative w-10 h-10 rounded-xl flex items-center justify-center transition-colors"
              style={{
                background: "var(--bg-card)",
                border: "1px solid var(--border)",
                color: "var(--text-secondary)",
              }}
            >
              <Bell size={18} />
              <span
                className="absolute top-2 right-2 w-2 h-2 rounded-full"
                style={{ background: "var(--accent)" }}
              />
            </button>
          </div>
        </motion.div>

        {/* Search Bar */}
        <motion.div
          className="relative mb-4"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15, duration: 0.5 }}
        >
          <div
            className="flex items-center rounded-2xl px-5 py-4"
            style={{
              background: "var(--bg-card)",
              border: "1px solid var(--border)",
            }}
          >
            <Search size={18} style={{ color: "var(--text-muted)" }} />
            <input
              type="text"
              placeholder="Ask anything about your memory..."
              className="flex-1 bg-transparent ml-3 text-sm outline-none placeholder:text-[var(--text-muted)] text-white"
            />
            <button
              className="w-9 h-9 rounded-xl flex items-center justify-center text-white transition-all hover:scale-105"
              style={{
                background: "var(--accent)",
                boxShadow: "0 4px 16px rgba(108,92,231,0.35)",
              }}
            >
              <Send size={16} />
            </button>
          </div>
        </motion.div>

        {/* Quick Prompts */}
        <motion.div
          className="flex gap-3 mb-10 flex-wrap"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3, duration: 0.5 }}
        >
          {quickPrompts.map((prompt, i) => (
            <button
              key={i}
              className="px-4 py-2 rounded-full text-xs font-medium transition-all hover:scale-[1.03]"
              style={{
                background: "var(--accent-subtle)",
                color: "var(--accent-hover)",
                border: "1px solid rgba(108,92,231,0.2)",
              }}
            >
              {prompt}
            </button>
          ))}
        </motion.div>

        {/* Connected Sources */}
        <motion.div
          className="mb-10"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.35, duration: 0.5 }}
        >
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-white">
              Connected Sources
            </h2>
            <button
              className="text-xs font-medium"
              style={{ color: "var(--accent)" }}
            >
              View all
            </button>
          </div>
          <div className="grid grid-cols-6 gap-4">
            {connectedSources.map((source, i) => {
              const Icon = source.icon;
              return (
                <motion.div
                  key={source.name}
                  className="card p-4 flex flex-col items-center gap-3 cursor-pointer"
                  custom={i}
                  initial="hidden"
                  animate="visible"
                  variants={fadeUp}
                >
                  <div
                    className="w-12 h-12 rounded-xl flex items-center justify-center"
                    style={{ background: source.bg }}
                  >
                    <Icon size={22} style={{ color: source.color }} />
                  </div>
                  <div className="text-center">
                    <p className="text-xs font-semibold text-white">
                      {source.name}
                    </p>
                    <p
                      className="text-lg font-bold mt-0.5"
                      style={{ color: source.color }}
                    >
                      {source.count}
                    </p>
                    <p
                      className="text-[10px]"
                      style={{ color: "var(--text-muted)" }}
                    >
                      {source.label}
                    </p>
                  </div>
                </motion.div>
              );
            })}

            {/* Add Source Button */}
            <motion.div
              className="card p-4 flex flex-col items-center justify-center gap-2 cursor-pointer"
              style={{ borderStyle: "dashed" }}
              custom={5}
              initial="hidden"
              animate="visible"
              variants={fadeUp}
              whileHover={{ scale: 1.03 }}
            >
              <div
                className="w-12 h-12 rounded-xl flex items-center justify-center"
                style={{
                  background: "var(--accent-subtle)",
                  border: "1px dashed rgba(108,92,231,0.3)",
                }}
              >
                <Plus size={22} style={{ color: "var(--accent)" }} />
              </div>
              <p
                className="text-xs font-medium"
                style={{ color: "var(--text-secondary)" }}
              >
                Add Source
              </p>
            </motion.div>
          </div>
        </motion.div>

        {/* Memory Stats */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5, duration: 0.5 }}
        >
          <h2 className="text-lg font-semibold text-white mb-4">
            Memory Stats
          </h2>
          <div className="grid grid-cols-5 gap-4">
            {memoryStats.map((stat, i) => {
              const Icon = stat.icon;
              return (
                <motion.div
                  key={stat.label}
                  className="card p-5 flex flex-col items-center gap-2"
                  custom={i}
                  initial="hidden"
                  animate="visible"
                  variants={fadeUp}
                >
                  <Icon
                    size={20}
                    style={{ color: stat.color, opacity: 0.8 }}
                  />
                  <p className="text-2xl font-bold text-white">{stat.value}</p>
                  <p
                    className="text-xs"
                    style={{ color: "var(--text-secondary)" }}
                  >
                    {stat.label}
                  </p>
                </motion.div>
              );
            })}
          </div>
        </motion.div>
      </div>
    </AppLayout>
  );
}
