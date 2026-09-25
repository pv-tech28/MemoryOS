"use client";

import Link from "next/link";
import AppLayout from "@/components/layout/AppLayout";
import { motion } from "framer-motion";
import { useState, useEffect } from "react";
import {
  Upload,
  FileText,
  Image,
  Mic,
  FolderUp,
  Trash2,
  Mail,
  HardDrive,
  Calendar,
  Database,
  ArrowRight,
  CheckCircle2,
  Loader2,
} from "lucide-react";
import { 
  getDocuments, 
  deleteDocument, 
  syncGmail, 
  syncDrive, 
  syncCalendar,
  checkAuthStatus,
  getCookie,
  loginWithGoogle,
} from "@/lib/api";
import { useAuth } from "@/lib/auth";

interface Document {
  id: string;
  filename: string;
  uploaded_at?: string;
  upload_date?: string;
  page_count: number;
  chunk_count: number;
}

const uploadZones = [
  {
    icon: FileText,
    title: "Upload PDF / Docs",
    desc: "Drag & drop files here or click to browse",
    color: "#60a5fa",
    isPdf: true,
  },
  {
    icon: Image,
    title: "Upload Images",
    desc: "Drag & drop images here or click to browse",
    color: "#f472b6",
    isPdf: true,
  },
  {
    icon: Mic,
    title: "Upload Audio",
    desc: "Drag & drop audio files here or click to browse",
    color: "#fbbf24",
    isPdf: true,
  },
  {
    icon: FolderUp,
    title: "Upload Folder",
    desc: "Upload a folder from your device",
    color: "#34d399",
    isPdf: true,
  },
];

const sourceIntegrations = [
  {
    name: "Gmail",
    icon: Mail,
    color: "#f87171",
    desc: "Sync your email threads and attachments",
    syncFn: syncGmail,
  },
  {
    name: "Google Drive",
    icon: HardDrive,
    color: "#60a5fa",
    desc: "Index your documents and files",
    syncFn: syncDrive,
  },
  {
    name: "Google Calendar",
    icon: Calendar,
    color: "#34d399",
    desc: "Import your events and meetings",
    syncFn: syncCalendar,
  },
];

const fadeUp = {
  hidden: { opacity: 0, y: 24 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.06, duration: 0.45, ease: "easeOut" as const },
  }),
};

