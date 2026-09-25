"use client";

import AppLayout from "@/components/layout/AppLayout";
import { motion, AnimatePresence } from "framer-motion";
import {
  Search,
  Send,
  Bell,
  Plus,
  Mail,
  HardDrive,
  Calendar,
  GitBranch,
  BookOpen,
  Brain,
  FileText,
  MessageSquare,
  Image,
  Mic,
  Clock,
  Zap,
  TrendingUp,
  Activity,
  Link2,
  ArrowRight,
  X,
  Sparkles,
  Share2,
} from "lucide-react";
import { useEffect, useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import {
  getDashboardStats,
  DashboardStats,
  TimelineEvent,
  getMemoryGraph,
  MemoryGraphData,
  getMemories,
  Memory,
} from "@/lib/api";

function generateSmoothPath(
  points: Array<{ x: number; y: number }>,
  bottomY: number
): { linePath: string; areaPath: string } {
  if (points.length === 0) return { linePath: "", areaPath: "" };
  if (points.length === 1) {
    const p = points[0];
    const linePath = `M ${p.x - 10} ${p.y} L ${p.x + 10} ${p.y}`;
    const areaPath = `M ${p.x - 10} ${p.y} L ${p.x + 10} ${p.y} L ${p.x + 10} ${bottomY} L ${p.x - 10} ${bottomY} Z`;
    return { linePath, areaPath };
  }

  let linePath = `M ${points[0].x} ${points[0].y}`;
  for (let i = 1; i < points.length; i++) {
    const prev = points[i - 1];
    const curr = points[i];
    const dx = curr.x - prev.x;
    const cp1x = prev.x + dx / 2;
    const cp1y = prev.y;
    const cp2x = prev.x + dx / 2;
    const cp2y = curr.y;
    linePath += ` C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${curr.x} ${curr.y}`;
  }

  const firstX = points[0].x;
  const lastX = points[points.length - 1].x;
  const areaPath = `${linePath} L ${lastX} ${bottomY} L ${firstX} ${bottomY} Z`;

  return { linePath, areaPath };
}

// Icons for connected sources
const sourceIconMap: Record<string, any> = {
  Gmail: Mail,
  "Google Drive": HardDrive,
  Calendar: Calendar,
  GitHub: GitBranch,
  Notion: BookOpen,
};

const sourceColorMap: Record<string, string> = {
  Gmail: "#f87171",
  "Google Drive": "#60a5fa",
  Calendar: "#34d399",
  GitHub: "#e2e8f0",
  Notion: "#e2e8f0",
};

const sourceGradientMap: Record<string, string> = {
  Gmail: "linear-gradient(135deg, rgba(248, 113, 113, 0.12), rgba(248, 113, 113, 0.04))",
  "Google Drive": "linear-gradient(135deg, rgba(96, 165, 250, 0.12), rgba(96, 165, 250, 0.04))",
  Calendar: "linear-gradient(135deg, rgba(52, 211, 153, 0.12), rgba(52, 211, 153, 0.04))",
  GitHub: "linear-gradient(135deg, rgba(226, 232, 240, 0.08), rgba(226, 232, 240, 0.02))",
  Notion: "linear-gradient(135deg, rgba(226, 232, 240, 0.08), rgba(226, 232, 240, 0.02))",
};

const fadeUp = {
  hidden: { opacity: 0, y: 24 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.06, duration: 0.5, ease: "easeOut" as const },
  }),
};

const FALLBACK_DASHBOARD_STATS: DashboardStats = {
  total_memories: 142,
  total_documents: 18,
  total_emails: 85,
  total_calendar: 12,
  total_timeline_events: 34,
  total_nodes: 56,
  total_edges: 89,
  clusters: 6,
  today_memories: 5,
  recent_activity: [
    {
      id: "act-1",
      title: "Google Drive Ingestion",
      description: "Indexed Architecture_Overview.pdf & system diagrams",
      timestamp: new Date().toISOString(),
      event_type: "document",
      color: "#60a5fa",
    },
    {
      id: "act-2",
      title: "Knowledge Graph Update",
      description: "Mapped 14 entity connections across AI memory nodes",
      timestamp: new Date(Date.now() - 1000 * 60 * 45).toISOString(),
      event_type: "graph",
      color: "#7c5cfc",
    },
    {
      id: "act-3",
      title: "Email Thread Analyzed",
      description: "Extracted action items from team synchronization",
      timestamp: new Date(Date.now() - 1000 * 60 * 120).toISOString(),
      event_type: "source",
      color: "#34d399",
    },
  ],
  connected_sources: [
    { name: "Gmail", items_indexed: 85, last_sync: "12m ago" },
    { name: "Google Drive", items_indexed: 18, last_sync: "1h ago" },
    { name: "Calendar", items_indexed: 12, last_sync: "25m ago" },
  ],
  suggested_queries: [
    "What are the main takeaways from recent architecture notes?",
    "When did we discuss the MemoryOS roadmap?",
    "Summarize upcoming meetings and deliverables",
  ],
  last_sync: "Just now",
  todays_focus: "Knowledge Graph & Semantic Search",
  upcoming_events_label: "Sprint Demo @ 3:00 PM",
  graph_has_data: true,
};

