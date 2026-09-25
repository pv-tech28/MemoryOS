"use client";

import AppLayout from "@/components/layout/AppLayout";
import { motion } from "framer-motion";
import { useState, useEffect } from "react";
import {
  ChevronLeft,
  Shield,
  Lock,
  EyeOff,
  History,
  Clock,
  CheckCircle,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { getAllSettings, updateAllSettings, UserSettings } from "@/lib/api";

export default function PrivacySettingsPage() {
  const router = useRouter();
  const [settings, setSettings] = useState<UserSettings | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    async function fetchData() {
      try {
        const s = await getAllSettings();
        setSettings(s);
      } catch (err) {
        console.error("Failed to load settings:", err);
      }
    }
    fetchData();
  }, []);

  const toggleSetting = async (
    key: keyof Pick<
      UserSettings,
      "data_sharing_enabled" | "ai_training_consent" | "store_chat_history"
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

  const setRetention = async (period: string) => {
    if (!settings) return;
    setSettings({ ...settings, memory_retention_period: period });
    try {
      setLoading(true);
      const updated = await updateAllSettings({ memory_retention_period: period });
      setSettings(updated);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const privacyToggles = [
    {
      key: "store_chat_history" as const,
      label: "Persist Conversation History",
      desc: "Retain your chat queries locally to maintain context across multi-turn reasoning",
      icon: History,
    },
    {
      key: "data_sharing_enabled" as const,
      label: "Anonymous Telemetry & Diagnostics",
      desc: "Share strictly anonymized performance statistics to improve vector retrieval speed",
      icon: EyeOff,
    },
    {
      key: "ai_training_consent" as const,
      label: "Model Training Opt-out",
      desc: "Never allow external AI providers to use your personal knowledge graph for training",
      icon: Lock,
    },
  ];

  const retentionPeriods = [
    { id: "30_days", label: "30 Days" },
    { id: "90_days", label: "90 Days" },
    { id: "1_year", label: "1 Year" },
    { id: "forever", label: "Indefinite" },
  ];

  return (
    <AppLayout>
      <div className="p-8 max-w-[650px] mx-auto">
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
            <ChevronLeft size={20} className="text-white" />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-white">Privacy & Isolation</h1>
            <p className="text-sm mt-1" style={{ color: "var(--text-secondary)" }}>
              Control tenant data isolation, retention policies, and model access limits
            </p>
          </div>
        </motion.div>

        {/* Toggles */}
        <div className="space-y-4 mb-8">
          {privacyToggles.map((item, index) => {
            const Icon = item.icon;
            const isEnabled = settings ? !!settings[item.key] : true;
            return (
              <motion.div
                key={item.key}
                className="p-5 rounded-2xl flex items-center justify-between transition-colors"
                style={{
                  background: "var(--bg-card)",
                  border: "1px solid var(--border)",
                }}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05, duration: 0.3 }}
              >
                <div className="flex items-start gap-4">
                  <div
                    className="p-2.5 rounded-xl mt-0.5"
                    style={{ background: "rgba(240,165,0,0.15)", color: "#f0a500" }}
                  >
                    <Icon size={20} />
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-white">{item.label}</h3>
                    <p className="text-xs mt-1 max-w-[400px]" style={{ color: "var(--text-secondary)" }}>
                      {item.desc}
                    </p>
                  </div>
                </div>

                <button
                  onClick={() => toggleSetting(item.key)}
                  disabled={loading || !settings}
                  className={`relative w-12 h-6 rounded-full transition-colors duration-200 focus:outline-none flex-shrink-0 ${
                    isEnabled ? "bg-[var(--accent)]" : "bg-[var(--bg-elevated)]"
                  }`}
                  style={{
                    border: "1px solid var(--border)",
                  }}
                >
                  <span
                    className={`inline-block w-4 h-4 transform bg-white rounded-full transition-transform duration-200 ease-in-out ${
                      isEnabled ? "translate-x-7" : "translate-x-1"
                    }`}
                    style={{ marginTop: 3 }}
                  />
                </button>
              </motion.div>
            );
          })}
        </div>

        {/* Retention Period */}
        <div
          className="p-5 rounded-2xl"
          style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}
        >
          <div className="flex items-center gap-3 mb-3">
            <Clock size={18} style={{ color: "var(--accent)" }} />
            <h3 className="text-sm font-semibold text-white">Memory Retention Horizon</h3>
          </div>
          <p className="text-xs mb-4" style={{ color: "var(--text-secondary)" }}>
            Automatically archive or prune memories that have not been reinforced or recalled within this duration.
          </p>
          <div className="grid grid-cols-4 gap-2.5">
            {retentionPeriods.map((period) => {
              const isSelected = (settings?.memory_retention_period || "forever") === period.id;
              return (
                <button
                  key={period.id}
                  onClick={() => setRetention(period.id)}
                  className={`py-2 px-3 rounded-xl text-xs font-medium transition-all ${
                    isSelected
                      ? "bg-[var(--accent)] text-white shadow-sm"
                      : "bg-[var(--bg-elevated)] text-[var(--text-secondary)] hover:text-white"
                  }`}
                >
                  {period.label}
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
