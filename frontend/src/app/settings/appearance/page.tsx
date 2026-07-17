"use client";

import AppLayout from "@/components/layout/AppLayout";
import { motion } from "framer-motion";
import { useState, useEffect } from "react";
import { ChevronLeft, Moon, Sun, Monitor } from "lucide-react";
import { useRouter } from "next/navigation";
import { getAllSettings, updateAllSettings, UserSettings } from "@/lib/api";

type Theme = "dark" | "light" | "system";

export default function AppearanceSettingsPage() {
  const router = useRouter();
  const [settings, setSettings] = useState<UserSettings | null>(null);
  const [selectedTheme, setSelectedTheme] = useState<Theme>("dark");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    async function fetchData() {
      const s = await getAllSettings();
      setSettings(s);
      setSelectedTheme(s.theme as Theme);
      applyTheme(s.theme as Theme);
    }
    fetchData();
  }, []);

  const applyTheme = (theme: Theme) => {
    let effectiveTheme = theme;
    if (theme === "system") {
      effectiveTheme = window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
    }

    document.documentElement.setAttribute("data-theme", effectiveTheme);
    if (effectiveTheme === "light") {
      // Set light theme variables
      document.documentElement.style.setProperty("--bg-primary", "#ffffff");
      document.documentElement.style.setProperty("--text-primary", "#000000");
    } else {
      // Set dark theme variables
      document.documentElement.style.setProperty("--bg-primary", "#0a0a0f");
      document.documentElement.style.setProperty("--text-primary", "#ffffff");
    }
  };

  const handleThemeSelect = async (theme: Theme) => {
    setLoading(true);
    setSelectedTheme(theme);
    try {
      const updated = await updateAllSettings({ theme });
      setSettings(updated);
      applyTheme(theme);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const themes: { value: Theme; label: string; icon: any; description: string }[] = [
    { value: "dark", label: "Dark", icon: Moon, description: "Use dark theme" },
    { value: "light", label: "Light", icon: Sun, description: "Use light theme" },
    { value: "system", label: "System", icon: Monitor, description: "Follow system theme" },
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
            <h1 className="text-2xl font-bold text-white">Appearance</h1>
            <p className="text-sm mt-1" style={{ color: "var(--text-secondary)" }}>
              Customize your interface
            </p>
          </div>
        </motion.div>

        <div className="space-y-4">
          {themes.map((theme, i) => {
            const Icon = theme.icon;
            return (
              <motion.div
                key={theme.value}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.1 }}
                onClick={() => handleThemeSelect(theme.value)}
                className={`card p-5 flex items-center gap-4 cursor-pointer transition-all ${
                  selectedTheme === theme.value
                    ? "ring-2 ring-[var(--accent)]"
                    : ""
                }`}
              >
                <div
                  className="w-10 h-10 rounded-lg flex items-center justify-center"
                  style={{ background: "#6c5ce718" }}
                >
                  <Icon size={20} style={{ color: "#6c5ce7" }} />
                </div>
                <div className="flex-1">
                  <h3 className="text-white font-semibold">{theme.label}</h3>
                  <p className="text-sm" style={{ color: "var(--text-muted)" }}>
                    {theme.description}
                  </p>
                </div>
                {selectedTheme === theme.value && (
                  <div
                    className="w-5 h-5 rounded-full bg-[var(--accent)] flex items-center justify-center"
                  >
                    <div className="w-2.5 h-2.5 rounded-full bg-white"></div>
                  </div>
                )}
              </motion.div>
            );
          })}
        </div>
      </div>
    </AppLayout>
  );
}
