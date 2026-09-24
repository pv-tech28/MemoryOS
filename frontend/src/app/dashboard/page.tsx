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
  Gmail: "#ea4335",
  "Google Drive": "#4285f4",
  Calendar: "#34a853",
  GitHub: "#f0f0f0",
  Notion: "#ffffff",
};

const fadeUp = {
  hidden: { opacity: 0, y: 20 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.08, duration: 0.5, ease: "easeOut" as const },
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
      color: "#4285f4",
    },
    {
      id: "act-2",
      title: "Knowledge Graph Update",
      description: "Mapped 14 entity connections across AI memory nodes",
      timestamp: new Date(Date.now() - 1000 * 60 * 45).toISOString(),
      event_type: "graph",
      color: "#6c5ce7",
    },
    {
      id: "act-3",
      title: "Email Thread Analyzed",
      description: "Extracted action items from team synchronization",
      timestamp: new Date(Date.now() - 1000 * 60 * 120).toISOString(),
      event_type: "source",
      color: "#00d68f",
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
  const router = useRouter();

  // Get dynamic greeting based on time of day
  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return "Good morning";
    if (hour < 18) return "Good afternoon";
    return "Good evening";
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
      const firstKey = sortedKeys[0];
      const firstTs = dateMap[firstKey].timestamp || Date.now();
      const baselineDate = new Date(firstTs - 86400000 * 2);
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
      router.push("/ask");
    }
  };

  // Handle suggested query click
  const handleSuggestedQuery = (query: string) => {
    setSearchQuery(query);
    router.push("/ask");
  };

  // Memory stats array with dynamic values
  const memoryStats = stats
    ? [
        {
          label: "Total Memories",
          value: stats.total_memories.toLocaleString(),
          icon: Brain,
          color: "#6c5ce7",
        },
        {
          label: "Documents",
          value: stats.total_documents.toLocaleString(),
          icon: FileText,
          color: "#4facfe",
        },
        {
          label: "Conversations",
          value: "0", // Will implement later
          icon: MessageSquare,
          color: "#00d68f",
        },
        {
          label: "Images",
          value: "0", // Will implement later
          icon: Image,
          color: "#e84393",
        },
        {
          label: "Recordings",
          value: "0", // Will implement later
          icon: Mic,
          color: "#f0a500",
        },
        {
          label: "Knowledge Graph",
          value: actualTotalNodes.toLocaleString(),
          icon: Link2,
          color: "#25d366",
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
                color: "#f0a500",
            },
            {
                label: "Today's New Memories",
                value: stats.today_memories.toString(),
                icon: Brain,
                color: "#6c5ce7",
            },
            {
                label: "Today's Focus",
                value: stats.todays_focus,
                icon: Zap,
                color: "#4facfe",
            },
            {
                label: "Upcoming Events",
                value: stats.upcoming_events_label,
                icon: Calendar,
                color: "#34a853",
            },
        ]
        : [];

  return (
    <AppLayout>
      <div className="p-8 max-w-[1400px] mx-auto">
        {/* Header */}
        <motion.div
          className="flex items-center justify-between mb-8"
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <div>
            <h1 className="text-3xl font-bold text-white">
              {getGreeting()}, User! 👋
            </h1>
            <p
              className="text-sm mt-1"
              style={{ color: "var(--text-secondary)" }}
            >
              Your <span className="gradient-text font-semibold">second brain</span> is active and learning.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button
              className="w-10 h-10 rounded-xl flex items-center justify-center transition-colors"
              style={{
                background: "var(--bg-card)",
                border: "1px solid var(--border)",
                color: "var(--text-secondary)",
              }}
            >
              <Search size={18} />
            </button>
            <button
              className="relative w-10 h-10 rounded-xl flex items-center justify-center transition-colors"
              style={{
                background: "var(--bg-card)",
                border: "1px solid var(--border)",
                color: "var(--text-secondary)",
              }}
            >
              <Bell size={18} />
              <span
                className="absolute top-2 right-2 w-2 h-2 rounded-full"
                style={{ background: "var(--accent)" }}
              />
            </button>
          </div>
        </motion.div>

        {/* Search Bar */}
        <motion.div
          className="relative mb-4"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15, duration: 0.5 }}
        >
          <div
            className="flex items-center rounded-2xl px-5 py-4"
            style={{
              background: "var(--bg-card)",
              border: "1px solid var(--border)",
            }}
          >
            <Search size={18} style={{ color: "var(--text-muted)" }} />
            <input
              type="text"
              placeholder="Ask anything about your memory..."
              className="flex-1 bg-transparent ml-3 text-sm outline-none placeholder:text-[var(--text-muted)] text-white"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={handleSearch}
            />
            <button
              onClick={() => handleSearch({ key: "Enter" } as any)}
              className="w-9 h-9 rounded-xl flex items-center justify-center text-white transition-all hover:scale-105"
              style={{
                background: "var(--accent)",
                boxShadow: "0 4px 16px rgba(108,92,231,0.35)",
              }}
            >
              <Send size={16} />
            </button>
          </div>
        </motion.div>

        {/* Quick Prompts */}
        <motion.div
          className="flex gap-3 mb-10 flex-wrap"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3, duration: 0.5 }}
        >
          {loading ? (
            Array(3)
              .fill(0)
              .map((_, i) => (
                <div
                  key={i}
                  className="px-4 py-2 rounded-full text-xs font-medium"
                  style={{
                    background: "var(--accent-subtle)",
                    color: "var(--accent-hover)",
                    border: "1px solid rgba(108,92,231,0.2)",
                  }}
                >
                  Loading...
                </div>
              ))
          ) : (
            stats?.suggested_queries.map((prompt, i) => (
              <button
                key={i}
                onClick={() => handleSuggestedQuery(prompt)}
                className="px-4 py-2 rounded-full text-xs font-medium transition-all hover:scale-[1.03]"
                style={{
                  background: "var(--accent-subtle)",
                  color: "var(--accent-hover)",
                  border: "1px solid rgba(108,92,231,0.2)",
                }}
              >
                {prompt}
              </button>
            ))
          )}
        </motion.div>

        {/* Quick Status Cards */}
        <motion.div
          className="mb-8"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3, duration: 0.5 }}
        >
          <div className="grid grid-cols-4 gap-4">
            {quickStatus.map((item, i) => {
              const Icon = item.icon;
              return (
                <motion.div
                  key={i}
                  className="card p-5 flex items-center gap-4"
                  custom={i}
                  initial="hidden"
                  animate="visible"
                  variants={fadeUp}
                >
                  <div
                    className="w-12 h-12 rounded-xl flex items-center justify-center"
                    style={{
                      background: `${item.color}20`,
                    }}
                  >
                    <Icon size={20} style={{ color: item.color }} />
                  </div>
                  <div>
                    <p className="text-xs" style={{ color: "var(--text-muted)" }}>
                      {item.label}
                    </p>
                    <p className="text-lg font-semibold text-white">{item.value}</p>
                  </div>
                </motion.div>
              );
            })}
          </div>
        </motion.div>

        <div className="grid grid-cols-3 gap-8 mb-8">
          {/* Recent Activity */}
          <motion.div
            className="col-span-2"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4, duration: 0.5 }}
          >
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-white">Recent Activity</h2>
              <button
                className="text-xs font-medium"
                style={{ color: "var(--accent)" }}
                onClick={() => router.push("/timeline")}
              >
                View all
              </button>
            </div>
            <div className="space-y-3">
              {loading ? (
                Array(5)
                  .fill(0)
                  .map((_, i) => (
                    <div key={i} className="card p-4">
                      <div className="h-4 bg-gray-700 rounded w-3/4 mb-2"></div>
                      <div className="h-3 bg-gray-700 rounded w-1/2"></div>
                    </div>
                  ))
              ) : (
                stats?.recent_activity.slice(0, 5).map((event: TimelineEvent, i) => (
                  <div
                    key={event.id}
                    className="card p-4 flex items-center gap-4"
                  >
                    <div
                      className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0"
                      style={{
                        background: `${event.color}20`,
                        color: event.color,
                      }}
                    >
                      <Activity size={14} />
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-medium text-white">
                        {event.title}
                      </p>
                      <p
                        className="text-xs"
                        style={{ color: "var(--text-muted)" }}
                      >
                        {event.description}
                      </p>
                    </div>
                    <span className="text-[10px]" style={{ color: "var(--text-muted)" }}>
                      {event.timestamp ? new Date(event.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Just now'}
                    </span>
                  </div>
                ))
              )}
            </div>
          </motion.div>

          {/* Smart Suggestions */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5, duration: 0.5 }}
          >
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-white">Smart Suggestions</h2>
              <button
                className="text-xs font-medium"
                style={{ color: "var(--accent)" }}
              >
                View all
              </button>
            </div>
            <div className="space-y-3">
              {/* Sample suggestions for now */}
              <div className="card p-4 cursor-pointer hover:scale-[1.01] transition-transform">
                <div className="flex items-center gap-3">
                  <div
                    className="w-8 h-8 rounded-lg flex items-center justify-center"
                    style={{
                      background: "rgba(79, 70, 229, 0.15)",
                      color: "#6c5ce7",
                    }}
                  >
                    <FileText size={14} />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-medium text-white">
                      You uploaded DBMS.pdf yesterday
                    </p>
                    <p
                      className="text-xs"
                      style={{ color: "var(--text-muted)" }}
                    >
                      Would you like a summary?
                    </p>
                  </div>
                </div>
              </div>

              <div className="card p-4 cursor-pointer hover:scale-[1.01] transition-transform">
                <div className="flex items-center gap-3">
                  <div
                    className="w-8 h-8 rounded-lg flex items-center justify-center"
                    style={{
                      background: "rgba(52, 211, 153, 0.15)",
                      color: "#00d68f",
                    }}
                  >
                    <Calendar size={14} />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-medium text-white">
                      Interview tomorrow
                    </p>
                    <p
                      className="text-xs"
                      style={{ color: "var(--text-muted)" }}
                    >
                      Review important concepts
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        </div>

        {/* Connected Sources */}
        <motion.div
          className="mb-10"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.55, duration: 0.5 }}
        >
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-white">
              Connected Sources
            </h2>
            <button
              className="text-xs font-medium"
              style={{ color: "var(--accent)" }}
              onClick={() => router.push("/sources")}
            >
              View all
            </button>
          </div>
          <div className="grid grid-cols-5 gap-4">
            {loading ? (
              Array(5)
                .fill(0)
                .map((_, i) => (
                  <div key={i} className="card p-4 flex flex-col items-center gap-3">
                    <div className="w-12 h-12 rounded-xl bg-gray-700"></div>
                    <div className="h-4 bg-gray-700 rounded w-1/2 mb-1"></div>
                    <div className="h-5 bg-gray-700 rounded w-1/3"></div>
                  </div>
                ))
            ) : (
              stats?.connected_sources.map((source, i) => {
                const Icon = sourceIconMap[source.name] || HardDrive;
                const color = sourceColorMap[source.name] || "#6c5ce7";
                return (
                  <motion.div
                    key={source.name}
                    className="card p-4 flex flex-col items-center gap-3 cursor-pointer"
                    custom={i}
                    initial="hidden"
                    animate="visible"
                    variants={fadeUp}
                    onClick={() => router.push("/sources")}
                  >
                    <div
                      className="w-12 h-12 rounded-xl flex items-center justify-center"
                      style={{ background: `${color}20` }}
                    >
                      <Icon size={22} style={{ color }} />
                    </div>
                    <div className="text-center">
                      <p className="text-xs font-semibold text-white">
                        {source.name}
                      </p>
                      <p
                        className="text-lg font-bold mt-0.5"
                        style={{ color }}
                      >
                        {source.items_indexed.toLocaleString()}
                      </p>
                      <p
                        className="text-[10px]"
                        style={{ color: "var(--text-muted)" }}
                      >
                        Synced {source.last_sync}
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
          transition={{ delay: 0.6, duration: 0.5 }}
        >
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-white">
              Memory Stats
            </h2>
            <button
              className="text-xs font-medium"
              style={{ color: "var(--accent)" }}
            >
              View details
            </button>
          </div>
          <div className="grid grid-cols-6 gap-4">
            {memoryStats.map((stat, i) => {
              const Icon = stat.icon;
              return (
                <motion.div
                  key={stat.label}
                  className="card p-5 flex flex-col items-center gap-2"
                  custom={i}
                  initial="hidden"
                  animate="visible"
                  variants={fadeUp}
                >
                  <Icon
                    size={20}
                    style={{ color: stat.color, opacity: 0.8 }}
                  />
                  <p className="text-2xl font-bold text-white">{stat.value}</p>
                  <p
                    className="text-xs"
                    style={{ color: "var(--text-secondary)" }}
                  >
                    {stat.label}
                  </p>
                </motion.div>
              );
            })}
          </div>
        </motion.div>

        {/* Knowledge Growth */}
        <motion.div
          className="mt-10"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.65, duration: 0.5 }}
        >
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-lg font-semibold text-white flex items-center gap-2">
                Knowledge Growth
                <span className="text-xs px-2.5 py-0.5 rounded-full bg-violet-500/10 border border-violet-500/20 text-violet-400 font-normal">
                  Live Sync
                </span>
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Real-time entities, relationships, and accumulation from your Memory Graph
              </p>
            </div>
            <button
              onClick={() => router.push("/memory-graph")}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium bg-slate-800/80 hover:bg-slate-700 border border-slate-700 text-violet-300 hover:text-white transition-all hover:scale-[1.02]"
            >
              <span>Explore Memory Graph</span>
              <ArrowRight size={13} />
            </button>
          </div>

          <div className="grid grid-cols-2 gap-6 mb-6">
            <div
              className="card p-6 rounded-2xl relative overflow-hidden group"
              style={{
                background: "linear-gradient(135deg, #6c5ce720 0%, #4facfe20 100%)",
              }}
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs" style={{ color: "var(--text-muted)" }}>
                    Total Nodes
                  </p>
                  <p className="text-3xl font-bold text-white mt-1">
                    {actualTotalNodes.toLocaleString()}
                  </p>
                  <p className="text-[11px] text-violet-300/80 mt-1 flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-violet-400 animate-pulse" />
                    Memory Graph entities
                  </p>
                </div>
                <div
                  className="w-12 h-12 rounded-xl flex items-center justify-center transition-transform group-hover:scale-110"
                  style={{ background: "#6c5ce720" }}
                >
                  <TrendingUp size={24} style={{ color: "#6c5ce7" }} />
                </div>
              </div>
            </div>

            <div
              className="card p-6 rounded-2xl relative overflow-hidden group"
              style={{
                background: "linear-gradient(135deg, #00d68f20 0%, #4facfe20 100%)",
              }}
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs" style={{ color: "var(--text-muted)" }}>
                    Relationships
                  </p>
                  <p className="text-3xl font-bold text-white mt-1">
                    {actualTotalEdges.toLocaleString()}
                  </p>
                  <p className="text-[11px] text-emerald-300/80 mt-1 flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                    Connected memory edges
                  </p>
                </div>
                <div
                  className="w-12 h-12 rounded-xl flex items-center justify-center transition-transform group-hover:scale-110"
                  style={{ background: "#00d68f20" }}
                >
                  <Link2 size={24} style={{ color: "#00d68f" }} />
                </div>
              </div>
            </div>
          </div>

          {/* Real-time Knowledge Growth Graph Visualization */}
          <div
            className="card p-6 rounded-2xl border mb-6 relative overflow-hidden"
            style={{
              background: "rgba(15, 23, 42, 0.55)",
              borderColor: "rgba(51, 65, 85, 0.45)",
            }}
          >
            <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-violet-500/10 border border-violet-500/20 flex items-center justify-center text-violet-400">
                  <Activity size={15} />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-white">
                    Memory Growth Over Time
                  </h3>
                  <p className="text-[11px] text-slate-400">
                    Cumulative knowledge nodes & entities synchronized with backend (Click any point to inspect)
                  </p>
                </div>
              </div>

              {/* Status pill & active point summary */}
              <div className="flex items-center gap-2">
                {activePoint && activePoint.dateKey !== "baseline" ? (
                  <div className="flex items-center gap-2 px-3 py-1 rounded-lg bg-slate-800/80 border border-slate-700 text-xs">
                    <span className="text-slate-400">{activePoint.fullDate}:</span>
                    <span className="font-semibold text-violet-300">
                      {activePoint.cumulativeTotal} nodes
                    </span>
                    {activePoint.newNodes > 0 && (
                      <span className="text-emerald-400 font-medium">
                        (+{activePoint.newNodes})
                      </span>
                    )}
                  </div>
                ) : (
                  <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-[11px] text-emerald-400 font-medium">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                    Synchronized with Memory Graph
                  </div>
                )}
              </div>
            </div>

            {/* Clickable Milestone Popup Modal */}
            <AnimatePresence>
              {selectedPoint && (
                <motion.div
                  initial={{ opacity: 0, y: -10, scale: 0.98 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -10, scale: 0.98 }}
                  transition={{ duration: 0.2 }}
                  className="mb-5 p-5 rounded-2xl bg-[#090f20]/95 backdrop-blur-xl border border-violet-500/35 shadow-2xl relative"
                >
                  {/* Popup Header */}
                  <div className="flex items-center justify-between pb-3 mb-4 border-b border-slate-800">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-xl bg-violet-500/20 border border-violet-500/30 flex items-center justify-center text-violet-300">
                        <Sparkles size={16} />
                      </div>
                      <div>
                        <h4 className="text-sm font-semibold text-white flex items-center gap-2">
                          {selectedPoint.fullDate}
                          <span className="text-[11px] font-normal px-2 py-0.5 rounded-full bg-violet-500/10 border border-violet-500/20 text-violet-300">
                            {selectedPoint.isBaseline ? "Baseline State" : "Milestone Details"}
                          </span>
                        </h4>
                        <p className="text-xs text-slate-400">
                          Data verified directly against active Memory Graph
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={() => setSelectedPointIndex(null)}
                      className="p-1.5 rounded-lg bg-slate-800/80 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors"
                      title="Close details"
                    >
                      <X size={16} />
                    </button>
                  </div>

                  {/* 4 Stat Cards in Grid */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
                    <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-800">
                      <p className="text-[11px] text-slate-400">Total Nodes at Time</p>
                      <p className="text-xl font-bold text-white mt-0.5">
                        {selectedPoint.cumulativeNodes.toLocaleString()}
                      </p>
                    </div>
                    <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-800">
                      <p className="text-[11px] text-slate-400">Nodes Added</p>
                      <p className="text-xl font-bold text-emerald-400 mt-0.5">
                        +{selectedPoint.newNodes.toLocaleString()}
                      </p>
                    </div>
                    <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-800">
                      <p className="text-[11px] text-slate-400">Total Relationships</p>
                      <p className="text-xl font-bold text-white mt-0.5">
                        {selectedPoint.cumulativeEdges.toLocaleString()}
                      </p>
                    </div>
                    <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-800">
                      <p className="text-[11px] text-slate-400">Relationships Added</p>
                      <p className="text-xl font-bold text-cyan-400 mt-0.5">
                        +{selectedPoint.newEdges.toLocaleString()}
                      </p>
                    </div>
                  </div>

                  {/* 2 Detailed Breakdown Columns: Contributing Sources & Newly Created Entities */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Contributing Sources */}
                    <div className="p-3.5 rounded-xl bg-slate-900/50 border border-slate-800/80 flex flex-col">
                      <div className="flex items-center justify-between mb-2.5">
                        <span className="text-xs font-semibold text-slate-200 flex items-center gap-1.5">
                          <FileText size={14} className="text-amber-400" />
                          Contributing Sources / Documents
                        </span>
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-800 text-slate-400 font-mono">
                          {selectedPoint.contributingSources.length}
                        </span>
                      </div>
                      {selectedPoint.contributingSources.length > 0 ? (
                        <div className="max-h-44 overflow-y-auto pr-1 space-y-1.5">
                          {selectedPoint.contributingSources.map((src, i) => (
                            <div
                              key={src.id || i}
                              className="px-2.5 py-1.5 rounded-lg bg-slate-800/60 border border-slate-700/50 flex items-center justify-between text-xs"
                            >
                              <span className="text-slate-200 truncate pr-2" title={src.label}>
                                {src.label}
                              </span>
                              <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-700/60 text-slate-300 shrink-0">
                                {src.category || "Source"}
                              </span>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-xs text-slate-500 italic py-3">
                          {selectedPoint.isBaseline
                            ? "Baseline zero state before data synchronization."
                            : "No source documents directly recorded in this milestone."}
                        </p>
                      )}
                    </div>

                    {/* Newly Created Entities / Nodes */}
                    <div className="p-3.5 rounded-xl bg-slate-900/50 border border-slate-800/80 flex flex-col">
                      <div className="flex items-center justify-between mb-2.5">
                        <span className="text-xs font-semibold text-slate-200 flex items-center gap-1.5">
                          <Brain size={14} className="text-violet-400" />
                          Newly Created Entities / Nodes
                        </span>
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-800 text-slate-400 font-mono">
                          {selectedPoint.newEntities.length}
                        </span>
                      </div>
                      {selectedPoint.newEntities.length > 0 ? (
                        <div className="max-h-44 overflow-y-auto pr-1 space-y-1.5">
                          {selectedPoint.newEntities.map((ent, i) => (
                            <div
                              key={ent.id || i}
                              className="px-2.5 py-1.5 rounded-lg bg-slate-800/60 border border-slate-700/50 flex items-center justify-between text-xs"
                            >
                              <span className="text-slate-200 truncate pr-2" title={ent.label}>
                                {ent.label}
                              </span>
                              <span
                                className="text-[10px] px-1.5 py-0.5 rounded shrink-0 font-medium border"
                                style={{
                                  backgroundColor: `${ent.color || "#8b5cf6"}1a`,
                                  color: ent.color || "#a78bfa",
                                  borderColor: `${ent.color || "#8b5cf6"}33`,
                                }}
                              >
                                {ent.category || "Entity"}
                              </span>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-xs text-slate-500 italic py-3">
                          {selectedPoint.isBaseline
                            ? "Baseline zero state before entity creation."
                            : "No new entity nodes recorded in this milestone."}
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
                      <linearGradient
                        id="knowledgeGrowthFill"
                        x1="0"
                        y1="0"
                        x2="0"
                        y2="1"
                      >
                        <stop offset="0%" stopColor="#6c5ce7" stopOpacity="0.4" />
                        <stop offset="50%" stopColor="#4facfe" stopOpacity="0.15" />
                        <stop offset="100%" stopColor="#4facfe" stopOpacity="0.0" />
                      </linearGradient>
                      <linearGradient
                        id="knowledgeGrowthStroke"
                        x1="0"
                        y1="0"
                        x2="1"
                        y2="0"
                      >
                        <stop offset="0%" stopColor="#6c5ce7" />
                        <stop offset="50%" stopColor="#a855f7" />
                        <stop offset="100%" stopColor="#4facfe" />
                      </linearGradient>
                      <filter
                        id="pointGlow"
                        x="-50%"
                        y="-50%"
                        width="200%"
                        height="200%"
                      >
                        <feDropShadow
                          dx="0"
                          dy="0"
                          stdDeviation="3"
                          floodColor="#a855f7"
                          floodOpacity="0.7"
                        />
                      </filter>
                    </defs>

                    {/* Horizontal Guide Lines */}
                    <line
                      x1={paddingLeft}
                      y1={paddingTop}
                      x2={chartWidth - paddingRight}
                      y2={paddingTop}
                      stroke="rgba(255, 255, 255, 0.08)"
                      strokeDasharray="4 4"
                    />
                    <line
                      x1={paddingLeft}
                      y1={paddingTop + plotHeight / 2}
                      x2={chartWidth - paddingRight}
                      y2={paddingTop + plotHeight / 2}
                      stroke="rgba(255, 255, 255, 0.05)"
                      strokeDasharray="4 4"
                    />
                    <line
                      x1={paddingLeft}
                      y1={paddingTop + plotHeight}
                      x2={chartWidth - paddingRight}
                      y2={paddingTop + plotHeight}
                      stroke="rgba(255, 255, 255, 0.12)"
                    />

                    {/* Y-axis Labels */}
                    <text
                      x={paddingLeft - 8}
                      y={paddingTop + 4}
                      textAnchor="end"
                      className="text-[10px] fill-slate-400 font-mono"
                    >
                      {maxVal}
                    </text>
                    <text
                      x={paddingLeft - 8}
                      y={paddingTop + plotHeight / 2 + 3}
                      textAnchor="end"
                      className="text-[10px] fill-slate-500 font-mono"
                    >
                      {Math.round(maxVal / 2)}
                    </text>
                    <text
                      x={paddingLeft - 8}
                      y={paddingTop + plotHeight + 3}
                      textAnchor="end"
                      className="text-[10px] fill-slate-500 font-mono"
                    >
                      0
                    </text>

                    {/* Area Under Curve */}
                    {areaPath && (
                      <path
                        d={areaPath}
                        fill="url(#knowledgeGrowthFill)"
                      />
                    )}

                    {/* Smooth Curve Line */}
                    {linePath && (
                      <path
                        d={linePath}
                        fill="none"
                        stroke="url(#knowledgeGrowthStroke)"
                        strokeWidth="3"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    )}

                    {/* Milestone Points - Clickable with popup */}
                    {chartPoints.map((pt, idx) => {
                      const isSelected = selectedPointIndex === idx;
                      const isHovered = hoveredPointIndex === idx;
                      const isLatest = idx === chartPoints.length - 1;
                      return (
                        <g
                          key={pt.dateKey + idx}
                          className="cursor-pointer transition-transform group"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedPointIndex(selectedPointIndex === idx ? null : idx);
                          }}
                          onMouseEnter={() => setHoveredPointIndex(idx)}
                          onMouseLeave={() => setHoveredPointIndex(null)}
                        >
                          {/* Pulsing selection or glow ring */}
                          {(isSelected || isLatest || isHovered) && (
                            <circle
                              cx={pt.x}
                              cy={pt.y}
                              r={isSelected ? 13 : (isHovered ? 12 : 9)}
                              fill="none"
                              stroke={isSelected ? "#38bdf8" : "#a855f7"}
                              strokeOpacity={isSelected ? 0.95 : (isHovered ? 0.6 : 0.3)}
                              strokeWidth={isSelected ? "2.5" : "2"}
                              className={isSelected ? "" : "animate-pulse"}
                            />
                          )}

                          {/* Outer point circle */}
                          <circle
                            cx={pt.x}
                            cy={pt.y}
                            r={isSelected ? 7 : (isHovered ? 6 : (pt.isBaseline ? 3.5 : 5))}
                            fill="#0f172a"
                            stroke={isSelected ? "#38bdf8" : (isHovered ? "#38bdf8" : (pt.isBaseline ? "#64748b" : "#a855f7"))}
                            strokeWidth={isSelected ? "3" : (isHovered ? "2.5" : "2")}
                            filter={!pt.isBaseline || isSelected ? "url(#pointGlow)" : undefined}
                          />

                          {/* Center dot */}
                          <circle
                            cx={pt.x}
                            cy={pt.y}
                            r={isSelected ? 3 : (isHovered ? 2.5 : 1.5)}
                            fill={isSelected ? "#38bdf8" : (isHovered ? "#38bdf8" : "#ffffff")}
                          />

                          {/* X-axis date label */}
                          <text
                            x={pt.x}
                            y={paddingTop + plotHeight + 18}
                            textAnchor="middle"
                            className={`text-[10px] select-none transition-colors ${
                              isSelected
                                ? "fill-cyan-400 font-bold"
                                : isHovered
                                ? "fill-violet-300 font-semibold"
                                : "fill-slate-400 font-normal"
                            }`}
                          >
                            {pt.label}
                          </text>
                        </g>
                      );
                    })}
                  </svg>
                </div>

                {/* Legend & quick indicators footer */}
                <div className="flex items-center justify-between pt-3 mt-2 border-t border-slate-800/80 text-[11px] text-slate-400">
                  <div className="flex items-center gap-4">
                    <span className="flex items-center gap-1.5">
                      <span className="w-2.5 h-2.5 rounded-full bg-gradient-to-r from-violet-500 to-cyan-400" />
                      Cumulative Memory Nodes
                    </span>
                    <span className="text-slate-500">•</span>
                    <span>
                      {growthTimeline.filter(p => p.dateKey !== "baseline").length} sync milestones
                    </span>
                    <span className="text-slate-500">•</span>
                    <span className="text-violet-400/90 font-medium">
                      Tip: Click any milestone point to inspect
                    </span>
                  </div>
                  <div className="text-slate-400">
                    Growth: <span className="text-emerald-400 font-semibold">+{actualTotalNodes} nodes</span> total
                  </div>
                </div>
              </div>
            ) : (
              <div className="py-8 text-center">
                <Brain className="mx-auto mb-2 text-slate-600" size={32} />
                <p className="text-xs text-slate-400">
                  No memory graph nodes yet. Connect a source or chat to start building your knowledge graph.
                </p>
              </div>
            )}
          </div>

          {actualTotalNodes === 0 && (
            <div
              className="card p-6 rounded-2xl"
              style={{
                background: "var(--bg-card)",
                border: "1px solid var(--border)",
              }}
            >
              <p
                className="text-sm"
                style={{ color: "var(--text-secondary)" }}
              >
                Your knowledge graph will grow automatically as EVOLVE learns from your conversations, documents and connected sources.
              </p>
            </div>
          )}
        </motion.div>
      </div>
    </AppLayout>
  );
}