export default function DashboardPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [memoryGraph, setMemoryGraph] = useState<MemoryGraphData | null>(null);
  const [memories, setMemories] = useState<Memory[]>([]);
  const [hoveredPointIndex, setHoveredPointIndex] = useState<number | null>(null);
  const [selectedPointIndex, setSelectedPointIndex] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchFocused, setSearchFocused] = useState(false);
  const router = useRouter();

  // Get dynamic greeting based on time of day
  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return "Good morning";
    if (hour < 18) return "Good afternoon";
    return "Good evening";
  };

  const getGreetingEmoji = () => {
    const hour = new Date().getHours();
    if (hour < 12) return "☀️";
    if (hour < 18) return "🌤️";
    return "🌙";
  };

  // Fetch dashboard stats and memory graph on load to keep Knowledge Growth synchronized
  useEffect(() => {
    const loadStats = async () => {
      try {
        const [data, graph, mems] = await Promise.all([
          getDashboardStats().catch((error) => {
            console.warn("Using demo stats fallback:", error);
            return FALLBACK_DASHBOARD_STATS;
          }),
          getMemoryGraph().catch((error) => {
            console.warn("Failed to fetch memory graph for dashboard:", error);
            return null;
          }),
          getMemories().catch((error) => {
            console.warn("Failed to fetch memories for dashboard:", error);
            return { memories: [], total: 0 };
          }),
        ]);

        setStats(data);
        if (graph) {
          setMemoryGraph(graph);
        }
        if (mems && mems.memories) {
          setMemories(mems.memories);
        }
      } catch (error) {
        console.warn("Error loading dashboard data:", error);
        setStats(FALLBACK_DASHBOARD_STATS);
      } finally {
        setLoading(false);
      }
    };
    loadStats();
  }, []);

  // Synchronized counts directly from the active Memory Graph backend data
  const actualTotalNodes = memoryGraph?.nodes
    ? memoryGraph.nodes.length
    : (stats?.total_nodes ?? 0);
  const actualTotalEdges = memoryGraph?.edges
    ? memoryGraph.edges.length
    : (stats?.total_edges ?? 0);

  // Derive real chronological growth data directly from Memory Graph nodes, edges, and memories
  const growthTimeline = useMemo(() => {
    const nodes = memoryGraph?.nodes || [];
    const edges = memoryGraph?.edges || [];
    if (nodes.length === 0 && memories.length === 0) {
      return [];
    }

    const dateMap: Record<
      string,
      { timestamp: number; newNodes: number; newMemories: number }
    > = {};

    const parseToDateKey = (val: any): { key: string; ts: number; date: Date } | null => {
      if (!val) return null;
      const d = new Date(val);
      if (isNaN(d.getTime())) return null;
      const key = d.toISOString().split("T")[0];
      return { key, ts: d.getTime(), date: d };
    };

    // Map each node id to its dateKey
    const nodeDateKeyMap: Record<string, string> = {};
    nodes.forEach((node) => {
      const rawDate = node.created_at || node.date;
      const parsed = parseToDateKey(rawDate);
      const key = parsed ? parsed.key : "earliest";
      const ts = parsed ? parsed.ts : 0;
      nodeDateKeyMap[node.id] = key;

      if (!dateMap[key]) {
        dateMap[key] = { timestamp: ts, newNodes: 0, newMemories: 0 };
      }
      dateMap[key].newNodes += 1;
      if (ts && (!dateMap[key].timestamp || ts < dateMap[key].timestamp)) {
        dateMap[key].timestamp = ts;
      }
    });

    memories.forEach((mem) => {
      const rawDate = mem.created_at;
      const parsed = parseToDateKey(rawDate);
      const key = parsed ? parsed.key : "earliest";
      const ts = parsed ? parsed.ts : 0;

      if (!dateMap[key]) {
        dateMap[key] = { timestamp: ts, newNodes: 0, newMemories: 0 };
      }
      dateMap[key].newMemories += 1;
      if (ts && (!dateMap[key].timestamp || ts < dateMap[key].timestamp)) {
        dateMap[key].timestamp = ts;
      }
    });

    // Count edges by milestone date (date when both endpoints became available in the graph)
    const edgeDateCount: Record<string, number> = {};
    edges.forEach((edge) => {
      const sDate = nodeDateKeyMap[edge.source] || "earliest";
      const tDate = nodeDateKeyMap[edge.target] || "earliest";
      let edgeDateKey = sDate;
      if (sDate === "earliest" && tDate === "earliest") {
        edgeDateKey = "earliest";
      } else if (sDate === "earliest") {
        edgeDateKey = tDate;
      } else if (tDate === "earliest") {
        edgeDateKey = sDate;
      } else {
        edgeDateKey = sDate > tDate ? sDate : tDate;
      }
      edgeDateCount[edgeDateKey] = (edgeDateCount[edgeDateKey] || 0) + 1;
    });

    const sortedKeys = Object.keys(dateMap).sort((a, b) => {
      if (a === "earliest") return -1;
      if (b === "earliest") return 1;
      return dateMap[a].timestamp - dateMap[b].timestamp;
    });

    let cumNodes = 0;
    let cumMemories = 0;
    let cumEdges = 0;
    const points: Array<{
      dateKey: string;
      label: string;
      fullDate: string;
      newNodes: number;
      newMemories: number;
      cumulativeNodes: number;
      cumulativeMemories: number;
      cumulativeTotal: number;
      newEdges: number;
      cumulativeEdges: number;
      contributingSources: Array<{ id: string; label: string; category: string; description?: string; color?: string }>;
      newEntities: Array<{ id: string; label: string; category: string; description?: string; color?: string }>;
    }> = [];

    // Add baseline zero start point if we have data points
    if (sortedKeys.length > 0) {
      points.push({
        dateKey: "baseline",
        label: "Start",
        fullDate: "Initial State (Baseline)",
        newNodes: 0,
        newMemories: 0,
        cumulativeNodes: 0,
        cumulativeMemories: 0,
        cumulativeTotal: 0,
        newEdges: 0,
        cumulativeEdges: 0,
        contributingSources: [],
        newEntities: [],
      });
    }

    sortedKeys.forEach((key) => {
      const item = dateMap[key];
      const edgesAdded = edgeDateCount[key] || 0;
      cumNodes += item.newNodes;
      cumMemories += item.newMemories;
      cumEdges += edgesAdded;

      let label = key;
      let fullDate = key;
      if (key === "earliest") {
        label = "Initial";
        fullDate = "Initial Sync";
      } else {
        try {
          const parts = key.split("-");
          if (parts.length === 3) {
            const d = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
            label = d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
            fullDate = d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
          }
        } catch {
          label = key;
        }
      }

      // Collect real contributing sources and new entities for this date from the actual Memory Graph
      const dateNodes = nodes.filter((n) => nodeDateKeyMap[n.id] === key);
      const contributingSources: Array<{ id: string; label: string; category: string; description?: string; color?: string }> = [];
      const newEntities: Array<{ id: string; label: string; category: string; description?: string; color?: string }> = [];

      dateNodes.forEach((n) => {
        const cat = n.category || n.type || "Entity";
        const isDocId = n.id?.startsWith("doc_");
        const isSourceType = ["Email", "Document", "Event", "upload", "gmail", "drive", "calendar"].includes(cat);
        const hasSourceDesc = n.description?.toLowerCase().includes("source") || n.description?.toLowerCase().includes("email");

        const nodeItem = {
          id: n.id,
          label: n.label || n.name || "Unnamed",
          category: cat,
          description: n.description || "",
          color: n.color || "#8b5cf6",
        };

        if (isDocId || isSourceType || hasSourceDesc) {
          contributingSources.push(nodeItem);
        } else {
          newEntities.push(nodeItem);
        }
      });

      points.push({
        dateKey: key,
        label,
        fullDate,
        newNodes: item.newNodes,
        newMemories: item.newMemories,
        cumulativeNodes: cumNodes,
        cumulativeMemories: cumMemories,
        cumulativeTotal: cumNodes,
        newEdges: edgesAdded,
        cumulativeEdges: cumEdges,
        contributingSources,
        newEntities,
      });
    });

    return points;
  }, [memoryGraph, memories]);

  // Chart coordinates calculation
  const chartWidth = 680;
  const chartHeight = 150;
  const paddingLeft = 45;
  const paddingRight = 45;
  const paddingTop = 20;
  const paddingBottom = 30;
  const plotWidth = chartWidth - paddingLeft - paddingRight;
  const plotHeight = chartHeight - paddingTop - paddingBottom;
  const bottomY = paddingTop + plotHeight;
  const maxVal = Math.max(...growthTimeline.map((p) => p.cumulativeTotal), 1);

  const chartPoints = useMemo(() => {
    if (growthTimeline.length === 0) return [];
    const N = growthTimeline.length;
    return growthTimeline.map((pt, idx) => {
      const x = N > 1 ? paddingLeft + (idx / (N - 1)) * plotWidth : paddingLeft + plotWidth / 2;
      const y = bottomY - (pt.cumulativeTotal / maxVal) * plotHeight;
      return {
        ...pt,
        x,
        y,
        isBaseline: pt.dateKey === "baseline",
      };
    });
  }, [growthTimeline, maxVal, plotWidth, plotHeight, bottomY, paddingLeft]);

  const { linePath, areaPath } = useMemo(() => {
    return generateSmoothPath(chartPoints, bottomY);
  }, [chartPoints, bottomY]);

  const activePoint = hoveredPointIndex !== null
    ? growthTimeline[hoveredPointIndex]
    : (growthTimeline.length > 0 ? growthTimeline[growthTimeline.length - 1] : null);

  const selectedPoint = selectedPointIndex !== null ? chartPoints[selectedPointIndex] : null;

  // Handle search
  const handleSearch = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && searchQuery.trim()) {
      // Redirect to Ask EVOLVE with the query
      router.push(`/ask?q=${encodeURIComponent(searchQuery.trim())}`);
    }
  };

  // Handle suggested query click
  const handleSuggestedQuery = (query: string) => {
    setSearchQuery(query);
    router.push(`/ask?q=${encodeURIComponent(query)}`);
  };

  // Memory stats array with dynamic values
  const memoryStats = stats
    ? [
        {
          label: "Total Memories",
          value: stats.total_memories.toLocaleString(),
          icon: Brain,
          color: "#7c5cfc",
          gradient: "linear-gradient(135deg, rgba(124, 92, 252, 0.12), rgba(124, 92, 252, 0.04))",
        },
        {
          label: "Documents",
          value: stats.total_documents.toLocaleString(),
          icon: FileText,
          color: "#60a5fa",
          gradient: "linear-gradient(135deg, rgba(96, 165, 250, 0.12), rgba(96, 165, 250, 0.04))",
        },
        {
          label: "Conversations",
          value: "0",
          icon: MessageSquare,
          color: "#34d399",
          gradient: "linear-gradient(135deg, rgba(52, 211, 153, 0.12), rgba(52, 211, 153, 0.04))",
        },
        {
          label: "Images",
          value: "0",
          icon: Image,
          color: "#f472b6",
          gradient: "linear-gradient(135deg, rgba(244, 114, 182, 0.12), rgba(244, 114, 182, 0.04))",
        },
        {
          label: "Recordings",
          value: "0",
          icon: Mic,
          color: "#fbbf24",
          gradient: "linear-gradient(135deg, rgba(251, 191, 36, 0.12), rgba(251, 191, 36, 0.04))",
        },
        {
          label: "Knowledge Graph",
          value: actualTotalNodes.toLocaleString(),
          icon: Link2,
          color: "#22d3ee",
          gradient: "linear-gradient(135deg, rgba(34, 211, 238, 0.12), rgba(34, 211, 238, 0.04))",
        },
      ]
    : [];

  // Quick status cards
  const quickStatus = stats
    ? [
        {
          label: "Last Sync",
          value: stats.last_sync,
          icon: Clock,
          color: "#fbbf24",
          gradient: "linear-gradient(135deg, rgba(251, 191, 36, 0.1), rgba(251, 191, 36, 0.03))",
        },
        {
          label: "Today's Memories",
          value: stats.today_memories.toString(),
          icon: Brain,
          color: "#7c5cfc",
          gradient: "linear-gradient(135deg, rgba(124, 92, 252, 0.1), rgba(124, 92, 252, 0.03))",
        },
        {
          label: "Today's Focus",
          value: stats.todays_focus,
          icon: Zap,
          color: "#22d3ee",
          gradient: "linear-gradient(135deg, rgba(34, 211, 238, 0.1), rgba(34, 211, 238, 0.03))",
        },
        {
          label: "Upcoming Events",
          value: stats.upcoming_events_label,
          icon: Calendar,
          color: "#34d399",
          gradient: "linear-gradient(135deg, rgba(52, 211, 153, 0.1), rgba(52, 211, 153, 0.03))",
        },
      ]
    : [];

  // Event type icon mapping
  const eventTypeIcon = (type: string) => {
    if (type === "document") return FileText;
    if (type === "graph") return Share2;
    if (type === "source") return Mail;
    return Activity;
  };

  // Loading Skeleton
  const SkeletonCard = ({ className = "" }: { className?: string }) => (
    <div className={`rounded-2xl shimmer ${className}`} style={{
      background: 'rgba(148, 163, 184, 0.03)',
      border: '1px solid rgba(148, 163, 184, 0.05)',
    }} />
  );

  return (
    <AppLayout>
      <div className="p-6 lg:p-8 max-w-[1400px] mx-auto">
        {/* Header */}
        <motion.div
          className="flex items-center justify-between mb-8"
          initial={{ opacity: 0, y: -12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
        >
          <div>
            <h1 className="text-3xl font-bold text-white flex items-center gap-3">
              {getGreeting()}, User!
              <span className="text-2xl">{getGreetingEmoji()}</span>
            </h1>
            <p className="text-sm mt-1.5" style={{ color: "var(--text-secondary)" }}>
              Your <span className="gradient-text font-semibold">second brain</span> is active and learning.
            </p>
          </div>
          <div className="flex items-center gap-2.5">
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              className="relative w-10 h-10 rounded-xl flex items-center justify-center transition-colors"
              style={{
                background: "rgba(14, 14, 32, 0.5)",
                border: "1px solid rgba(148, 163, 184, 0.06)",
                color: "var(--text-secondary)",
              }}
            >
              <Bell size={17} />
              <span
                className="absolute top-2 right-2 w-2 h-2 rounded-full pulse-glow"
                style={{ background: "#7c5cfc" }}
              />
            </motion.button>
          </div>
        </motion.div>

        {/* Search Bar */}
        <motion.div
          className="relative mb-4"
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1, duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
        >
          <div
            className="flex items-center rounded-2xl px-5 py-4 transition-all duration-300"
            style={{
              background: searchFocused
                ? "rgba(14, 14, 32, 0.7)"
                : "rgba(14, 14, 32, 0.4)",
              border: searchFocused
                ? "1px solid rgba(124, 92, 252, 0.2)"
                : "1px solid rgba(148, 163, 184, 0.06)",
              boxShadow: searchFocused
                ? "0 0 24px rgba(124, 92, 252, 0.08), 0 4px 16px rgba(0,0,0,0.2)"
                : "none",
              backdropFilter: "blur(12px)",
            }}
          >
            <Search size={17} className="flex-shrink-0" style={{ color: searchFocused ? "#7c5cfc" : "var(--text-muted)" }} />
            <input
              type="text"
              placeholder="Ask anything about your memory..."
              className="flex-1 bg-transparent ml-3 text-sm outline-none placeholder:text-slate-600 text-white"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={handleSearch}
              onFocus={() => setSearchFocused(true)}
              onBlur={() => setSearchFocused(false)}
              style={{ border: 'none', boxShadow: 'none' }}
            />
            <motion.button
              whileHover={{ scale: 1.08 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => handleSearch({ key: "Enter" } as any)}
              className="w-9 h-9 rounded-xl flex items-center justify-center text-white flex-shrink-0"
              style={{
                background: "linear-gradient(135deg, #7c5cfc, #6366f1)",
                boxShadow: "0 4px 16px rgba(124,92,252,0.3)",
              }}
            >
              <Send size={15} />
            </motion.button>
          </div>
        </motion.div>

        {/* Quick Prompts */}
        <motion.div
          className="flex gap-2.5 mb-8 flex-wrap"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2, duration: 0.5 }}
        >
          {loading ? (
            Array(3).fill(0).map((_, i) => (
              <div key={i} className="px-4 py-2 rounded-full shimmer" style={{
                width: 180, height: 32,
                background: 'rgba(148, 163, 184, 0.03)',
                border: '1px solid rgba(148, 163, 184, 0.04)',
              }} />
            ))
          ) : (
            stats?.suggested_queries.map((prompt, i) => (
              <motion.button
                key={i}
                onClick={() => handleSuggestedQuery(prompt)}
                whileHover={{ scale: 1.03, y: -1 }}
                whileTap={{ scale: 0.98 }}
                className="px-4 py-2 rounded-full text-xs font-medium transition-all"
                style={{
                  background: "rgba(124, 92, 252, 0.06)",
                  color: "#a78bfa",
                  border: "1px solid rgba(124, 92, 252, 0.12)",
                }}
              >
                {prompt}
              </motion.button>
            ))
          )}
        </motion.div>

        {/* Quick Status Cards */}
        <motion.div
          className="mb-8"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25, duration: 0.5 }}
        >
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {loading ? (
              Array(4).fill(0).map((_, i) => (
                <SkeletonCard key={i} className="h-24" />
              ))
            ) : (
              quickStatus.map((item, i) => {
                const Icon = item.icon;
                return (
                  <motion.div
                    key={i}
                    className="p-4 rounded-2xl flex items-center gap-3.5 group cursor-default"
                    style={{
                      background: item.gradient,
                      border: "1px solid rgba(148, 163, 184, 0.06)",
                      backdropFilter: "blur(8px)",
                    }}
                    custom={i}
                    initial="hidden"
                    animate="visible"
                    variants={fadeUp}
                    whileHover={{ y: -2, transition: { duration: 0.2 } }}
                  >
                    <div
                      className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 transition-transform group-hover:scale-110"
                      style={{
                        background: `${item.color}15`,
                        border: `1px solid ${item.color}20`,
                      }}
                    >
                      <Icon size={18} style={{ color: item.color }} />
                    </div>
                    <div className="min-w-0">
                      <p className="text-[11px] font-medium" style={{ color: "var(--text-muted)" }}>
                        {item.label}
                      </p>
                      <p className="text-base font-bold text-white truncate">{item.value}</p>
                    </div>
                  </motion.div>
                );
              })
            )}
          </div>
        </motion.div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
          {/* Recent Activity */}
          <motion.div
            className="lg:col-span-2"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.35, duration: 0.5 }}
          >
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-semibold text-white flex items-center gap-2">
                <Activity size={16} className="text-cyan-400" />
                Recent Activity
              </h2>
              <button
                className="text-xs font-medium text-slate-500 hover:text-cyan-400 transition-colors flex items-center gap-1"
                onClick={() => router.push("/timeline")}
              >
                View all
                <ArrowRight size={12} />
              </button>
            </div>
            <div className="space-y-2.5">
              {loading ? (
                Array(4).fill(0).map((_, i) => (
                  <SkeletonCard key={i} className="h-16" />
                ))
              ) : (
                stats?.recent_activity.slice(0, 5).map((event: TimelineEvent, i) => {
                  const EventIcon = eventTypeIcon(event.event_type || "");
                  return (
                    <motion.div
                      key={event.id}
                      className="p-4 rounded-xl flex items-center gap-4 group cursor-pointer"
                      style={{
                        background: "rgba(14, 14, 32, 0.4)",
                        border: "1px solid rgba(148, 163, 184, 0.05)",
                        backdropFilter: "blur(8px)",
                      }}
                      whileHover={{
                        background: "rgba(14, 14, 32, 0.6)",
                        borderColor: "rgba(124, 92, 252, 0.1)",
                        y: -1,
                      }}
                      transition={{ duration: 0.2 }}
                    >
                      <div
                        className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 transition-transform group-hover:scale-110"
                        style={{
                          background: `${event.color}15`,
                          border: `1px solid ${event.color}20`,
                          color: event.color,
                        }}
                      >
                        <EventIcon size={15} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-white truncate">
                          {event.title}
                        </p>
                        <p className="text-xs text-slate-500 truncate">
                          {event.description}
                        </p>
                      </div>
                      <span className="text-[10px] text-slate-600 flex-shrink-0 font-mono">
                        {event.timestamp ? new Date(event.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Just now'}
                      </span>
                    </motion.div>
                  );
                })
              )}
            </div>
          </motion.div>

          {/* Smart Suggestions */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4, duration: 0.5 }}
          >
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-semibold text-white flex items-center gap-2">
                <Sparkles size={16} className="text-amber-400" />
                Smart Suggestions
              </h2>
            </div>
            <div className="space-y-2.5">
              <motion.div
                className="p-4 rounded-xl cursor-pointer group"
                style={{
                  background: "rgba(14, 14, 32, 0.4)",
                  border: "1px solid rgba(148, 163, 184, 0.05)",
                }}
                whileHover={{ y: -2, borderColor: "rgba(124, 92, 252, 0.1)" }}
                transition={{ duration: 0.2 }}
              >
                <div className="flex items-center gap-3">
                  <div
                    className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
                    style={{
                      background: "rgba(124, 92, 252, 0.1)",
                      border: "1px solid rgba(124, 92, 252, 0.15)",
                      color: "#7c5cfc",
                    }}
                  >
                    <FileText size={15} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-white">
                      You uploaded DBMS.pdf yesterday
                    </p>
                    <p className="text-xs text-slate-500">
                      Would you like a summary?
                    </p>
                  </div>
                </div>
              </motion.div>

              <motion.div
                className="p-4 rounded-xl cursor-pointer group"
                style={{
                  background: "rgba(14, 14, 32, 0.4)",
                  border: "1px solid rgba(148, 163, 184, 0.05)",
                }}
                whileHover={{ y: -2, borderColor: "rgba(52, 211, 153, 0.1)" }}
                transition={{ duration: 0.2 }}
              >
                <div className="flex items-center gap-3">
                  <div
                    className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
                    style={{
                      background: "rgba(52, 211, 153, 0.1)",
                      border: "1px solid rgba(52, 211, 153, 0.15)",
                      color: "#34d399",
                    }}
                  >
                    <Calendar size={15} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-white">
                      Interview tomorrow
                    </p>
                    <p className="text-xs text-slate-500">
                      Review important concepts
                    </p>
                  </div>
                </div>
              </motion.div>

              <motion.div
                className="p-4 rounded-xl cursor-pointer group"
                style={{
                  background: "rgba(14, 14, 32, 0.4)",
                  border: "1px solid rgba(148, 163, 184, 0.05)",
                }}
                whileHover={{ y: -2, borderColor: "rgba(34, 211, 238, 0.1)" }}
                transition={{ duration: 0.2 }}
              >
                <div className="flex items-center gap-3">
                  <div
                    className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
                    style={{
                      background: "rgba(34, 211, 238, 0.1)",
                      border: "1px solid rgba(34, 211, 238, 0.15)",
                      color: "#22d3ee",
                    }}
                  >
                    <Brain size={15} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-white">
                      Knowledge graph growing
                    </p>
                    <p className="text-xs text-slate-500">
                      +{actualTotalNodes} entities discovered
                    </p>
                  </div>
                </div>
              </motion.div>
            </div>
          </motion.div>
        </div>

        {/* Connected Sources */}
        <motion.div
          className="mb-8"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.45, duration: 0.5 }}
        >
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-semibold text-white flex items-center gap-2">
              <Link2 size={16} className="text-green-400" />
              Connected Sources
            </h2>
            <button
              className="text-xs font-medium text-slate-500 hover:text-cyan-400 transition-colors flex items-center gap-1"
              onClick={() => router.push("/sources")}
            >
              View all
              <ArrowRight size={12} />
            </button>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
            {loading ? (
              Array(5).fill(0).map((_, i) => (
                <SkeletonCard key={i} className="h-36" />
              ))
            ) : (
              stats?.connected_sources.map((source, i) => {
                const Icon = sourceIconMap[source.name] || HardDrive;
                const color = sourceColorMap[source.name] || "#7c5cfc";
                const gradient = sourceGradientMap[source.name] || "linear-gradient(135deg, rgba(124, 92, 252, 0.1), rgba(124, 92, 252, 0.03))";
                return (
                  <motion.div
                    key={source.name}
                    className="p-4 rounded-2xl flex flex-col items-center gap-3 cursor-pointer group"
                    style={{
                      background: gradient,
                      border: "1px solid rgba(148, 163, 184, 0.05)",
                      backdropFilter: "blur(8px)",
                    }}
                    custom={i}
                    initial="hidden"
                    animate="visible"
                    variants={fadeUp}
                    whileHover={{ y: -3, scale: 1.02 }}
                    onClick={() => router.push("/sources")}
                  >
                    <div
                      className="w-12 h-12 rounded-xl flex items-center justify-center transition-all group-hover:scale-110 group-hover:shadow-lg"
                      style={{
                        background: `${color}12`,
                        border: `1px solid ${color}20`,
                      }}
                    >
                      <Icon size={22} style={{ color }} />
                    </div>
                    <div className="text-center">
                      <p className="text-xs font-semibold text-white">
                        {source.name}
                      </p>
                      <p className="text-xl font-bold mt-0.5" style={{ color }}>
                        {source.items_indexed.toLocaleString()}
                      </p>
                      <p className="text-[10px] text-slate-600 font-mono">
                        {source.last_sync}
                      </p>
                    </div>
                  </motion.div>
                );
              })
            )}
          </div>
        </motion.div>

        {/* Memory Stats */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5, duration: 0.5 }}
        >
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-semibold text-white flex items-center gap-2">
              <Brain size={16} className="text-purple-400" />
              Memory Stats
            </h2>
          </div>
          <div className="grid grid-cols-3 lg:grid-cols-6 gap-3">
            {memoryStats.map((stat, i) => {
              const Icon = stat.icon;
              return (
                <motion.div
                  key={stat.label}
                  className="p-4 rounded-2xl flex flex-col items-center gap-2 group"
                  style={{
                    background: stat.gradient,
                    border: "1px solid rgba(148, 163, 184, 0.05)",
                    backdropFilter: "blur(8px)",
                  }}
                  custom={i}
                  initial="hidden"
                  animate="visible"
                  variants={fadeUp}
                  whileHover={{ y: -2, scale: 1.02 }}
                >
                  <Icon
                    size={18}
                    style={{ color: stat.color, opacity: 0.9 }}
                    className="transition-transform group-hover:scale-110"
                  />
                  <p className="text-2xl font-bold text-white">{stat.value}</p>
                  <p className="text-[11px] text-slate-500 text-center">
                    {stat.label}
                  </p>
                </motion.div>
              );
            })}
          </div>
        </motion.div>

        {/* Knowledge Growth */}
        <motion.div
          className="mt-8"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.55, duration: 0.5 }}
        >
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-base font-semibold text-white flex items-center gap-2">
                <TrendingUp size={16} className="text-violet-400" />
                Knowledge Growth
                <span className="text-[10px] px-2.5 py-0.5 rounded-full font-normal" style={{
                  background: 'rgba(34, 211, 238, 0.08)',
                  border: '1px solid rgba(34, 211, 238, 0.15)',
                  color: '#22d3ee',
                }}>
                  Live Sync
                </span>
              </h2>
              <p className="text-[11px] text-slate-500 mt-1">
                Real-time entities and relationships from your Memory Graph
              </p>
            </div>
            <motion.button
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.97 }}
              onClick={() => router.push("/memory-graph")}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-medium transition-all"
              style={{
                background: 'rgba(124, 92, 252, 0.08)',
                border: '1px solid rgba(124, 92, 252, 0.15)',
                color: '#a78bfa',
              }}
            >
              <span>Explore Graph</span>
              <ArrowRight size={13} />
            </motion.button>
          </div>

          <div className="grid grid-cols-2 gap-4 mb-5">
            <div
              className="p-5 rounded-2xl relative overflow-hidden group"
              style={{
                background: "linear-gradient(135deg, rgba(124, 92, 252, 0.08), rgba(96, 165, 250, 0.04))",
                border: "1px solid rgba(124, 92, 252, 0.1)",
                backdropFilter: "blur(8px)",
              }}
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[11px] font-medium text-slate-500">
                    Total Nodes
                  </p>
                  <p className="text-3xl font-bold text-white mt-1">
                    {actualTotalNodes.toLocaleString()}
                  </p>
                  <p className="text-[10px] text-violet-400/80 mt-1 flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-violet-400 animate-pulse" />
                    Memory Graph entities
                  </p>
                </div>
                <div
                  className="w-12 h-12 rounded-xl flex items-center justify-center transition-transform group-hover:scale-110"
                  style={{ background: "rgba(124, 92, 252, 0.1)", border: "1px solid rgba(124, 92, 252, 0.15)" }}
                >
                  <TrendingUp size={22} style={{ color: "#7c5cfc" }} />
                </div>
              </div>
            </div>

            <div
              className="p-5 rounded-2xl relative overflow-hidden group"
              style={{
                background: "linear-gradient(135deg, rgba(34, 211, 238, 0.08), rgba(52, 211, 153, 0.04))",
                border: "1px solid rgba(34, 211, 238, 0.1)",
                backdropFilter: "blur(8px)",
              }}
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[11px] font-medium text-slate-500">
                    Relationships
                  </p>
                  <p className="text-3xl font-bold text-white mt-1">
                    {actualTotalEdges.toLocaleString()}
                  </p>
                  <p className="text-[10px] text-cyan-400/80 mt-1 flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" />
                    Connected memory edges
                  </p>
                </div>
                <div
                  className="w-12 h-12 rounded-xl flex items-center justify-center transition-transform group-hover:scale-110"
                  style={{ background: "rgba(34, 211, 238, 0.1)", border: "1px solid rgba(34, 211, 238, 0.15)" }}
                >
                  <Link2 size={22} style={{ color: "#22d3ee" }} />
                </div>
              </div>
            </div>
          </div>

          {/* Real-time Knowledge Growth Graph Visualization */}
          <div
            className="p-5 rounded-2xl mb-5 relative overflow-hidden"
            style={{
              background: "rgba(8, 8, 18, 0.5)",
              border: "1px solid rgba(148, 163, 184, 0.06)",
              backdropFilter: "blur(12px)",
            }}
          >
            <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
              <div className="flex items-center gap-2.5">
                <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{
                  background: 'rgba(124, 92, 252, 0.1)',
                  border: '1px solid rgba(124, 92, 252, 0.15)',
                  color: '#7c5cfc',
                }}>
                  <Activity size={14} />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-white">
                    Memory Growth Over Time
                  </h3>
                  <p className="text-[10px] text-slate-500">
                    Click any milestone point to inspect details
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                {activePoint && activePoint.dateKey !== "baseline" ? (
                  <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs" style={{
                    background: 'rgba(14, 14, 32, 0.6)',
                    border: '1px solid rgba(148, 163, 184, 0.08)',
                  }}>
                    <span className="text-slate-400">{activePoint.fullDate}:</span>
                    <span className="font-semibold text-violet-300">
                      {activePoint.cumulativeTotal} nodes
                    </span>
                    {activePoint.newNodes > 0 && (
                      <span className="text-cyan-400 font-medium">
                        (+{activePoint.newNodes})
                      </span>
                    )}
                  </div>
                ) : (
                  <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-medium" style={{
                    background: 'rgba(34, 211, 238, 0.06)',
                    border: '1px solid rgba(34, 211, 238, 0.12)',
                    color: '#22d3ee',
                  }}>
                    <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" />
                    Synchronized
                  </div>
                )}
              </div>
            </div>

            {/* Clickable Milestone Popup Modal */}
            <AnimatePresence>
              {selectedPoint && (
                <motion.div
                  initial={{ opacity: 0, y: -8, scale: 0.98 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -8, scale: 0.98 }}
                  transition={{ duration: 0.2 }}
                  className="mb-5 p-5 rounded-2xl relative"
                  style={{
                    background: 'rgba(8, 8, 18, 0.9)',
                    backdropFilter: 'blur(24px)',
                    border: '1px solid rgba(124, 92, 252, 0.2)',
                    boxShadow: '0 16px 48px rgba(0,0,0,0.4)',
                  }}
                >
                  <div className="flex items-center justify-between pb-3 mb-4" style={{ borderBottom: '1px solid rgba(148, 163, 184, 0.06)' }}>
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{
                        background: 'rgba(124, 92, 252, 0.12)',
                        border: '1px solid rgba(124, 92, 252, 0.2)',
                        color: '#a78bfa',
                      }}>
                        <Sparkles size={15} />
                      </div>
                      <div>
                        <h4 className="text-sm font-semibold text-white flex items-center gap-2">
                          {selectedPoint.fullDate}
                          <span className="text-[10px] font-normal px-2 py-0.5 rounded-full" style={{
                            background: 'rgba(124, 92, 252, 0.08)',
                            border: '1px solid rgba(124, 92, 252, 0.12)',
                            color: '#a78bfa',
                          }}>
                            {selectedPoint.isBaseline ? "Baseline" : "Milestone"}
                          </span>
                        </h4>
                      </div>
                    </div>
                    <button
                      onClick={() => setSelectedPointIndex(null)}
                      className="p-1.5 rounded-lg hover:bg-white/5 text-slate-500 hover:text-white transition-colors"
                    >
                      <X size={15} />
                    </button>
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
                    {[
                      { label: "Total Nodes", value: selectedPoint.cumulativeNodes.toLocaleString(), color: "#f0f0ff" },
                      { label: "Nodes Added", value: `+${selectedPoint.newNodes.toLocaleString()}`, color: "#34d399" },
                      { label: "Total Relationships", value: selectedPoint.cumulativeEdges.toLocaleString(), color: "#f0f0ff" },
                      { label: "Relationships Added", value: `+${selectedPoint.newEdges.toLocaleString()}`, color: "#22d3ee" },
                    ].map((s) => (
                      <div key={s.label} className="p-3 rounded-xl" style={{
                        background: 'rgba(14, 14, 32, 0.5)',
                        border: '1px solid rgba(148, 163, 184, 0.05)',
                      }}>
                        <p className="text-[10px] text-slate-500">{s.label}</p>
                        <p className="text-xl font-bold mt-0.5" style={{ color: s.color }}>{s.value}</p>
                      </div>
                    ))}
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Contributing Sources */}
                    <div className="p-3.5 rounded-xl flex flex-col" style={{
                      background: 'rgba(14, 14, 32, 0.4)',
                      border: '1px solid rgba(148, 163, 184, 0.05)',
                    }}>
                      <div className="flex items-center justify-between mb-2.5">
                        <span className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                          <FileText size={13} className="text-amber-400" />
                          Sources / Documents
                        </span>
                        <span className="text-[10px] px-2 py-0.5 rounded-full font-mono" style={{
                          background: 'rgba(148, 163, 184, 0.06)',
                          color: 'var(--text-muted)',
                        }}>
                          {selectedPoint.contributingSources.length}
                        </span>
                      </div>
                      {selectedPoint.contributingSources.length > 0 ? (
                        <div className="max-h-44 overflow-y-auto pr-1 space-y-1.5">
                          {selectedPoint.contributingSources.map((src, i) => (
                            <div
                              key={src.id || i}
                              className="px-2.5 py-1.5 rounded-lg flex items-center justify-between text-xs"
                              style={{
                                background: 'rgba(148, 163, 184, 0.03)',
                                border: '1px solid rgba(148, 163, 184, 0.04)',
                              }}
                            >
                              <span className="text-slate-300 truncate pr-2" title={src.label}>
                                {src.label}
                              </span>
                              <span className="text-[10px] px-1.5 py-0.5 rounded text-slate-500 shrink-0" style={{
                                background: 'rgba(148, 163, 184, 0.05)',
                              }}>
                                {src.category || "Source"}
                              </span>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-xs text-slate-600 italic py-3">
                          {selectedPoint.isBaseline
                            ? "Baseline zero state before data synchronization."
                            : "No source documents in this milestone."}
                        </p>
                      )}
                    </div>

                    {/* Newly Created Entities / Nodes */}
                    <div className="p-3.5 rounded-xl flex flex-col" style={{
                      background: 'rgba(14, 14, 32, 0.4)',
                      border: '1px solid rgba(148, 163, 184, 0.05)',
                    }}>
                      <div className="flex items-center justify-between mb-2.5">
                        <span className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                          <Brain size={13} className="text-violet-400" />
                          New Entities / Nodes
                        </span>
                        <span className="text-[10px] px-2 py-0.5 rounded-full font-mono" style={{
                          background: 'rgba(148, 163, 184, 0.06)',
                          color: 'var(--text-muted)',
                        }}>
                          {selectedPoint.newEntities.length}
                        </span>
                      </div>
                      {selectedPoint.newEntities.length > 0 ? (
                        <div className="max-h-44 overflow-y-auto pr-1 space-y-1.5">
                          {selectedPoint.newEntities.map((ent, i) => (
                            <div
                              key={ent.id || i}
                              className="px-2.5 py-1.5 rounded-lg flex items-center justify-between text-xs"
                              style={{
                                background: 'rgba(148, 163, 184, 0.03)',
                                border: '1px solid rgba(148, 163, 184, 0.04)',
                              }}
                            >
                              <span className="text-slate-300 truncate pr-2" title={ent.label}>
                                {ent.label}
                              </span>
                              <span
                                className="text-[10px] px-1.5 py-0.5 rounded shrink-0 font-medium"
                                style={{
                                  backgroundColor: `${ent.color || "#8b5cf6"}12`,
                                  color: ent.color || "#a78bfa",
                                  border: `1px solid ${ent.color || "#8b5cf6"}20`,
                                }}
                              >
                                {ent.category || "Entity"}
                              </span>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-xs text-slate-600 italic py-3">
                          {selectedPoint.isBaseline
                            ? "Baseline zero state before entity creation."
                            : "No new entity nodes in this milestone."}
                        </p>
                      )}
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* SVG Growth Graph */}
            {chartPoints.length > 0 ? (
              <div className="w-full">
                <div className="relative w-full h-44">
                  <svg
                    viewBox={`0 0 ${chartWidth} ${chartHeight}`}
                    className="w-full h-full overflow-visible"
                    preserveAspectRatio="none"
                  >
                    <defs>
                      <linearGradient id="knowledgeGrowthFill" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#7c5cfc" stopOpacity="0.35" />
                        <stop offset="40%" stopColor="#22d3ee" stopOpacity="0.12" />
                        <stop offset="100%" stopColor="#22d3ee" stopOpacity="0.0" />
                      </linearGradient>
                      <linearGradient id="knowledgeGrowthStroke" x1="0" y1="0" x2="1" y2="0">
                        <stop offset="0%" stopColor="#7c5cfc" />
                        <stop offset="50%" stopColor="#a78bfa" />
                        <stop offset="100%" stopColor="#22d3ee" />
                      </linearGradient>
                      <filter id="pointGlow" x="-50%" y="-50%" width="200%" height="200%">
                        <feDropShadow dx="0" dy="0" stdDeviation="3" floodColor="#7c5cfc" floodOpacity="0.6" />
                      </filter>
                    </defs>

                    {/* Horizontal Guide Lines */}
                    <line x1={paddingLeft} y1={paddingTop} x2={chartWidth - paddingRight} y2={paddingTop}
                      stroke="rgba(148, 163, 184, 0.06)" strokeDasharray="4 4" />
                    <line x1={paddingLeft} y1={paddingTop + plotHeight / 2} x2={chartWidth - paddingRight} y2={paddingTop + plotHeight / 2}
                      stroke="rgba(148, 163, 184, 0.04)" strokeDasharray="4 4" />
                    <line x1={paddingLeft} y1={paddingTop + plotHeight} x2={chartWidth - paddingRight} y2={paddingTop + plotHeight}
                      stroke="rgba(148, 163, 184, 0.08)" />

                    {/* Y-axis Labels */}
                    <text x={paddingLeft - 8} y={paddingTop + 4} textAnchor="end"
                      className="text-[9px] fill-slate-500 font-mono">{maxVal}</text>
                    <text x={paddingLeft - 8} y={paddingTop + plotHeight / 2 + 3} textAnchor="end"
                      className="text-[9px] fill-slate-600 font-mono">{Math.round(maxVal / 2)}</text>
                    <text x={paddingLeft - 8} y={paddingTop + plotHeight + 3} textAnchor="end"
                      className="text-[9px] fill-slate-600 font-mono">0</text>

                    {/* Area Under Curve */}
                    {areaPath && <path d={areaPath} fill="url(#knowledgeGrowthFill)" />}

                    {/* Smooth Curve Line */}
                    {linePath && (
                      <path d={linePath} fill="none" stroke="url(#knowledgeGrowthStroke)"
                        strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                    )}

                    {/* Milestone Points */}
                    {chartPoints.map((pt, idx) => {
                      const isSelected = selectedPointIndex === idx;
                      const isHovered = hoveredPointIndex === idx;
                      const isLatest = idx === chartPoints.length - 1;
                      return (
                        <g
                          key={pt.dateKey + idx}
                          className="cursor-pointer"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedPointIndex(selectedPointIndex === idx ? null : idx);
                          }}
                          onMouseEnter={() => setHoveredPointIndex(idx)}
                          onMouseLeave={() => setHoveredPointIndex(null)}
                        >
                          {(isSelected || isLatest || isHovered) && (
                            <circle
                              cx={pt.x} cy={pt.y}
                              r={isSelected ? 12 : (isHovered ? 11 : 8)}
                              fill="none"
                              stroke={isSelected ? "#22d3ee" : "#7c5cfc"}
                              strokeOpacity={isSelected ? 0.8 : (isHovered ? 0.5 : 0.25)}
                              strokeWidth={isSelected ? "2" : "1.5"}
                              className={isSelected ? "" : "animate-pulse"}
                            />
                          )}
                          <circle
                            cx={pt.x} cy={pt.y}
                            r={isSelected ? 6 : (isHovered ? 5.5 : (pt.isBaseline ? 3 : 4.5))}
                            fill="#06060e"
                            stroke={isSelected ? "#22d3ee" : (isHovered ? "#22d3ee" : (pt.isBaseline ? "#475569" : "#7c5cfc"))}
                            strokeWidth={isSelected ? "2.5" : (isHovered ? "2" : "1.5")}
                            filter={!pt.isBaseline || isSelected ? "url(#pointGlow)" : undefined}
                          />
                          <circle
                            cx={pt.x} cy={pt.y}
                            r={isSelected ? 2.5 : (isHovered ? 2 : 1.2)}
                            fill={isSelected ? "#22d3ee" : (isHovered ? "#22d3ee" : "#ffffff")}
                          />
                          <text
                            x={pt.x} y={paddingTop + plotHeight + 17}
                            textAnchor="middle"
                            className={`text-[9px] select-none ${
                              isSelected ? "fill-cyan-400 font-bold"
                              : isHovered ? "fill-violet-300 font-semibold"
                              : "fill-slate-500 font-normal"
                            }`}
                          >
                            {pt.label}
                          </text>
                        </g>
                      );
                    })}
                  </svg>
                </div>

                {/* Legend */}
                <div className="flex items-center justify-between pt-3 mt-2 text-[10px] text-slate-500" style={{ borderTop: '1px solid rgba(148, 163, 184, 0.05)' }}>
                  <div className="flex items-center gap-4">
                    <span className="flex items-center gap-1.5">
                      <span className="w-2.5 h-2.5 rounded-full" style={{
                        background: 'linear-gradient(135deg, #7c5cfc, #22d3ee)',
                      }} />
                      Cumulative Nodes
                    </span>
                    <span className="text-slate-600">•</span>
                    <span>{growthTimeline.filter(p => p.dateKey !== "baseline").length} milestones</span>
                  </div>
                  <div>
                    Growth: <span className="text-cyan-400 font-semibold">+{actualTotalNodes} nodes</span>
                  </div>
                </div>
              </div>
            ) : (
              <div className="py-8 text-center">
                <Brain className="mx-auto mb-3 text-slate-700" size={32} />
                <p className="text-xs text-slate-500">
                  No memory graph nodes yet. Connect a source to start building your knowledge graph.
                </p>
              </div>
            )}
          </div>

          {actualTotalNodes === 0 && (
            <div className="p-5 rounded-2xl" style={{
              background: "rgba(14, 14, 32, 0.4)",
              border: "1px solid rgba(148, 163, 184, 0.05)",
            }}>
              <p className="text-sm text-slate-400">
                Your knowledge graph will grow automatically as EVOLVE learns from your conversations, documents and connected sources.
              </p>
            </div>
          )}
        </motion.div>
      </div>
    </AppLayout>
  );
}
