"use client";

import AppLayout from "@/components/layout/AppLayout";
import { motion } from "framer-motion";
import { useState, useEffect } from "react";
import {
  ChevronLeft,
  Bot,
  Sliders,
  Sparkles,
  Check,
  CheckCircle,
  Cpu,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { getAllSettings, updateAllSettings, UserSettings } from "@/lib/api";

export default function AISettingsPage() {
  const router = useRouter();
  const [settings, setSettings] = useState<UserSettings | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

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

  const handleUpdate = async (patch: Partial<UserSettings>) => {
    if (!settings) return;
    setSettings({ ...settings, ...patch });
    try {
      setSaving(true);
      const updated = await updateAllSettings(patch);
      setSettings(updated);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 2000);
    } catch (err) {
      console.error("Failed to save AI setting:", err);
    } finally {
      setSaving(false);
    }
  };

  const providers = [
    {
      id: "openrouter" as const,
      name: "OpenRouter (Recommended)",
      desc: "Unified routing to frontier models (DeepSeek, Claude, Llama 3)",
      badge: "Fast & Robust",
    },
    {
      id: "deepseek" as const,
      name: "DeepSeek V3",
      desc: "High-intelligence reasoning optimized for dense code and retrieval",
      badge: "High Reasoning",
    },
    {
      id: "gemini" as const,
      name: "Google Gemini 2.5 Flash",
      desc: "Ultra-fast multimodal context engine with extensive token window",
      badge: "Fastest",
    },
  ];

  const responseLengths = [
    { id: "short" as const, label: "Concise", desc: "Short, direct, bullet-focused answers" },
    { id: "medium" as const, label: "Balanced", desc: "Detailed yet easy to skim answers" },
    { id: "detailed" as const, label: "Comprehensive", desc: "In-depth explanations with context citations" },
  ];

  const creativityLevels = [
    { id: "low" as const, label: "Deterministic (0.1)", desc: "Strictly grounded facts, lowest hallucination rate" },
    { id: "medium" as const, label: "Balanced (0.4)", desc: "Natural phrasing with high factual grounding" },
    { id: "high" as const, label: "Creative (0.7)", desc: "Associative reasoning across broad memory domains" },
  ];

  return (
    <AppLayout>
      <div className="p-8 max-w-[650px] mx-auto">
        <motion.div
          className="mb-8 flex items-center justify-between"
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <div className="flex items-center gap-3">
            <button
              onClick={() => router.back()}
              className="p-2 rounded-lg hover:bg-[var(--bg-card)] transition-colors"
            >
              <ChevronLeft size={20} className="text-white" />
            </button>
            <div>
              <h1 className="text-2xl font-bold text-white">AI Engine Settings</h1>
              <p className="text-sm mt-1" style={{ color: "var(--text-secondary)" }}>
                Configure model providers, synthesis parameters, and response behavior
              </p>
            </div>
          </div>

          {saveSuccess && (
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium"
              style={{ background: "rgba(0,214,143,0.15)", color: "#00d68f" }}
            >
              <CheckCircle size={13} />
              <span>Saved</span>
            </motion.div>
          )}
        </motion.div>

        {/* AI Provider */}
        <div className="mb-8">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-[var(--text-muted)] mb-3">
            LLM Intelligence Provider
          </h2>
          <div className="space-y-3">
            {providers.map((p) => {
              const isSelected = settings?.ai_provider === p.id;
              return (
                <div
                  key={p.id}
                  onClick={() => handleUpdate({ ai_provider: p.id })}
                  className={`p-4 rounded-2xl flex items-center justify-between cursor-pointer transition-all ${
                    isSelected ? "ring-2 ring-[var(--accent)]" : "hover:border-[var(--border-subtle)]"
                  }`}
                  style={{
                    background: isSelected ? "rgba(108,92,231,0.1)" : "var(--bg-card)",
                    border: "1px solid var(--border)",
                  }}
                >
                  <div className="flex items-center gap-3.5">
                    <div
                      className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
                      style={{
                        background: isSelected ? "var(--accent)" : "rgba(255,255,255,0.05)",
                        color: isSelected ? "#fff" : "var(--text-muted)",
                      }}
                    >
                      <Bot size={18} />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-white">{p.name}</span>
                        <span
                          className="text-[10px] px-2 py-0.5 rounded-md font-semibold"
                          style={{ background: "var(--bg-elevated)", color: "var(--text-secondary)" }}
                        >
                          {p.badge}
                        </span>
                      </div>
                      <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>
                        {p.desc}
                      </p>
                    </div>
                  </div>
                  {isSelected && <Check size={18} style={{ color: "var(--accent)" }} />}
                </div>
              );
            })}
          </div>
        </div>

        {/* Response Length */}
        <div className="mb-8">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-[var(--text-muted)] mb-3">
            Response Synthesis Length
          </h2>
          <div className="grid grid-cols-3 gap-3">
            {responseLengths.map((r) => {
              const isSelected = settings?.response_length === r.id;
              return (
                <div
                  key={r.id}
                  onClick={() => handleUpdate({ response_length: r.id })}
                  className={`p-4 rounded-2xl cursor-pointer transition-all text-center ${
                    isSelected ? "ring-2 ring-[var(--accent)]" : "hover:border-[var(--border-subtle)]"
                  }`}
                  style={{
                    background: isSelected ? "rgba(108,92,231,0.1)" : "var(--bg-card)",
                    border: "1px solid var(--border)",
                  }}
                >
                  <h3 className="text-sm font-semibold text-white mb-1">{r.label}</h3>
                  <p className="text-[11px]" style={{ color: "var(--text-muted)" }}>
                    {r.desc}
                  </p>
                </div>
              );
            })}
          </div>
        </div>

        {/* Creativity / Temperature */}
        <div>
          <h2 className="text-sm font-semibold uppercase tracking-wider text-[var(--text-muted)] mb-3">
            Creativity & Fact Grounding
          </h2>
          <div className="space-y-3">
            {creativityLevels.map((c) => {
              const isSelected = settings?.creativity_level === c.id;
              return (
                <div
                  key={c.id}
                  onClick={() => handleUpdate({ creativity_level: c.id })}
                  className={`p-4 rounded-2xl flex items-center justify-between cursor-pointer transition-all ${
                    isSelected ? "ring-2 ring-[var(--accent)]" : "hover:border-[var(--border-subtle)]"
                  }`}
                  style={{
                    background: isSelected ? "rgba(108,92,231,0.1)" : "var(--bg-card)",
                    border: "1px solid var(--border)",
                  }}
                >
                  <div>
                    <h3 className="text-sm font-semibold text-white">{c.label}</h3>
                    <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>
                      {c.desc}
                    </p>
                  </div>
                  {isSelected && <Check size={18} style={{ color: "var(--accent)" }} />}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