export default function SourcesPage() {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState<string | null>(null);
  const [syncMessage, setSyncMessage] = useState<string | null>(null);
  const [hasGoogle, setHasGoogle] = useState(false);
  const [authStatusLoading, setAuthStatusLoading] = useState(true);
  const { user, signInWithGoogle } = useAuth();

  useEffect(() => {
    let cancelled = false;
    async function fetchData() {
      try {
        const docs = await getDocuments();
        if (!cancelled) setDocuments(docs.documents || []);
      } catch (error) {
        console.error("Failed to fetch data:", error);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    async function fetchAuthStatus() {
      try {
        const status = await checkAuthStatus();
        if (!cancelled) setHasGoogle(status.has_google);
        return status;
      } catch (error) {
        console.error("Failed to fetch auth status:", error);
        if (!cancelled) setHasGoogle(false);
        return { has_google: false };
      } finally {
        if (!cancelled) setAuthStatusLoading(false);
      }
    }
    fetchData();
    const hasBackendCookie = typeof window !== "undefined" && !!getCookie("evolve_auth_token");
    const isGoogleSignIn = user?.app_metadata?.provider === "google";

    if (user || hasBackendCookie) {
      const justLoggedInViaSupabase =
        typeof window !== "undefined" &&
        !sessionStorage.getItem("evolve_google_welcomed") &&
        isGoogleSignIn;

      fetchAuthStatus().then((status) => {
        if (cancelled) return;
        if (justLoggedInViaSupabase) {
          try { sessionStorage.setItem("evolve_google_welcomed", "1"); } catch (_) { /* noop */ }
          setTimeout(() => {
            if (cancelled) return;
            setSyncMessage(
              status?.has_google
                ? "Google connected successfully! You can now sync Gmail, Drive, and Calendar."
                : "Google sign in completed. If sources still show 'Connect Google', click Sync once more."
            );
          }, 900);
        }
      });
    } else {
      setHasGoogle(false);
      setAuthStatusLoading(false);
    }

    // If returning from backend OAuth connect flow, acknowledge the success
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      if (params.get("google_connected") === "1") {
        // Clean the URL (strip query param so it doesn't persist on reload)
        const cleanUrl = window.location.pathname;
        window.history.replaceState({}, document.title, cleanUrl);
        // Re-check with backend after a brief delay to ensure credentials persisted
        setTimeout(async () => {
          if (cancelled) return;
          try {
            const status = await fetchAuthStatus();
            if (cancelled) return;
            setSyncMessage(
              status?.has_google
                ? "Google connected successfully! You can now sync Gmail, Drive, and Calendar."
                : "Google connect completed. If sources still show 'Connect Google', please click it once more."
            );
          } catch {
            if (!cancelled) {
              setSyncMessage(
                "Google connect completed. If sources still show 'Connect Google', please click it once more."
              );
            }
          }
        }, 800);
      }
    }

    return () => { cancelled = true; };
  }, [user]);

  const handleDelete = async (docId: string) => {
    try {
      await deleteDocument(docId);
      setDocuments(documents.filter(d => d.id !== docId));
    } catch (error) {
      console.error("Failed to delete document:", error);
    }
  };

  const handleSync = async (sourceName: string, syncFn: () => Promise<any>) => {
    if (!user || !hasGoogle) {
      setSyncing(sourceName);
      setSyncMessage("Redirecting to Google to connect sources...");
      try {
        console.log("[Sources] Connecting Google via OAuth...");
        await loginWithGoogle(window.location.href, user?.id);
      } catch (err: any) {
        console.error("[Sources] Failed to connect:", err);
        setSyncing(null);
        setSyncMessage(`Failed to connect Google: ${err?.message ?? String(err)}`);
      }
      return;
    }
    
    try {
      setSyncing(sourceName);
      setSyncMessage(`Syncing ${sourceName}... Please wait.`);
      const result = await syncFn();
      setSyncMessage(result.message || `Successfully synced ${sourceName}!`);
      
      // Refresh documents after sync
      const docs = await getDocuments();
      setDocuments(docs.documents || []);
    } catch (error: any) {
      console.error(`Failed to sync ${sourceName}:`, error);
      const msg = error?.message ?? String(error);
      if (
        msg.includes("Not authenticated with Google") ||
        msg.includes("401") ||
        msg.includes("authentication has expired") ||
        msg.includes("reconnect") ||
        msg.includes("expired")
      ) {
        setHasGoogle(false);
        setSyncMessage(
          "Google credentials missing or expired — please click 'Connect Google' to reconnect."
        );
      } else {
        setSyncMessage(`Failed to sync ${sourceName}: ${msg}`);
      }
    } finally {
      setSyncing(null);
    }
  };

  return (
    <AppLayout>
      <div className="p-6 lg:p-8 max-w-[1200px] mx-auto">
        {/* Header */}
        <motion.div
          className="mb-8"
          initial={{ opacity: 0, y: -12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
        >
          <div className="flex items-center gap-3 mb-1">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{
              background: 'rgba(34, 211, 238, 0.1)',
              border: '1px solid rgba(34, 211, 238, 0.15)',
            }}>
              <Database size={18} style={{ color: '#22d3ee' }} />
            </div>
            <h1 className="text-2xl font-bold text-white">Sources</h1>
          </div>
          <p className="text-sm mt-1 ml-12" style={{ color: "var(--text-secondary)" }}>
            Connect and manage all your data sources
          </p>
        </motion.div>

        {/* Source Integrations */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
          {sourceIntegrations.map((source, i) => {
            const Icon = source.icon;
            return (
              <motion.div
                key={source.name}
                className="p-5 rounded-2xl group"
                style={{
                  background: `linear-gradient(135deg, ${source.color}08, ${source.color}03)`,
                  border: `1px solid ${source.color}15`,
                  backdropFilter: 'blur(8px)',
                }}
                custom={i}
                initial="hidden"
                animate="visible"
                variants={fadeUp}
                whileHover={{ y: -2, borderColor: `${source.color}30` }}
              >
                <div className="flex items-start justify-between mb-4">
                  <div
                    className="w-12 h-12 rounded-xl flex items-center justify-center transition-transform group-hover:scale-110"
                    style={{
                      background: `${source.color}12`,
                      border: `1px solid ${source.color}20`,
                    }}
                  >
                    <Icon size={22} style={{ color: source.color }} />
                  </div>
                  {!authStatusLoading && hasGoogle && (
                    <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-semibold" style={{
                      background: 'rgba(52, 211, 153, 0.08)',
                      border: '1px solid rgba(52, 211, 153, 0.15)',
                      color: '#34d399',
                    }}>
                      <CheckCircle2 size={11} />
                      Connected
                    </span>
                  )}
                </div>

                <h3 className="text-sm font-semibold text-white mb-1">
                  {source.name}
                </h3>
                <p className="text-xs text-slate-500 mb-4">{source.desc}</p>

                <motion.button
                  onClick={() => handleSync(source.name, source.syncFn)}
                  disabled={syncing === source.name}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  className="w-full py-2.5 rounded-xl text-xs font-semibold transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                  style={
                    hasGoogle
                      ? {
                          background: "linear-gradient(135deg, #7c5cfc, #6366f1)",
                          color: "#fff",
                          boxShadow: "0 4px 16px rgba(124,92,252,0.25)",
                        }
                      : {
                          background: "rgba(148, 163, 184, 0.04)",
                          border: "1px solid rgba(148, 163, 184, 0.08)",
                          color: "var(--text-secondary)",
                        }
                  }
                >
                  {syncing === source.name ? (
                    <>
                      <Loader2 size={13} className="animate-spin" />
                      {hasGoogle ? "Syncing..." : "Connecting..."}
                    </>
                  ) : (
                    <>
                      {hasGoogle ? "Sync Now" : "Connect Google"}
                      <ArrowRight size={13} />
                    </>
                  )}
                </motion.button>
              </motion.div>
            );
          })}
        </div>

        {syncMessage && (
          <motion.div 
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-6 p-4 rounded-xl"
            style={{
              background: syncMessage.includes("success") || syncMessage.includes("Successfully")
                ? 'rgba(52, 211, 153, 0.06)'
                : 'rgba(148, 163, 184, 0.04)',
              border: syncMessage.includes("success") || syncMessage.includes("Successfully")
                ? '1px solid rgba(52, 211, 153, 0.12)'
                : '1px solid rgba(148, 163, 184, 0.06)',
            }}
          >
            <p className="text-xs" style={{ color: "var(--text-secondary)" }}>
              {syncMessage}
            </p>
          </motion.div>
        )}

        {/* Upload Section */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25, duration: 0.5 }}
          className="mb-8"
        >
          <h2 className="text-base font-semibold text-white mb-4 flex items-center gap-2">
            <Upload size={16} className="text-violet-400" />
            Upload New Source
          </h2>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {uploadZones.map((zone, i) => {
              const ZoneIcon = zone.icon;
              const cardContent = (
                <motion.div
                  className="rounded-2xl p-5 flex flex-col items-center justify-center gap-3 cursor-pointer text-center h-full"
                  style={{
                    border: "1px dashed rgba(148, 163, 184, 0.1)",
                    background: "rgba(14, 14, 32, 0.3)",
                    backdropFilter: "blur(8px)",
                    minHeight: 150,
                  }}
                  whileHover={{
                    borderColor: `${zone.color}40`,
                    background: "rgba(14, 14, 32, 0.5)",
                    y: -2,
                  }}
                  transition={{ duration: 0.2 }}
                >
                  <div
                    className="w-11 h-11 rounded-xl flex items-center justify-center"
                    style={{
                      background: `${zone.color}10`,
                      border: `1px solid ${zone.color}18`,
                    }}
                  >
                    <ZoneIcon size={20} style={{ color: zone.color }} />
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-white">
                      {zone.title}
                    </p>
                    <p className="text-[10px] mt-1 leading-snug text-slate-600">
                      {zone.desc}
                    </p>
                  </div>
                  {zone.isPdf && (
                    <Upload size={13} className="text-slate-600 mt-1" />
                  )}
                </motion.div>
              );

              return zone.isPdf ? (
                <Link href="/upload" key={zone.title} className="block h-full">
                  {cardContent}
                </Link>
              ) : (
                <div key={zone.title} className="h-full">
                  {cardContent}
                </div>
              );
            })}
          </div>
        </motion.div>

        {/* Uploaded Documents Section */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4, duration: 0.5 }}
        >
          <h2 className="text-base font-semibold text-white mb-4 flex items-center gap-2">
            <FileText size={16} className="text-blue-400" />
            Uploaded Documents
            <span className="text-xs px-2 py-0.5 rounded-full font-mono" style={{
              background: 'rgba(148, 163, 184, 0.06)',
              color: 'var(--text-muted)',
            }}>{documents.length}</span>
          </h2>
          {loading ? (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {Array(3).fill(0).map((_, i) => (
                <div key={i} className="h-28 rounded-2xl shimmer" style={{
                  background: 'rgba(148, 163, 184, 0.03)',
                  border: '1px solid rgba(148, 163, 184, 0.05)',
                }} />
              ))}
            </div>
          ) : documents.length === 0 ? (
            <div className="py-12 text-center rounded-2xl" style={{
              background: 'rgba(14, 14, 32, 0.3)',
              border: '1px solid rgba(148, 163, 184, 0.05)',
            }}>
              <FileText className="mx-auto mb-3 text-slate-700" size={32} />
              <p className="text-sm text-slate-500">No documents uploaded yet</p>
              <p className="text-xs text-slate-600 mt-1">Upload a file above to get started</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {documents.map((doc, i) => (
                <motion.div
                  key={doc.id}
                  className="p-4 rounded-2xl group"
                  style={{
                    background: "rgba(14, 14, 32, 0.4)",
                    border: "1px solid rgba(148, 163, 184, 0.05)",
                    backdropFilter: "blur(8px)",
                  }}
                  custom={i}
                  initial="hidden"
                  animate="visible"
                  variants={fadeUp}
                  whileHover={{ y: -2, borderColor: "rgba(96, 165, 250, 0.15)" }}
                >
                  <div className="flex items-start justify-between mb-3">
                    <div
                      className="w-10 h-10 rounded-xl flex items-center justify-center"
                      style={{
                        background: "rgba(96, 165, 250, 0.1)",
                        border: "1px solid rgba(96, 165, 250, 0.15)",
                      }}
                    >
                      <FileText size={18} style={{ color: "#60a5fa" }} />
                    </div>
                    <button
                      onClick={() => handleDelete(doc.id)}
                      className="p-1.5 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-500/10"
                    >
                      <Trash2 size={14} style={{ color: "#f87171" }} />
                    </button>
                  </div>

                  <h3 className="text-sm font-semibold text-white truncate mb-2">
                    {doc.filename}
                  </h3>

                  <div className="flex flex-wrap gap-2">
                    <span className="text-[10px] px-2.5 py-1 rounded-full font-medium" style={{
                      background: 'rgba(148, 163, 184, 0.05)',
                      color: 'var(--text-secondary)',
                      border: '1px solid rgba(148, 163, 184, 0.06)',
                    }}>
                      {doc.page_count} pages
                    </span>
                    <span className="text-[10px] px-2.5 py-1 rounded-full font-medium" style={{
                      background: 'rgba(148, 163, 184, 0.05)',
                      color: 'var(--text-secondary)',
                      border: '1px solid rgba(148, 163, 184, 0.06)',
                    }}>
                      {doc.chunk_count} chunks
                    </span>
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </motion.div>
      </div>
    </AppLayout>
  );
}
