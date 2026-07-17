"use client";

import AppLayout from "@/components/layout/AppLayout";
import { motion } from "framer-motion";
import { useState, useEffect } from "react";
import { ChevronLeft, Volume2, VolumeX } from "lucide-react";
import { useRouter } from "next/navigation";
import { getAllSettings, updateAllSettings, UserSettings } from "@/lib/api";

export default function SoundSettingsPage() {
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

  const toggleSound = async () => {
    if (!settings) return;
    const newValue = !settings.sound_enabled;
    setSettings({ ...settings, sound_enabled: newValue });
    try {
      setLoading(true);
      const updated = await updateAllSettings({ sound_enabled: newValue });
      setSettings(updated);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

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
            <h1 className="text-2xl font-bold text-white">Sound Effects</h1>
            <p className="text-sm mt-1" style={{ color: "var(--text-secondary)" }}>
              Toggle UI sound effects
            </p>
          </div>
        </motion.div>

        <motion.div
          className="card p-5 flex items-center gap-4"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <div
            className="w-10 h-10 rounded-lg flex items-center justify-center"
            style={{ background: "#e8439318" }}
          >
            {settings?.sound_enabled ? (
              <Volume2 size={20} style={{ color: "#e84393" }} />
            ) : (
              <VolumeX size={20} style={{ color: "#e84393" }} />
            )}
          </div>
          <div className="flex-1">
            <h3 className="text-white font-semibold">Enable Sound Effects</h3>
            <p className="text-sm" style={{ color: "var(--text-muted)" }}>
              Play sounds for UI interactions
            </p>
          </div>
          <div
            onClick={toggleSound}
            className="w-12 h-6 rounded-full relative cursor-pointer transition-colors"
            style={{
              background: settings?.sound_enabled ? "var(--accent)" : "var(--bg-elevated)",
              border: `1px solid ${settings?.sound_enabled ? "var(--accent)" : "var(--border)"}`,
              padding: "2px",
            }}
          >
            <div
              className="w-5 h-5 rounded-full bg-white absolute top-0.5 transition-all"
              style={{ left: settings?.sound_enabled ? "calc(100% - 22px)" : "2px" }}
            />
          </div>
        </motion.div>
      </div>
    </AppLayout>
  );
}
