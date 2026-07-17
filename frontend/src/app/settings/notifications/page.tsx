"use client";

import AppLayout from "@/components/layout/AppLayout";
import { motion } from "framer-motion";
import { useState, useEffect } from "react";
import {
  ChevronLeft,
  Bell,
  Mail as MailIcon,
  Calendar as CalendarIcon,
  Activity,
  RefreshCw
} from "lucide-react";
import { useRouter } from "next/navigation";
import { getAllSettings, updateAllSettings, UserSettings } from "@/lib/api";

export default function NotificationsSettingsPage() {
  const router = useRouter();
  const [settings, setSettings] = useState<UserSettings | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    async function fetchData() {
      const s = await getAllSettings();
      setSettings(s);
    }
    fetchData();
  }, []);

  const toggleSetting = async (
    key: keyof Pick<
      UserSettings,
      | "push_notifications"
      | "email_notifications"
      | "daily_summary_notifications"
      | "memory_update_notifications"
      | "sync_completion_notifications"
      | "ai_activity_notifications"
    >
  ) => {
    if (!settings) return;
    const newValue = !settings[key];
    setSettings({ ...settings, [key]: newValue });
    try {
      setLoading(true);
      const updated = await updateAllSettings({ [key]: newValue });
      setSettings(updated);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const notificationItems = [
    {
      key: "push_notifications" as const,
      label: "Push Notifications",
      desc: "Receive push notifications on your device",
      icon: Bell,
      color: "#00d68f",
    },
    {
      key: "email_notifications" as const,
      label: "Email Notifications",
      desc: "Receive notifications via email",
      icon: MailIcon,
      color: "#ea4335",
    },
    {
      key: "daily_summary_notifications" as const,
      label: "Daily Summary",
      desc: "Receive a daily summary of your memory activity",
      icon: CalendarIcon,
      color: "#f0a500",
    },
    {
      key: "memory_update_notifications" as const,
      label: "Memory Updates",
      desc: "Get notified when new memories are added",
      icon: Activity,
      color: "#6c5ce7",
    },
    {
      key: "sync_completion_notifications" as const,
      label: "Sync Completion",
      desc: "Get notified when source sync completes",
      icon: RefreshCw,
      color: "#4facfe",
    },
  ];

  return (
    <AppLayout>
      <div className="p-8 max-w-[600px] mx-auto">
        <motion.div
          className="mb-8 flex items-center gap-3"
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <button
            onClick={() => router.back()}
            className="p-2 rounded-lg hover:bg-[var(--bg-card)] transition-colors"
          >
            <ChevronLeft size={24} style={{ color: "var(--text-secondary)" }} />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-white">Notifications</h1>
            <p className="text-sm mt-1" style={{ color: "var(--text-secondary)" }}>
              Configure your notification preferences
            </p>
          </div>
        </motion.div>

        <div className="space-y-3">
          {notificationItems.map((item, i) => {
            const Icon = item.icon;
            const isOn = settings ? settings[item.key] : false;
            return (
              <motion.div
                key={item.key}
                className="card p-5 flex items-center gap-4"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.1 }}
              >
                <div
                  className="w-10 h-10 rounded-lg flex items-center justify-center"
                  style={{ background: item.color + "18" }}
                >
                  <Icon size={20} style={{ color: item.color }} />
                </div>
                <div className="flex-1">
                  <h3 className="text-white font-semibold">{item.label}</h3>
                  <p className="text-sm" style={{ color: "var(--text-muted)" }}>
                    {item.desc}
                  </p>
                </div>
                <div
                  onClick={() => toggleSetting(item.key)}
                  className="w-12 h-6 rounded-full relative cursor-pointer transition-colors"
                  style={{
                    background: isOn ? "var(--accent)" : "var(--bg-elevated)",
                    border: `1px solid ${isOn ? "var(--accent)" : "var(--border)"}`,
                    padding: "2px",
                  }}
                >
                  <div
                    className="w-5 h-5 rounded-full bg-white absolute top-0.5 transition-all"
                    style={{ left: isOn ? "calc(100% - 22px)" : "2px" }}
                  />
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>
    </AppLayout>
  );
}
