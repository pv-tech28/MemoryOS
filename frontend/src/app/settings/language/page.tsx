"use client";

import AppLayout from "@/components/layout/AppLayout";
import { motion } from "framer-motion";
import { useState, useEffect } from "react";
import { ChevronLeft, Globe } from "lucide-react";
import { useRouter } from "next/navigation";
import { getAllSettings, updateAllSettings, UserSettings } from "@/lib/api";

const languages = [
  { code: "en", name: "English" },
  { code: "hi", name: "Hindi" },
  { code: "fr", name: "French" },
  { code: "de", name: "German" },
  { code: "es", name: "Spanish" },
  { code: "ja", name: "Japanese" },
  { code: "zh", name: "Chinese" },
];

export default function LanguageSettingsPage() {
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

  const handleSelectLanguage = async (code: string) => {
    if (!settings) return;
    setSettings({ ...settings, language: code });
    try {
      setLoading(true);
      const updated = await updateAllSettings({ language: code });
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
            <h1 className="text-2xl font-bold text-white">Language</h1>
            <p className="text-sm mt-1" style={{ color: "var(--text-secondary)" }}>
              Choose your preferred language
            </p>
          </div>
        </motion.div>

        <div className="space-y-3">
          {languages.map((lang, i) => (
            <motion.div
              key={lang.code}
              onClick={() => handleSelectLanguage(lang.code)}
              className={`card p-5 flex items-center gap-4 cursor-pointer transition-all ${
                settings?.language === lang.code ? "ring-2 ring-[var(--accent)]" : ""
              }`}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
            >
              <div
                className="w-10 h-10 rounded-lg flex items-center justify-center"
                style={{ background: "#4facfe18" }}
              >
                <Globe size={20} style={{ color: "#4facfe" }} />
              </div>
              <div className="flex-1">
                <h3 className="text-white font-semibold">{lang.name}</h3>
              </div>
              {settings?.language === lang.code && (
                <div
                  className="w-5 h-5 rounded-full bg-[var(--accent)] flex items-center justify-center"
                >
                  <div className="w-2.5 h-2.5 rounded-full bg-white"></div>
                </div>
              )}
            </motion.div>
          ))}
        </div>
      </div>
    </AppLayout>
  );
}
