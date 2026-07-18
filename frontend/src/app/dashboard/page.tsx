"use client";

import AppLayout from "@/components/layout/AppLayout";
import { motion } from "framer-motion";
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
} from "lucide-react";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getDashboardStats, DashboardStats, TimelineEvent } from "@/lib/api";

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

export default function DashboardPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
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

  // Fetch dashboard stats on load
  useEffect(() => {
    const loadStats = async () => {
      try {
        const data = await getDashboardStats();
        setStats(data);
      } catch (error) {
        console.error("Failed to load dashboard stats", error);
      } finally {
        setLoading(false);
      }
    };
    loadStats();
  }, []);

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
          value: stats.total_nodes.toLocaleString(),
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
            <h2 className="text-lg font-semibold text-white">
              Knowledge Growth
            </h2>
          </div>
          <div className="grid grid-cols-2 gap-6 mb-6">
            <div
              className="card p-6 rounded-2xl"
              style={{
                background: "linear-gradient(135deg, #6c5ce720 0%, #4facfe20 100%)",
              }}
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs" style={{ color: "var(--text-muted)" }}>
                    Total Nodes
                  </p>
                  <p className="text-3xl font-bold text-white">
                    {stats?.total_nodes.toLocaleString() || "0"}
                  </p>
                </div>
                <div
                  className="w-12 h-12 rounded-xl flex items-center justify-center"
                  style={{ background: "#6c5ce720" }}
                >
                  <TrendingUp size={24} style={{ color: "#6c5ce7" }} />
                </div>
              </div>
            </div>

            <div
              className="card p-6 rounded-2xl"
              style={{
                background: "linear-gradient(135deg, #00d68f20 0%, #4facfe20 100%)",
              }}
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs" style={{ color: "var(--text-muted)" }}>
                    Relationships
                  </p>
                  <p className="text-3xl font-bold text-white">
                    {stats?.total_edges.toLocaleString() || "0"}
                  </p>
                </div>
                <div
                  className="w-12 h-12 rounded-xl flex items-center justify-center"
                  style={{ background: "#00d68f20" }}
                >
                  <Link2 size={24} style={{ color: "#00d68f" }} />
                </div>
              </div>
            </div>
          </div>
          {!stats?.graph_has_data && (
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
