"use client";

import AppLayout from "@/components/layout/AppLayout";
import { motion, AnimatePresence } from "framer-motion";
import { useState, useEffect } from "react";
import {
  ChevronLeft,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Clock,
  Sparkles,
  ArrowRight,
  GitCommit,
  History,
  ShieldAlert,
  Loader2,
  RefreshCw,
  Info,
} from "lucide-react";
import { useRouter } from "next/navigation";
import {
  getMemoryConflicts,
  resolveMemoryConflict,
  getMemoryHistory,
  MemoryConflict,
} from "@/lib/api";

export default function MemoryConflictsPage() {
  const router = useRouter();
  const [conflicts, setConflicts] = useState<MemoryConflict[]>([]);
  const [loading, setLoading] = useState(true);
  const [resolvingId, setResolvingId] = useState<string | null>(null);
  const [historyModalMemoryId, setHistoryModalMemoryId] = useState<string | null>(null);
  const [historyLineage, setHistoryLineage] = useState<any[] | null>(null);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  const fetchConflicts = async () => {
    try {
      setLoading(true);
      const data = await getMemoryConflicts();
      setConflicts(data || []);
    } catch (err: any) {
      console.error("Failed to load memory conflicts:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchConflicts();
  }, []);

  const handleResolve = async (conflictId: string, action: "accept_new" | "keep_existing") => {
    try {
      setResolvingId(conflictId);
      const res = await resolveMemoryConflict(conflictId, action);
      setStatusMessage(
        action === "accept_new"
          ? "Accepted new incoming fact as current active truth. Old memory superseded."
          : "Kept existing memory active. Incoming contradictory fact dismissed."
      );
      // Remove from list
      setConflicts((prev) => prev.filter((c) => c.id !== conflictId));
      setTimeout(() => setStatusMessage(null), 4000);
    } catch (err: any) {
      console.error("Failed to resolve conflict:", err);
      setStatusMessage(`Error: ${err?.message || "Failed to resolve conflict"}`);
    } finally {
      setResolvingId(null);
    }
  };

  const openHistory = async (memoryId: string) => {
    try {
      setHistoryModalMemoryId(memoryId);
      setHistoryLoading(true);
      const res = await getMemoryHistory(memoryId);
      setHistoryLineage(res.lineage || []);
    } catch (err) {
      console.error("Failed to fetch memory lineage:", err);
      setHistoryLineage([]);
    } finally {
      setHistoryLoading(false);
    }
  };

  return (
    <AppLayout>
      <div className="p-8 max-w-[850px] mx-auto">
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
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-bold text-white">Memory Conflicts & Epistemic Evolution</h1>
                {conflicts.length > 0 && (
                  <span
                    className="px-2.5 py-0.5 rounded-full text-xs font-bold"
                    style={{ background: "rgba(235,87,87,0.15)", color: "#eb5757" }}
                  >
                    {conflicts.length} Pending Review
                  </span>
                )}
              </div>
              <p className="text-sm mt-1" style={{ color: "var(--text-secondary)" }}>
                Review facts where incoming information contradicts or updates prior memory beliefs
              </p>
            </div>
          </div>

          <button
            onClick={fetchConflicts}
            className="p-2.5 rounded-xl hover:bg-[var(--bg-card)] transition-colors flex items-center gap-2 text-xs font-semibold text-[var(--text-secondary)] hover:text-white"
            style={{ border: "1px solid var(--border)" }}
          >
            <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
            <span>Refresh</span>
          </button>
        </motion.div>

        {statusMessage && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="mb-6 p-4 rounded-2xl flex items-center gap-3 text-xs font-medium"
            style={{
              background: "rgba(108,92,231,0.15)",
              border: "1px solid rgba(108,92,231,0.3)",
              color: "#a29bfe",
            }}
          >
            <Sparkles size={16} />
            <span>{statusMessage}</span>
          </motion.div>
        )}

        {loading ? (
          <div className="p-16 flex flex-col items-center justify-center gap-3">
            <Loader2 size={32} className="animate-spin text-[var(--accent)]" />
            <p className="text-sm text-[var(--text-muted)]">Scanning memory graph for epistemic conflicts...</p>
          </div>
        ) : conflicts.length === 0 ? (
          <motion.div
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            className="p-12 rounded-3xl text-center flex flex-col items-center gap-4"
            style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}
          >
            <div
              className="w-16 h-16 rounded-2xl flex items-center justify-center"
              style={{ background: "rgba(0,214,143,0.12)", color: "#00d68f" }}
            >
              <CheckCircle2 size={32} />
            </div>
            <div>
              <h3 className="text-lg font-bold text-white">All Memories are Coherent</h3>
              <p className="text-xs mt-1 max-w-[420px] text-[var(--text-secondary)]">
                No contradictory statements or ambiguous state changes were detected. Your digital memory graph is consistent and verified.
              </p>
            </div>
            <button
              onClick={() => router.push("/memory-graph")}
              className="mt-2 px-5 py-2.5 rounded-xl text-xs font-semibold text-white transition-opacity hover:opacity-90 flex items-center gap-2 shadow-sm"
              style={{ background: "var(--accent)" }}
            >
              <span>Explore Memory Graph</span>
              <ArrowRight size={14} />
            </button>
          </motion.div>
        ) : (
          <div className="space-y-6">
            <AnimatePresence>
              {conflicts.map((conflict, idx) => {
                const isContradiction = conflict.conflict_type === "contradiction";
                return (
                  <motion.div
                    key={conflict.id}
                    layout
                    initial={{ opacity: 0, y: 15 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    transition={{ delay: idx * 0.05, duration: 0.3 }}
                    className="p-6 rounded-3xl relative overflow-hidden"
                    style={{
                      background: "var(--bg-card)",
                      border: "1px solid var(--border)",
                    }}
                  >
                    {/* Header badge */}
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-2">
                        <span
                          className="px-3 py-1 rounded-full text-[11px] font-bold flex items-center gap-1.5 uppercase tracking-wider"
                          style={{
                            background: isContradiction ? "rgba(235,87,87,0.15)" : "rgba(240,165,0,0.15)",
                            color: isContradiction ? "#eb5757" : "#f0a500",
                          }}
                        >
                          <AlertTriangle size={12} />
                          {isContradiction ? "Direct Contradiction" : "Low Confidence State Update"}
                        </span>
                        <span className="text-xs text-[var(--text-muted)]">
                          Category: <span className="text-white capitalize">{conflict.incoming_memory_type}</span>
                        </span>
                      </div>

                      <button
                        onClick={() => openHistory(conflict.existing_memory_id)}
                        className="flex items-center gap-1.5 text-xs text-[var(--accent)] hover:underline"
                      >
                        <History size={13} />
                        <span>View Lineage</span>
                      </button>
                    </div>

                    {/* Comparison columns */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                      {/* Existing Memory */}
                      <div
                        className="p-4 rounded-2xl flex flex-col justify-between"
                        style={{
                          background: "var(--bg-elevated)",
                          border: "1px solid var(--border-subtle)",
                        }}
                      >
                        <div>
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-[10px] uppercase font-bold tracking-wider text-[var(--text-muted)]">
                              Current Active Memory
                            </span>
                            <span className="text-[10px] px-2 py-0.5 rounded font-semibold bg-emerald-500/10 text-emerald-400">
                              Active
                            </span>
                          </div>
                          <p className="text-sm font-medium text-white leading-relaxed">
                            "{conflict.existing_memory_text}"
                          </p>
                        </div>
                      </div>

                      {/* Incoming Fact */}
                      <div
                        className="p-4 rounded-2xl flex flex-col justify-between"
                        style={{
                          background: "rgba(108,92,231,0.06)",
                          border: "1px solid rgba(108,92,231,0.25)",
                        }}
                      >
                        <div>
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-[10px] uppercase font-bold tracking-wider text-[var(--accent)]">
                              Incoming New Fact
                            </span>
                            <span className="text-[10px] px-2 py-0.5 rounded font-semibold bg-purple-500/15 text-purple-300">
                              Confidence: {Math.round(conflict.confidence * 100)}%
                            </span>
                          </div>
                          <p className="text-sm font-medium text-white leading-relaxed">
                            "{conflict.incoming_memory_text}"
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* AI Explanation */}
                    {conflict.explanation && (
                      <div
                        className="p-3.5 rounded-xl mb-5 flex items-start gap-2.5 text-xs"
                        style={{ background: "rgba(255,255,255,0.03)", color: "var(--text-secondary)" }}
                      >
                        <Info size={15} className="mt-0.5 flex-shrink-0 text-[var(--accent)]" />
                        <div>
                          <span className="font-semibold text-white">AI Reasoner Analysis: </span>
                          {conflict.explanation}
                        </div>
                      </div>
                    )}

                    {/* Decision Actions */}
                    <div className="flex items-center justify-end gap-3 pt-2 border-t border-[var(--border-subtle)]">
                      <button
                        onClick={() => handleResolve(conflict.id, "keep_existing")}
                        disabled={resolvingId === conflict.id}
                        className="px-4 py-2 rounded-xl text-xs font-semibold text-[var(--text-secondary)] hover:text-white bg-[var(--bg-elevated)] hover:bg-[var(--border)] transition-colors flex items-center gap-1.5"
                      >
                        <XCircle size={14} />
                        <span>Keep Existing Truth</span>
                      </button>

                      <button
                        onClick={() => handleResolve(conflict.id, "accept_new")}
                        disabled={resolvingId === conflict.id}
                        className="px-5 py-2 rounded-xl text-xs font-semibold text-white transition-opacity hover:opacity-90 flex items-center gap-1.5 shadow-sm"
                        style={{ background: "var(--accent)" }}
                      >
                        {resolvingId === conflict.id ? (
                          <Loader2 size={14} className="animate-spin" />
                        ) : (
                          <CheckCircle2 size={14} />
                        )}
                        <span>Accept New Fact</span>
                      </button>
                    </div>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>
        )}

        {/* History / Lineage Modal */}
        {historyModalMemoryId && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="p-6 rounded-3xl max-w-[550px] w-full"
              style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}
            >
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <History size={18} className="text-[var(--accent)]" />
                  <h3 className="text-base font-bold text-white">Memory Evolution Lineage</h3>
                </div>
                <button
                  onClick={() => setHistoryModalMemoryId(null)}
                  className="p-1.5 rounded-lg text-[var(--text-muted)] hover:text-white"
                >
                  ✕
                </button>
              </div>

              {historyLoading ? (
                <div className="p-10 flex justify-center">
                  <Loader2 size={24} className="animate-spin text-[var(--accent)]" />
                </div>
              ) : historyLineage && historyLineage.length > 0 ? (
                <div className="space-y-4">
                  {historyLineage.map((item, idx) => (
                    <div
                      key={item.id}
                      className="p-4 rounded-2xl"
                      style={{ background: "var(--bg-elevated)", border: "1px solid var(--border-subtle)" }}
                    >
                      <div className="flex items-center justify-between text-xs mb-1">
                        <span className="font-semibold text-[var(--accent)] capitalize">Version {idx + 1}</span>
                        <span className="text-[10px] px-2 py-0.5 rounded font-bold uppercase bg-white/5 text-[var(--text-muted)]">
                          {item.status || "active"}
                        </span>
                      </div>
                      <p className="text-xs text-white mt-1">"{item.memory}"</p>
                      <div className="flex items-center gap-3 text-[10px] text-[var(--text-muted)] mt-2">
                        <span>Type: {item.type}</span>
                        <span>•</span>
                        <span>Confidence: {item.confidence ? Math.round(item.confidence * 100) : 100}%</span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-[var(--text-muted)] py-6 text-center">
                  No lineage records found for this memory.
                </p>
              )}
            </motion.div>
          </div>
        )}
      </div>
    </AppLayout>
  );
}
