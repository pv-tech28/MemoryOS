"use client";

import AppLayout from "@/components/layout/AppLayout";
import { motion } from "framer-motion";
import { useState, useEffect } from "react";
import { ChevronLeft, HardDrive, FileText, Brain, GitCommit, Database, Download } from "lucide-react";
import { useRouter } from "next/navigation";
import { getStorageStats, StorageStats } from "@/lib/api";

export default function DataStoragePage() {
  const router = useRouter();
  const [stats, setStats] = useState<StorageStats | null>(null);

  useEffect(() => {
    async function fetchData() {
      const s = await getStorageStats();
      setStats(s);
    }
    fetchData();
  }, []);

  const statItems = [
    {
      label: "Documents Uploaded",
      value: stats?.documents_uploaded || 0,
      icon: FileText,
      color: "#4facfe",
    },
    {
      label: "Memories Stored",
      value: stats?.memories_stored || 0,
      icon: Brain,
      color: "#6c5ce7",
    },
    {
      label: "Memory Nodes",
      value: stats?.memory_nodes || 0,
      icon: Database,
      color: "#00d68f",
    },
    {
      label: "Graph Connections",
      value: stats?.graph_connections || 0,
      icon: GitCommit,
      color: "#f0a500",
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
            <h1 className="text-2xl font-bold text-white">Data & Storage</h1>
            <p className="text-sm mt-1" style={{ color: "var(--text-secondary)" }}>
              View your usage statistics
            </p>
          </div>
        </motion.div>

        {/* Storage Used */}
        <motion.div
          className="card p-6 mb-8"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <div className="flex items-center gap-4 mb-4">
            <div
              className="w-10 h-10 rounded-lg flex items-center justify-center"
              style={{ background: "#6c5ce718" }}
            >
              <HardDrive size={20} style={{ color: "#6c5ce7" }} />
            </div>
            <div>
              <h3 className="text-white font-semibold">Storage Used</h3>
              <p className="text-sm" style={{ color: "var(--text-muted)" }}>
                {stats?.storage_used_mb.toFixed(2) || "0.00"} MB
              </p>
            </div>
          </div>
          <div className="w-full h-3 rounded-full bg-[var(--bg-elevated)] overflow-hidden">
            <div
              className="h-full rounded-full"
              style={{
                width: `${Math.min(((stats?.storage_used_mb || 0) / 1000) * 100, 100)}%`,
                background: "linear-gradient(90deg, #6c5ce7, #4facfe)",
              }}
            />
          </div>
        </motion.div>

        {/* Statistics Grid */}
        <div className="grid grid-cols-2 gap-4 mb-8">
          {statItems.map((item, i) => {
            const Icon = item.icon;
            return (
              <motion.div
                key={item.label}
                className="card p-5"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.1 }}
              >
                <div
                  className="w-10 h-10 rounded-lg flex items-center justify-center mb-3"
                  style={{ background: item.color + "18" }}
                >
                  <Icon size={20} style={{ color: item.color }} />
                </div>
                <p className="text-2xl font-bold text-white">{item.value}</p>
                <p className="text-xs" style={{ color: "var(--text-muted)" }}>
                  {item.label}
                </p>
              </motion.div>
            );
          })}
        </div>

        {/* Export Buttons */}
        <motion.div
          className="space-y-4"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.4 }}
        >
          <button className="w-full py-3 rounded-xl border border-[var(--border)] text-white hover:bg-[var(--bg-card)] transition-colors flex items-center justify-center gap-2">
            <Download size={18} />
            Export Memory Data
          </button>
          <button className="w-full py-3 rounded-xl border border-[var(--border)] text-white hover:bg-[var(--bg-card)] transition-colors flex items-center justify-center gap-2">
            <Download size={18} />
            Download Settings Backup
          </button>
        </motion.div>
      </div>
    </AppLayout>
  );
}
