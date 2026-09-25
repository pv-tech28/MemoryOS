"use client";

import AppLayout from "@/components/layout/AppLayout";
import { motion } from "framer-motion";
import { useState, useEffect } from "react";
import {
  ChevronLeft,
  Cpu,
  Brain,
  Share2,
  Calendar,
  Sparkles,
  RefreshCw,
  Loader2,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { getAllSettings, updateAllSettings, UserSettings } from "@/lib/api";

export default function MemoryPreferencesPage() {
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
      | "auto_memory_extraction"
      | "auto_graph_building"
      | "auto_daily_summary"
      | "auto_source_sync"
      | "auto_ai_insights"
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

  const memoryItems = [
    {
      key: "auto_memory_extraction" as const,
      label: "Autonomous Memory Extraction",
      desc: "Automatically extract key entities, facts, and insights from chat conversations",
      icon: Brain,
    },
    {
      key: "auto_graph_building" as const,
      label: "Real-time Knowledge Graph Synthesis",
      desc: "Automatically map entities and relationships to your interactive memory graph",
      icon: Share2,
    },
    {
      key: "auto_daily_summary" as const,
      label: "Automated Daily Summary Digest",
      desc: "Compile daily insights, timeline activity, and memory growth every evening",
      icon: Calendar,
    },
    {
      key: "auto_source_sync" as const,
      label: "Background Source Indexing",
      desc: "Periodically check and index newly added files from connected cloud accounts",
      icon: RefreshCw,
    },
    {
      key: "auto_ai_insights" as const,
      label: "Proactive AI Suggestions",
      desc: "Surface relevant memories and smart recommendations across topics",
      icon: Sparkles,
    },
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
            <h1 className="text-2xl font-bold text-white">Memory Preferences</h1>
            <p className="text-sm mt-1" style={{ color: "var(--text-secondary)" }}>
              Configure autonomous memory extraction and knowledge graph synthesis
            </p>
          </div>
        </motion.div>

        <div className="space-y-4">
          {memoryItems.map((item, index) => {
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
                    style={{ background: "rgba(108,92,231,0.15)", color: "var(--accent)" }}
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
      </div>
    </AppLayout>
  );
}
