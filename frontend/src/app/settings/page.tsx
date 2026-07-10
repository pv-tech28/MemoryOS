"use client";

import AppLayout from "@/components/layout/AppLayout";
import { motion } from "framer-motion";
import {
  User,
  Bell,
  Shield,
  Palette,
  Database,
  Key,
  Globe,
  ChevronRight,
  Moon,
  Volume2,
  Mail,
  Trash2,
} from "lucide-react";

const settingsSections = [
  {
    title: "Account",
    items: [
      { icon: User, label: "Profile", desc: "Manage your name, avatar and preferences", color: "#4facfe" },
      { icon: Mail, label: "Email", desc: "siddh.tyagi@gmail.com", color: "#ea4335" },
      { icon: Key, label: "Password & Security", desc: "Update password and 2FA settings", color: "#f0a500" },
    ],
  },
  {
    title: "Preferences",
    items: [
      { icon: Palette, label: "Appearance", desc: "Dark mode, colors and layout", color: "#6c5ce7", toggle: true, on: true },
      { icon: Bell, label: "Notifications", desc: "Manage push and email notifications", color: "#00d68f", toggle: true, on: true },
      { icon: Volume2, label: "Sound Effects", desc: "Toggle UI sound effects", color: "#e84393", toggle: true, on: false },
      { icon: Globe, label: "Language", desc: "English (US)", color: "#4facfe" },
    ],
  },
  {
    title: "Data & Privacy",
    items: [
      { icon: Database, label: "Connected Sources", desc: "6 sources connected", color: "#00d68f" },
      { icon: Shield, label: "Privacy", desc: "Data sharing and retention settings", color: "#f0a500" },
      { icon: Trash2, label: "Delete Data", desc: "Remove all indexed memories", color: "#ff6b6b" },
    ],
  },
];

export default function SettingsPage() {
  return (
    <AppLayout>
      <div className="p-8 max-w-[800px] mx-auto">
        <motion.div
          className="mb-8"
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <h1 className="text-2xl font-bold text-white">Settings</h1>
          <p className="text-sm mt-1" style={{ color: "var(--text-secondary)" }}>
            Manage your account, preferences and data
          </p>
        </motion.div>

        {/* Profile Card */}
        <motion.div
          className="card p-6 flex items-center gap-5 mb-8"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1, duration: 0.5 }}
        >
          <div
            className="w-16 h-16 rounded-2xl flex items-center justify-center text-xl font-bold"
            style={{ background: "linear-gradient(135deg, #6c5ce7, #e84393)" }}
          >
            ST
          </div>
          <div className="flex-1">
            <h2 className="text-lg font-bold text-white">Siddh Tyagi</h2>
            <p className="text-xs" style={{ color: "var(--text-secondary)" }}>
              siddh.tyagi@gmail.com
            </p>
            <span
              className="inline-block mt-1 px-3 py-0.5 rounded-full text-[10px] font-semibold"
              style={{ background: "var(--accent-subtle)", color: "var(--accent)" }}
            >
              Pro Plan
            </span>
          </div>
          <button
            className="px-4 py-2 rounded-xl text-xs font-semibold"
            style={{ background: "var(--bg-elevated)", border: "1px solid var(--border)", color: "var(--text-secondary)" }}
          >
            Edit Profile
          </button>
        </motion.div>

        {/* Settings Sections */}
        {settingsSections.map((section, si) => (
          <motion.div
            key={section.title}
            className="mb-8"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 + si * 0.1, duration: 0.5 }}
          >
            <h3
              className="text-[10px] font-semibold uppercase tracking-wider mb-3"
              style={{ color: "var(--text-muted)" }}
            >
              {section.title}
            </h3>
            <div
              className="rounded-2xl overflow-hidden"
              style={{ border: "1px solid var(--border)" }}
            >
              {section.items.map((item, i) => {
                const Icon = item.icon;
                return (
                  <div
                    key={i}
                    className="flex items-center gap-4 px-5 py-4 cursor-pointer transition-colors hover:bg-[var(--bg-card)]"
                    style={{
                      borderTop: i > 0 ? "1px solid var(--border-subtle)" : "none",
                    }}
                  >
                    <div
                      className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0"
                      style={{ background: item.color + "18" }}
                    >
                      <Icon size={18} style={{ color: item.color }} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-white">{item.label}</p>
                      <p className="text-[11px]" style={{ color: "var(--text-muted)" }}>
                        {item.desc}
                      </p>
                    </div>
                    {"toggle" in item ? (
                      <div
                        className="w-10 h-5.5 rounded-full relative cursor-pointer transition-colors"
                        style={{
                          background: item.on ? "var(--accent)" : "var(--bg-elevated)",
                          border: `1px solid ${item.on ? "var(--accent)" : "var(--border)"}`,
                          padding: "2px",
                        }}
                      >
                        <div
                          className="w-4 h-4 rounded-full bg-white absolute top-0.5 transition-all"
                          style={{ left: item.on ? "calc(100% - 18px)" : "2px" }}
                        />
                      </div>
                    ) : (
                      <ChevronRight size={16} style={{ color: "var(--text-muted)" }} />
                    )}
                  </div>
                );
              })}
            </div>
          </motion.div>
        ))}
      </div>
    </AppLayout>
  );
}
