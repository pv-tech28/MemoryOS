"use client";

import AppLayout from "@/components/layout/AppLayout";
import { motion } from "framer-motion";
import { useState, useEffect } from "react";
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
  Cpu,
  Save,
  HardDrive,
  FolderGit2
} from "lucide-react";
import { useRouter } from "next/navigation";
import { getProfile, Profile } from "@/lib/api";

interface SettingsItem {
  icon: any;
  label: string;
  desc: string;
  color: string;
  toggle?: boolean;
  on?: boolean;
  id: string;
  path: string;
}

interface SettingsSection {
  title: string;
  items: SettingsItem[];
}

const initialSettingsSections: SettingsSection[] = [
  {
    title: "Account",
    items: [
      { icon: User, label: "Profile", desc: "Manage your name, avatar and preferences", color: "#4facfe", id: "profile", path: "/settings/profile" },
      { icon: Mail, label: "Email", desc: "Change your email address", color: "#ea4335", id: "email", path: "/settings/email" },
      { icon: Key, label: "Password & Security", desc: "Update password and 2FA settings", color: "#f0a500", id: "security", path: "/settings/password-security" },
    ],
  },
  {
    title: "Preferences",
    items: [
      { icon: Palette, label: "Appearance", desc: "Dark mode, colors and layout", color: "#6c5ce7", id: "appearance", path: "/settings/appearance" },
      { icon: Bell, label: "Notifications", desc: "Manage push and email notifications", color: "#00d68f", id: "notifications", path: "/settings/notifications" },
      { icon: Volume2, label: "Sound Effects", desc: "Toggle UI sound effects", color: "#e84393", id: "sound", path: "/settings/sound" },
      { icon: Globe, label: "Language", desc: "Choose your language", color: "#4facfe", id: "language", path: "/settings/language" },
    ],
  },
  {
    title: "MemoryOS",
    items: [
      { icon: Cpu, label: "Memory Preferences", desc: "Auto-extract, auto-graph, etc.", color: "#6c5ce7", id: "memory", path: "/settings/memory" },
      { icon: Save, label: "AI Settings", desc: "Provider, response length, creativity", color: "#00d68f", id: "ai", path: "/settings/ai" },
      { icon: HardDrive, label: "Data & Storage", desc: "See usage, export data", color: "#4facfe", id: "storage", path: "/settings/storage" },
    ],
  },
  {
    title: "Data & Privacy",
    items: [
      { icon: FolderGit2, label: "Connected Sources", desc: "Manage connected sources", color: "#00d68f", id: "sources", path: "/settings/sources" },
      { icon: Shield, label: "Privacy", desc: "Data sharing and retention settings", color: "#f0a500", id: "privacy", path: "/settings/privacy" },
      { icon: Trash2, label: "Delete Data", desc: "Remove all indexed memories", color: "#ff6b6b", id: "delete-data", path: "/settings/delete-data" },
    ],
  },
];

export default function SettingsPage() {
  const router = useRouter();
  const [profile, setProfile] = useState<Profile | null>(null);

  useEffect(() => {
    async function fetchData() {
      const p = await getProfile();
      setProfile(p);
    }
    fetchData();
  }, []);

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
          className="card p-6 flex items-center gap-5 mb-8 cursor-pointer"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1, duration: 0.5 }}
          onClick={() => router.push("/settings/profile")}
        >
          <div
            className="w-16 h-16 rounded-2xl flex items-center justify-center text-xl font-bold"
            style={{ background: "linear-gradient(135deg, #6c5ce7, #e84393)" }}
          >
            {profile?.display_name ? profile.display_name.charAt(0).toUpperCase() : "S"}
          </div>
          <div className="flex-1">
            <h2 className="text-lg font-bold text-white">{profile?.display_name || "User"}</h2>
            <p className="text-xs" style={{ color: "var(--text-secondary)" }}>
              {profile?.email || "email@example.com"}
            </p>
            <span
              className="inline-block mt-1 px-3 py-0.5 rounded-full text-[10px] font-semibold"
              style={{ background: "var(--accent-subtle)", color: "var(--accent)" }}
            >
              Pro Plan
            </span>
          </div>
          <ChevronRight size={20} style={{ color: "var(--text-muted)" }} />
        </motion.div>

        {/* Settings Sections */}
        {initialSettingsSections.map((section, si) => (
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
                    key={item.id}
                    className="flex items-center gap-4 px-5 py-4 cursor-pointer transition-colors hover:bg-[var(--bg-card)]"
                    style={{
                      borderTop: i > 0 ? "1px solid var(--border-subtle)" : "none",
                    }}
                    onClick={() => router.push(item.path)}
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
                    <ChevronRight size={16} style={{ color: "var(--text-muted)" }} />
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
