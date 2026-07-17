"use client";

import AppLayout from "@/components/layout/AppLayout";
import { motion } from "framer-motion";
import { useState, useEffect } from "react";
import { ChevronLeft, Mail, HardDrive, Calendar, RefreshCw, Link2, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { getConnectedSources, syncSource, disconnectSource, ConnectedSources } from "@/lib/api";

export default function ConnectedSourcesPage() {
  const router = useRouter();
  const [sources, setSources] = useState<ConnectedSources | null>(null);
  const [loading, setLoading] = useState<Record<string, boolean>>({});

  useEffect(() => {
    async function fetchData() {
      const s = await getConnectedSources();
      setSources(s);
    }
    fetchData();
  }, []);

  const handleSync = async (source: string) => {
    setLoading(prev => ({ ...prev, [source]: true }));
    try {
      await syncSource(source);
      const updated = await getConnectedSources();
      setSources(updated);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(prev => ({ ...prev, [source]: false }));
    }
  };

  const handleDisconnect = async (source: string) => {
    if (confirm(`Are you sure you want to disconnect ${source}?`)) {
      setLoading(prev => ({ ...prev, [source]: true }));
      try {
        await disconnectSource(source);
        const updated = await getConnectedSources();
        setSources(updated);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(prev => ({ ...prev, [source]: false }));
      }
    }
  };

  const sourceInfo = [
    { id: "gmail", name: "Gmail", icon: Mail, color: "#ea4335" },
    { id: "drive", name: "Google Drive", icon: HardDrive, color: "#4285f4" },
    { id: "calendar", name: "Google Calendar", icon: Calendar, color: "#fbbc04" },
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
            <h1 className="text-2xl font-bold text-white">Connected Sources</h1>
            <p className="text-sm mt-1" style={{ color: "var(--text-secondary)" }}>
              Manage your data sources
            </p>
          </div>
        </motion.div>

        <div className="space-y-4">
          {sourceInfo.map((source, i) => {
            const Icon = source.icon;
            const data = sources ? sources[source.id as keyof ConnectedSources] : null;
            return (
              <motion.div
                key={source.id}
                className="card p-5"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.1 }}
              >
                <div className="flex items-center gap-4 mb-4">
                  <div
                    className="w-10 h-10 rounded-lg flex items-center justify-center"
                    style={{ background: source.color + "18" }}
                  >
                    <Icon size={20} style={{ color: source.color }} />
                  </div>
                  <div className="flex-1">
                    <h3 className="text-white font-semibold">{source.name}</h3>
                    <p className="text-sm" style={{ color: "var(--text-muted)" }}>
                      {data?.count ? `${data.count} items synced` : "Not connected"}
                    </p>
                  </div>
                  <span
                    className={`px-3 py-1 rounded-full text-xs font-semibold ${
                      data?.connected ? "bg-green-500/10 text-green-500" : "bg-red-500/10 text-red-500"
                    }`}
                  >
                    {data?.connected ? "Connected" : "Disconnected"}
                  </span>
                </div>

                <div className="flex gap-3">
                  {data?.connected && (
                    <>
                      <button
                        onClick={() => handleSync(source.id)}
                        disabled={loading[source.id]}
                        className="flex-1 py-2 px-4 rounded-lg border border-[var(--border)] text-white hover:bg-[var(--bg-card)] transition-colors flex items-center justify-center gap-2"
                      >
                        <RefreshCw
                          size={16}
                          className={loading[source.id] ? "animate-spin" : ""}
                        />
                        Sync Now
                      </button>
                      <button
                        onClick={() => handleDisconnect(source.id)}
                        disabled={loading[source.id]}
                        className="py-2 px-4 rounded-lg border border-red-500/50 text-red-500 hover:bg-red-500/10 transition-colors"
                      >
                        <X size={16} />
                      </button>
                    </>
                  )}
                  {!data?.connected && (
                    <button
                      className="flex-1 py-2 px-4 rounded-lg bg-[var(--accent)] text-white hover:opacity-90 transition-opacity flex items-center justify-center gap-2"
                      onClick={() => window.location.href = "http://localhost:8000/api/auth/google/login"}
                    >
                      <Link2 size={16} />
                      Connect
                    </button>
                  )}
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>
    </AppLayout>
  );
}
